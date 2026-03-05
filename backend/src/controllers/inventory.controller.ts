import { Request, Response } from 'express';
import pool from '../db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { AuthRequest } from '../middleware/auth';

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

export const getGrnHistory = async (req: AuthRequest, res: Response) => {
    try {
        const [history] = await pool.query<RowDataPacket[]>(
            `SELECT i.invoice_id, i.supplier_invoice_number, i.total_amount, i.payment_method, 
                    i.check_number, i.check_date, i.check_cleared, i.received_at, 
                    s.supplier_id, s.name as supplier_name, e.name as recorded_by
             FROM Supplier_Invoices i
             JOIN Suppliers s ON i.supplier_id = s.supplier_id
             JOIN Employee e ON i.recorded_by_emp_id = e.emp_id
             ORDER BY i.received_at DESC
             LIMIT 100`
        );
        res.status(200).json(history);
    } catch (error) {
        console.error("Error fetching GRN history:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// ----------------- BATCHES (CRUD) -----------------

export const getAllBatches = async (req: Request, res: Response) => {
    try {
        const [rows] = await pool.query(`
            SELECT b.*, p.name as product_name
            FROM Inventory_Batches b
            JOIN Products p ON b.product_id = p.product_id
            ORDER BY b.expiry_date ASC
        `);
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error fetching batches:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createBatch = async (req: AuthRequest, res: Response) => {
    const connection = await pool.getConnection();
    try {
        const { product_id, batch_number, expiry_date, location, purchased_quantity, bonus_quantity, unit_cost } = req.body;

        if (!product_id || !batch_number || !expiry_date || purchased_quantity === undefined || unit_cost === undefined) {
            return res.status(400).json({ error: 'Missing required batch fields' });
        }

        const qty = Number(purchased_quantity) + Number(bonus_quantity || 0);
        const emp_id = req.user?.emp_id;

        await connection.beginTransaction();

        const [result] = await connection.query<ResultSetHeader>(
            `INSERT INTO Inventory_Batches 
            (product_id, supplier_invoice_id, batch_number, expiry_date, location, purchased_quantity, bonus_quantity, unit_cost, current_stock_level) 
            VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)`,
            [product_id, batch_number, expiry_date, location || null, purchased_quantity, bonus_quantity || 0, unit_cost, qty]
        );

        await connection.query(
            `UPDATE Products SET current_stock = current_stock + ? WHERE product_id = ?`,
            [qty, product_id]
        );

        if (emp_id) {
            await connection.query(
                `INSERT INTO Audit_Logs (emp_id, action_type, details) VALUES (?, ?, ?)`,
                [emp_id, 'CREATE_BATCH', `Created batch ${batch_number} manually for product ${product_id} with quantity ${qty}`]
            );
        }

        await connection.commit();
        res.status(201).json({ message: 'Batch created successfully', batch_id: result.insertId });
    } catch (error) {
        await connection.rollback();
        console.error("Error creating batch:", error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
};

export const updateBatch = async (req: AuthRequest, res: Response) => {
    const connection = await pool.getConnection();
    try {
        const id = req.params.id;
        const { batch_number, expiry_date, location, purchased_quantity, bonus_quantity, unit_cost, current_stock_level } = req.body;

        if (!batch_number || !expiry_date || current_stock_level === undefined || unit_cost === undefined) {
            return res.status(400).json({ error: 'Missing required batch fields' });
        }

        await connection.beginTransaction();

        const [oldBatchRows] = await connection.query<RowDataPacket[]>(
            'SELECT product_id, current_stock_level FROM Inventory_Batches WHERE batch_id = ?',
            [id]
        );

        if (oldBatchRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Batch not found' });
        }

        const oldBatch = oldBatchRows[0];
        const stockDiff = Number(current_stock_level) - oldBatch.current_stock_level;

        await connection.query(
            `UPDATE Inventory_Batches 
             SET batch_number = ?, expiry_date = ?, location = ?, purchased_quantity = ?, bonus_quantity = ?, unit_cost = ?, current_stock_level = ? 
             WHERE batch_id = ?`,
            [batch_number, expiry_date, location || null, purchased_quantity || 0, bonus_quantity || 0, unit_cost, current_stock_level, id]
        );

        if (stockDiff !== 0) {
            await connection.query(
                `UPDATE Products SET current_stock = current_stock + ? WHERE product_id = ?`,
                [stockDiff, oldBatch.product_id]
            );
        }

        const emp_id = req.user?.emp_id;
        if (emp_id) {
            await connection.query(
                `INSERT INTO Audit_Logs (emp_id, action_type, details) VALUES (?, ?, ?)`,
                [emp_id, 'UPDATE_BATCH', `Updated batch ID ${id} (changed stock by ${stockDiff})`]
            );
        }

        await connection.commit();
        res.status(200).json({ message: 'Batch updated successfully' });
    } catch (error) {
        await connection.rollback();
        console.error("Error updating batch:", error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
};

export const deleteBatch = async (req: AuthRequest, res: Response) => {
    const connection = await pool.getConnection();
    try {
        const id = req.params.id;

        await connection.beginTransaction();

        const [oldBatchRows] = await connection.query<RowDataPacket[]>(
            'SELECT product_id, current_stock_level FROM Inventory_Batches WHERE batch_id = ?',
            [id]
        );

        if (oldBatchRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Batch not found' });
        }

        const oldBatch = oldBatchRows[0];

        try {
            await connection.query('DELETE FROM Inventory_Batches WHERE batch_id = ?', [id]);
        } catch (err: any) {
            if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                await connection.rollback();
                return res.status(400).json({ error: 'Cannot delete batch because it is linked to sale items.' });
            }
            throw err;
        }

        await connection.query(
            `UPDATE Products SET current_stock = current_stock - ? WHERE product_id = ?`,
            [oldBatch.current_stock_level, oldBatch.product_id]
        );

        const emp_id = req.user?.emp_id;
        if (emp_id) {
            await connection.query(
                `INSERT INTO Audit_Logs (emp_id, action_type, details) VALUES (?, ?, ?)`,
                [emp_id, 'DELETE_BATCH', `Deleted batch ID ${id} (decreased product stock by ${oldBatch.current_stock_level})`]
            );
        }

        await connection.commit();
        res.status(200).json({ message: 'Batch deleted successfully' });
    } catch (error: any) {
        await connection.rollback();
        console.error("Error deleting batch:", error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
};
