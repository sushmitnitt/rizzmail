const express = require("express");
const router = express.Router();
const User = require("../models/User");

router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "RizzMail IVR server is working!"
  });
});

router.post("/welcome", (req, res) => {
  const twiml = `
<Response>
  <Gather
    numDigits="1"
    action="action="https://rizzmail-backend.onrender.com/api/ivr/handle-choice"
    method="POST"
    timeout="10"
  >
    <Say>
      Welcome to RizzMail.
      To create a RizzMail account using this phone number, press 1.
    </Say>
  </Gather>

  <Say>
    We did not receive your choice. Goodbye.
  </Say>
</Response>
`;

  res.type("text/xml");
  res.send(twiml);
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