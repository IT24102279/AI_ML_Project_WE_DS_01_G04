import { Request, Response, NextFunction } from 'express';
import pool from '../db';
import { RowDataPacket } from 'mysql2/promise';

/**
 * Utility function to fire-and-forget an audit log entry.
 */
export const logAuditAction = async (empId: number, actionType: string, details: string) => {
    try {
        await pool.query(
            `INSERT INTO Audit_Logs (emp_id, action_type, details) VALUES (?, ?, ?)`,
            [empId, actionType, details]
        );
    } catch (error) {
        console.error(`Failed to log audit action [${actionType}] for emp_id [${empId}]:`, error);
    }
};

/**
 * Express middleware to automatically log actions for sensitive routes.
 * Requires `req.user.emp_id` to be populated by the authentication middleware.
 */
export const auditLogMiddleware = (actionType: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Original end/json functions
        const originalJson = res.json;

        // Override json to capture the response and log it after sending
        res.json = function (body) {
            // Call original json
            originalJson.call(this, body);

            // Extract employee ID (assuming auth middleware sets this)
            const empId = (req as any).user?.emp_id;

            if (empId) {
                // Construct a detail string from request payload and response status
                let details = `Method: ${req.method}, Route: ${req.originalUrl}, Status: ${res.statusCode}`;

                // For POST/PUT/PATCH, capture a summary of the payload (excluding passwords)
                if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body) {
                    const safeBody = { ...req.body };
                    if (safeBody.password) safeBody.password = '[REDACTED]';
                    if (safeBody.password_hash) safeBody.password_hash = '[REDACTED]';

                    const bodyStr = JSON.stringify(safeBody);
                    // Truncate if too long to avoid DB overflow
                    details += ` | Payload: ${bodyStr.substring(0, 500)}${bodyStr.length > 500 ? '...' : ''}`;
                }

                // Fire and forget
                logAuditAction(empId, actionType, details);
            }

            return this;
        };

        next();
    };
};
