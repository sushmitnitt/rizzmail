import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { sendOTP, verifyOTP, updateProfileAPI, fetchMessages, sendEmailAPI, deleteAccountAPI, deleteMessageAPI } from './services/api';
import { Phone, Lock, Mail, RefreshCw, LogOut, Send, Edit3, Copy, Check, X, CornerUpLeft, Search, User, Shield, ArrowLeft, Loader2, QrCode, Settings, Camera, Trash2, AlertTriangle, Cpu, Sun, Moon, Zap } from 'lucide-react';
import './App.css';

// Dynamically connect to Render backend in production, fallback to localhost for development
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'https://rizzmail-backend.onrender.com';
const socket = io(SOCKET_URL);

const countriesList = [
  { name: 'India', code: '91', label: 'IN (+91)' },
  { name: 'United States', code: '1', label: 'US (+1)' },
  { name: 'United Kingdom', code: '44', label: 'GB (+44)' },
  { name: 'Canada', code: '1', label: 'CA (+1)' },
  { name: 'Australia', code: '61', label: 'AU (+61)' },
  { name: 'United Arab Emirates', code: '971', label: 'AE (+971)' },
  { name: 'Germany', code: '49', label: 'DE (+49)' },
  { name: 'France', code: '33', label: 'FR (+33)' },
  { name: 'Japan', code: '81', label: 'JP (+81)' },
  { name: 'Singapore', code: '65', label: 'SG (+65)' },
  { name: 'Saudi Arabia', code: '966', label: 'SA (+966)' }
];

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('rizzmail_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rizzmail_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('rizzmail_user');
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved);
      if (parsed && (parsed.firstName || parsed.name) && (parsed.agreedToTerms || parsed.termsAgreed)) {
        return {
          ...parsed,
          phoneNumber: parsed.phoneNumber || parsed.phone,
          firstName: parsed.firstName || (parsed.name ? parsed.name.split(' ')[0] : ''),
          lastName: parsed.lastName || (parsed.name ? parsed.name.split(' ').slice(1).join(' ') : ''),
          profilePhoto: parsed.profilePhoto || parsed.photo
        };
      }
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem('rizzmail_user');
    return null;
  });

  const [countryCode, setCountryCode] = useState('91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  
  // Steps: 1: Phone, 2: OTP, 3: Profile, 4: Terms, 5: Dynamic Setup Screen, 6: Dashboard, 7: Deletion Warning, 8: Deletion OTP
  const [step, setStep] = useState(() => (user ? 6 : 1));

  const [setupStage, setSetupStage] = useState(0);
  const setupStepsList = [
    "Allocating secure @rizzmail.me node...",
    "Generating cryptographic session tokens...",
    "Binding real-time WebSocket listeners...",
    "Opening secure inbox portal..."
  ];

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState(user?.firstName || '');
  const [editLastName, setEditLastName] = useState(user?.lastName || '');
  const [editProfilePhoto, setEditProfilePhoto] = useState(user?.profilePhoto || '');
  const [profileSuccess, setProfileSuccess] = useState('');

  const [deleteOtp, setDeleteOtp] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [copied, setCopied] = useState(false);
  const [showCardQR, setShowCardQR] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);

  const [activeTab, setActiveTab] = useState('inbox');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const getEmailPhone = (phone) => {
    if (!phone) return '';
    let cleaned = phone.startsWith('+') ? phone.slice(1) : phone;
    const sortedCodes = countriesList.map(c => c.code).sort((a, b) => b.length - a.length);
    for (const code of sortedCodes) {
      if (cleaned.startsWith(code)) return cleaned.slice(code.length);
    }
    return cleaned;
  };

  const handleImageUpload = (e, setImageState) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImageState(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const getUserPhone = () => {
    return user?.phoneNumber || user?.phone || phoneNumber;
  };

  useEffect(() => {
    const activePhone = getUserPhone();
    if (user && step === 6 && activePhone) {
      socket.emit('join_inbox', activePhone);
      loadInbox(activePhone);
      setEditFirstName(user.firstName || '');
      setEditLastName(user.lastName || '');
      setEditProfilePhoto(user.profilePhoto || '');
    }
  }, [user, step]);

  useEffect(() => {
    if (step === 5) {
      setSetupStage(0);
      const interval = setInterval(() => {
        setSetupStage((prev) => {
          if (prev < setupStepsList.length - 1) {
            return prev + 1;
          } else {
            clearInterval(interval);
            return prev;
          }
        });
      }, 750);

      const timeout = setTimeout(() => {
        setStep(6);
      }, 3200);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [step]);

  useEffect(() => {
    socket.on('new_message', (incomingMsg) => {
      setMessages((prev) => [incomingMsg, ...prev]);
      setToast(incomingMsg);
      setTimeout(() => setToast(null), 5000);
    });

    return () => socket.off('new_message');
  }, []);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const rawDigits = phoneNumber.trim().replace(/^\+\d{1,3}/, '').replace(/^0+/, '');
      const fullPhoneNumber = `+${countryCode}${rawDigits}`;
      await sendOTP(fullPhoneNumber);
      setPhoneNumber(fullPhoneNumber);
      localStorage.setItem('rizzmail_phone', fullPhoneNumber);
      setStep(2);
      setResendCooldown(30);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    try {
      setError('');
      setResendMessage('');
      const targetPhone = phoneNumber || localStorage.getItem('rizzmail_phone');
      await sendOTP(targetPhone);
      setResendMessage('OTP resent successfully!');
      setResendCooldown(30);
      setTimeout(() => setResendMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to resend OTP');
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!otp || otp.length !== 6) {
      setError('Please enter the exact 6-digit code sent to your phone.');
      return;
    }
    setUser(normalizedUser);
      localStorage.setItem('rizzmail_user', JSON.stringify(normalizedUser));
      setLoading(false);

      // Instantly go to Dashboard (Step 6) without asking for profile or terms again!
      setStep(6);

    setLoading(true);
    try {
      const targetPhone = phoneNumber || localStorage.getItem('rizzmail_phone');
      const res = await verifyOTP(targetPhone, otp);
      const rawUser = res.data.user || {};
      
      const normalizedUser = {
        ...rawUser,
        phoneNumber: rawUser.phoneNumber || rawUser.phone || targetPhone,
        firstName: rawUser.firstName || (rawUser.name ? rawUser.name.split(' ')[0] : ''),
        lastName: rawUser.lastName || (rawUser.name ? rawUser.name.split(' ').slice(1).join(' ') : ''),
        profilePhoto: rawUser.profilePhoto || rawUser.photo,
        agreedToTerms: rawUser.agreedToTerms || rawUser.termsAgreed || false
      };

      setUser(normalizedUser);
      localStorage.setItem('rizzmail_user', JSON.stringify(normalizedUser));
      setLoading(false);

      if (res.data.hasProfile || (normalizedUser.firstName && normalizedUser.agreedToTerms)) {
        setStep(6);
      } else if (normalizedUser.firstName) {
        setStep(4);
      } else {
        setStep(3);
      }
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.error || err.response?.data?.message || 'Invalid verification code entered.');
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !dob) {
      setError('Please fill in all identity fields including Date of Birth.');
      return;
    }

    const today = new Date();
    const birthDate = new Date(dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;

    if (age < 13) {
      setError('You must be at least 13 years old to create a RizzMail account.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const activePhone = getUserPhone();
      const res = await updateProfileAPI({
        phone: activePhone,
        phoneNumber: activePhone,
        firstName,
        lastName,
        dob,
        birthdate: dob,
        profilePhoto,
        photo: profilePhoto,
        agreedToTerms: user?.agreedToTerms || false,
        termsAgreed: user?.termsAgreed || false
      });
      const rawUser = res.data.user;
      const normalizedUser = {
        ...rawUser,
        phoneNumber: rawUser.phoneNumber || rawUser.phone || activePhone,
        firstName: rawUser.firstName || firstName,
        lastName: rawUser.lastName || lastName,
        profilePhoto: rawUser.profilePhoto || rawUser.photo || profilePhoto,
        agreedToTerms: rawUser.agreedToTerms || rawUser.termsAgreed || true
      };
      setUser(normalizedUser);
      localStorage.setItem('rizzmail_user', JSON.stringify(normalizedUser));
      setLoading(false);
      setStep(4);
    } catch (err) {
      setLoading(false);
      setError(err.response?.data?.message || 'Failed to save profile information.');
    }
  };

  const handleAgreeToTerms = async () => {
    setLoading(true);
    try {
      const activePhone = getUserPhone();
      const res = await updateProfileAPI({
        phone: activePhone,
        phoneNumber: activePhone,
        firstName: user?.firstName || firstName,
        lastName: user?.lastName || lastName,
        dob: user?.dob || dob,
        birthdate: user?.dob || dob,
        profilePhoto: user?.profilePhoto || profilePhoto,
        photo: user?.profilePhoto || profilePhoto,
        agreedToTerms: true,
        termsAgreed: true
      });
      const rawUser = res.data.user;
      const normalizedUser = {
        ...rawUser,
        phoneNumber: rawUser.phoneNumber || rawUser.phone || activePhone,
        firstName: rawUser.firstName || user?.firstName,
        lastName: rawUser.lastName || user?.lastName,
        profilePhoto: rawUser.profilePhoto || user?.profilePhoto,
        agreedToTerms: true
      };
      setUser(normalizedUser);
      localStorage.setItem('rizzmail_user', JSON.stringify(normalizedUser));
      setLoading(false);
      setStep(5);
    } catch (err) {
      setLoading(false);
      setError('Failed to update terms agreement.');
    }
  };

  const handleUpdateAccountDetails = async (e) => {
    e.preventDefault();
    setError('');
    setProfileSuccess('');

    if (!editFirstName.trim() || !editLastName.trim()) {
      setError('First name and last name cannot be empty.');
      return;
    }

    try {
      const activePhone = getUserPhone();
      const res = await updateProfileAPI({
        phone: activePhone,
        phoneNumber: activePhone,
        firstName: editFirstName,
        lastName: editLastName,
        dob: user.dob,
        birthdate: user.dob,
        profilePhoto: editProfilePhoto,
        photo: editProfilePhoto,
        agreedToTerms: true,
        termsAgreed: true
      });
      const rawUser = res.data.user;
      const updatedUser = {
        ...rawUser,
        phoneNumber: rawUser.phoneNumber || rawUser.phone || activePhone,
        firstName: editFirstName,
        lastName: editLastName,
        profilePhoto: editProfilePhoto,
        agreedToTerms: true
      };
      setUser(updatedUser);
      localStorage.setItem('rizzmail_user', JSON.stringify(updatedUser));
      setProfileSuccess('Profile updated successfully!');
      setTimeout(() => {
        setProfileSuccess('');
        setIsEditingProfile(false);
      }, 1500);
    } catch (err) {
      setError('Failed to update profile details.');
    }
  };

  const handleOpenDeletionWarning = () => {
    setError('');
    setStep(7);
  };

  const handleProceedToDeleteOTP = async () => {
    try {
      setDeleteLoading(true);
      setError('');
      const activePhone = getUserPhone();
      const cleanPhone = activePhone.startsWith('+') ? activePhone : `+${activePhone}`;
      await sendOTP(cleanPhone);
      setDeleteLoading(false);
      setStep(8);
    } catch (err) {
      setDeleteLoading(false);
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to dispatch deletion confirmation OTP.');
    }
  };

  const handleConfirmAccountDeletion = async (e) => {
    e.preventDefault();
    setError('');
    if (!deleteOtp || deleteOtp.length !== 6) {
      setError('Please enter the exact 6-digit confirmation code.');
      return;
    }

    setDeleteLoading(true);
    try {
      const activePhone = getUserPhone();
      const cleanPhone = activePhone.startsWith('+') ? activePhone : `+${activePhone}`;
      await verifyOTP(cleanPhone, deleteOtp);
      await deleteAccountAPI(cleanPhone);
      setDeleteLoading(false);
      handleLogout();
    } catch (err) {
      setDeleteLoading(false);
      setError(err.response?.data?.error || err.response?.data?.message || 'Invalid confirmation code. Deletion aborted.');
    }
  };

  const loadInbox = async (phone) => {
    try {
      const res = await fetchMessages(phone);
      setMessages(res.data || []);
    } catch (err) {
      console.error('Failed to load messages', err);
    }
  };

  const handleCopyEmail = () => {
    const activePhone = getUserPhone();
    const emailStr = `${getEmailPhone(activePhone)}@rizzmail.me`;
    navigator.clipboard.writeText(emailStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReply = (senderEmail) => {
    setSelectedMessage(null);
    setRecipientEmail(senderEmail);
    setSubject('Re: Your message');
    setActiveTab('compose');
    setIsEditingProfile(false);
  };

  const handleSendEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSendSuccess('');
    setLoading(true);
    try {
      const activePhone = getUserPhone();
      await sendEmailAPI({
        senderPhone: activePhone,
        recipientEmail,
        subject,
        body
      });
      setSendSuccess('Email sent successfully!');
      setRecipientEmail('');
      setSubject('');
      setBody('');
      
      loadInbox(activePhone);

      setTimeout(() => setActiveTab('inbox'), 1500);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateIncomingEmail = async () => {
    try {
      const activePhone = getEmailPhone(getUserPhone());
      const backendBase = import.meta.env.VITE_BACKEND_URL || 'https://rizzmail-backend.onrender.com';
      await fetch(`${backendBase}/api/email/simulate-incoming`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: activePhone,
          sender: "evaluator@rizzmail.me",
          subject: "Live Security & Notification Alert",
          body: "Your burner inbox successfully ingested this message in real-time via WebSocket broadcast."
        })
      });
      loadInbox(getUserPhone());
    } catch (e) {
      console.error("Simulation failed", e);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    try {
      await deleteMessageAPI(msgId);
      setMessages((prev) => prev.filter(m => m._id !== msgId));
      setSelectedMessage(null);
    } catch (err) {
      setError('Failed to delete email');
    }
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    setTimeout(() => {
      setUser(null);
      localStorage.removeItem('rizzmail_user');
      localStorage.removeItem('rizzmail_phone');
      setPhoneNumber('');
      setOtp('');
      setFirstName('');
      setLastName('');
      setDob('');
      setProfilePhoto('');
      setIsLoggingOut(false);
      setStep(1);
      setMessages([]);
      setActiveTab('inbox');
      setIsEditingProfile(false);
    }, 2400);
  };

  const filteredMessages = messages.filter((msg) => {
    const matchesSearch = 
      msg.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (msg.subject && msg.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
      msg.body.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === 'inbox') return msg.direction !== 'outbound';
    if (activeTab === 'sent') return msg.direction === 'outbound';
    return true;
  });

  return (
    <div className="app-container">
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <div style={{
            width: '2.6rem',
            height: '2.6rem',
            borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: '800',
            fontSize: '1.2rem',
            color: '#ffffff',
            boxShadow: '0 4px 18px rgba(99, 102, 241, 0.45)',
            flexShrink: 0,
            letterSpacing: '1px'
          }}>
            gm
          </div>
          <div>
            <h1 className="logo-text">rizzmail.me</h1>
            <p>Gmail-Style Secure Burner Mailbox</p>
          </div>
        </div>
        
        <div className="header-right">
          <div className="status-pill">
            <span className="pulse-dot"></span> System Online
          </div>
          
          {user && step === 6 && !isLoggingOut && (
            <button 
              onClick={() => setIsEditingProfile(!isEditingProfile)} 
              className="theme-toggle-btn"
              title={`${user.firstName || 'User'}`}
              style={{ background: isEditingProfile ? 'rgba(99, 102, 241, 0.25)' : undefined, overflow: 'hidden', padding: 0 }}
            >
              {user.profilePhoto ? (
                <img src={user.profilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={18} />
              )}
            </button>
          )}

          <button 
            onClick={toggleTheme} 
            className="theme-toggle-btn"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <main className="main-content" style={{ padding: step === 6 && !isEditingProfile ? '0' : '2rem 1rem', width: '100%', flex: 1 }}>
        {error && <div className="error-banner">{error}</div>}

        {isLoggingOut && (
          <div className="card-wrapper" style={{ textAlign: 'center', margin: 'auto', animation: 'slideUp 0.3s ease-out' }}>
            <div className="card" style={{ padding: '3.5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Lock size={32} style={{ color: '#818cf8', animation: 'spin 1.5s linear infinite', marginBottom: '1rem' }} />
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Signing Out...</h2>
            </div>
          </div>
        )}

        {!isLoggingOut && step === 1 && (
          <div style={{ margin: 'auto', maxWidth: '440px' }}>
            <form onSubmit={handleSendOTP} className="card">
              <div className="badge-pill"><Shield size={12} /> Secure Authentication</div>
              <h2>Welcome to RizzMail</h2>
              <p className="subtitle">Enter your mobile number to sign in.</p>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <div className="phone-input-container">
                  <div className="input-icon-left"><Phone size={18} /></div>
                  <select className="country-select-clean" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                    {countriesList.map((c) => (<option key={c.name + c.code} value={c.code}>{c.label}</option>))}
                  </select>
                  <input
                    type="text"
                    className="phone-number-input"
                    placeholder="9876543210"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="primary-btn" disabled={loading}>
                {loading ? 'Dispatching Code...' : 'Continue with OTP ➔'}
              </button>
            </form>
          </div>
        )}

        {!isLoggingOut && step === 2 && (
          <div className="card-wrapper" style={{ margin: 'auto', maxWidth: '440px' }}>
            <form onSubmit={handleVerifyOtp} className="card">
              <div className="badge-pill"><Lock size={12} /> Verification</div>
              <h2>Enter Code</h2>
              <p className="subtitle">We've sent a 6-digit code to <b>{phoneNumber}</b>.</p>
              
              <div className="input-group-stack">
                <input
                  type="text"
                  placeholder="0 0 0 0 0 0"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  required
                  style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.4em', fontFamily: 'JetBrains Mono, monospace' }}
                />
              </div>
              <button type="submit" className="primary-btn" disabled={loading}>Verify & Continue</button>
            </form>
          </div>
        )}

        {!isLoggingOut && step === 3 && (
          <div className="card-wrapper" style={{ margin: 'auto', maxWidth: '440px' }}>
            <form onSubmit={handleSaveProfile} className="card">
              <h2>Complete Profile</h2>
              <p className="subtitle">Provide your name and date of birth (13+).</p>
              <div className="input-group-stack"><label>First Name</label><input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
              <div className="input-group-stack"><label>Last Name</label><input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
              <div className="input-group-stack"><label>Date of Birth</label><input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required /></div>
              <button type="submit" className="primary-btn" disabled={loading}>Next: Terms ➔</button>
            </form>
          </div>
        )}

        {!isLoggingOut && step === 4 && (
          <div className="card-wrapper" style={{ margin: 'auto', maxWidth: '520px' }}>
            <div className="card" style={{ textAlign: 'left' }}>
              <h2>Terms of Service</h2>
              <p className="subtitle">Please agree to continue.</p>
              <button type="button" onClick={handleAgreeToTerms} className="primary-btn">I Agree & Initialize ➔</button>
            </div>
          </div>
        )}

        {!isLoggingOut && step === 5 && (
          <div className="card-wrapper" style={{ textAlign: 'center', margin: 'auto' }}>
            <div className="card" style={{ padding: '3.5rem 2rem' }}>
              <Cpu size={34} style={{ color: '#818cf8', animation: 'spin 2s linear infinite', marginBottom: '1rem' }} />
              <h2>{setupStepsList[setupStage]}</h2>
            </div>
          </div>
        )}

        {/* GMAIL DASHBOARD LAYOUT */}
        {!isLoggingOut && step === 6 && user && (
          <div style={{ width: '100%', height: '100%' }}>
            {isEditingProfile ? (
              <div className="card-wrapper" style={{ margin: '2rem auto', maxWidth: '520px' }}>
                <div className="card" style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3>Manage Account</h3>
                    <button onClick={() => setIsEditingProfile(false)} className="text-btn">Back</button>
                  </div>
                  {profileSuccess && <div className="success-banner">{profileSuccess}</div>}
                  <form onSubmit={handleUpdateAccountDetails} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="input-group-stack"><label>First Name</label><input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} required /></div>
                    <div className="input-group-stack"><label>Last Name</label><input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} required /></div>
                    <button type="submit" className="primary-btn">Save Changes</button>
                  </form>
                  <button onClick={handleOpenDeletionWarning} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '0.75rem', marginTop: '1.5rem', cursor: 'pointer', width: '100%', fontWeight: '600' }}>Delete Account 🗑️</button>
                </div>
              </div>
            ) : (
              <div className="gmail-layout">
                {/* GMAIL SIDEBAR */}
                <div className="gmail-sidebar">
                  <button className="gmail-compose-btn" onClick={() => setActiveTab('compose')}>
                    <Edit3 size={18} /> Compose
                  </button>

                  <button className={`sidebar-nav-item ${activeTab === 'inbox' ? 'active' : ''}`} onClick={() => setActiveTab('inbox')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><Mail size={16} /> Inbox</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700' }}>{messages.filter(m => m.direction !== 'outbound').length}</span>
                  </button>

                  <button className={`sidebar-nav-item ${activeTab === 'sent' ? 'active' : ''}`} onClick={() => setActiveTab('sent')}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><Send size={16} /> Sent</span>
                  </button>

                  <div style={{ marginTop: 'auto', borderTop: '1px solid var(--input-border)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all', color: 'var(--text-muted)' }}>
                      <b>{getEmailPhone(getUserPhone())}@rizzmail.me</b>
                    </div>
                    <button onClick={handleCopyEmail} className="sidebar-nav-item"><Copy size={15} /> Copy Address</button>
                    <button onClick={() => setShowLogoutConfirm(true)} className="sidebar-nav-item" style={{ color: '#f87171' }}><LogOut size={15} /> Sign Out</button>
                  </div>
                </div>

                {/* GMAIL MAIN CONTENT AREA */}
                <div className="gmail-main">
                  <div className="gmail-toolbar">
                    <div className="search-bar-container" style={{ margin: 0, flex: 1, maxWidth: '600px' }}>
                      <Search size={16} className="search-icon" />
                      <input type="text" placeholder="Search mail..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={handleSimulateIncomingEmail} className="refresh-btn" title="Simulate incoming test email">
                        <Zap size={14} /> Test Mail
                      </button>
                      <button onClick={() => loadInbox(getUserPhone())} className="refresh-btn" title="Refresh">
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>

                  {activeTab === 'compose' ? (
                    <form onSubmit={handleSendEmailSubmit} style={{ padding: '2rem', maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <h3>New Message</h3>
                      {sendSuccess && <div className="success-banner">{sendSuccess}</div>}
                      <div className="input-group-stack">
                        <label>To:</label>
                        <input type="email" placeholder="recipient@rizzmail.me" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} required />
                      </div>
                      <div className="input-group-stack">
                        <label>Subject:</label>
                        <input type="text" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                      </div>
                      <div className="input-group-stack">
                        <label>Message Body:</label>
                        <textarea rows="8" placeholder="Write your email here..." value={body} onChange={(e) => setBody(e.target.value)} required />
                      </div>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <button type="submit" className="primary-btn" style={{ width: 'auto', padding: '0.75rem 2rem' }} disabled={loading}>
                          <Send size={16} /> Send
                        </button>
                        <button type="button" onClick={() => setActiveTab('inbox')} style={{ background: 'transparent', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.75rem 1.5rem', borderRadius: '0.875rem', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      {filteredMessages.length === 0 ? (
                        <div className="empty-inbox" style={{ border: 'none', background: 'transparent', padding: '5rem' }}>
                          <Mail size={48} />
                          <p style={{ marginTop: '1rem' }}>No messages in {activeTab}</p>
                          <small>Click <b>Test Mail</b> above to test real-time WebSocket ingestion.</small>
                        </div>
                      ) : (
                        filteredMessages.map((msg) => {
                          const isOutbound = msg.direction === 'outbound';
                          return (
                            <div key={msg._id || Math.random()} className="gmail-message-row" onClick={() => setSelectedMessage(msg)}>
                              <span className="gmail-sender" style={{ color: isOutbound ? '#818cf8' : '#34d399' }}>
                                {isOutbound ? `To: ${msg.recipient}` : msg.sender}
                              </span>
                              <span className="gmail-content-snippet">
                                <b>{msg.subject || 'No Subject'}</b> — {msg.body}
                              </span>
                              <span className="gmail-time">{new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* EMAIL READING MODAL WITH DELETE & REPLY */}
        {selectedMessage && (
          <div className="modal-overlay" onClick={() => setSelectedMessage(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div>
                  <span className="badge" style={{ marginBottom: '0.5rem', display: 'inline-block' }}>
                    {selectedMessage.direction === 'outbound' ? `To: ${selectedMessage.recipient}` : `From: ${selectedMessage.sender}`}
                  </span>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{selectedMessage.subject || 'No Subject'}</h3>
                  <span className="date">{new Date(selectedMessage.createdAt || Date.now()).toLocaleString()}</span>
                </div>
                <button onClick={() => setSelectedMessage(null)} className="close-modal-btn"><X size={18} /></button>
              </div>
              <div className="modal-body">{selectedMessage.body}</div>
              <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  onClick={() => handleDeleteMessage(selectedMessage._id)} 
                  style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.75rem', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Trash2 size={16} /> Delete
                </button>
                <button onClick={() => handleReply(selectedMessage.sender)} className="primary-btn" style={{ width: 'auto', padding: '0.625rem 1.25rem' }}>
                  <CornerUpLeft size={16} /> Reply
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACCOUNT DELETION WARNING STEP */}
        {!isLoggingOut && step === 7 && (
          <div className="card-wrapper" style={{ maxWidth: '480px', margin: 'auto' }}>
            <div className="card" style={{ textAlign: 'left' }}>
              <div className="badge-pill" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                <AlertTriangle size={12} /> Warning: Account Deletion
              </div>
              <h2 style={{ color: '#ef4444', fontSize: '1.4rem', marginBottom: '0.5rem' }}>Do you really want to delete your account?</h2>
              <p className="subtitle" style={{ marginBottom: '1.5rem', lineHeight: '1.5' }}>
                This action is permanent and cannot be undone. All your messages, profile settings, and your burner email endpoint will be permanently wiped out.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setStep(6)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.8rem', borderRadius: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                <button type="button" onClick={handleProceedToDeleteOTP} disabled={deleteLoading} style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>{deleteLoading ? 'Sending...' : 'Send Deletion OTP ➔'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ACCOUNT DELETION OTP STEP */}
        {!isLoggingOut && step === 8 && (
          <div className="card-wrapper" style={{ maxWidth: '460px', margin: 'auto' }}>
            <form onSubmit={handleConfirmAccountDeletion} className="card" style={{ textAlign: 'left' }}>
              <h2 style={{ color: '#ef4444', fontSize: '1.4rem' }}>Enter Deletion OTP</h2>
              <p className="subtitle" style={{ marginBottom: '1.5rem' }}>Enter the 6-digit verification code sent to your phone.</p>
              <div className="input-group-stack" style={{ marginBottom: '1.5rem' }}>
                <input type="text" placeholder="0 0 0 0 0 0" value={deleteOtp} onChange={(e) => setDeleteOtp(e.target.value)} maxLength={6} required style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.4em', fontFamily: 'JetBrains Mono, monospace' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" onClick={() => setStep(7)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.8rem', borderRadius: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>Back</button>
                <button type="submit" disabled={deleteLoading} style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', padding: '0.8rem', borderRadius: '0.875rem', fontWeight: '600', cursor: 'pointer' }}>{deleteLoading ? 'Verifying...' : 'Confirm Deletion 🗑️'}</button>
              </div>
            </form>
          </div>
        )}

      </main>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="card-wrapper" style={{ maxWidth: '400px', margin: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="card" style={{ textAlign: 'left' }}>
              <h3>Sign Out Confirmation</h3>
              <p className="subtitle" style={{ margin: '1rem 0' }}>Are you sure you want to log out?</p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setShowLogoutConfirm(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.75rem', borderRadius: '0.75rem', cursor: 'pointer' }}>Cancel</button>
                <button onClick={() => { setShowLogoutConfirm(false); handleLogout(); }} style={{ flex: 1, background: '#6366f1', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>Sign Out</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;