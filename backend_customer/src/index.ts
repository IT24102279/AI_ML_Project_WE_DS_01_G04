import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db';
import crypto from 'crypto';
import fetch from 'node-fetch';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Initialize Database & Mock Data
async function initDB() {
    try {
        console.log('Connecting to Customer DB...');
        // Wait for schema execution (in prod we wouldn't run this every boot, but for this exercise we do)
        // Assume schema.sql is run externally or we run it now, but for safety we just insert the mock user.
        await pool.query(`INSERT IGNORE INTO Customers (id, anonymized) VALUES (1, FALSE)`);
        await pool.query(`INSERT IGNORE INTO Pharmacist_Schedules (id, pharmacist_name, date, shift_start, shift_end) VALUES (1, 'Dr. Smith', CURDATE(), '09:00:00', '17:00:00')`);
        console.log('Mock Data initialized.');
    } catch (error) {
        console.error('Initialization Error:', error);
    }
}
initDB();

// --- API ROUTES ---

// 1. Send Chat Message
app.post('/api/chat/send', async (req, res) => {
    try {
        const { customer_id, session_id, content } = req.body;
        if (!customer_id || !session_id || !content) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Rate Limiting check
        const [counts]: any = await pool.query(
            `SELECT COUNT(*) as count FROM Chat_Messages WHERE session_id = ? AND sender = 'Customer'`,
            [session_id]
        );
        const userMsgCount = counts[0].count;
        if (userMsgCount >= 50) {
            return res.status(429).json({ error: 'Session rate limit exceeded (50 messages max).' });
        }

        // Ensure session exists
        await pool.query(`INSERT IGNORE INTO Chat_Sessions (id, customer_id, status) VALUES (?, ?, 'Active')`, [session_id, customer_id]);

        // Insert User Message
        await pool.query(
            `INSERT INTO Chat_Messages (session_id, sender, content) VALUES (?, 'Customer', ?)`,
            [session_id, content]
        );

        let llmReply = "I cannot diagnose or recommend treatments. Please book a consultation with our pharmacist.";

        // Mock Function Calling / Inventory Check
        if (content.toLowerCase().includes('stock') || content.toLowerCase().includes('have') || content.toLowerCase().includes('available')) {
            try {
                // Forward the query to the POS inventory semantic check if needed, or just mock it.
                // We will do a generic cross-api mock GET here to the main POS backend.
                const response = await fetch(`http://localhost:3000/api/inventory/safe-check?q=${encodeURIComponent(content)}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.in_stock) {
                        llmReply += ` However, I have checked our inventory and yes, that item appears to be in stock.`;
                    }
                } else {
                    llmReply += ` (Inventory system unreachable)`;
                }
            } catch (e) {
                llmReply += ` (Failed to check live stock)`;
            }
        }

        // Insert LLM Message
        const [insertResult]: any = await pool.query(
            `INSERT INTO Chat_Messages (session_id, sender, content) VALUES (?, 'LLM', ?)`,
            [session_id, llmReply]
        );

        res.json({
            message_id: insertResult.insertId,
            timestamp: new Date().toISOString(),
            llm_reply: llmReply,
            status: "Message Sent",
            rate_limit_remaining: 50 - (userMsgCount + 1)
        });

    } catch (error: any) {
        console.error('Chat Send Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 2. Book Consultation Appointment
app.post('/api/appointments/book', async (req, res) => {
    try {
        const { customer_id, pharmacist_id = 1, scheduled_time, symptoms_note } = req.body;

        // Parse "YYYY-MM-DDTHH:MM" to "YYYY-MM-DD HH:MM:SS"
        if (!scheduled_time) return res.status(400).json({ error: 'Scheduled time required' });

        let formattedTime;
        try {
            formattedTime = new Date(scheduled_time).toISOString().slice(0, 19).replace('T', ' ');
        } catch (e) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        const [result]: any = await pool.query(
            `INSERT INTO Appointments (customer_id, pharmacist_id, scheduled_time, symptoms_note, status) VALUES (?, ?, ?, ?, 'Confirmed')`,
            [customer_id, pharmacist_id, formattedTime, symptoms_note || '']
        );

        res.json({
            appointment_id: result.insertId,
            status: "Confirmed",
            scheduled_for: formattedTime
        });

    } catch (error: any) {
        console.error('Booking Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 3. Delete / Opt-Out
app.delete('/api/customers/:id/opt-out', async (req, res) => {
    try {
        const cid = req.params.id;
        // Anonymize user data
        await pool.query(`UPDATE Customers SET anonymized = TRUE WHERE id = ?`, [cid]);
        // We could also delete chats to be completely scrubbed, or scramble them.
        await pool.query(`DELETE FROM Chat_Sessions WHERE customer_id = ?`, [cid]);

        res.json({ status: "Success", message: "Customer data has been permanently anonymized per privacy request." });
    } catch (error: any) {
        console.error('Opt-Out Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 4. Admin Resolve Chat
app.patch('/api/chat/sessions/:id/resolve', async (req, res) => {
    try {
        const sid = req.params.id;
        const { internal_note } = req.body;

        await pool.query(`UPDATE Chat_Sessions SET status = 'Resolved' WHERE id = ?`, [sid]);

        // Append internal note to the latest message or the session itself
        if (internal_note) {
            await pool.query(
                `INSERT INTO Chat_Messages (session_id, sender, content, internal_note) VALUES (?, 'Pharmacist', '[Session Resolved]', ?)`,
                [sid, internal_note]
            );
        }

        res.json({ session_id: sid, status: "Resolved", message: "Session concluded" });
    } catch (error: any) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 5. Admin Reply Live
app.post('/api/admin/chat-sessions/:id/reply', async (req, res) => {
    try {
        const sid = req.params.id;
        const { content } = req.body;

        const [result]: any = await pool.query(
            `INSERT INTO Chat_Messages (session_id, sender, content) VALUES (?, 'Pharmacist', ?)`,
            [sid, content]
        );
        res.json({ message_id: result.insertId, status: "Delivered" });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 6. Admin Get Sessions
app.get('/api/admin/chat-sessions', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM Chat_Sessions ORDER BY started_at DESC`);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 7. Admin Get Messages
app.get('/api/admin/chat-sessions/:id/messages', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM Chat_Messages WHERE session_id = ? ORDER BY timestamp ASC`, [req.params.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 8. Admin Get Appointments
app.get('/api/admin/appointments', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM Appointments ORDER BY scheduled_time ASC`);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 9. Customer Polling route
app.get('/api/chat/sessions/:id/messages', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT id as message_id, sender, content, timestamp FROM Chat_Messages WHERE session_id = ? ORDER BY timestamp ASC`, [req.params.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


app.listen(PORT, () => {
    console.log(`Customer Backend running on http://localhost:${PORT}`);
});
