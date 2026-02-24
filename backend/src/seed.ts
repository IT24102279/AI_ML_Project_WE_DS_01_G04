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

    console.log("Seeding Permissions...");
    const permissionsData = [
        ['VIEW_DASHBOARD', 'Can access main dashboard'],
        ['CREATE_SALE', 'Can process a POS transaction'],
        ['VOID_SALE', 'Can cancel a POS transaction'],
        ['MANAGE_ROLES', 'Can modify user roles and permissions'],
        ['ASSIGN_DRIVER', 'Can assign delivery orders to drivers'],
        ['ADJUST_INVENTORY', 'Can modify stock counts']
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
