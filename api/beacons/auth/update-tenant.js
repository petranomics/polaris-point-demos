// /api/beacons/auth/update-tenant.js — Admin endpoint to adjust tenant
// settings (tier, allocation %, display name).
//
// PATCH { tenant_id, tier?, allocation_pct?, display_name?, settings? } → { tenant }
// Auth: x-beacons-admin-key header.
//
// Usage during beta to bump a customer up a plan or hand-tune their bandwidth:
//   curl -X PATCH https://polarispoint.io/api/beacons/auth/update-tenant \
//     -H "x-beacons-admin-key: $BEACONS_ADMIN_KEY" \
//     -H "Content-Type: application/json" \
//     -d '{"tenant_id":"t_abc","tier":"pro","allocation_pct":25}'
//
// Pete can also flip the web_search toggle for a tenant without them logging
// in by passing { settings: { web_search_enabled: false } }.

const { neon } = require('@neondatabase/serverless');
const Auth = require('../../../lib/auth');

const ALLOWED_SETTINGS_KEYS = ['web_search_enabled'];

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
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH' && req.method !== 'POST') return res.status(405).json({ error: 'PATCH or POST only' });

  if (!process.env.DATABASE_URL)      return res.status(500).json({ error: 'DATABASE_URL not configured' });
  if (!process.env.BEACONS_ADMIN_KEY) return res.status(500).json({ error: 'BEACONS_ADMIN_KEY not configured' });
  if (!adminAuthOk(req))              return res.status(401).json({ error: 'Invalid admin key' });

  const { tenant_id, tier, allocation_pct, display_name, settings, is_admin, email, password } = req.body || {};
  if (!tenant_id) return res.status(400).json({ error: 'Missing tenant_id' });

  const sql = neon(process.env.DATABASE_URL);
  await Auth.ensureTenantsTable(sql);

  const existing = await Auth.findTenantById(sql, tenant_id);
  if (!existing) return res.status(404).json({ error: 'Tenant not found' });

  // Build update set. Only apply provided fields.
  const updates = {};
  if (tier !== undefined) {
    if (!Auth.TIERS[tier]) return res.status(400).json({ error: `Unknown tier: ${tier}. Valid: ${Object.keys(Auth.TIERS).join(', ')}` });
    updates.tier = tier;
  }
  if (allocation_pct !== undefined) {
    if (!Number.isInteger(allocation_pct) || allocation_pct < 0 || allocation_pct > 100) {
      return res.status(400).json({ error: 'allocation_pct must be 0-100' });
    }
    updates.allocation_pct = allocation_pct;
  }
  if (display_name !== undefined) updates.display_name = display_name || null;
  if (typeof is_admin === 'boolean') updates.is_admin = is_admin;
  if (email !== undefined) {
    const e = String(email || '').toLowerCase().trim();
    if (!e || !e.includes('@')) return res.status(400).json({ error: 'Invalid email' });
    // Prevent collision with another tenant's email.
    const conflict = await Auth.findTenantByEmail(sql, e);
    if (conflict && conflict.id !== tenant_id) {
      return res.status(409).json({ error: 'Email already in use by another tenant', tenant_id: conflict.id });
    }
    updates.email = e;
  }
  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be 8+ characters' });
    }
    updates.password_hash = await Auth.hashPassword(password);
  }
  if (settings && typeof settings === 'object') {
    const merged = { ...(existing.settings || {}) };
    for (const k of ALLOWED_SETTINGS_KEYS) {
      if (Object.prototype.hasOwnProperty.call(settings, k)) merged[k] = settings[k];
    }
    updates.settings = merged;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'Nothing to update.' });
  }

  // Issue updates one column at a time to keep the parameterization simple.
  if (updates.tier !== undefined)            await sql`UPDATE beacons_tenants SET tier = ${updates.tier}, updated_at = NOW() WHERE id = ${tenant_id}`;
  if (updates.allocation_pct !== undefined)  await sql`UPDATE beacons_tenants SET allocation_pct = ${updates.allocation_pct}, updated_at = NOW() WHERE id = ${tenant_id}`;
  if (updates.display_name !== undefined)    await sql`UPDATE beacons_tenants SET display_name = ${updates.display_name}, updated_at = NOW() WHERE id = ${tenant_id}`;
  if (updates.is_admin !== undefined)        await sql`UPDATE beacons_tenants SET is_admin = ${updates.is_admin}, updated_at = NOW() WHERE id = ${tenant_id}`;
  if (updates.email !== undefined)           await sql`UPDATE beacons_tenants SET email = ${updates.email}, updated_at = NOW() WHERE id = ${tenant_id}`;
  if (updates.password_hash !== undefined)   await sql`UPDATE beacons_tenants SET password_hash = ${updates.password_hash}, updated_at = NOW() WHERE id = ${tenant_id}`;
  if (updates.settings !== undefined)        await sql`UPDATE beacons_tenants SET settings = ${JSON.stringify(updates.settings)}::jsonb, updated_at = NOW() WHERE id = ${tenant_id}`;

  const updated = await Auth.findTenantById(sql, tenant_id);
  return res.status(200).json({ tenant: Auth.publicTenant(updated) });
};
