# Module 1: Sale and Billing Management (POS) API Documentation

## 1. Process AI Prescription Extraction (Real-Time WebHook)
* **Endpoint URL & Method:** `POST /api/pos/process-prescription`
* **Description:** Receives extracted prescription data from the AI microservice, saves it into `Prescriptions` and `Prescription_lines` with a 'Pending Verification' status, and emits a `new_ai_scan_received` Socket.io event to connected clients.
* **Required Permission:** `CREATE_PRESCRIPTION` (or internal microservice auth)
* **Request Payload (JSON):**
```json
{
  "patient_id": 1,
  "extracted_lines": [
    {
      "medicine_name_raw": "Curam 625mg",
      "frequency": "BID",
      "total_amount": 10
    }
  ]
}
```
* **Response Payload (JSON):**
```json
{
  "message": "Prescription processed and broadcasted successfully",
  "prescription_id": 105
}
```

## 2. Save Draft Sale
* **Endpoint URL & Method:** `POST /api/pos/draft`
* **Description:** Saves the current cart to `Sales_Invoices` with status `Draft`. Does NOT deduct stock from inventory. Useful if a customer forgets their wallet and the cashier needs to hold the transaction.
* **Required Permission:** `CREATE_SALE`
* **Request Payload (JSON):**
```json
{
  "is_over_the_counter": true,
  "patient_id": null,
  "prescription_id": null,
  "payment_method": "Cash",
  "total_amount": 1500.50,
  "money_given": 0,
  "notes": "Customer went to ATM",
  "items": [
    {
      "product_id": 10,
      "quantity": 2,
      "unit_price": 750.25
    }
  ]
}
```
* **Response Payload (JSON):**
```json
{
  "message": "Draft saved successfully",
  "invoice_id": 204
}
```

## 3. Confirm Checkout (FEFO Transaction)
* **Endpoint URL & Method:** `POST /api/pos/checkout`
* **Description:** Finalizes a sale. Executes a raw SQL transaction to insert the invoice and deduct stock from `Inventory_Batches` using First-Expired-First-Out (FEFO) logic.
* **Required Permission:** `CREATE_SALE`
* **Request Payload (JSON):**
```json
{
  "is_over_the_counter": true,
  "patient_id": null,
  "prescription_id": null,
  "payment_method": "Cash",
  "total_amount": 1500.50,
  "money_given": 2000.00,
  "notes": "",
  "items": [
    {
      "product_id": 5,
      "quantity": 2,
      "unit_price": 750.25
    }
  ]
}
```
* **Response Payload (JSON):**
```json
{
  "message": "Checkout completed successfully",
  "invoice_id": 205,
  "change_due": 499.50
}
```

## 4. Live Product Search
* **Endpoint URL & Method:** `GET /api/pos/search?q=query`
* **Description:** Searches the `Products` table by name and aggregates available stock from `Inventory_Batches`. Used for the manual POS autocomplete bar and mapping AI raw text to actual inventory.
* **Required Permission:** `VIEW_TAB_POS`
* **Request Payload (JSON):** `None` (Query Parameter `q`)
* **Response Payload (JSON):**
```json
[
  {
    "product_id": 5,
    "name": "Curam 625mg",
    "measure_unit": "Tablet",
    "total_stock": 150,
    "selling_price": 750.25,
    "batches": [
      {
        "batch_id": 10,
        "batch_number": "B001",
        "expiry_date": "2024-12-31",
        "current_stock_level": 50
      },
      {
        "batch_id": 12,
        "batch_number": "B002",
        "expiry_date": "2025-06-30",
        "current_stock_level": 100
      }
    ]
  }
]
```

## 5. Get Sales & Drafts History
* **Endpoint URL & Method:** `GET /api/pos/history`
* **Description:** Retrieves the latest 100 sales invoices, including both Completed sales and Drafts. Used for displaying the history tab in the Point of Sale module.
* **Required Permission:** `VIEW_TAB_POS`
* **Request Payload:** None
* **Response Payload (JSON):**
```json
[
  {
    "invoice_id": 204,
    "total_amount": "1500.50",
    "created_at": "2024-03-05T08:30:00.000Z",
    "payment_method": "Pending",
    "status": "Draft",
    "cashier_name": "John Doe"
  }
]
```

## 6. View Invoice Details
* **Endpoint URL & Method:** `GET /api/pos/invoice/:id`
* **Description:** Retrieves detailed information for a specific invoice, including all line items and their corresponding product names. Used when viewing a specific sale in the history tab or loading a Draft into the cart.
* **Required Permission:** `VIEW_TAB_POS`
* **Request Payload:** None (Invoice ID in URL parameter `id`)
* **Response Payload (JSON):**
```json
{
  "invoice_id": 204,
  "total_amount": "1500.50",
  "money_given": "0.00",
  "received_at": "2024-03-05T08:30:00.000Z",
  "payment_method": "Pending",
  "status": "Draft",
  "cashier_name": "John Doe",
  "patient_id": null,
  "items": [
    {
      "sale_item_id": 35,
      "quantity": 2,
      "unit_price": "750.25",
      "product_name": "Curam 625mg",
      "product_id": 5
    }
  ]
}
```

## 7. Delete / Void Sale Invoice
* **Endpoint URL & Method:** `DELETE /api/pos/invoice/:id`
* **Description:** Deletes a draft entirely or voids a completed sale by restoring the deducted stock back into `Inventory_Batches` and `Products`. Logs the activity to `Audit_Logs`. Requires an explicitly assigned permission for Sales Editing.
* **Required Permission:** `EDIT_PAST_SALES`
* **Request Payload:** None (Invoice ID in URL parameter `id`)
* **Response Payload (JSON):**
```json
{
  "message": "Invoice deleted successfully"
}
```
