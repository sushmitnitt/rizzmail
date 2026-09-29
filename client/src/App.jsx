import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { sendOTP, verifyOTP, updateProfileAPI, fetchMessages, sendEmailAPI, deleteAccountAPI, deleteMessageAPI } from './services/api';
import { Phone, Lock, Mail, RefreshCw, LogOut, Send, Edit3, Plus, Copy, Check, X, CornerUpLeft, Search, User, Shield, ArrowLeft, Loader2, Trash2, AlertTriangle, Cpu, Sun, Moon, Zap, Archive, Menu, Trash, PhoneCall, Video, Paperclip, Smile, Sparkles, Star, Folder, AlertOctagon, Camera, ShieldAlert, Globe, MessageSquareReply } from 'lucide-react';
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

const languagesList = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi (हिंदी)' },
  { code: 'ta', label: 'Tamil (தமிழ்)' },
  { code: 'es', label: 'Spanish (Español)' },
  { code: 'fr', label: 'French (Français)' },
  { code: 'de', label: 'German (Deutsch)' }
];

const normalizeContactIdentifier = (input) => {
  if (!input) return '';
  const str = input.toString().toLowerCase().trim();
  const localPart = str.split('@')[0];
  const pureDigits = localPart.replace(/[^0-9]/g, '');
  if (pureDigits.length >= 10) {
    return pureDigits.slice(-10);
  }
  return localPart || str;
};

// Helper to clean raw incoming email bodies and strip backend transport routing headers[cite: 2]
const formatCleanBody = (bodyText) => {
  if (!bodyText) return '';
  let text = bodyText.toString();

  if (/^\s*(Received|Return-Path|DKIM-Signature|Authentication-Results|MIME-Version):/i.test(text)) {
    const doubleNewline = text.search(/(\r?\n){2}/);
    if (doubleNewline !== -1) {
      text = text.substring(doubleNewline).trim();
    }
  }

  text = text.replace(/^(Received|Return-Path|DKIM-Signature|Authentication-Results|X-[a-zA-Z0-9-]+|Content-Type|Content-Transfer-Encoding|MIME-Version|Message-ID):.*$/gim, '');
  text = text.replace(/--[a-zA-Z0-9_-]{10,}/g, '');

  const replyIndexPatterns = [
    /\n\s*on\s+.+wrote:/i,
    /\n\s*-----+\s*original message\s*-----+/i,
    /\n\s*from:\s*.+/i
  ];

  for (const pattern of replyIndexPatterns) {
    const match = text.search(pattern);
    if (match !== -1) {
      text = text.substring(0, match);
    }
  }

  return text.trim();
};

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
  const [currentFolder, setCurrentFolder] = useState('home');

  const [setupStage, setSetupStage] = useState(0);
  const setupStepsList = [
    "Allocating secure @rizzmail.me node...",
    "Generating cryptographic session tokens...",
    "Binding real-time WebSocket listeners...",
    "Opening secure inbox portal..."
  ];

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editFirstName, setEditFirstName] = useState(user?.firstName || '');
  const [editLastName, setEditLastName] = useState(user?.lastName || '');
  const [editProfilePhoto, setEditProfilePhoto] = useState(user?.profilePhoto || '');
  const [selectedLanguage, setSelectedLanguage] = useState(() => localStorage.getItem('rizzmail_lang') || 'en');
  const [aliases, setAliases] = useState(() => JSON.parse(localStorage.getItem('rizzmail_aliases') || '[]'));
  const [newAliasInput, setNewAliasInput] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const [deleteOtp, setDeleteOtp] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [chatFilter, setChatFilter] = useState('all');
  const [favoritesMap, setFavoritesMap] = useState(() => JSON.parse(localStorage.getItem('rizzmail_favs') || '{}'));
  const [toast, setToast] = useState(null);

  const [activeChatSender, setActiveChatSender] = useState(null);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [chatMessageBody, setChatMessageBody] = useState('');
  const [chatSubject, setChatSubject] = useState('');
  const [quotedMessage, setQuotedMessage] = useState(null);
  
  const [showTraditionalModal, setShowTraditionalModal] = useState(false);
  const [traditionalTo, setTraditionalTo] = useState('');
  const [traditionalCc, setTraditionalCc] = useState('');
  const [isTraditionalLocked, setIsTraditionalLocked] = useState(false);
  const [traditionalSubject, setTraditionalSubject] = useState('');
  const [traditionalBody, setTraditionalBody] = useState('');
  const [traditionalEmailReader, setTraditionalEmailReader] = useState(null);

  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [showSnippets, setShowSnippets] = useState(false);

  const [touchStartX, setTouchStartX] = useState(0);

  const quickSnippetsList = [
    "Got it, thanks!",
    "Please check my latest email.",
    "Let's sync up later today.",
    "Verified and approved.",
    "Can you send the details?"
  ];

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

  const handleAttachmentUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Attachment file size must be less than 5MB.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachmentPreview(reader.result);
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
      localStorage.setItem('rizzmail_lang', selectedLanguage);
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
      setProfileSuccess('Profile and settings updated successfully!');
      setTimeout(() => {
        setProfileSuccess('');
        setIsEditingProfile(false);
      }, 1500);
    } catch (err) {
      setError('Failed to update profile details.');
    }
  };

  const handleAddAlias = () => {
    if (!newAliasInput.trim()) return;
    const cleanAlias = newAliasInput.trim().toLowerCase().split('@')[0];
    const updated = [...aliases, `${cleanAlias}@rizzmail.me`];
    setAliases(updated);
    localStorage.setItem('rizzmail_aliases', JSON.stringify(updated));
    setNewAliasInput('');
  };

  const handleRemoveAlias = (aliasToRemove) => {
    const updated = aliases.filter(a => a !== aliasToRemove);
    setAliases(updated);
    localStorage.setItem('rizzmail_aliases', JSON.stringify(updated));
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

  const handleSendReplySubmit = async (e) => {
    e.preventDefault();
    if ((!chatMessageBody.trim() && !attachmentPreview) || !activeChatSender) return;

    const tempClientMessageId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const activePhone = getUserPhone();
    const recipientTarget = activeChatSender;
    const finalBody = chatMessageBody.trim();
    const finalSubject = chatSubject.trim() || '';

    const optimisticMsg = {
      clientMessageId: tempClientMessageId,
      sender: `${normalizeContactIdentifier(activePhone)}@rizzmail.me`,
      recipient: recipientTarget,
      subject: finalSubject,
      body: finalBody,
      attachment: attachmentPreview,
      quotedMessage: quotedMessage,
      direction: 'outbound',
      createdAt: new Date().toISOString(),
      isOptimistic: true,
      folder: 'home'
    };

    setMessages((prev) => [optimisticMsg, ...prev]);
    setChatMessageBody('');
    setChatSubject('');
    setQuotedMessage(null);
    setAttachmentPreview(null);

    try {
      const res = await sendEmailAPI({
        senderPhone: activePhone,
        recipientEmail: recipientTarget,
        subject: finalSubject,
        body: finalBody,
        attachment: attachmentPreview,
        quotedMessage: quotedMessage,
        clientMessageId: tempClientMessageId
      });
      
      if (res.data && res.data.message) {
        const confirmedMsg = res.data.message;
        setMessages((prev) => prev.map(m => m.clientMessageId === tempClientMessageId ? confirmedMsg : m));
      } else {
        loadInbox(activePhone);
      }
    } catch (err) {
      setError('Failed to send message.');
      setMessages((prev) => prev.map(m => m.clientMessageId === tempClientMessageId ? { ...m, hasError: true } : m));
    }
  };

  const handleSendTraditionalSubmit = async (e) => {
    e.preventDefault();
    if (!traditionalTo.trim() || !traditionalBody.trim()) return;

    const recipients = traditionalTo.split(',').map(r => r.trim()).filter(Boolean);
    const activePhone = getUserPhone();

    for (const rec of recipients) {
      let target = rec.toLowerCase();
      if (!target.includes('@')) {
        const pure = target.replace(/[^0-9]/g, '').slice(-10);
        target = `${pure}@rizzmail.me`;
      }
      try {
        await sendEmailAPI({
          senderPhone: activePhone,
          recipientEmail: target,
          subject: traditionalSubject.trim() || '',
          body: traditionalBody.trim(),
          attachment: attachmentPreview,
          quotedMessage: quotedMessage
        });
      } catch (err) {
        console.error('Failed to send traditional email to', target);
      }
    }

    setShowTraditionalModal(false);
    setTraditionalTo('');
    setTraditionalCc('');
    setTraditionalSubject('');
    setTraditionalBody('');
    setAttachmentPreview(null);
    setIsTraditionalLocked(false);
    loadInbox(activePhone);
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
          subject: "Project Milestone Update",
          body: "Hello! Reviewing the buildathon requirements and checking the chat integration."
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
        return normalizeContactIdentifier(other) !== canonicalKey;
      }));
      setActiveChatSender(null);
    } catch (e) {
      setError('Failed to delete chat thread.');
    }
  };

  const handleDeleteSingleMessage = async (msgId) => {
    if (!msgId) return;
    try {
      await deleteMessageAPI(msgId);
      setMessages(prev => prev.filter(m => m._id !== msgId));
    } catch (e) {
      setError('Failed to delete message.');
    }
  };

  const handleToggleFavorite = (canonicalKey, e) => {
    if (e) e.stopPropagation();
    const updated = { ...favoritesMap, [canonicalKey]: !favoritesMap[canonicalKey] };
    setFavoritesMap(updated);
    localStorage.setItem('rizzmail_favs', JSON.stringify(updated));
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
      setShowProfileMenu(false);
      setShowLogoutConfirm(false);
    }, 1500);
  };

  const { chatThreadsList, filteredThreads } = React.useMemo(() => {
    const threadsMap = {};

    messages.forEach((msg) => {
      if (msg.isDeleted) return;
      const myPhoneNorm = normalizeContactIdentifier(getUserPhone());
      const senderNorm = normalizeContactIdentifier(msg.sender);

      const counterpartyRaw = (senderNorm === myPhoneNorm) ? msg.recipient : msg.sender;
      if (!counterpartyRaw) return;

      const canonicalKey = normalizeContactIdentifier(counterpartyRaw);

      if (!threadsMap[canonicalKey]) {
        threadsMap[canonicalKey] = {
          canonicalKey: canonicalKey,
          sender: counterpartyRaw,
          name: msg.counterpartyName && !msg.counterpartyName.includes('@') ? msg.counterpartyName : counterpartyRaw.split('@')[0],
          avatar: msg.counterpartyPhoto || '',
          messages: [],
          isFavorite: !!favoritesMap[canonicalKey]
        };
      }
      
      if (msg.counterpartyPhoto && !threadsMap[canonicalKey].avatar) {
        threadsMap[canonicalKey].avatar = msg.counterpartyPhoto;
      }
      if (msg.counterpartyName && !msg.counterpartyName.includes('@')) {
        threadsMap[canonicalKey].name = msg.counterpartyName;
      }

      threadsMap[canonicalKey].messages.push(msg);
    });

    if (activeChatSender) {
      const activeCanonical = normalizeContactIdentifier(activeChatSender);
      if (!threadsMap[activeCanonical]) {
        threadsMap[activeCanonical] = {
          canonicalKey: activeCanonical,
          sender: activeChatSender,
          name: activeChatSender.split('@')[0],
          avatar: '',
          messages: [],
          isFavorite: !!favoritesMap[activeCanonical]
        };
      }
    }

    const threadsList = Object.values(threadsMap).map(thread => {
      const uniqueMap = new Map();
      thread.messages.forEach(m => {
        const msgKey = m._id || m.clientMessageId || JSON.stringify(m);
        uniqueMap.set(msgKey, m);
      });
      thread.messages = Array.from(uniqueMap.values());
      thread.messages.sort((a, b) => new Date(a.createdAt || a.date || 0) - new Date(b.createdAt || b.date || 0));
      thread.lastMessage = thread.messages[thread.messages.length - 1];
      thread.isFavorite = !!favoritesMap[thread.canonicalKey];
      return thread;
    });

    const filtered = threadsList.filter(thread => {
      if (currentFolder === 'home') {
        // Home unifies Inbox and Sent
      } else if (currentFolder === 'drafts') {
        if (!thread.messages.some(m => m.folder === 'drafts')) return false;
      } else if (currentFolder === 'spam') {
        if (!thread.messages.some(m => m.folder === 'spam')) return false;
      } else if (currentFolder === 'trash') {
        if (!thread.messages.some(m => m.folder === 'trash')) return false;
      }

      const matchesSearch = thread.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
        thread.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (thread.lastMessage && formatCleanBody(thread.lastMessage.body).toLowerCase().includes(searchQuery.toLowerCase()));
      
      if (chatFilter === 'unread') {
        return matchesSearch && thread.messages.some(m => m.direction === 'inbound');
      }
      if (chatFilter === 'attachments') {
        return matchesSearch && thread.messages.some(m => m.attachment);
      }
      if (chatFilter === 'favorites') {
        return matchesSearch && thread.isFavorite;
      }
      return matchesSearch;
    });

    return { chatThreadsList: threadsList, filteredThreads: filtered };
  }, [messages, favoritesMap, searchQuery, chatFilter, currentFolder, activeChatSender]);

  const activeThread = activeChatSender ? chatThreadsList.find(t => t.canonicalKey === normalizeContactIdentifier(activeChatSender)) : null;
  const isReplying = activeThread && activeThread.messages && activeThread.messages.length > 0;

  return (
    <div className="app-container">
      {/* ONLY RENDER HEADER & SEARCH BAR WHEN USER IS LOGGED IN & IN DASHBOARD (STEP 6) */}
      {user && step === 6 && (
       <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          {user && step === 6 && (
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="theme-toggle-btn mobile-hamburger-btn" 
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', flexShrink: 0 }}
              title="Toggle Menu"
            >
              <Menu size={20} />
            </button>
          )}

          <div className="app-logo-icon" style={{ width: '40px', height: '40px', flexShrink: 0 }}>rm</div>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
              <h1 className="logo-text" style={{ margin: 0, fontSize: '1.1rem', lineHeight: '1.2' }}>rizzmail.me</h1>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Your personal email via phone.</span>
            </div>
          </div>
        </div>

        {/* SEARCH BAR ONLY SHOWS WHEN LOGGED IN */}
        {user && step === 6 && (
          <div style={{ flex: 1, maxWidth: '640px', display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '100%', position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={18} style={{ position: 'absolute', left: '1.15rem', color: 'var(--text-muted)', pointerEvents: 'none' }} />
              <input 
                type="text" 
                placeholder="Search chats, mail, or enter phone & press Enter..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    let target = searchQuery.trim().toLowerCase();
                    if (!target.includes('@')) {
                      const pure = target.replace(/[^0-9]/g, '').slice(-10);
                      if (pure.length >= 5) {
                        target = `${pure}@rizzmail.me`;
                      }
                    }
                    setActiveChatSender(target);
                    setSearchQuery('');
                  }
                }}
                style={{ 
                  width: '100%', 
                  padding: '0.7rem 1rem 0.7rem 2.8rem', 
                  borderRadius: '2rem', 
                  background: 'var(--input-bg)', 
                  border: '1px solid var(--input-border)', 
                  color: 'var(--text-primary)', 
                  fontSize: '0.9rem', 
                  outline: 'none',
                  boxShadow: 'none'
                }}
              />
            </div>
          </div>
        )}
        
        {/* RIGHT HEADER ACTIONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          {user && step === 6 && (
            <div className="status-pill" style={{ display: 'flex', alignItems: 'center' }}>
              <span className="pulse-dot"></span> System Online
            </div>
          )}
          
          {user && step === 6 && (
            <div style={{ position: 'relative', overflow: 'visible', display: 'flex', alignItems: 'center' }} ref={profileMenuRef}>
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)} 
                className="theme-toggle-btn"
                title={`${user.firstName || 'User Account'} - Account Settings`}
                style={{ background: showProfileMenu ? 'rgba(99, 102, 241, 0.25)' : undefined, overflow: 'hidden', padding: 0, cursor: 'pointer', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {user.profilePhoto ? (
                  <img src={user.profilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <User size={18} />
                )}
              </button>

              {showProfileMenu && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 12px)',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--input-border)',
                  borderRadius: '1rem',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                  width: '240px',
                  zIndex: 99999,
                  padding: '1rem',
                  textAlign: 'left',
                  backdropFilter: 'blur(20px)'
                }}>
                  <div style={{ padding: '0.5rem 0.5rem 0.75rem 0.5rem', borderBottom: '1px solid var(--input-border)', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '1rem' }}>{user.firstName} {user.lastName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all', marginTop: '0.2rem' }}>{getEmailPhone(getUserPhone())}@rizzmail.me</div>
                  </div>

                  <button 
                    onClick={() => { setShowProfileMenu(false); setIsEditingProfile(true); }}
                    style={{ width: '100%', background: 'transparent', border: 'none', padding: '0.65rem 0.75rem', borderRadius: '0.65rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
                  >
                    <Edit3 size={16} style={{ color: '#818cf8' }} /> Account Settings & Aliases
                  </button>

                  <div style={{ height: '1px', background: 'var(--input-border)', margin: '0.5rem 0' }}></div>

                  <button 
                    onClick={() => { setShowProfileMenu(false); setShowLogoutConfirm(true); }}
                    style={{ width: '100%', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '0.65rem 0.75rem', borderRadius: '0.65rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                  >
                    <LogOut size={16} /> Sign Out / Logout
                  </button>
                </div>
              )}
            </div>
          )}

          <button 
            onClick={toggleTheme} 
            className="theme-toggle-btn"
            style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>
      )}

      <main className="main-content">
        {error && <div className="error-banner" style={{ width: '100%', maxWidth: '440px', margin: '1rem auto' }}>{error}</div>}

        {isLoggingOut && (
          <div style={{ margin: 'auto', width: '100%', maxWidth: '440px', display: 'flex', justifyContent: 'center' }}>
            <div className="card" style={{ padding: '3.5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <Lock size={32} style={{ color: '#818cf8', animation: 'spin 1.5s linear infinite', marginBottom: '1rem' }} />
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Signing Out...</h2>
            </div>
          </div>
        )}

        {!isLoggingOut && step === 1 && (
          <div style={{ margin: 'auto', width: '100%', maxWidth: '440px', display: 'flex', justifyContent: 'center', padding: '1rem' }}>
            <form onSubmit={handleSendOTP} className="card" style={{ width: '100%' }}>
              <div className="badge-pill"><Shield size={12} /> Secure Authentication</div>
              <h2>Welcome to RizzMail</h2>
              <p className="subtitle">Your personal email via your phone number.</p>
              
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
          <div style={{ margin: 'auto', width: '100%', maxWidth: '440px', display: 'flex', justifyContent: 'center', padding: '1rem' }}>
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
          <div style={{ margin: 'auto', width: '100%', maxWidth: '440px', display: 'flex', justifyContent: 'center', padding: '1rem' }}>
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
          <div style={{ margin: 'auto', width: '100%', maxWidth: '520px', display: 'flex', justifyContent: 'center', padding: '1rem' }}>
            <div className="card" style={{ textAlign: 'left', width: '100%' }}>
              <h2>Terms of Service</h2>
              <p className="subtitle">Please agree to continue to your burner inbox.</p>
              <button type="button" onClick={handleAgreeToTerms} className="primary-btn" disabled={loading}>I Agree & Initialize ➔</button>
            </div>
          </div>
        )}

        {!isLoggingOut && step === 5 && (
          <div style={{ textAlign: 'center', margin: 'auto', width: '100%', maxWidth: '440px', display: 'flex', justifyContent: 'center', padding: '1rem' }}>
            <div className="card" style={{ padding: '3.5rem 2rem', width: '100%' }}>
              <Cpu size={34} style={{ color: '#818cf8', animation: 'spin 2s linear infinite', marginBottom: '1rem' }} />
              <h2>{setupStepsList[setupStage]}</h2>
            </div>
          </div>
        )}

        {/* STEP 6: MAIN DASHBOARD */}
        {!isLoggingOut && step === 6 && user && (
          <div style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden', position: 'relative' }}>
            
            {/* TOP-LEFT MENU DRAWER / MODAL */}
            {mobileMenuOpen && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '280px',
                height: '100%',
                background: 'var(--card-bg)',
                borderRight: '1px solid var(--input-border)',
                zIndex: 99999,
                boxShadow: '10px 0 30px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                padding: '1.25rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--input-border)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Menu size={20} style={{ color: '#6366f1' }} />
                    <h3 style={{ fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>Navigation Menu</h3>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}><X size={18} /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button 
                    onClick={() => { setCurrentFolder('home'); setMobileMenuOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.75rem',
                      background: currentFolder === 'home' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      color: currentFolder === 'home' ? '#6366f1' : 'var(--text-primary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <Mail size={18} /> Home (Inbox & Sent Unified)
                  </button>

                  <button 
                    onClick={() => { setCurrentFolder('drafts'); setMobileMenuOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.75rem',
                      background: currentFolder === 'drafts' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      color: currentFolder === 'drafts' ? '#6366f1' : 'var(--text-primary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <Edit3 size={18} /> Drafts
                  </button>

                  <button 
                    onClick={() => { setCurrentFolder('spam'); setMobileMenuOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.75rem',
                      background: currentFolder === 'spam' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      color: currentFolder === 'spam' ? '#f59e0b' : 'var(--text-primary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <ShieldAlert size={18} /> Spam
                  </button>

                  <button 
                    onClick={() => { setCurrentFolder('trash'); setMobileMenuOpen(false); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.75rem',
                      background: currentFolder === 'trash' ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      color: currentFolder === 'trash' ? '#ef4444' : 'var(--text-primary)',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '600',
                      textAlign: 'left',
                      width: '100%'
                    }}
                  >
                    <Trash2 size={18} /> Trash
                  </button>
                </div>
              </div>
            )}

            {/* ACCOUNT SETTINGS & ALIAS MANAGEMENT VIEW */}
            {isEditingProfile ? (
              <div style={{ margin: 'auto', width: '100%', maxWidth: '560px', display: 'flex', justifyContent: 'center', overflowY: 'auto', maxHeight: '100%', padding: '2rem' }} className="hide-scrollbar">
                <div className="card" style={{ textAlign: 'left', width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3>Account Settings & Profile</h3>
                    <button onClick={() => setIsEditingProfile(false)} className="text-btn">Back to Chat</button>
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
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Change profile picture</label>
                    </div>

                    <div className="input-group-stack"><label>First Name</label><input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} required /></div>
                    <div className="input-group-stack"><label>Last Name</label><input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} required /></div>
                    
                    {/* LANGUAGE PREFERENCE */}
                    <div className="input-group-stack">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Globe size={14} /> Language Preference
                      </label>
                      <select 
                        value={selectedLanguage} 
                        onChange={(e) => setSelectedLanguage(e.target.value)}
                        style={{ padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none' }}
                      >
                        {languagesList.map(lang => (
                          <option key={lang.code} value={lang.code}>{lang.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* ALIAS MANAGEMENT */}
                    <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--input-border)' }}>
                      <label style={{ fontWeight: '600', display: 'block', marginBottom: '0.5rem' }}>Manage Alias IDs</label>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <input 
                          type="text" 
                          placeholder="e.g. support or work" 
                          value={newAliasInput} 
                          onChange={(e) => setNewAliasInput(e.target.value)}
                          style={{ flex: 1, padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid var(--input-border)', background: 'var(--card-bg)', color: 'var(--text-primary)', outline: 'none' }}
                        />
                        <button type="button" onClick={handleAddAlias} style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>Add Alias</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>• {getEmailPhone(getUserPhone())}@rizzmail.me (Primary)</div>
                        {aliases.map((al, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-primary)' }}>
                            <span>• {al}</span>
                            <button type="button" onClick={() => handleRemoveAlias(al)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><Trash2 size={13} /></button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button type="submit" className="primary-btn">Save Changes</button>
                  </form>
                  <button onClick={handleOpenDeletionWarning} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '0.75rem', marginTop: '1.5rem', cursor: 'pointer', width: '100%', fontWeight: '600' }}>Delete Account 🗑️</button>
                </div>
              </div>
            ) : (
              <div className="whatsapp-layout" style={{ display: 'flex', width: '100%', height: '100%', background: 'var(--card-bg)', overflow: 'hidden', position: 'relative' }}>
                
                {/* SIDEBAR WITH CLEAN FILTER CHIPS */}
                <div className={`whatsapp-sidebar ${activeChatSender ? 'mobile-hidden' : ''}`} style={{ width: '360px', borderRight: '1px solid var(--input-border)', display: 'flex', flexDirection: 'column', background: 'var(--card-bg)', flexShrink: 0, height: '100%', overflow: 'hidden' }}>
                  
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--input-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem', flexShrink: 0 }}>
                    
                    {/* FILTER CHIPS & REFRESH BUTTONS */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <div className="hide-scrollbar" style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '2px', flex: 1, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {['all', 'unread', 'attachments', 'favorites'].map((chip) => (
                          <button 
                            key={chip}
                            onClick={() => setChatFilter(chip)} 
                            style={{ 
                              background: chatFilter === chip ? '#6366f1' : 'var(--input-bg)', 
                              color: chatFilter === chip ? '#fff' : 'var(--text-muted)', 
                              border: '1px solid var(--input-border)', 
                              padding: '0.3rem 0.65rem', 
                              borderRadius: '1rem', 
                              fontSize: '0.75rem', 
                              fontWeight: '600', 
                              cursor: 'pointer',
                              textTransform: 'capitalize',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                        <button onClick={handleSimulateIncomingEmail} className="refresh-btn" title="Simulate incoming chat">
                          <Zap size={14} />
                        </button>
                        <button onClick={() => loadInbox(getUserPhone())} className="refresh-btn" title="Refresh inbox">
                          <RefreshCw size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {filteredThreads.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                        <Mail size={36} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                        <p>No active chats found</p>
                        <small>Type a phone number in the top search bar & press Enter to start chatting.</small>
                      </div>
                    ) : (
                      filteredThreads.map((thread) => {
                        const isSelected = activeChatSender === thread.sender;
                        const snippetText = thread.lastMessage ? formatCleanBody(thread.lastMessage.body) : '';
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
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{thread.lastMessage ? new Date(thread.lastMessage.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                              </div>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                                {thread.lastMessage ? (thread.lastMessage.attachment ? '📷 [Attachment]' : snippetText) : 'New conversation'}
                              </p>
                            </div>
                            <button 
                              onClick={(e) => handleToggleFavorite(thread.canonicalKey, e)}
                              style={{ background: 'transparent', border: 'none', color: thread.isFavorite ? '#f59e0b' : 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                            >
                              <Star size={16} fill={thread.isFavorite ? '#f59e0b' : 'none'} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ACTIVE CHAT WINDOW PANE WITH CLEAN FORMATTED BUBBLES */}
                <div className={`whatsapp-chat-window ${!activeChatSender ? 'mobile-hidden' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-main)', height: '100%', overflow: 'hidden' }}>
                  {activeThread ? (
                    <>
                      <div style={{ padding: '0.75rem 1rem', background: 'var(--card-bg)', borderBottom: '1px solid var(--input-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
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
                            <span style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span> online node
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button 
                            onClick={() => setActiveCall({ type: 'Voice Call', name: activeThread.name })}
                            title="Voice Call"
                            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <PhoneCall size={16} />
                          </button>
                          <button 
                            onClick={() => setActiveCall({ type: 'Video Call', name: activeThread.name })}
                            title="Video Call"
                            style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Video size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteChatThread(activeThread.canonicalKey)}
                            title="Delete Chat Thread"
                            style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.4rem 0.75rem', borderRadius: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', fontWeight: '600' }}
                          >
                            <Trash size={14} /> Delete
                          </button>
                        </div>
                      </div>

                      {/* MESSAGES WITH SANITIZED CLEAN TEXT BUBBLES */}
                      <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', background: 'radial-gradient(circle at center, rgba(99,102,241,0.04) 0%, rgba(3,7,18,0.7) 100%)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                        {activeThread.messages.length === 0 ? (
                          <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--text-muted)' }}>
                            <Mail size={52} style={{ marginBottom: '0.75rem', opacity: 0.3, filter: 'drop-shadow(0 0 10px rgba(99,102,241,0.3))' }} />
                            <p style={{ fontWeight: '600', letterSpacing: '0.02em' }}>Secure Channel Initialized</p>
                            <small>Send your first transmission below.</small>
                          </div>
                        ) : (
                          activeThread.messages.map((msg, idx) => {
                            const isOutbound = msg.direction === 'outbound';
                            const cleanBodyText = formatCleanBody(msg.body);
                            const isLong = cleanBodyText.length > 180;
                            const msgId = msg._id || msg.clientMessageId;
                            const hasBeenRepliedTo = activeThread.messages.some(m => m.quotedMessage && (m.quotedMessage.id === msgId));

                            return (
                              <div 
                                key={msgId || idx} 
                                style={{ display: 'flex', justifyContent: isOutbound ? 'flex-end' : 'flex-start', width: '100%', position: 'relative' }}
                                onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
                                onTouchEnd={(e) => {
                                  const touchEndX = e.changedTouches[0].clientX;
                                  if (touchEndX - touchStartX > 80) {
                                    setTraditionalTo(activeChatSender);
                                    setTraditionalCc('');
                                    setTraditionalSubject(msg.subject || '');
                                    setTraditionalBody('');
                                    setIsTraditionalLocked(true);
                                    setTraditionalEmailReader(msg);
                                  }
                                }}
                              >
                                <div 
                                  onClick={() => setTraditionalEmailReader(msg)}
                                  style={{
                                    maxWidth: '72%',
                                    background: isOutbound 
                                      ? 'linear-gradient(135deg, rgba(99,102,241,0.95) 0%, rgba(168,85,247,0.9) 50%, rgba(236,72,153,0.9) 100%)' 
                                      : 'rgba(18, 24, 38, 0.85)',
                                    backdropFilter: 'blur(16px)',
                                    color: isOutbound ? '#ffffff' : 'var(--text-primary)',
                                    padding: '0.9rem 1.15rem',
                                    borderRadius: isOutbound ? '1.25rem 1.25rem 0.25rem 1.25rem' : '1.25rem 1.25rem 1.25rem 0.25rem',
                                    boxShadow: isOutbound ? '0 8px 32px rgba(99, 102, 241, 0.35)' : '0 8px 32px rgba(0, 0, 0, 0.4)',
                                    border: isOutbound ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(99, 102, 241, 0.25)',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                                  }}
                                  title="Click anywhere to inspect payload"
                                >
                                  {msg.subject && (
                                    <div style={{ fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase', opacity: 0.9, marginBottom: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.18)', paddingBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                      <Sparkles size={11} /> {msg.subject}
                                    </div>
                                  )}

                                  {/* REPLIED TO MESSAGE DISPLAYED ON TOP INSIDE BUBBLE */}
                                  {msg.quotedMessage && (
                                    <div style={{ background: 'rgba(0,0,0,0.3)', borderLeft: '3px solid #38bdf8', padding: '0.45rem 0.7rem', borderRadius: '0.5rem', marginBottom: '0.6rem', fontSize: '0.81rem', backdropFilter: 'blur(4px)' }}>
                                      <div style={{ fontWeight: '700', fontSize: '0.7rem', color: '#38bdf8', letterSpacing: '0.03em' }}>RE: {msg.quotedMessage.sender.split('@')[0].toUpperCase()}</div>
                                      <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'rgba(255,255,255,0.9)' }}>{formatCleanBody(msg.quotedMessage.body)}</div>
                                    </div>
                                  )}

                                  {msg.attachment && (
                                    <div style={{ marginBottom: cleanBodyText ? '0.6rem' : 0, borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                                      <img src={msg.attachment} alt="Attachment" style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }} />
                                    </div>
                                  )}

                                  {cleanBodyText && (
                                    <div style={{ fontSize: '0.92rem', wordBreak: 'break-word', lineHeight: '1.5' }}>
                                      {isLong ? `${cleanBodyText.substring(0, 180)}... (Tap to expand payload)` : cleanBodyText}
                                    </div>
                                  )}

                                  <div style={{ fontSize: '0.68rem', opacity: 0.75, textAlign: 'right', marginTop: '0.4rem', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', fontFamily: 'JetBrains Mono, monospace' }}>
                                    {hasBeenRepliedTo ? (
                                      <span style={{ fontSize: '0.65rem', fontStyle: 'italic', marginRight: 'auto', color: isOutbound ? '#e0e7ff' : '#818cf8' }}>✓ Synchronized</span>
                                    ) : (
                                      <button 
                                        onClick={(e) => { 
                                          e.stopPropagation(); 
                                          setQuotedMessage({ id: msgId, sender: msg.sender, body: cleanBodyText || '[Attachment]' }); 
                                        }}
                                        title="Quote payload"
                                        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.9, display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem', fontWeight: '700', marginRight: 'auto' }}
                                      >
                                        <MessageSquareReply size={13} /> Reply
                                      </button>
                                    )}
                                    {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {isOutbound && (msg.isOptimistic ? ' ◌' : ' ⚡')}
                                    {msg._id && (
                                      <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteSingleMessage(msg._id); }}
                                        title="Purge message"
                                        style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.6, padding: '0 2px' }}
                                      >
                                        <Trash2 size={11} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {attachmentPreview && (
                        <div style={{ padding: '0.6rem 1rem', background: 'var(--card-bg)', borderTop: '1px solid var(--input-border)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, backdropFilter: 'blur(20px)' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid var(--input-border)' }}>
                            <img src={attachmentPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', flex: 1, fontFamily: 'JetBrains Mono, monospace' }}>Encrypted attachment ready (max 5MB)</span>
                          <button onClick={() => setAttachmentPreview(null)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}><X size={16} /></button>
                        </div>
                      )}

                      {showSnippets && (
                        <div className="hide-scrollbar" style={{ padding: '0.6rem 1rem', background: 'var(--card-bg)', borderTop: '1px solid var(--input-border)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flexShrink: 0, scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'JetBrains Mono, monospace' }}><Sparkles size={12} /> Neural Presets:</span>
                          {quickSnippetsList.map((snip, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => { setChatMessageBody(snip); setShowSnippets(false); }}
                              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.3rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                              {snip}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* FUTURISTIC CHAT COMPOSER BAR */}
                      <form onSubmit={handleSendReplySubmit} style={{ padding: '1rem 1.25rem', background: 'var(--card-bg)', borderTop: '1px solid var(--input-border)', display: 'flex', flexDirection: 'column', gap: '0.6rem', flexShrink: 0, backdropFilter: 'blur(25px)' }}>
                        
                        {/* QUOTED MESSAGE PREVIEW BOX ON TOP OF INPUT */}
                        {quotedMessage && (
                          <div style={{ background: 'rgba(99, 102, 241, 0.15)', borderLeft: '3px solid #6366f1', padding: '0.5rem 0.85rem', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backdropFilter: 'blur(10px)' }}>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span style={{ fontWeight: '700', color: '#818cf8', display: 'block', fontSize: '0.72rem', letterSpacing: '0.03em', fontFamily: 'JetBrains Mono, monospace' }}>QUOTED PAYLOAD FROM {quotedMessage.sender.split('@')[0].toUpperCase()}</span>
                              <span>{quotedMessage.body}</span>
                            </div>
                            <button type="button" onClick={() => setQuotedMessage(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}><X size={16} /></button>
                          </div>
                        )}

                        {!isReplying && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', width: '65px', fontFamily: 'JetBrains Mono, monospace' }}>SUBJECT</span>
                            <input 
                              type="text"
                              placeholder="Add secure transmission subject..."
                              value={chatSubject}
                              onChange={(e) => setChatSubject(e.target.value)}
                              style={{ flex: 1, padding: '0.5rem 0.85rem', borderRadius: '0.75rem', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', fontSize: '0.82rem', outline: 'none' }}
                            />
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <label title="Attach secure file (max 5MB)" style={{ cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.2s' }}>
                            <Paperclip size={20} />
                            <input type="file" accept="image/*" onChange={handleAttachmentUpload} style={{ display: 'none' }} />
                          </label>
                          
                          <button 
                            type="button" 
                            onClick={() => {
                              setTraditionalTo(activeChatSender);
                              setTraditionalCc('');
                              setTraditionalSubject(chatSubject);
                              setTraditionalBody(chatMessageBody);
                              setIsTraditionalLocked(true);
                              setShowTraditionalModal(true);
                            }}
                            title="Compose in Traditional Mail mode"
                            style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Camera size={20} />
                          </button>

                          <button 
                            type="button" 
                            onClick={() => setShowSnippets(!showSnippets)}
                            title="Neural templates"
                            style={{ background: 'transparent', border: 'none', color: showSnippets ? '#6366f1' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Sparkles size={20} />
                          </button>

                          <input 
                            type="text"
                            placeholder="Type secure transmission..."
                            value={chatMessageBody}
                            onChange={(e) => setChatMessageBody(e.target.value)}
                            style={{ flex: 1, padding: '0.75rem 1.15rem', borderRadius: '1.25rem', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none', fontSize: '0.92rem' }}
                          />
                          <button type="submit" disabled={loading} style={{ background: 'var(--accent-gradient)', color: '#fff', border: 'none', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 4px 20px rgba(99,102,241,0.5)', transition: 'transform 0.2s' }}>
                            <Send size={18} />
                          </button>
                        </div>
                      </form>
                    </>
                  ) : (
                    /* FRIENDLY WELCOME EMPTY STATE */
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>
                      <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem', color: '#6366f1', boxShadow: '0 0 30px rgba(99,102,241,0.15)' }}>
                        <Mail size={36} />
                      </div>
                      <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem', fontSize: '1.4rem', fontWeight: '700', letterSpacing: '-0.02em' }}>Welcome to your Inbox ✨</h3>
                      <p style={{ maxWidth: '380px', fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-muted)' }}>
                        Select any conversation from the sidebar or look up any phone number in the search bar above to start messaging instantly.
                      </p>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* HOME SCREEN COMPOSE FLOATING BUTTON */}
        {user && step === 6 && !isEditingProfile && (
          <button
            onClick={() => {
              setTraditionalTo('');
              setTraditionalCc('');
              setTraditionalSubject('');
              setTraditionalBody('');
              setIsTraditionalLocked(false);
              setShowTraditionalModal(true);
            }}
            style={{
              position: 'fixed',
              bottom: '28px',
              right: '28px',
              background: 'var(--accent-gradient)',
              color: '#fff',
              border: 'none',
              width: '58px',
              height: '58px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 10px 30px rgba(99, 102, 241, 0.5)',
              zIndex: 9999,
              transition: 'transform 0.2s ease'
            }}
            title="Compose New Email"
          >
            <Edit3 size={22} />
          </button>
        )}

        {showTraditionalModal && (
          <div className="modal-overlay" onClick={() => setShowTraditionalModal(false)}>
            <div className="modal-content" style={{ maxWidth: '520px', textAlign: 'left', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Mail size={20} style={{ color: '#6366f1' }} />
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>Traditional Email View</h3>
                </div>
                <button onClick={() => setShowTraditionalModal(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              <form onSubmit={handleSendTraditionalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="input-group-stack">
                  <label>To {isTraditionalLocked ? '(Locked in conversation)' : '(Multi-recipient supported, comma separated)'}</label>
                  <input 
                    type="text" 
                    value={traditionalTo} 
                    onChange={(e) => !isTraditionalLocked && setTraditionalTo(e.target.value)}
                    disabled={isTraditionalLocked}
                    placeholder="e.g. 9876543210@rizzmail.me"
                    required
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', opacity: isTraditionalLocked ? 0.7 : 1 }}
                  />
                </div>
                <div className="input-group-stack">
                  <label>CC {isTraditionalLocked ? '(Locked in conversation)' : '(Optional, comma separated)'}</label>
                  <input 
                    type="text" 
                    value={traditionalCc} 
                    onChange={(e) => !isTraditionalLocked && setTraditionalCc(e.target.value)}
                    disabled={isTraditionalLocked}
                    placeholder="cc@rizzmail.me..."
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', opacity: isTraditionalLocked ? 0.7 : 1 }}
                  />
                </div>
                <div className="input-group-stack">
                  <label>Subject</label>
                  <input 
                    type="text" 
                    value={traditionalSubject} 
                    onChange={(e) => setTraditionalSubject(e.target.value)}
                    placeholder="Email Subject..."
                  />
                </div>
                <div className="input-group-stack">
                  <label>Body</label>
                  <textarea 
                    value={traditionalBody} 
                    onChange={(e) => setTraditionalBody(e.target.value)}
                    placeholder="Write your email in traditional format..."
                    rows={6}
                    required
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '0.75rem', border: '1px solid var(--input-border)', background: 'var(--input-bg)', color: 'var(--text-primary)', outline: 'none', resize: 'vertical' }}
                  />
                </div>
                <button type="submit" className="primary-btn">Send Traditional Email ➔</button>
              </form>
            </div>
          </div>
        )}

        {traditionalEmailReader && (
          <div className="modal-overlay" onClick={() => setTraditionalEmailReader(null)}>
            <div className="modal-content" style={{ maxWidth: '560px', textAlign: 'left', padding: '2rem' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--input-border)', paddingBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', margin: 0 }}>{traditionalEmailReader.subject || 'Traditional Email View'}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>From: {traditionalEmailReader.sender}</span>
                </div>
                <button onClick={() => setTraditionalEmailReader(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}><X size={18} /></button>
              </div>

              {traditionalEmailReader.quotedMessage && (
                <div style={{ background: 'var(--input-bg)', borderLeft: '3px solid #818cf8', padding: '0.5rem 0.75rem', borderRadius: '0.35rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: '600', fontSize: '0.75rem', color: '#818cf8' }}>Replying to {traditionalEmailReader.quotedMessage.sender.split('@')[0]}</div>
                  <div>{formatCleanBody(traditionalEmailReader.quotedMessage.body)}</div>
                </div>
              )}

              {traditionalEmailReader.attachment && (
                <div style={{ marginBottom: '1rem', borderRadius: '0.5rem', overflow: 'hidden' }}>
                  <img src={traditionalEmailReader.attachment} alt="Attachment" style={{ width: '100%', maxHeight: '280px', objectFit: 'cover', borderRadius: '0.5rem' }} />
                </div>
              )}
              <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: '1.6', marginBottom: '1.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                {formatCleanBody(traditionalEmailReader.body)}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button onClick={() => setTraditionalEmailReader(null)} style={{ background: 'transparent', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.6rem 1.25rem', borderRadius: '0.75rem', cursor: 'pointer' }}>Close</button>
                <button onClick={() => {
                  const sender = traditionalEmailReader.sender;
                  const subj = traditionalEmailReader.subject;
                  setTraditionalEmailReader(null);
                  setTraditionalTo(sender);
                  setTraditionalCc('');
                  setTraditionalSubject(subj || '');
                  setTraditionalBody('');
                  setIsTraditionalLocked(true);
                  setShowTraditionalModal(true);
                }} className="primary-btn" style={{ width: 'auto' }}>Reply in Traditional View ➔</button>
              </div>
            </div>
          </div>
        )}

        {activeCall && (
          <div className="modal-overlay" onClick={() => setActiveCall(null)}>
            <div className="modal-content" style={{ maxWidth: '340px', textAlign: 'center', padding: '2.5rem 1.5rem', background: 'var(--card-bg)' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#6366f1', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '2rem', fontWeight: 'bold', animation: 'pulse 1.5s infinite', boxShadow: '0 0 30px rgba(99,102,241,0.6)' }}>
                {activeCall.name.charAt(0).toUpperCase()}
              </div>
              <h3 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{activeCall.name}</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '2rem', fontFamily: 'JetBrains Mono, monospace' }}>Establishing {activeCall.type}...</p>
              <button onClick={() => setActiveCall(null)} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '0.75rem 2rem', borderRadius: '2rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 16px rgba(239, 68, 68, 0.5)' }}>End Transmission</button>
            </div>
          </div>
        )}

        {showChatInfo && activeThread && (
          <div className="modal-overlay" onClick={() => setShowChatInfo(false)}>
            <div className="modal-content" style={{ maxWidth: '380px', textAlign: 'center', padding: '2rem 1.5rem' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: '#6366f1', margin: '0 auto 1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: '#fff', fontSize: '2.5rem', fontWeight: 'bold', boxShadow: '0 8px 30px rgba(99,102,241,0.5)' }}>
                {activeThread.avatar ? (
                  <img src={activeThread.avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  activeThread.name.charAt(0).toUpperCase()
                )}
              </div>
              <h2 style={{ fontSize: '1.4rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{activeThread.name}</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all', marginBottom: '1.5rem' }}>{activeThread.sender}</p>
              
              <div style={{ background: 'var(--input-bg)', padding: '1rem', borderRadius: '0.875rem', textAlign: 'left', marginBottom: '1.5rem', fontSize: '0.85rem', border: '1px solid var(--input-border)' }}>
                <div style={{ color: 'var(--text-muted)', marginBottom: '0.2rem', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>SECURITY PROTOCOL</div>
                <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>End-to-End Encrypted @rizzmail.me Node</div>
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
              <p className="subtitle" style={{ margin: '1rem 0' }}>Are you sure you want to sign out of your account?</p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => setShowLogoutConfirm(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--input-border)', color: 'var(--text-primary)', padding: '0.75rem', borderRadius: '0.75rem', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleLogout} style={{ flex: 1, background: '#ef4444', color: '#fff', border: 'none', padding: '0.75rem', borderRadius: '0.75rem', cursor: 'pointer', fontWeight: '600' }}>Sign Out</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;