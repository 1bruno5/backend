const db = require("../database/database.js");

const LEAVE_TYPES = ["annual", "sick", "maternity", "paternity", "compassionate", "unpaid"];

// "2026-12-10" is valid, "2026-02-30" and "10/12/2026" are not
function isValidDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const d = new Date(value + "T00:00:00Z");
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

// Today's date in Kigali, as "YYYY-MM-DD"
function todayInKigali() {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Kigali" });
}

// Number of days from start to end, both included
function countDays(start, end) {
    return Math.round((new Date(end) - new Date(start)) / 86400000) + 1;
}

// POST /leave-requests  -> an employee asks for leave
function createLeaveRequest(req, res) {
    // WHO is asking comes from the token, never from the body.
    const userId = req.user.id;
    const { leave_type, reason, start_date, end_date } = req.body;

    // ---- rule 1: the data must be complete and valid ----
    if (!LEAVE_TYPES.includes(leave_type)) {
        return res.status(400).json({ message: `leave_type must be one of: ${LEAVE_TYPES.join(", ")}` });
    }
    if (typeof reason !== "string" || !reason.trim()) {
        return res.status(400).json({ message: "reason is required" });
    }
    if (reason.trim().length > 255) {
        return res.status(400).json({ message: "reason must be at most 255 characters" });
    }
    if (!isValidDate(start_date) || !isValidDate(end_date)) {
        return res.status(400).json({ message: "start_date and end_date are required, format YYYY-MM-DD" });
    }
    if (end_date < start_date) {
        return res.status(400).json({ message: "end_date cannot be before start_date" });
    }

    // ---- rule 2: leave cannot start in the past, except sick leave (you are sick first, you report later) ----
    if (leave_type !== "sick" && start_date < todayInKigali()) {
        return res.status(400).json({ message: "start_date cannot be in the past (only sick leave can be filed for past dates)" });
    }

    // ---- rule 3: no overlap with another pending or approved request of the same person ----
    // Two periods overlap when: existing.start <= new.end AND existing.end >= new.start
    db.query(
        `SELECT id, start_date, end_date, status FROM leave_requests
         WHERE user_id = ? AND status IN ('pending','approved')
           AND start_date <= ? AND end_date >= ?`,
        [userId, end_date, start_date],
        (err, overlapping) => {
            if (err) {
                console.log(err);
                return res.status(500).json({ message: "error occured" });
            }
            if (overlapping.length > 0) {
                return res.status(409).json({
                    message: `You already have a ${overlapping[0].status} leave request (id ${overlapping[0].id}) that overlaps these dates`,
                });
            }

            // ---- save (status becomes 'pending' by itself, from the table default) ----
            db.query(
                "INSERT INTO leave_requests (user_id, leave_type, reason, start_date, end_date) VALUES (?,?,?,?,?)",
                [userId, leave_type, reason.trim(), start_date, end_date],
                (err, result) => {
                    if (err) {
                        console.log(err);
                        return res.status(500).json({ message: "error occured" });
                    }
                    res.status(201).json({
                        message: "Leave request created successfully",
                        data: {
                            id: result.insertId,
                            user_id: userId,
                            leave_type,
                            reason: reason.trim(),
                            start_date,
                            end_date,
                            days: countDays(start_date, end_date),
                            status: "pending",
                        },
                    });
                }
            );
        }
    );
}

module.exports = { createLeaveRequest };