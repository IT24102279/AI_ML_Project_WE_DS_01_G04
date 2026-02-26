import { Request, Response } from 'express';
import pool from '../db';
import { RowDataPacket } from 'mysql2';


export const getAllRoles = async (req: Request, res: Response) => {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT r.role_id, r.role_name, r.description, p.perm_id, p.action_name 
             FROM Role r 
             LEFT JOIN Role_Permission rp ON r.role_id = rp.role_id 
             LEFT JOIN Permission p ON rp.perm_id = p.perm_id`
        );

        const rolesMap = new Map<number, any>();
        rows.forEach(row => {
            if (!rolesMap.has(row.role_id)) {
                rolesMap.set(row.role_id, {
                    role_id: row.role_id,
                    role_name: row.role_name,
                    description: row.description,
                    permissions: []
                });
            }
            if (row.perm_id) {
                rolesMap.get(row.role_id).permissions.push({
                    perm_id: row.perm_id,
                    action_name: row.action_name
                });
            }
        });

        const roles = Array.from(rolesMap.values());
        res.status(200).json({ roles });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export const getAllPermissions = async (req: Request, res: Response) => {
    try {
        const [permissions] = await pool.query<RowDataPacket[]>('SELECT * FROM Permission');
        res.status(200).json({ permissions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export const updateRolePermissions = async (req: Request, res: Response) => {
    try {
        const roleId = parseInt(req.params.id as string);
        const { permission_ids } = req.body;

        if (isNaN(roleId) || !Array.isArray(permission_ids)) {
            return res.status(400).json({ error: 'Invalid payload.' });
        }

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Delete existing
            await connection.query('DELETE FROM Role_Permission WHERE role_id = ?', [roleId]);

            // 2. Insert new
            if (permission_ids.length > 0) {
                const placeholders = permission_ids.map(() => '(?, ?)').join(', ');
                const values = permission_ids.flatMap((perm_id: number) => [roleId, perm_id]);
                await connection.query(`INSERT INTO Role_Permission (role_id, perm_id) VALUES ${placeholders}`, values);
            }

            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        res.status(200).json({
            message: 'Role permissions updated successfully.',
            role_id: roleId,
            updated_permissions: permission_ids,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};
