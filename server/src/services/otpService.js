import express from 'express';
import axios from 'axios';

const router = express.Router();

const MESSAGE_CENTRAL_BASE_URL = 'https://cpaas.messagecentral.com';
const CUSTOMER_ID = process.env.MESSAGE_CENTRAL_CUSTOMER_ID || 'YOUR_CUSTOMER_ID';
const API_KEY = process.env.MESSAGE_CENTRAL_KEY || 'YOUR_BASE64_KEY';

// 1. Helper function to generate authentication token
async function getAuthToken() {
    try {
        const response = await axios.get(`${MESSAGE_CENTRAL_BASE_URL}/auth/v1/authentication/token`, {
            params: {
                customerId: CUSTOMER_ID,
                key: API_KEY,
                scope: 'NEW',
                country: '91',
                email: process.env.MESSAGE_CENTRAL_EMAIL || 'your-email@domain.com'
            },
            headers: { 'accept': '*/*' }
        });
        
        // Return the token from the response data
        return response.data.token || response.data.data?.token;
    } catch (error) {
        console.error('Failed to generate Message Central token:', error.response?.data || error.message);
        throw new Error('Authentication token generation failed');
    }
}

// 2. Route to Send OTP
router.post('/send-otp', async (req, res) => {
    const { phoneNumber } = req.body; // e.g., 9876543210 (without +91 prefix for countryCode=91)
    
    if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    try {
        const authToken = await getAuthToken();
        const cleanNumber = phoneNumber.replace(/^\+91/, '').replace(/^91/, '');

        const response = await axios.post(
            `${MESSAGE_CENTRAL_BASE_URL}/verification/v3/send`, 
            null, 
            {
                params: {
                    countryCode: '91',
                    flowType: 'SMS',
                    mobileNumber: cleanNumber
                },
                headers: {
                    'authToken': authToken
                }
            }
        );

        res.json({
            success: true,
            message: 'OTP dispatched successfully',
            data: response.data.data
        });
    } catch (error) {
        console.error('Error sending OTP via Message Central:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

// 3. Route to Validate OTP
router.post('/verify-otp', async (req, res) => {
    const { verificationId, code } = req.body;

    if (!verificationId || !code) {
        return res.status(400).json({ error: 'Verification ID and code are required' });
    }

    try {
        const authToken = await getAuthToken();

        const response = await axios.get(
            `${MESSAGE_CENTRAL_BASE_URL}/verification/v3/validateOtp`,
            {
                params: {
                    verificationId: verificationId,
                    code: code,
                    flowType: 'SMS'
                },
                headers: {
                    'authToken': authToken
                }
            }
        );

        const verificationStatus = response.data.data?.verificationStatus;

        if (verificationStatus === 'VERIFICATION_COMPLETED') {
            res.json({ success: true, message: 'OTP verified successfully' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid or expired OTP code' });
        }
    } catch (error) {
        console.error('Error validating OTP:', error.response?.data || error.message);
        res.status(500).json({ error: 'OTP validation failed' });
    }
});

export default router;