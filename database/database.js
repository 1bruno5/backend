require("dotenv").config();
const mysql = require("mysql");

const db = mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1", // 127.0.0.1 avoids the localhost -> IPv6 problem
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "bad",
    connectTimeout: 5000,
});

db.connect((err) => {
    if (err) {
        console.log("DATABASE CONNECTION FAILED:");
        console.log("  code   :", err.code);
        console.log("  message:", err.message);
        return;
    }
    console.log("Database connected successfully");
});

module.exports = db;
