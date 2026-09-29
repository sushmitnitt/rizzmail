const mongoose = require('mongoose');

const emailSchema = new mongoose.Schema({
  phoneNumber: { type: String, index: true },
  emailAddress: { type: String, index: true },
  recipient: { type: String, required: true, index: true },
  sender: { type: String, required: true },
  subject: { type: String, default: 'No Subject' },
  body: { type: String, default: '' },
  htmlBody: { type: String, default: '' },
  attachment: { type: String, default: '' },
  quotedMessage: {
    id: String,
    sender: String,
    body: String
  },
  direction: { type: String, enum: ['inbound', 'outbound'], default: 'inbound' },
  senderName: { type: String, default: '' },
  senderPhoto: { type: String, default: '' },
  isDeleted: { type: Boolean, default: false },
  date: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Email', emailSchema);