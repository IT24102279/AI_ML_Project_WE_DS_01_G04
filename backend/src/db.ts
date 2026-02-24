import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// We expect DATABASE_URL in the format: mysql://user:password@host:port/database
// mysql2 can handle this uri directly if we pass it, or we can use createPool with the uri
const uri = process.env.DATABASE_URL || 'mysql://root:root@127.0.0.1:3306/pharmacy_pos';

const pool = mysql.createPool(uri);

export default pool;
