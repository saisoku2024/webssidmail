const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-SSIDMail-Token',
  'Access-Control-Max-Age': '86400'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function assertDB(env) {
  if (!env.DB) {
    throw new Error('D1 binding DB belum tersedia di Worker.');
  }
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
  const local = raw.split('@')[0].replace(/[^a-z0-9_-]/g, '').slice(0, 48);
  if (!local) return '';
  return `${local}@ssidmail.my.id`;
}

function makeId(email) {
  const local = email.split('@')[0];
  return `${local}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

function mapEmailRow(row) {
  return {
    id: row.id,
    email: row.email,
    size_mb: Number(row.size_mb || 0),
    message_count: Number(row.message_count || 0),
    active: Boolean(row.active),
    deleted: Boolean(row.deleted),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function getEmails(request, env) {
  const url = new URL(request.url);
  const includeDeleted = url.searchParams.get('include_deleted') === '1';

  const query = includeDeleted
    ? 'SELECT * FROM emails ORDER BY created_at DESC LIMIT 500'
    : 'SELECT * FROM emails WHERE deleted = 0 ORDER BY created_at DESC LIMIT 500';

  const result = await env.DB.prepare(query).all();
  return json({ emails: (result.results || []).map(mapEmailRow) });
}

async function selectEmailsByAddress(env, emails) {
  const placeholders = emails.map(() => '?').join(',');
  if (!placeholders) return [];
  const result = await env.DB
    .prepare(`SELECT * FROM emails WHERE email IN (${placeholders}) ORDER BY created_at DESC`)
    .bind(...emails)
    .all();
  return (result.results || []).map(mapEmailRow);
}

async function createEmails(request, env) {
  const body = await request.json().catch(() => ({}));
  const inputEmails = Array.isArray(body.emails) ? body.emails : [body.email];
  const emails = [...new Set(inputEmails.map(normalizeEmail).filter(Boolean))];

  if (!emails.length) {
    return json({ error: 'Email tidak valid.' }, 400);
  }

  for (const email of emails) {
    await env.DB
      .prepare(`
        INSERT INTO emails (id, email, active, deleted, updated_at)
        VALUES (?, ?, 1, 0, CURRENT_TIMESTAMP)
        ON CONFLICT(email) DO UPDATE SET
          active = 1,
          deleted = 0,
          updated_at = CURRENT_TIMESTAMP
      `)
      .bind(makeId(email), email)
      .run();
  }

  const rows = await selectEmailsByAddress(env, emails);
  return json({ emails: rows }, 201);
}

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

  if (body.size_mb !== undefined && Number.isFinite(Number(body.size_mb))) {
    fields.push('size_mb = ?');
    values.push(Number(body.size_mb));
  }

  if (body.message_count !== undefined && Number.isInteger(Number(body.message_count))) {
    fields.push('message_count = ?');
    values.push(Number(body.message_count));
  }

  if (!fields.length) {
    return json({ error: 'Tidak ada field yang bisa di-update.' }, 400);
  }

  await env.DB
    .prepare(`UPDATE emails SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(...values, id)
    .run();

  const row = await env.DB.prepare('SELECT * FROM emails WHERE id = ?').bind(id).first();
  if (!row) return json({ error: 'Email tidak ditemukan.' }, 404);

  return json({ email: mapEmailRow(row) });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      assertDB(env);
      const authError = requireAuth(request, env);
      if (authError) return authError;

      const url = new URL(request.url);
      const path = url.pathname.replace(/\/+$/, '') || '/';

      if (path === '/emails' && request.method === 'GET') {
        return getEmails(request, env);
      }

      if ((path === '/emails' || path === '/emails/bulk') && request.method === 'POST') {
        return createEmails(request, env);
      }

      const match = path.match(/^\/emails\/([^/]+)$/);
      if (match && request.method === 'PATCH') {
        return patchEmail(request, env, decodeURIComponent(match[1]));
      }

      return json({ error: 'Route tidak ditemukan.' }, 404);
    } catch (error) {
      return json({ error: error.message || 'Worker error.' }, 500);
    }
  }
};
