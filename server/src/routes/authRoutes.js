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

// Send OTP Route
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

// Verify OTP Route
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

    const user = await User.findOne({ phoneNumber: targetPhone });
    const hasProfile = Boolean(user && user.name && user.birthdate && user.termsAgreed);

    return res.json({ 
      success: true, 
      message: "Phone verified successfully!", 
      hasProfile, 
      user: user || { phoneNumber: targetPhone } 
    });
  } catch (err) {
    console.error("❌ Critical error in /verify-otp route:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

// Update Profile Route
router.post("/update-profile", async (req, res) => {
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

    const updateData = {
      phoneNumber: targetPhone, // Explicitly enforce phoneNumber field matching the index
      name: finalName !== undefined ? finalName : (user?.name || ""),
      photo: finalPhoto !== undefined ? finalPhoto : (user?.photo || ""),
      termsAgreed: finalTerms !== undefined ? finalTerms : (user?.termsAgreed || false)
    };

    if (finalBirthdate && (!user || !user.birthdate)) {
      updateData.birthdate = finalBirthdate;
      updateData.birthdateLocked = true;
    }

    user = await User.findOneAndUpdate(
      { phoneNumber: targetPhone },
      updateData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`✅ Profile updated successfully for ${targetPhone}`);
    return res.json({ success: true, message: "Profile saved successfully!", user });
  } catch (err) {
    console.error("❌ Critical error in /update-profile route:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal server error" });
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