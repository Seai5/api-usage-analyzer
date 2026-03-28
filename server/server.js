const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const { runScanner } = require("../scanner/scanner");
const simpleGit = require("simple-git");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../client")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

app.post("/scan", async (req, res) => {
  let { target } = req.body;
  if (!target) return res.status(400).json({ error: "Please provide a GitHub URL or local path" });

  // Clean .git if user pastes it
  target = target.replace(/\.git$/, "");

  let scanPath = target;
  let isCloned = false;

  if (target.includes("github.com")) {
    const tempDir = path.join(__dirname, "../temp", Date.now().toString());
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      console.log(`Cloning shallow... ${target}`);

      await simpleGit().clone(target, tempDir, ["--depth", "1", "-c", "core.longpaths=true"]);

      scanPath = tempDir;
      isCloned = true;
      console.log("✅ Clone successful");
    } catch (err) {
      console.error("Clone error:", err.message);
      if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
      return res.status(500).json({ error: "Failed to clone repository. Try a smaller public repo." });
    }
  }

  try {
    const start = Date.now();
    const output = await runScanner(scanPath);
    const duration = Math.round((Date.now() - start) / 1000);

    if (isCloned && fs.existsSync(scanPath)) {
      fs.rmSync(scanPath, { recursive: true, force: true });
    }

    res.json({
      success: true,
      ...output,
      scanTimeSeconds: duration,
      message: isCloned ? "Scanned from GitHub repo" : "Scanned local folder"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 APILeak running at http://localhost:${PORT}`);
});