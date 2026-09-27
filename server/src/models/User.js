const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true, unique: true, index: true },
  name: { type: String, default: "" },
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  photo: { type: String, default: "" },
  profilePhoto: { type: String, default: "" },
  birthdate: { type: String, default: "" },
  birthdateLocked: { type: Boolean, default: false },
  termsAgreed: { type: Boolean, default: false },
  agreedToTerms: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", userSchema);