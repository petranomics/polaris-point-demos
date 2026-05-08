// /api/beacons/items.js — Personal Beacons workspace storage (single-user)
//
// Auth: client sends header `x-beacons-auth: <sha256(passcode)>`.
//       Server compares against env var BEACONS_PASSCODE_HASH.
// Storage: Neon Postgres (DATABASE_URL). Single table `beacons_items` auto-created on first call.
//
// Endpoints:
//   GET    /api/beacons/items          → returns array of all items
//   PUT    /api/beacons/items          → upsert one item (body is the full item JSON, must include `id`)
//   DELETE /api/beacons/items?id=xxx   → delete one item by id
const { neon } = require('@neondatabase/serverless');
const Auth = require('../../lib/auth');

let _tableEnsured = false;

async function ensureTable(sql) {
  if (_tableEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS beacons_items (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      kind TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_beacons_items_kind ON beacons_items (kind)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_beacons_items_updated ON beacons_items (updated_at DESC)`;
  _tableEnsured = true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ error: 'DATABASE_URL not configured' });
  }
  if (!process.env.BEACONS_JWT_SECRET) {
    return res.status(500).json({ error: 'BEACONS_JWT_SECRET not configured.' });
  }

  const tenant = await Auth.resolveTenant(req);
  if (!tenant) {
    return res.status(401).json({ error: 'Invalid or missing auth' });
  }

  const sql = neon(process.env.DATABASE_URL);
  await ensureTable(sql);

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT data FROM beacons_items
        ORDER BY created_at DESC
      `;
      const items = rows.map(r => r.data);
      return res.status(200).json(items);
    }

    if (req.method === 'PUT') {
      const item = req.body;
      if (!item || typeof item !== 'object') return res.status(400).json({ error: 'Body must be an object' });
      if (!item.id) return res.status(400).json({ error: 'Missing id' });
      const id = String(item.id);
      const kind = item.kind ? String(item.kind) : null;
      const createdAt = item.created_at ? new Date(item.created_at) : new Date();
      const updatedAt = item.updated_at ? new Date(item.updated_at) : new Date();
      await sql`
        INSERT INTO beacons_items (id, data, kind, created_at, updated_at)
        VALUES (${id}, ${JSON.stringify(item)}::jsonb, ${kind}, ${createdAt.toISOString()}, ${updatedAt.toISOString()})
        ON CONFLICT (id) DO UPDATE
          SET data = EXCLUDED.data,
              kind = EXCLUDED.kind,
              updated_at = EXCLUDED.updated_at
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = (req.query && req.query.id) ? String(req.query.id) : null;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      await sql`DELETE FROM beacons_items WHERE id = ${id}`;
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('beacons/items error', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
