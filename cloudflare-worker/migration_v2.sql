-- Migration: tambah kolom status dan expires_at ke tabel emails yang sudah ada

-- 1. Tambah kolom status (jika belum ada)
ALTER TABLE emails ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- 2. Tambah kolom expires_at (jika belum ada)
ALTER TABLE emails ADD COLUMN expires_at TEXT NOT NULL DEFAULT (datetime('now', '+30 days'));

-- 3. Set expires_at dari created_at yang sudah ada (retroactive TTL)
UPDATE emails SET expires_at = datetime(created_at, '+30 days') WHERE expires_at IS NULL OR expires_at = '';

-- 4. Tandai email yang sudah melewati 30 hari sebagai recycled
UPDATE emails SET status = 'recycled', active = 0
WHERE datetime(created_at, '+30 days') < datetime('now')
  AND deleted = 0;

-- 5. Tambah index baru
CREATE INDEX IF NOT EXISTS idx_emails_status     ON emails(status);
CREATE INDEX IF NOT EXISTS idx_emails_expires_at ON emails(expires_at);
