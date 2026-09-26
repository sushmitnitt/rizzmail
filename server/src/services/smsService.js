async function sendEmailNotificationSMS(recipientPhoneNumber, sender, subject) {
  try {
    console.log(`📱 Triggering MessageCentral OTP for ${recipientPhoneNumber}...`);
    
    const customerId = process.env.MESSAGECENTRAL_CUSTOMER_ID || "";
    const base64Key = process.env.MESSAGECENTRAL_KEY || "";

    if (!customerId || !base64Key) {
      console.log('ℹ️ MessageCentral credentials not configured. Running in development mode.');
      return true;
    }

    const cleanNumber = recipientPhoneNumber.replace(/^\+/, '');
    const tokenUrl = `https://cpaas.messagecentral.com/auth/v1/authentication/token?customerId=${customerId}&key=${base64Key}&scope=NEW&country=91`;
    
    const tokenRes = await fetch(tokenUrl, { method: 'GET' });
    const tokenData = await tokenRes.json();
    const authToken = tokenData.token || tokenData.response?.token;

    if (!authToken) {
      console.warn('⚠️ MessageCentral Token Generation failed. Bypassing external SMS.');
      return false;
    }

    const sendUrl = `https://cpaas.messagecentral.com/verification/v3/send?countryCode=91&flowType=SMS&mobileNumber=${cleanNumber}&type=OTP`;
    const response = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'authToken': authToken, 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    if (response.ok || data.responseCode === 200 || data.responseCode === "200") {
      console.log('✅ MessageCentral OTP sent successfully!');
      return true;
    } else {
      console.warn('⚠️ MessageCentral Notice:', data);
      return false;
    }
  } catch (err) {
    console.warn('⚠️ SMS Gateway error caught safely:', err.message);
    return false;
  }
}

module.exports = { sendEmailNotificationSMS };