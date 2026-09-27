const express = require('express');
const router = express.Router();
const Email = require('../models/Email');
const User = require('../models/User');

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
    const phoneParam = req.params.phone;
    const cleanPhone = phoneParam.startsWith('+') ? phoneParam.slice(1) : phoneParam;
    const targetAlias = cleanPhone.includes('@') ? cleanPhone.toLowerCase() : `${cleanPhone}@rizzmail.me`;
    const purePhone = cleanPhone.replace('@rizzmail.me', '').replace(/[^0-9]/g, '');

    const emails = await Email.find({
      $or: [
        { emailAddress: targetAlias },
        { recipient: targetAlias },
        { emailAddress: purePhone },
        { recipient: { $regex: purePhone,$options: 'i' } }
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

    const cleanSenderPhone = senderPhone.startsWith('+') ? senderPhone.slice(1) : senderPhone;
    const senderAlias = cleanSenderPhone.includes('@') ? cleanSenderPhone.toLowerCase() : `${cleanSenderPhone}@rizzmail.me`;
    const normalizedRecipient = recipientEmail.toLowerCase().trim();

    // 1. Save outbound email for sender
    const outboundEmail = new Email({
      recipient: normalizedRecipient,
      emailAddress: senderAlias,
      sender: senderAlias,
      subject: subject || 'No Subject',
      body: body,
      direction: 'outbound',
      date: new Date()
    });
    await outboundEmail.save();

    // 2. If recipient is a rizzmail.me address, instantly deliver it to their inbox
    if (normalizedRecipient.endsWith('@rizzmail.me')) {
      const recipientClean = normalizedRecipient.replace('@rizzmail.me', '').trim();

      const inboundEmail = new Email({
        recipient: normalizedRecipient,
        emailAddress: recipientClean,
        sender: senderAlias,
        subject: subject || 'No Subject',
        body: body,
        direction: 'inbound',
        date: new Date()
      });
      await inboundEmail.save();

      // Broadcast via Socket.io if available
      const io = req.app.get('io');
      if (io) {
        io.to(recipientClean).emit('new_message', inboundEmail);
        io.to(normalizedRecipient).emit('new_message', inboundEmail);
      }
    }

    res.status(200).json({ success: true, message: 'Email sent successfully!' });
  } catch (err) {
    console.error('❌ Send email error:', err);
    res.status(500).json({ error: 'Server error sending email' });
  }
});

// Cloudflare Email Worker Webhook Receiver (Direct HTTP Ingestion)
router.post('/webhook', async (req, res) => {
  try {
    const { recipient, sender, subject, body } = req.body;
    
    if (!recipient) {
      return res.status(400).json({ error: 'Recipient is required' });
    }

    const cleanRecipient = recipient.replace('@rizzmail.me', '').trim().toLowerCase();
    const targetAlias = `${cleanRecipient}@rizzmail.me`;

    const newEmail = new Email({
      recipient: targetAlias,
      emailAddress: cleanRecipient,
      sender: sender || 'unknown@external.com',
      subject: subject || 'No Subject',
      body: body || '',
      direction: 'inbound',
      date: new Date()
    });
    
    await newEmail.save();

    // Broadcast live via Socket.io instantly
    const io = req.app.get('io');
    if (io) {
      io.to(cleanRecipient).emit('new_message', newEmail);
      io.to(targetAlias).emit('new_message', newEmail);
    }

    res.status(200).json({ success: true, message: 'Webhook email processed successfully' });
  } catch (err) {
    console.error('❌ Webhook ingestion error:', err);
    res.status(500).json({ error: 'Internal server error processing webhook' });
  }
});

// Simulate incoming email endpoint (for testing & evaluation)
router.post('/simulate-incoming', async (req, res) => {
  try {
    const { phone, sender, subject, body } = req.body;
    const cleanPhone = (phone || '').toString().replace(/^\+/, '').replace('@rizzmail.me', '').trim();
    const targetAlias = `${cleanPhone}@rizzmail.me`;

    const newEmail = new Email({
      recipient: targetAlias,
      emailAddress: cleanPhone,
      sender: sender || 'evaluator@rizzmail.me',
      subject: subject || 'Simulated Test Email',
      body: body || 'This is a live simulated incoming message.',
      direction: 'inbound',
      date: new Date()
    });
    await newEmail.save();

    const io = req.app.get('io');
    if (io) {
      io.to(cleanPhone).emit('new_message', newEmail);
      io.to(targetAlias).emit('new_message', newEmail);
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
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Delete account and associated data
router.delete('/account/:phone', async (req, res) => {
  try {
    const cleanPhone = req.params.phone.replace(/^\+/, '').replace('@rizzmail.me', '');
    const targetAlias = `${cleanPhone}@rizzmail.me`;

    await User.findOneAndDelete({ phoneNumber: { $regex: cleanPhone } });
    await Email.deleteMany({
      $or: [
        { emailAddress: cleanPhone },
        { emailAddress: targetAlias },
        { recipient: targetAlias }
      ]
    });

    res.json({ success: true, message: 'Account and data successfully deleted.' });
  } catch (err) {
    console.error('❌ Account deletion error:', err);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;