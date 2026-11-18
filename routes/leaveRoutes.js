const express = require("express");
const router = express.Router();

const {
    createLeaveRequest,
    getMyLeaveRequests,
    listLeaveRequests,
    approveLeaveRequest,
    rejectLeaveRequest,
} = require("../controllers/leaveController");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbac");
const { activeUsersOnly } = require("../middleware/rules");

// ---------- employee side ----------
// Any logged-in, active user (employee, manager or admin) can ask for leave
router.post("/leave-requests", authenticate, activeUsersOnly, createLeaveRequest);

// An employee sees only their own requests (the owner comes from the token)
router.get("/leave-requests/mine", authenticate, activeUsersOnly, getMyLeaveRequests);

// ---------- manager / admin side ----------
// Role rule (RBAC): only managers and admins. Department rule (ABAC) is applied inside the controller.
router.get("/leave-requests", authenticate, activeUsersOnly, authorizeRoles("admin", "manager"), listLeaveRequests);
router.patch("/leave-requests/:id/approve", authenticate, activeUsersOnly, authorizeRoles("admin", "manager"), approveLeaveRequest);
router.patch("/leave-requests/:id/reject", authenticate, activeUsersOnly, authorizeRoles("admin", "manager"), rejectLeaveRequest);

module.exports = router;