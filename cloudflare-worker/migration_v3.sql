-- Migration v3: Tambah kolom access_key (6 digit random key) ke tabel emails
ALTER TABLE emails ADD COLUMN access_key TEXT;

-- Index untuk pencarian cepat berdasarkan access_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_emails_access_key ON emails(access_key);
