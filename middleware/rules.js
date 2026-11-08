const db = require("../database/database.js");

// STEP 10: working hours only (Kigali time by default)
function workingHoursOnly({ startHour = 8, endHour = 17, days = [1, 2, 3, 4, 5], timeZone = "Africa/Kigali" } = {}) {
    return (req, res, next) => {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone,
            hour: "numeric",
            hourCycle: "h23",
            weekday: "short",
        }).formatToParts(new Date());

        const hour = Number(parts.find((p) => p.type === "hour").value);
        const weekdayName = parts.find((p) => p.type === "weekday").value;
        const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekdayName);

        if (!days.includes(day) || hour < startHour || hour >= endHour) {
            return res.status(403).json({
                message: `Access denied: this resource is only available Mon-Fri, ${startHour}:00-${endHour}:00 (${timeZone})`,
            });
        }
        next();
    };
}

// Block inactive users (checks the DB, not just the token)
function activeUsersOnly(req, res, next) {
    db.query("SELECT is_active FROM users WHERE id = ?", [req.user.id], (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ message: "error occured" });
        }
        if (results.length === 0 || !results[0].is_active) {
            return res.status(403).json({ message: "Access denied: your account is inactive" });
        }
        next();
    });
}

// Restrict by IP address
function ipAllowList(allowedIps) {
    return (req, res, next) => {
        const ip = (req.ip || "").replace("::ffff:", "");
        if (!allowedIps.includes(ip)) {
            return res.status(403).json({ message: `Access denied: IP ${ip} is not allowed` });
        }
        next();
    };
}

module.exports = { workingHoursOnly, activeUsersOnly, ipAllowList };
