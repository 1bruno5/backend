const express = require("express");
const router = express.Router();

const { getOneUser, getAllUsers, deleteUser, updateUser } = require("../controllers/userController");
const { authenticate } = require("../middleware/authMiddleware");
const { authorizeRoles } = require("../middleware/rbac");
const { requireOwnerOrAdmin } = require("../middleware/abac");

router.get("/users", authenticate, authorizeRoles("admin"), getAllUsers);
router.get("/users/:id", authenticate, requireOwnerOrAdmin("id"), getOneUser);
router.put("/users/:id", authenticate, requireOwnerOrAdmin("id"), updateUser);
router.delete("/users/:id", authenticate, authorizeRoles("admin"), deleteUser);

module.exports = router;
