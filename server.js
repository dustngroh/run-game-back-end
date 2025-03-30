const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { router: authRoutes, verifyToken } = require("./routes/authRoutes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
//app.use("/scores", scoreRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
