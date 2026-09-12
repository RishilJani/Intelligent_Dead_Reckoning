const { USERS_TBL, USER_ID, USER_NAME, CREATED_AT, UPDATED_AT, EMAIL, PHONE } = require("../stringConstants");
const supabase = require("../supabase");

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
    if (!user_name || !phone || !email || !password) {
        return res.status(400).json({
            message: "User Name, phone , email ,password is mandatory"
        });
    }
    const created_at = new Date();
    try {
        // TODO: password hasing
        const { data, error } = await supabase.from(USERS_TBL).insert({
            user_name, phone, email, password_hash: password, created_at
        }).select(`${USER_ID},${USER_NAME},${EMAIL},${PHONE},${CREATED_AT},${UPDATED_AT}`);

        if (error) {
            return res.status(500).json({ message: error.message });
        }
        res.status(200).json(data[0]);
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

async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and Password are required" });
    }
    try {
        const { data, error } = await supabase.from(USERS_TBL).select("*").eq(EMAIL, email);
        if (error) {
            console.error("error = ", error.message);
            return res.status(500).json({ message: error.message });
        }
        if (data.length == 0) {
            return res.status(404).json({ message: "No user found" });
        }

        console.log("data = ", data);
        // TODO : check hash 
        if (data[0].password_hash === password) {
            const { password_hash, ...result } = data[0];
            return res.json({ success: true, data: result });
        } else {
            return res.status(401).json({ success: false, message: "Credentials do not match" });
        }
        return res.json({ success: true });
    } catch (err) {
        console.error('err = ', err);
        res.status(500).json({ message: err.message });
    }
}

module.exports = { getAllUsers, getByUserId, addUser, deleteUser, updateUser, login };