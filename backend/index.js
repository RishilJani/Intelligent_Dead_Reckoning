const express = require('express');
const cors = require('cors');
const { verifyToken } = require('./middleware/authMiddleware');
require("dotenv").config(); // to use .env files
const app = express();

app.use(cors({
  origin: '*',
})); // to resolve cors issue

app.use(express.json()); // to use json data
app.get('/', (req, res) => {
  res.send('Hello World')
});

app.use("/users", require("./controllers/userController"));
app.use("/feedbacks", verifyToken, require("./controllers/feedbackController"));

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
})