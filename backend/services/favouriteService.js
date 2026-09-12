const { FAVOURITES_TBL, USER_ID } = require("../stringConstants");
const supabase = require("../supabase");

// get all favourite places
async function getAllFavPlaces(req, res) {
    try {
        const { data, error } = await supabase.from(FAVOURITES_TBL).select("*");
        if (error) {
            return res.status(500).json({ message: error.message });
        }
        return res.status(200).json(data);
    } catch (err) {
        console.error('err = ', err);
        res.status(500).json({ message: err.message });
    }
}

// get all favourites places of user
async function getAllFavPlacesByUserId(req, res) {
    const { user_id } = req.params;
    if (isNaN(user_id)) {
        return res.status(400).json({ message: "User Id is not valid" });
    }
    try {
        const { data, error } = await supabase.from(FAVOURITES_TBL).select("*").eq(USER_ID, user_id);
        if (error) {
            console.error("error  ", error);
            return res.status(404).json({ message: error.message });
        }
        if (data.length > 0) {
            return res.status(200).json(data);
        } else {
            return res.status.json({ message: "No Record Found" });
        }
    } catch (err) {
        console.error('err = ', err);
        res.status(500).json({ message: err.message });
    }
}

// add favourite place of user
async function addFavouritePlace(req, res) {
    const { user_id, fav_name, latitude, longitude } = req.body;
    if (!user_id || !fav_name || !latitude || !longitude) {
        return res.status(400).json({
            message: "User id, Favourite name, Latitude and longitude is mandatory"
        });
    }
    try {
        const { data, error } = await supabase.from(FAVOURITES_TBL).insert({
            user_id, fav_name, latitude, longitude
        }).select("*");
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


module.exports = { getAllFavPlaces, getAllFavPlacesByUserId, addFavouritePlace };