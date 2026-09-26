const Message = require('../models/Message');

// Handle Twilio Voice Webhook (IVR)
exports.handleIncomingCall = async (req, res) => {
  try {
    const { phoneNumber } = req.query; // e.g., target user's phone number

    // Find the latest unread message for this user
    let speechText = "You have no new email messages.";
    if (phoneNumber) {
      const latestMessage = await Message.findOne({ recipientPhone: phoneNumber }).sort({ createdAt: -1 });
      if (latestMessage) {
        speechText = `You have a new email from ${latestMessage.sender}. The subject is: ${latestMessage.subject || 'No subject'}.`;
      }
    }

    // Generate TwiML (Twilio XML response) to speak the text to the user
    res.type('text/xml');
    res.send(`
      <Response>
        <Say voice="alice">${speechText}</Say>
        <Pause length="1"/>
        <Say voice="alice">Thank you for using Phone Email. Goodbye.</Say>
      </Response>
    `);
  } catch (error) {
    console.error('IVR Error:', error);
    res.type('text/xml');
    res.send(`
      <Response>
        <Say>Sorry, an error occurred while fetching your messages.</Say>
      </Response>
    `);
  }
};