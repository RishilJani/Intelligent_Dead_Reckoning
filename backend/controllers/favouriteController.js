const { getAllFavPlaces, getAllFavPlacesByUserId, addFavouritePlace,deleteFavouritePlace} = require("../services/favouriteService");

const router = require("express").Router();

router.get("/", getAllFavPlaces);

router.get("/:user_id", getAllFavPlacesByUserId);

router.post("/", addFavouritePlace);

router.delete("/:fav_id", deleteFavouritePlace);

module.exports = router;
