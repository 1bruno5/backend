const express = require("express");
const router = express.Router();

const { createLeaveRequest } = require("../controllers/leaveController");
const { authenticate } = require("../middleware/authMiddleware");
const { activeUsersOnly } = require("../middleware/rules");

// Any logged-in, active user (employee, manager or admin) can ask for leave
router.post("/leave-requests", authenticate, activeUsersOnly, createLeaveRequest);

module.exports = router;