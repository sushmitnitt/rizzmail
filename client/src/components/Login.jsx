const User = require('../models/User');
const axios = require('axios');

// In-memory map to store verification IDs for active sessions
const verificationStore = {};

const sendOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Clean phone number (removing '+' and spaces)
    const cleanNumber = phoneNumber.replace(/^\+/, '').trim();
    const countryCode = cleanNumber.startsWith('91') ? '91' : '91';
    const mobileNumber = cleanNumber.startsWith('91') ? cleanNumber.slice(2) : cleanNumber;

    const customerId = process.env.MESSAGECENTRAL_CUSTOMER_ID;
    const base64Key = process.env.MESSAGECENTRAL_ENCODED_KEY;

    if (!customerId || !base64Key) {
      return res.status(400).json({ error: 'Message Central credentials are missing in your server .env file' });
    }

    // 1. Generate Auth Token from Message Central
    const tokenRes = await axios.get('https://cpaas.messagecentral.com/auth/v1/authentication/token', {
      params: {
        customerId: customerId,
        key: base64Key,
        scope: 'NEW',
        country: countryCode
      }
    });

    const authToken = tokenRes.data?.token;
    if (!authToken) {
      return res.status(500).json({ error: 'Failed to authenticate with SMS gateway' });
    }

    // 2. Send Verification OTP via SMS
    const sendRes = await axios.post('https://cpaas.messagecentral.com/verification/v3/send', null, {
      params: {
        countryCode: countryCode,
        customerId: customerId,
        mobileNumber: mobileNumber,
        flowType: 'SMS',
        otpLength: 6
      },
      headers: {
        authToken: authToken
      }
    });

    if (sendRes.data.responseCode !== 200) {
      console.error('[Message Central Error]:', sendRes.data);
      return res.status(500).json({ error: sendRes.data.message || 'Failed to send SMS' });
    }

    // Save verification ID for the validation step
    verificationStore[phoneNumber] = sendRes.data.data.verificationId;

    console.log(`[Message Central SMS] Real OTP successfully dispatched to physical device: ${phoneNumber}`);
    res.status(200).json({ message: 'OTP sent successfully to your phone!' });
  } catch (error) {
    console.error('Error in sendOTP:', error.response?.data || error.message);
    res.status(500).json({ error: 'Server error while sending SMS' });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;
    const verificationId = verificationStore[phoneNumber];

    if (!verificationId) {
      return res.status(400).json({ error: 'No active OTP request found for this number' });
    }

    const customerId = process.env.MESSAGECENTRAL_CUSTOMER_ID;
    const base64Key = process.env.MESSAGECENTRAL_ENCODED_KEY;

    // Generate Auth Token for validation
    const tokenRes = await axios.get('https://cpaas.messagecentral.com/auth/v1/authentication/token', {
      params: { customerId, key: base64Key, scope: 'NEW', country: '91' }
    });
    const authToken = tokenRes.data?.token;

    // Validate OTP with Message Central API
    const validateRes = await axios.get('https://cpaas.messagecentral.com/verification/v3/validateOtp', {
      params: {
        verificationId: verificationId,
        code: otp
      },
      headers: {
        authToken: authToken
      }
    });

    const status = validateRes.data?.data?.verificationStatus;
    if (status !== 'VERIFICATION_COMPLETED') {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    delete verificationStore[phoneNumber];

    // Find or create user in MongoDB
    let user = await User.findOne({ phoneNumber });
    if (!user) {
      user = await User.create({ phoneNumber });
    }

    res.status(200).json({ message: 'Login successful', user });
  } catch (error) {
    console.error('Error in verifyOTP:', error.response?.data || error.message);
    res.status(400).json({ error: 'Invalid or expired OTP' });
  }
};

module.exports = { sendOTP, verifyOTP };