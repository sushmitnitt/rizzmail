async function sendEmailNotificationSMS(recipientPhoneNumber, sender, subject) {
  // Keep this matching your exact SMSHorizon approved template structure
  const messageBody = `You have received an email from ${sender}. Subject: ${subject}`;
  
  let cleanNumber = recipientPhoneNumber.replace(/^\+/, "");
  if (!cleanNumber.startsWith("91")) {
    cleanNumber = "91" + cleanNumber;
  }

  try {
    const params = new URLSearchParams();
    params.append("user", "sushmitnitt");
    params.append("mobile", cleanNumber);
    params.append("message", messageBody);
    params.append("senderid", "HORIZN");
    params.append("tid", "1607100000000323238");
    params.append("route", "trans"); // Explicitly forces transactional priority route to bypass promotional drops
    params.append("type", "txt");

    const response = await fetch("https://smshorizon.co.in/api/v2/sendsms.php", {
      method: "POST",
      headers: {
        "Authorization": "Bearer w2tYbx5iTnYpFk7SrKX0wGooPkjb3V",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const data = await response.json();
    console.log("📥 SMSHorizon Response:", JSON.stringify(data, null, 2));

    if (data.msgid) {
      console.log(`✅ Priority SMS dispatched to +${cleanNumber}! MsgID: ${data.msgid}`);
      return true;
    } else {
      console.log("⚠️ Gateway Notice:", data);
      return false;
    }
  } catch (err) {
    console.error("❌ Network error:", err.message);
    return false;
  }
}

module.exports = { sendEmailNotificationSMS };
