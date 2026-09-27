import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { sendOTP, verifyOTP, updateProfileAPI, fetchMessages, sendEmailAPI, deleteAccountAPI, deleteMessageAPI } from './services/api';
import { Phone, Lock, Mail, RefreshCw, LogOut, Send, Edit3, Plus, Copy, Check, X, CornerUpLeft, Search, User, Shield, ArrowLeft, Loader2, Trash2, AlertTriangle, Cpu, Sun, Moon, Zap, Archive, Menu, Trash } from 'lucide-react';
import './App.css';

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
      if (parsed && parsed.phoneNumber) return parsed;
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem('rizzmail_user');
    return null;
  });

  const [countryCode, setCountryCode] = useState('91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const [step, setStep] = useState(() => (user ? 6 : 1));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState(null);

  // Chat Navigation & New Chat States
  const [activeChatSender, setActiveChatSender] = useState(null);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [chatMessageBody, setChatMessageBody] = useState('');
  const [activeTab, setActiveTab] = useState('chats');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatInput, setNewChatInput] = useState('');

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

  const getUserPhone = () => {
    return user?.phoneNumber || user?.phone || phoneNumber;
  };

  // Canonical key normalizer to unify phone numbers and aliases into one single thread
  const getCanonicalKey = (input) => {
    if (!input) return '';
    const str = input.toString().toLowerCase().trim();
    if (str.endsWith('@rizzmail.me')) {
      const localPart = str.split('@')[0];
      const pure = localPart.replace(/[^0-9]/g, '');
      if (pure.length >= 10) return pure.slice(-10);
      return localPart;
    }
    const pureDigits = str.replace(/[^0-9]/g, '');
    if (pureDigits.length >= 10) return pureDigits.slice(-10);
    return str;
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
          if (prev < setupStepsList.length - 1) return prev + 1;
          else {
            clearInterval(interval);
            return prev;
          }
        });
      }, 750);

      const timeout = setTimeout(() => setStep(6), 3200);
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
  }, [step]);

  useEffect(() => {
    socket.on('new_message', (incomingMsg) => {
      setMessages((prev) => {
        if (incomingMsg._id && prev.some(m => m._id === incomingMsg._id)) return prev;
        return [incomingMsg, ...prev];
      });
      setToast(incomingMsg);
      setTimeout(() => setToast(null), 5000);
    });

    return () => socket.off('new_message');
  }, []);

  const handleImageUpload = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Profile image must be less than 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) setEditProfilePhoto(reader.result);
      else setProfilePhoto(reader.result);
    };
    reader.readAsDataURL(file);
  };

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

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!otp || otp.length !== 6) {
      setError('Please enter the exact 6-digit code sent to your phone.');
      return;
    }

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
        dob: rawUser.dob || rawUser.birthdate || '',
        agreedToTerms: rawUser.agreedToTerms || rawUser.termsAgreed || false
      };

      setUser(normalizedUser);
      localStorage.setItem('rizzmail_user', JSON.stringify(normalizedUser));
      setLoading(false);

      if (!normalizedUser.firstName || !normalizedUser.dob) setStep(3);
      else if (!normalizedUser.agreedToTerms) setStep(4);
      else setStep(6);
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
        agreedToTerms: true,
        termsAgreed: true
      });
      const rawUser = res.data.user;
      const normalizedUser = {
        ...rawUser,
        phoneNumber: rawUser.phoneNumber || rawUser.phone || activePhone,
        firstName: rawUser.firstName || firstName,
        lastName: rawUser.lastName || lastName,
        dob: dob,
        profilePhoto: rawUser.profilePhoto || rawUser.photo || profilePhoto,
        agreedToTerms: true
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
        dob: rawUser.dob || user?.dob,
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
        dob: user.dob,
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
      setError(err.response?.data?.error || err.response?.data?.message || 'Invalid confirmation code.');
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

  const handleSendReplySubmit = async (e) => {
    e.preventDefault();
    if (!chatMessageBody.trim() || !activeChatSender) return;
    setLoading(true);
    try {
      const activePhone = getUserPhone();
      const res = await sendEmailAPI({
        senderPhone: activePhone,
        recipientEmail: activeChatSender,
        subject: 'Re: Conversation',
        body: chatMessageBody
      });
      
      if (res.data && res.data.message) {
        const newMsg = res.data.message;
        setMessages((prev) => {
          if (newMsg._id && prev.some(m => m._id === newMsg._id)) return prev;
          return [newMsg, ...prev];
        });
      } else {
        loadInbox(activePhone);
      }
      setChatMessageBody('');
    } catch (err) {
      setError('Failed to send reply.');
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
          subject: "Test Message",
          body: "Hello! Testing live profile picture and name display."
        })
      });
      loadInbox(getUserPhone());
    } catch (e) {
      console.error("Simulation failed", e);
    }
  };

  const handleDeleteChatThread = async (canonicalKey) => {
    try {
      const backendBase = import.meta.env.VITE_BACKEND_URL || 'https://rizzmail-backend.onrender.com';
      await fetch(`${backendBase}/api/email/thread/${canonicalKey}`, { method: 'DELETE' });
      setMessages((prev) => prev.filter(m => {
        const isOutbound = m.direction === 'outbound';
        const other = isOutbound ? m.recipient : m.sender;
        return getCanonicalKey(other) !== canonicalKey;
      }));
      setActiveChatSender(null);
    } catch (e) {
      setError('Failed to delete chat thread.');
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
      setActiveChatSender(null);
      setIsEditingProfile(false);
    }, 2400);
  };

  // STRICT UNIFIED THREAD MAPPING
  const chatThreadsMap = {};
  messages.forEach((msg) => {
    if (msg.isDeleted) return;
    const isOutbound = msg.direction === 'outbound';
    const otherParty = isOutbound ? msg.recipient : msg.sender;
    if (!otherParty) return;

    const canonicalKey = getCanonicalKey(otherParty);

    if (!chatThreadsMap[canonicalKey]) {
      chatThreadsMap[canonicalKey] = {
        canonicalKey: canonicalKey,
        sender: otherParty,
        name: msg.counterpartyName || (isOutbound ? msg.recipient : msg.sender).split('@')[0],
        avatar: msg.counterpartyPhoto || '',
        messages: []
      };
    }
    if (msg.counterpartyPhoto && !chatThreadsMap[canonicalKey].avatar) {
      chatThreadsMap[canonicalKey].avatar = msg.counterpartyPhoto;
    }
    if (msg.counterpartyName && chatThreadsMap[canonicalKey].name.includes('@')) {
      chatThreadsMap[canonicalKey].name = msg.counterpartyName;
    }
    chatThreadsMap[canonicalKey].messages.push(msg);
  });

  const chatThreadsList = Object.values(chatThreadsMap).map(thread => {
    const uniqueMap = new Map();
    thread.messages.forEach(m => uniqueMap.set(m._id || JSON.stringify(m), m));
    thread.messages = Array.from(uniqueMap.values());
    thread.messages.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
    thread.lastMessage = thread.messages[thread.messages.length - 1];
    return thread;
  });

  const filteredThreads = chatThreadsList.filter(thread => 
    thread.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
    thread.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (thread.lastMessage && thread.lastMessage.body.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const activeThread = activeChatSender ? chatThreadsMap[getCanonicalKey(activeChatSender)] : null;

  return (
    <div className="app-container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          {user && step === 6 && (
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="theme-toggle-btn mobile-hamburger-btn" 
              style={{ display: 'none' }}
              title="Toggle Menu"
            >
              <Menu size={20} />
            </button>
          )}

          <div style={{
            width: '2.6rem',
            height: '2.6rem',
            borderRadius: '0.75rem',
            background: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
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
            rm
          </div>
          <div>
            <h1 className="logo-text">rizzmail.me</h1>
            <p>Burner Numbers. Real Inboxes. Zero Trace.</p>
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

      <main className="main-content" style={{ padding: step === 6 && !isEditingProfile ? '0' : '2rem 1rem', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
        {error && <div className="error-banner" style={{ width: '100%', maxWidth: '440px', marginBottom: '1rem' }}>{error}</div>}

        {isLoggingOut && (
          <div className="card-wrapper" style={{ textAlign: 'center', margin: 'auto', width: '100%', maxWidth: '440px', display: 'flex', justifyContent: 'center', animation: 'slideUp 0.3s ease-out' }}>
            <div className="card" style={{ padding: '3.5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <Lock size={32} style={{ color: '#818cf8', animation: 'spin 1.5s linear infinite', marginBottom: '1rem' }} />
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Signing Out...</h2>
            </div>
          </div>
        )}

        {!isLoggingOut && step === 1 && (
          <div style={{ margin: 'auto', width: '100%', maxWidth: '440px', display: 'flex', justifyContent: 'center' }}>
            <form onSubmit={handleSendOTP} className="card" style={{ width: '100%' }}>
              <div className="badge-pill"><Shield size={12} /> Secure Authentication</div>
              <h2>Welcome to RizzMail</h2>
              <p className="subtitle">Enter your mobile number to sign in or create an account.</p>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <div className="phone-input-container">
                  <div className="input-icon-left"><Phone size={18} /></div>
                  <select className="country-select-clean" value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
                    {countriesList.map((c) => (<option key={c.name + c.code} value={c.code}>{c.label}</option>))}
                  </select>
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
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
          <div className="card-wrapper" style={{ margin: 'auto', width: '100%', maxWidth: '440px', display: 'flex', justifyContent: 'center' }}>
            <form onSubmit={handleVerifyOtp} className="card" style={{ width: '100%' }}>
              <div className="badge-pill"><Lock size={12} /> Verification</div>
              <h2>Enter Code</h2>
              <p className="subtitle">We've sent a 6-digit code to <b>{phoneNumber}</b>.</p>
              
              <div className="input-group-stack">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
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
          <div className="card-wrapper" style={{ margin: 'auto', width: '100%', maxWidth: '440px', display: 'flex', justifyContent: 'center' }}>
            <form onSubmit={handleSaveProfile} className="card" style={{ width: '100%' }}>
              <h2>Complete Profile</h2>
              <p className="subtitle">Provide your name, date of birth, and profile photo.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: 'var(--input-bg)',
                  border: '2px dashed var(--input-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'pointer'
                }}>
                  {profilePhoto ? (
                    <img src={profilePhoto} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={32} style={{ color: 'var(--text-muted)' }} />
                  )}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => handleImageUpload(e, false)}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                  />
                </div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Tap to upload profile photo</label>
              </div>

              <div className="input-group-stack"><label>First Name</label><input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
              <div className="input-group-stack"><label>Last Name</label><input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
              <div className="input-group-stack"><label>Date of Birth (13+)</label><input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required /></div>
              <button type="submit" className="primary-btn" disabled={loading}>Next: Terms ➔</button>
            </form>
          </div>
        )}

        {!isLoggingOut && step === 4 && (
          <div className="card-wrapper" style={{ margin: 'auto', width: '100%', maxWidth: '520px', display: 'flex', justifyContent: 'center' }}>
            <div className="card" style={{ textAlign: 'left', width: '100%' }}>
              <h2>Terms of Service</h2>
              <p className="subtitle">Please agree to continue to your burner inbox.</p>
              <button type="button" onClick={handleAgreeToTerms} className="primary-btn" disabled={loading}>I Agree & Initialize ➔</button>
            </div>
          </div>
        )}

        {!isLoggingOut && step === 5 && (
          <div className="card-wrapper" style={{ textAlign: 'center', margin: 'auto', width: '100%', maxWidth: '440px', display: 'flex', justifyContent: 'center' }}>
            <div className="card" style={{ padding: '3.5rem 2rem', width: '100%' }}>
              <Cpu size={34} style={{ color: '#818cf8', animation: 'spin 2s linear infinite', marginBottom: '1rem' }} />
              <h2>{setupStepsList[setupStage]}</h2>
            </div>
          </div>
        )}

        {/* STEP 6: CHAT DASHBOARD */}
        {!isLoggingOut && step === 6 && user && (
          <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', justifyContent: 'center' }}>
            {isEditingProfile ? (
              <div className="card-wrapper" style={{ margin: '2rem auto', width: '100%', maxWidth: '520px', display: 'flex', justifyContent: 'center' }}>
                <div className="card" style={{ textAlign: 'left', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3>Manage Account</h3>
                    <button onClick={() => setIsEditingProfile(false)} className="text-btn">Back</button>
                  </div>
                  {profileSuccess && <div className="success-banner">{profileSuccess}</div>}

                  <form onSubmit={handleUpdateAccountDetails} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'var(--input-bg)',
                        border: '2px dashed var(--input-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                        position: 'relative',
                        cursor: 'pointer'
                      }}>
                        {editProfilePhoto ? (
                          <img src={editProfilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <User size={32} style={{ color: 'var(--text-muted)' }} />
                        )}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => handleImageUpload(e, true)}
                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                        />
                      </div>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Change profile photo</label>
                    </div>

                    <div className="input-group-stack"><label>First Name</label><input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} required /></div>
                    <div className="input-group-stack"><label>Last Name</label><input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} required /></div>
                    <button type="submit" className="primary-btn">Save Changes</button>
                  </form>
                  <button onClick={handleOpenDeletionWarning} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '0.75rem', marginTop: '1.5rem', cursor: 'pointer', width: '100%', fontWeight: '600' }}>Delete Account 🗑️</button>
                </div>
              </div>
            ) : (
              <div className="whatsapp-layout" style={{ display: 'flex', width: '100%', height: 'calc(100vh - 70px)', background: 'var(--card-bg)', border: '1px solid var(--input-border)', borderRadius: '1rem', overflow: 'hidden' }}>
                
                {/* CHAT LIST PANE */}
                <div className={`whatsapp-sidebar ${activeChatSender ? 'mobile-hidden' : ''}`} style={{ width: '360px', borderRight: '1px solid var(--input-border)', display: 'flex', flexDirection: 'column', background: 'var(--card-bg)', flexShrink: 0 }}>
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--input-border)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div className="search-bar-container" style={{ margin: 0, flex: 1 }}>
                      <Search size={16} className="search-icon" />
                      <input type="text" placeholder="Search chats..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" />
                    </div>

                    {/* NEW CHAT BUTTON */}
                    <button 
                      onClick={() => setShowNewChatModal(true)} 
                      className="refresh-btn" 
                      title="Start New Chat"
                      style={{ background: '#6366f1', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Plus size={16} />
                    </button>

                    <button onClick={handleSimulateIncomingEmail} className="refresh-btn" title="Simulate incoming chat">
                      <Zap size={14} />
                    </button>
                    <button onClick={() => loadInbox(getUserPhone())} className="refresh-btn" title="Refresh">
                      <RefreshCw size={14} />
                    </button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    {filteredThreads.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                        <Mail size={36} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                        <p>No active chats</p>
                        <small>Click <b>+</b> to text someone new or <b>⚡ Test</b> to simulate.</small>
                      </div>
                    ) : (
                      filteredThreads.map((thread) => {
                        const isSelected = activeChatSender === thread.sender;
                        return (
                          <div 
                            key={thread.canonicalKey}
                            onClick={() => setActiveChatSender(thread.sender)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.875rem',
                              padding: '0.875rem 1rem',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--input-border)',
                              background: isSelected ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                              transition: 'background 0.2s'
                            }}
                          >
                            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, color: '#fff', fontWeight: 'bold' }}>
                              {thread.avatar ? (
                                <img src={thread.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                thread.name.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
                                <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{thread.name}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(thread.lastMessage?.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                                {thread.lastMessage?.subject ? `${thread.lastMessage.subject}: ` : ''}{thread.lastMessage?.body}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ACTIVE CHAT WINDOW PANE */}
                <div className={`whatsapp-chat-window ${!activeChatSender ? 'mobile-hidden' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
                  {activeThread ? (
                    <>
                      <div style={{ padding: '0.75rem 1rem', background: 'var(--card-bg)', borderBottom: '1px solid var(--input-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', cursor: 'pointer', flex: 1, minWidth: 0 }} onClick={() => setShowChatInfo(true)}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); setActiveChatSender(null); }}
                            className="whatsapp-back-btn"
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'none' }}
                          >
                            <ArrowLeft size={20} />
                          </button>
                          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: '0', color: '#fff', fontWeight: 'bold' }}>
                            {activeThread.avatar ? (
                              <img src={activeThread.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              activeThread.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ fontSize: '1rem', color: 'var(--text-primary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeThread.name}</h3>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tap here for contact info</span>
                          </div>
                        </div>

                        {/* DELETE CHAT BUTTON */}
                        <button 
                          onClick={() => handleDeleteChatThread(activeThread.canonicalKey)}
                          title="Delete Chat Thread"
                          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'none', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: '600' }}
                        >
                          <Trash size={15} /> Delete Chat
                        </button>
                      </div>

                      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'radial-gradient(circle, rgba(99,102,241,0.03) 0%, rgba(3,7,18,0.5) 100%)' }}>
                        {activeThread.messages.map((msg, idx) => {
                          const isOutbound = msg.direction === 'outbound';
                          return (
                            <div key={msg._id || idx} style={{ display: 'flex', justifyContent: isOutbound ? 'flex-end' : 'flex-start', width: '100%' }}>
                              <div style={{
                                maxWidth: '70%',
                                background: isOutbound ? '#6366f1' : 'var(--card-bg)',
                                color: isOutbound ? '#ffffff' : 'var(--text-primary)',
                                padding: '0.75rem 1rem',
                                borderRadius: isOutbound ? '1rem 1rem 0 1rem' : '1rem 1rem 1rem 0',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                border: isOutbound ? 'none' : '1px solid var(--input-border)'
                              }}>
                                {msg.subject && <div style={{ fontSize: '0.75rem', opacity: 0.8, marginBottom: '0.25rem', fontWeight: '600' }}>{msg.subject}</div>}
                                <div style={{ fontSize: '0.9rem', wordBreak: 'break-word', lineHeight: '1.4' }}>{msg.body}</div>
                                <div style={{ fontSize: '0.65rem', opacity: 0.7, textAlign: 'right', marginTop: '0.3rem' }}>
                                  {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <form onSubmit={handleSendReplySubmit} style={{ padding: '0.875rem 1rem', background: 'var(--card-bg)', borderTop: '1px solid var(--input-border)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <input 
                          type="text"
                          placeholder="Type a message..."
                          value={chatMessageBody}
                          onChange={(e) => setChatMessageBody(e.target.value)}
                          style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '1.5rem', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none' }}
                        />
                        <button type="submit" disabled={loading} style={{ background: '#6366f1', color: '#fff', border: 'none', width: '42px', height: '42px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 4px 12px rgba(99,102,241,0.3)' }}>
                          <Send size={18} />
                        </button>
                      </form>
                    </>
                  ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>
                      <Mail size={56} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                      <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Secure Chat Portal</h3>
                      <p style={{ maxWidth: '320px', fontSize: '0.9rem' }}>Select a conversation from the left panel or click <b>+</b> to text someone new.</p>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* NEW CHAT MODAL */}
        {showNewChatModal && (
          <div className="modal-overlay" onClick={() => setShowNewChatModal(false)}>
            <div className="modal-content" style={{ maxWidth: '380px', textAlign: 'left', padding: '1.75rem' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>Start New Chat</h3>
                <button onClick={() => setShowNewChatModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}><X size={18} /></button>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Enter a phone number or full @rizzmail.me address to message.</p>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                if (!newChatInput.trim()) return;
                let target = newChatInput.trim().toLowerCase();
                if (!target.includes('@')) {
                  const pure = target.replace(/[^0-9]/g, '').slice(-10);
                  target = `${pure}@rizzmail.me`;
                }
                setActiveChatSender(target);
                setShowNewChatModal(false);
                setNewChatInput('');
              }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input 
                  type="text" 
                  placeholder="9876543210 or user@rizzmail.me" 
                  value={newChatInput} 
                  onChange={(e) => setNewChatInput(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none' }}
                />
                <button type="submit" className="primary-btn">Open Chat ➔</button>
              </form>
            </div>
          </div>
        )}

        {showChatInfo && activeThread && (
          <div className="modal-overlay" onClick={() => setShowChatInfo(false)}>
            <div className="modal-content" style={{ maxWidth: '380px', textAlign: 'center', padding: '2rem 1.5rem' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#6366f1', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: '#fff', fontSize: '2.5rem', fontWeight: 'bold', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
                {activeThread.avatar ? (
                  <img src={activeThread.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  activeThread.name.charAt(0).toUpperCase()
                )}
              </div>
              <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{activeThread.name}</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all', marginBottom: '1.5rem' }}>{activeThread.sender}</p>
              
              <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '0.875rem', textAlign: 'left', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Endpoint Security</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>End-to-end encrypted @rizzmail.me relay</div>
              </div>

              <button onClick={() => setShowChatInfo(false)} className="primary-btn">Close Info</button>
            </div>
          </div>
        )}

        {!isLoggingOut && step === 7 && (
          <div className="card-wrapper" style={{ maxWidth: '480px', margin: 'auto', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <div className="card" style={{ textAlign: 'left', width: '100%' }}>
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

        {!isLoggingOut && step === 8 && (
          <div className="card-wrapper" style={{ maxWidth: '460px', margin: 'auto', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <form onSubmit={handleConfirmAccountDeletion} className="card" style={{ textAlign: 'left', width: '100%' }}>
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

      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="card-wrapper" style={{ maxWidth: '400px', margin: 'auto', width: '100%', display: 'flex', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="card" style={{ textAlign: 'left', width: '100%' }}>
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