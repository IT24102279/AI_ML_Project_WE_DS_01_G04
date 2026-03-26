/**
 * Unit Tests â€” IT24102279
 * Module: Auth, RBAC, Analytics & Salary Management
 *
 * Tests: register, login, getAllRoles, updateRolePermissions,
 *        getAuditLogs, deleteAuditLog, getFinancialAnalytics, updateEmployeeSalary
 */

import * as httpMocks from 'node-mocks-http';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// â”€â”€â”€ pool resolved via moduleNameMapper â†’ __mocks__/customerDb.ts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { pool, mockQuery, mockExecute, mockConnection, mockBeginTransaction, mockCommit, mockRollback, logQueriesForTest } from './__mocks__/customerDb';

import { register, login } from '../controllers/auth.controller';
import { getAllRoles, getAllPermissions, updateRolePermissions } from '../controllers/rbac.controller';
import {
    getAuditLogs,
    deleteAuditLog,
    getFinancialAnalytics,
    getEmployees,
    updateEmployeeSalary,
} from '../controllers/analyticsController';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function req(body = {}, params = {}, query = {}, user?: any) {
    return {
        body,
        params,
        query,
        user,
    };
}

const res = () => httpMocks.createResponse();

// â”€â”€â”€ Tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

beforeEach(() => {
    mockQuery.mockReset();
    mockExecute.mockReset();
    mockConnection.query.mockReset();
    mockConnection.execute.mockReset();
    mockBeginTransaction.mockReset();
    mockCommit.mockReset();
    mockRollback.mockReset();
    
    // Defaults
    mockQuery.mockResolvedValue([[]]);
    mockExecute.mockResolvedValue([[]]);
    mockConnection.query.mockResolvedValue([[]]);
    mockConnection.execute.mockResolvedValue([[]]);
    mockBeginTransaction.mockResolvedValue(undefined);
    mockCommit.mockResolvedValue(undefined);
    mockRollback.mockResolvedValue(undefined);
});

afterEach(() => {
    logQueriesForTest(expect.getState().currentTestName || 'Unknown Test');
});

describe('Auth Controller - register', () => {
    it('registers a new employee and returns 201', async () => {
        mockQuery
            .mockResolvedValueOnce([[]])            // SELECT (no existing user)
            .mockResolvedValueOnce([{ insertId: 42 }]); // INSERT

        const request = req({ name: 'Alice', email: 'alice@test.com', password: 'pass123', role_id: 2 });
        const response = res();
        await register(request as any, response as any);

        expect(response.statusCode).toBe(201);
        const data = response._getJSONData();
        expect(data.employee.emp_id).toBe(42);
        expect(data.employee.email).toBe('alice@test.com');
    });

    it('returns 400 when email already exists', async () => {
        mockQuery.mockResolvedValueOnce([[{ emp_id: 1 }]]); // existing user found

        const request = req({ name: 'Duplicate', email: 'dup@test.com', password: 'x' });
        const response = res();
        await register(request as any, response as any);

        expect(response.statusCode).toBe(400);
        expect(response._getJSONData().error).toMatch(/already exists/i);
    });

    it('defaults role_id to 3 when not supplied', async () => {
        mockQuery
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 99 }]);

        const request = req({ name: 'Bob', email: 'bob@test.com', password: 'secret' });
        const response = res();
        await register(request as any, response as any);

        expect(response.statusCode).toBe(201);
        expect(response._getJSONData().employee.role_id).toBe(3);
    });

    it('returns 500 on db error', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB error'));
        const request = req({ name: 'X', email: 'x@x.com', password: 'p' });
        const response = res();
        await register(request as any, response as any);
        expect(response.statusCode).toBe(500);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AUTH â€” login
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Auth Controller â€” login', () => {
    it('returns 401 when no employee found', async () => {
        mockQuery.mockResolvedValueOnce([[]]); // empty result
        const request = req({ email: 'no@no.com', password: 'pw' });
        const response = res();
        await login(request as any, response as any);
        expect(response.statusCode).toBe(401);
    });

    it('returns 401 when password is wrong', async () => {
        const hash = await bcrypt.hash('correctpassword', 10);
        mockQuery.mockResolvedValueOnce([[{ emp_id: 1, role_id: 2, role_name: 'Admin', password_hash: hash }]]);
        const request = req({ email: 'admin@test.com', password: 'wrongpassword' });
        const response = res();
        await login(request as any, response as any);
        expect(response.statusCode).toBe(401);
    });

    it('returns 200 with JWT token on valid credentials', async () => {
        const hash = await bcrypt.hash('correct', 10);
        mockQuery
            .mockResolvedValueOnce([[{ emp_id: 1, role_id: 1, role_name: 'Manager', name: 'Alice', password_hash: hash }]])
            .mockResolvedValueOnce([[{ action_name: 'VIEW_POS' }]]);

        const request = req({ email: 'alice@test.com', password: 'correct' });
        const response = res();
        await login(request as any, response as any);

        expect(response.statusCode).toBe(200);
        const data = response._getJSONData();
        expect(data.token).toBeDefined();
        expect(data.user.role).toBe('Manager');
        // Token should decode without error
        const decoded: any = jwt.decode(data.token);
        expect(decoded.emp_id).toBe(1);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// RBAC
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('RBAC Controller', () => {
    it('getAllRoles â€” groups permissions by role', async () => {
        mockQuery.mockResolvedValueOnce([[
            { role_id: 1, role_name: 'Admin', description: 'Full', perm_id: 10, action_name: 'VIEW_POS' },
            { role_id: 1, role_name: 'Admin', description: 'Full', perm_id: 11, action_name: 'MANAGE_USERS' },
            { role_id: 2, role_name: 'Cashier', description: 'Cashier', perm_id: 10, action_name: 'VIEW_POS' },
        ]]);
        const response = res();
        await getAllRoles(req() as any, response as any);
        expect(response.statusCode).toBe(200);
        const { roles } = response._getJSONData();
        expect(roles).toHaveLength(2);
        expect(roles[0].permissions).toHaveLength(2);
    });

    it('getAllPermissions â€” returns flat list', async () => {
        mockQuery.mockResolvedValueOnce([[{ perm_id: 1, action_name: 'VIEW_POS' }]]);
        const response = res();
        await getAllPermissions(req() as any, response as any);
        expect(response.statusCode).toBe(200);
        expect(response._getJSONData().permissions).toHaveLength(1);
    });

    it('updateRolePermissions â€” returns 400 on invalid payload', async () => {
        const request = req({ permission_ids: 'not-an-array' }, { id: '1' });
        const response = res();
        await updateRolePermissions(request as any, response as any);
        expect(response.statusCode).toBe(400);
    });

    it('updateRolePermissions â€” happy path commits transaction', async () => {
        mockConnection.query.mockResolvedValue([{}]);
        const request = req({ permission_ids: [1, 2] }, { id: '1' });
        const response = res();
        await updateRolePermissions(request as any, response as any);
        expect(response.statusCode).toBe(200);
        expect(mockCommit).toHaveBeenCalled();
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Analytics & Audit
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Analytics Controller â€” Audit Logs', () => {
    it('getAuditLogs â€” returns paginated result', async () => {
        mockQuery
            .mockResolvedValueOnce([[{ total: 2 }]])
            .mockResolvedValueOnce([[{ log_id: 1, action_type: 'LOGIN' }, { log_id: 2, action_type: 'LOGOUT' }]]);

        const request = req({}, {}, { page: '1', limit: '50' });
        const response = res();
        await getAuditLogs(request as any, response as any);
        expect(response.statusCode).toBe(200);
        const data = response._getJSONData();
        expect(data.total).toBe(2);
        expect(data.data).toHaveLength(2);
    });

    it('deleteAuditLog â€” responds with success message', async () => {
        mockQuery.mockResolvedValueOnce([{}]);
        const request = req({}, { id: '5' });
        const response = res();
        await deleteAuditLog(request as any, response as any);
        expect(response.statusCode).toBe(200);
        expect(response._getJSONData().status).toBe('Success');
    });
});

describe('Analytics Controller â€” Financial', () => {
    it('getFinancialAnalytics â€” returns summary with net_profit', async () => {
        mockQuery
            .mockResolvedValueOnce([[{ gross_revenue: '1000' }]])
            .mockResolvedValueOnce([[{ cogs: '400' }]])
            .mockResolvedValueOnce([[{ operating_expenses: '100' }]])
            .mockResolvedValueOnce([[{ payroll: '200' }]])
            .mockResolvedValueOnce([[]]); // time series

        const response = res();
        await getFinancialAnalytics(req() as any, response as any);
        expect(response.statusCode).toBe(200);
        const { summary } = response._getJSONData();
        expect(summary.net_profit).toBe(300); // 1000 - 400 - 100 - 200
    });

    it('getEmployees â€” returns employee list', async () => {
        mockQuery.mockResolvedValueOnce([[{ emp_id: 1, name: 'Alice' }]]);
        const response = res();
        await getEmployees(req() as any, response as any);
        expect(response._getJSONData()).toHaveLength(1);
    });

    it('updateEmployeeSalary â€” calls UPDATE and returns Updated status', async () => {
        mockQuery.mockResolvedValueOnce([{}]);
        const request = req({ base_salary: 50000, hourly_rate: 25, standard_deductions: 500 }, { id: '1' });
        const response = res();
        await updateEmployeeSalary(request as any, response as any);
        expect(response._getJSONData().status).toBe('Updated');
    });
});

