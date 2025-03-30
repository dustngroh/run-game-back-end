// routes/authRoutes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const secretKey = process.env.JWT_SECRET || "your-secret-key";

// Register a new user
router.post("/register", async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if user already exists
        const existingUser = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Hash the password    
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user into database
        await pool.query("INSERT INTO users (username, password_hash) VALUES ($1, $2)", [username, hashedPassword]);

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        console.error("Error registering user", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Login route
router.post("/login", async (req, res) => {
    const { username, password } = req.body;

    try {
        // Check if user exists
        const user = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        if (user.rows.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        
        // Check password
        const validPassword = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        
        // Generate a JWT token
        const token = jwt.sign({ userId: user.rows[0].id }, secretKey, { expiresIn: "1h" });

        res.json({ token, username: user.rows[0].username });
    } catch (error) {
        console.error("Error logging in", error);
        res.status(500).json({ message: "Internal server error" });
    }
});


// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(403).json({ message: "No token provided" });

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) return res.status(403).json({ message: "Invalid token" });
        req.userId = decoded.userId;
        next();
    });
};

module.exports = { router, verifyToken };
