const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  recipientPhone: { type: String, required: true, index: true }, // e.g., "+919876543210"
  sender: { type: String, required: true }, // Sender's email or phone
  subject: { type: String },
  body: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', messageSchema);