const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  phoneNumber: { type: String, index: true },
  emailAddress: String,
  recipient: String,
  sender: String,
  subject: String,
  body: String,
  senderName: { type: String, default: '' },
  senderPhoto: { type: String, default: '' },
  direction: String,
  isDeleted: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Email', emailSchema);