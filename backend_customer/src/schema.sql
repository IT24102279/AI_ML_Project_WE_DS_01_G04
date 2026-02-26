CREATE DATABASE IF NOT EXISTS pharmacy_customer_db;
USE pharmacy_customer_db;

CREATE TABLE IF NOT EXISTS Customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    anonymized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Chat_Sessions (
    id VARCHAR(36) PRIMARY KEY,
    customer_id INT NOT NULL,
    status ENUM('Active', 'Resolved') DEFAULT 'Active',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Chat_Messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    sender ENUM('Customer', 'LLM', 'Pharmacist') NOT NULL,
    content TEXT NOT NULL,
    internal_note TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES Chat_Sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Pharmacist_Schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pharmacist_name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    shift_start TIME NOT NULL,
    shift_end TIME NOT NULL
);

CREATE TABLE IF NOT EXISTS Appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    pharmacist_id INT NOT NULL,
    scheduled_time DATETIME NOT NULL,
    symptoms_note TEXT,
    status ENUM('Confirmed', 'Resolved', 'Cancelled') DEFAULT 'Confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customers(id) ON DELETE CASCADE,
    FOREIGN KEY (pharmacist_id) REFERENCES Pharmacist_Schedules(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Public_Products (
    product_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100) NOT NULL,
    image_url TEXT,
    in_stock BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS Shopping_Carts (
    cart_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES Customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Cart_Items (
    cart_item_id INT AUTO_INCREMENT PRIMARY KEY,
    cart_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    FOREIGN KEY (cart_id) REFERENCES Shopping_Carts(cart_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES Public_Products(product_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Orders (
    order_id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    driver_id INT,
    status ENUM('Pending', 'Packing', 'Handed to Driver', 'Delivered') DEFAULT 'Pending',
    total_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES Customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Order_Items (
    order_item_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES Public_Products(product_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Delivery_Logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    driver_id INT NOT NULL,
    status_update VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES Orders(order_id) ON DELETE CASCADE
);
