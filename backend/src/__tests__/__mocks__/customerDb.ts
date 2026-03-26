/**
 * Shared mock for backend_customer/src/db.
 * Resolved via moduleNameMapper → this file whenever tests do:
 *   jest.mock('../../backend_customer/src/db')
 *   import pool from '../../backend_customer/src/db'
 * 
 * pool.query and pool.getConnection are jest.fn() instances.
 * Individual tests use mockResolvedValueOnce on them directly.
 */

import * as fs from 'fs';
import * as path from 'path';

const TRACE_FILE = path.join(__dirname, '../../../test-trace.jsonl');

function trace(data: any) {
    fs.appendFileSync(TRACE_FILE, JSON.stringify(data) + '\n');
}

export function clearTrace() {
    if (fs.existsSync(TRACE_FILE)) fs.unlinkSync(TRACE_FILE);
}

export const mockQuery = jest.fn().mockResolvedValue([[]]);
export const mockExecute = jest.fn().mockResolvedValue([[]]);
export const mockRelease = jest.fn();
export const mockBeginTransaction = jest.fn().mockResolvedValue(undefined);
export const mockCommit = jest.fn().mockResolvedValue(undefined);
export const mockRollback = jest.fn().mockResolvedValue(undefined);

export function logQueriesForTest(testName: string) {
    const queries = mockQuery.mock.calls.map(c => ({ type: 'query', sql: c[0], params: c[1] }));
    const eQueries = mockExecute.mock.calls.map(c => ({ type: 'execute', sql: c[0], params: c[1] }));
    
    // For transactions, we handle them if they were called
    if (mockBeginTransaction.mock.calls.length > 0) traces({ type: 'begin', count: mockBeginTransaction.mock.calls.length });
    if (mockCommit.mock.calls.length > 0) traces({ type: 'commit', count: mockCommit.mock.calls.length });
    if (mockRollback.mock.calls.length > 0) traces({ type: 'rollback', count: mockRollback.mock.calls.length });

    trace({ type: 'test_start', name: testName });
    [...queries, ...eQueries].forEach(q => trace(q));
}

function traces(data: any) { trace(data); }

export const mockConnection = {
    query: mockQuery,
    execute: mockExecute,
    release: mockRelease,
    beginTransaction: mockBeginTransaction,
    commit: mockCommit,
    rollback: mockRollback,
};

export const pool = {
    query: mockQuery,
    execute: mockExecute,
    getConnection: jest.fn(() => Promise.resolve(mockConnection)),
};

export default pool;
