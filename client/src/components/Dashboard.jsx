import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';

export default function Dashboard({ user, onLogout }) {
  const [messages, setMessages] = useState([]);
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' or 'compose'
  const [loading, setLoading] = useState(true);

  // Form state for composing emails
  const [recipientEmail, setRecipientEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const phoneEmail = `${user.phoneNumber}@phoneemail.local`;

  // Fetch initial messages and set up Socket.io live listener
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/messages/${user.phoneNumber}`);
        setMessages(res.data);
      } catch (err) {
        console.error('Error fetching messages:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Connect to backend Socket.io server for real-time incoming mail
    const socket = io('http://localhost:5000');
    
    socket.on('new-message', (incomingMessage) => {
      if (incomingMessage.recipientPhone === user.phoneNumber) {
        setMessages((prev) => [incomingMessage, ...prev]);
      }
    });

    return () => socket.disconnect();
  }, [user.phoneNumber]);

  // Handle sending outbound email
  const handleSendEmail = async (e) => {
    e.preventDefault();
    if (!recipientEmail || !body) return;

    setSending(true);
    setStatusMessage('');

    try {
      await axios.post('http://localhost:5000/api/messages/send', {
        senderPhone: user.phoneNumber,
        recipientEmail,
        subject,
        body
      });
      setStatusMessage('Email sent successfully!');
      setRecipientEmail('');
      setSubject('');
      setBody('');
      setTimeout(() => setStatusMessage(''), 4000);
    } catch (err) {
      setStatusMessage('Failed to send email. Check server logs.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-20 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
            ✉️
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">PhoneMail Dashboard</h1>
            <p className="text-xs text-indigo-400 font-mono">{phoneEmail}</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs text-slate-400">Logged in as</p>
            <p className="text-sm font-semibold">{user.phoneNumber}</p>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 border border-red-500/20 text-red-400 rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 flex flex-col">
        
        {/* Tab Selectors */}
        <div className="flex space-x-2 mb-6 bg-slate-900 border border-slate-800 p-1.5 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'inbox' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📥 Inbox ({messages.length})
          </button>
          <button
            onClick={() => setActiveTab('compose')}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'compose' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📤 Compose Email
          </button>
        </div>

        {/* TAB 1: INBOX */}
        {activeTab === 'inbox' && (
          <div className="flex-1 space-y-4">
            {loading ? (
              <div className="text-center py-20 text-slate-500">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/40 border border-slate-800/80 rounded-2xl">
                <p className="text-4xl mb-3">📭</p>
                <h3 className="text-lg font-semibold text-white">Your inbox is empty</h3>
                <p className="text-sm text-slate-400 mt-1">Send an email to <span className="text-indigo-400 font-mono">{phoneEmail}</span> to see it appear here instantly!</p>
              </div>
            ) : (
              messages.map((msg, index) => (
                <div key={index} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg font-mono">
                      From: {msg.sender}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h4 className="text-base font-semibold text-white mb-1">{msg.subject || 'No Subject'}</h4>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap bg-slate-950/50 p-3 rounded-xl border border-slate-800/50">{msg.body}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 2: COMPOSE EMAIL */}
        {activeTab === 'compose' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 max-w-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Send Outbound Email</h3>
            
            {statusMessage && (
              <div className={`mb-4 p-3 rounded-xl text-sm ${statusMessage.includes('Success') ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                {statusMessage}
              </div>
            )}

            <form onSubmit={handleSendEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Sender Identity
                </label>
                <input
                  type="text"
                  disabled
                  value={phoneEmail}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl py-3 px-4 text-slate-400 cursor-not-allowed font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  placeholder="friend@gmail.com"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 sm-2">
                  Subject
                </label>
                <input
                  type="text"
                  placeholder="Project update..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Message Body
                </label>
                <textarea
                  rows="5"
                  placeholder="Type your email message here..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded-xl py-3 px-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all text-sm resize-none"
                  required
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
              >
                {sending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <span>Send Email 🚀</span>
                )}
              </button>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}