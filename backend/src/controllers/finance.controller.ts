import { Request, Response } from 'express';
import pool from '../db';
import { RowDataPacket } from 'mysql2';

// ----------------- FINANCE (CHECKS) -----------------

export const getPendingChecks = async (req: Request, res: Response) => {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT i.invoice_id, i.supplier_id, s.name as supplier_name, i.supplier_invoice_number, 
                    i.total_amount, i.check_number, i.check_date, i.check_cleared, i.received_at
             FROM Supplier_Invoices i
             JOIN Suppliers s ON i.supplier_id = s.supplier_id
             WHERE i.payment_method = 'Check' AND i.check_cleared = FALSE
             ORDER BY i.check_date ASC`
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const clearCheck = async (req: Request, res: Response) => {
    const connection = await pool.getConnection();
    try {
        const id = req.params.id;
        const emp_id = (req as any).user?.emp_id;
        if (!emp_id) return res.status(401).json({ error: 'Unauthorized' });

        await connection.beginTransaction();

        await connection.query(
            'UPDATE Supplier_Invoices SET check_cleared = TRUE WHERE invoice_id = ? AND payment_method = "Check"',
            [id]
        );

        await connection.query(
            `INSERT INTO Audit_Logs (emp_id, action_type, details) VALUES (?, ?, ?)`,
            [emp_id, 'CLEAR_CHECK', `Cleared check for invoice ID ${id}`]
        );

        await connection.commit();
        res.status(200).json({ message: 'Check cleared successfully' });

    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
};
