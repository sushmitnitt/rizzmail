const express = require("express");
const router = express.Router();
const crypto = require("crypto");

// In-memory or MongoDB alias store for active session
let activeAliases = [];

// Generate a random burner alias
router.post("/generate", (req, res) => {
  const randomString = crypto.randomBytes(3).toString("hex");
  const adjectives = ["cyber", "ghost", "neon", "phantom", "quantum", "apex", "zenith"];
  const nouns = ["fox", "viper", "hawk", "raven", "storm", "pulse", "core"];
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  const aliasEmail = `${adj}_${noun}_${randomString}@rizzmail.me`;
  
  activeAliases.push({
    email: aliasEmail,
    createdAt: new Date(),
    messagesCount: 0
  });

  res.json({ success: true, alias: aliasEmail, activeAliases });
});

// Get all active aliases for user
router.get("/list", (req, res) => {
  res.json({ success: true, aliases: activeAliases });
});

module.exports = router;
