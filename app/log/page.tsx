"use client";

import AppShell, { LogItem } from "../components/AppShell";
import { useState, useEffect } from "react";

const DB_WORKER = "https://ssidmail-db-api.saisoku-id2020.workers.dev";

export default function LogPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    // 1. Instant load from localStorage so table is NEVER empty on reload
    let localData: LogItem[] = [];
    try {
      const raw = localStorage.getItem("ssidmail_activity_logs");
      if (raw) {
        localData = JSON.parse(raw);
        setLogs(localData);
      }
    } catch (e) {}

    // 2. Fetch from Cloudflare Worker
    try {
      const res = await fetch(`${DB_WORKER}/emails?include_recycled=1`);
      if (res.ok) {
        const payload = await res.json();
        const remoteLogs: LogItem[] = (payload.emails || []).map((row: any) => ({
          id: String(row.id || row.email),
          email: row.email,
          access_key: row.access_key || row.accessKey || null,
          sizeMb: Number(row.size_mb || 0).toFixed(2),
          messages: Number(row.message_count || 0),
          active: Boolean(row.active),
          deleted: Boolean(row.deleted),
          status: row.status || (row.active ? "active" : "recycled"),
          expires_at: row.expires_at || null,
          created_at: row.created_at || null
        }));

        // Merge remote logs into local state
        const mergedMap = new Map<string, LogItem>();
        localData.forEach((item) => mergedMap.set(item.email, item));
        remoteLogs.forEach((item) => mergedMap.set(item.email, item));

        const mergedList = Array.from(mergedMap.values()).filter((item) => !item.deleted);
        setLogs(mergedList);
        localStorage.setItem("ssidmail_activity_logs", JSON.stringify(mergedList));
      }
    } catch (e) {
      console.warn("Worker fetch failed, using local cache");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const targetItem = logs.find((item) => item.id === id);
    const emailToDelete = targetItem?.email;

    const filtered = logs.filter((item) => item.id !== id && item.email !== emailToDelete);
    setLogs(filtered);
    localStorage.setItem("ssidmail_activity_logs", JSON.stringify(filtered));

    try {
      if (id) {
        await fetch(`${DB_WORKER}/emails/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
      if (emailToDelete) {
        await fetch(`${DB_WORKER}/emails/${encodeURIComponent(emailToDelete)}`, { method: "DELETE" });
      }
    } catch (e) {}
  };

  const now = new Date();

  return (
    <AppShell>
      <div id="viewActivity" className="view-panel">
        <div className="create-page">
          <div className="create-shell">
            <div className="create-header">
              <div>
                <div className="create-kicker">ACTIVITY LOG</div>
                <h1 className="create-title">Created email log</h1>
                <p className="create-desc">
                  Track generated email addresses, 6-digit access keys, message count, active status, and 30-day expiration TTL.
                </p>
              </div>
              <div className="create-mini-stat">
                <div className="num" id="activityCount">
                  {logs.length}
                </div>
                <div className="lbl">Total Email</div>
              </div>
            </div>

            <div className="activity-table-card">
              <div className="activity-table-wrap">
                <table className="activity-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Email</th>
                      <th>Access Key</th>
                      <th>Status</th>
                      <th>Msg</th>
                      <th>Expires</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody id="activityTableBody">
                    {logs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="activity-empty">
                          {loading ? "Memuat log email..." : "Belum ada email yang dibuat."}
                        </td>
                      </tr>
                    ) : (
                      logs.map((row, index) => {
                        const status = row.status || (row.active ? "active" : "recycled");
                        const statusLabel = status === "active" ? "Active" : "Recycled";

                        let expiresCell = "—";
                        if (row.expires_at) {
                          const expDate = new Date(row.expires_at);
                          const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                          const isNear = diffDays <= 7 && diffDays >= 0;
                          const isPast = diffDays < 0;
                          const label = isPast ? "Expired" : `${diffDays}d left`;

                          expiresCell = `${label}`;
                          return (
                            <tr key={row.id || index}>
                              <td>{index + 1}</td>
                              <td className="activity-email-cell">{row.email}</td>
                              <td>
                                <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 800, color: "#4285F4", background: "rgba(66, 133, 244, 0.12)", padding: "2px 6px", border: "1px solid #4285F4", fontSize: 12, display: "inline-block" }}>
                                  {row.access_key || "──────"}
                                </span>
                              </td>
                              <td>
                                <span className={`status-badge ${status}`}>{statusLabel}</span>
                              </td>
                              <td>{row.messages}</td>
                              <td>
                                <span className={`expires-cell ${isNear || isPast ? "near-expiry" : ""}`}>
                                  {label}
                                </span>
                              </td>
                              <td>
                                <div className="activity-actions">
                                  {status === "active" ? (
                                    <button className="activity-delete" onClick={() => handleDelete(row.id)}>
                                      Delete
                                    </button>
                                  ) : (
                                    <button className="activity-delete" style={{ opacity: 0.5 }} disabled>
                                      Recycled
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={row.id || index}>
                            <td>{index + 1}</td>
                            <td className="activity-email-cell">{row.email}</td>
                            <td>
                              <span style={{ fontFamily: "'Geist Mono', monospace", fontWeight: 800, color: "#4285F4", background: "rgba(66, 133, 244, 0.12)", padding: "2px 6px", border: "1px solid #4285F4", fontSize: 12, display: "inline-block" }}>
                                {row.access_key || "──────"}
                              </span>
                            </td>
                            <td>
                              <span className={`status-badge ${status}`}>{statusLabel}</span>
                            </td>
                            <td>{row.messages}</td>
                            <td>—</td>
                            <td>
                              <div className="activity-actions">
                                {status === "active" ? (
                                  <button className="activity-delete" onClick={() => handleDelete(row.id)}>
                                    Delete
                                  </button>
                                ) : (
                                  <button className="activity-delete" style={{ opacity: 0.5 }} disabled>
                                    Recycled
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
