const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../database/database.js");

const ALLOWED_ROLES = ["admin", "user", "manager"];

function findUserByUsername(username) {
    return new Promise((resolve, reject) => {
        db.query("SELECT * FROM users WHERE username = ?", [username], (err, results) => {
            if (err) return reject(err);
            resolve(results[0] || null);
        });
    });
}

function insertUser(username, hashedPassword, role, department, name, email) {
    return new Promise((resolve, reject) => {
        db.query(
            "INSERT INTO users (username, password, role, department, name, email) VALUES (?,?,?,?,?,?)",
            [username, hashedPassword, role, department, name, email],
            (err, result) => {
                if (err) return reject(err);
                resolve(result);
            }
        );
    });
}

// STEP 4: Register
async function register(req, res) {
    try {
        const { username, password, role, department, name, email } = req.body;

        if (!username || !password || !role || !department) {
            return res.status(400).json({ message: "username, password, role and department are required" });
        }
        if ([username, password, role, department].some((v) => typeof v !== "string")) {
            return res.status(400).json({ message: "All fields must be text" });
        }
        if (!ALLOWED_ROLES.includes(role)) {
            return res.status(400).json({ message: `role must be one of: ${ALLOWED_ROLES.join(", ")}` });
        }
        if (password.length < 8) {
            return res.status(400).json({ message: "Password must be at least 8 characters" });
        }
        // name and email are optional, but if sent they must be valid
        if (name !== undefined && (typeof name !== "string" || name.length > 100)) {
            return res.status(400).json({ message: "name must be text (max 100 characters)" });
        }
        if (email !== undefined && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
            return res.status(400).json({ message: "email is not valid" });
        }

        const existing = await findUserByUsername(username);
        if (existing) {
            return res.status(409).json({ message: "Username already taken" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await insertUser(username, hashedPassword, role, department, (name || "").trim(), email || null);

        return res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Username already taken" });
        }
        console.log(err);
        return res.status(500).json({ message: "error occured" });
    }
}

// STEP 5: Login
async function login(req, res) {
    try {
        const { username, password } = req.body;

        if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
            return res.status(400).json({ message: "username and password are required" });
        }

        const user = await findUserByUsername(username);
        if (!user) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        const passwordMatches = await bcrypt.compare(password, user.password);
        if (!passwordMatches) {
            return res.status(401).json({ message: "Invalid username or password" });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, department: user.department },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "1h" }
        );

        return res.status(200).json({ message: "Login successful", token });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ message: "error occured" });
    }
}

module.exports = { register, login };