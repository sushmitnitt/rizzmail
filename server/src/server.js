require('dotenv').config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const { startSmtpServer } = require("./smtp/smtpServer");
const startImapWorker = require('./services/imapWorker');

const app = express();
const server = http.createServer(app);

// Configure Socket.io with open CORS for real-time WebSocket syncing
const io = new Server(server, {
  cors: { 
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Configure Express CORS middleware to prevent blocking requests from frontend
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like Postman or mobile apps) or any domain
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Increase body size limit to 10mb to handle Base64 profile photo uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// MongoDB Database Connection
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rizzmail";
console.log("Attempting to connect with MONGO_URI:", MONGO_URI);

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB successfully!"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Attach Socket.io instance to app for use inside routes
app.set("io", io);

// Register API Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/email", require("./routes/emailRoutes"));

// Socket.io Connection Handler
io.on("connection", (socket) => {
  console.log("⚡ Client connected via WebSocket:", socket.id);

  // Join a room based on user/phone number for targeted inbox updates
  socket.on("join_inbox", (phone) => {
    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
      socket.join(cleanPhone);
      socket.join(`${cleanPhone}@rizzmail.me`);
      console.log(`📱 Socket ${socket.id} joined inbox room for: ${cleanPhone}`);
    }
  });

  socket.on("disconnect", () => {
    console.log("🔌 Client disconnected:", socket.id);
  });
});

// Start optional background workers safely
try {
  if (typeof startSmtpServer === 'function') {
    startSmtpServer(io);
  }
} catch (e) {
  console.log("ℹ️ SMTP local server bypassed.");
}

try {
  if (typeof startImapWorker === 'function') {
    startImapWorker(io);
  }
} catch (e) {
  console.log("ℹ️ IMAP worker bypassed.");
}

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 RizzMail Backend Server running on port ${PORT}`);
});