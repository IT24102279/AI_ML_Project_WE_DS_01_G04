import express from 'express';
import cors from 'cors';
import { register, login } from './controllers/auth.controller';
import { getAllRoles, getAllPermissions, updateRolePermissions } from './controllers/rbac.controller';
import { authenticateToken, hasPermission } from './middleware/auth';

const app = express();
app.use(cors());
app.use(express.json());

// --- Auth Routes ---
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

// --- RBAC Routes ---
// Only users with 'MANAGE_ROLES' permission can access these
app.get('/api/roles', authenticateToken, hasPermission('MANAGE_ROLES'), getAllRoles);
app.get('/api/permissions', authenticateToken, hasPermission('MANAGE_ROLES'), getAllPermissions);
app.put('/api/roles/:id/permissions', authenticateToken, hasPermission('MANAGE_ROLES'), updateRolePermissions);

// Basic health check
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
