const supabase = require('../supabase');
const {
  FAVOURITES_TBL,
  FAV_ID,
  FAV_NAME,
  LATITUDE,
  LONGITUDE,
  USER_ID,
  USERS_TBL,
  USER_NAME,
  EMAIL
} = require('../stringConstants');

// Get all favourites
async function getAllFavourites(req, res) {
  try {
    const { data, error } = await supabase.from(FAVOURITES_TBL).select('*');
    if (error) {
      return res.status(500).json({ message: error.message });
    }
    return res.status(200).json(data || []);
  } catch (err) {
    console.error('err = ', err);
    res.status(500).json({ message: err.message });
  }
}

// Get favourites by user_id
// Route: GET /favourites/:user_id
async function getFavouritesByUserId(req, res) {
  const { user_id } = req.params;
  if (!user_id || isNaN(user_id)) {
    return res.status(400).json({ message: 'User ID is not valid' });
  }
  try {
    const { data, error } = await supabase
      .from(FAVOURITES_TBL)
      .select('*')
      .eq(USER_ID, Number(user_id))
      .order(FAV_ID, { ascending: false });

    if (error) {
      console.error('error = ', error);
      return res.status(500).json({ message: error.message });
    }
    return res.status(200).json(data || []);
  } catch (err) {
    console.error('err = ', err);
    res.status(500).json({ message: err.message });
  }
}

// Add favourite place
// Route: POST /favourites/
// Expects: user_id, fav_name, latitude, longitude
async function addFavourite(req, res) {
  const user_id = req.body.user_id || req.user?.user_id;
  const { fav_name, latitude, longitude } = req.body;

  if (!user_id || !fav_name || latitude == null || longitude == null) {
    return res.status(400).json({
      message: 'user_id, fav_name, latitude, and longitude are required'
    });
  }

  try {
    const insertPayload = {
      user_id: Number(user_id),
      fav_name: String(fav_name).trim(),
      latitude: String(latitude),
      longitude: String(longitude)
    };

    const { data, error } = await supabase
      .from(FAVOURITES_TBL)
      .insert(insertPayload)
      .select('*');

    if (error) {
      console.error('error = ', error.message);
      return res.status(500).json({ message: error.message });
    }

    const created = data && data.length > 0 ? data[0] : insertPayload;
    return res.status(201).json(created);
  } catch (err) {
    console.error('err = ', err);
    res.status(500).json({ message: err.message });
  }
}

// Delete favourite place
// Route: DELETE /favourites/:fav_id
async function deleteFavourite(req, res) {
  const { fav_id } = req.params;
  if (!fav_id || isNaN(fav_id)) {
    return res.status(400).json({ message: 'Favourite ID is not valid' });
  }

  try {
    const { data, error } = await supabase
      .from(FAVOURITES_TBL)
      .delete()
      .eq(FAV_ID, Number(fav_id))
      .select('*');

    if (error) {
      console.error('error = ', error.message);
      return res.status(500).json({ message: error.message });
    }

    if (data && data.length > 0) {
      return res.status(200).json({ success: true, message: 'Favourite deleted', data: data[0] });
    } else {
      return res.status(200).json({ success: true, message: 'Favourite deleted' });
    }
  } catch (err) {
    console.error('err = ', err);
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getAllFavourites,
  getFavouritesByUserId,
  addFavourite,
  deleteFavourite
};
