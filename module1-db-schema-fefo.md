# Module 1: POS Database Schema & FEFO Logic

## 1. Raw MySQL `CREATE TABLE` Scripts

```sql
-- Assume Products, Employees, and Inventory_Batches already exist.

CREATE TABLE IF NOT EXISTS Patients (
    patient_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    age INT,
    gender ENUM('Male', 'Female', 'Other'),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Prescriptions (
    prescription_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id INT,
    status ENUM('Pending Verification', 'Verified') NOT NULL DEFAULT 'Pending Verification',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES Patients(patient_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Prescription_lines (
    line_id INT AUTO_INCREMENT PRIMARY KEY,
    prescription_id INT NOT NULL,
    medicine_name_raw VARCHAR(255) NOT NULL,
    frequency VARCHAR(100),
    total_amount INT NOT NULL,
    matched_product_id INT,
    FOREIGN KEY (prescription_id) REFERENCES Prescriptions(prescription_id) ON DELETE CASCADE,
    FOREIGN KEY (matched_product_id) REFERENCES Products(product_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Sales_Invoices (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    is_over_the_counter BOOLEAN NOT NULL DEFAULT TRUE,
    patient_id INT,
    cashier_id INT NOT NULL,
    prescription_id INT,
    payment_method ENUM('Cash', 'Card', 'Pending') NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    money_given DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status ENUM('Draft', 'Completed', 'Voided') NOT NULL DEFAULT 'Draft',
    notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES Patients(patient_id) ON DELETE SET NULL,
    FOREIGN KEY (cashier_id) REFERENCES Employee(emp_id) ON DELETE RESTRICT,
    FOREIGN KEY (prescription_id) REFERENCES Prescriptions(prescription_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS Sale_Items (
    sale_item_id INT AUTO_INCREMENT PRIMARY KEY,
    invoice_id INT NOT NULL,
    batch_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (invoice_id) REFERENCES Sales_Invoices(invoice_id) ON DELETE CASCADE,
    FOREIGN KEY (batch_id) REFERENCES Inventory_Batches(batch_id) ON DELETE RESTRICT
);
```

## 2. Raw SQL FEFO Batch Deduction Logic (Checkout Transaction)

When finalizing a sale `POST /api/pos/checkout`, the system must deduct the requested quantity from available batches, picking the oldest `expiry_date` first (FEFO). Since a single cart item might require multiple batches (e.g., pulling 30 tablets from a batch that only has 10 left, then pulling 20 from the next batch), we use an iterative approach wrapped in a transaction.

### FEFO Transaction Workflow:

1. **`BEGIN`** the transaction.
2. Construct the `Sales_Invoices` Header:
   ```sql
   INSERT INTO Sales_Invoices (is_over_the_counter, patient_id, cashier_id, prescription_id, payment_method, total_amount, money_given, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, 'Completed');
   -- Get the LAST_INSERT_ID()
   ```

3. **Iterate over each Item in the Cart:**
   For a given `product_id` and requested `quantity`:
   
   A. **Lock and FETCH available batches ordered by Expiry Date:**
   ```sql
   SELECT batch_id, current_stock_level, unit_cost
   FROM Inventory_Batches 
   WHERE product_id = ? AND current_stock_level > 0 
   ORDER BY expiry_date ASC 
   FOR UPDATE; 
   -- 'FOR UPDATE' ensures no other cashier modifies these batches mid-transaction.
   ```
   
   B. **Iterate in Node.js over the returned rows:**
   ```javascript
   let remainingQty = requestedQuantity;
   for (const batch of rows) {
       if (remainingQty <= 0) break;
       
       const qtyToDeduct = Math.min(batch.current_stock_level, remainingQty);
       
       // Deduct from the Batch
       await connection.query(
           'UPDATE Inventory_Batches SET current_stock_level = current_stock_level - ? WHERE batch_id = ?',
           [qtyToDeduct, batch.batch_id]
       );
       
       // Record linking the specific batch to the Sale Invoice
       await connection.query(
           'INSERT INTO Sale_Items (invoice_id, batch_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
           [invoiceId, batch.batch_id, qtyToDeduct, sellingPrice]
       );
       
       remainingQty -= qtyToDeduct;
   }
   
   if (remainingQty > 0) {
       // Optional: Throw error. Insufficient stock across all batches!
       throw new Error('Insufficient stock for product id ' + productId);
   }
   ```

4. **`COMMIT`** the transaction. (If any error occurs, `ROLLBACK`).
