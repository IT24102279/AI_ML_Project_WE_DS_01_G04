import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { register, login } from './controllers/auth.controller';
import { getAllRoles, getAllPermissions, updateRolePermissions } from './controllers/rbac.controller';
import { authenticateToken, hasPermission } from './middleware/auth';

const app = express();
export const server = createServer(app);
export const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

io.on('connection', (socket) => {
    console.log('A client connected:', socket.id);
    socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

import { getAllProducts, searchProducts, createProduct, updateProduct, deleteProduct } from './controllers/products.controller';
import { getAllSuppliers, createSupplier, updateSupplier, deleteSupplier } from './controllers/suppliers.controller';
import { receiveStock, getAlerts, getGrnHistory } from './controllers/inventory.controller';
import { getPendingChecks, clearCheck } from './controllers/finance.controller';

// --- Auth Routes ---
app.post('/api/auth/register', register);
app.post('/api/auth/login', login);

// --- RBAC Routes ---
app.get('/api/roles', authenticateToken, hasPermission('MANAGE_ROLES'), getAllRoles);
app.get('/api/permissions', authenticateToken, hasPermission('MANAGE_ROLES'), getAllPermissions);
app.put('/api/roles/:id/permissions', authenticateToken, hasPermission('MANAGE_ROLES'), updateRolePermissions);

// --- Products Routes ---
app.get('/api/products/search', authenticateToken, hasPermission('VIEW_TAB_GRN'), searchProducts);
app.get('/api/products', authenticateToken, hasPermission('VIEW_TAB_INVENTORY'), getAllProducts);
app.post('/api/products', authenticateToken, hasPermission('VIEW_TAB_INVENTORY'), createProduct);
app.put('/api/products/:id', authenticateToken, hasPermission('VIEW_TAB_INVENTORY'), updateProduct);
app.delete('/api/products/:id', authenticateToken, hasPermission('VIEW_TAB_INVENTORY'), deleteProduct);

// --- Suppliers Routes ---
app.get('/api/suppliers', authenticateToken, hasPermission('VIEW_TAB_SUPPLIERS'), getAllSuppliers);
app.post('/api/suppliers', authenticateToken, hasPermission('VIEW_TAB_SUPPLIERS'), createSupplier);
app.put('/api/suppliers/:id', authenticateToken, hasPermission('VIEW_TAB_SUPPLIERS'), updateSupplier);
app.delete('/api/suppliers/:id', authenticateToken, hasPermission('VIEW_TAB_SUPPLIERS'), deleteSupplier);

// --- Inventory & GRN Routes ---
app.post('/api/inventory/receive', authenticateToken, hasPermission('VIEW_TAB_GRN'), receiveStock);
app.get('/api/inventory/alerts', authenticateToken, hasPermission('VIEW_TAB_INVENTORY'), getAlerts);
app.get('/api/inventory/grn-history', authenticateToken, hasPermission('VIEW_TAB_GRN'), getGrnHistory);

// --- Batches Routes ---
import { getAllBatches, createBatch, updateBatch, deleteBatch } from './controllers/inventory.controller';
app.get('/api/inventory/batches', authenticateToken, hasPermission('VIEW_TAB_INVENTORY'), getAllBatches);
app.post('/api/inventory/batches', authenticateToken, hasPermission('VIEW_TAB_INVENTORY'), createBatch);
app.put('/api/inventory/batches/:id', authenticateToken, hasPermission('VIEW_TAB_INVENTORY'), updateBatch);
app.delete('/api/inventory/batches/:id', authenticateToken, hasPermission('VIEW_TAB_INVENTORY'), deleteBatch);

// --- Finance Routes ---
app.get('/api/finance/pending-checks', authenticateToken, hasPermission('VIEW_TAB_FINANCE'), getPendingChecks);
app.patch('/api/finance/checks/:id/clear', authenticateToken, hasPermission('VIEW_TAB_FINANCE'), clearCheck);

// --- Settings Routes ---
import { getSettings, updateSetting } from './controllers/settings.controller';
app.get('/api/settings', authenticateToken, getSettings);
app.put('/api/settings/:key', authenticateToken, hasPermission('MANAGE_ROLES'), updateSetting);

// --- Patient Routes ---
import { createPatient, getPatient, searchPatients, getPatientDiscount, optOutPatient, updatePatient } from './controllers/patients.controller';
import { auditLogMiddleware } from './utils/auditLogger';

app.post('/api/patients', authenticateToken, auditLogMiddleware('CREATE_PATIENT'), createPatient);
app.get('/api/patients/search', authenticateToken, searchPatients);
app.get('/api/patients/:id/discount', authenticateToken, getPatientDiscount);
app.get('/api/patients/:id', authenticateToken, getPatient);
app.put('/api/patients/:id', authenticateToken, hasPermission('MANAGE_PATIENTS'), auditLogMiddleware('UPDATE_PATIENT'), updatePatient);
app.delete('/api/patients/:id/opt-out', authenticateToken, hasPermission('MANAGE_PATIENTS'), auditLogMiddleware('DELETE_PATIENT_DATA'), optOutPatient);

// --- POS Routes ---
import { processPrescription, saveDraftSale, confirmCheckout, searchPosProducts, getInvoiceReceipt, getSalesHistory, deleteInvoice } from './controllers/pos.controller';
app.post('/api/pos/process-prescription', processPrescription); // Microservice auth
app.post('/api/pos/draft', authenticateToken, hasPermission('VIEW_TAB_POS'), saveDraftSale);
app.post('/api/pos/checkout', authenticateToken, hasPermission('VIEW_TAB_POS'), confirmCheckout);
app.get('/api/pos/search', authenticateToken, hasPermission('VIEW_TAB_POS'), searchPosProducts);
app.get('/api/pos/invoice/:id', authenticateToken, hasPermission('VIEW_TAB_POS'), getInvoiceReceipt);
app.get('/api/pos/history', authenticateToken, hasPermission('VIEW_TAB_POS'), getSalesHistory);
app.delete('/api/pos/invoice/:id', authenticateToken, hasPermission('EDIT_PAST_SALES'), deleteInvoice);

// --- Analytics & Audit Routes ---
import {
    getAuditLogs, deleteAuditLog, exportAuditLogs,
    getFinancialAnalytics,
    getExpenses, addExpense, updateExpense, deleteExpense,
    getPayrollEntries, addPayrollEntry, updatePayrollEntry, deletePayrollEntry,
    getEmployees, updateEmployeeSalary
} from './controllers/analyticsController';

app.get('/api/admin/audit-logs', authenticateToken, hasPermission('VIEW_DASHBOARD'), getAuditLogs);
app.delete('/api/admin/audit-logs/:id', authenticateToken, hasPermission('MANAGE_AUDIT'), deleteAuditLog);
app.get('/api/admin/audit-logs/export', authenticateToken, hasPermission('VIEW_DASHBOARD'), exportAuditLogs);

app.get('/api/admin/financial-analytics', authenticateToken, hasPermission('VIEW_TAB_FINANCE'), getFinancialAnalytics);

app.get('/api/admin/financial-analytics/expenses', authenticateToken, hasPermission('MANAGE_FINANCE'), getExpenses);
app.post('/api/admin/financial-analytics/expenses', authenticateToken, hasPermission('MANAGE_FINANCE'), auditLogMiddleware('CREATE_EXPENSE'), addExpense);
app.put('/api/admin/financial-analytics/expenses/:id', authenticateToken, hasPermission('MANAGE_FINANCE'), auditLogMiddleware('UPDATE_EXPENSE'), updateExpense);
app.delete('/api/admin/financial-analytics/expenses/:id', authenticateToken, hasPermission('MANAGE_FINANCE'), auditLogMiddleware('DELETE_EXPENSE'), deleteExpense);

app.get('/api/admin/financial-analytics/payroll', authenticateToken, hasPermission('MANAGE_PAYROLL'), getPayrollEntries);
app.post('/api/admin/financial-analytics/payroll', authenticateToken, hasPermission('MANAGE_PAYROLL'), auditLogMiddleware('CREATE_PAYROLL'), addPayrollEntry);
app.put('/api/admin/financial-analytics/payroll/:id', authenticateToken, hasPermission('MANAGE_PAYROLL'), auditLogMiddleware('UPDATE_PAYROLL'), updatePayrollEntry);
app.delete('/api/admin/financial-analytics/payroll/:id', authenticateToken, hasPermission('MANAGE_PAYROLL'), auditLogMiddleware('DELETE_PAYROLL'), deletePayrollEntry);

app.get('/api/admin/employees', authenticateToken, hasPermission('MANAGE_PAYROLL'), getEmployees);
app.put('/api/admin/employees/:id/salary', authenticateToken, hasPermission('MANAGE_PAYROLL'), auditLogMiddleware('UPDATE_EMPLOYEE_SALARY'), updateEmployeeSalary);

// Basic health check
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`Server and Socket.io running on port ${PORT}`);
});
