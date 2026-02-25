import { Request, Response } from 'express';
import pool from '../db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ----------------- INVENTORY & GRN -----------------

export const receiveStock = async (req: Request, res: Response) => {
    // Requires VIEW_TAB_GRN
    const connection = await pool.getConnection();

    try {
        const { supplier_id, supplier_invoice_number, payment_method, check_number, check_date, batches } = req.body;

        // Basic validation
        if (!supplier_id || !supplier_invoice_number || !payment_method || !batches || !Array.isArray(batches) || batches.length === 0) {
            return res.status(400).json({ error: 'Missing required GRN fields or batches' });
        }

        const emp_id = (req as any).user?.emp_id;
        if (!emp_id) return res.status(401).json({ error: 'Unauthorized' });

        await connection.beginTransaction();

        // 1. Calculate invoice total_amount
        let total_amount = 0;
        for (const batch of batches) {
            total_amount += (batch.purchased_quantity * batch.unit_cost);
        }

        // 2. Insert Supplier_Invoice
        const formattedCheckDate = (payment_method === 'Check' && check_date) ? check_date : null;
        const formattedCheckNumber = (payment_method === 'Check' && check_number) ? check_number : null;

        const [invoiceResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO Supplier_Invoices 
            (supplier_id, supplier_invoice_number, total_amount, payment_method, check_number, check_date, recorded_by_emp_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [supplier_id, supplier_invoice_number, total_amount, payment_method, formattedCheckNumber, formattedCheckDate, emp_id]
        );
        const invoiceId = invoiceResult.insertId;

        // 3. Insert Inventory_Batches AND Update Products.current_stock
        for (const batch of batches) {
            const qty = Number(batch.purchased_quantity) + Number(batch.bonus_quantity || 0);

            await connection.query(
                `INSERT INTO Inventory_Batches 
                (product_id, supplier_invoice_id, batch_number, expiry_date, location, purchased_quantity, bonus_quantity, unit_cost, current_stock_level) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    batch.product_id,
                    invoiceId,
                    batch.batch_number,
                    batch.expiry_date,
                    batch.location || null,
                    batch.purchased_quantity,
                    batch.bonus_quantity || 0,
                    batch.unit_cost,
                    qty
                ]
            );

            // Sync the master Product stock level
            await connection.query(
                `UPDATE Products SET current_stock = current_stock + ? WHERE product_id = ?`,
                [qty, batch.product_id]
            );
        }

        // 4. Create Audit_Log
        await connection.query(
            `INSERT INTO Audit_Logs (emp_id, action_type, details) VALUES (?, ?, ?)`,
            [emp_id, 'RECEIVE_STOCK', `Received GRN ${supplier_invoice_number} from supplier ${supplier_id}. Total: ${total_amount}`]
        );

        await connection.commit();

        res.status(201).json({
            message: 'Stock received successfully',
            invoice_id: invoiceId,
            total_amount
        });

    } catch (error) {
        await connection.rollback();
        console.error('GRN Transaction Error:', error);
        res.status(500).json({ error: 'Internal server error during GRN processing' });
    } finally {
        connection.release();
    }
};

export const getAlerts = async (req: Request, res: Response) => {
    try {
        // Now using the optimized 'current_stock' column from Products table
        const [lowStock] = await pool.query<RowDataPacket[]>(
            `SELECT product_id, name, reorder_threshold, current_stock AS current_stock_level
             FROM Products
             WHERE current_stock <= reorder_threshold AND reorder_threshold > 0`
        );

        const [nearExpiry] = await pool.query<RowDataPacket[]>(
            `SELECT b.batch_id, p.product_id, p.name, b.batch_number, b.expiry_date, b.current_stock_level
             FROM Inventory_Batches b
             JOIN Products p ON b.product_id = p.product_id
             WHERE b.current_stock_level > 0 
               AND b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)`
        );

        res.status(200).json({ lowStock, nearExpiry });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
