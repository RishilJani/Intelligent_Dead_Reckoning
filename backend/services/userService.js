const { USERS_TBL, USER_ID, USER_NAME, CREATED_AT, UPDATED_AT, EMAIL, PHONE } = require("../stringConstants");
const supabase = require("../supabase");

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

module.exports = { getAllUsers };