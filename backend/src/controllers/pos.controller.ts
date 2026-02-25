import { Request, Response } from 'express';
import pool from '../db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { AuthRequest } from '../middleware/auth';
import { io } from '../server';

export const processPrescription = async (req: Request, res: Response) => {
    // Webhook from AI Microservice
    const { patient_id, extracted_lines } = req.body;

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [rxResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO Prescriptions (patient_id, status) VALUES (?, 'Pending Verification')`,
            [patient_id || null]
        );
        const prescriptionId = rxResult.insertId;

        if (extracted_lines && Array.isArray(extracted_lines)) {
            for (const line of extracted_lines) {
                await connection.query(
                    `INSERT INTO Prescription_lines (prescription_id, medicine_name_raw, frequency, total_amount, matched_product_id) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [prescriptionId, line.medicine_name_raw, line.frequency || '', line.total_amount || 0, line.matched_product_id || null]
                );
            }
        }

        await connection.commit();

        // Broadcast to all connected frontend clients
        io.emit('new_ai_scan_received', {
            prescription_id: prescriptionId,
            patient_id,
            extracted_lines
        });

        res.status(200).json({ message: "Prescription processed and broadcasted successfully", prescription_id: prescriptionId });
    } catch (error) {
        await connection.rollback();
        console.error("AI Webhook Error:", error);
        res.status(500).json({ error: 'Internal server error while processing AI webhook' });
    } finally {
        connection.release();
    }
};

export const saveDraftSale = async (req: AuthRequest, res: Response) => {
    const { is_over_the_counter, patient_id, prescription_id, payment_method, total_amount, money_given, notes, items } = req.body;
    const empId = req.user?.emp_id;

    if (!empId) return res.status(401).json({ error: 'Unauthorized' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const [invResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO Sales_Invoices (is_over_the_counter, patient_id, cashier_id, prescription_id, payment_method, total_amount, money_given, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', ?)`,
            [is_over_the_counter ?? true, patient_id || null, empId, prescription_id || null, payment_method || 'Pending', total_amount || 0, money_given || 0, notes || null]
        );
        const invoiceId = invResult.insertId;

        // Note: For drafts, we might just save items dynamically linked to batches if known, but we don't DEDUCT stock. 
        // For simplicity in this demo, draft implies saving the invoice header alone as a "hold" or saving generic items if preferred.
        // Assuming `items` array has { batch_id, quantity, unit_price }
        if (items && items.length > 0) {
            for (const item of items) {
                if (item.batch_id) {
                    await connection.query(
                        `INSERT INTO Sale_Items (invoice_id, batch_id, quantity, unit_price) VALUES (?, ?, ?, ?)`,
                        [invoiceId, item.batch_id, item.quantity, item.unit_price]
                    );
                }
            }
        }

        await connection.commit();
        res.status(200).json({ message: "Draft saved successfully", invoice_id: invoiceId });
    } catch (error) {
        await connection.rollback();
        console.error("Save Draft Error:", error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        connection.release();
    }
};

export const confirmCheckout = async (req: AuthRequest, res: Response) => {
    const { is_over_the_counter, patient_id, prescription_id, payment_method, total_amount, money_given, notes, items } = req.body;
    const empId = req.user?.emp_id;

    if (!empId) return res.status(401).json({ error: 'Unauthorized' });
    if (!items || !items.length) return res.status(400).json({ error: 'Cart is empty' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Create Completed Invoice
        const [invResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO Sales_Invoices (is_over_the_counter, patient_id, cashier_id, prescription_id, payment_method, total_amount, money_given, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Completed', ?)`,
            [is_over_the_counter ?? true, patient_id || null, empId, prescription_id || null, payment_method || 'Cash', total_amount, money_given, notes || null]
        );
        const invoiceId = invResult.insertId;

        // 2. Perform FEFO deductions per product line
        for (const item of items) {
            const productId = item.product_id;
            let reqQty = item.quantity;
            const sellingPrice = item.unit_price;

            // Fetch available batches ordered by Expiry Date ASC
            const [batches] = await connection.query<RowDataPacket[]>(
                `SELECT batch_id, current_stock_level, unit_cost
                 FROM Inventory_Batches 
                 WHERE product_id = ? AND current_stock_level > 0 
                 ORDER BY expiry_date ASC 
                 FOR UPDATE`,
                [productId]
            );

            // Deduct from batches
            for (const batch of batches) {
                if (reqQty <= 0) break;

                const deduction = Math.min(batch.current_stock_level, reqQty);

                // Update Batch Stock
                await connection.query(
                    `UPDATE Inventory_Batches SET current_stock_level = current_stock_level - ? WHERE batch_id = ?`,
                    [deduction, batch.batch_id]
                );

                // Record Sale Item
                await connection.query(
                    `INSERT INTO Sale_Items (invoice_id, batch_id, quantity, unit_price) VALUES (?, ?, ?, ?)`,
                    [invoiceId, batch.batch_id, deduction, sellingPrice]
                );

                reqQty -= deduction;
            }

            if (reqQty > 0) {
                throw new Error(`Insufficient stock for Product ID ${productId}`);
            }

            // Also deduct from global Product stock tracking (optional but good for consistency)
            await connection.query(
                `UPDATE Products SET current_stock = current_stock - ? WHERE product_id = ?`,
                [item.quantity, productId]
            );
        }

        // If a prescription was linked, mark it as verified/completed if needed
        if (prescription_id) {
            await connection.query(
                `UPDATE Prescriptions SET status = 'Verified' WHERE prescription_id = ?`,
                [prescription_id]
            );
        }

        await connection.commit();
        res.status(200).json({
            message: "Checkout completed successfully",
            invoice_id: invoiceId,
            change_due: Math.max(0, money_given - total_amount)
        });
    } catch (error: any) {
        await connection.rollback();
        console.error("Checkout Error:", error);
        res.status(500).json({ error: error.message || 'Internal server error during checkout' });
    } finally {
        connection.release();
    }
};

export const searchPosProducts = async (req: AuthRequest, res: Response) => {
    const { q } = req.query;
    try {
        let queryStr = `
            SELECT p.product_id, p.name, p.measure_unit, p.current_stock as total_stock,
            (SELECT unit_cost FROM Inventory_Batches WHERE product_id = p.product_id AND current_stock_level > 0 ORDER BY expiry_date ASC LIMIT 1) as selling_price
            FROM Products p
        `;
        let queryParams: any[] = [];

        if (q) {
            queryStr += ' WHERE p.name LIKE ? OR p.category LIKE ?';
            const likeStr = `%${q}%`;
            queryParams.push(likeStr, likeStr);
        }

        queryStr += ' LIMIT 20';

        const [products] = await pool.query<RowDataPacket[]>(queryStr, queryParams);

        // Let's populate batches for these products
        for (let prod of products) {
            const [batches] = await pool.query<RowDataPacket[]>(
                `SELECT batch_id, batch_number, expiry_date, current_stock_level 
                 FROM Inventory_Batches 
                 WHERE product_id = ? AND current_stock_level > 0 
                 ORDER BY expiry_date ASC`,
                [prod.product_id]
            );
            prod.batches = batches;
        }

        res.status(200).json(products);
    } catch (error) {
        console.error("Search POS Products Error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getInvoiceReceipt = async (req: AuthRequest, res: Response) => {
    const invoiceId = parseInt(req.params.id as string);
    if (!invoiceId) return res.status(400).json({ error: 'Invalid invoice ID' });

    try {
        const [invoices] = await pool.query<RowDataPacket[]>(
            `SELECT i.invoice_id, i.total_amount, i.money_given, i.created_at as received_at, i.payment_method, e.name as cashier_name
             FROM Sales_Invoices i
             JOIN Employee e ON i.cashier_id = e.emp_id
             WHERE i.invoice_id = ?`,
            [invoiceId]
        );

        if (invoices.length === 0) return res.status(404).json({ error: 'Invoice not found' });

        const invoice = invoices[0];

        const [items] = await pool.query<RowDataPacket[]>(
            `SELECT si.quantity, si.unit_price, p.name as product_name
             FROM Sale_Items si
             JOIN Inventory_Batches ib ON si.batch_id = ib.batch_id
             JOIN Products p ON ib.product_id = p.product_id
             WHERE si.invoice_id = ?`,
            [invoiceId]
        );

        res.status(200).json({ ...invoice, items });
    } catch (error) {
        console.error("Get Invoice Receipt Error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
