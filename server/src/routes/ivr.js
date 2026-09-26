const express = require('express');
const router = express.Router();
const twilio = require('twilio');
// Import your User model from MongoDB/PostgreSQL
const User = require('../models/User'); 

// 1. Handle Incoming Call & Prompt User to Press '1'
router.post('/incoming-call', (express.urlencoded({ extended: true })), (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  // Gather user input (looking for a single digit: '1')
  const gather = twiml.gather({
    numDigits: 1,
    action: '/api/ivr/handle-input',
    method: 'POST',
  });

  gather.say(
    { voice: 'alice' },
    'Welcome to Rizzmail. To create your secure mobile email account instantly, please press 1.'
  );

  // If user doesn't press anything
  twiml.say({ voice: 'alice' }, "We didn't receive any input. Goodbye.");
  
  res.type('text/xml');
  res.send(twiml.toString());
});

// 2. Handle the User's Input and Create the Account
router.post('/handle-input', (express.urlencoded({ extended: true })), async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  const digitPressed = req.body.Digits;
  const callerPhoneNumber = req.body.From; // e.g., "+919876543210"

  if (digitPressed === '1') {
    try {
      // Check if user already exists
      let user = await User.findOne({ phoneNumber: callerPhoneNumber });

      if (!user) {
        // Create account automatically via IVR
        user = new User({
          phoneNumber: callerPhoneNumber,
          firstName: 'IVR',
          lastName: 'User',
          agreedToTerms: true,
          registeredVia: 'IVR'
        });
        await user.save();
      }

      twiml.say(
        { voice: 'alice' },
        'Success! Your phone mail account has been created. You can now log into the web portal using your phone number and OTP. Goodbye.'
      );
    } catch (err) {
      console.error('IVR Account creation error:', err);
      twiml.say(
        { voice: 'alice' },
        'Sorry, an error occurred while setting up your account. Please try again later.'
      );
    }
  } else {
    twiml.say({ voice: 'alice' }, 'Invalid selection. Goodbye.');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

module.exports = router;