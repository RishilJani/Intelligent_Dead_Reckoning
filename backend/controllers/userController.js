const express = require('express');
const supabase = require('../supabase');
const router = express.Router();
const { getAllUsers } = require("../services/userService");

// get all users
router.get("/", getAllUsers);


module.exports = router;