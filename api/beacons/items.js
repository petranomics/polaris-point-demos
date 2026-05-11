// /api/beacons/items.js — Multi-tenant per-user workspace storage.
//
// SECURITY: every row is owned by a tenant. Reads and writes are filtered
// by tenant_id resolved from the auth header. No cross-tenant visibility.
//
// Endpoints:
//   GET    /api/beacons/items          → array of items owned by caller's tenant
//   PUT    /api/beacons/items          → upsert one item (server stamps tenant_id;
//                                         updating someone else's id 404s)
//   DELETE /api/beacons/items?id=xxx   → delete one of caller's items
//
// Storage: Neon Postgres. tenant_id column added 2026-05-10 to enforce
// containerization. Existing rows backfilled as 'pete' on first cold start.

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
  // Multi-tenant column. Additive — existing single-user data is backfilled
  // as 'pete' so Pete's workspace keeps working.
  await sql`ALTER TABLE beacons_items ADD COLUMN IF NOT EXISTS tenant_id TEXT`;
  await sql`UPDATE beacons_items SET tenant_id = 'pete' WHERE tenant_id IS NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_beacons_items_kind   ON beacons_items (kind)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_beacons_items_updated ON beacons_items (updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_beacons_items_tenant  ON beacons_items (tenant_id, updated_at DESC)`;
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
  const tenantId = tenant.id;

  const sql = neon(process.env.DATABASE_URL);
  await ensureTable(sql);

  try {
    if (req.method === 'GET') {
      const rows = await sql`
        SELECT data FROM beacons_items
        WHERE tenant_id = ${tenantId}
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

      // Server stamps tenant_id — the client cannot spoof it. If a row with
      // this id already exists owned by a different tenant, the upsert is
      // rejected (preserves isolation even with predictable IDs).
      const existing = await sql`SELECT tenant_id FROM beacons_items WHERE id = ${id}`;
      if (existing.length && existing[0].tenant_id && existing[0].tenant_id !== tenantId) {
        return res.status(403).json({ error: 'Item id belongs to another tenant' });
      }

      // Embed tenant_id in the JSONB payload too so client reads see it.
      const enriched = { ...item, tenant_id: tenantId };

      await sql`
        INSERT INTO beacons_items (id, data, kind, tenant_id, created_at, updated_at)
        VALUES (${id}, ${JSON.stringify(enriched)}::jsonb, ${kind}, ${tenantId},
                ${createdAt.toISOString()}, ${updatedAt.toISOString()})
        ON CONFLICT (id) DO UPDATE
          SET data = EXCLUDED.data,
              kind = EXCLUDED.kind,
              tenant_id = EXCLUDED.tenant_id,
              updated_at = EXCLUDED.updated_at
      `;
      return res.status(200).json({ ok: true });
    }

    if (req.method === 'DELETE') {
      const id = (req.query && req.query.id) ? String(req.query.id) : null;
      if (!id) return res.status(400).json({ error: 'Missing id' });
      // Scoped delete — can only delete your own items.
      const result = await sql`
        DELETE FROM beacons_items
        WHERE id = ${id} AND tenant_id = ${tenantId}
        RETURNING id
      `;
      if (!result.length) {
        return res.status(404).json({ error: 'Item not found or not owned by this tenant' });
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, PUT, DELETE, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('beacons/items error', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
};
