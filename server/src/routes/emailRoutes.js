const express = require('express');
const router = express.Router();
const Email = require('../models/Email');
const nodemailer = require('nodemailer');

// Configure Nodemailer transporter for external mail delivery
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
});

// 1. Fetch all messages for a specific user phone number handle
router.get('/messages/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const cleanPhone = phone.startsWith('+') ? phone.slice(1) : phone;
    
    const messages = await Email.find({
      $or: [
        { phone: cleanPhone },
        { phone: `+${cleanPhone}` },
        { recipient: new RegExp(cleanPhone, 'i') },
        { sender: new RegExp(cleanPhone, 'i') }
      ]
    }).sort({ createdAt: -1 });
    
    return res.json(messages);
  } catch (err) {
    console.error('❌ Error fetching messages:', err);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// 2. Send email (Outbound relay + Internal peer-to-peer delivery for @rizzmail.me)
router.post('/send', async (req, res) => {
  try {
    const { senderPhone, recipientEmail, subject, body } = req.body;
    if (!senderPhone || !recipientEmail || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    let cleanSender = senderPhone.startsWith('+') ? senderPhone.slice(1) : senderPhone;
    const countries = ['91', '1', '44', '61', '971', '49', '33', '81', '65', '966'];
    let senderHandle = cleanSender;
    for (const c of countries) {
      if (cleanSender.startsWith(c) && cleanSender.length > c.length + 7) {
        senderHandle = cleanSender.slice(c.length);
        break;
      }
    }
    const senderAddress = `${senderHandle}@rizzmail.me`;

    let formattedRecipient = recipientEmail.trim().toLowerCase();
    if (!formattedRecipient.includes('@')) {
      formattedRecipient = `${formattedRecipient}@rizzmail.me`;
    }

    // Save outbound message record for sender
    const outboundMsg = new Email({
      phone: cleanSender,
      recipient: formattedRecipient,
      sender: senderAddress,
      subject: subject || 'No Subject',
      body,
      direction: 'outbound'
    });
    await outboundMsg.save();

    // Internal P2P routing if recipient is on @rizzmail.me
    if (formattedRecipient.endsWith('@rizzmail.me')) {
      const recipientHandle = formattedRecipient.split('@')[0];
      
      const inboundMsg = new Email({
        phone: recipientHandle,
        recipient: formattedRecipient,
        sender: senderAddress,
        subject: subject || 'No Subject',
        body,
        direction: 'inbound'
      });
      await inboundMsg.save();

      // Real-time WebSocket dispatch via Socket.io
      const io = req.app.get('io');
      if (io) {
        io.to(recipientHandle).emit('new_message', inboundMsg);
        io.to(cleanSender).emit('new_message', outboundMsg);
      }
    } else {
      // Send through Nodemailer for external external addresses
      await transporter.sendMail({
        from: senderAddress,
        to: formattedRecipient,
        subject: subject || 'No Subject',
        text: body
      });
      
      const io = req.app.get('io');
      if (io) {
        io.to(cleanSender).emit('new_message', outboundMsg);
      }
    }

    return res.json({ success: true, message: 'Email sent successfully' });
  } catch (err) {
    console.error('❌ Error sending email:', err);
    return res.status(500).json({ error: err.message || 'Failed to send email' });
  }
});

// Route alias
router.post('/send-email', async (req, res) => {
  req.url = '/send';
  return router.handle(req, res);
});

// 3. Instant Simulation Endpoint (for local evaluations and testing)
router.post('/simulate-incoming', async (req, res) => {
  try {
    const { phone, sender, subject, body } = req.body;
    if (!phone) {
      return res.status(400).json({ error: 'Phone handle is required' });
    }

    const cleanPhone = phone.startsWith('+') ? phone.slice(1) : phone;
    const recipientAddress = `${cleanPhone}@rizzmail.me`;

    const newEmail = new Email({
      phone: cleanPhone,
      recipient: recipientAddress,
      sender: sender || 'evaluator@rizzmail.me',
      subject: subject || 'Live Security & Notification Alert',
      body: body || 'Your burner inbox successfully ingested this message in real-time via WebSocket broadcast.',
      direction: 'inbound'
    });

    await newEmail.save();

    const io = req.app.get('io');
    if (io) {
      io.to(cleanPhone).emit('new_message', newEmail);
    }

    return res.json({ success: true, message: 'Simulated email delivered', email: newEmail });
  } catch (err) {
    console.error('❌ Error simulating incoming email:', err);
    return res.status(500).json({ error: 'Failed to simulate email' });
  }
});

// 4. Inbound Webhook Parser (for external SMTP forwarders like ImprovMX)
router.post('/inbound-webhook', async (req, res) => {
  try {
    const { recipient, sender, subject, plain } = req.body;
    if (!recipient) {
      return res.status(400).json({ error: 'Recipient is required' });
    }

    const recipientHandle = recipient.split('@')[0];
    const newEmail = new Email({
      phone: recipientHandle,
      recipient: recipient.toLowerCase(),
      sender: sender || 'unknown@external.com',
      subject: subject || 'No Subject',
      body: plain || req.body.body || '',
      direction: 'inbound'
    });

    await newEmail.save();

    const io = req.app.get('io');
    if (io) {
      io.to(recipientHandle).emit('new_message', newEmail);
    }

    return res.json({ success: true, message: 'Webhook processed successfully' });
  } catch (err) {
    console.error('❌ Webhook ingestion error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// 5. Delete single email by ID
router.delete('/message/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedEmail = await Email.findByIdAndDelete(id);
    if (!deletedEmail) {
      return res.status(404).json({ success: false, message: 'Email not found' });
    }
    return res.json({ success: true, message: 'Email deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting email:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;