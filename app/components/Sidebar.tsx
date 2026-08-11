"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SidebarProps {
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onLogout: () => void;
}

export default function Sidebar({ theme, onToggleTheme, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const isMail = pathname === "/mail" || pathname === "/" || pathname === "/inbox";
  const isCreate = pathname === "/create";
  const isLog = pathname === "/log" || pathname === "/activity";

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="2.5" y="3.5" width="19" height="17" rx="5" stroke="currentColor" strokeWidth="2.8" fill="none"/>
          <path d="M7 9.5l5 3.8 5-3.8" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <nav className="sidebar-nav">
        <Link href="/mail" className={`nav-item ${isMail ? "active" : ""}`} title="Mail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span className="nav-label">Mail</span>
        </Link>

        <Link href="/create" className={`nav-item ${isCreate ? "active" : ""}`} title="Create">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          <span className="nav-label">Create</span>
        </Link>

        <Link href="/log" className={`nav-item ${isLog ? "active" : ""}`} title="Log">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19V5"/>
            <path d="M8 19V9"/>
            <path d="M12 19V7"/>
            <path d="M16 19v-5"/>
            <path d="M20 19V11"/>
          </svg>
          <span className="nav-label">Log</span>
        </Link>
      </nav>

      {/* THEME TOGGLE */}
      <div className="sidebar-theme" onClick={onToggleTheme} title="Toggle Theme">
        <svg className="theme-icon-svg" viewBox="0 0 24 24" fill="none">
          {theme === "light" ? (
            <>
              <path d="M12 3v1.5M12 19.5V21M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M3 12h1.5M19.5 12H21M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="2"/>
            </>
          ) : (
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
          )}
        </svg>
        <span className="theme-label">{theme === "dark" ? "Dark" : "Light"}</span>
      </div>

      {/* LOGOUT */}
      <div className="sidebar-logout" onClick={onLogout} title="Logout">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
        <span className="logout-label">Keluar</span>
      </div>
    </aside>
  );
}
