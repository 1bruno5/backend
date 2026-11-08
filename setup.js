// Run with: npm run setup
// Creates database "bad" and the users table, or upgrades an existing users table.
require("dotenv").config();
const mysql = require("mysql");

const DB_NAME = process.env.DB_NAME || "bad";

const conn = mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    connectTimeout: 5000,
});

const run = (sql, params = []) =>
    new Promise((resolve, reject) => conn.query(sql, params, (err, r) => (err ? reject(err) : resolve(r))));

async function main() {
    await new Promise((resolve, reject) => conn.connect((e) => (e ? reject(e) : resolve())));
    console.log("Connected to MySQL");

    await run(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    await run(`USE \`${DB_NAME}\``);
    console.log(`Database "${DB_NAME}" is ready`);

    // Fresh install: create the table
    await run(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            fname VARCHAR(100) NULL,
            lname VARCHAR(100) NULL,
            username VARCHAR(100) NOT NULL,
            email VARCHAR(150) NULL,
            password VARCHAR(255) NOT NULL,
            role ENUM('admin','user','manager') NOT NULL DEFAULT 'user',
            department VARCHAR(50) NOT NULL DEFAULT 'general',
            is_active TINYINT(1) NOT NULL DEFAULT 1
        )
    `);

    // Existing table: add whatever is missing
    const cols = (await run("SHOW COLUMNS FROM users")).map((c) => c.Field);
    if (!cols.includes("role"))
        await run("ALTER TABLE users ADD COLUMN role ENUM('admin','user','manager') NOT NULL DEFAULT 'user'");
    if (!cols.includes("department"))
        await run("ALTER TABLE users ADD COLUMN department VARCHAR(50) NOT NULL DEFAULT 'general'");
    if (!cols.includes("is_active"))
        await run("ALTER TABLE users ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1");

    // Make the old columns optional, and make room for bcrypt hashes
    for (const sql of [
        "ALTER TABLE users MODIFY fname VARCHAR(100) NULL",
        "ALTER TABLE users MODIFY lname VARCHAR(100) NULL",
        "ALTER TABLE users MODIFY email VARCHAR(150) NULL",
        "ALTER TABLE users MODIFY password VARCHAR(255) NOT NULL",
    ]) {
        try { await run(sql); } catch (e) { /* column may not exist; ignore */ }
    }

    // Username must be unique
    const idx = await run("SHOW INDEX FROM users WHERE Column_name = 'username' AND Non_unique = 0");
    if (idx.length === 0) {
        try {
            await run("ALTER TABLE users ADD UNIQUE KEY uq_users_username (username)");
        } catch (e) {
            console.log("Could not add UNIQUE(username). You probably have duplicate usernames. Fix them and run setup again.");
            console.log("  ", e.message);
        }
    }

    console.log("users table is ready. Setup complete.");
    conn.end();
}

main().catch((err) => {
    console.log("SETUP FAILED:");
    console.log("  code   :", err.code);
    console.log("  message:", err.message);
    conn.destroy();
    process.exit(1);
});
