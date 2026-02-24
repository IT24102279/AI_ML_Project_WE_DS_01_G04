import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfallback';

export const register = async (req: Request, res: Response) => {
    try {
        const { name, email, password, role_id } = req.body;

        const existingUser = await prisma.employee.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists.' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        const employee = await prisma.employee.create({
            data: {
                name,
                email,
                password_hash,
                role_id: role_id || 3, // Default to Assistant Pharmacist if not provided
            },
        });

        res.status(201).json({
            message: 'Employee registered successfully.',
            employee: {
                emp_id: employee.emp_id,
                name: employee.name,
                email: employee.email,
                role_id: employee.role_id,
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

        const employee = await prisma.employee.findUnique({
            where: { email },
            include: {
                role: {
                    include: {
                        role_permissions: {
                            include: {
                                permission: true,
                            },
                        },
                    },
                },
            },
        });

        if (!employee) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const validPassword = await bcrypt.compare(password, employee.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const permissions = employee.role.role_permissions.map((rp) => rp.permission.action_name);

        const tokenPayload = {
            emp_id: employee.emp_id,
            role_id: employee.role_id,
            role_name: employee.role.role_name,
            permissions,
        };

        const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

        res.status(200).json({
            message: 'Login successful.',
            token,
            user: {
                emp_id: employee.emp_id,
                name: employee.name,
                role: employee.role.role_name,
                permissions,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error.' });
    }
};
