require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const { startSmtpServer } = require("./smtp/smtpServer");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json());

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rizzmail";
console.log("Attempting to connect with MONGO_URI:", MONGO_URI);

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Connected to Local MongoDB successfully!"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Register Auth Routes
app.set("io",io)
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/email", require("./routes/emailRoutes"));

io.on("connection", (socket) => {
  console.log("⚡ Client connected via WebSocket:", socket.id);
  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected:", socket.id);
  });
});

// Start SMTP Server on Port 2525
startSmtpServer(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 RizzMail Backend Server running on port ${PORT}`);
});