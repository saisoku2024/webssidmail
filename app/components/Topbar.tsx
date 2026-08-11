"use client";

import { useEffect, useState } from "react";

interface TopbarProps {
  currentEmail: string;
  onEmailChange: (email: string) => void;
  onRefresh: () => void;
  stats: { created: number; received: number };
  lang: string;
  onLangChange: (lang: string) => void;
}

export default function Topbar({
  currentEmail,
  onEmailChange,
  onRefresh,
  stats,
  lang,
  onLangChange
}: TopbarProps) {
  const [inputVal, setInputVal] = useState(currentEmail);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setInputVal(currentEmail);
  }, [currentEmail]);

  const handleCopy = () => {
    if (!inputVal) return;
    let fullEmail = inputVal.trim();
    if (!fullEmail.includes("@")) {
      fullEmail = `${fullEmail}@ssidmail.my.id`;
    }
    navigator.clipboard.writeText(fullEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCommit = () => {
    let fullEmail = inputVal.trim();
    if (fullEmail && !fullEmail.includes("@")) {
      fullEmail = `${fullEmail}@ssidmail.my.id`;
      setInputVal(fullEmail);
    }
    onEmailChange(fullEmail);
  };

  return (
    <header className="topbar-dash">
      <div className="email-display-container">
        <div className="email-display-label">YOUR TEMPORARY EMAIL</div>
        <div className="email-display-box">
          <input
            type="text"
            value={inputVal}
            placeholder="Ketik/edit email..."
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCommit();
            }}
            onBlur={handleCommit}
          />
        </div>
      </div>

      <div className="topbar-actions-row">
        <button className="action-txt-btn" onClick={handleCopy}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>{copied ? "Copied!" : "Copy"}</span>
        </button>
        <button className="action-txt-btn" onClick={onRefresh}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      <div className="topbar-stats">
        <div className="stat-card">
          <div className="stat-lbl">Emails created</div>
          <div className="stat-num">{stats.created.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="stat-lbl">Messages received</div>
          <div className="stat-num">{stats.received.toLocaleString()}</div>
        </div>
      </div>

      <div className="lang-selector-container">
        <select value={lang} onChange={(e) => onLangChange(e.target.value)}>
          <option value="id">Indonesian</option>
          <option value="en">English</option>
        </select>
      </div>
    </header>
  );
}
