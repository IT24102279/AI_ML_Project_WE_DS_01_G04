import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllRoles = async (req: Request, res: Response) => {
    try {
        const rolesData = await prisma.role.findMany({
            include: {
                role_permissions: {
                    include: {
                        permission: true,
                    },
                },
            },
        });

        const roles = rolesData.map((role) => ({
            role_id: role.role_id,
            role_name: role.role_name,
            description: role.description,
            permissions: role.role_permissions.map((rp) => ({
                perm_id: rp.permission.perm_id,
                action_name: rp.permission.action_name,
            })),
        }));

        res.status(200).json({ roles });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export const getAllPermissions = async (req: Request, res: Response) => {
    try {
        const permissions = await prisma.permission.findMany();
        res.status(200).json({ permissions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};

export const updateRolePermissions = async (req: Request, res: Response) => {
    try {
        const roleId = parseInt(req.params.id);
        const { permission_ids } = req.body;

        if (isNaN(roleId) || !Array.isArray(permission_ids)) {
            return res.status(400).json({ error: 'Invalid payload.' });
        }

        // Wrap in a transaction: Delete old mappings, create new ones
        await prisma.$transaction(async (tx) => {
            // 1. Delete all existing permissions for this role
            await tx.role_Permission.deleteMany({
                where: { role_id: roleId },
            });

            // 2. Insert new permissions
            if (permission_ids.length > 0) {
                const newMappings = permission_ids.map((perm_id: number) => ({
                    role_id: roleId,
                    perm_id: perm_id,
                }));
                await tx.role_Permission.createMany({
                    data: newMappings,
                });
            }
        });

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
