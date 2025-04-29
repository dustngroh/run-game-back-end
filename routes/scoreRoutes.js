// routes/scoreRoutes.js
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

// POST Score submission route
// Submit a new completion time only if it's better than the user's previous time
router.post("/", verifyToken, async (req, res) => {
  const { level_number, completion_time, replay_data } = req.body;
  const userId = req.userId;

  try {
      // Check existing time for user
      const existing = await pool.query(
          "SELECT completion_time FROM completion_times WHERE user_id = $1 AND level_number = $2",
          [userId, level_number]
      );

      let personalRecord = false;
      let worldRecord = false;

      if (existing.rows.length > 0) {
          const existingTime = existing.rows[0].completion_time;

          if (completion_time >= existingTime) {
              return res.status(200).json({ 
                  type: "submit-score", 
                  message: "Existing time is faster or equal. Submission ignored." 
              });
          }

          // Update user's time
          await pool.query(
              "UPDATE completion_times SET completion_time = $1, replay_data = $2, timestamp = NOW() WHERE user_id = $3 AND level_number = $4",
              [completion_time, replay_data, userId, level_number]
          );

          personalRecord = true;
      } else {
          // Insert new time for user
          await pool.query(
              "INSERT INTO completion_times (user_id, level_number, completion_time, replay_data, timestamp) VALUES ($1, $2, $3, $4, NOW())",
              [userId, level_number, completion_time, replay_data]
          );

          personalRecord = true;
      }

      // Check if this is now the world record
      const bestTimeResult = await pool.query(
          `SELECT user_id, completion_time 
           FROM completion_times 
           WHERE level_number = $1 
           ORDER BY completion_time ASC, timestamp ASC 
           LIMIT 1`,
          [level_number]
      );

      if (bestTimeResult.rows.length > 0) {
          const bestTimeUserId = bestTimeResult.rows[0].user_id;
          if (bestTimeUserId === userId) {
              worldRecord = true;
          }
      }

      return res.status(200).json({ 
          type: "submit-score", 
          message: "Time submitted successfully.",
          personalRecord,
          worldRecord
      });

  } catch (error) {
      console.error("Error submitting time", error);
      res.status(500).json({ type: "submit-score", message: "Internal server error" });
  }
});
  

// GET Score route
// Get top 10 times for a level
router.get("/:levelNumber", async (req, res) => {
    const levelNumber = parseInt(req.params.levelNumber, 10);
  
    try {
      const result = await pool.query(
        `SELECT username, completion_time, timestamp 
         FROM completion_times 
         JOIN users ON completion_times.user_id = users.id 
         WHERE level_number = $1 
         ORDER BY completion_time ASC, timestamp ASC
         LIMIT 10`,
        [levelNumber]
      );
  
      res.json({
        type: "get-leaderboard",
        level: levelNumber,
        scores: result.rows
      });
    } catch (error) {
      console.error("Error fetching leaderboard", error);
      res.status(500).json({
        type: "get-leaderboard",
        message: "Internal server error"
      });
    }
});


// GET replay route
// Get replay for a specific user and level
router.get("/replay/:levelNumber/:username", async (req, res) => {
  const levelNumber = parseInt(req.params.levelNumber, 10);
  const username = req.params.username;

  try {
    const result = await pool.query(
      `SELECT completion_times.replay_data 
       FROM completion_times
       JOIN users ON completion_times.user_id = users.id
       WHERE completion_times.level_number = $1 AND users.username = $2
       ORDER BY completion_times.completion_time ASC
       LIMIT 1`,
      [levelNumber, username]
    );

    if (result.rows.length === 0 || !result.rows[0].replay_data) {
      return res.status(404).json({ type: "get-replay", message: "Replay not found" });
    }

    res.json({
      type: "get-replay",
      replay_data: result.rows[0].replay_data
    });
  } catch (error) {
    console.error("Error fetching replay", error);
    res.status(500).json({ type: "get-replay", message: "Internal server error" });
  }
});


module.exports = router;
