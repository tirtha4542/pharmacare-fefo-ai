const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function initDatabase() {
  console.log('--- Initializing Pharmacy Database ---');

  const host = process.env.DB_HOST || 'localhost';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER || 'pharma_user';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_NAME || 'pharmacy_db';

  console.log(`Connecting to MySQL at ${host}:${port} as ${user}...`);

  let connection;
  try {
    // Connect with multipleStatements enabled so we can run complete .sql scripts
    connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      multipleStatements: true
    });

    console.log('Connected to MySQL successfully.');

    // 1. Run schema.sql
    const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('Executing database/schema.sql...');
    await connection.query(schemaSql);
    console.log('schema.sql executed successfully.');

    // Connect specifically to the created database for seed.sql
    await connection.changeUser({ database });

    // 2. Run seed.sql
    const seedPath = path.join(__dirname, '..', 'database', 'seed.sql');
    const seedSql = fs.readFileSync(seedPath, 'utf8');
    console.log('Executing database/seed.sql...');
    await connection.query(seedSql);
    console.log('seed.sql executed successfully.');

    // 3. Verify exactly 8 tables exist in database
    const [tables] = await connection.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = ?`,
      [database]
    );

    console.log(`\nFound ${tables.length} tables in ${database}:`);
    tables.forEach((t, i) => console.log(`  ${i + 1}. ${t.TABLE_NAME || t.table_name}`));

    if (tables.length === 8) {
      console.log('\nSUCCESS: Exactly 8 tables verified in the database!');
    } else {
      console.error(`\nWARNING: Expected 8 tables, but found ${tables.length}!`);
      process.exitCode = 1;
    }

  } catch (err) {
    console.error('Error during database initialization:', err.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();

