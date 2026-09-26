const VoiceServer = require("@fonoster/voice").default;
const User = require("../models/User"); // Ensure this points to your MongoDB User model

new VoiceServer().listen(async (req, voice) => {
  const { ingressNumber, callerNumber } = req;
  console.log(`Incoming call from ${callerNumber} to ${ingressNumber}`);

  try {
    await voice.answer();
    await voice.say("Welcome to Rizzmail. To create your secure mobile email account instantly, please press 1.");
    
    const gatherResult = await voice.gather({
      maxDigits: 1,
      timeout: 5000,
    });

    if (gatherResult && gatherResult.digits === "1") {
      const phoneNumber = callerNumber;

      let user = await User.findOne({ phoneNumber });

      if (!user) {
        user = new User({
          phoneNumber: phoneNumber,
          firstName: "IVR",
          lastName: "User",
          agreedToTerms: true,
          registeredVia: "Fonoster_IVR",
        });
        await user.save();
      }

      await voice.say("Success! Your phone mail account has been successfully created. You can now log into the portal. Goodbye.");
    } else {
      await voice.say("No valid input received. Goodbye.");
    }
  } catch (err) {
    console.error("IVR Error:", err);
    await voice.say("An error occurred while setting up your account. Please try again later.");
  } finally {
    await voice.hangup();
  }
});