import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
    console.log("Starting Customer Service Database Seeding...");

    // 1. Connect without database parameter to create it if it doesn't exist
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'root',
        multipleStatements: true
    });

    try {
        console.log("Reading schema.sql...");
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log("Executing schema...");
        await connection.query(schema);

        console.log("Customer Service Database Seeded Successfully!");
    } catch (e) {
        console.error("Error seeding Customer Service Database:", e);
    } finally {
        await connection.end();
    }
}

seed();
