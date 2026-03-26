/**
 * Unit Tests â€” IT24100126
 * Module: Inventory Management â€” GRN, Batches (CRUD)
 *
 * Tests: receiveStock, getAlerts, getGrnHistory,
 *        getAllBatches, createBatch, updateBatch, deleteBatch
 */

import * as httpMocks from 'node-mocks-http';

// â”€â”€â”€ pool resolved via moduleNameMapper â†’ __mocks__/customerDb.ts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { pool, mockQuery, mockConnection, mockBeginTransaction, mockCommit, mockRollback, logQueriesForTest } from './__mocks__/customerDb';

import {
    receiveStock,
    getAlerts,
    getGrnHistory,
    getAllBatches,
    createBatch,
    updateBatch,
    deleteBatch,
} from '../controllers/inventory.controller';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function req(body: any = {}, params: any = {}, query: any = {}, empId?: number) {
    const r = httpMocks.createRequest({ method: 'POST', body, params, query });
    if (empId) (r as any).user = { emp_id: empId };
    return r;
}
function res() { return httpMocks.createResponse(); }

beforeEach(() => {
    mockQuery.mockReset();
    mockConnection.query.mockReset();
    mockBeginTransaction.mockReset();
    mockCommit.mockReset();
    mockRollback.mockReset();
    
    mockQuery.mockResolvedValue([[]]);
    mockConnection.query.mockResolvedValue([[]]);
    mockBeginTransaction.mockResolvedValue(undefined);
    mockCommit.mockResolvedValue(undefined);
    mockRollback.mockResolvedValue(undefined);
});

afterEach(() => {
    logQueriesForTest(expect.getState().currentTestName || 'Unknown Test');
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// receiveStock (GRN)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Inventory Controller - receiveStock (GRN)', () => {
    it('returns 400 when required GRN fields are missing', async () => {
        const response = res();
        await receiveStock(req({}) as any, response as any);
        expect(response.statusCode).toBe(400);
        expect(response._getJSONData().error).toMatch(/missing/i);
    });

    it('returns 401 when employee not authenticated', async () => {
        const body = {
            supplier_id: 1,
            supplier_invoice_number: 'INV-001',
            payment_method: 'Cash',
            batches: [{ product_id: 1, batch_number: 'B1', expiry_date: '2027-01-01', purchased_quantity: 10, unit_cost: 5 }],
        };
        const response = res();
        // no empId â†’ no user
        await receiveStock(req(body) as any, response as any);
        expect(response.statusCode).toBe(401);
    });

    it('creates invoice, inserts batches, updates product stock, and commits', async () => {
        const body = {
            supplier_id: 1,
            supplier_invoice_number: 'INV-002',
            payment_method: 'Cash',
            batches: [
                { product_id: 1, batch_number: 'B2', expiry_date: '2027-06-01', purchased_quantity: 20, bonus_quantity: 2, unit_cost: 10 },
            ],
        };

        mockConnection.query
            .mockResolvedValueOnce([{ insertId: 77 }]) // INSERT Supplier_Invoice
            .mockResolvedValueOnce([{}])               // INSERT Inventory_Batches
            .mockResolvedValueOnce([{}])               // UPDATE Products stock
            .mockResolvedValueOnce([{}]);              // INSERT Audit_Log

        const r = httpMocks.createRequest({ body, method: 'POST' });
        (r as any).user = { emp_id: 5 };
        const response = res();
        await receiveStock(r as any, response as any);

        expect(response.statusCode).toBe(201);
        expect(response._getJSONData().invoice_id).toBe(77);
        // total_amount = 20 * 10 = 200
        expect(response._getJSONData().total_amount).toBe(200);
        expect(mockCommit).toHaveBeenCalled();
    });

    it('only saves check_number and check_date when payment_method is Check', async () => {
        // Verifies null handling for non-check payments
        const body = {
            supplier_id: 2,
            supplier_invoice_number: 'INV-003',
            payment_method: 'Cash',
            check_number: '12345',
            check_date: '2026-06-01',
            batches: [{ product_id: 2, batch_number: 'B3', expiry_date: '2027-01-01', purchased_quantity: 5, unit_cost: 8 }],
        };

        mockConnection.query
            .mockResolvedValueOnce([{ insertId: 78 }])
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([{}]);

        const r = httpMocks.createRequest({ body, method: 'POST' });
        (r as any).user = { emp_id: 5 };
        const response = res();
        await receiveStock(r as any, response as any);

        // The first call to connection.query is the INSERT â€” check that check fields are null
        const insertCallArgs = mockConnection.query.mock.calls[0];
        expect(insertCallArgs[1][4]).toBeNull(); // check_number slot should be null
        expect(insertCallArgs[1][5]).toBeNull(); // check_date slot should be null
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// getAlerts
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Inventory Controller â€” getAlerts', () => {
    it('returns lowStock and nearExpiry arrays', async () => {
        mockQuery
            .mockResolvedValueOnce([[{ product_id: 1, name: 'Aspirin', current_stock_level: 3 }]])
            .mockResolvedValueOnce([[{ batch_id: 5, expiry_date: '2026-04-01' }]]);

        const response = res();
        await getAlerts(req() as any, response as any);
        expect(response.statusCode).toBe(200);
        const data = response._getJSONData();
        expect(data.lowStock).toHaveLength(1);
        expect(data.nearExpiry).toHaveLength(1);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// getGrnHistory
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Inventory Controller â€” getGrnHistory', () => {
    it('returns GRN history list', async () => {
        mockQuery.mockResolvedValueOnce([[{ invoice_id: 1 }, { invoice_id: 2 }]]);
        const response = res();
        await getGrnHistory(req() as any, response as any);
        expect(response.statusCode).toBe(200);
        expect(response._getJSONData()).toHaveLength(2);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// getAllBatches
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Inventory Controller â€” getAllBatches', () => {
    it('returns batch list with product names', async () => {
        mockQuery.mockResolvedValueOnce([[{ batch_id: 1, product_name: 'Aspirin' }]]);
        const response = res();
        await getAllBatches(req() as any, response as any);
        expect(response.statusCode).toBe(200);
        expect(response._getJSONData()[0].product_name).toBe('Aspirin');
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// createBatch
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Inventory Controller â€” createBatch', () => {
    it('returns 400 when required fields are missing', async () => {
        const response = res();
        await createBatch(req({}) as any, response as any);
        expect(response.statusCode).toBe(400);
    });

    it('creates batch and updates product stock', async () => {
        mockConnection.query
            .mockResolvedValueOnce([{ insertId: 20 }]) // INSERT Inventory_Batches
            .mockResolvedValueOnce([{}])               // UPDATE Products
            .mockResolvedValueOnce([{}]);              // INSERT Audit_Log

        const body = { product_id: 1, batch_number: 'B10', expiry_date: '2027-01-01', purchased_quantity: 50, bonus_quantity: 5, unit_cost: 3 };
        const response = res();
        await createBatch(req(body, {}, {}, 1) as any, response as any);

        expect(response.statusCode).toBe(201);
        expect(response._getJSONData().batch_id).toBe(20);
        expect(mockCommit).toHaveBeenCalled();
    });

    it('defaults bonus_quantity to 0 when not provided', async () => {
        mockConnection.query
            .mockResolvedValueOnce([{ insertId: 21 }])
            .mockResolvedValueOnce([{}]);

        const body = { product_id: 2, batch_number: 'B11', expiry_date: '2027-01-01', purchased_quantity: 30, unit_cost: 5 };
        const response = res();
        await createBatch(req(body, {}, {}, 1) as any, response as any);

        // INSERT args: [product_id, batch_number, expiry_date, location, purchased_qty, bonus_qty, unit_cost, current_stock_level]
        // Indices:       0           1              2            3         4              5          6           7
        const insertArgs = mockConnection.query.mock.calls[0][1];
        expect(insertArgs[5]).toBe(0);   // bonus_quantity
        expect(insertArgs[7]).toBe(30);  // current_stock_level = purchased_qty + bonus
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// updateBatch
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Inventory Controller â€” updateBatch', () => {
    it('returns 400 when required fields missing', async () => {
        const response = res();
        await updateBatch(req({}, { id: '1' }) as any, response as any);
        expect(response.statusCode).toBe(400);
    });

    it('returns 404 when batch not found', async () => {
        mockConnection.query.mockResolvedValueOnce([[]]); // no existing rows
        const body = { batch_number: 'B1', expiry_date: '2027-01-01', current_stock_level: 10, unit_cost: 5 };
        const response = res();
        await updateBatch(req(body, { id: '999' }) as any, response as any);
        expect(response.statusCode).toBe(404);
    });

    it('updates batch and adjusts product stock by diff', async () => {
        mockConnection.query
            .mockResolvedValueOnce([[{ product_id: 1, current_stock_level: 10 }]]) // old batch
            .mockResolvedValueOnce([{}])  // UPDATE batch
            .mockResolvedValueOnce([{}])  // UPDATE product stock diff
            .mockResolvedValueOnce([{}]); // audit log

        const body = { batch_number: 'B1', expiry_date: '2027-01-01', current_stock_level: 15, unit_cost: 5 };
        const response = res();
        await updateBatch(req(body, { id: '1' }, {}, 1) as any, response as any);
        expect(response.statusCode).toBe(200);
        expect(mockCommit).toHaveBeenCalled();
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// deleteBatch
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Inventory Controller â€” deleteBatch', () => {
    it('returns 404 when batch not found', async () => {
        mockConnection.query.mockResolvedValueOnce([[]]); // no rows
        const response = res();
        await deleteBatch(req({}, { id: '999' }) as any, response as any);
        expect(response.statusCode).toBe(404);
    });

    it('returns 400 when batch is referenced by a sale item (FK violation)', async () => {
        mockConnection.query
            .mockResolvedValueOnce([[{ product_id: 1, current_stock_level: 10 }]])  // old batch found
            .mockRejectedValueOnce(Object.assign(new Error('FK'), { code: 'ER_ROW_IS_REFERENCED_2' })); // DELETE fails

        const response = res();
        await deleteBatch(req({}, { id: '10' }) as any, response as any);
        expect(response.statusCode).toBe(400);
        expect(response._getJSONData().error).toMatch(/sale items/i);
    });

    it('deletes batch and reduces product stock on happy path', async () => {
        mockConnection.query
            .mockResolvedValueOnce([[{ product_id: 1, current_stock_level: 10 }]]) // old batch
            .mockResolvedValueOnce([{}])  // DELETE batch
            .mockResolvedValueOnce([{}])  // UPDATE product stock
            .mockResolvedValueOnce([{}]); // audit log

        const response = res();
        await deleteBatch(req({}, { id: '11' }, {}, 1) as any, response as any);
        expect(response.statusCode).toBe(200);
        expect(mockCommit).toHaveBeenCalled();
    });
});

