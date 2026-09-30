const express = require("express");
const router = express.Router();
const twilio = require("twilio");
const User = require("../models/User");

// Handle incoming call
router.post("/incoming-call", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  const gather = twiml.gather({
    numDigits: 1,
    action: "/api/ivr/handle-input",
    method: "POST",
  });

  gather.say(
    { voice: "alice" },
    "Welcome to Rizzmail. To create your account, please press 1."
  );

  twiml.say(
    { voice: "alice" },
    "We did not receive any input. Goodbye."
  );

  res.type("text/xml");
  res.send(twiml.toString());
});

// Handle digit pressed by caller
router.post("/handle-input", async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  const digitPressed = req.body.Digits;
  const callerPhoneNumber = req.body.From;

  console.log("Caller:", callerPhoneNumber);
  console.log("Digit pressed:", digitPressed);

  if (digitPressed !== "1") {
    twiml.say(
      { voice: "alice" },
      "Invalid selection. Goodbye."
    );

    res.type("text/xml");
    return res.send(twiml.toString());
  }

  try {
    let user = await User.findOne({
      phoneNumber: callerPhoneNumber,
    });

    if (user) {
      twiml.say(
        { voice: "alice" },
        "You already have a Rizzmail account. Goodbye."
      );
    } else {
      user = new User({
        phoneNumber: callerPhoneNumber,
        firstName: "IVR",
        lastName: "User",
        agreedToTerms: true,
        termsAgreed: true,
      });

      await user.save();

      console.log(
        "Rizzmail account created for:",
        callerPhoneNumber
      );

      twiml.say(
        { voice: "alice" },
        "Success! Your Rizzmail account has been created successfully. Goodbye."
      );
    }
  } catch (error) {
    console.error("IVR account creation error:", error);

    twiml.say(
      { voice: "alice" },
      "Sorry, we could not create your account. Please try again later."
    );
  }

  res.type("text/xml");
  res.send(twiml.toString());
});

module.exports = router;