import pool from './db';

async function run() {
    try {
        await pool.query('ALTER TABLE Inventory_Batches MODIFY supplier_invoice_id INT DEFAULT NULL;');
        console.log('Successfully altered table.');
    } catch (e) {
        console.error('Error:', e);
    } finally {
        process.exit(0);
    }
}
run();
