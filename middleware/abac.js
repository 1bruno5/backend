// STEP 8: attribute check (department). Usage: requireDepartment("finance")
function requireDepartment(...allowedDepartments) {
    const allowed = allowedDepartments.map((d) => d.toLowerCase());
    return (req, res, next) => {
        const dept = (req.user.department || "").toLowerCase();
        if (!allowed.includes(dept)) {
            return res.status(403).json({
                message: `Access denied: only the ${allowedDepartments.join(" / ")} department can access this`,
            });
        }
        next();
    };
}

// STEP 9: resource ownership. Admins bypass.
function requireOwnerOrAdmin(paramName = "id") {
    return (req, res, next) => {
        if (req.user.role === "admin") return next();

        if (String(req.user.id) !== String(req.params[paramName])) {
            return res.status(403).json({ message: "Access denied: you can only access your own data" });
        }
        next();
    };
}

module.exports = { requireDepartment, requireOwnerOrAdmin };
