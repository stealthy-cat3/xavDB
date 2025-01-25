const express = require("express");
const sql = require("mssql");
const cors = require("cors");
require("dotenv").config(); // Load environment variables for local testing

// Set the port dynamically for Azure or fallback to 8080
const port = process.env.PORT || 8080;

// Initialize app
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Azure SQL Database configuration
const dbConfig = {
  user: process.env.DB_USER || "xavier", // Replace with process.env for better security
  password: process.env.DB_PASSWORD || "Admin1234", // Replace with process.env
  server: process.env.DB_SERVER || "xav.database.windows.net", // Replace with process.env
  database: process.env.DB_NAME || "xav", // Replace with process.env
  options: {
    encrypt: true, // Required for Azure SQL
  },
};

// Initialize database connection pool
const poolPromise = sql
  .connect(dbConfig)
  .then((pool) => {
    console.log("Connected to Azure SQL Database.");
    return pool;
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1); // Exit the app if the connection fails
  });

// Routes

// Health check route for Azure pings
app.get("/", (req, res) => {
  res.send("App is running!");
});

// Get all thoughts
app.get("/thoughts", async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM thoughts");
    res.json(result.recordset);
  } catch (err) {
    console.error("Error retrieving thoughts:", err);
    res.status(500).json({ message: "Error retrieving thoughts", error: err });
  }
});

// Add a new thought
app.post("/thoughts", async (req, res) => {
  const { title, content, date } = req.body;

  if (!title || !content || !date) {
    return res.status(400).json({ message: "All fields are required." });
  }

  if (isNaN(Date.parse(date))) {
    return res.status(400).json({ message: "Invalid date format." });
  }

  try {
    const pool = await poolPromise;
    const query = `
      INSERT INTO thoughts (title, content, date)
      OUTPUT INSERTED.id VALUES (@title, @content, @date)`;
    const result = await pool
      .request()
      .input("title", sql.NVarChar, title)
      .input("content", sql.NVarChar, content)
      .input("date", sql.DateTime, new Date(date))
      .query(query);

    const insertedId = result.recordset[0].id;
    res.status(201).json({ id: insertedId, title, content, date });
  } catch (err) {
    console.error("Error adding thought:", err);
    res.status(500).json({ message: "Error adding thought", error: err });
  }
});

// Delete a thought
app.delete("/thoughts/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const pool = await poolPromise;
    const query = "DELETE FROM thoughts WHERE id = @id";
    const result = await pool.request().input("id", sql.Int, id).query(query);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({ message: "Thought not found" });
    }
    res.status(200).json({ message: "Thought deleted successfully." });
  } catch (err) {
    console.error("Error deleting thought:", err);
    res.status(500).json({ message: "Error deleting thought", error: err });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
