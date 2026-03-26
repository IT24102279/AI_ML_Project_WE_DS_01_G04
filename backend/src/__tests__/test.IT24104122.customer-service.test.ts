/**
 * Unit Tests â€” IT24104122 (nadee1403)
 * Module: Customer Service â€” Chat & Appointments
 *
 * Tests routes/logic that would live in backend_customer/src/index.ts:
 *   POST /api/chat/send â€” rate limiting, LLM reply
 *   POST /api/appointments/book â€” date validation, booking
 *   GET  /api/customers/:id/appointments
 *   PUT  /api/appointments/:id
 *   DELETE /api/appointments/:id
 *   PATCH /api/chat/sessions/:id/resolve
 */

import express from 'express';
import request from 'supertest';

// â”€â”€â”€ pool resolved via moduleNameMapper â†’ __mocks__/customerDb.ts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { pool, mockQuery, mockExecute, mockConnection, mockBeginTransaction, mockCommit, mockRollback, logQueriesForTest } from './__mocks__/customerDb';

// â”€â”€â”€ Build a minimal Express app replicating the routes under test â”€â”€â”€â”€â”€â”€â”€â”€â”€
const app = express();
app.use(express.json());

// â”€â”€ Chat Send â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/chat/send', async (req, res) => {
    try {
        const { customer_id, session_id, content } = req.body;
        if (!customer_id || !session_id || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const [counts]: any = await pool.query(
            `SELECT COUNT(*) as count FROM Chat_Messages WHERE session_id = ? AND sender = 'Customer'`,
            [session_id]
        );
        if (counts[0].count >= 50) {
            return res.status(429).json({ error: 'Session rate limit exceeded (50 messages max).' });
        }
        await pool.query(`INSERT IGNORE INTO Chat_Sessions (id, customer_id, status) VALUES (?, ?, 'Active')`, [session_id, customer_id]);
        await pool.query(`INSERT INTO Chat_Messages (session_id, sender, content) VALUES (?, 'Customer', ?)`, [session_id, content]);
        const [insertResult]: any = await pool.query(
            `INSERT INTO Chat_Messages (session_id, sender, content) VALUES (?, 'LLM', ?)`,
            [session_id, 'I cannot diagnose or recommend treatments.']
        );
        res.json({
            message_id: insertResult.insertId,
            llm_reply: 'I cannot diagnose or recommend treatments.',
            rate_limit_remaining: 50 - (counts[0].count + 1),
        });
    } catch (e: any) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// â”€â”€ Appointments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.post('/api/appointments/book', async (req, res) => {
    try {
        const { customer_id, pharmacist_id = 1, scheduled_time, symptoms_note } = req.body;
        if (!scheduled_time) return res.status(400).json({ error: 'Scheduled time required' });
        let formattedTime;
        try {
            const d = new Date(scheduled_time);
            if (isNaN(d.getTime())) throw new Error();
            formattedTime = d.toISOString().replace('T', ' ').slice(0, 19);
        } catch {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        const [result]: any = await pool.query(
            `INSERT INTO Appointments (customer_id, pharmacist_id, scheduled_time, symptoms_note, status) VALUES (?, ?, ?, ?, 'Confirmed')`,
            [customer_id, pharmacist_id, formattedTime, symptoms_note || '']
        );
        res.json({ appointment_id: result.insertId, status: 'Confirmed', scheduled_for: formattedTime });
    } catch (e) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/customers/:id/appointments', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM Appointments WHERE customer_id = ? ORDER BY scheduled_time ASC`, [req.params.id]);
        res.json(rows);
    } catch {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.put('/api/appointments/:id', async (req, res) => {
    try {
        const { scheduled_time, symptoms_note } = req.body;
        let formattedTime;
        try {
            const d = new Date(scheduled_time);
            if (isNaN(d.getTime())) throw new Error();
            formattedTime = d.toISOString().replace('T', ' ').slice(0, 19);
        } catch {
            return res.status(400).json({ error: 'Invalid date format' });
        }
        await pool.query(`UPDATE Appointments SET scheduled_time = ?, symptoms_note = ? WHERE id = ?`, [formattedTime, symptoms_note || '', req.params.id]);
        res.json({ status: 'Updated' });
    } catch {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.delete('/api/appointments/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM Appointments WHERE id = ?`, [req.params.id]);
        res.json({ status: 'Deleted' });
    } catch {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.patch('/api/chat/sessions/:id/resolve', async (req, res) => {
    try {
        const { internal_note } = req.body;
        await pool.query(`UPDATE Chat_Sessions SET status = 'Resolved' WHERE id = ?`, [req.params.id]);
        if (internal_note) {
            await pool.query(
                `INSERT INTO Chat_Messages (session_id, sender, content, internal_note) VALUES (?, 'Pharmacist', '[Session Resolved]', ?)`,
                [req.params.id, internal_note]
            );
        }
        res.json({ status: 'Resolved' });
    } catch {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// --------------------------------------------------------------------------------

beforeEach(() => {
    jest.clearAllMocks();
});

afterEach(() => {
    logQueriesForTest(expect.getState().currentTestName || 'Unknown Test');
});

// --------------------------------------------------------------------------------
// Chat - POST /api/chat/send
// --------------------------------------------------------------------------------
describe('Customer Service - Chat Send', () => {
    it('returns 400 when required fields are missing', async () => {
        const res = await request(app).post('/api/chat/send').send({ customer_id: 1 });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/missing/i);
    });

    it('returns 429 when session has 50+ messages', async () => {
        mockQuery.mockResolvedValueOnce([[{ count: 50 }]]);
        const res = await request(app).post('/api/chat/send').send({ customer_id: 1, session_id: 'sess-1', content: 'hi' });
        expect(res.statusCode).toBe(429);
        expect(res.body.error).toMatch(/rate limit/i);
    });

    it('sends message and returns LLM reply and rate_limit_remaining', async () => {
        mockQuery
            .mockResolvedValueOnce([[{ count: 3 }]])   // rate-limit check
            .mockResolvedValueOnce([{}])                // INSERT IGNORE session
            .mockResolvedValueOnce([{}])                // INSERT customer message
            .mockResolvedValueOnce([{ insertId: 99 }]); // INSERT LLM message

        const res = await request(app).post('/api/chat/send').send({ customer_id: 1, session_id: 'sess-2', content: 'Hello' });
        expect(res.statusCode).toBe(200);
        expect(res.body.message_id).toBe(99);
        expect(res.body.rate_limit_remaining).toBe(46);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Appointments â€” POST /api/appointments/book
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Customer Service â€” Book Appointment', () => {
    it('returns 400 when scheduled_time is missing', async () => {
        const res = await request(app).post('/api/appointments/book').send({ customer_id: 1 });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/scheduled time/i);
    });

    it('returns 400 on invalid date format', async () => {
        const res = await request(app).post('/api/appointments/book').send({ customer_id: 1, scheduled_time: 'not-a-date' });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/invalid date/i);
    });

    it('books appointment and returns appointment_id', async () => {
        mockQuery.mockResolvedValueOnce([{ insertId: 42 }]);
        const res = await request(app).post('/api/appointments/book').send({
            customer_id: 1,
            scheduled_time: '2027-05-01T10:00',
            symptoms_note: 'Headache',
        });
        expect(res.statusCode).toBe(200);
        expect(res.body.appointment_id).toBe(42);
        expect(res.body.status).toBe('Confirmed');
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// GET /api/customers/:id/appointments
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Customer Service â€” Get Appointments', () => {
    it('returns list of appointments for customer', async () => {
        mockQuery.mockResolvedValueOnce([[{ id: 1 }, { id: 2 }]]);
        const res = await request(app).get('/api/customers/1/appointments');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(2);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PUT /api/appointments/:id
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Customer Service â€” Update Appointment', () => {
    it('updates appointment scheduled time', async () => {
        mockQuery.mockResolvedValueOnce([{}]);
        const res = await request(app).put('/api/appointments/1').send({ scheduled_time: '2027-06-01T14:00', symptoms_note: 'Fever' });
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('Updated');
    });

    it('returns 400 for bad date format', async () => {
        const res = await request(app).put('/api/appointments/1').send({ scheduled_time: 'bad', symptoms_note: '' });
        expect(res.statusCode).toBe(400);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DELETE /api/appointments/:id
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Customer Service â€” Delete Appointment', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    it('deletes the appointment', async () => {
        mockQuery.mockResolvedValueOnce([{}]);
        const res = await request(app).delete('/api/appointments/5');
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('Deleted');
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// PATCH /api/chat/sessions/:id/resolve
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Customer Service â€” Resolve Chat Session', () => {
    it('marks session as Resolved without note', async () => {
        mockQuery.mockResolvedValueOnce([{}]);
        const res = await request(app).patch('/api/chat/sessions/sess-1/resolve').send({});
        expect(res.statusCode).toBe(200);
        expect(res.body.status).toBe('Resolved');
        expect(mockQuery).toHaveBeenCalledTimes(1); // only UPDATE, no INSERT
    });

    it('also inserts internal_note when provided', async () => {
        mockQuery.mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]);
        const res = await request(app).patch('/api/chat/sessions/sess-2/resolve').send({ internal_note: 'Escalated' });
        expect(res.statusCode).toBe(200);
        expect(mockQuery).toHaveBeenCalledTimes(2); // UPDATE + INSERT
    });
});

