const { sendEmailNotificationSMS } = require("./services/smsService");

async function runTest() {
  const testPhone = "7007012049";
  const testSender = "alert@rizzmail.me";
  const testSubject = "Verify Account Code";

  console.log("🧪 Sending live SMS via SMSHorizon API...");
  await sendEmailNotificationSMS(testPhone, testSender, testSubject);
  process.exit(0);
}
runTest();
