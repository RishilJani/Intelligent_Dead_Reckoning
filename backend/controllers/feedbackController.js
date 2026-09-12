const { getAllFeedbacks, getFeedbacksByUserId, addFeedback, deleteFeedback, updateFeedback } = require('../services/feedbackService');
const router = require('express').Router();

// get all feedbacks
router.get("/", getAllFeedbacks);

// get by user_id 
router.get("/:user_id", getFeedbacksByUserId);

router.post("/", addFeedback);

router.delete("/:feedback_id", deleteFeedback);

router.put("/:feedback_id", updateFeedback);

module.exports = router;