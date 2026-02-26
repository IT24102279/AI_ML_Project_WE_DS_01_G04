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

        // E-commerce Mock Data
        await pool.query(`INSERT IGNORE INTO Public_Products (product_id, name, price, category, image_url, in_stock) VALUES 
            (101, 'Organic Milk 1L', 2.50, 'Groceries', 'https://via.placeholder.com/150', TRUE),
            (102, 'Whole Wheat Bread', 1.80, 'Groceries', 'https://via.placeholder.com/150', TRUE),
            (103, 'Band-Aids 50pk', 4.00, 'First Aid', 'https://via.placeholder.com/150', TRUE),
            (999, 'Amoxicillin 500mg', 12.00, 'Medicine', 'https://via.placeholder.com/150', TRUE)`);

        // Mock Drivers
        await pool.query(`INSERT IGNORE INTO Customers (id, anonymized) VALUES (44, FALSE), (55, FALSE)`); // Drivers are inherently auth users in a real app

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


// MODULE 5: E-COMMERCE & LOGISTICS

// Get Products (NMRA compliance: Hide Medicines)
app.get('/api/shop/products', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM Public_Products WHERE category != 'Medicine' AND in_stock = TRUE`);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Server Error' }); }
});

// Get Shop Status (Check Drivers)
app.get('/api/shop/status', async (req, res) => {
    try {
        // In a real app we'd track active sessions. Here we mock check if any drivers exist who have taken an order today. 
        // For simplicity, we assume Drivers ID 44 and 55 are our fleet.
        const [rows]: any = await pool.query(`SELECT COUNT(*) as active FROM Delivery_Logs WHERE DATE(timestamp) = CURDATE()`);
        const activeCount = rows[0].active || 0; // If 0, no one is driving today.

        res.json({
            active_drivers_count: activeCount,
            is_preorder_only: activeCount === 0,
            message: activeCount === 0 ? "No drivers currently available. Orders placed now will be scheduled for tomorrow." : "Drivers active."
        });
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

// Get Cart
app.get('/api/cart/:customerId', async (req, res) => {
    try {
        const cid = req.params.customerId;
        const [carts]: any = await pool.query(`SELECT cart_id FROM Shopping_Carts WHERE customer_id = ?`, [cid]);
        if (carts.length === 0) return res.json([]);

        const cartId = carts[0].cart_id;
        const [items] = await pool.query(`
            SELECT ci.cart_item_id, ci.quantity, p.product_id, p.name, p.price, p.image_url 
            FROM Cart_Items ci 
            JOIN Public_Products p ON ci.product_id = p.product_id 
            WHERE ci.cart_id = ?`, [cartId]);
        res.json(items);
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

// Add to Cart
app.post('/api/cart/add', async (req, res) => {
    try {
        const { customer_id, product_id, quantity = 1 } = req.body;

        // Find or Create Cart
        let [carts]: any = await pool.query(`SELECT cart_id FROM Shopping_Carts WHERE customer_id = ?`, [customer_id]);
        let cartId;
        if (carts.length === 0) {
            const [insertCart]: any = await pool.query(`INSERT INTO Shopping_Carts (customer_id) VALUES (?)`, [customer_id]);
            cartId = insertCart.insertId;
        } else {
            cartId = carts[0].cart_id;
        }

        // Add Item
        await pool.query(`INSERT INTO Cart_Items (cart_id, product_id, quantity) VALUES (?, ?, ?)
                          ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
            [cartId, product_id, quantity, quantity]);

        res.json({ status: "Success" });
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

// Remove from Cart
app.delete('/api/cart/remove/:itemId', async (req, res) => {
    try {
        await pool.query(`DELETE FROM Cart_Items WHERE cart_item_id = ?`, [req.params.itemId]);
        res.json({ status: "Removed" });
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

// Checkout Transaction
app.post('/api/orders/checkout', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { customer_id } = req.body;
        await connection.beginTransaction();

        const [carts]: any = await connection.query(`SELECT cart_id FROM Shopping_Carts WHERE customer_id = ?`, [customer_id]);
        if (carts.length === 0) throw new Error("Cart empty");
        const cartId = carts[0].cart_id;

        const [items]: any = await connection.query(`
            SELECT ci.product_id, ci.quantity, p.price 
            FROM Cart_Items ci JOIN Public_Products p ON ci.product_id = p.product_id 
            WHERE ci.cart_id = ?`, [cartId]);

        if (items.length === 0) throw new Error("Cart empty");

        const total = items.reduce((sum: number, item: any) => sum + (Number(item.price) * item.quantity), 0);

        // Create Order
        const [orderResult]: any = await connection.query(
            `INSERT INTO Orders (customer_id, total_amount, status) VALUES (?, ?, 'Pending')`,
            [customer_id, total]
        );
        const orderId = orderResult.insertId;

        // Move items
        for (const item of items) {
            await connection.query(
                `INSERT INTO Order_Items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)`,
                [orderId, item.product_id, item.quantity, item.price]
            );
        }

        // Clear cart
        await connection.query(`DELETE FROM Cart_Items WHERE cart_id = ?`, [cartId]);

        await connection.commit();
        res.json({ order_id: orderId, total_amount: total, status: "Order Placed" });
    } catch (error: any) {
        await connection.rollback();
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// Admin Smart Driver Assignment
app.put('/api/orders/:id/assign-driver', async (req, res) => {
    try {
        const orderId = req.params.id;

        // Algorithmic SQL: Find the driver with the minimum orders today. 
        // We assume driver IDs 44 and 55. We look at Delivery_Logs.
        const [driverLoads]: any = await pool.query(`
            SELECT driver_id, COUNT(*) as current_load 
            FROM Orders 
            WHERE driver_id IN (44, 55) AND DATE(created_at) = CURDATE() 
            GROUP BY driver_id 
            ORDER BY current_load ASC 
            LIMIT 1
        `);

        // Fallback to driver 44 if no logs exist yet
        const assignedDriverId = driverLoads.length > 0 ? driverLoads[0].driver_id : 44;

        await pool.query(`UPDATE Orders SET driver_id = ?, status = 'Packing' WHERE order_id = ?`, [assignedDriverId, orderId]);
        await pool.query(`INSERT INTO Delivery_Logs (order_id, driver_id, status_update) VALUES (?, ?, 'Assigned & Packing')`, [orderId, assignedDriverId]);

        res.json({ order_id: orderId, assigned_driver_id: assignedDriverId, status: "Packing" });
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

// Admin/Driver Fetch Orders
app.get('/api/orders', async (req, res) => {
    try {
        const { driver_id } = req.query;
        let query = `SELECT * FROM Orders ORDER BY created_at DESC`;
        let params: any[] = [];

        if (driver_id) {
            query = `SELECT * FROM Orders WHERE driver_id = ? ORDER BY created_at DESC`;
            params = [driver_id];
        }
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

// Driver Update Status
app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { driver_id, status } = req.body;

        await pool.query(`UPDATE Orders SET status = ? WHERE order_id = ? AND driver_id = ?`, [status, orderId, driver_id]);
        await pool.query(`INSERT INTO Delivery_Logs (order_id, driver_id, status_update) VALUES (?, ?, ?)`, [orderId, driver_id, status]);

        res.json({ order_id: orderId, status });
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

// --- ADMIN SHOP MANAGER CRUD ---

// Get All Products (Admin view - includes empty stock / Medicines if needed)
app.get('/api/admin/products', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM Public_Products ORDER BY product_id DESC`);
        res.json(rows);
    } catch (error) { res.status(500).json({ error: 'Server Error' }); }
});

// Create Product
app.post('/api/admin/products', async (req, res) => {
    try {
        const { name, price, category, image_url, in_stock } = req.body;
        const [result]: any = await pool.query(
            `INSERT INTO Public_Products (name, price, category, image_url, in_stock) VALUES (?, ?, ?, ?, ?)`,
            [name, price, category, image_url, in_stock]
        );
        res.json({ product_id: result.insertId, status: "Created" });
    } catch (error) { res.status(500).json({ error: 'Server Error' }); }
});

// Update Product
app.put('/api/admin/products/:id', async (req, res) => {
    try {
        const { name, price, category, image_url, in_stock } = req.body;
        await pool.query(
            `UPDATE Public_Products SET name=?, price=?, category=?, image_url=?, in_stock=? WHERE product_id=?`,
            [name, price, category, image_url, in_stock, req.params.id]
        );
        res.json({ status: "Updated" });
    } catch (error) { res.status(500).json({ error: 'Server Error' }); }
});

// Delete Product
app.delete('/api/admin/products/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM Public_Products WHERE product_id=?`, [req.params.id]);
        res.json({ status: "Deleted" });
    } catch (error) { res.status(500).json({ error: 'Server Error' }); }
});

app.listen(PORT, () => {
    console.log(`Customer Backend running on http://localhost:${PORT}`);
});
