const express = require('express');
const router = express.Router();
const Email = require('../models/Email');
const User = require('../models/User');
const axios = require('axios');

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

// Helper to fetch sender name and profile photo from User model
const getSenderDetails = async (phoneOrEmail) => {
  try {
    if (!phoneOrEmail) return { name: 'User', photo: '' };
    const clean = phoneOrEmail.toString().replace(/[^0-9]/g, '').slice(-10);
    const user = await User.findOne({
      $or: [
        { phoneNumber: { $regex: clean,$options: 'i' } },
        { phoneNumber: phoneOrEmail }
      ]
    });
    if (!user) return { name: phoneOrEmail.split('@')[0], photo: '' };
    const name = user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user.name || phoneOrEmail.split('@')[0]);
    const photo = user.profilePhoto || user.photo || '';
    return { name, photo };
  } catch (err) {
    return { name: phoneOrEmail?.split('@')[0] || 'User', photo: '' };
  }
};

// Robust cleaner to strip raw email headers and extract only plain text
const extractCleanBody = (rawText) => {
  if (!rawText) return '';
  if (!rawText.includes('Received:') && !rawText.includes('Content-Type:')) {
    return rawText;
  }
  const plainIndex = rawText.indexOf('Content-Type: text/plain');
  if (plainIndex !== -1) {
    const textSection = rawText.slice(plainIndex);
    const doubleNewline = textSection.indexOf('\r\n\r\n') !== -1 ? textSection.indexOf('\r\n\r\n') : textSection.indexOf('\n\n');
    if (doubleNewline !== -1) {
      const content = textSection.slice(doubleNewline + (textSection.indexOf('\r\n\r\n') !== -1 ? 4 : 2));
      const endBoundary = content.indexOf('--');
      return (endBoundary !== -1 ? content.slice(0, endBoundary) : content).trim();
    }
  }
  const parts = rawText.split(/\r?\n\r?\n/);
  for (let i = parts.length - 1; i >= 1; i--) {
    const part = parts[i].trim();
    if (part && !part.includes(': ') && !part.startsWith('Content-') && !part.startsWith('--')) {
      return part;
    }
  }
  return rawText.substring(0, 300);
};

// GET all emails for a specific address
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

// Fetch messages by phone number or alias
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

// Send email route (Outbound via SendGrid HTTP API & internal rizzmail delivery)
router.post('/send', async (req, res) => {
  try {
    const { senderPhone, recipientEmail, subject, body } = req.body;

    if (!senderPhone || !recipientEmail || !body) {
      return res.status(400).json({ error: 'Sender, recipient, and body are required.' });
    }

    const senderNorm = normalizePhone(senderPhone);
    const normalizedRecipient = recipientEmail.toLowerCase().trim();
    const senderFullEmail = `${senderNorm.pureDigits}@rizzmail.me`;

    // Fetch sender profile details (Name & DP) from User collection
    const senderDetails = await getSenderDetails(senderNorm.pureDigits);

    // 1. Save outbound record for sender's "Sent" tab
    const outboundEmail = new Email({
      phoneNumber: senderNorm.pureDigits,
      recipient: normalizedRecipient,
      emailAddress: senderNorm.pureDigits,
      sender: senderFullEmail,
      subject: subject || 'No Subject',
      body: body,
      senderName: senderDetails.name,
      senderPhoto: senderDetails.photo,
      direction: 'outbound',
      date: new Date(),
      createdAt: new Date()
    });
    await outboundEmail.save();

    // Broadcast outbound message to user's connected socket rooms so Sent tab updates live
    const io = req.app.get('io');
    if (io) {
      io.to(senderNorm.pureDigits).emit('new_message', outboundEmail);
      io.to(senderNorm.alias).emit('new_message', outboundEmail);
    }

    // 2. Delivery logic
    if (normalizedRecipient.endsWith('@rizzmail.me')) {
      const recipientNorm = normalizePhone(normalizedRecipient);

      const inboundEmail = new Email({
        phoneNumber: recipientNorm.pureDigits,
        recipient: recipientNorm.alias,
        emailAddress: recipientNorm.pureDigits,
        sender: senderFullEmail,
        subject: subject || 'No Subject',
        body: body,
        senderName: senderDetails.name,
        senderPhoto: senderDetails.photo,
        direction: 'inbound',
        date: new Date(),
        createdAt: new Date()
      });
      await inboundEmail.save();

      if (io) {
        io.to(recipientNorm.pureDigits).emit('new_message', inboundEmail);
        io.to(recipientNorm.alias).emit('new_message', inboundEmail);
      }
    } else {
      // EXTERNAL DELIVERY: Send via SendGrid HTTP API (Port 443)
      const sendgridApiKey = process.env.SENDGRID_API_KEY || process.env.SMTP_PASS;
      
      if (!sendgridApiKey) {
        throw new Error('SendGrid API key not configured in Render environment variables.');
      }

      await axios.post('https://api.sendgrid.com/v3/mail/send', {
        personalizations: [
          {
            to: [{ email: normalizedRecipient }]
          }
        ],
        from: {
          email: senderFullEmail,
          name: senderDetails.name || 'RizzMail User'
        },
        reply_to: {
          email: senderFullEmail
        },
        subject: subject || 'No Subject',
        content: [
          {
            type: 'text/plain',
            value: body
          }
        ]
      }, {
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 
      });

      console.log(`🚀 External email successfully sent via SendGrid API from ${senderFullEmail} to ${normalizedRecipient}`);
    }

    res.status(200).json({ success: true, message: 'Email sent successfully!', email: outboundEmail });
  } catch (err) {
    console.error('❌ Send email error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Server error sending email: ' + (err.response?.data?.errors?.[0]?.message || err.message) });
  }
});

// Cloudflare Email Worker Webhook Receiver
router.post('/webhook', async (req, res) => {
  try {
    const { recipient, sender, subject, body } = req.body;

    if (!recipient) {
      return res.status(400).json({ success: false, message: 'Recipient required' });
    }

    const recipientNorm = normalizePhone(recipient);
    const cleanBodyText = extractCleanBody(body);
    const senderDetails = await getSenderDetails(sender);

    const newEmail = new Email({
      phoneNumber: recipientNorm.pureDigits,
      emailAddress: recipientNorm.pureDigits,
      recipient: recipientNorm.alias,
      sender: sender || 'unknown@domain.com',
      subject: subject || 'No Subject',
      body: cleanBodyText,
      senderName: senderDetails.name,
      senderPhoto: senderDetails.photo,
      direction: 'inbound',
      date: new Date(),
      createdAt: new Date()
    });

    await newEmail.save();

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

// Simulate incoming email endpoint
router.post('/simulate-incoming', async (req, res) => {
  try {
    const { phone, sender, subject, body } = req.body;
    const phoneNorm = normalizePhone(phone);
    const senderDetails = await getSenderDetails(sender || 'evaluator@rizzmail.me');

    const newEmail = new Email({
      phoneNumber: phoneNorm.pureDigits,
      recipient: phoneNorm.alias,
      emailAddress: phoneNorm.pureDigits,
      sender: sender || 'evaluator@rizzmail.me',
      subject: subject || 'Simulated Test Email',
      body: body || 'This is a live simulated incoming message.',
      senderName: senderDetails.name,
      senderPhoto: senderDetails.photo,
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
    const { id } = req.params;
    await Email.findByIdAndDelete(id);
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