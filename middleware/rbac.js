// STEP 7: Usage: authorizeRoles("admin")  or  authorizeRoles("admin", "manager")
function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: "Not authenticated" });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Access denied: requires role ${allowedRoles.join(" or ")}`,
            });
        }
        next();
    };
}

module.exports = { authorizeRoles };
