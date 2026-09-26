const mongoose = require("mongoose");

const emailSchema = new mongoose.Schema({
  recipient: { type: String, required: true, index: true }, // e.g. 7007012049@rizzmail.com
  phone: { type: String, index: true }, // extracted phone number for easy lookup
  sender: { type: String, required: true },
  subject: { type: String, default: "No Subject" },
  body: { type: String, default: "" },
  direction: { type: String, enum: ['inbound', 'outbound'], default: 'inbound' },
  createdAt: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.model("Email", emailSchema);