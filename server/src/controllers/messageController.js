const Message = require('../models/Message');
const nodemailer = require('nodemailer');

// Fetch messages for a specific phone number
const getMessages = async (req, res) => {
  try {
    const { phone } = req.params;
    const messages = await Message.find({ recipientPhone: phone }).sort({ createdAt: -1 });
    res.status(200).json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Server error while fetching messages' });
  }
};

// Send an outbound email from the user's phone email address to a real inbox
const sendEmail = async (req, res) => {
  try {
    const { senderPhone, recipientEmail, subject, body } = req.body;

    if (!senderPhone || !recipientEmail || !body) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Configure transporter for Gmail using Port 465
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Send the actual email to the external recipient
    await transporter.sendMail({
      from: `"${senderPhone} (PhoneEmail)" <${process.env.SMTP_USER}>`,
      to: recipientEmail,
      subject: subject || 'No Subject',
      text: `[Sent from Phone Number: ${senderPhone}]\n\n${body}`
    });

    // Save record to database
    const sentRecord = await Message.create({
      recipientPhone: recipientEmail,
      sender: `${senderPhone}@phoneemail.local`,
      subject: subject || 'No Subject',
      body: `[Outbound to ${recipientEmail}] ${body}`
    });

    res.status(200).json({ message: 'Email sent successfully to your inbox!', data: sentRecord });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email via SMTP. Check server logs.' });
  }
};

module.exports = { getMessages, sendEmail };