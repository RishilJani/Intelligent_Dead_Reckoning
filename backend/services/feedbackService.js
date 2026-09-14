const supabase = require('../supabase');
const { FEEDBACKS_TBL, FEEDBACK_ID, FEEDBACK_TEXT, IS_BUG, IS_SOLVED, CREATED_AT, UPDATED_AT, USERS_TBL, USER_ID, USER_NAME, EMAIL, PHONE } = require('../stringConstants');


const SELECT_QUERY = `
    ${FEEDBACK_ID}, ${FEEDBACK_TEXT} , ${IS_BUG}, ${IS_SOLVED}, ${CREATED_AT}, ${UPDATED_AT},
    ${USERS_TBL} (
        ${USER_ID},
        ${USER_NAME},
        ${EMAIL},
        ${PHONE},
        ${CREATED_AT},
        ${UPDATED_AT}
    )
`;

// get all feedbacks
async function getAllFeedbacks(req, res) {
    try {
        const { data, error } = await supabase.from(FEEDBACKS_TBL).select(SELECT_QUERY);
        if (error) {
            return res.status(500).json({ message: error.message });
        }
        return res.status(200).json(data);
    } catch (err) {
        console.error('err = ', err);
        res.status(500).json({ message: err.message });
    }
}

// get feedback by user_id
async function getFeedbacksByUserId(req, res) {
    const { user_id } = req.params;
    if (isNaN(user_id)) {
        return res.status(400).json({ message: "User Id is not valid" });
    }
    try {
        const { data, error } = await supabase
            .from(FEEDBACKS_TBL)
            .select(SELECT_QUERY)
            .eq(USER_ID, user_id)
            .order(CREATED_AT, { ascending: false });

        if (error) {
            console.error("error  ", error);
            return res.status(404).json({ message: error.message });
        }
        if (data.length > 0) {
            return res.status(200).json(data);
        } else {
            return res.status(404).json({ message: "No Record Found" });
        }
        return res.status(200).json(data || []);
    } catch (err) {
        console.error('err = ', err);
        res.status(500).json({ message: err.message });
    }
}

// add feedback
async function addFeedback(req, res) {
    const user_id = req.body.user_id || req.user?.user_id;
    const { feedback_text, is_bug } = req.body;

    if (!user_id || !feedback_text || is_bug == undefined || is_bug == null) {
        return res.status(400).json({
            message: "User id, feedback text , is_bug is mandatory"
        });
    }
    const created_at = new Date();
    const is_solved = false;
    try {
        const { data, error } = await supabase.from(FEEDBACKS_TBL).insert({
            user_id, feedback_text, is_bug, is_solved, created_at
        }).select(SELECT_QUERY);

        if (error) {
            console.error("error = ", error.message);
            return res.status(500).json({ message: error.message });
        }
        res.status(200).json(data);
    } catch (err) {
        console.error('err = ', err);
        res.status(500).json({ message: err.message });
    }
}

// delete feedback
async function deleteFeedback(req, res) {
    const { feedback_id } = req.params;
    if (isNaN(feedback_id)) {
        return res.status(400).json({ message: "Feedback id is not valid" });
    }

    try {
        const { data, error } = await supabase.from(FEEDBACKS_TBL).delete().eq(FEEDBACK_ID, Number(feedback_id)).select("*");
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

// update feedback
async function updateFeedback(req, res) {
    const { feedback_id } = req.params;
    if (isNaN(feedback_id)) {
        return res.status(400).json({ message: "Invalid Feedback id" });
    }
    const { feedback_text, is_bug } = req.body;
    const updated_at = new Date();
    try {
        const updatePayload = { updated_at };
        if (feedback_text !== undefined) updatePayload.feedback_text = feedback_text;
        if (is_bug !== undefined) updatePayload.is_bug = is_bug;

        const { data, error } = await supabase.from(FEEDBACKS_TBL).update(
            { feedback_text, is_bug, updated_at }
        ).eq(FEEDBACK_ID, feedback_id).select();

        if (error) {
            console.error("error = ", error);
            return res.status(400).json({ message: error.message });
        }
        if (data.length > 0) {
            return res.json(data[0]);
        } else {
            return res.status(404).json({ message: "Feedback not found" });
        }
    } catch (err) {
        console.error('err = ', err);
        res.status(500).json({ message: err.message });
    }
}
module.exports = { getAllFeedbacks, getFeedbacksByUserId, addFeedback, deleteFeedback, updateFeedback };