"use client";

import AppShell from "../components/AppShell";
import { useState, useEffect } from "react";

const INBOX_WORKER = "https://email-handler.saisoku-id2020.workers.dev/inbox";

interface MailItem {
  id: string;
  from: string;
  subject: string;
  receivedAt?: string;
  date?: string;
  content: string;
}

const mockNetflixEmail: MailItem = {
  id: "mock_netflix_mail",
  from: "Netflix <info@account.netflix.com>",
  subject: "A new device is using your account",
  receivedAt: "13/7/2026, 17.54.44",
  date: "13/7/2026, 17.54.44",
  content: `<html>
<body style="font-family: Helvetica, Arial, sans-serif; background-color: #f3f3f3; padding: 20px; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
    <div style="text-align: center; margin-bottom: 30px;">
      <img src="https://assets.nflxext.com/us/email/logo/netflix_logo_v2.png" alt="Netflix" style="width: 140px; height: auto;">
    </div>
    <h2 style="font-size: 22px; font-weight: 700; color: #e50914; margin-bottom: 20px;">A new device is using your account</h2>
    <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">Hi there,</p>
    <p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">A new device was recently used to sign in to your Netflix account from a location that we don't recognize.</p>
    <div style="background-color: #f5f5f5; padding: 20px; border-radius: 6px; margin-bottom: 25px; font-size: 14px; line-height: 1.8;">
      <strong>Device:</strong> Smart TV<br>
      <strong>Location:</strong> Jakarta, Indonesia<br>
      <strong>Time:</strong> 13/7/2026, 17.54.44 (WIB)
    </div>
    <p style="font-size: 15px; line-height: 1.6; margin-bottom: 30px;">If this was you, you're all set! Enjoy streaming. If this wasn't you, we recommend that you change your password immediately to secure your account.</p>
    <div style="text-align: center; margin-bottom: 30px;">
      <a href="https://netflix.com" style="background-color: #e50914; color: #ffffff; padding: 12px 30px; text-decoration: none; font-size: 15px; font-weight: 700; border-radius: 4px; display: inline-block;">Secure Account</a>
    </div>
    <hr style="border: none; border-top: 1px solid #eeeeee; margin: 30px 0;">
    <p style="font-size: 12px; color: #999999; line-height: 1.5; text-align: center;">This message was sent to your temporary email. Need help? Visit our Help Center.</p>
  </div>
</body>
</html>`
};

export default function MailPage() {
  const [mails, setMails] = useState<MailItem[]>([mockNetflixEmail]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("ssidmail_last_email") || "admin@ssidmail.my.id";
    loadInbox(savedEmail);
  }, []);

  const loadInbox = async (email: string) => {
    if (!email) return;
    setLoading(true);
    try {
      const res = await fetch(`${INBOX_WORKER}?email=${encodeURIComponent(email)}&t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setMails(data);
          setSelectedIndex(0);
        } else {
          setMails([]);
          setSelectedIndex(null);
        }
      }
    } catch (e) {
      // Keep mock or empty
    } finally {
      setLoading(false);
    }
  };

  const filteredMails = mails.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.from.toLowerCase().includes(q) ||
      m.subject.toLowerCase().includes(q) ||
      (m.content && m.content.toLowerCase().includes(q))
    );
  });

  const selectedMail = selectedIndex !== null && mails[selectedIndex] ? mails[selectedIndex] : null;

  const parseSenderName = (from: string) => {
    const nameMatch = from.match(/^(.+?)\s*</);
    if (nameMatch) return nameMatch[1].trim();
    const emailMatch = from.match(/<([^>]+)>/);
    if (emailMatch) return emailMatch[1];
    return from || "Unknown Sender";
  };

  return (
    <AppShell>
      <div id="viewInbox" className="view-panel">
        <div className="inbox-3pane-layout">
          {/* MIDDLE PANE: MAIL LIST */}
          <div className="middle-pane-list">
            <div className="search-bar-container">
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search mail"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="inbox-list-col">
              {loading ? (
                <div className="status-placeholder" style={{ padding: "40px 0" }}>
                  <span>Memuat kotak masuk...</span>
                </div>
              ) : filteredMails.length === 0 ? (
                <div className="list-mail-item active">
                  <div className="list-mail-top">
                    <div className="list-mail-sender">Inbox</div>
                  </div>
                  <div className="list-mail-subject">No messages yet</div>
                </div>
              ) : (
                filteredMails.map((mail, idx) => {
                  const isActive = selectedIndex === idx;
                  const senderName = parseSenderName(mail.from);
                  const dateStr = mail.receivedAt || mail.date || "";

                  return (
                    <div
                      key={mail.id || idx}
                      className={`list-mail-item ${isActive ? "active" : ""}`}
                      onClick={() => setSelectedIndex(idx)}
                    >
                      <div className="list-mail-top">
                        <div className="list-mail-sender">{senderName}</div>
                        {dateStr && <div className="list-mail-time">{dateStr}</div>}
                      </div>
                      <div className="list-mail-subject">{mail.subject || "Notification"}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT PANE: DETAIL READER */}
          <div className="right-pane-reader">
            {!selectedMail ? (
              <>
                <div className="reader-actions-bar">
                  <button className="reader-action-btn" onClick={() => alert("No reply action")}>
                    <span>Reply</span>
                  </button>
                  <button className="reader-action-btn" onClick={() => alert("No forward action")}>
                    <span>Forward</span>
                  </button>
                  <button className="reader-action-btn btn-delete" onClick={() => alert("No delete action")}>
                    <span>Delete</span>
                  </button>
                </div>
                <div className="reader-sender-section">
                  <div className="sender-avatar">@</div>
                  <div className="sender-info-text">
                    <div className="sender-info-label">FROM</div>
                    <div className="sender-name">No messages yet</div>
                    <div className="sender-meta">Inbox on @ssidmail.my.id</div>
                  </div>
                </div>
                <div className="reader-body-card">
                  <h2 className="reader-body-subject">No messages yet</h2>
                  <p className="reader-body-text">Refresh the inbox after sending a verification email to this address.</p>
                </div>
              </>
            ) : (
              <>
                <div className="reader-actions-bar">
                  <button className="reader-action-btn" onClick={() => alert("Reply mock")}>
                    <span>Reply</span>
                  </button>
                  <button className="reader-action-btn" onClick={() => alert("Forward mock")}>
                    <span>Forward</span>
                  </button>
                  <button
                    className="reader-action-btn btn-delete"
                    onClick={() => {
                      if (confirm("Hapus email ini?")) {
                        const updated = mails.filter((_, i) => i !== selectedIndex);
                        setMails(updated);
                        setSelectedIndex(updated.length > 0 ? 0 : null);
                      }
                    }}
                  >
                    <span>Delete</span>
                  </button>
                </div>

                <div className="reader-sender-section">
                  <div className="sender-avatar">
                    {parseSenderName(selectedMail.from).charAt(0).toUpperCase()}
                  </div>
                  <div className="sender-info-text">
                    <div className="sender-info-label">FROM</div>
                    <div className="sender-name">{selectedMail.from}</div>
                    <div className="sender-meta">
                      Received at {selectedMail.receivedAt || selectedMail.date || "Unknown"}
                    </div>
                  </div>
                </div>

                <div className="reader-body-card">
                  <h2 className="reader-body-subject">{selectedMail.subject}</h2>
                  <div className="reader-body-text">
                    {selectedMail.content && selectedMail.content.includes("<html") ? (
                      <iframe
                        className="mail-frame"
                        sandbox="allow-popups allow-popups-to-escape-sandbox allow-scripts"
                        srcDoc={selectedMail.content}
                      />
                    ) : (
                      <div className="mail-plain-body">{selectedMail.content}</div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
