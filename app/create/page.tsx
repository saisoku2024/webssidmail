"use client";

import AppShell from "../components/AppShell";
import { useState } from "react";

const DB_WORKER = "https://ssidmail-db-api.saisoku-id2020.workers.dev";

export default function CreatePage() {
  // Single State
  const [singlePrefix, setSinglePrefix] = useState("");
  const [singleRandom, setSingleRandom] = useState(true);
  const [singleOutput, setSingleOutput] = useState("");
  const [singleStatus, setSingleStatus] = useState("");

  // Bulk State
  const [bulkPrefix, setBulkPrefix] = useState("");
  const [bulkQty, setBulkQty] = useState(10);
  const [bulkRandom, setBulkRandom] = useState(true);
  const [bulkList, setBulkList] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [generatedTotal, setGeneratedTotal] = useState(0);

  const randomSuffix = (len = 5) => Math.random().toString(36).slice(2, 2 + len);

  const saveToWorkerAndLocal = async (emails: string[]) => {
    let returnedItems: { email: string; access_key?: string; copy_format?: string }[] = [];

    // 1. Post to Cloudflare Worker
    try {
      const res = await fetch(`${DB_WORKER}/emails/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails })
      });
      const data = await res.json();
      if (data && Array.isArray(data.emails)) {
        returnedItems = data.emails;
      }
    } catch (e) {}

    // 2. Save to localStorage activity log
    try {
      const raw = localStorage.getItem("ssidmail_activity_logs");
      const existing = raw ? JSON.parse(raw) : [];
      const newRecords = emails.map((e) => {
        const item = returnedItems.find((r) => r.email === e);
        const accessKey = item?.access_key || randomSuffix(6).toUpperCase();
        return {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          email: e,
          access_key: accessKey,
          sizeMb: "0.00",
          messages: 0,
          active: true,
          deleted: false,
          status: "active",
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          synced: true
        };
      });

      const merged = [...newRecords, ...existing];
      localStorage.setItem("ssidmail_activity_logs", JSON.stringify(merged));
    } catch (e) {}

    return returnedItems;
  };

  const handleGenerateSingle = async () => {
    const base = singlePrefix.trim()
      ? singlePrefix.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "")
      : singleRandom ? `temp_${randomSuffix(6)}` : "temp";

    const email = `${base}@ssidmail.my.id`;
    const res = await saveToWorkerAndLocal([email]);
    const key = res[0]?.access_key || randomSuffix(6).toUpperCase();
    const formatted = `${email} | Key: ${key}`;

    setSingleOutput(formatted);
    setSingleStatus(`Email & Access Key generated: ${email} | ${key}`);
    setGeneratedTotal((prev) => prev + 1);

    localStorage.setItem("ssidmail_access_key", key);
    localStorage.setItem("ssidmail_last_email", email);
    return formatted;
  };

  const handleCopySingle = async () => {
    let email = singleOutput;
    if (!email) {
      email = await handleGenerateSingle();
    }
    navigator.clipboard.writeText(email);
    setSingleStatus("Copied email & Access Key to clipboard!");
  };

  const handleUseInboxSingle = async () => {
    let outputText = singleOutput;
    if (!outputText) {
      outputText = await handleGenerateSingle();
    }
    const cleanEmail = outputText.split("|")[0].trim();
    localStorage.setItem("ssidmail_last_email", cleanEmail);
    window.location.href = "/mail";
  };

  const handleGenerateBulk = async () => {
    const prefix = bulkPrefix.trim()
      ? bulkPrefix.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "")
      : "user";
    const qty = Math.max(1, Math.min(bulkQty || 10, 100));

    const generated = Array.from({ length: qty }, (_, idx) => {
      const s = bulkRandom ? randomSuffix(5) : String(idx + 1).padStart(3, "0");
      return `${prefix}_${s}@ssidmail.my.id`;
    });

    const res = await saveToWorkerAndLocal(generated);
    const formattedLines = generated.map((e) => {
      const match = res.find((r) => r.email === e);
      return match?.copy_format || `${e} | ${match?.access_key || randomSuffix(6).toUpperCase()}`;
    });

    setBulkList(formattedLines);
    setGeneratedTotal(formattedLines.length);
    setBulkStatus(`${formattedLines.length} emails & Access Keys generated.`);
  };

  const handleCopyBulk = async () => {
    if (bulkList.length === 0) {
      await handleGenerateBulk();
    }
    navigator.clipboard.writeText(bulkList.join("\r\n"));
    setBulkStatus("Bulk list with Access Keys copied.");
  };

  const handleExportTXT = () => {
    if (bulkList.length === 0) return;
    const blob = new Blob([bulkList.join("\r\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ssidmail-bulk-list.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setBulkStatus("TXT exported.");
  };

  return (
    <AppShell>
      <div id="viewCreate" className="view-panel">
        <div className="create-page">
          <div className="create-shell">
            <div className="create-header">
              <div>
                <div className="create-kicker">EMAIL GENERATOR</div>
                <h1 className="create-title">Create temp email</h1>
                <p className="create-desc">
                  Generate single or bulk temporary addresses, copy results, or export them as a TXT file.
                </p>
              </div>
              <div className="create-mini-stat">
                <div className="num" id="generatedCount">
                  {generatedTotal}
                </div>
                <div className="lbl">Generated</div>
              </div>
            </div>

            <div className="create-grid">
              {/* SINGLE CREATE */}
              <section className="create-card">
                <div className="create-card-head">
                  <div>
                    <div className="create-card-title">Single create</div>
                    <div className="create-card-subtitle">Create one custom or random temp email.</div>
                  </div>
                  <span className="create-badge">SINGLE</span>
                </div>

                <div className="create-field">
                  <label htmlFor="singlePrefix">Prefix</label>
                  <input
                    className="create-input"
                    id="singlePrefix"
                    type="text"
                    placeholder="promo, testing, user"
                    value={singlePrefix}
                    onChange={(e) => setSinglePrefix(e.target.value)}
                  />
                </div>

                <div className="create-toggle-row">
                  <span>Use random suffix if prefix is empty</span>
                  <input
                    type="checkbox"
                    checked={singleRandom}
                    onChange={(e) => setSingleRandom(e.target.checked)}
                  />
                </div>

                <div className="result-box">
                  <span className={singleOutput ? "" : "result-placeholder"}>
                    {singleOutput || "No email generated yet"}
                  </span>
                </div>

                <div className="create-actions">
                  <button className="create-btn primary" onClick={handleGenerateSingle}>
                    Generate
                  </button>
                  <button className="create-btn" onClick={handleCopySingle}>
                    Copy
                  </button>
                  <button className="create-btn" onClick={handleUseInboxSingle}>
                    Use Inbox
                  </button>
                </div>
                <div className="create-status">{singleStatus}</div>
              </section>

              {/* BULK CREATE */}
              <section className="create-card">
                <div className="create-card-head">
                  <div>
                    <div className="create-card-title">Bulk create</div>
                    <div className="create-card-subtitle">Generate multiple email addresses at once.</div>
                  </div>
                  <span className="create-badge">BULK</span>
                </div>

                <div className="create-row">
                  <div className="create-field">
                    <label htmlFor="bulkPrefix">Prefix</label>
                    <input
                      className="create-input"
                      id="bulkPrefix"
                      type="text"
                      placeholder="user"
                      value={bulkPrefix}
                      onChange={(e) => setBulkPrefix(e.target.value)}
                    />
                  </div>
                  <div className="create-field">
                    <label htmlFor="bulkQty">Qty</label>
                    <input
                      className="create-input"
                      id="bulkQty"
                      type="number"
                      min={1}
                      max={100}
                      value={bulkQty}
                      onChange={(e) => setBulkQty(parseInt(e.target.value) || 10)}
                    />
                  </div>
                </div>

                <div className="create-toggle-row">
                  <span>Random suffix instead of sequential numbers</span>
                  <input
                    type="checkbox"
                    checked={bulkRandom}
                    onChange={(e) => setBulkRandom(e.target.checked)}
                  />
                </div>

                <textarea
                  className="create-textarea bulk-list"
                  readOnly
                  placeholder="Generated emails will appear here..."
                  value={bulkList.join("\r\n")}
                />

                <div className="create-actions">
                  <button className="create-btn primary" onClick={handleGenerateBulk}>
                    Generate Bulk
                  </button>
                  <button className="create-btn" onClick={handleCopyBulk}>
                    Copy All
                  </button>
                  <button className="create-btn" onClick={handleExportTXT}>
                    Export TXT
                  </button>
                  <button
                    className="create-btn danger"
                    onClick={() => {
                      setBulkList([]);
                      setBulkStatus("Bulk list cleared.");
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="create-status">{bulkStatus}</div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
