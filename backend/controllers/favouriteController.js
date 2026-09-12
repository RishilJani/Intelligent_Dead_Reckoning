const { getAllFavPlaces, getAllFavPlacesByUserId, addFavouritePlace } = require("../services/favouriteService");

const router = require("express").Router();

router.get("/", getAllFavPlaces);

router.get("/:user_id", getAllFavPlacesByUserId);

router.post("/", addFavouritePlace);

module.exports = router;