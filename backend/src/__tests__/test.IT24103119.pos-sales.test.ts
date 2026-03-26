/**
 * Unit Tests â€” IT24103119
 * Module: POS â€” Sales, Checkout, Draft, Sales History
 *
 * Tests: saveDraftSale, confirmCheckout, searchPosProducts,
 *        getInvoiceReceipt, getSalesHistory, deleteInvoice
 */

import * as httpMocks from 'node-mocks-http';

// â”€â”€â”€ pool resolved via moduleNameMapper â†’ __mocks__/customerDb.ts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { pool, mockQuery, mockConnection, mockBeginTransaction, mockCommit, mockRollback, logQueriesForTest } from './__mocks__/customerDb';

jest.mock('../server', () => ({ io: { emit: jest.fn() } }));

import {
    saveDraftSale,
    confirmCheckout,
    searchPosProducts,
    getInvoiceReceipt,
    getSalesHistory,
    deleteInvoice,
} from '../controllers/pos.controller';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function req(body = {}, params = {}, query: any = {}, empId?: number) {
    return {
        body,
        params,
        query,
        user: empId ? { emp_id: empId } : undefined,
    };
}
function res() { return httpMocks.createResponse(); }

beforeEach(() => {
    mockQuery.mockReset();
    mockConnection.query.mockReset();
    mockBeginTransaction.mockReset();
    mockCommit.mockReset();
    mockRollback.mockReset();
    
    // Set happy defaults
    mockQuery.mockResolvedValue([[]]);
    mockConnection.query.mockResolvedValue([[]]);
    mockBeginTransaction.mockResolvedValue(undefined);
    mockCommit.mockResolvedValue(undefined);
    mockRollback.mockResolvedValue(undefined);
});

afterEach(() => {
    logQueriesForTest(expect.getState().currentTestName || 'Unknown Test');
});

describe('POS Controller - saveDraftSale', () => {

    it('returns 401 when employee not authenticated', async () => {
        const response = res();
        await saveDraftSale(req({ items: [] }) as any, response as any);
        expect(response.statusCode).toBe(401);
    });

    it('saves a draft invoice and returns invoice_id', async () => {
        mockConnection.query
            .mockResolvedValueOnce([{ insertId: 55 }]) // INSERT Sales_Invoices
        const response = res();
        await saveDraftSale(req({ total_amount: 250, items: [] }, {}, {}, 1) as any, response as any);
        expect(response.statusCode).toBe(200);
        expect(response._getJSONData().invoice_id).toBe(55);
        expect(mockCommit).toHaveBeenCalled();
    });

    it('inserts sale items when items array has batch_id entries', async () => {
        mockConnection.query
            .mockResolvedValueOnce([{ insertId: 56 }]) // INSERT invoice
            .mockResolvedValueOnce([{}]);               // INSERT Sale_Items

        const response = res();
        const items = [{ batch_id: 10, quantity: 2, unit_price: 50, type: 'otc', frequency: '' }];
        await saveDraftSale(req({ total_amount: 100, items }, {}, {}, 1) as any, response as any);
        expect(response.statusCode).toBe(200);
        expect(mockConnection.query).toHaveBeenCalledTimes(2);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// confirmCheckout
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('POS Controller â€” confirmCheckout', () => {
    it('returns 401 when not authenticated', async () => {
        const response = res();
        await confirmCheckout(req({ items: [{}] }) as any, response as any);
        expect(response.statusCode).toBe(401);
    });

    it('returns 400 when cart is empty', async () => {
        const response = res();
        await confirmCheckout(req({ items: [] }, {}, {}, 1) as any, response as any);
        expect(response.statusCode).toBe(400);
        expect(response._getJSONData().error).toMatch(/cart is empty/i);
    });

    it('completes checkout and deducts stock via FEFO', async () => {
        mockConnection.query
            .mockResolvedValueOnce([{ insertId: 100 }])  // INSERT Sales_Invoices
            .mockResolvedValueOnce([[{ batch_id: 5, current_stock_level: 10, unit_cost: 20 }]]) // SELECT batches FOR UPDATE
            .mockResolvedValueOnce([{}]) // UPDATE batch stock
            .mockResolvedValueOnce([{}]) // INSERT Sale_Items
            .mockResolvedValueOnce([{}]); // UPDATE Products stock

        const items = [{ product_id: 1, quantity: 3, unit_price: 25, type: 'otc' }];
        const response = res();
        await confirmCheckout(req({ items, total_amount: 75, money_given: 100, payment_method: 'Cash' }, {}, {}, 1) as any, response as any);
        expect(response.statusCode).toBe(200);
        const data = response._getJSONData();
        expect(data.invoice_id).toBe(100);
        expect(data.change_due).toBe(25);
    });

    it('rolls back and returns 500 when stock is insufficient', async () => {
        mockConnection.query
            .mockResolvedValueOnce([{ insertId: 101 }])
            .mockResolvedValueOnce([[{ batch_id: 6, current_stock_level: 1, unit_cost: 20 }]]) // only 1 in stock
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([{}]);

        const items = [{ product_id: 2, quantity: 5, unit_price: 20, type: 'otc' }]; // needs 5, only 1 available
        const response = res();
        await confirmCheckout(req({ items, total_amount: 100, money_given: 100, payment_method: 'Cash' }, {}, {}, 1) as any, response as any);
        expect(response.statusCode).toBe(500);
        expect(mockRollback).toHaveBeenCalled();
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// searchPosProducts
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('POS Controller â€” searchPosProducts', () => {
    it('returns all products when no query string', async () => {
        mockQuery
            .mockResolvedValueOnce([[{ product_id: 1, name: 'Paracetamol' }]])
            .mockResolvedValueOnce([[]]); // batches for product 1

        const response = res();
        await searchPosProducts(req() as any, response as any);
        expect(response.statusCode).toBe(200);
        expect(response._getJSONData()).toHaveLength(1);
    });

    it('filters products by name/category when q is supplied', async () => {
        mockQuery
            .mockResolvedValueOnce([[{ product_id: 2, name: 'Amoxicillin' }]])
            .mockResolvedValueOnce([[{ batch_id: 3, expiry_date: '2026-01-01', current_stock_level: 10 }]]);

        const request = req({}, {}, { q: 'Amox' });
        const response = res();
        await searchPosProducts(request as any, response as any);
        const data = response._getJSONData();
        expect(data[0].batches).toHaveLength(1);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// getInvoiceReceipt
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('POS Controller â€” getInvoiceReceipt', () => {
    it('returns 400 for invalid invoice id', async () => {
        const request = req({}, { id: 'abc' });
        const response = res();
        await getInvoiceReceipt(request as any, response as any);
        expect(response.statusCode).toBe(400);
    });

    it('returns 404 when invoice not found', async () => {
        mockQuery.mockResolvedValueOnce([[]]); // no invoice
        const request = req({}, { id: '999' });
        const response = res();
        await getInvoiceReceipt(request as any, response as any);
        expect(response.statusCode).toBe(404);
    });

    it('returns invoice with items on happy path', async () => {
        mockQuery
            .mockResolvedValueOnce([[{ invoice_id: 10, total_amount: 200, cashier_name: 'Bob' }]])
            .mockResolvedValueOnce([[{ sale_item_id: 1, product_name: 'Aspirin' }]]);

        const request = req({}, { id: '10' });
        const response = res();
        await getInvoiceReceipt(request as any, response as any);
        expect(response.statusCode).toBe(200);
        const data = response._getJSONData();
        expect(data.items).toHaveLength(1);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// getSalesHistory
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('POS Controller â€” getSalesHistory', () => {
    it('returns list of sales', async () => {
        mockQuery.mockResolvedValueOnce([[{ invoice_id: 1 }, { invoice_id: 2 }]]);
        const response = res();
        await getSalesHistory(req() as any, response as any);
        expect(response.statusCode).toBe(200);
        expect(response._getJSONData()).toHaveLength(2);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// deleteInvoice
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('POS Controller â€” deleteInvoice', () => {
    it('returns 404 when invoice not found', async () => {
        mockConnection.query.mockResolvedValueOnce([[]]); // no invoice
        const response = res();
        await deleteInvoice(req({}, { id: '999' }, {}, 1) as any, response as any);
        expect(response.statusCode).toBe(404);
    });

    it('deletes a Draft invoice without restoring stock', async () => {
        mockConnection.query
            .mockResolvedValueOnce([[{ status: 'Draft' }]])   // SELECT status
            .mockResolvedValueOnce([{}])                       // DELETE invoice
            .mockResolvedValueOnce([{}]);                      // INSERT audit log

        const response = res();
        await deleteInvoice(req({}, { id: '50' }, {}, 1) as any, response as any);
        expect(response.statusCode).toBe(200);
        expect(mockCommit).toHaveBeenCalled();
    });

    it('restores batch stock when Completed invoice is deleted', async () => {
        mockConnection.query
            .mockResolvedValueOnce([[{ status: 'Completed' }]])                    // SELECT status
            .mockResolvedValueOnce([[{ batch_id: 3, quantity: 2 }]])               // SELECT sale items
            .mockResolvedValueOnce([{}])                                           // UPDATE batch stock
            .mockResolvedValueOnce([[{ product_id: 1 }]])                          // SELECT product_id
            .mockResolvedValueOnce([{}])                                           // UPDATE product stock
            .mockResolvedValueOnce([{}])                                           // DELETE invoice
            .mockResolvedValueOnce([{}]);                                          // INSERT audit log

        const response = res();
        await deleteInvoice(req({}, { id: '51' }, {}, 1) as any, response as any);
        expect(response.statusCode).toBe(200);
    });
});

