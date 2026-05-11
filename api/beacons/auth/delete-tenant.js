// /api/beacons/auth/delete-tenant.js — Admin: hard-delete a tenant + their
// workspace data.
//
// DELETE /api/beacons/auth/delete-tenant?tenant_id=X
//   (POST also accepted with { tenant_id } in body)
//
// What gets deleted:
//   - beacons_tenants row
//   - all beacons_items owned by the tenant (their library, projects, tasks,
//     threads, files, thoughts, direction)
//   - all beacons_password_resets tokens for the tenant
//
// What's kept:
//   - beacons_usage_log entries (historical cost/billing data — survives the
//     tenant deletion so monthly reconciliation stays accurate)
//
// Safety:
//   - Refuses to delete tenant_id='pete' (don't lock Pete out by accident).
//   - Admin-key gated (x-beacons-admin-key header).
//   - Idempotent: deleting an already-deleted tenant returns 404.
//
// Usage:
//   curl -X DELETE "https://polarispoint.io/api/beacons/auth/delete-tenant?tenant_id=t_xxxx" \
//     -H "x-beacons-admin-key: $BEACONS_ADMIN_KEY"

const { neon } = require('@neondatabase/serverless');
const Auth = require('../../../lib/auth');

function adminAuthOk(req) {
  const expected = process.env.BEACONS_ADMIN_KEY;
  if (!expected || expected.length < 16) return false;
  const got = (req.headers['x-beacons-admin-key'] || '').toString();
  if (got.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < got.length; i++) mismatch |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE' && req.method !== 'POST') return res.status(405).json({ error: 'DELETE or POST only' });

  if (!process.env.DATABASE_URL)       return res.status(500).json({ error: 'DATABASE_URL not configured' });
  if (!process.env.BEACONS_ADMIN_KEY)  return res.status(500).json({ error: 'BEACONS_ADMIN_KEY not configured' });
  if (!adminAuthOk(req))               return res.status(401).json({ error: 'Invalid admin key' });

  const tenantId = (req.query && req.query.tenant_id) || (req.body && req.body.tenant_id) || null;
  if (!tenantId) return res.status(400).json({ error: 'Missing tenant_id' });
  if (tenantId === 'pete') return res.status(403).json({ error: "Refused: cannot delete the 'pete' tenant via this endpoint." });

  const sql = neon(process.env.DATABASE_URL);
  await Auth.ensureTenantsTable(sql);

  const existing = await Auth.findTenantById(sql, tenantId);
  if (!existing) return res.status(404).json({ error: 'Tenant not found' });

  // Cascade delete tenant-scoped data. Usage log intentionally untouched.
  const itemsDeleted = await sql`DELETE FROM beacons_items           WHERE tenant_id = ${tenantId} RETURNING id`;
  let resetsDeleted = [];
  try {
    resetsDeleted = await sql`DELETE FROM beacons_password_resets WHERE tenant_id = ${tenantId} RETURNING token`;
  } catch (e) {
    // Table may not exist yet if password reset has never been requested.
    console.warn('[delete-tenant] password_resets cleanup skipped:', e.message);
  }
  await sql`DELETE FROM beacons_tenants WHERE id = ${tenantId}`;

  return res.status(200).json({
    ok: true,
    deleted: {
      tenant_id: tenantId,
      email: existing.email,
      items_removed: itemsDeleted.length,
      reset_tokens_removed: resetsDeleted.length
    },
    note: 'Usage log entries for this tenant are preserved for billing history.'
  });
};
