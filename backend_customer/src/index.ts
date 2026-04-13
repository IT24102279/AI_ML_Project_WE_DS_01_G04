import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Load Pharmacy Info for AI Knowledge
let pharmacyKnowledge = "No detailed pharmacy info available.";
try {
    const kbPath = path.join(__dirname, '..', 'pharmacy_info.txt');
    if (fs.existsSync(kbPath)) {
        pharmacyKnowledge = fs.readFileSync(kbPath, 'utf8');
    }
} catch (e) {
    console.error("Knowledge base load error:", e);
}

// Gemini AI Config
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: `You are the helpful AI assistant for 'Colombo AI Pharmacy'. 
    
    BASE KNOWLEDGE (Retrievable Info):
    ${pharmacyKnowledge}
    
    RULES:
    1. NEVER recommend specific brand-name medicines or prescription drugs.
    2. Provide general medical advice (health tips, first aid common practices).
    3. Always be polite.
    4. If users ask about medications, remind them you are an AI and they should consult the human pharmacist.
    5. If they mention 'stock' or 'available', incorporate the inventory hint provided in the user prompt.`
});

app.use(cors());
app.use(express.json());

// Initialize Database & Mock Data
async function initDB() {
    try {
        console.log('Connecting to Customer DB...');

        try {
            await pool.query(`ALTER TABLE Customers 
                ADD COLUMN name VARCHAR(255), 
                ADD COLUMN phone VARCHAR(20), 
                ADD COLUMN address TEXT, 
                ADD COLUMN password_hash VARCHAR(255), 
                ADD COLUMN role ENUM('customer', 'admin') DEFAULT 'customer'`);
        } catch (e) { } // Ignores duplicate column error if already exists

        // Purge restricted medicine from seed
        await pool.query(`DELETE FROM Public_Products WHERE product_id = 999`);
        const adminHash = crypto.createHash('sha256').update('admin123').digest('hex');
        await pool.query(`INSERT IGNORE INTO Customers (id, name, role, password_hash) VALUES (999, 'Admin', 'admin', ?)`, [adminHash]);
        await pool.query(`INSERT IGNORE INTO Customers (id, anonymized) VALUES (1, FALSE)`);
        await pool.query(`INSERT IGNORE INTO Pharmacist_Schedules (id, pharmacist_name, date, shift_start, shift_end) VALUES (1, 'Dr. Smith', CURDATE(), '09:00:00', '17:00:00')`);

        // E-commerce Mock Data
        await pool.query(`INSERT IGNORE INTO Public_Products (product_id, name, price, category, image_url, in_stock) VALUES 
            (101, 'Organic Milk 1L', 153.50, 'Groceries', 'https://images.pexels.com/photos/7451957/pexels-photo-7451957.jpeg', TRUE),
            (102, 'Whole Wheat Bread', 180.00, 'Groceries', 'https://images.pexels.com/photos/8053709/pexels-photo-8053709.jpeg', TRUE),
            (103, 'Plasters 50pk', 250.00, 'First Aid', 'https://images.pexels.com/photos/7722833/pexels-photo-7722833.jpeg', TRUE)`);

        // Mock Drivers
        await pool.query(`CREATE TABLE IF NOT EXISTS Drivers (
            driver_id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            vehicle_info VARCHAR(255),
            status ENUM('Active', 'Inactive') DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query(`INSERT IGNORE INTO Drivers (driver_id, name, vehicle_info) VALUES 
            (44, 'Tim Fast', 'Van (WP AAB-1234)'),
            (55, 'Sarah Swift', 'Bike (WP BCD-5678)')`);

        console.log('Mock Data initialized.');
    } catch (error) {
        console.error('Initialization Error:', error);
    }
}
initDB();

// --- AUTHENTICATION ROUTES ---
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, phone, address, password, role = 'customer' } = req.body;
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        const [result]: any = await pool.query(
            `INSERT INTO Customers (name, phone, address, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
            [name, phone, address, hash, role]
        );
        res.json({ user_id: result.insertId, role, status: "Registered" });
    } catch (e) {
        res.status(500).json({ error: 'Server Error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        const [users]: any = await pool.query(`SELECT * FROM Customers WHERE phone = ? AND password_hash = ? AND anonymized = FALSE`, [phone, hash]);
        if (users.length === 0) {
            // Check for admin fallback
            const [admins]: any = await pool.query(`SELECT * FROM Customers WHERE name = ? AND password_hash = ?`, [phone, hash]);
            if (admins.length > 0) return res.json({ user_id: admins[0].id, name: admins[0].name, role: admins[0].role });
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        res.json({ user_id: users[0].id, name: users[0].name, role: users[0].role });
    } catch (e) {
        res.status(500).json({ error: 'Server Error' });
    }
});

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

        // Ensure customer exists (create if missing during dev/reset if needed, or error out)
        const [customers]: any = await pool.query(`SELECT id FROM Customers WHERE id = ?`, [customer_id]);
        if (customers.length === 0) {
            // Self-healing: if customer ID 1 is expected but missing, recreate it (common after dev resets)
            if (customer_id === 1) {
                await pool.query(`INSERT INTO Customers (id, anonymized) VALUES (1, FALSE)`);
            } else {
                return res.status(401).json({ error: 'Customer session invalid. Please log out and log in again.' });
            }
        }

        // Ensure session exists
        try {
            console.log(`Ensuring session ${session_id} for customer ${customer_id}`);
            await pool.query(`INSERT INTO Chat_Sessions (id, customer_id, status) 
                             VALUES (?, ?, 'Active') 
                             ON DUPLICATE KEY UPDATE status=status`, [session_id, customer_id]);
        } catch (err: any) {
            console.error("Session Creation Error:", err.message);
            return res.status(500).json({ error: `Failed to initialize chat session: ${err.message}` });
        }

        // Insert User Message
        await pool.query(
            `INSERT INTO Chat_Messages (session_id, sender, content) VALUES (?, 'Customer', ?)`,
            [session_id, content]
        );

        // Get Session History for Context
        const [history]: any = await pool.query(
            `SELECT sender, content FROM Chat_Messages WHERE session_id = ? ORDER BY id ASC LIMIT 10`,
            [session_id]
        );

        let llmReply = "I'm having trouble connecting to my brain right now.";

        try {
            const chat = model.startChat({
                history: history.map((msg: any) => ({
                    role: msg.sender === 'Customer' ? 'user' : 'model',
                    parts: [{ text: msg.content }]
                })),
                generationConfig: {
                    maxOutputTokens: 250,
                },
            });

            let promptExtra = "";
            // Keep existing Inventory Check logic
            if (content.toLowerCase().includes('stock') || content.toLowerCase().includes('have') || content.toLowerCase().includes('available')) {
                try {
                    const response = await fetch(`http://localhost:3000/api/inventory/safe-check?q=${encodeURIComponent(content)}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.in_stock) {
                            promptExtra = " (Note: Our local check shows this specific item IS currently in stock at the Colombo branch)";
                        } else {
                            promptExtra = " (Note: Our local check shows this item is currently out of stock)";
                        }
                    }
                } catch (e) { }
            }

            const result = await chat.sendMessage(content + promptExtra);
            const response = await result.response;
            llmReply = response.text();
        } catch (e: any) {
            console.error("Gemini Error:", e.message);
            llmReply = "I cannot diagnose or recommend treatments. Please book a consultation with our pharmacist.";
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
            const dateObj = new Date(scheduled_time);
            if (isNaN(dateObj.getTime())) throw new Error();

            // Format to YYYY-MM-DD HH:MM:SS in local time to avoid UTC shift
            const Y = dateObj.getFullYear();
            const M = String(dateObj.getMonth() + 1).padStart(2, '0');
            const D = String(dateObj.getDate()).padStart(2, '0');
            const h = String(dateObj.getHours()).padStart(2, '0');
            const m = String(dateObj.getMinutes()).padStart(2, '0');
            const s = String(dateObj.getSeconds()).padStart(2, '0');
            formattedTime = `${Y}-${M}-${D} ${h}:${m}:${s}`;
        } catch (e) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        // Check for clashing
        const [existing]: any = await pool.query(
            `SELECT id FROM Appointments WHERE pharmacist_id = ? AND scheduled_time = ? AND status = 'Confirmed'`,
            [pharmacist_id, formattedTime]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'This time slot is already booked. Please choose another time.' });
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

// Get My Appointments
app.get('/api/customers/:id/appointments', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM Appointments WHERE customer_id = ? ORDER BY scheduled_time ASC`, [req.params.id]);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Update Appointment
app.put('/api/appointments/:id', async (req, res) => {
    try {
        const { scheduled_time, symptoms_note } = req.body;
        let formattedTime;
        try {
            const dateObj = new Date(scheduled_time);
            if (isNaN(dateObj.getTime())) throw new Error();
            const Y = dateObj.getFullYear();
            const M = String(dateObj.getMonth() + 1).padStart(2, '0');
            const D = String(dateObj.getDate()).padStart(2, '0');
            const h = String(dateObj.getHours()).padStart(2, '0');
            const m = String(dateObj.getMinutes()).padStart(2, '0');
            const s = String(dateObj.getSeconds()).padStart(2, '0');
            formattedTime = `${Y}-${M}-${D} ${h}:${m}:${s}`;
        } catch (e) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        // Check for clashing (excluding current appointment)
        const [existing]: any = await pool.query(
            `SELECT id FROM Appointments WHERE pharmacist_id = 1 AND scheduled_time = ? AND status = 'Confirmed' AND id != ?`,
            [formattedTime, req.params.id]
        );
        if (existing.length > 0) {
            return res.status(409).json({ error: 'This time slot is already booked. Please choose another time.' });
        }

        await pool.query(
            `UPDATE Appointments SET scheduled_time = ?, symptoms_note = ? WHERE id = ?`,
            [formattedTime, symptoms_note || '', req.params.id]
        );
        res.json({ status: "Updated" });
    } catch (error) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Delete Appointment
app.delete('/api/appointments/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM Appointments WHERE id = ?`, [req.params.id]);
        res.json({ status: "Deleted" });
    } catch (error) {
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

// Admin Update Appointment Status
app.patch('/api/admin/appointments/:id/status', async (req, res) => {
    try {
        await pool.query(`UPDATE Appointments SET status = ? WHERE id = ?`, [req.body.status, req.params.id]);
        res.json({ status: "Updated" });
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
        const [rows]: any = await pool.query(`SELECT COUNT(*) as active FROM Drivers WHERE status = 'Active'`);
        const activeCount = rows[0].active || 0;

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

// Update Cart Item Quantity
app.patch('/api/cart/update', async (req, res) => {
    try {
        const { cart_item_id, quantity } = req.body;
        if (quantity <= 0) {
            await pool.query(`DELETE FROM Cart_Items WHERE cart_item_id = ?`, [cart_item_id]);
            return res.json({ status: "Removed" });
        }
        await pool.query(`UPDATE Cart_Items SET quantity = ? WHERE cart_item_id = ?`, [quantity, cart_item_id]);
        res.json({ status: "Updated" });
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

        const [activeDrivers]: any = await pool.query(`
            SELECT driver_id FROM Drivers d
            WHERE d.status = 'Active' 
            AND NOT EXISTS (
                SELECT 1 FROM Orders o 
                WHERE o.driver_id = d.driver_id 
                AND o.status = 'Handed to Driver'
            )
        `);
        if (activeDrivers.length === 0) return res.status(400).json({ error: "No active drivers available" });

        const driverIds = activeDrivers.map((d: any) => d.driver_id);
        const [driverLoads]: any = await pool.query(`
            SELECT driver_id, COUNT(*) as current_load 
            FROM Orders 
            WHERE driver_id IN (?) AND DATE(created_at) = CURDATE() 
            GROUP BY driver_id 
            ORDER BY current_load ASC 
        `, [driverIds]);

        // Fallback to first available driver if no logs exist yet
        const assignedDriverId = driverLoads.length > 0 ? driverLoads[0].driver_id : driverIds[0];

        await pool.query(`UPDATE Orders SET driver_id = ?, status = 'Packing' WHERE order_id = ?`, [assignedDriverId, orderId]);
        await pool.query(`INSERT INTO Delivery_Logs (order_id, driver_id, status_update) VALUES (?, ?, 'Assigned & Packing')`, [orderId, assignedDriverId]);

        res.json({ order_id: orderId, assigned_driver_id: assignedDriverId, status: "Packing" });
    } catch (e) { console.error(e); res.status(500).json({ error: 'Server Error' }); }
});

// Admin manual assign driver
app.patch('/api/admin/orders/:id/assign-driver', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { driver_id } = req.body;
        await pool.query(`UPDATE Orders SET driver_id = ?, status = 'Packing' WHERE order_id = ?`, [driver_id, orderId]);
        await pool.query(`INSERT INTO Delivery_Logs (order_id, driver_id, status_update) VALUES (?, ?, 'Assigned manually')`, [orderId, driver_id]);
        res.json({ order_id: orderId, driver_id, status: "Packing" });
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

// Admin/Driver/Customer Fetch Orders
app.get('/api/orders', async (req, res) => {
    try {
        const { driver_id, customer_id } = req.query;
        let query = `
            SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address 
            FROM Orders o 
            LEFT JOIN Customers c ON o.customer_id = c.id
            ORDER BY o.created_at DESC`;
        let params: any[] = [];

        if (driver_id) {
            query = `
                SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address 
                FROM Orders o 
                LEFT JOIN Customers c ON o.customer_id = c.id
                WHERE o.driver_id = ? ORDER BY o.created_at DESC`;
            params = [driver_id];
        } else if (customer_id) {
            query = `
                SELECT o.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address 
                FROM Orders o 
                LEFT JOIN Customers c ON o.customer_id = c.id
                WHERE o.customer_id = ? ORDER BY o.created_at DESC`;
            params = [customer_id];
        }
        const [orders]: any = await pool.query(query, params);

        // Fetch Order Items for each order to embed
        for (let order of orders) {
            const [items]: any = await pool.query(`
                SELECT oi.quantity, p.name 
                FROM Order_Items oi 
                JOIN Public_Products p ON oi.product_id = p.product_id
                WHERE oi.order_id = ?`, [order.order_id]);
            order.items = items;
        }

        res.json(orders);
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

// Admin Update Order Status
app.patch('/api/admin/orders/:id/status', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body;

        const [orders]: any = await pool.query(`SELECT driver_id FROM Orders WHERE order_id = ?`, [orderId]);
        const driverId = (orders.length > 0 && orders[0].driver_id) ? orders[0].driver_id : 44;

        await pool.query(`UPDATE Orders SET status = ? WHERE order_id = ?`, [status, orderId]);
        await pool.query(`INSERT INTO Delivery_Logs (order_id, driver_id, status_update) VALUES (?, ?, ?)`, [orderId, driverId, status]);

        res.json({ order_id: orderId, status });
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

// Admin Delete Order
app.delete('/api/admin/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        await pool.query(`DELETE FROM Orders WHERE order_id = ?`, [orderId]);
        res.json({ status: "Deleted" });
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

// GET Drivers
app.get('/api/admin/drivers', async (req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM Drivers ORDER BY driver_id DESC`);
        res.json(rows);
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

// POST Drivers
app.post('/api/admin/drivers', async (req, res) => {
    try {
        const { name, vehicle_info, status } = req.body;
        const [result]: any = await pool.query(`INSERT INTO Drivers (name, vehicle_info, status) VALUES (?, ?, ?)`, [name, vehicle_info, status || 'Active']);
        res.json({ driver_id: result.insertId, status: "Created" });
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

// PUT Drivers
app.put('/api/admin/drivers/:id', async (req, res) => {
    try {
        const { name, vehicle_info, status } = req.body;
        await pool.query(`UPDATE Drivers SET name = ?, vehicle_info = ?, status = ? WHERE driver_id = ?`, [name, vehicle_info, status, req.params.id]);
        res.json({ status: "Updated" });
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

// DELETE Drivers
app.delete('/api/admin/drivers/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM Drivers WHERE driver_id = ?`, [req.params.id]);
        res.json({ status: "Deleted" });
    } catch (e) { res.status(500).json({ error: 'Server Error' }); }
});

app.listen(PORT, () => {
    console.log(`Customer Backend running on http://localhost:${PORT}`);
});
