import { Request, Response } from 'express';
import pool from '../db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ----------------- SUPPLIERS -----------------

export const getAllSuppliers = async (req: Request, res: Response) => {
    try {
        const [rows] = await pool.query('SELECT * FROM Suppliers');
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createSupplier = async (req: Request, res: Response) => {
    try {
        const { name, contact_email, phone } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO Suppliers (name, contact_email, phone) VALUES (?, ?, ?)',
            [name, contact_email || null, phone || null]
        );
        res.status(201).json({ message: 'Supplier created successfully', supplier_id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateSupplier = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const { name, contact_email, phone } = req.body;

        await pool.query(
            'UPDATE Suppliers SET name = ?, contact_email = ?, phone = ? WHERE supplier_id = ?',
            [name, contact_email, phone, id]
        );
        res.status(200).json({ message: 'Supplier updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteSupplier = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        await pool.query('DELETE FROM Suppliers WHERE supplier_id = ?', [id]);
        res.status(200).json({ message: 'Supplier deleted successfully' });
    } catch (error: any) {
        console.error(error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ error: 'Cannot delete supplier with active invoices' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};
