const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const Email = require('../models/Email');

const startImapWorker = (io) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('⚠️ IMAP credentials not configured. Skipping email sync.');
    return;
  }

  const pollInbox = async () => {
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

    try {
      await client.connect();
      let lock = await client.getMailboxLock('[Gmail]/All Mail');
      
      try {
        let unseenUids = await client.search({ seen: false }, { uid: true });
        
        for (let uid of unseenUids) {
          let message = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
          if (!message || !message.source) continue;

          let parsed = await simpleParser(message.source);
          
          // Type-safe header extraction
          let rawHeader = parsed.headers.get('x-original-to') || 
                          parsed.headers.get('delivered-to') || 
                          (parsed.to && parsed.to.text) || '';
          
          let originalToHeader = typeof rawHeader === 'string' ? rawHeader : (rawHeader.text || String(rawHeader));

          let match = originalToHeader.match(/([a-zA-Z0-9._%+-]+@rizzmail\.me)/i);
          let targetAlias = match ? match[1].toLowerCase() : '7007012049@rizzmail.me';

          const newEmail = new Email({
            emailAddress: targetAlias,
            sender: parsed.from?.text || 'Unknown Sender',
            subject: parsed.subject || 'No Subject',
            body: parsed.text || parsed.html || '',
            date: new Date()
          });
          
          await newEmail.save();

          if (io) {
            io.to(targetAlias).emit('new-email', newEmail);
          }

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

  setInterval(pollInbox, 15000);
  console.log('🚀 IMAP background sync worker started.');
};

module.exports = startImapWorker;