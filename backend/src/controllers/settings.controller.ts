import { Request, Response } from 'express';
import pool from '../db';
import { RowDataPacket } from 'mysql2';

export const getSettings = async (req: Request, res: Response) => {
    try {
        const [rows] = await pool.query<RowDataPacket[]>('SELECT setting_key, setting_value FROM App_Settings');
        const settings = rows.reduce((acc, row) => {
            acc[row.setting_key] = row.setting_value;
            return acc;
        }, {} as Record<string, string>);

        res.status(200).json(settings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

export const updateSetting = async (req: Request, res: Response) => {
    try {
        const key = req.params.key;
        const { value } = req.body;

        if (value === undefined) {
            return res.status(400).json({ error: 'Value is required' });
        }

        await pool.query(
            'INSERT INTO App_Settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
            [key, value, value]
        );
        res.status(200).json({ message: 'Setting updated successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
