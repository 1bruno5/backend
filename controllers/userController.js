const db = require("../database/database.js");
const bcrypt = require("bcrypt");

// Never return the password column to the client
function withoutPassword(user) {
    const { password, ...safe } = user;
    return safe;
}

function getOneUser(req, res) {
    const userId = req.params.id;

    db.query("SELECT * FROM users WHERE id=?", [userId], (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ message: "error occured" });
        }
        if (results.length === 0) {
            return res.status(404).json({ message: "user not found" });
        }
        res.status(200).json({ message: "user retrieved successfully", data: withoutPassword(results[0]) });
    });
}

function getAllUsers(req, res) {
    db.query("SELECT * FROM users", (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ message: "error occured" });
        }
        res.status(200).json({ message: "users fetched successfully", data: results.map(withoutPassword) });
    });
}

function deleteUser(req, res) {
    const userId = req.params.id;
    db.query("DELETE FROM users WHERE id=?", [userId], (err, result) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ message: "error occured" });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "user not found" });
        }
        res.status(200).json({ message: "user deleted successfully" });
    });
}


async function updateUser(req, res) {
    const userId = req.params.id;
    const { name, username, email, password } = req.body;
    const fields = [];
    const values = [];

    try {
        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim() || name.length > 100) {
                return res.status(400).json({ message: "name must be text (max 100 characters)" });
            }
            fields.push("name=?");
            values.push(name.trim());
        }
        if (username !== undefined) {
            if (typeof username !== "string" || username.trim().length < 3) {
                return res.status(400).json({ message: "username must be at least 3 characters" });
            }
            fields.push("username=?");
            values.push(username.trim());
        }
        if (email !== undefined) {
            if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                return res.status(400).json({ message: "email is not valid" });
            }
            fields.push("email=?");
            values.push(email);
        }
        if (password !== undefined) {
            if (typeof password !== "string" || password.length < 8) {
                return res.status(400).json({ message: "password must be at least 8 characters" });
            }
            fields.push("password=?");
            values.push(await bcrypt.hash(password, 10));
        }

        if (fields.length === 0) {
            return res.status(400).json({ message: "Send at least one of: name, username, email, password" });
        }

        values.push(userId);
        db.query(`UPDATE users SET ${fields.join(", ")} WHERE id=?`, values, (err, result) => {
            if (err) {
                if (err.code === "ER_DUP_ENTRY") {
                    return res.status(409).json({ message: "Username already taken" });
                }
                console.log(err);
                return res.status(500).json({ message: "error occured" });
            }
            if (result.affectedRows === 0) {
                return res.status(404).json({ message: "user not found" });
            }
            res.status(200).json({ message: "user updated successfully" });
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "error occured" });
    }
}

module.exports = { getOneUser, getAllUsers, deleteUser, updateUser };