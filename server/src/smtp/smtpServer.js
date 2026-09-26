const { SMTPServer } = require("smtp-server");
const { simpleParser } = require("mailparser");
const Email = require("../models/Email");

function startSmtpServer(io) {
  const smtpServer = new SMTPServer({
    authOptional: true,
    allowInsecureAuth: true,
    onData(stream, session, callback) {
      let rawEmail = "";
      stream.on("data", (chunk) => {
        rawEmail += chunk;
      });

      stream.on("end", async () => {
        try {
          const parsed = await simpleParser(rawEmail);
          
          // Extract recipient address (e.g. 7007012049@rizzmail.com)
          const recipientFull = parsed.to?.text || parsed.to?.value?.[0]?.address || "";
          const recipientClean = recipientFull.toLowerCase().trim();
          
          // Extract phone number from email prefix
          const phoneMatch = recipientClean.match(/^(\+?\d+)@/);
          const phone = phoneMatch ? phoneMatch[1] : recipientClean.split('@')[0];

          const emailDoc = new Email({
            recipient: recipientClean,
            phone: phone,
            sender: parsed.from?.text || "Unknown Sender",
            subject: parsed.subject || "No Subject",
            body: parsed.text || parsed.html || "",
            direction: 'inbound',
            createdAt: new Date()
          });

          await emailDoc.save();
          console.log(`📥 [SMTP] Real email received for ${recipientClean} from ${emailDoc.sender}`);

          // Real-time broadcast to connected WebSocket clients
          if (io) {
            io.emit("new_message", emailDoc);
          }

          callback();
        } catch (err) {
          console.error("❌ Error parsing incoming SMTP email:", err);
          callback(err);
        }
      });
    }
  });

  smtpServer.listen(2525, () => {
    console.log("🚀 Custom Live SMTP Inbound Server running on port 2525");
  });

  smtpServer.on("error", (err) => {
    console.error("❌ SMTP Server error:", err);
  });
}

module.exports = { startSmtpServer };