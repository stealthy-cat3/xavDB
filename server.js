// server.js
const express = require("express");
const sql = require("mssql");
const cors = require("cors");
require("dotenv").config();

// Initialize app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Azure SQL Database configuration
const dbConfig = {
  user: process.env.DB_USER || "xavier",
  password: process.env.DB_PASSWORD || "Admin1234",
  server: process.env.DB_HOST || "xav.database.windows.net",
  database: process.env.DB_NAME || "xav",
  options: {
    encrypt: true, // Required for Azure
    enableArithAbort: true,
  },
};

// Connect to Azure SQL Database
sql.connect(dbConfig)
  .then(() => console.log("Connected to Azure SQL Database."))
  .catch((err) => console.error("Database connection failed: ", err));

// Routes

// Get all thoughts
app.get("/api/thoughts", async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);
    const result = await pool.request().query("SELECT * FROM thoughts");
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: "Error retrieving thoughts", error: err });
  }
});

// Add a new thought
app.post("/api/thoughts", async (req, res) => {
  const { title, content, date } = req.body;

  try {
    const pool = await sql.connect(dbConfig);
    const query = `INSERT INTO thoughts (title, content, date) OUTPUT INSERTED.id VALUES (@title, @content, @date)`;
    const result = await pool
      .request()
      .input("title", sql.NVarChar, title)
      .input("content", sql.NVarChar, content)
      .input("date", sql.DateTime, date)
      .query(query);

    const insertedId = result.recordset[0].id;
    res.status(201).json({ id: insertedId, title, content, date });
  } catch (err) {
    res.status(500).json({ message: "Error adding thought", error: err });
  }
});

// Delete a thought
app.delete("/api/thoughts/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await sql.connect(dbConfig);
    const query = "DELETE FROM thoughts WHERE id = @id";
    const result = await pool.request().input("id", sql.Int, id).query(query);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Thought not found" });
    }
    res.status(200).json({ message: "Thought deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting thought", error: err });
  }
});

// Start server
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server running on port ${port}`));
