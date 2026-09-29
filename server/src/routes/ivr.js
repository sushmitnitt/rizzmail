const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "RizzMail IVR server is working!"
  });
});

router.post("/create-account", async (req, res) => {
  try {
    const phoneNumber = req.body.phoneNumber;

    console.log("IVR PHONE:", phoneNumber);

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required"
      });
    }

    let user = await User.findOne({ phoneNumber });

    if (user) {
      return res.json({
        success: true,
        message: "Account already exists"
      });
    }

    await User.create({
      phoneNumber: phoneNumber
    });

    console.log("ACCOUNT CREATED:", phoneNumber);

    return res.json({
      success: true,
      message: "RizzMail account created successfully"
    });

  } catch (error) {
    console.error("IVR ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;