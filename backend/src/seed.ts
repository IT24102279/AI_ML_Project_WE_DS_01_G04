import fs from 'fs';
import path from 'path';
import pool from './db';
import bcrypt from 'bcrypt';
import { RowDataPacket } from 'mysql2';

async function runSeed() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    const statements = schemaSql.split(';').filter(stmt => stmt.trim() !== '');

    console.log("Creating database schema...");
    for (const stmt of statements) {
        await pool.query(stmt);
    }

    console.log("Ensuring Employee table has salary columns...");
    // Check information_schema for existing columns before altering to avoid duplicate-column errors
    async function ensureColumn(table: string, column: string, ddl: string) {
        const [rows] = await pool.query<RowDataPacket[]>(
            'SELECT COUNT(*) as cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
            [table, column]
        );
        const cnt = (rows && (rows as any)[0] && (rows as any)[0].cnt) ? Number((rows as any)[0].cnt) : 0;
        if (cnt === 0) {
            await pool.query(ddl);
        }
    }

    await ensureColumn('Employee', 'base_salary', 'ALTER TABLE Employee ADD COLUMN base_salary DECIMAL(10,2) DEFAULT 0.00');
    await ensureColumn('Employee', 'hourly_rate', 'ALTER TABLE Employee ADD COLUMN hourly_rate DECIMAL(10,2) DEFAULT NULL');
    await ensureColumn('Employee', 'standard_deductions', 'ALTER TABLE Employee ADD COLUMN standard_deductions DECIMAL(10,2) DEFAULT 0.00');
    await ensureColumn('Products', 'selling_price', 'ALTER TABLE Products ADD COLUMN selling_price DECIMAL(10,2) DEFAULT 0.00');
    await ensureColumn('Sale_Items', 'item_type', "ALTER TABLE Sale_Items ADD COLUMN item_type ENUM('rx', 'otc') DEFAULT 'otc'");
    await ensureColumn('Sale_Items', 'frequency', "ALTER TABLE Sale_Items ADD COLUMN frequency VARCHAR(100)");
    await ensureColumn('Sale_Items', 'product_id', "ALTER TABLE Sale_Items ADD COLUMN product_id INT");
    await ensureColumn('Sale_Items', 'medicine_name_raw', "ALTER TABLE Sale_Items ADD COLUMN medicine_name_raw VARCHAR(255)");
    // Ensure product_id has foreign key if we just added it
    try {
        await pool.query('ALTER TABLE Sale_Items ADD FOREIGN KEY (product_id) REFERENCES Products(product_id) ON DELETE SET NULL');
    } catch (e) {}
    // Ensure batch_id is nullable
    try {
        await pool.query('ALTER TABLE Sale_Items MODIFY COLUMN batch_id INT NULL');
    } catch (e) {}

    console.log("Seeding Permissions...");
    const permissionsData = [
        ['VIEW_DASHBOARD', 'Can access main dashboard'],
        ['VIEW_TAB_INVENTORY', 'Can access Inventory & Products tab'],
        ['VIEW_TAB_SUPPLIERS', 'Can access Suppliers tab'],
        ['VIEW_TAB_GRN', 'Can access Receive Stock (GRN) tab'],
        ['VIEW_TAB_FINANCE', 'Can access checks and finance tab'],
        ['VIEW_TAB_POS', 'Can access Point of Sale (POS) tab'],
        ['CREATE_SALE', 'Can process a POS transaction'],
        ['CREATE_PRESCRIPTION', 'Can process a prescription from AI'],
        ['VOID_SALE', 'Can cancel a POS transaction'],
        ['MANAGE_ROLES', 'Can modify user roles and permissions'],
        ['ASSIGN_DRIVER', 'Can assign delivery orders to drivers'],
        ['ADJUST_INVENTORY', 'Can modify stock counts'],
        ['MANAGE_PATIENTS', 'Can manage patient records and profiles'],
        ['MANAGE_FINANCE', 'Can manage operating expenses'],
        ['MANAGE_PAYROLL', 'Can manage employee payroll and salaries'],
        ['MANAGE_AUDIT', 'Can manage and delete system audit logs'],
        ['EDIT_PAST_SALES', 'Can edit and delete past sales']
    ];

    for (const [action, desc] of permissionsData) {
        await pool.query('INSERT IGNORE INTO Permission (action_name, description) VALUES (?, ?)', [action, desc]);
    }

    console.log("Seeding Roles...");
    const rolesData = [
        ['Admin', 'System Administrator'],
        ['Head Pharmacist', 'Lead pharmacist and manager'],
        ['Assistant Pharmacist', 'Assists with pharmacy duties'],
        ['Cashier', 'Frontend point of sale user'],
        ['Online Shop Manager', 'Manages e-commerce orders'],
        ['Delivery Guy', 'Handles order deliveries']
    ];

    for (const [name, desc] of rolesData) {
        await pool.query('INSERT IGNORE INTO Role (role_name, description) VALUES (?, ?)', [name, desc]);
    }

    const [adminRows] = await pool.query<RowDataPacket[]>('SELECT role_id FROM Role WHERE role_name = "Admin"');
    if (adminRows.length > 0) {
        const adminId = adminRows[0].role_id;
        const [allPerms] = await pool.query<RowDataPacket[]>('SELECT perm_id FROM Permission');

        console.log("Assigning all permissions to Admin...");
        for (const perm of allPerms) {
            await pool.query('INSERT IGNORE INTO Role_Permission (role_id, perm_id) VALUES (?, ?)', [adminId, perm.perm_id]);
        }

        console.log("Creating default Admin user...");
        const password_hash = await bcrypt.hash('Admin@123', 10);
        await pool.query(
            'INSERT IGNORE INTO Employee (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)',
            ['System Admin', 'admin@pharmacy.com', password_hash, adminId]
        );
    }

    console.log("Seeding App Settings...");
    await pool.query(
        'INSERT IGNORE INTO App_Settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
        ['currency', 'LKR', 'Base currency symbol for the application']
    );
}

runSeed()
    .then(() => {
        console.log("Seeding completed successfully.");
        process.exit(0);
    })
    .catch((err) => {
        console.error("Seeding failed: ", err);
        process.exit(1);
    });
