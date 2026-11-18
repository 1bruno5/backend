const db = require("../database/database.js");

const LEAVE_TYPES = ["annual", "sick", "maternity", "paternity", "compassionate", "unpaid"];
const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"];

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

// GET /leave-requests/mine  -> an employee sees ONLY their own leave requests
// Optional filter: /leave-requests/mine?status=pending
function getMyLeaveRequests(req, res) {
    // The owner comes from the token. There is no :id in the URL,
    // so there is no way to ask for somebody else's requests.
    const userId = req.user.id;
    const { status } = req.query;

    if (status !== undefined && !LEAVE_STATUSES.includes(status)) {
        return res.status(400).json({ message: `status must be one of: ${LEAVE_STATUSES.join(", ")}` });
    }

    // DATE_FORMAT keeps dates as plain "YYYY-MM-DD" text.
    // Without it, JavaScript turns a DATE into a timestamp and the day can shift because of the time zone.
    // LEFT JOIN brings the username of the person who decided (empty while the request is pending).
    let sql = `
        SELECT r.id, r.leave_type, r.reason,
               DATE_FORMAT(r.start_date, '%Y-%m-%d') AS start_date,
               DATE_FORMAT(r.end_date, '%Y-%m-%d') AS end_date,
               DATEDIFF(r.end_date, r.start_date) + 1 AS days,
               r.status, r.decision_note, r.decided_at, r.created_at,
               d.username AS decided_by
        FROM leave_requests r
        LEFT JOIN users d ON d.id = r.decided_by
        WHERE r.user_id = ?`;
    const params = [userId];

    if (status !== undefined) {
        sql += " AND r.status = ?";
        params.push(status);
    }
    sql += " ORDER BY r.created_at DESC, r.id DESC"; // newest first

    db.query(sql, params, (err, rows) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ message: "error occured" });
        }
        res.status(200).json({
            message: "Your leave requests",
            count: rows.length,
            data: rows,
        });
    });
}

// GET /leave-requests  -> managers and admins see leave requests to decide on
//   - a manager sees ONLY the requests of people in his own department
//   - an admin sees all departments
// Optional filter: /leave-requests?status=pending
function listLeaveRequests(req, res) {
    const { status } = req.query;

    if (status !== undefined && !LEAVE_STATUSES.includes(status)) {
        return res.status(400).json({ message: `status must be one of: ${LEAVE_STATUSES.join(", ")}` });
    }

    let sql = `
        SELECT r.id, r.user_id,
               u.username AS requester, u.name AS requester_name, u.department AS requester_department,
               r.leave_type, r.reason,
               DATE_FORMAT(r.start_date, '%Y-%m-%d') AS start_date,
               DATE_FORMAT(r.end_date, '%Y-%m-%d') AS end_date,
               DATEDIFF(r.end_date, r.start_date) + 1 AS days,
               r.status, r.decision_note, r.decided_at, r.created_at,
               d.username AS decided_by
        FROM leave_requests r
        JOIN users u ON u.id = r.user_id
        LEFT JOIN users d ON d.id = r.decided_by
        WHERE 1 = 1`;
    const params = [];

    // Department rule (ABAC): a manager only sees his own department
    if (req.user.role === "manager") {
        sql += " AND LOWER(u.department) = LOWER(?)";
        params.push(req.user.department);
    }
    if (status !== undefined) {
        sql += " AND r.status = ?";
        params.push(status);
    }
    sql += " ORDER BY r.created_at DESC, r.id DESC";

    db.query(sql, params, (err, rows) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ message: "error occured" });
        }
        res.status(200).json({ message: "Leave requests", count: rows.length, data: rows });
    });
}

// Builds the "approve" and "reject" handlers (they are the same, only the new status differs)
function makeDecisionHandler(newStatus) {
    return (req, res) => {
        const requestId = req.params.id;
        const { note } = req.body || {}; // Express 5: req.body is undefined when no body was sent

        if (!/^\d+$/.test(requestId)) {
            return res.status(400).json({ message: "request id must be a number" });
        }
        if (note !== undefined && (typeof note !== "string" || note.length > 255)) {
            return res.status(400).json({ message: "note must be text (max 255 characters)" });
        }
        if (newStatus === "rejected" && (!note || !note.trim())) {
            return res.status(400).json({ message: "a note explaining the rejection is required" });
        }

        db.query(
            `SELECT r.id, r.user_id, r.status, u.department AS requester_department
             FROM leave_requests r
             JOIN users u ON u.id = r.user_id
             WHERE r.id = ?`,
            [requestId],
            (err, rows) => {
                if (err) {
                    console.log(err);
                    return res.status(500).json({ message: "error occured" });
                }
                if (rows.length === 0) {
                    return res.status(404).json({ message: "leave request not found" });
                }
                const leave = rows[0];

                // Custom rule: nobody decides on his own request (not even an admin)
                if (leave.user_id === req.user.id) {
                    return res.status(403).json({ message: "You cannot decide on your own leave request" });
                }

                // Department rule (ABAC): a manager only decides for his own department. Admins can decide for any.
                if (
                    req.user.role === "manager" &&
                    (leave.requester_department || "").toLowerCase() !== (req.user.department || "").toLowerCase()
                ) {
                    return res.status(403).json({ message: "This request belongs to another department" });
                }

                // Only a pending request can be decided
                if (leave.status !== "pending") {
                    return res.status(409).json({ message: `This request is already ${leave.status}` });
                }

                // "AND status = 'pending'" protects against two people deciding at the same moment
                db.query(
                    `UPDATE leave_requests
                     SET status = ?, decided_by = ?, decision_note = ?, decided_at = NOW()
                     WHERE id = ? AND status = 'pending'`,
                    [newStatus, req.user.id, note ? note.trim() : null, requestId],
                    (err, result) => {
                        if (err) {
                            console.log(err);
                            return res.status(500).json({ message: "error occured" });
                        }
                        if (result.affectedRows === 0) {
                            return res.status(409).json({ message: "This request was just decided by someone else" });
                        }
                        res.status(200).json({
                            message: `Leave request ${newStatus}`,
                            data: {
                                id: Number(requestId),
                                status: newStatus,
                                decided_by: req.user.id,
                                decision_note: note ? note.trim() : null,
                            },
                        });
                    }
                );
            }
        );
    };
}

const approveLeaveRequest = makeDecisionHandler("approved");
const rejectLeaveRequest = makeDecisionHandler("rejected");

module.exports = {
    createLeaveRequest,
    getMyLeaveRequests,
    listLeaveRequests,
    approveLeaveRequest,
    rejectLeaveRequest,
};