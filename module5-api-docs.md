# Module 5: Online Shop & Delivery Management
**API Documentation for Groceries & E-commerce Operations**

## Overview
This module extends the isolated Customer Service backend (Port 4000) allowing customers to browse non-medicinal inventory (Groceries), assemble shopping carts, and checkout. Staff and Drivers can handle the logistical delivery assignments in real-time.

---

## 1. Shop & Inventory APIs

### GET `/api/shop/products`
**Description:** Retrieves all available products explicitly filtered by `category != 'Medicine'`.
**Required Permission:** None (Public)

**Response Payload (JSON):**
```json
[
  {
    "product_id": 101,
    "name": "Organic Milk 1L",
    "price": 2.50,
    "category": "Groceries",
    "image_url": "/product-images/milk.png",
    "in_stock": true
  }
]
```

### GET `/api/shop/status`
**Description:** Dynamically queries available delivery drivers. If no drivers are currently active or logged in, flags the shop for Pre-Order mode.
**Required Permission:** None (Public)

**Response Payload (JSON):**
```json
{
  "active_drivers_count": 0,
  "is_preorder_only": true,
  "message": "No drivers currently available. Orders placed now will be scheduled for later delivery."
}
```

---

## 2. Shopping Cart APIs

### POST `/api/cart/add`
**Description:** Adds a product to a customer's active shopping cart session.
**Required Permission:** None (Implicit Customer bounds)

**Request Payload (JSON):**
```json
{
  "customer_id": 1,
  "product_id": 101,
  "quantity": 2
}
```

**Response Payload (JSON):**
```json
{
  "cart_item_id": 15,
  "status": "Item added to cart successfully."
}
```

### DELETE `/api/cart/remove/:cart_item_id`
**Description:** Removes a specific item from the shopping cart.
**Required Permission:** None 

**Response Payload (JSON):**
```json
{
  "status": "Item removed from cart."
}
```

---

## 3. Checkout & Order Completion

### POST `/api/orders/checkout`
**Description:** Converts all items in the customer's cart into a confirmed `Order` via a MySQL Transaction. Clears the cart upon successful commit.
**Required Permission:** None

**Request Payload (JSON):**
```json
{
  "customer_id": 1
}
```

**Response Payload (JSON):**
```json
{
  "order_id": 505,
  "total_amount": 5.00,
  "status": "Order Placed. Awaiting Logistics."
}
```

---

## 4. Admin & Logistics Routing

### GET `/api/orders`
**Description:** Retrieves a list of all current customer orders, filtering active and pending loads for the Staff Dashboard.
**Required Permission:** Admin (Staff Route)

**Response Payload (JSON):**
```json
[
  {
    "order_id": 505,
    "customer_id": 1,
    "driver_id": null,
    "status": "Pending",
    "total_amount": 5.00,
    "created_at": "2026-02-27T10:00:00Z"
  }
]
```

### PUT `/api/orders/:id/assign-driver`
**Description:** Smart Assign endpoint. Executes an algorithmic SQL `GROUP BY` identifying the driver with the absolute lowest count of deliveries assigned for the day, balancing the workload.
**Required Permission:** Admin (Staff Route)

**Response Payload (JSON):**
```json
{
  "order_id": 505,
  "assigned_driver_id": 4,
  "driver_name": "Delivery Guy Bob",
  "status": "Packing"
}
```

---

## 5. Driver Mobile APIs

### PATCH `/api/orders/:id/status`
**Description:** Mutates the state of an order through logistical phases ("Handed to Driver", "Delivered"). Inserts a timestamped event into `Delivery_Logs`.
**Required Permission:** Driver bounds

**Request Payload (JSON):**
```json
{
  "driver_id": 4,
  "status": "Delivered"
}
```

**Response Payload (JSON):**
```json
{
  "log_id": 89,
  "order_id": 505,
  "status": "Delivered",
  "logged_at": "2026-02-27T10:45:00Z"
}
```
