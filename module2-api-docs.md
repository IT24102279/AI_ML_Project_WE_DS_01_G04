INVENTORY_FINANCE_RAW_ACCEPTED

# Module 2: Inventory Management & Supplier Finance API

## 1. Products

### Get All Products
* **Endpoint:** `GET /api/products`
* **Description:** Retrieves all products.
* **Required Permission:** `VIEW_TAB_INVENTORY`
* **Request Payload:** None
* **Response Payload (JSON):**
```json
[
  {
    "product_id": 1,
    "name": "Paracetamol 500mg",
    "measure_unit": "Tablets",
    "category": "Painkiller",
    "reorder_threshold": 100
  }
]
```

### Search Products (Live Search Autocomplete)
* **Endpoint:** `GET /api/products/search?q={query}`
* **Description:** Returns matching products based on a partial query against product name.
* **Required Permission:** `VIEW_TAB_GRN` (or `VIEW_TAB_INVENTORY`)
* **Request Payload:** None
* **Response Payload (JSON):**
```json
[
  { "product_id": 1, "name": "Paracetamol 500mg", "measure_unit": "Tablets" }
]
```

### Create Product
* **Endpoint:** `POST /api/products`
* **Description:** Creates a new product.
* **Required Permission:** `VIEW_TAB_INVENTORY`
* **Request Payload (JSON):**
```json
{
  "name": "Amoxicillin 250mg",
  "measure_unit": "Capsules",
  "category": "Antibiotic",
  "reorder_threshold": 50
}
```
* **Response Payload (JSON):**
```json
{ "message": "Product created successfully", "product_id": 2 }
```

### Update Product
* **Endpoint:** `PUT /api/products/:id`
* **Description:** Updates an existing product.
* **Required Permission:** `VIEW_TAB_INVENTORY`
* **Request Payload (JSON):**
```json
{
  "name": "Amoxicillin 500mg",
  "measure_unit": "Capsules",
  "category": "Antibiotic",
  "reorder_threshold": 100
}
```
* **Response Payload (JSON):**
```json
{ "message": "Product updated successfully" }
```

### Delete Product
* **Endpoint:** `DELETE /api/products/:id`
* **Description:** Deletes a product.
* **Required Permission:** `VIEW_TAB_INVENTORY`
* **Request Payload:** None
* **Response Payload (JSON):**
```json
{ "message": "Product deleted successfully" }
```

---

## 2. Suppliers

### List Suppliers
* **Endpoint:** `GET /api/suppliers`
* **Description:** Retrieves all suppliers.
* **Required Permission:** `VIEW_TAB_SUPPLIERS`
* **Request Payload:** None
* **Response Payload (JSON):**
```json
[
  {
    "supplier_id": 1,
    "name": "PharmaCorp",
    "contact_email": "sales@pharmacorp.com",
    "phone": "123-456-7890"
  }
]
```

### Create Supplier
* **Endpoint:** `POST /api/suppliers`
* **Description:** Creates a new supplier.
* **Required Permission:** `VIEW_TAB_SUPPLIERS`
* **Request Payload (JSON):**
```json
{
  "name": "MediSupply Inc.",
  "contact_email": "contact@medisupply.com",
  "phone": "987-654-3210"
}
```
* **Response Payload (JSON):**
```json
{ "message": "Supplier created successfully", "supplier_id": 2 }
```

### Update Supplier
* **Endpoint:** `PUT /api/suppliers/:id`
* **Description:** Updates an existing supplier.
* **Required Permission:** `VIEW_TAB_SUPPLIERS`
* **Request Payload (JSON):**
```json
{
  "name": "MediSupply Global",
  "contact_email": "info@medisupply.com",
  "phone": "987-654-3210"
}
```
* **Response Payload (JSON):**
```json
{ "message": "Supplier updated successfully" }
```

### Delete Supplier
* **Endpoint:** `DELETE /api/suppliers/:id`
* **Description:** Deletes a supplier.
* **Required Permission:** `VIEW_TAB_SUPPLIERS`
* **Request Payload:** None
* **Response Payload (JSON):**
```json
{ "message": "Supplier deleted successfully" }
```

---

## 3. Receive Stock (GRN)

### Receive Stock Transaction
* **Endpoint:** `POST /api/inventory/receive`
* **Description:** Processes a Goods Receipt Note. Calculates total invoice amount dynamically based on `purchased_quantity * unit_cost`. Creates `Supplier_Invoice`, `Inventory_Batches`, and an `Audit_Log` in a single SQL transaction.
* **Required Permission:** `VIEW_TAB_GRN`
* **Request Payload (JSON):**
```json
{
  "supplier_id": 1,
  "supplier_invoice_number": "INV-2023-001",
  "payment_method": "Check",
  "check_number": "CHK-999888",
  "check_date": "2024-05-01",
  "batches": [
    {
      "product_id": 1,
      "batch_number": "B-1001",
      "expiry_date": "2025-12-31",
      "location": "A1-Shelf",
      "purchased_quantity": 100,
      "bonus_quantity": 10,
      "unit_cost": 5.50
    }
  ]
}
```
*Note: `check_number` and `check_date` are only required if `payment_method` is `"Check"`.*
* **Response Payload (JSON):**
```json
{
  "message": "Stock received successfully",
  "invoice_id": 1,
  "total_amount": 550.00
}
```

---

## 4. Finance (Checks)

### Pending Checks
* **Endpoint:** `GET /api/finance/pending-checks`
* **Description:** Fetches supplier invoices where `payment_method = 'Check'` and `check_cleared = false`, ordered by `check_date` ascending.
* **Required Permission:** `VIEW_TAB_FINANCE`
* **Request Payload:** None
* **Response Payload (JSON):**
```json
[
  {
    "invoice_id": 1,
    "supplier_id": 1,
    "supplier_name": "PharmaCorp",
    "supplier_invoice_number": "INV-2023-001",
    "total_amount": 550.00,
    "check_number": "CHK-999888",
    "check_date": "2024-05-01T00:00:00.000Z",
    "check_cleared": false,
    "received_at": "2023-10-25T10:00:00.000Z"
  }
]
```

### Clear Check
* **Endpoint:** `PATCH /api/finance/checks/:id/clear`
* **Description:** Updates `check_cleared` to true for a specific supplier invoice. Logs the action.
* **Required Permission:** `VIEW_TAB_FINANCE`
* **Request Payload:** None
* **Response Payload (JSON):**
```json
{ "message": "Check cleared successfully" }
```

---

## 5. Alerts

### Get Inventory Alerts
* **Endpoint:** `GET /api/inventory/alerts`
* **Description:** Returns batches with low stock (current stock <= product's reorder threshold) or near expiry (expiring in < 30 days).
* **Required Permission:** `VIEW_TAB_INVENTORY`
* **Request Payload:** None
* **Response Payload (JSON):**
```json
{
  "lowStock": [
    {
      "product_id": 1,
      "name": "Paracetamol 500mg",
      "current_stock_level": 20,
      "reorder_threshold": 100
    }
  ],
  "nearExpiry": [
    {
      "batch_id": 5,
      "product_id": 1,
      "name": "Paracetamol 500mg",
      "batch_number": "B-900",
      "expiry_date": "2023-11-15T00:00:00.000Z",
      "current_stock_level": 50
    }
  ]
}
```
