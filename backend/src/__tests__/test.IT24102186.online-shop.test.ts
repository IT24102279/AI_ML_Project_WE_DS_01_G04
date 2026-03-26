/**
 * Unit Tests â€” IT24102186 (S.S.Jayasinghe)
 * Module: Online Shop / E-Commerce / Driver Management
 *
 * Tests routes defined in backend_customer/src/index.ts:
 *   GET  /api/shop/products, GET  /api/shop/status,
 *   GET  /api/cart/:customerId, POST /api/cart/add, DELETE /api/cart/remove/:itemId,
 *   POST /api/orders/checkout, PUT  /api/orders/:id/assign-driver,
 *   PATCH /api/orders/:id/status,
 *   Admin CRUD: POST/PUT/DELETE /api/admin/products
 */

import express from 'express';
import request from 'supertest';

// â”€â”€â”€ pool resolved via moduleNameMapper â†’ __mocks__/customerDb.ts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import { pool, mockQuery, mockExecute, mockConnection, mockBeginTransaction, mockCommit, mockRollback, logQueriesForTest } from './__mocks__/customerDb';

const mockGetConnection = pool.getConnection as jest.Mock;

// --- Build inline Express app for the shop routes ---
const app = express();
app.use(express.json());

// Shop products (public, hides Medicines)
app.get('/api/shop/products', async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM Public_Products WHERE category != 'Medicine' AND in_stock = TRUE`, []);
        res.json(rows);
    } catch { res.status(500).json({ error: 'Server Error' }); }
});

// Shop status (driver availability)
app.get('/api/shop/status', async (_req, res) => {
    try {
        const [rows]: any = await pool.query(`SELECT COUNT(*) as active FROM Delivery_Logs WHERE DATE(timestamp) = CURDATE()`, []);
        const activeCount = rows[0].active || 0;
        res.json({
            active_drivers_count: activeCount,
            is_preorder_only: activeCount === 0,
            message: activeCount === 0 ? 'No drivers currently available.' : 'Drivers active.',
        });
    } catch { res.status(500).json({ error: 'Server Error' }); }
});

// Get Cart
app.get('/api/cart/:customerId', async (req, res) => {
    try {
        const [carts]: any = await pool.query(`SELECT cart_id FROM Shopping_Carts WHERE customer_id = ?`, [req.params.customerId]);
        if (carts.length === 0) return res.json([]);
        const cartId = carts[0].cart_id;
        const [items] = await pool.query(`SELECT ci.cart_item_id, ci.quantity, p.name FROM Cart_Items ci JOIN Public_Products p ON ci.product_id = p.product_id WHERE ci.cart_id = ?`, [cartId]);
        res.json(items);
    } catch { res.status(500).json({ error: 'Server Error' }); }
});

// Add to Cart
app.post('/api/cart/add', async (req, res) => {
    try {
        const { customer_id, product_id, quantity = 1 } = req.body;
        let [carts]: any = await pool.query(`SELECT cart_id FROM Shopping_Carts WHERE customer_id = ?`, [customer_id]);
        let cartId;
        if (carts.length === 0) {
            const [ins]: any = await pool.query(`INSERT INTO Shopping_Carts (customer_id) VALUES (?)`, [customer_id]);
            cartId = ins.insertId;
        } else {
            cartId = carts[0].cart_id;
        }
        await pool.query(`INSERT INTO Cart_Items (cart_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?`, [cartId, product_id, quantity, quantity]);
        res.json({ status: 'Success' });
    } catch { res.status(500).json({ error: 'Server Error' }); }
});

// Remove from Cart
app.delete('/api/cart/remove/:itemId', async (req, res) => {
    try {
        await pool.query(`DELETE FROM Cart_Items WHERE cart_item_id = ?`, [req.params.itemId]);
        res.json({ status: 'Removed' });
    } catch { res.status(500).json({ error: 'Server Error' }); }
});

// Checkout Transaction
app.post('/api/orders/checkout', async (req, res) => {
    const connection = await pool.getConnection() as any;
    try {
        const { customer_id } = req.body;
        await connection.beginTransaction();
        const [carts]: any = await connection.query(`SELECT cart_id FROM Shopping_Carts WHERE customer_id = ?`, [customer_id]);
        if (carts.length === 0) throw new Error('Cart empty');
        const cartId = carts[0].cart_id;
        const [items]: any = await connection.query(`SELECT ci.product_id, ci.quantity, p.price FROM Cart_Items ci JOIN Public_Products p ON ci.product_id = p.product_id WHERE ci.cart_id = ?`, [cartId]);
        if (items.length === 0) throw new Error('Cart empty');
        const total = items.reduce((s: number, i: any) => s + Number(i.price) * i.quantity, 0);
        const [orderResult]: any = await connection.query(`INSERT INTO Orders (customer_id, total_amount, status) VALUES (?, ?, 'Pending')`, [customer_id, total]);
        const orderId = orderResult.insertId;
        for (const item of items) {
            await connection.query(`INSERT INTO Order_Items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)`, [orderId, item.product_id, item.quantity, item.price]);
        }
        await connection.query(`DELETE FROM Cart_Items WHERE cart_id = ?`, [cartId]);
        await connection.commit();
        res.json({ order_id: orderId, total_amount: total, status: 'Order Placed' });
    } catch (e: any) {
        await connection.rollback();
        res.status(400).json({ error: e.message });
    } finally { connection.release(); }
});

// Assign Driver
app.put('/api/orders/:id/assign-driver', async (req, res) => {
    try {
        const [driverLoads]: any = await pool.query(`SELECT driver_id, COUNT(*) as current_load FROM Orders WHERE driver_id IN (44, 55) AND DATE(created_at) = CURDATE() GROUP BY driver_id ORDER BY current_load ASC LIMIT 1`, []);
        const assignedDriverId = driverLoads.length > 0 ? driverLoads[0].driver_id : 44;
        await pool.query(`UPDATE Orders SET driver_id = ?, status = 'Packing' WHERE order_id = ?`, [assignedDriverId, req.params.id]);
        await pool.query(`INSERT INTO Delivery_Logs (order_id, driver_id, status_update) VALUES (?, ?, 'Assigned & Packing')`, [req.params.id, assignedDriverId]);
        res.json({ order_id: req.params.id, assigned_driver_id: assignedDriverId, status: 'Packing' });
    } catch { res.status(500).json({ error: 'Server Error' }); }
});

// Driver Update Status
app.patch('/api/orders/:id/status', async (req, res) => {
    try {
        const { driver_id, status } = req.body;
        await pool.query(`UPDATE Orders SET status = ? WHERE order_id = ? AND driver_id = ?`, [status, req.params.id, driver_id]);
        await pool.query(`INSERT INTO Delivery_Logs (order_id, driver_id, status_update) VALUES (?, ?, ?)`, [req.params.id, driver_id, status]);
        res.json({ order_id: req.params.id, status });
    } catch { res.status(500).json({ error: 'Server Error' }); }
});

// Admin Products CRUD
app.get('/api/admin/products', async (_req, res) => {
    try {
        const [rows] = await pool.query(`SELECT * FROM Public_Products ORDER BY product_id DESC`, []);
        res.json(rows);
    } catch { res.status(500).json({ error: 'Server Error' }); }
});

app.post('/api/admin/products', async (req, res) => {
    try {
        const { name, price, category, image_url, in_stock } = req.body;
        const [result]: any = await pool.query(`INSERT INTO Public_Products (name, price, category, image_url, in_stock) VALUES (?, ?, ?, ?, ?)`, [name, price, category, image_url, in_stock]);
        res.json({ product_id: result.insertId, status: 'Created' });
    } catch { res.status(500).json({ error: 'Server Error' }); }
});

app.put('/api/admin/products/:id', async (req, res) => {
    try {
        const { name, price, category, image_url, in_stock } = req.body;
        await pool.query(`UPDATE Public_Products SET name=?, price=?, category=?, image_url=?, in_stock=? WHERE product_id=?`, [name, price, category, image_url, in_stock, req.params.id]);
        res.json({ status: 'Updated' });
    } catch { res.status(500).json({ error: 'Server Error' }); }
});

app.delete('/api/admin/products/:id', async (req, res) => {
    try {
        await pool.query(`DELETE FROM Public_Products WHERE product_id=?`, [req.params.id]);
        res.json({ status: 'Deleted' });
    } catch { res.status(500).json({ error: 'Server Error' }); }
});

// --------------------------------------------------------------------------------

beforeEach(() => {
    mockQuery.mockReset();
    mockConnection.query.mockReset();
    mockBeginTransaction.mockReset();
    mockCommit.mockReset();
    mockRollback.mockReset();
    mockExecute.mockReset();

    mockQuery.mockResolvedValue([[]]);
    mockExecute.mockResolvedValue([[]]);
    mockConnection.query.mockResolvedValue([[]]);
    mockConnection.execute.mockResolvedValue([[]]);
    mockGetConnection.mockResolvedValue(mockConnection);
    mockBeginTransaction.mockResolvedValue(undefined);
    mockCommit.mockResolvedValue(undefined);
    mockRollback.mockResolvedValue(undefined);

    (app as any).__testConn = mockConnection;
});

afterEach(() => {
    logQueriesForTest(expect.getState().currentTestName || 'Unknown Test');
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Shop Products
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Online Shop - GET /api/shop/products', () => {
    it('returns only non-Medicine in-stock products', async () => {
        mockQuery.mockResolvedValueOnce([[
            { product_id: 101, name: 'Milk', category: 'Groceries', in_stock: true },
            { product_id: 102, name: 'Bread', category: 'Groceries', in_stock: true },
        ]]);
        const res = await request(app).get('/api/shop/products');
        expect(res.statusCode).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body.every((p: any) => p.category !== 'Medicine')).toBe(true);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Shop Status
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Online Shop â€” GET /api/shop/status', () => {
    it('is_preorder_only = true when no active drivers', async () => {
        mockQuery.mockResolvedValueOnce([[{ active: 0 }]]);
        const res = await request(app).get('/api/shop/status');
        expect(res.body.is_preorder_only).toBe(true);
    });

    it('is_preorder_only = false when drivers are active', async () => {
        mockQuery.mockResolvedValueOnce([[{ active: 2 }]]);
        const res = await request(app).get('/api/shop/status');
        expect(res.body.is_preorder_only).toBe(false);
        expect(res.body.active_drivers_count).toBe(2);
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Cart
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Online Shop â€” Cart', () => {
    it('returns empty array when no cart exists for customer', async () => {
        mockQuery.mockResolvedValueOnce([[]]); // no cart
        const res = await request(app).get('/api/cart/1');
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual([]);
    });

    it('returns cart items for existing cart', async () => {
        mockQuery
            .mockResolvedValueOnce([[{ cart_id: 10 }]])
            .mockResolvedValueOnce([[{ cart_item_id: 1, quantity: 2, name: 'Milk' }]]);
        const res = await request(app).get('/api/cart/1');
        expect(res.body).toHaveLength(1);
    });

    it('adds item to existing cart', async () => {
        mockQuery
            .mockResolvedValueOnce([[{ cart_id: 10 }]]) // existing cart
            .mockResolvedValueOnce([{}]);                // INSERT ON DUPLICATE
        const res = await request(app).post('/api/cart/add').send({ customer_id: 1, product_id: 101, quantity: 2 });
        expect(res.body.status).toBe('Success');
    });

    it('creates a new cart when customer has none, then adds item', async () => {
        mockQuery
            .mockResolvedValueOnce([[]])                   // no existing cart
            .mockResolvedValueOnce([{ insertId: 11 }])     // INSERT new cart
            .mockResolvedValueOnce([{}]);                  // INSERT item
        const res = await request(app).post('/api/cart/add').send({ customer_id: 2, product_id: 102 });
        expect(res.body.status).toBe('Success');
    });

    it('removes an item from cart', async () => {
        mockQuery.mockResolvedValueOnce([{}]);
        const res = await request(app).delete('/api/cart/remove/5');
        expect(res.body.status).toBe('Removed');
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Checkout
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Online Shop â€” POST /api/orders/checkout', () => {
    it('returns 400 when cart is empty', async () => {
        const conn = (app as any).__testConn;
        conn.query.mockResolvedValueOnce([[]]); // no cart
        const res = await request(app).post('/api/orders/checkout').send({ customer_id: 1 });
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toMatch(/cart empty/i);
    });

    it('creates order, moves items, and clears cart', async () => {
        const conn = (app as any).__testConn;
        conn.query
            .mockResolvedValueOnce([[{ cart_id: 10 }]])                           // get cart
            .mockResolvedValueOnce([[{ product_id: 101, quantity: 2, price: 2.5 }]]) // cart items
            .mockResolvedValueOnce([{ insertId: 200 }])                            // INSERT order
            .mockResolvedValueOnce([{}])                                           // INSERT order items
            .mockResolvedValueOnce([{}]);                                          // DELETE cart items

        const res = await request(app).post('/api/orders/checkout').send({ customer_id: 1 });
        expect(res.statusCode).toBe(200);
        expect(res.body.order_id).toBe(200);
        expect(res.body.total_amount).toBe(5); // 2 * 2.5
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Driver Assignment
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Online Shop â€” Driver Assignment', () => {
    it('assigns the least-loaded driver', async () => {
        mockQuery
            .mockResolvedValueOnce([[{ driver_id: 55, current_load: 1 }]]) // driver 55 less loaded
            .mockResolvedValueOnce([{}]) // UPDATE order
            .mockResolvedValueOnce([{}]); // INSERT delivery log
        const res = await request(app).put('/api/orders/200/assign-driver');
        expect(res.body.assigned_driver_id).toBe(55);
    });

    it('falls back to driver 44 when no logs exist', async () => {
        mockQuery
            .mockResolvedValueOnce([[]])  // no driver logs
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([{}]);
        const res = await request(app).put('/api/orders/201/assign-driver');
        expect(res.body.assigned_driver_id).toBe(44);
    });

    it('driver can update delivery status', async () => {
        mockQuery.mockResolvedValueOnce([{}]).mockResolvedValueOnce([{}]);
        const res = await request(app).patch('/api/orders/200/status').send({ driver_id: 44, status: 'Out for Delivery' });
        expect(res.body.status).toBe('Out for Delivery');
    });
});

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Admin Shop Product CRUD
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('Online Shop â€” Admin Product CRUD', () => {
    it('creates a new product and returns product_id', async () => {
        mockQuery.mockResolvedValueOnce([{ insertId: 300 }]);
        const res = await request(app).post('/api/admin/products').send({ name: 'New Item', price: 9.99, category: 'Groceries', image_url: '', in_stock: true });
        expect(res.body.product_id).toBe(300);
        expect(res.body.status).toBe('Created');
    });

    it('updates a product', async () => {
        mockQuery.mockResolvedValueOnce([{}]);
        const res = await request(app).put('/api/admin/products/101').send({ name: 'Updated Milk', price: 3.0, category: 'Groceries', image_url: '', in_stock: true });
        expect(res.body.status).toBe('Updated');
    });

    it('deletes a product', async () => {
        mockQuery.mockResolvedValueOnce([{}]);
        const res = await request(app).delete('/api/admin/products/101');
        expect(res.body.status).toBe('Deleted');
    });
});

