const express = require("express");
const twilio = require("twilio");
const User = require("../models/User");
const { toCanonical, phoneToEmail } = require("../utils/phone");

const router = express.Router();

const MAIL_DOMAIN = process.env.MAIL_DOMAIN || "rizzmail.me";

function getTwilioClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error("Twilio credentials are not configured");
  }

  return twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
}

// Start an outbound call
router.post("/start", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        error: "Phone number is required",
      });
    }

    const canonical = toCanonical(phone);
    const toNumber = `+${canonical}`;

    const client = getTwilioClient();

    const call = await client.calls.create({
      to: toNumber,
      from: process.env.TWILIO_FROM_NUMBER,
      url: `${process.env.PUBLIC_BASE_URL}/api/voice/welcome`,
      method: "POST",
    });

    res.json({
      ok: true,
      callSid: call.sid,
      message: "Call started",
    });
  } catch (err) {
    console.error("[voice] call failed:", err);

    res.status(500).json({
      error: err.message || "Unable to start call",
    });
  }
});


// What Twilio says when the user answers
router.post("/welcome", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  const gather = twiml.gather({
    numDigits: 1,
    action: `${process.env.PUBLIC_BASE_URL}/api/voice/create-account`,
    method: "POST",
    timeout: 10,
  });

  gather.say(
    {
      voice: "alice",
      language: "en-IN",
    },
    "Welcome to RizzMail. Press 1 to create your RizzMail account. Press 2 to cancel."
  );

  twiml.say(
    {
      voice: "alice",
      language: "en-IN",
    },
    "We did not receive your response. Goodbye."
  );

  res.type("text/xml");
  res.send(twiml.toString());
});


// Handle keypad input
router.post("/create-account", async (req, res) => {
  try {
    const digit = req.body.Digits;
    const callerNumber = req.body.To;

    const twiml = new twilio.twiml.VoiceResponse();

    if (digit !== "1") {
      twiml.say(
        {
          voice: "alice",
          language: "en-IN",
        },
        "Your account was not created. Goodbye."
      );

      twiml.hangup();

      res.type("text/xml");
      return res.send(twiml.toString());
    }

    const canonical = toCanonical(callerNumber);

    let user = await User.findOne({
      phone: canonical,
    });

    if (!user) {
      user = await User.create({
        phone: canonical,
        email: phoneToEmail(canonical, MAIL_DOMAIN),
        registeredVia: "ivr_call",
        hasMobileApp: false,
      });
    }

    twiml.say(
      {
        voice: "alice",
        language: "en-IN",
      },
      `Your RizzMail account has been created successfully. Your email address is ${user.email.replace(
        "@",
        " at "
      )}. Goodbye.`
    );

    twiml.hangup();

    res.type("text/xml");
    res.send(twiml.toString());
  } catch (err) {
    console.error("[voice] account creation failed:", err);

    const twiml = new twilio.twiml.VoiceResponse();

    twiml.say(
      {
        voice: "alice",
        language: "en-IN",
      },
      "Sorry, we were unable to create your account. Please try again later."
    );

    twiml.hangup();

    res.type("text/xml");
    res.send(twiml.toString());
  }
});

module.exports = router;