const express = require('express');
const router = express.Router();
const Email = require('../models/Email');
const User = require('../models/User');

// Helper to normalize phone numbers into pure 10 digits and standard aliases
const normalizePhone = (input) => {
  if (!input) return { pureDigits: '', alias: '' };
  const cleaned = input.toString().trim();
  const pureDigits = cleaned.replace(/[^0-9]/g, '');
  const tenDigits = pureDigits.length > 10 ? pureDigits.slice(-10) : pureDigits;
  return {
    pureDigits: tenDigits,
    alias: `${tenDigits}@rizzmail.me`,
    raw: cleaned
  };
};

// GET all emails for a specific address (supports route param)
router.get('/:emailAddress', async (req, res) => {
  try {
    const emailAddress = req.params.emailAddress.toLowerCase();
    const emails = await Email.find({ 
      $or: [
        { emailAddress },
        { recipient: emailAddress }
      ]
    }).sort({ date: -1, createdAt: -1 });
    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching emails' });
  }
});

// Also support query param version: /api/email?address=...
router.get('/', async (req, res) => {
  try {
    const emailAddress = (req.query.address || '').toLowerCase();
    if (!emailAddress) {
      return res.status(400).json({ error: 'Email address is required' });
    }
    const emails = await Email.find({ 
      $or: [
        { emailAddress },
        { recipient: emailAddress }
      ]
    }).sort({ date: -1, createdAt: -1 });
    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching emails' });
  }
});

// Fetch messages by phone number or alias (used by frontend fetchMessages)
router.get('/messages/:phone', async (req, res) => {
  try {
    const { pureDigits, alias } = normalizePhone(req.params.phone);

    const emails = await Email.find({
      $or: [
        { emailAddress: alias },
        { recipient: alias },
        { emailAddress: pureDigits },
        { recipient: { $regex: pureDigits,$options: 'i' } },
        { phoneNumber: pureDigits }
      ]
    }).sort({ date: -1, createdAt: -1 });

    res.json(emails);
  } catch (err) {
    console.error('❌ Fetch messages error:', err);
    res.status(500).json({ error: 'Server error fetching messages' });
  }
});

// Send email route (Outbound & internal rizzmail delivery)
router.post('/send', async (req, res) => {
  try {
    const { senderPhone, recipientEmail, subject, body } = req.body;

    if (!senderPhone || !recipientEmail || !body) {
      return res.status(400).json({ error: 'Sender, recipient, and body are required.' });
    }

    const senderNorm = normalizePhone(senderPhone);
    const normalizedRecipient = recipientEmail.toLowerCase().trim();

    // 1. Save outbound email for sender
    const outboundEmail = new Email({
      recipient: normalizedRecipient,
      emailAddress: senderNorm.alias,
      sender: senderNorm.alias,
      subject: subject || 'No Subject',
      body: body,
      direction: 'outbound',
      date: new Date()
    });
    await outboundEmail.save();

    // 2. If recipient is a rizzmail.me address, instantly deliver it to their inbox
    if (normalizedRecipient.endsWith('@rizzmail.me')) {
      const recipientNorm = normalizePhone(normalizedRecipient);

      const inboundEmail = new Email({
        phoneNumber: recipientNorm.pureDigits,
        recipient: recipientNorm.alias,
        emailAddress: recipientNorm.pureDigits,
        sender: senderNorm.alias,
        subject: subject || 'No Subject',
        body: body,
        direction: 'inbound',
        date: new Date()
      });
      await inboundEmail.save();

      // Broadcast via Socket.io if available
      const io = req.app.get('io');
      if (io) {
        io.to(recipientNorm.pureDigits).emit('new_message', inboundEmail);
        io.to(recipientNorm.alias).emit('new_message', inboundEmail);
      }
    }

    res.status(200).json({ success: true, message: 'Email sent successfully!' });
  } catch (err) {
    console.error('❌ Send email error:', err);
    res.status(500).json({ error: 'Server error sending email' });
  }
});

// Cloudflare Email Worker Webhook Receiver (Direct HTTP Ingestion)
// Helper to clean raw email text and extract only the message body
const cleanEmailBody = (rawText) => {
  if (!rawText) return '';
  
  // Strip out email headers (everything before the first double newline)
  let bodyPart = rawText;
  const doubleNewlineIndex = rawText.indexOf('\r\n\r\n');
  const doubleNewlineIndexAlt = rawText.indexOf('\n\n');
  
  if (doubleNewlineIndex !== -1 && doubleNewlineIndex < 2500) {
    bodyPart = rawText.slice(doubleNewlineIndex + 4);
  } else if (doubleNewlineIndexAlt !== -1 && doubleNewlineIndexAlt < 2500) {
    bodyPart = rawText.slice(doubleNewlineIndexAlt + 2);
  }

  // Clean up MIME boundaries and content type artifacts
  let cleaned = bodyPart
    .replace(/Content-Type:[\s\S]*?\r?\n\r?\n/gi, '')
    .replace(/Content-Transfer-Encoding:[\s\S]*?\r?\n/gi, '')
    .replace(/--[a-zA-Z0-9-_=.]+/g, '') // Remove MIME boundaries
    .replace(/text\/plain|text\/html|multipart\/alternative/gi, '')
    .trim();

  return cleaned || rawText.substring(0, 300);
};

// Cloudflare Email Worker Webhook Receiver (Direct HTTP Ingestion)
router.post('/webhook', async (req, res) => {
  try {
    const { recipient, sender, subject, body } = req.body;

    if (!recipient) {
      return res.status(400).json({ success: false, message: 'Recipient required' });
    }

    const recipientNorm = normalizePhone(recipient);
    const parsedBody = cleanEmailBody(body); // <--- Cleaned message body

    const newEmail = new Email({
      phoneNumber: recipientNorm.pureDigits,
      emailAddress: recipientNorm.pureDigits,
      recipient: recipientNorm.alias,
      sender: sender || 'unknown@domain.com',
      subject: subject || 'No Subject',
      body: parsedBody, // <--- Saves only clean text
      direction: 'inbound',
      date: new Date(),
      createdAt: new Date()
    });

    await newEmail.save();

    // Instant real-time WebSocket broadcast
    const io = req.app.get('io');
    if (io) {
      io.to(recipientNorm.pureDigits).emit('new_message', newEmail);
      io.to(recipientNorm.alias).emit('new_message', newEmail);
    }

    console.log(`✅ Clean inbound email saved for: ${recipientNorm.alias}`);
    return res.status(200).json({ success: true, message: 'Webhook email processed successfully' });
  } catch (err) {
    console.error('❌ Webhook error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Flexible Inbox fetcher
router.get('/inbox/:phoneNumber', async (req, res) => {
  try {
    const { pureDigits, alias } = normalizePhone(req.params.phoneNumber);
    if (!pureDigits) return res.status(400).json({ success: false, message: 'Phone number required' });

    const emails = await Email.find({ 
      $or: [
        { phoneNumber: pureDigits },
        { emailAddress: pureDigits },
        { recipient: alias },
        { recipient: { $regex: pureDigits,$options: 'i' } }
      ]
    }).sort({ createdAt: -1, date: -1 });

    res.status(200).json({ success: true, emails });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simulate incoming email endpoint (for testing & evaluation)
router.post('/simulate-incoming', async (req, res) => {
  try {
    const { phone, sender, subject, body } = req.body;
    const phoneNorm = normalizePhone(phone);

    const newEmail = new Email({
      phoneNumber: phoneNorm.pureDigits,
      recipient: phoneNorm.alias,
      emailAddress: phoneNorm.pureDigits,
      sender: sender || 'evaluator@rizzmail.me',
      subject: subject || 'Simulated Test Email',
      body: body || 'This is a live simulated incoming message.',
      direction: 'inbound',
      date: new Date()
    });
    await newEmail.save();

    const io = req.app.get('io');
    if (io) {
      io.to(phoneNorm.pureDigits).emit('new_message', newEmail);
      io.to(phoneNorm.alias).emit('new_message', newEmail);
    }

    res.status(200).json({ success: true, email: newEmail });
  } catch (err) {
    console.error('❌ Simulation error:', err);
    res.status(500).json({ error: 'Simulation failed' });
  }
});

// Delete single message
router.delete('/message/:id', async (req, res) => {
  try {
    await Email.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

// Delete account and associated data
router.delete('/account/:phone', async (req, res) => {
  try {
    const { pureDigits, alias } = normalizePhone(req.params.phone);

    await User.findOneAndDelete({ phoneNumber: { $regex: pureDigits } });
    await Email.deleteMany({
      $or: [
        { emailAddress: pureDigits },
        { recipient: alias },
        { recipient: { $regex: pureDigits,$options: 'i' } }
      ]
    });

    res.json({ success: true, message: 'Account and data successfully deleted.' });
  } catch (err) {
    console.error('❌ Account deletion error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;