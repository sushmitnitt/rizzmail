const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  phoneNumber: { type: String, index: true },
  emailAddress: { type: String, index: true },
  recipient: { type: String, index: true },
  sender: { type: String, index: true },
  subject: String,
  body: String,
  attachment: String,
  quotedMessage: Object,
  senderName: String,
  senderPhoto: String,
  direction: String,
  isDeleted: { type: Boolean, default: false, index: true },
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

// CRITICAL: Compound indexes to eliminate in-memory sort limits
emailSchema.index({ phoneNumber: 1, createdAt: -1 });
emailSchema.index({ recipient: 1, createdAt: -1 });
emailSchema.index({ sender: 1, createdAt: -1 });
emailSchema.index({ emailAddress: 1, createdAt: -1 });

module.exports = mongoose.model('Email', emailSchema);