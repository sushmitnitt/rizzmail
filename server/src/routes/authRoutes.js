const express = require("express");
const router = express.Router();
const axios = require("axios");
const Otp = require("../models/Otp");
const User = require("../models/User");

const MESSAGE_CENTRAL_BASE_URL = "https://cpaas.messagecentral.com";

// Helper to normalize phone numbers to a consistent format (+91XXXXXXXXXX)
const normalizePhone = (input) => {
    if (!input) return "";
    const digits = input.toString().replace(/[^0-9]/g, '');
    const tenDigits = digits.slice(-10);
    return `+91${tenDigits}`;
};

// Helper function to generate Message Central Auth Token
async function getMessageCentralToken() {
    const customerId = process.env.MESSAGE_CENTRAL_CUSTOMER_ID;
    const key = process.env.MESSAGE_CENTRAL_KEY;
    const email = process.env.MESSAGE_CENTRAL_EMAIL;

    if (!customerId || !key || !email) {
        throw new Error("MessageCentral credentials not configured in environment variables.");
    }

    const response = await axios.get(`${MESSAGE_CENTRAL_BASE_URL}/auth/v1/authentication/token`, {
        params: {
            customerId: customerId,
            key: key,
            scope: "NEW",
            country: "91",
            email: email
        },
        headers: { "accept": "*/*" }
    });
    
    return response.data.token || response.data.data?.token;
}

// 1. Send OTP Route
router.post("/send-otp", async (req, res) => {
    try {
        const { phone, phoneNumber } = req.body || {};
        const rawPhone = phone || phoneNumber;

        if (!rawPhone || rawPhone === 'undefined' || rawPhone === 'null') {
            return res.status(400).json({ success: false, message: "Valid phone number is required" });
        }

        const targetPhone = normalizePhone(rawPhone);
        const cleanNumber = targetPhone.replace("+91", "");

        // Get live auth token from Message Central
        const authToken = await getMessageCentralToken();

        // Call Message Central V3 Send API
        const mcResponse = await axios.post(
            `${MESSAGE_CENTRAL_BASE_URL}/verification/v3/send`,
            null,
            {
                params: {
                    countryCode: "91",
                    flowType: "SMS",
                    mobileNumber: cleanNumber,
                    otpLength: 6
                },
                headers: {
                    'authToken': authToken
                }
            }
        );

        const verificationId = mcResponse.data.data?.verificationId || mcResponse.data.verificationId;

        if (!verificationId) {
            throw new Error("Failed to retrieve verification ID from Message Central response.");
        }

        // Store the verificationId in MongoDB safely using strict: false
        // Saving both variants (phone and phoneNumber) ensures compatibility with any model schema
        await Otp.findOneAndUpdate(
            { phone: targetPhone },
            { 
                phone: targetPhone, 
                phoneNumber: targetPhone, 
                verificationId, 
                createdAt: new Date() 
            },
            { upsert: true, new: true, strict: false }
        );

        console.log(`📱 Message Central successfully dispatched 6-digit OTP & saved record for ${targetPhone}`);

        return res.json({ 
            success: true, 
            message: "OTP sent to physical device via Message Central", 
            verificationId 
        });

    } catch (err) {
        console.error("❌ Message Central Send OTP Error:", err.response?.data || err.message);
        return res.status(500).json({ 
            success: false, 
            message: "Failed to send OTP via Message Central", 
            details: err.response?.data || err.message 
        });
    }
});

// 2. Verify OTP Route
router.post("/verify-otp", async (req, res) => {
    try {
        const { phone, phoneNumber, otp, code } = req.body || {};
        const rawPhone = phone || phoneNumber;
        const otpCode = otp || code;

        if (!rawPhone || rawPhone === 'undefined' || rawPhone === 'null' || !otpCode) {
            return res.status(400).json({ success: false, message: "Valid phone and otp code are required" });
        }

        const targetPhone = normalizePhone(rawPhone);

        // Search checking both possible field names
        const record = await Otp.findOne({ 
            $or: [{ phone: targetPhone }, { phoneNumber: targetPhone }] 
        });

        if (!record || !record.verificationId) {
            console.warn(`⚠️ No verification record found in MongoDB for normalized phone: ${targetPhone}`);
            return res.status(400).json({ success: false, message: "No active verification found. Please request a new OTP." });
        }

        // Validate code with Message Central V3 API
        const authToken = await getMessageCentralToken();
        const validateResponse = await axios.get(
            `${MESSAGE_CENTRAL_BASE_URL}/verification/v3/validateOtp`,
            {
                params: {
                    verificationId: record.verificationId,
                    code: otpCode,
                    flowType: "SMS"
                },
                headers: {
                    'authToken': authToken
                }
            }
        );

        const verificationStatus = validateResponse.data.data?.verificationStatus || validateResponse.data.verificationStatus;

        if (verificationStatus !== "VERIFICATION_COMPLETED") {
            return res.status(400).json({ success: false, message: "Invalid or expired OTP code" });
        }

        // Clear verification record after success
        await Otp.deleteMany({ 
            $or: [{ phone: targetPhone }, { phoneNumber: targetPhone }] 
        });

        let user = await User.findOne({ phoneNumber: targetPhone });
        if (!user) {
            user = new User({
                phoneNumber: targetPhone,
                termsAgreed: false,
                agreedToTerms: false
            });
            await user.save();
        }

        return res.json({ 
            success: true, 
            message: "Phone verified successfully!", 
            user 
        });

    } catch (err) {
        console.error("❌ Message Central Verify OTP Error:", err.response?.data || err.message);
        return res.status(500).json({ 
            success: false, 
            message: "OTP validation failed", 
            details: err.response?.data || err.message 
        });
    }
});

// 3. Robust Profile Update Handler
const handleProfileUpdate = async (req, res) => {
    try {
        const { 
            phone, 
            phoneNumber, 
            name, 
            firstName, 
            lastName, 
            photo, 
            profilePhoto, 
            birthdate, 
            dob, 
            termsAgreed, 
            agreedToTerms 
        } = req.body || {};
        
        const rawPhone = phone || phoneNumber;
        if (!rawPhone || rawPhone === 'undefined' || rawPhone === 'null') {
            return res.status(400).json({ success: false, message: "Valid phone number is required" });
        }

        const targetPhone = normalizePhone(rawPhone);
        const finalBirthdate = birthdate || dob;

        // Validate Age >= 13
        if (finalBirthdate) {
            const dobDate = new Date(finalBirthdate);
            if (!isNaN(dobDate.getTime())) {
                const ageDifMs = Date.now() - dobDate.getTime();
                const ageDate = new Date(ageDifMs);
                const age = Math.abs(ageDate.getUTCFullYear() - 1970);

                if (age < 13) {
                    return res.status(400).json({ success: false, message: "You must be at least 13 years old to use RizzMail." });
                }
            }
        }

        let user = await User.findOne({ phoneNumber: targetPhone });

        if (user && user.birthdate && user.birthdateLocked) {
            if (finalBirthdate && finalBirthdate !== user.birthdate) {
                return res.status(400).json({ success: false, message: "Birthdate is permanently locked and cannot be modified." });
            }
        }

        // Resolve Names
        let fName = firstName !== undefined ? firstName : (user?.firstName || '');
        let lName = lastName !== undefined ? lastName : (user?.lastName || '');
        let finalName = name;
        
        if (!finalName && (fName || lName)) {
            finalName = `${fName} ${lName}`.trim();
        } else if (finalName && (!fName && !lName)) {
            const parts = finalName.split(' ');
            fName = parts[0] || '';
            lName = parts.slice(1).join(' ') || '';
        }

        // Resolve Photos & Terms
        const finalPhoto = photo !== undefined ? photo : (profilePhoto !== undefined ? profilePhoto : (user?.profilePhoto || user?.photo || ''));
        const finalTerms = termsAgreed !== undefined ? termsAgreed : (agreedToTerms !== undefined ? agreedToTerms : (user?.termsAgreed || false));

        const updateData = {
            name: finalName,
            firstName: fName,
            lastName: lName,
            photo: finalPhoto,
            profilePhoto: finalPhoto,
            termsAgreed: finalTerms,
            agreedToTerms: finalTerms
        };

        if (finalBirthdate && (!user || !user.birthdate)) {
            updateData.birthdate = finalBirthdate;
            updateData.birthdateLocked = true;
        }

        user = await User.findOneAndUpdate(
            { phoneNumber: targetPhone },
            { $set: updateData },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log(`✅ Profile updated successfully for ${targetPhone}`);
        return res.json({ success: true, message: "Profile saved successfully!", user });
    } catch (err) {
        console.error("❌ Critical error in profile update route:", err);
        return res.status(500).json({ success: false, message: err.message || "Internal server error" });
    }
};

router.post("/update-profile", handleProfileUpdate);
router.put("/update-profile", handleProfileUpdate);
router.post("/profile", handleProfileUpdate);
router.put("/profile", handleProfileUpdate);

// 4. Delete Account Route
router.delete("/account/:phone", async (req, res) => {
    try {
        const targetPhone = normalizePhone(req.params.phone);
        await User.findOneAndDelete({ phoneNumber: targetPhone });
        console.log(`🗑️️ Account successfully deleted for: ${targetPhone}`);
        return res.json({ success: true, message: "Account successfully deleted" });
    } catch (err) {
        console.error("❌ Account deletion error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;