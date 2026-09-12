const { getAllFavPlaces, getAllFavPlacesByUserId, addFavouritePlace } = require("../services/favouriteService");
const { deleteFeedback } = require("../services/feedbackService");

const router = require("express").Router();

router.get("/", getAllFavPlaces);

router.get("/:user_id", getAllFavPlacesByUserId);

router.post("/", addFavouritePlace);

router.delete("/:fav_id", deleteFeedback);

module.exports = router;