const express = require('express');
const router = express.Router();
const { getAllUsers, getByUserId, addUser, deleteUser, updateUser, login } = require("../services/userService");
const { verifyToken } = require("../middleware/authMiddleware");

// Public routes
router.post("/login", login);
router.post("/signup", addUser);

// Protected routes (require JWT token)
router.get("/", verifyToken, getAllUsers);
router.get("/:user_id", verifyToken, getByUserId);
router.delete("/:user_id", verifyToken, deleteUser);
router.put("/:user_id", verifyToken, updateUser);

module.exports = router;