// routes/endlessRoutes.js
const express = require("express");
const { Pool } = require("pg");
const { verifyToken } = require("./authRoutes");

const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: false 
  }
});


// Submit endless distance
router.post("/", verifyToken, async (req, res) => {
    const { distance } = req.body;
    const userId = req.userId;
  
    try {
        // Check existing distance for user
    const existing = await pool.query(
        "SELECT distance FROM endless_distances WHERE user_id = $1",
        [userId]
      );

      if (existing.rows.length > 0) {
        const existingDistance = existing.rows[0].distance;
  
        if (distance <= existingDistance) {
          return res.status(200).json({ 
            type: "submit-distance", 
            message: "Existing distance is further or equal. Submission ignored." 
          });
        }
  
        // Update user's distance if new one is better
        await pool.query(
          "UPDATE endless_distances SET distance = $1, timestamp = NOW() WHERE user_id = $2",
          [distance, userId]
        );
      } else {
        // No existing distance — insert new
        await pool.query(
          "INSERT INTO endless_distances (user_id, distance) VALUES ($1, $2)",
          [userId, distance]
        );
      }
  
      res.status(201).json({ 
        type: "submit-distance", 
        message: "Distance submitted successfully."
      });
      
    } catch (error) {
      console.error("Error submitting distance", error);
      res.status(500).json({ type: "submit-distance", message: "Internal server error" });
    }
  });
  

// Retrieve leaderboard
router.get("/", async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT username, distance, timestamp 
         FROM endless_distances 
         JOIN users ON endless_distances.user_id = users.id 
         ORDER BY distance DESC 
         LIMIT 10`
      );
  
      res.json({
        type: "get-endless-leaderboard",
        scores: result.rows
      });
    } catch (error) {
      console.error("Error fetching endless leaderboard", error);
      res.status(500).json({ type: "get-endless-leaderboard", message: "Internal server error" });
    }
  });
  
  module.exports = router;