const express = require('express');
const cors = require('cors');
const { verifyToken } = require('./middleware/authMiddleware');
require("dotenv").config(); // to use .env files
const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
})); // to resolve cors issue

app.use(express.json()); // to use json data

app.use("/users", require("./controllers/userController"));
app.use("/feedbacks", verifyToken, require("./controllers/feedbackController"));
app.use("/favourites", verifyToken, require("./controllers/favouriteController"));

app.get('/', (req, res) => {
  console.log("API is running - " + new Date().toISOString());

  res.send('API is running - ' + new Date().toISOString());
});
if (process.env.SELF_URL != null) {
  setInterval(() => {
    const now = new Date();
    fetch(process.env.SELF_URL);
  }, 300000);

}
const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
})