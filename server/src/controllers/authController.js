const User = require('../models/User');
const axios = require('axios');

// In-memory map to store verification IDs for active sessions
const verificationStore = {};

const sendOTP = async (req, res) => {
  try {
    const phoneNumber = req.body.phoneNumber || req.body.phone;

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

    const responseCode = sendRes.data.responseCode;

    // Handle standard success
    if (responseCode === 200 || responseCode === '200') {
      const verificationId = sendRes.data.data?.verificationId;
      if (verificationId) {
        verificationStore[phoneNumber] = verificationId;
      }
      console.log(`[Message Central SMS] OTP successfully dispatched to: ${phoneNumber}`);
      return res.status(200).json({ message: 'OTP sent successfully to your phone!' });
    }

    // Handle 506 / Request Already Exists gracefully
    if (responseCode === 506 || responseCode === '506' || sendRes.data.message === 'REQUEST_ALREADY_EXISTS') {
      const verificationId = sendRes.data.data?.verificationId;
      if (verificationId) {
        verificationStore[phoneNumber] = verificationId;
        console.log(`[Message Central] Active request exists. Reusing verificationId: ${verificationId}`);
        return res.status(200).json({ message: 'OTP already active. Please enter the code sent to your phone.' });
      }
    }

    return res.status(400).json({ error: sendRes.data.message || 'Failed to send SMS' });

  } catch (error) {
    const errorData = error.response?.data;
    
    // Catch Axios 506 error response and gracefully recover
    if (errorData && (errorData.responseCode === 506 || errorData.message === 'REQUEST_ALREADY_EXISTS')) {
      const verificationId = errorData.data?.verificationId;
      if (verificationId) {
        verificationStore[phoneNumber] = verificationId;
        console.log(`[Message Central] Caught 506 exception. Reusing verificationId: ${verificationId}`);
        return res.status(200).json({ message: 'OTP already active. Please enter the code sent to your phone.' });
      }
    }

    console.error('Error in sendOTP:', errorData || error.message);
    return res.status(500).json({ error: 'Server error while sending SMS. Please wait 60 seconds before retrying.' });
  }
};

const verifyOTP = async (req, res) => {
  try {
    const phoneNumber = req.body.phoneNumber || req.body.phone;
    const { otp } = req.body;
    const verificationId = verificationStore[phoneNumber];

    if (!verificationId) {
      return res.status(400).json({ error: 'No active OTP request found for this number. Please request a new code.' });
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
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    delete verificationStore[phoneNumber];

    // MongoDB Permanent Number Locking & Smart Login Check
    let user = await User.findOne({ phoneNumber });
    if (!user) {
      // New user: Lock in this phone number permanently
      user = new User({
        phoneNumber,
        firstName: '',
        lastName: '',
        dob: '',
        profilePhoto: '',
        agreedToTerms: false
      });
      await user.save();
      console.log(`[Database] New account created and phone number permanently locked: ${phoneNumber}`);
    } else {
      console.log(`[Database] Returning user logged in via Smart Login: ${phoneNumber}`);
    }

    return res.status(200).json({ 
      success: true,
      message: 'Login successful', 
      user: {
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        dob: user.dob,
        profilePhoto: user.profilePhoto,
        agreedToTerms: user.agreedToTerms
      }
    });

  } catch (error) {
    console.error('Error in verifyOTP:', error.response?.data || error.message);
    return res.status(400).json({ error: 'Invalid or expired verification code' });
  }
};

// 3. Delete Account Route (Releases the locked phone number back to the system)
const deleteAccount = async (req, res) => {
  try {
    const phoneNumber = req.body.phoneNumber || req.body.phone;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Completely remove the user from MongoDB, freeing up the unique phone index
    const deletedUser = await User.findOneAndDelete({ phoneNumber });

    if (!deletedUser) {
      return res.status(404).json({ error: 'Account not found' });
    }

    console.log(`[Database] Account deleted and phone number released: ${phoneNumber}`);

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully. Phone number is now released.'
    });

  } catch (error) {
    console.error('Delete Account Error:', error);
    return res.status(500).json({ error: 'Failed to delete account' });
  }
};

module.exports = { sendOTP, verifyOTP, deleteAccount };