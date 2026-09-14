const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { USERS_TBL, USER_ID, USER_NAME, CREATED_AT, UPDATED_AT, EMAIL, PHONE } = require("../stringConstants");
const supabase = require("../supabase");
const { JWT_SECRET } = require("../middleware/authMiddleware");

// get all Users
async function getAllUsers(req, res) {
    try {
        const { data, error } = await supabase.from(USERS_TBL).select(`${USER_ID},${USER_NAME},${EMAIL},${PHONE},${CREATED_AT},${UPDATED_AT}`);
        if (error) {
            return res.status(500).json({ message: error.message });
        }
        return res.status(200).json(data);
    } catch (err) {
        console.error('err = ', err);
        res.status(500).json({ message: err.message });
    }
}

// get by user_id
async function getByUserId(req, res) {
    const { user_id } = req.params;
    if (isNaN(user_id)) {
        return res.status(400).json({ message: "User Id is not valid" });
    }
    try {
        const { data, error } = await supabase.from(USERS_TBL).select(`${USER_ID},${USER_NAME},${EMAIL},${PHONE},${CREATED_AT},${UPDATED_AT}`).eq(USER_ID, user_id);
        if (error) {
            console.error("error  ", error);
            return res.status(404).json({ message: error.message });
        }
        if (data.length > 0) {
            return res.status(200).json(data[0]);
        } else {
            return res.status(404).json({ message: "No Record Found" });
        }
    } catch (err) {
        console.error('err = ', err);
        res.status(500).json({ message: err.message });
    }
}

// add user
async function addUser(req, res) {
    const { user_name, phone, email, password } = req.body;
    if (!user_name || !email || !password) {
        return res.status(400).json({
            message: "User Name, email, and password are required"
        });
    }
    const userPhone = phone || '';
    const created_at = new Date();
    try {
        const salt = process.env.SALT || 10;
        const password_hash = await bcrypt.hash(password, salt);
        const { data, error } = await supabase.from(USERS_TBL).insert({
            user_name, phone: userPhone, email, password_hash, created_at
        }).select(`${USER_ID},${USER_NAME},${EMAIL},${PHONE},${CREATED_AT},${UPDATED_AT}`);

        if (error) {
            return res.status(500).json({ message: error.message });
        }

        const user = data[0];
        const token = jwt.sign(
            { user_id: user[USER_ID] || user.user_id, email: user[EMAIL] || user.email, user_name: user[USER_NAME] || user.user_name },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(200).json({ success: true, token, data: user });
    } catch (err) {
        console.error('err = ', err);
        res.status(500).json({ message: err.message });
    }
}

// delete user
async function deleteUser(req, res) {
    const { user_id } = req.params;
    if (isNaN(user_id)) {
        return res.status(400).json({ message: "User Id is not valid" });
    }
    try {
        const { data, error } = await supabase.from(USERS_TBL).delete().eq(USER_ID, Number(user_id)).select(`${USER_ID},${USER_NAME},${EMAIL},${PHONE},${CREATED_AT},${UPDATED_AT}`);
        if (error) {
            console.error("error = ", error)
            return res.status(500).json({ message: error.message });
        }
        res.json(data[0]);
    } catch (err) {
        console.error('err = ', err);
        res.status(500).json({ message: err.message });
    }
}

// update User
async function updateUser(req, res) {
    const { user_id } = req.params;
    if (isNaN(user_id)) {
        return res.status(400).json({ message: "Invalid User id" });
    }
    const { user_name, email, phone } = req.body;
    const updated_at = new Date();
    try {
        const { data, error } = await supabase.from(USERS_TBL).update(
            { user_name, email, phone, updated_at }
        ).eq(USER_ID, user_id).select(`${USER_ID},${USER_NAME},${EMAIL},${PHONE},${CREATED_AT},${UPDATED_AT}`);
        if (error) {
            console.error("error = ", error);
            return res.status(400).json({ message: error.message });
        }
        if (data.length > 0) {
            return res.json(data[0]);
        } else {
            return res.status(404).json({ message: "user not found" });
        }
    } catch (err) {
        console.error('err = ', err);
        res.status(500).json({ message: err.message });
    }
}

// login user
async function login(req, res) {
    const { email, password } = req.body;
    console.log("Login here 1....");
    if (!email || !password) {
        return res.status(400).json({ message: "Email and Password are required" });
    }
    try {
        console.log("Login here 2....");
        const { data, error } = await supabase.from(USERS_TBL).select("*").eq(EMAIL, email);
        if (error) {
            console.error("error = ", error.message);
            return res.status(500).json({ message: error.message });
        }
        if (!data || data.length === 0) {
            return res.status(404).json({ message: "No user found" });
        }
        const user = data[0];
        let isPasswordValid = false;

        if (user.password_hash) {
            if (user.password_hash.startsWith('$2a$') || user.password_hash.startsWith('$2b$')) {
                isPasswordValid = await bcrypt.compare(password, user.password_hash);
            } else {
                isPasswordValid = user.password_hash === password;
            }
        }

        if (isPasswordValid) {
            const { password_hash, ...result } = user;
            const token = jwt.sign(
                { user_id: result[USER_ID] || result.user_id, email: result[EMAIL] || result.email, user_name: result[USER_NAME] || result.user_name },
                JWT_SECRET,
                { expiresIn: '24h' }
            );

            return res.json({ success: true, token, data: result });
        } else {
            return res.status(401).json({ success: false, message: "Credentials do not match" });
        }
    } catch (err) {
        console.error('err = ', err);
        res.status(500).json({ message: err.message });
    }
}

module.exports = { getAllUsers, getByUserId, addUser, deleteUser, updateUser, login };