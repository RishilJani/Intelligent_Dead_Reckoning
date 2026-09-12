// Table names
const USERS_TBL = "users";
const FEEDBACKS_TBL = "feedbacks";
const FAVOURITES_TBL = "favourites";

// Column Names
const USER_ID = "user_id";
const USER_NAME = "user_name";
const PASSWORD_HASH = "password_hash"
const EMAIL = "email";
const PHONE = "phone";
const CREATED_AT = "created_at";
const UPDATED_AT = "updated_at";

const FEEDBACK_ID = "feedback_id";
const FEEDBACK_TEXT = "feedback_text";
const IS_BUG = "is_bug";
const IS_SOLVED = "is_solved";

const FAV_ID = "fav_id";
const FAV_NAME = "fav_name";
const LATITUDE = "latitude";
const LONGITUDE = "longitude";

module.exports = {
    USERS_TBL, FEEDBACKS_TBL, FAVOURITES_TBL,
    USER_ID, USER_NAME, PASSWORD_HASH, EMAIL, PHONE, CREATED_AT, UPDATED_AT,
    FEEDBACK_ID, FEEDBACK_TEXT , IS_BUG , IS_SOLVED,
    FAV_ID, FAV_NAME, LATITUDE, LONGITUDE
}
