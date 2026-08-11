"use client";

import { useState, useEffect, ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

const DB_WORKER = "https://ssidmail-db-api.saisoku-id2020.workers.dev";

export interface LogItem {
  id: string;
  email: string;
  access_key?: string;
  sizeMb: string;
  messages: number;
  active: boolean;
  deleted: boolean;
  status: "active" | "recycled";
  expires_at: string | null;
  created_at: string | null;
}

export default function AppShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [lang, setLang] = useState<string>("id");
  const [currentEmail, setCurrentEmail] = useState<string>("admin@ssidmail.my.id");
  const [stats, setStats] = useState({ created: 0, received: 0 });

  // Init state from localStorage
  useEffect(() => {
    const savedTheme = (localStorage.getItem("ssidmail_theme") as "light" | "dark") || "light";
    setTheme(savedTheme);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");

    const savedLang = localStorage.getItem("ssidmail_lang") || "id";
    setLang(savedLang);

    const savedEmail = localStorage.getItem("ssidmail_last_email");
    if (savedEmail) {
      setCurrentEmail(savedEmail);
    }

    fetchStats();
  }, []);

  const fetchStats = async () => {
    let apiCreated = 0;
    let apiReceived = 0;
    try {
      const res = await fetch(`${DB_WORKER}/stats`);
      if (res.ok) {
        const data = await res.json();
        apiCreated = data.emails_created || 0;
        apiReceived = data.messages_received || 0;
      }
    } catch (e) {}

    let localLogsCount = 0;
    let localMsgSum = 0;
    try {
      const raw = localStorage.getItem("ssidmail_activity_logs");
      if (raw) {
        const parsed = JSON.parse(raw);
        localLogsCount = parsed.filter((r: any) => !r.deleted).length;
        localMsgSum = parsed.filter((r: any) => !r.deleted).reduce((acc: number, r: any) => acc + (Number(r.messages) || 0), 0);
      }
    } catch (e) {}

    setStats({
      created: Math.max(apiCreated, localLogsCount),
      received: Math.max(apiReceived, localMsgSum, 1)
    });
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("ssidmail_theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const handleEmailChange = (email: string) => {
    setCurrentEmail(email);
    localStorage.setItem("ssidmail_last_email", email);
    // Push email to worker as well
    fetch(`${DB_WORKER}/emails/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: [email] })
    }).then(() => fetchStats()).catch(() => {});
  };

  const handleLangChange = (newLang: string) => {
    setLang(newLang);
    localStorage.setItem("ssidmail_lang", newLang);
  };

  const handleLogout = () => {
    localStorage.removeItem("ssidmail_login_mode");
    localStorage.removeItem("ssidmail_session_value");
    window.location.href = "/login.html";
  };

  return (
    <div id="mainApp" className="app-container insight-page-fade">
      <div className="google-top-bar"></div>
      <Sidebar theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout} />
      <div className="main-wrapper">
        <Topbar
          currentEmail={currentEmail}
          onEmailChange={handleEmailChange}
          onRefresh={fetchStats}
          stats={stats}
          lang={lang}
          onLangChange={handleLangChange}
        />
        <div className="content-body-dash">{children}</div>
      </div>
    </div>
  );
}
