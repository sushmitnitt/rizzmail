import React, { useState, useEffect } from 'react';
import axios from '../services/api';

const greetings = [
  { lang: "Hindi", text: "आपका स्वागत है" },
  { lang: "Bengali", text: "আপনাকে স্বাগতম" },
  { lang: "Telugu", text: "స్వాగతం" },
  { lang: "Marathi", text: "आपले स्वागत आहे" },
  { lang: "Tamil", text: "நல்வரவு" },
  { lang: "Gujarati", text: "તમારું સ્વાગત છે" },
  { lang: "Kannada", text: "ಸ್ವಾಗತ" },
  { lang: "Malayalam", text: "സ്വാഗതം" }
];

export default function Login({ onLoginSuccess }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('SEND_OTP'); // 'SEND_OTP' or 'VERIFY_OTP'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Multilingual welcome text fading animation
  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false); 
      setTimeout(() => {
        setCurrentIndex((prevIndex) => (prevIndex + 1) % greetings.length);
        setFade(true); 
      }, 400);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post('/auth/send-otp', { phoneNumber });
      setMessage(res.data.message || 'OTP sent successfully to your phone!');
      setStep('VERIFY_OTP');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP. Please check your network.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post('/auth/verify-otp', { phoneNumber, otp });
      setMessage('Login successful!');
      if (onLoginSuccess) {
        onLoginSuccess(res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-slate-950 flex flex-col items-center justify-center px-4 sm:px-6 py-8">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl transition-all">
        
        {/* Header with Multilingual Greeting Animation */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Rizzmail
          </h1>
          <div className="h-10 flex items-center justify-center mt-2">
            <p
              className={`text-base sm:text-lg font-medium text-purple-400 transition-opacity duration-500 ease-in-out ${
                fade ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform -translate-y-2'
              }`}
            >
              {greetings[currentIndex].text}
            </p>
          </div>
        </div>

        {/* Error / Success Banners */}
        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-800 text-red-200 text-xs sm:text-sm rounded-lg text-center">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs sm:text-sm rounded-lg text-center">
            {message}
          </div>
        )}

        {/* Step 1: Phone Number Input Form */}
        {step === 'SEND_OTP' ? (
          <form onSubmit={handleSendOtp} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">
                Mobile Number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-700 bg-slate-800 text-slate-300 text-sm">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="9876543210"
                  maxLength={10}
                  className="flex-1 min-w-0 block w-full px-3 py-3 rounded-r-lg border border-slate-700 bg-slate-900 text-white placeholder-slate-500 text-base focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition duration-200 shadow-lg shadow-purple-600/30 disabled:opacity-50 text-base cursor-pointer"
            >
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        ) : (
          /* Step 2: OTP Verification Form */
          <form onSubmit={handleVerifyOtp} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2 text-center">
                Enter 6-Digit OTP sent to <span className="text-purple-400">+91 {phoneNumber}</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full px-4 py-3 rounded-lg border border-slate-700 bg-slate-900 text-white text-center tracking-[0.5em] sm:tracking-[1em] text-xl sm:text-2xl placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg transition duration-200 shadow-lg shadow-purple-600/30 disabled:opacity-50 text-base cursor-pointer"
            >
              {loading ? 'Verifying OTP...' : 'Verify & Login'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setStep('SEND_OTP');
                  setOtp('');
                  setMessage('');
                  setError('');
                }}
                className="text-sm text-purple-400 hover:underline cursor-pointer"
              >
                Change Phone Number
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}