const express = require('express');
const router = express.Router();
const Email = require('../models/Email');
const User = require('../models/User');
const axios = require('axios');
const { simpleParser } = require('mailparser');

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

// Helper to fetch sender name and profile photo live from User model
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
// Enhanced cleaner to strip email reply chains, quoted text, and MIME artifacts for clean chat view
const extractCleanBody = (rawText) => {
  if (!rawText) return '';
  let cleaned = rawText.toString();

  // Decode common quoted-printable artifacts (e.g. =E2=80=AF -> space, =3D -> =)
  cleaned = cleaned
    .replace(/=E2=80=AF/g, ' ')
    .replace(/=C2=A0/g, ' ')
    .replace(/=3D/g, '=')
    .replace(/\r\n/g, '\n');

  // Strip out standard email reply threads (e.g. "On Tue, 29 Sep 2026... wrote:")
  const replyIndexPatterns = [
    /\n\s*on\s+.+wrote:/i,
    /\n\s*-----+\s*original message\s*-----+/i,
    /\n\s*from:\s*.+/i,
    /\n\s*----------+ Forwarded message ---------+/i
  ];

  for (const pattern of replyIndexPatterns) {
    const match = cleaned.search(pattern);
    if (match !== -1) {
      cleaned = cleaned.substring(0, match);
    }
  }

  // If it's a raw MIME block, try to isolate plain text
  if (cleaned.includes('Content-Type: text/plain')) {
    const plainIndex = cleaned.indexOf('Content-Type: text/plain');
    const textSection = cleaned.slice(plainIndex);
    const doubleNewline = textSection.indexOf('\n\n');
    if (doubleNewline !== -1) {
      const content = textSection.slice(doubleNewline + 2);
      const endBoundary = content.indexOf('--');
      cleaned = (endBoundary !== -1 ? content.slice(0, endBoundary) : content).trim();
    }
  }

  return cleaned.trim();
};

// GET all emails for a specific address with live profile photo injection
router.get('/:emailAddress', async (req, res) => {
  try {
    const emailAddress = req.params.emailAddress.toLowerCase();
    const emails = await Email.find({ 
      $or: [
        { emailAddress },
        { recipient: emailAddress }
      ],
      isDeleted: { $ne: true }
    }).sort({ date: -1, createdAt: -1 }).lean();

    for (let email of emails) {
      if (email.sender) {
        const details = await getSenderDetails(email.sender);
        email.senderName = details.name;
        email.senderPhoto = details.photo;
      }
    }

    res.json(emails);
  } catch (err) {
    res.status(500).json({ error: 'Server error fetching emails' });
  }
});

// Inbound email webhook parser
router.post('/inbound', async (req, res) => {
  try {
    const rawEmailSource = req.body.email || req.body.text || req.rawEmail;
    
    let parsedBody = '';
    let parsedHtml = '';
    let subject = req.body.subject || '';
    let sender = req.body.from || req.body.sender || '';

    if (rawEmailSource && typeof rawEmailSource === 'string' && rawEmailSource.includes('Content-Type')) {
      const parsed = await simpleParser(rawEmailSource);
      parsedBody = parsed.text || '';
      parsedHtml = parsed.html || '';
      subject = parsed.subject || subject;
      sender = parsed.from?.text || sender;
    } else {
      parsedBody = req.body.body || req.body.text || '';
      parsedHtml = req.body.html || '';
    }

    const newMessage = new Email({
      sender,
      recipient: req.body.recipient,
      subject,
      body: parsedBody,
      htmlBody: parsedHtml,
      createdAt: new Date()
    });
    
    await newMessage.save();

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Email parsing error:', err);
    res.status(500).json({ error: 'Failed to parse incoming email' });
  }
});

// Fetch messages by phone number or alias with live profile photo injection
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
      ],
      isDeleted: { $ne: true }
    }).sort({ date: -1, createdAt: -1 }).lean();

    for (let email of emails) {
      if (email.sender) {
        const details = await getSenderDetails(email.sender);
        email.senderName = details.name;
        email.senderPhoto = details.photo;
      }
    }

    res.json(emails);
  } catch (err) {
    console.error('❌ Fetch messages error:', err);
    res.status(500).json({ error: 'Server error fetching messages' });
  }
});

// Send email route
router.post('/send', async (req, res) => {
  try {
    const { senderPhone, recipientEmail, subject, body } = req.body;

    if (!senderPhone || !recipientEmail || !body) {
      return res.status(400).json({ error: 'Sender, recipient, and body are required.' });
    }

    const senderNorm = normalizePhone(senderPhone);
    const normalizedRecipient = recipientEmail.toLowerCase().trim();
    const senderFullEmail = `${senderNorm.pureDigits}@rizzmail.me`;

    const senderDetails = await getSenderDetails(senderNorm.pureDigits);

 // (Inside router.post('/send', ...))
    const outboundEmail = new Email({
    phoneNumber: senderNorm.pureDigits,
    recipient: normalizedRecipient,
    emailAddress: senderNorm.pureDigits,
    sender: senderFullEmail,
    subject: subject || 'No Subject',
    body: body,
    quotedMessage: req.body.quotedMessage || null, // Persist quoted message
    senderName: senderDetails.name,
    senderPhoto: senderDetails.photo,
    direction: 'outbound',
    date: new Date(),
    createdAt: new Date()
});
await outboundEmail.save();

    const io = req.app.get('io');
    if (io) {
      io.to(senderNorm.pureDigits).emit('new_message', outboundEmail);
      io.to(senderNorm.alias).emit('new_message', outboundEmail);
    }

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
      const sendgridApiKey = process.env.SENDGRID_API_KEY || process.env.SMTP_PASS;
      
      if (!sendgridApiKey) {
        throw new Error('SendGrid API key not configured in Render environment variables.');
      }

      await axios.post('https://api.sendgrid.com/v3/mail/send', {
        personalizations: [{ to: [{ email: normalizedRecipient }] }],
        from: { email: senderFullEmail, name: senderDetails.name || 'RizzMail User' },
        reply_to: { email: senderFullEmail },
        subject: subject || 'No Subject',
        content: [{ type: 'text/plain', value: body }]
      }, {
        headers: {
          'Authorization': `Bearer ${sendgridApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 
      });
    }

    res.status(200).json({ success: true, message: 'Email sent successfully!', email: outboundEmail });
  } catch (err) {
    console.error('❌ Send email error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Server error sending email' });
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
      ],
      isDeleted: { $ne: true }
    }).sort({ createdAt: -1, date: -1 }).lean();

    for (let email of emails) {
      if (email.sender) {
        const details = await getSenderDetails(email.sender);
        email.senderName = details.name;
        email.senderPhoto = details.photo;
      }
    }

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

// Delete entire chat thread
// Delete entire chat thread
router.delete('/thread/:identifier', async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const { pureDigits } = normalizePhone(identifier);
    
    await Email.updateMany(
      {
        $or: [
          { sender: { $regex: pureDigits || identifier, $options: 'i' } },
          { recipient: { $regex: pureDigits || identifier, $options: 'i' } }
        ]
      },
      { $set: { isDeleted: true } }
    );
    res.json({ success: true, message: 'Thread deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete chat thread' });
  }
});

// Delete single message
router.delete('/message/:id', async (req, res) => {
  try {
    await Email.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.json({ success: true, message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete email' });
  }
});

module.exports = router;