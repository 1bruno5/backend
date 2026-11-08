const express = require("express");
const router = express.Router();

const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbac");
const { requireDepartment } = require("../middleware/abac");
const { workingHoursOnly, activeUsersOnly, ipAllowList } = require("../middleware/rules");

// Step 6: any logged-in user
router.get("/profile", authenticate, (req, res) => {
    res.json({ message: "Your token data", user: req.user });
});

// Step 7: admin only
router.get("/admin/dashboard", authenticate, authorizeRoles("admin"), (req, res) => {
    res.json({ message: "Welcome, admin" });
});

// Step 7: admin + manager
router.get("/reports", authenticate, authorizeRoles("admin", "manager"), (req, res) => {
    res.json({ message: "Reports for admins and managers" });
});

// Step 8: role + department
router.get("/finance/records", authenticate, authorizeRoles("admin", "manager", "user"), requireDepartment("finance"), (req, res) => {
    res.json({ message: "Finance records" });
});

router.get("/it/tools", authenticate, requireDepartment("it"), (req, res) => {
    res.json({ message: "IT tools" });
});

// Step 10: IP restriction
router.get("/office/data", authenticate, ipAllowList(["127.0.0.1", "::1"]), (req, res) => {
    res.json({ message: "Office network data" });
});

// Step 10: combined rules
router.get("/finance/payroll", authenticate, activeUsersOnly, authorizeRoles("admin", "manager"), requireDepartment("finance"), workingHoursOnly(), (req, res) => {
    res.json({ message: "Payroll data" });
});

module.exports = router;
