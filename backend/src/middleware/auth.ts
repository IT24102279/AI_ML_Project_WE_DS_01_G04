import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretfallback';

export interface AuthRequest extends Request {
    user?: {
        emp_id: number;
        role_id: number;
        role_name: string;
        permissions: string[];
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Token missing.' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ error: 'Forbidden: Invalid token.' });
        }
        req.user = decoded as any;
        next();
    });
};

export const hasPermission = (requiredPermission: string) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized: No user found in request.' });
        }

        if (!req.user.permissions.includes(requiredPermission)) {
            return res.status(403).json({ error: `Forbidden: Requires ${requiredPermission} permission.` });
        }

        next();
    };
};
