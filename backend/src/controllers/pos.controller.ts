import { Request, Response } from 'express';
import pool from '../db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { AuthRequest } from '../middleware/auth';
import { io } from '../server';

export const processPrescription = async (req: Request, res: Response) => {
    // Webhook from AI Microservice
    // NOTE: Just broadcast extracted lines to frontend without database validation
    // User will select patient and save later from the POS interface
    const { extracted_lines } = req.body;

    try {
        // Broadcast raw OCR data to all connected frontend clients
        // Frontend will display in modal, user can review, modify, and select patient before saving
        io.emit('new_ai_scan_received', {
            prescription_id: null,
            patient_id: null, // User will select patient in UI
            extracted_lines: extracted_lines || []
        });

        res.status(200).json({ 
            message: "Prescription data sent to frontend for manual processing", 
            prescription_id: null
        });
    } catch (error) {
        console.error("AI Webhook Error:", error);
        res.status(500).json({ error: 'Internal server error while processing AI webhook' });
    }
};

export const saveDraftSale = async (req: AuthRequest, res: Response) => {
    const { is_over_the_counter, patient_id, prescription_id, payment_method, total_amount, money_given, notes, items } = req.body;
    if (money_given < 0) return res.status(400).json({ error: 'Money given cannot be negative' });
    const empId = req.user?.emp_id;

    if (!empId) return res.status(401).json({ error: 'Unauthorized' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let safePrescriptionId: number | null = null;
        if (prescription_id) {
            const [rxRows] = await connection.query<RowDataPacket[]>(
                `SELECT prescription_id FROM Prescriptions WHERE prescription_id = ? LIMIT 1`,
                [prescription_id]
            );
            safePrescriptionId = rxRows.length > 0 ? Number(rxRows[0].prescription_id) : null;
        }

        const [invResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO Sales_Invoices (is_over_the_counter, patient_id, cashier_id, prescription_id, payment_method, total_amount, money_given, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Draft', ?)`,
            [is_over_the_counter ?? true, patient_id || null, empId, safePrescriptionId, payment_method || 'Pending', total_amount || 0, money_given || 0, notes || null]
        );
        const invoiceId = invResult.insertId;

        // Note: For drafts, we might just save items dynamically linked to batches if known, but we don't DEDUCT stock. 
        // For simplicity in this demo, draft implies saving the invoice header alone as a "hold" or saving generic items if preferred.
        // Assuming `items` array has { batch_id, quantity, unit_price }
        if (items && items.length > 0) {
            for (const item of items) {
                await connection.query(
                    `INSERT INTO Sale_Items (invoice_id, product_id, medicine_name_raw, batch_id, quantity, unit_price, item_type, frequency) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [invoiceId, item.product_id || null, item.product_id ? null : (item.product_name || 'Generic Item'), item.batch_id || null, item.quantity, item.unit_price, item.type || 'otc', item.frequency || '']
                );
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
    if (money_given < 0) return res.status(400).json({ error: 'Money given cannot be negative' });
    const empId = req.user?.emp_id;

    if (!empId) return res.status(401).json({ error: 'Unauthorized' });
    if (!items || !items.length) return res.status(400).json({ error: 'Cart is empty' });

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        let currentRxId = prescription_id || null;
        if (currentRxId) {
            const [rxRows] = await connection.query<RowDataPacket[]>(
                `SELECT prescription_id FROM Prescriptions WHERE prescription_id = ? LIMIT 1`,
                [currentRxId]
            );
            currentRxId = rxRows.length > 0 ? Number(rxRows[0].prescription_id) : null;
        }
        const rxItems = items.filter((i: any) => i.type === 'rx');

        if (rxItems.length > 0 && patient_id && !currentRxId) {
            const [rxRes] = await connection.query<ResultSetHeader>(
                `INSERT INTO Prescriptions (patient_id, status) VALUES (?, 'Verified')`,
                [patient_id]
            );
            currentRxId = rxRes.insertId;

            for (const item of rxItems) {
                // Determine name if possible, or leave as generic
                await connection.query(
                    `INSERT INTO Prescription_lines (prescription_id, medicine_name_raw, frequency, total_amount, matched_product_id) 
                     VALUES (?, (SELECT name FROM Products WHERE product_id = ? LIMIT 1), ?, ?, ?)`,
                    [currentRxId, item.product_id, item.frequency || '', item.quantity, item.product_id]
                );
            }
        } else if (currentRxId && patient_id) {
            await connection.query(
                `UPDATE Prescriptions SET status = 'Verified', patient_id = COALESCE(patient_id, ?) WHERE prescription_id = ?`,
                [patient_id, currentRxId]
            );
        } else if (currentRxId) {
            await connection.query(
                `UPDATE Prescriptions SET status = 'Verified' WHERE prescription_id = ?`,
                [currentRxId]
            );
        }

        // 1. Create Completed Invoice
        const [invResult] = await connection.query<ResultSetHeader>(
            `INSERT INTO Sales_Invoices (is_over_the_counter, patient_id, cashier_id, prescription_id, payment_method, total_amount, money_given, status, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'Completed', ?)`,
            [is_over_the_counter ?? true, patient_id || null, empId, currentRxId, payment_method || 'Cash', total_amount, money_given, notes || null]
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
                    `INSERT INTO Sale_Items (invoice_id, batch_id, quantity, unit_price, item_type, frequency) VALUES (?, ?, ?, ?, ?, ?)`,
                    [invoiceId, batch.batch_id, deduction, sellingPrice, item.type || 'otc', item.frequency || '']
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
            SELECT p.product_id, p.name, p.measure_unit, p.current_stock as total_stock, p.selling_price
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
            `SELECT i.invoice_id, i.total_amount, i.money_given, i.created_at as received_at, i.payment_method, i.status, e.name as cashier_name, i.patient_id
             FROM Sales_Invoices i
             JOIN Employee e ON i.cashier_id = e.emp_id
             WHERE i.invoice_id = ?`,
            [invoiceId]
        );

        if (invoices.length === 0) return res.status(404).json({ error: 'Invoice not found' });

        const invoice = invoices[0];

        // For completed sales, we can query Sale_Items -> Batches -> Products
        // For drafts, we might also have Sale_Items recorded if batches were assigned.
        // For completed sales, we can query Sale_Items -> Batches -> Products
        // For drafts, we might also have Sale_Items recorded with just product_id.
        const [items] = await pool.query<RowDataPacket[]>(
            `SELECT si.sale_item_id, si.quantity, si.unit_price, si.item_type, si.frequency, 
                    COALESCE(p.name, p2.name, si.medicine_name_raw) as product_name, 
                    COALESCE(ib.product_id, si.product_id) as product_id,
                    si.batch_id
             FROM Sale_Items si
             LEFT JOIN Inventory_Batches ib ON si.batch_id = ib.batch_id
             LEFT JOIN Products p ON ib.product_id = p.product_id
             LEFT JOIN Products p2 ON si.product_id = p2.product_id
             WHERE si.invoice_id = ?`,
            [invoiceId]
        );

        res.status(200).json({ ...invoice, items });
    } catch (error) {
        console.error("Get Invoice Receipt Error:", error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const getSalesHistory = async (req: AuthRequest, res: Response) => {
    try {
        const [sales] = await pool.query<RowDataPacket[]>(
            `SELECT i.invoice_id, i.total_amount, i.created_at, i.payment_method, i.status, e.name as cashier_name
             FROM Sales_Invoices i
             JOIN Employee e ON i.cashier_id = e.emp_id
             ORDER BY i.created_at DESC LIMIT 100`
        );
        res.status(200).json(sales);
    } catch (err) {
        console.error("Error fetching sales history:", err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteInvoice = async (req: AuthRequest, res: Response) => {
    const invoiceId = parseInt(req.params.id as string);
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [invoices] = await connection.query<RowDataPacket[]>(
            `SELECT status FROM Sales_Invoices WHERE invoice_id = ?`, [invoiceId]
        );

        if (invoices.length === 0) {
            await connection.rollback();
            return res.status(404).json({ error: 'Invoice not found' });
        }
        const invoice = invoices[0];

        // Only allow reverting Complete or deleting Draft
        if (invoice.status === 'Completed') {
            const [items] = await connection.query<RowDataPacket[]>(
                `SELECT batch_id, quantity FROM Sale_Items WHERE invoice_id = ?`, [invoiceId]
            );

            for (const item of items) {
                await connection.query(
                    `UPDATE Inventory_Batches SET current_stock_level = current_stock_level + ? WHERE batch_id = ?`,
                    [item.quantity, item.batch_id]
                );

                const [batchParam] = await connection.query<RowDataPacket[]>(`SELECT product_id FROM Inventory_Batches WHERE batch_id = ?`, [item.batch_id]);
                if (batchParam.length > 0) {
                    await connection.query(
                        `UPDATE Products SET current_stock = current_stock + ? WHERE product_id = ?`,
                        [item.quantity, batchParam[0].product_id]
                    );
                }
            }
        }

        await connection.query(`DELETE FROM Sales_Invoices WHERE invoice_id = ?`, [invoiceId]);

        const emp_id = req.user?.emp_id;
        if (emp_id) {
            await connection.query(
                `INSERT INTO Audit_Logs (emp_id, action_type, details) VALUES (?, ?, ?)`,
                [emp_id, 'DELETE_SALE', `Deleted/Voided invoice ID ${invoiceId} and restored stock`]
            );
        }

        await connection.commit();
        res.status(200).json({ message: 'Invoice deleted successfully' });
    } catch (error) {
        await connection.rollback();
        console.error(error);
        res.status(500).json({ error: 'Internal error' });
    } finally {
        connection.release();
    }
};

