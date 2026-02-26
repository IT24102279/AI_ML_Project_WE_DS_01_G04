import { Request, Response } from 'express';
import pool from '../db';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// ----------------- PRODUCTS -----------------

export const getAllProducts = async (req: Request, res: Response) => {
    try {
        const [rows] = await pool.query('SELECT * FROM Products');
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const searchProducts = async (req: Request, res: Response) => {
    try {
        const query = req.query.q as string;
        if (!query) return res.status(200).json([]);

        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT product_id, name, measure_unit FROM Products WHERE name LIKE ? LIMIT 20',
            [`%${query}%`]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const createProduct = async (req: Request, res: Response) => {
    try {
        const { name, measure_unit, category, reorder_threshold, current_stock, selling_price } = req.body;
        if (!name || !measure_unit) return res.status(400).json({ error: 'Name and Unit are required' });

        const [result] = await pool.query<ResultSetHeader>(
            'INSERT INTO Products (name, measure_unit, category, reorder_threshold, current_stock, selling_price) VALUES (?, ?, ?, ?, ?, ?)',
            [name, measure_unit, category || null, reorder_threshold || 0, current_stock || 0, selling_price || 0.00]
        );
        res.status(201).json({ message: 'Product created successfully', product_id: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateProduct = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        const { name, measure_unit, category, reorder_threshold, current_stock, selling_price } = req.body;

        // Fetch old stock to see if it was manually adjusted
        const [oldProd] = await pool.query<RowDataPacket[]>('SELECT current_stock FROM Products WHERE product_id = ?', [id]);
        const oldStock = oldProd[0]?.current_stock || 0;
        const newStock = Number(current_stock || 0);

        await pool.query(
            'UPDATE Products SET name = ?, measure_unit = ?, category = ?, reorder_threshold = ?, current_stock = ?, selling_price = ? WHERE product_id = ?',
            [name, measure_unit, category, reorder_threshold, newStock, selling_price || 0.00, id]
        );

        // If a user manually edited stock via this generic endpoint, sync an adjustment batch so POS FEFO can deduct it
        if (newStock > oldStock) {
            const difference = newStock - oldStock;
            await pool.query(
                `INSERT INTO Inventory_Batches 
                (product_id, batch_number, expiry_date, purchased_quantity, current_stock_level, unit_cost) 
                VALUES (?, ?, DATE_ADD(CURDATE(), INTERVAL 1 YEAR), ?, ?, ?)`,
                [id, 'MANUAL-ADJ', difference, difference, 0] // Cost is 0 for manual adjustment injected batches
            );
        }

        res.status(200).json({ message: 'Product updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const deleteProduct = async (req: Request, res: Response) => {
    try {
        const id = req.params.id;
        await pool.query('DELETE FROM Products WHERE product_id = ?', [id]);
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error: any) {
        console.error(error);
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ error: 'Cannot delete product currently linked to batches' });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
};
