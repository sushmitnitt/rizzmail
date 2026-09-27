const express = require("express");
const router = express.Router();
const Otp = require("../models/Otp");
const User = require("../models/User");

let sendEmailNotificationSMS;
try {
  const smsModule = require("../services/smsService");
  sendEmailNotificationSMS = smsModule.sendEmailNotificationSMS;
} catch (e) {
  sendEmailNotificationSMS = async () => true;
}

// 1. Send OTP Route
router.post("/send-otp", async (req, res) => {
  try {
    const { phone, phoneNumber } = req.body || {};
    const targetPhone = phone || phoneNumber;

    if (!targetPhone || targetPhone === 'undefined' || targetPhone === 'null') {
      return res.status(400).json({ success: false, message: "Valid phone number is required" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate(
      { phone: targetPhone },
      { otp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    console.log(`🔑 Generated & Saved OTP in MongoDB for ${targetPhone}: ${otp}`);

    try {
      if (sendEmailNotificationSMS) {
        await sendEmailNotificationSMS(targetPhone, "RizzMail Auth", `Your verification OTP is ${otp}`);
      }
    } catch (smsErr) {
      console.warn("⚠️ SMS dispatch failed safely:", smsErr.message);
    }

    return res.json({ 
      success: true, 
      message: "OTP generated successfully", 
      devOtp: otp 
    });
  } catch (err) {
    console.error("❌ Critical error in /send-otp route:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 2. Verify OTP Route
router.post("/verify-otp", async (req, res) => {
  try {
    const { phone, phoneNumber, otp } = req.body || {};
    const targetPhone = phone || phoneNumber;

    if (!targetPhone || targetPhone === 'undefined' || targetPhone === 'null' || !otp) {
      return res.status(400).json({ success: false, message: "Valid phone and otp are required" });
    }

    const record = await Otp.findOne({ phone: targetPhone });
    if (!record) {
      return res.status(400).json({ success: false, message: "No active OTP found for this number" });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP code" });
    }

    await Otp.deleteOne({ phone: targetPhone });

    // Check if user exists. If new, create clean record without forcing dummy profile data.
    let user = await User.findOne({ phoneNumber: targetPhone });
    if (!user) {
      user = new User({
        phoneNumber: targetPhone,
        termsAgreed: false
      });
      await user.save();
    }

    return res.json({ 
      success: true, 
      message: "Phone verified successfully!", 
      user 
    });
  } catch (err) {
    console.error("❌ Critical error in /verify-otp route:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// 3. Robust Profile Update Handler (Supports /profile & /update-profile with POST/PUT)
const handleProfileUpdate = async (req, res) => {
  try {
    const { 
      phone, 
      phoneNumber, 
      name, 
      firstName, 
      lastName, 
      photo, 
      profilePhoto, 
      birthdate, 
      dob, 
      termsAgreed, 
      agreedToTerms 
    } = req.body || {};
    
    const targetPhone = phone || phoneNumber;
    if (!targetPhone || targetPhone === 'undefined' || targetPhone === 'null') {
      return res.status(400).json({ success: false, message: "Valid phone number is required" });
    }

    const finalBirthdate = birthdate || dob;

    // Validate Age >= 13
    if (finalBirthdate) {
      const dobDate = new Date(finalBirthdate);
      if (!isNaN(dobDate.getTime())) {
        const ageDifMs = Date.now() - dobDate.getTime();
        const ageDate = new Date(ageDifMs);
        const age = Math.abs(ageDate.getUTCFullYear() - 1970);

        if (age < 13) {
          return res.status(400).json({ success: false, message: "You must be at least 13 years old to use RizzMail." });
        }
      }
    }

    let user = await User.findOne({ phoneNumber: targetPhone });

    if (user && user.birthdate && user.birthdateLocked) {
      if (finalBirthdate && finalBirthdate !== user.birthdate) {
        return res.status(400).json({ success: false, message: "Birthdate is permanently locked and cannot be modified." });
      }
    }

    let finalName = name;
    if (!finalName && (firstName || lastName)) {
      finalName = `${firstName || ""} ${lastName || ""}`.trim();
    }

    const finalPhoto = photo !== undefined ? photo : profilePhoto;
    const finalTerms = termsAgreed !== undefined ? termsAgreed : agreedToTerms;

    const updateData = {};
    if (finalName !== undefined) updateData.name = finalName;
    if (finalPhoto !== undefined) updateData.photo = finalPhoto;
    if (finalTerms !== undefined) updateData.termsAgreed = finalTerms;

    if (finalBirthdate && (!user || !user.birthdate)) {
      updateData.birthdate = finalBirthdate;
      updateData.birthdateLocked = true;
    }

    user = await User.findOneAndUpdate(
      { phoneNumber: targetPhone },
      { $set: updateData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`✅ Profile updated successfully for ${targetPhone}`);
    return res.json({ success: true, message: "Profile saved successfully!", user });
  } catch (err) {
    console.error("❌ Critical error in profile update route:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};

// Register profile routes under all common paths/methods used by frontends
router.post("/update-profile", handleProfileUpdate);
router.put("/update-profile", handleProfileUpdate);
router.post("/profile", handleProfileUpdate);
router.put("/profile", handleProfileUpdate);

// 4. Delete Account Route
router.delete("/account/:phone", async (req, res) => {
  try {
    const targetPhone = req.params.phone;
    await User.findOneAndDelete({ phoneNumber: targetPhone });
    console.log(`🗑️ Account successfully deleted for: ${targetPhone}`);
    return res.json({ success: true, message: "Account successfully deleted" });
  } catch (err) {
    console.error("❌ Account deletion error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DEBUG ENDPOINT: Fetch active OTP directly from MongoDB
router.get("/db-otp/:phone", async (req, res) => {
  try {
    const record = await Otp.findOne({ phone: req.params.phone });
    if (!record) {
      return res.status(404).json({ success: false, message: "No active OTP found in database for this phone number." });
    }
    return res.json({ success: true, phone: record.phone, otp: record.otp });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;