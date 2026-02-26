CREATE TABLE IF NOT EXISTS Role (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS Permission (
    perm_id INT AUTO_INCREMENT PRIMARY KEY,
    action_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS Employee (
    emp_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role_id INT NOT NULL,
    FOREIGN KEY (role_id) REFERENCES Role(role_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS Role_Permission (
    role_id INT NOT NULL,
    perm_id INT NOT NULL,
    PRIMARY KEY (role_id, perm_id),
    FOREIGN KEY (role_id) REFERENCES Role(role_id) ON DELETE CASCADE,
    FOREIGN KEY (perm_id) REFERENCES Permission(perm_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    measure_unit VARCHAR(100) NOT NULL,
    category VARCHAR(100),
    reorder_threshold INT DEFAULT 0,
    current_stock INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS Suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255),
    phone VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS Supplier_Invoices (
    invoice_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    supplier_invoice_number VARCHAR(100) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    payment_method ENUM('Cash', 'Check') NOT NULL,
    check_number VARCHAR(100),
    check_date DATE,
    check_cleared BOOLEAN NOT NULL DEFAULT FALSE,
    received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    recorded_by_emp_id INT NOT NULL,
    FOREIGN KEY (supplier_id) REFERENCES Suppliers(supplier_id) ON DELETE RESTRICT,
    FOREIGN KEY (recorded_by_emp_id) REFERENCES Employee(emp_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS Inventory_Batches (
    batch_id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    supplier_invoice_id INT NOT NULL,
    batch_number VARCHAR(100) NOT NULL,
    expiry_date DATE NOT NULL,
    location VARCHAR(100),
    purchased_quantity INT NOT NULL,
    bonus_quantity INT NOT NULL DEFAULT 0,
    unit_cost DECIMAL(10,2) NOT NULL,
    current_stock_level INT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE RESTRICT,
    FOREIGN KEY (supplier_invoice_id) REFERENCES Supplier_Invoices(invoice_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Audit_Logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    emp_id INT NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    details TEXT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emp_id) REFERENCES Employee(emp_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS App_Settings (
    setting_key VARCHAR(100) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    description TEXT
);

-- --- Module 1: Sale & Billing (POS) ---

CREATE TABLE IF NOT EXISTS Patients (
    patient_id VARCHAR(36) PRIMARY KEY,
    phone_number_hash VARCHAR(255),
    encrypted_bio_data TEXT,
    encrypted_clinical_notes TEXT,
    birth_year INT,
    opted_out BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Prescriptions (
    prescription_id INT AUTO_INCREMENT PRIMARY KEY,
    patient_id VARCHAR(36),
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
    patient_id VARCHAR(36),
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
