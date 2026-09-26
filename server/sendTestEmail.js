const nodemailer = require('nodemailer');

async function sendTest() {
  // Configure transporter to point to your local custom SMTP server on port 2525
  const transporter = nodemailer.createTransport({
    host: 'localhost',
    port: 2525,
    secure: false,
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    const info = await transporter.sendMail({
      from: '"Test Sender" <sender@example.com>',
      to: '+917007012049@phoneemail.local', // Replace with the phone number you logged in with!
      subject: 'Hello from my custom email app!',
      text: 'This is a test email sent directly to my phone-number-as-email inbox!',
    });

    console.log('Test email sent successfully! Response:', info.response);
  } catch (error) {
    console.error('Failed to send test email:', error);
  }
}

sendTest();