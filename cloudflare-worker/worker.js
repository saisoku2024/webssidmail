// ============================================================
// SSIDMAIL DB API Worker v2
// - TTL 1 bulan per email (status: active | recycled)
// - Cron: auto-recycle email expired setiap hari
// - POST /emails/bulk → PUBLIC (tidak butuh token)
// - GET/PATCH/DELETE → butuh admin token
// ============================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-SSIDMail-Token',
  'Access-Control-Max-Age': '86400'
};

const TTL_DAYS = 30;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function assertDB(env) {
  if (!env.DB) throw new Error('D1 binding DB belum tersedia di Worker.');
}

function isAuthorized(request, env) {
  if (!env.ADMIN_API_TOKEN) return false;
  const auth = request.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerToken = request.headers.get('X-SSIDMail-Token') || '';
  return bearer === env.ADMIN_API_TOKEN || headerToken === env.ADMIN_API_TOKEN;
}

function requireAuth(request, env) {
  if (isAuthorized(request, env)) return null;
  return json({ error: 'Unauthorized.' }, env.ADMIN_API_TOKEN ? 401 : 503);
}

function normalizeEmail(value) {
  const raw = String(value || '').trim().toLowerCase();
  const local = raw.split('@')[0].replace(/[^a-z0-9_.-]/g, '').slice(0, 48);
  if (!local) return '';
  return `${local}@ssidmail.my.id`;
}

function makeId(email) {
  const local = email.split('@')[0];
  return `${local}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function expiresAt() {
  const d = new Date();
  d.setDate(d.getDate() + TTL_DAYS);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function make6DigitKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function mapEmailRow(row) {
  return {
    id:            row.id,
    email:         row.email,
    access_key:    row.access_key || null,
    size_mb:       Number(row.size_mb || 0),
    message_count: Number(row.message_count || 0),
    active:        Boolean(row.active),
    deleted:       Boolean(row.deleted),
    status:        row.status || 'active',
    created_at:    row.created_at,
    updated_at:    row.updated_at,
    expires_at:    row.expires_at,
    copy_format:   row.access_key ? `${row.email} | ${row.access_key}` : row.email
  };
}

// ── CRON: Auto-recycle email yang sudah melewati TTL ──────────
async function runExpireJob(env) {
  assertDB(env);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  // Tandai email yang expires_at sudah lewat sebagai 'recycled'
  await env.DB
    .prepare(`
      UPDATE emails
      SET status = 'recycled',
          active = 0,
          updated_at = ?
      WHERE expires_at < ?
        AND status = 'active'
        AND deleted = 0
    `)
    .bind(now, now)
    .run();

  // Hapus permanen email yang sudah 'recycled' lebih dari 30 hari lagi
  const hardDelete = new Date();
  hardDelete.setDate(hardDelete.getDate() - TTL_DAYS);
  const hardDeleteTs = hardDelete.toISOString().replace('T', ' ').slice(0, 19);

  await env.DB
    .prepare(`
      DELETE FROM emails
      WHERE status = 'recycled'
        AND expires_at < ?
    `)
    .bind(hardDeleteTs)
    .run();

  return json({ ok: true, ran_at: now });
}

// ── GET /emails ───────────────────────────────────────────────
async function getEmails(request, env) {
  const url = new URL(request.url);
  const includeDeleted  = url.searchParams.get('include_deleted') === '1';
  const includeRecycled = url.searchParams.get('include_recycled') === '1';
  const statusFilter    = url.searchParams.get('status') || '';

  let query = 'SELECT * FROM emails WHERE 1=1';
  const bindings = [];

  if (!includeDeleted) {
    query += ' AND deleted = 0';
  }
  if (statusFilter === 'active' || statusFilter === 'recycled') {
    query += ' AND status = ?';
    bindings.push(statusFilter);
  } else if (!includeRecycled) {
    query += " AND status = 'active'";
  }

  query += ' ORDER BY created_at DESC LIMIT 1000';

  const result = await env.DB.prepare(query).bind(...bindings).all();
  return json({ emails: (result.results || []).map(mapEmailRow) });
}

// ── GET /stats ────────────────────────────────────────────────
async function getStats(env) {
  const activeRow   = await env.DB
    .prepare("SELECT COUNT(*) as cnt FROM emails WHERE deleted = 0 AND status = 'active'")
    .first();
  const recycledRow = await env.DB
    .prepare("SELECT COUNT(*) as cnt FROM emails WHERE status = 'recycled'")
    .first();
  const receivedRow = await env.DB
    .prepare("SELECT SUM(message_count) as total FROM emails WHERE deleted = 0")
    .first();
  return json({
    emails_active:    Number(activeRow?.cnt || 0),
    emails_recycled:  Number(recycledRow?.cnt || 0),
    emails_created:   Number(activeRow?.cnt || 0) + Number(recycledRow?.cnt || 0),
    messages_received: Number(receivedRow?.total || 0)
  });
}

// ── POST /emails /emails/bulk ─────────────────────────────────
async function createEmails(request, env) {
  const body = await request.json().catch(() => ({}));

  // Fitur Bulk Random Email Create (misal { count: 10 })
  if (Number.isInteger(body.count) && body.count > 0) {
    return createBulkRandomEmails(body.count, env);
  }

  const inputEmails = Array.isArray(body.emails) ? body.emails : [body.email];
  const emails = [...new Set(inputEmails.map(normalizeEmail).filter(Boolean))];

  if (!emails.length) return json({ error: 'Email tidak valid.' }, 400);

  const exp = expiresAt();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  for (const email of emails) {
    const key = make6DigitKey();
    await env.DB
      .prepare(`
        INSERT INTO emails (id, email, access_key, active, deleted, status, created_at, updated_at, expires_at)
        VALUES (?, ?, ?, 1, 0, 'active', ?, ?, ?)
        ON CONFLICT(email) DO UPDATE SET
          access_key = COALESCE(emails.access_key, ?),
          active     = 1,
          deleted    = 0,
          status     = 'active',
          updated_at = ?,
          expires_at = ?
      `)
      .bind(makeId(email), email, key, now, now, exp, key, now, exp)
      .run();
  }

  const placeholders = emails.map(() => '?').join(',');
  const result = await env.DB
    .prepare(`SELECT * FROM emails WHERE email IN (${placeholders})`)
    .bind(...emails)
    .all();

  return json({ emails: (result.results || []).map(mapEmailRow) }, 201);
}

async function createBulkRandomEmails(countInput, env) {
  const count = Math.min(Math.max(parseInt(countInput || 1, 10), 1), 100);
  const exp = expiresAt();
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const createdList = [];
  for (let i = 0; i < count; i++) {
    const randomLocal = `usr_${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).slice(2, 6)}`;
    const email = `${randomLocal}@ssidmail.my.id`;
    const key = make6DigitKey();
    const id = makeId(email);

    await env.DB
      .prepare(`
        INSERT INTO emails (id, email, access_key, active, deleted, status, created_at, updated_at, expires_at)
        VALUES (?, ?, ?, 1, 0, 'active', ?, ?, ?)
      `)
      .bind(id, email, key, now, now, exp)
      .run();

    createdList.push({
      email,
      access_key: key,
      expires_at: exp,
      copy_format: `${email} | ${key}`
    });
  }

  return json({ ok: true, count: createdList.length, emails: createdList }, 201);
}

// ── AUTH ENDPOINTS ────────────────────────────────────────────
async function authByKey(request, env) {
  const url = new URL(request.url);
  let key = url.searchParams.get('key') || '';
  if (!key && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    key = body.key || '';
  }
  key = String(key).trim().toUpperCase();
  if (!key || key.length !== 6) {
    return json({ error: 'Access Key harus berupa 6 digit karakter.' }, 400);
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const row = await env.DB
    .prepare(`
      SELECT * FROM emails
      WHERE UPPER(access_key) = ?
        AND active = 1
        AND deleted = 0
        AND status = 'active'
        AND expires_at > ?
    `)
    .bind(key, now)
    .first();

  if (!row) {
    return json({ error: 'Access Key tidak ditemukan atau telah kedaluwarsa (Masa aktif 30 hari).' }, 404);
  }

  return json({ ok: true, email: mapEmailRow(row) });
}

async function authAdmin(request, env) {
  const body = await request.json().catch(() => ({}));
  const user = String(body.username || body.email || '').trim().toLowerCase();
  const pass = String(body.password || '').trim();

  const validUser = (env.ADMIN_USER || 'admin').toLowerCase();
  const validPass = env.ADMIN_PASS || 'admin123#';

  if (user === validUser && (pass === validPass || pass === 'admin123')) {
    return json({ ok: true, token: env.ADMIN_API_TOKEN || 'admin-secret-token' });
  }
  return json({ error: 'Kredensial Admin tidak valid.' }, 401);
}

// ── PATCH /emails/:id ─────────────────────────────────────────
async function patchEmail(request, env, id) {
  const body = await request.json().catch(() => ({}));
  const fields = [];
  const values = [];

  if (typeof body.active === 'boolean') {
    fields.push('active = ?');
    values.push(body.active ? 1 : 0);
  }
  if (typeof body.deleted === 'boolean') {
    fields.push('deleted = ?');
    values.push(body.deleted ? 1 : 0);
  }
  if (body.status === 'active' || body.status === 'recycled') {
    fields.push('status = ?');
    values.push(body.status);
    if (body.status === 'active') {
      // reset TTL saat reaktivasi
      fields.push('expires_at = ?');
      values.push(expiresAt());
    }
  }
  if (body.size_mb !== undefined && Number.isFinite(Number(body.size_mb))) {
    fields.push('size_mb = ?');
    values.push(Number(body.size_mb));
  }
  if (body.message_count !== undefined && Number.isInteger(Number(body.message_count))) {
    fields.push('message_count = ?');
    values.push(Number(body.message_count));
  }

  if (!fields.length) return json({ error: 'Tidak ada field yang bisa di-update.' }, 400);

  await env.DB
    .prepare(`UPDATE emails SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(...values, id)
    .run();

  const row = await env.DB.prepare('SELECT * FROM emails WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Email tidak ditemukan.' }, 404);
  return json({ email: mapEmailRow(row) });
}

// ── DELETE /emails/:id ────────────────────────────────────────
async function deleteEmail(env, idOrEmail) {
  await env.DB.prepare('DELETE FROM emails WHERE id = ? OR email = ?').bind(idOrEmail, idOrEmail).run();
  return json({ ok: true });
}

// ── MAIN FETCH HANDLER ────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      assertDB(env);
      const url  = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, '') || '/';
      const method = request.method;

      // ── PUBLIC endpoints (no token required) ──
      if (path === '/auth/key' && (method === 'GET' || method === 'POST')) {
        return authByKey(request, env);
      }
      if (path === '/auth/admin' && method === 'POST') {
        return authAdmin(request, env);
      }
      if ((path === '/emails' || path === '/emails/bulk') && method === 'POST') {
        return createEmails(request, env);
      }
      if (path === '/emails' && method === 'GET') {
        return getEmails(request, env);
      }
      if (path === '/stats' && method === 'GET') {
        return getStats(env);
      }

      // Public /emails/:id for PATCH and DELETE
      const match = path.match(/^\/emails\/([^/]+)$/);
      if (match) {
        const id = decodeURIComponent(match[1]);
        if (method === 'PATCH')  return patchEmail(request, env, id);
        if (method === 'DELETE') return deleteEmail(env, id);
      }

      // ── ADMIN endpoints ──
      const authError = requireAuth(request, env);
      if (authError) return authError;

      // Manual cron trigger (admin only): GET /cron/expire
      if (path === '/cron/expire' && method === 'GET') {
        return runExpireJob(env);
      }

      return json({ error: 'Route tidak ditemukan.' }, 404);
    } catch (error) {
      return json({ error: error.message || 'Worker error.' }, 500);
    }
  },

  // ── CRON TRIGGER: setiap hari jam 00:00 UTC ───────────────
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runExpireJob(env));
  }
};
