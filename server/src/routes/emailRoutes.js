const express = require('express');
const router = express.Router();
const Email = require('../models/Email');
const User = require('../models/User');
const nodemailer = require('nodemailer');

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

// Configure outbound SMTP transporter (SendGrid)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Robust cleaner to strip raw email headers and extract only plain text
const extractCleanBody = (rawText) => {
  if (!rawText) return '';
  
  // If it doesn't look like a raw email source, return as is
  if (!rawText.includes('Received:') && !rawText.includes('Content-Type:')) {
    return rawText;
  }

  // Look for text/plain section if it's a multipart email from Gmail/Outlook
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

  // Fallback: Split by double newlines to skip headers
  const parts = rawText.split(/\r?\n\r?\n/);
  for (let i = parts.length - 1; i >= 1; i--) {
    const part = parts[i].trim();
    if (part && !part.includes(': ') && !part.startsWith('Content-') && !part.startsWith('--')) {
      return part;
    }
  }

  return rawText.substring(0, 300); // Ultimate fallback
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
    const senderFullEmail = `${senderNorm.pureDigits}@rizzmail.me`;

    // 1. Save outbound email record in MongoDB for user's "Sent" tab
    const outboundEmail = new Email({
      phoneNumber: senderNorm.pureDigits,
      recipient: normalizedRecipient,
      emailAddress: senderNorm.pureDigits,
      sender: senderFullEmail,
      subject: subject || 'No Subject',
      body: body,
      direction: 'outbound',
      date: new Date()
    });
    await outboundEmail.save();

    // 2. Handle Delivery
    if (normalizedRecipient.endsWith('@rizzmail.me')) {
      // INTERNAL DELIVERY: Instant MongoDB save & WebSocket push
      const recipientNorm = normalizePhone(normalizedRecipient);

      const inboundEmail = new Email({
        phoneNumber: recipientNorm.pureDigits,
        recipient: recipientNorm.alias,
        emailAddress: recipientNorm.pureDigits,
        sender: senderFullEmail,
        subject: subject || 'No Subject',
        body: body,
        direction: 'inbound',
        date: new Date(),
        createdAt: new Date()
      });
      await inboundEmail.save();

      const io = req.app.get('io');
      if (io) {
        io.to(recipientNorm.pureDigits).emit('new_message', inboundEmail);
        io.to(recipientNorm.alias).emit('new_message', inboundEmail);
      }
    } else {
      // EXTERNAL DELIVERY: Send via SMTP to outside domains (Gmail, Yahoo, etc.)
      await transporter.sendMail({
        from: `"RizzMail User" <noreply@rizzmail.me>`,
        replyTo: senderFullEmail,
        to: normalizedRecipient,
        subject: subject || 'No Subject',
        text: body,
        html: `<div style="font-family:sans-serif; padding:10px;"><p>${body}</p><hr/><small style="color:#666;">Sent securely via rizzmail.me burner inbox (${senderFullEmail})</small></div>`
      });
      console.log(`🚀 External email successfully sent from ${senderFullEmail} to ${normalizedRecipient}`);
    }

    res.status(200).json({ success: true, message: 'Email sent successfully!' });
  } catch (err) {
    console.error('❌ Send email error:', err);
    res.status(500).json({ error: 'Server error sending email: ' + err.message });
  }
});

// Cloudflare Email Worker Webhook Receiver (Direct HTTP Ingestion)
router.post('/webhook', async (req, res) => {
  try {
    const { recipient, sender, subject, body } = req.body;

    if (!recipient) {
      return res.status(400).json({ success: false, message: 'Recipient required' });
    }

    const recipientNorm = normalizePhone(recipient);
    const cleanBodyText = extractCleanBody(body);

    const newEmail = new Email({
      phoneNumber: recipientNorm.pureDigits,
      emailAddress: recipientNorm.pureDigits,
      recipient: recipientNorm.alias,
      sender: sender || 'unknown@domain.com',
      subject: subject || 'No Subject',
      body: cleanBodyText,
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