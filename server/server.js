const express = require("express");
const cors = require("cors");
const path = require("path");
const { runScanner } = require("../scanner/scanner");

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend files
app.use(express.static(path.join(__dirname, "../client")));

// Root route: serve HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// Scan API
app.post("/scan", async (req, res) => {
  const { path: projectPath } = req.body;
  if (!projectPath) return res.status(400).json({ error: "Path required" });

  try {
    const output = await runScanner(projectPath);
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});