/**
 * Unit Tests â€” IT24103223
 * Module: Patient Management & Prescription History
 *
 * Tests: createPatient, updatePatient, getPatient, searchPatients,
 *        getPatientDiscount, optOutPatient
 */

import * as httpMocks from 'node-mocks-http';

// â”€â”€â”€ pool resolved via moduleNameMapper â†’ __mocks__/customerDb.ts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { pool, mockQuery, mockConnection, mockBeginTransaction, mockCommit, mockRollback, logQueriesForTest } from './__mocks__/customerDb';

import {
    createPatient,
    updatePatient,
    getPatient,
    searchPatients,
    getPatientDiscount,
    optOutPatient,
} from '../controllers/patients.controller';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function req(body = {}, params = {}, query: any = {}) {
    return {
        body,
        params,
        query,
    };
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

describe('Patient Controller - createPatient', () => {
    it('returns 400 when consent_given is false', async () => {
        const response = res();
        await createPatient(req({ consent_given: false, name: 'X', phone: '0771', birth_year: 1990 }) as any, response as any);
        expect(response.statusCode).toBe(400);
        expect(response._getJSONData().error).toMatch(/consent/i);
    });

    it('returns 400 when required fields are missing', async () => {
        const response = res();
        await createPatient(req({ consent_given: true }) as any, response as any);
        expect(response.statusCode).toBe(400);
        expect(response._getJSONData().error).toMatch(/required/i);
    });

    it('creates patient and returns 201 with a patient_id UUID', async () => {
        mockQuery.mockResolvedValueOnce([{}]);
        const response = res();
        await createPatient(req({ consent_given: true, name: 'Jane', phone: '0771234567', birth_year: 1985 }) as any, response as any);
        expect(response.statusCode).toBe(201);
        const data = response._getJSONData();
        expect(data.patient_id).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('returns 500 on DB failure', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB down'));
        const response = res();
        await createPatient(req({ consent_given: true, name: 'X', phone: '077', birth_year: 1990 }) as any, response as any);
        expect(response.statusCode).toBe(500);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// updatePatient
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Patient Controller â€” updatePatient', () => {
    it('returns 400 when required fields are missing', async () => {
        const response = res();
        await updatePatient(req({}, { id: 'uuid-1' }) as any, response as any);
        expect(response.statusCode).toBe(400);
    });

    it('returns 404 when patient not found or opted out', async () => {
        mockQuery.mockResolvedValueOnce([{ affectedRows: 0 }]);
        const response = res();
        await updatePatient(req({ name: 'A', phone: '0771', birth_year: 1990 }, { id: 'unknown-uuid' }) as any, response as any);
        expect(response.statusCode).toBe(404);
    });

    it('returns 200 on successful update', async () => {
        mockQuery.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const response = res();
        await updatePatient(req({ name: 'Jane', phone: '0771', birth_year: 1985 }, { id: 'valid-uuid' }) as any, response as any);
        expect(response.statusCode).toBe(200);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// getPatient
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Patient Controller â€” getPatient', () => {
    it('returns 404 when patient not found', async () => {
        mockQuery.mockResolvedValueOnce([[]]); // no rows
        const response = res();
        await getPatient(req({}, { id: 'nonexistent' }) as any, response as any);
        expect(response.statusCode).toBe(404);
    });

    it('hides PII for opted-out patients', async () => {
        mockQuery
            .mockResolvedValueOnce([[{ patient_id: 'uuid-1', birth_year: 1970, opted_out: true, encrypted_bio_data: null, encrypted_clinical_notes: null, created_at: new Date() }]])
            .mockResolvedValueOnce([[]])  // invoices
            .mockResolvedValueOnce([[]]); // prescriptions

        const response = res();
        await getPatient(req({}, { id: 'uuid-1' }) as any, response as any);
        expect(response.statusCode).toBe(200);
        const data = response._getJSONData();
        expect(data.opted_out).toBe(true);
        expect(data.name).toBeUndefined();
    });

    it('includes history (invoices + prescriptions) for active patient', async () => {
        mockQuery
            .mockResolvedValueOnce([[{ patient_id: 'uuid-2', birth_year: 1990, opted_out: false, encrypted_bio_data: null, encrypted_clinical_notes: null, created_at: new Date() }]])
            .mockResolvedValueOnce([[{ invoice_id: 1 }]])   // invoices
            .mockResolvedValueOnce([[{ prescription_id: 1 }]]); // prescriptions

        const response = res();
        await getPatient(req({}, { id: 'uuid-2' }) as any, response as any);
        expect(response.statusCode).toBe(200);
        const data = response._getJSONData();
        expect(data.history.invoices).toHaveLength(1);
        expect(data.history.prescriptions).toHaveLength(1);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// searchPatients
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Patient Controller â€” searchPatients', () => {
    it('returns empty array when no phone query provided', async () => {
        const response = res();
        await searchPatients(req() as any, response as any);
        expect(response.statusCode).toBe(200);
        expect(response._getJSONData()).toEqual([]);
    });

    it('returns matched patients by phone hash', async () => {
        mockQuery.mockResolvedValueOnce([[{ patient_id: 'uuid-3', encrypted_bio_data: null, birth_year: 1990, opted_out: false }]]);
        const request = req({}, {}, { phone: '0771234567' });
        const response = res();
        await searchPatients(request as any, response as any);
        expect(response.statusCode).toBe(200);
        const results = response._getJSONData();
        expect(results).toHaveLength(1);
        expect(results[0].patient_id).toBe('uuid-3');
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// getPatientDiscount
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Patient Controller â€” getPatientDiscount', () => {
    it('returns 0% for opted-out patients', async () => {
        mockQuery.mockResolvedValueOnce([[{ birth_year: 1950, opted_out: true, created_at: new Date('2020-01-01') }]]);
        const response = res();
        await getPatientDiscount(req({}, { id: 'uuid-4' }) as any, response as any);
        expect(response._getJSONData().applied_discount_pct).toBe(0);
    });

    it('applies 5% senior discount for age >= 60', async () => {
        const oldYear = new Date().getFullYear() - 65;
        mockQuery.mockResolvedValueOnce([[{ birth_year: oldYear, opted_out: false, created_at: new Date('2020-01-01') }]]);
        const response = res();
        await getPatientDiscount(req({}, { id: 'uuid-5' }) as any, response as any);
        const data = response._getJSONData();
        expect(data.senior_pct).toBe(5);
    });

    it('does NOT apply senior discount for age 59', async () => {
        const youngYear = new Date().getFullYear() - 59;
        mockQuery.mockResolvedValueOnce([[{ birth_year: youngYear, opted_out: false, created_at: new Date('2024-01-01') }]]);
        const response = res();
        await getPatientDiscount(req({}, { id: 'uuid-6' }) as any, response as any);
        expect(response._getJSONData().senior_pct).toBe(0);
    });

    it('caps total discount at 7%', async () => {
        // old patient registered years ago â€” loyalty would exceed 7% cap
        const oldYear = new Date().getFullYear() - 70;
        mockQuery.mockResolvedValueOnce([[{ birth_year: oldYear, opted_out: false, created_at: new Date('2010-01-01') }]]);
        const response = res();
        await getPatientDiscount(req({}, { id: 'uuid-7' }) as any, response as any);
        expect(response._getJSONData().applied_discount_pct).toBeLessThanOrEqual(7);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// optOutPatient
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Patient Controller â€” optOutPatient', () => {
    it('anonymizes patient data and returns 200', async () => {
        mockQuery.mockResolvedValueOnce([{}]);
        const response = res();
        await optOutPatient(req({}, { id: 'uuid-8' }) as any, response as any);
        expect(response.statusCode).toBe(200);
        expect(response._getJSONData().message).toMatch(/anonymized/i);
    });

    it('returns 500 on DB failure', async () => {
        mockQuery.mockRejectedValueOnce(new Error('DB down'));
        const response = res();
        await optOutPatient(req({}, { id: 'uuid-9' }) as any, response as any);
        expect(response.statusCode).toBe(500);
    });
});

