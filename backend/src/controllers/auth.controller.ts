import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';


const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfallback';

export const register = async (req: Request, res: Response) => {
    try {
        const { name, email, password, role_id } = req.body;

        const [existingUsers] = await pool.query<RowDataPacket[]>('SELECT * FROM Employee WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(400).json({ error: 'Email already exists.' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const finalRoleId = role_id || 3; // Default to Assistant Pharmacist if not provided
        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO Employee (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
            [name, email, password_hash, finalRoleId]
        );

        res.status(201).json({
            message: 'Employee registered successfully.',
            employee: {
                emp_id: result.insertId,
                name,
                email,
                role_id: finalRoleId,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        const [employees] = await pool.query<RowDataPacket[]>(
            `SELECT e.*, r.role_name 
             FROM Employee e 
             JOIN Role r ON e.role_id = r.role_id 
             WHERE e.email = ?`,
            [email]
        );

        if (employees.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const employee = employees[0];

        const validPassword = await bcrypt.compare(password, employee.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Fetch permissions for this role
        const [permRows] = await pool.query<RowDataPacket[]>(
            `SELECT p.action_name 
             FROM Permission p 
             JOIN Role_Permission rp ON p.perm_id = rp.perm_id 
             WHERE rp.role_id = ?`,
            [employee.role_id]
        );
        const permissions = permRows.map(row => row.action_name);

        const tokenPayload = {
            emp_id: employee.emp_id,
            role_id: employee.role_id,
            role_name: employee.role_name,
            permissions,
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

        res.status(200).json({
            message: 'Login successful.',
            token,
            user: {
                emp_id: employee.emp_id,
                name: employee.name,
                role: employee.role_name,
                permissions,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};
