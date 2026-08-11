-- ============================================================
-- SSIDMAIL DB SCHEMA v2
-- Email TTL: 1 bulan (30 hari) sejak created_at
-- Status: active | recycled
-- ============================================================

CREATE TABLE IF NOT EXISTS emails (
  id          TEXT    PRIMARY KEY,
  email       TEXT    NOT NULL UNIQUE,
  size_mb     REAL    NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1,
  deleted     INTEGER NOT NULL DEFAULT 0,
  -- status: 'active' | 'recycled'
  status      TEXT    NOT NULL DEFAULT 'active',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  -- TTL: auto-set to 30 hari dari created_at
  expires_at  TEXT    NOT NULL DEFAULT (datetime('now', '+30 days'))
);

CREATE INDEX IF NOT EXISTS idx_emails_created_at  ON emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_deleted      ON emails(deleted);
CREATE INDEX IF NOT EXISTS idx_emails_active       ON emails(active);
CREATE INDEX IF NOT EXISTS idx_emails_status       ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_expires_at   ON emails(expires_at);
