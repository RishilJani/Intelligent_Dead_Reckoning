const express = require('express');
const cors = require('cors');
require("dotenv").config(); // to use .env files
const app = express();

app.use(cors({
    origin: '*',
})); // to resolve cors issue

app.get('/', (req, res) => {
  res.send('Hello World')
})

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
})