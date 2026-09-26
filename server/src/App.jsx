import React, { useState, useEffect } from "react";
import "./App.css";

function App() {
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [aliases, setAliases] = useState(["cyber_fox_7a2b@rizzmail.me"]);
  const [currentAlias, setCurrentAlias] = useState("cyber_fox_7a2b@rizzmail.me");
  const [inboxMessages, setInboxMessages] = useState([
    {
      id: "1",
      sender: "security@github.com",
      subject: "Your GitHub verification code is 884920",
      body: "Hello,\n\nSomeone tried to access your account. Your verification code is 884920.\n\nBest,\nThe GitHub Team",
      time: "Just now",
      read: false
    }
  ]);
  const [selectedMessage, setSelectedMessage] = useState(inboxMessages[0]);

  const generateNewAlias = () => {
    const randomHex = Math.random().toString(36).substring(2, 8);
    const newAlias = `burner_${randomHex}@rizzmail.me`;
    setAliases([newAlias, ...aliases]);
    setCurrentAlias(newAlias);
  };

  return (
    <div className="rizz-container">
      {/* Sidebar Navigation */}
      <aside className="rizz-sidebar">
        <div className="brand-logo">
          <h2>⚡ RIZZMAIL<span className="dot">.ME</span></h2>
          <span className="badge">SECURE BURNER SaaS</span>
        </div>
        
        <div className="alias-section">
          <label>ACTIVE BURNER ALIAS</label>
          <select value={currentAlias} onChange={(e) => setCurrentAlias(e.target.value)} className="alias-select">
            {aliases.map((alias, idx) => (
              <option key={idx} value={alias}>{alias}</option>
            ))}
          </select>
          <button className="btn-glow" onClick={generateNewAlias}>+ Generate New Alias</button>
        </div>

        <nav className="nav-links">
          <button className={currentTab === "dashboard" ? "active" : ""} onClick={() => setCurrentTab("dashboard")}>
            📥 Live Inbox ({inboxMessages.length})
          </button>
          <button className={currentTab === "ivrs" ? "active" : ""} onClick={() => setCurrentTab("ivrs")}>
            🎙️ Fonoster Voice / IVR Server
          </button>
          <button className={currentTab === "settings" ? "active" : ""} onClick={() => setCurrentTab("settings")}>
            ⚙️ Security & Profile
          </button>
        </nav>
      </aside>

      {/* Main Content Area - Spike-Mail Chat Threaded Layout */}
      <main className="rizz-main">
        {currentTab === "dashboard" && (
          <div className="inbox-layout">
            {/* Message List Column */}
            <div className="message-list-pane">
              <div className="pane-header">
                <h3>INBOX STREAM</h3>
                <span className="live-indicator">● LIVE PORT 2525</span>
              </div>
              <div className="message-cards">
                {inboxMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`message-card ${selectedMessage?.id === msg.id ? "selected" : ""}`}
                    onClick={() => setSelectedMessage(msg)}
                  >
                    <div className="msg-sender">{msg.sender}</div>
                    <div className="msg-subject">{msg.subject}</div>
                    <div className="msg-time">{msg.time}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Thread / Message Detail View */}
            <div className="message-detail-pane">
              {selectedMessage ? (
                <div className="thread-container">
                  <div className="thread-header">
                    <h2>{selectedMessage.subject}</h2>
                    <div className="thread-meta">
                      <span>From: <strong>{selectedMessage.sender}</strong></span>
                      <span>To: <strong>{currentAlias}</strong></span>
                    </div>
                  </div>
                  <div className="thread-body">
                    <div className="chat-bubble">
                      <p style={{ whiteSpace: "pre-wrap" }}>{selectedMessage.body}</p>
                      <span className="timestamp">{selectedMessage.time}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="no-message">Select an email thread to inspect payload.</div>
              )}
            </div>
          </div>
        )}

        {currentTab === "ivrs" && (
          <div className="panel-card">
            <h2>🎙️ Fonoster Voice / IVR Server Integration</h2>
            <p>Node.js voice server active on port 50061, tunnelled via Pinggy for incoming automated phone signups.</p>
            <div className="status-box">Status: Operational & Ready for Incoming Calls</div>
          </div>
        )}

        {currentTab === "settings" && (
          <div className="panel-card">
            <h2>⚙️ Account Security & Profile</h2>
            <p>Age restriction: 13+ enforced. Birthdate permanently locked.</p>
            <p>Account Deletion: Secured via 2-step verification workflow.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
