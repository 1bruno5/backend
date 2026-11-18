require("dotenv").config(); // must be first so process.env.JWT_SECRET is loaded

const express = require("express");
const db = require("./database/database.js");
const app = express();
const port = 5000;

const authRoutes = require("./routes/authRoutes.js");
const userRoutes = require("./routes/userRoutes.js");
const demoRoutes = require("./routes/demoRoutes.js");
const leaveRoutes = require("./routes/leaveRoutes.js");

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Welcome to my application");
});

app.use(authRoutes);
app.use(userRoutes);
app.use(demoRoutes);
app.use(leaveRoutes);

app.listen(port, () => {
    console.log(`http://localhost:${port}`);
});