import { Request, Response } from 'express';
import pool from '../db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import crypto from 'crypto';
import { encryptData, decryptData, hashSearchableData } from '../utils/encryption';
import { AuthRequest } from '../middleware/auth';

// ----------------- PATIENT MANAGEMENT -----------------

export const createPatient = async (req: Request, res: Response) => {
    try {
        const { name, phone, address, birth_year, clinical_notes, consent_given } = req.body;

        if (!consent_given) {
            return res.status(400).json({ error: 'Explicit consent is required to store patient data.' });
        }
        if (!name || !phone || !birth_year) {
            return res.status(400).json({ error: 'Name, phone, and birth year are required.' });
        }

        const patient_id = crypto.randomUUID();
        const phone_number_hash = hashSearchableData(phone);

        const bioDataObj = { name, phone, address };
        const encrypted_bio_data = encryptData(JSON.stringify(bioDataObj));

        const clinicalNotesObj = { clinical_notes };
        const encrypted_clinical_notes = encryptData(JSON.stringify(clinicalNotesObj));

        await pool.query(
            `INSERT INTO Patients 
            (patient_id, phone_number_hash, encrypted_bio_data, encrypted_clinical_notes, birth_year, opted_out) 
            VALUES (?, ?, ?, ?, ?, FALSE)`,
            [patient_id, phone_number_hash, encrypted_bio_data, encrypted_clinical_notes, birth_year]
        );

        res.status(201).json({ message: 'Patient registered successfully', patient_id });
    } catch (error) {
        console.error('Create Patient Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getPatient = async (req: Request, res: Response) => {
    try {
        const patientId = req.params.id;

        const [patients] = await pool.query<RowDataPacket[]>('SELECT * FROM Patients WHERE patient_id = ?', [patientId]);

        if (patients.length === 0) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const patient = patients[0];

        let bioData = {};
        let clinicalNotes = {};

        if (!patient.opted_out) {
            if (patient.encrypted_bio_data) {
                const decryptedStr = decryptData(patient.encrypted_bio_data);
                if (decryptedStr) bioData = JSON.parse(decryptedStr);
            }
            if (patient.encrypted_clinical_notes) {
                const decryptedStr = decryptData(patient.encrypted_clinical_notes);
                if (decryptedStr) clinicalNotes = JSON.parse(decryptedStr);
            }
        }

        // Aggregate History
        const [invoices] = await pool.query<RowDataPacket[]>(
            `SELECT invoice_id, total_amount, payment_method, created_at 
             FROM Sales_Invoices WHERE patient_id = ? ORDER BY created_at DESC LIMIT 50`,
            [patientId]
        );

        const [prescriptions] = await pool.query<RowDataPacket[]>(
            `SELECT prescription_id, status, created_at 
             FROM Prescriptions WHERE patient_id = ? ORDER BY created_at DESC LIMIT 50`,
            [patientId]
        );

        res.status(200).json({
            patient_id: patient.patient_id,
            birth_year: patient.birth_year,
            opted_out: patient.opted_out,
            created_at: patient.created_at,
            ...bioData,
            ...clinicalNotes,
            history: {
                invoices,
                prescriptions
            }
        });
    } catch (error) {
        console.error('Get Patient Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const searchPatients = async (req: Request, res: Response) => {
    try {
        const phone = req.query.phone as string;
        if (!phone) {
            return res.status(200).json([]);
        }

        const phoneHash = hashSearchableData(phone);

        const [patients] = await pool.query<RowDataPacket[]>(
            `SELECT patient_id, encrypted_bio_data, birth_year, opted_out 
             FROM Patients WHERE phone_number_hash = ? AND opted_out = FALSE`,
            [phoneHash]
        );

        const results = patients.map(p => {
            let bioData: any = {};
            if (p.encrypted_bio_data) {
                const decryptedStr = decryptData(p.encrypted_bio_data);
                if (decryptedStr) bioData = JSON.parse(decryptedStr);
            }
            return {
                patient_id: p.patient_id,
                name: bioData.name || 'Unknown',
                phone: bioData.phone || '',
                birth_year: p.birth_year
            };
        });

        res.status(200).json(results);
    } catch (error) {
        console.error('Search Patients Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getPatientDiscount = async (req: Request, res: Response) => {
    try {
        const patientId = req.params.id;

        const [patients] = await pool.query<RowDataPacket[]>(
            `SELECT birth_year, created_at, opted_out FROM Patients WHERE patient_id = ?`,
            [patientId]
        );

        if (patients.length === 0 || patients[0].opted_out) {
            return res.status(200).json({
                patient_id: patientId,
                senior_pct: 0,
                loyalty_pct: 0,
                applied_discount_pct: 0
            });
        }

        const patient = patients[0];
        const currentYear = new Date().getFullYear();
        const age = currentYear - patient.birth_year;

        const senior_pct = age >= 60 ? 5 : 0;

        const createdAt = new Date(patient.created_at);
        const now = new Date();
        const monthsSinceCreation = (now.getFullYear() - createdAt.getFullYear()) * 12 + (now.getMonth() - createdAt.getMonth());

        const loyalty_pct = Math.max(0, monthsSinceCreation * 0.5);

        const applied_discount_pct = Math.min(senior_pct + loyalty_pct, 7);

        res.status(200).json({
            patient_id: patientId,
            senior_pct,
            loyalty_pct,
            applied_discount_pct
        });
    } catch (error) {
        console.error('Get Patient Discount Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const optOutPatient = async (req: Request, res: Response) => {
    try {
        const patientId = req.params.id;

        await pool.query(
            `UPDATE Patients 
             SET encrypted_bio_data = NULL, encrypted_clinical_notes = NULL, phone_number_hash = NULL, opted_out = TRUE 
             WHERE patient_id = ?`,
            [patientId]
        );

        res.status(200).json({ message: 'Patient data has been successfully anonymized.' });
    } catch (error) {
        console.error('Opt-Out Patient Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
