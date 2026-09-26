const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const Email = require('../models/Email');

const startImapWorker = (io) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('⚠️ IMAP credentials not configured. Skipping email sync.');
    return;
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    logger: false
  });

  const pollInbox = async () => {
    try {
      await client.connect();
      // Use '[Gmail]/All Mail' to catch emails even if filtered into Spam or Archive
      let lock = await client.getMailboxLock('[Gmail]/All Mail');
      
      try {
        // Search for unread messages
        let unseenUids = await client.search({ seen: false }, { uid: true });
        
        for (let uid of unseenUids) {
          let message = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
          if (!message || !message.source) continue;

          // Parse raw email content
          let parsed = await simpleParser(message.source);
          
          // Extract original recipient from ImprovMX forwarded headers
          let originalToHeader = parsed.headers.get('x-original-to') || 
                                 parsed.headers.get('delivered-to') || 
                                 parsed.to?.text || '';

          // Match any address ending with @rizzmail.me
          let match = originalToHeader.match(/([a-zA-Z0-9._%+-]+@rizzmail\.me)/i);
          let targetAlias = match ? match[1].toLowerCase() : '7007012049@rizzmail.me';

          // Save to MongoDB database
          const newEmail = new Email({
            emailAddress: targetAlias,
            sender: parsed.from?.text || 'Unknown Sender',
            subject: parsed.subject || 'No Subject',
            body: parsed.text || parsed.html || '',
            date: new Date()
          });
          
          await newEmail.save();

          // Broadcast live via Socket.io to the frontend
          if (io) {
            io.to(targetAlias).emit('new-email', newEmail);
          }

          // Mark email as read in Gmail so it isn't processed twice
          await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
        }
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err) {
      console.error('❌ IMAP Polling Error:', err.message);
    }
  };

  // Poll inbox every 15 seconds
  setInterval(pollInbox, 15000);
  console.log('🚀 IMAP background sync worker started.');
};

module.exports = startImapWorker;