const express = require('express');
const supabase = require('../supabase');
const router = express.Router();
const { getAllUsers, getByUserId, addUser, deleteUser, updateUser } = require("../services/userService");

// get all users
router.get("/", getAllUsers);

router.get("/:user_id", getByUserId);

router.post("/", addUser);

router.delete("/:user_id" , deleteUser);

router.put("/:user_id" , updateUser);

module.exports = router;