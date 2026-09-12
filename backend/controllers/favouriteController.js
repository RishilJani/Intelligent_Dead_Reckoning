const {
  getAllFavourites,
  getFavouritesByUserId,
  addFavourite,
  deleteFavourite
} = require('../services/favouriteService');
const router = require('express').Router();

// Get all favourites
router.get('/', getAllFavourites);

// Get by user_id
// Route: GET /favourites/:user_id
router.get('/:user_id', getFavouritesByUserId);

// Add favourite
// Route: POST /favourites/
router.post('/', addFavourite);

// Delete favourite
// Route: DELETE /favourites/:fav_id
router.delete('/:fav_id', deleteFavourite);

module.exports = router;
