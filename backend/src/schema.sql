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
    reorder_threshold INT DEFAULT 0
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
