// /api/beacons/auth/create.js — Admin endpoint to provision new tenants.
//
// POST { email, password, display_name?, tier?, allocation_pct? } → { tenant }
//
// Auth: x-beacons-admin-key header must match BEACONS_ADMIN_KEY env var.
// Pete uses this from his terminal during beta to add customer accounts:
//
//   curl -X POST https://polarispoint.io/api/beacons/auth/create \
//     -H "x-beacons-admin-key: $BEACONS_ADMIN_KEY" \
//     -H "Content-Type: application/json" \
//     -d '{"email":"customer@co.com","password":"temp-pw-123","display_name":"Acme","tier":"basic"}'
//
// Self-signup is intentionally NOT enabled. Until Stripe is wired and ToS
// drafted, every account is manually provisioned.

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-admin-key');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.DATABASE_URL)       return res.status(500).json({ error: 'DATABASE_URL not configured' });
  if (!process.env.BEACONS_ADMIN_KEY)  return res.status(500).json({ error: 'BEACONS_ADMIN_KEY not configured' });
  if (!adminAuthOk(req))               return res.status(401).json({ error: 'Invalid admin key' });

  const { email, password, display_name, tier, allocation_pct } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });

  const requestedTier = tier && Auth.TIERS[tier] ? tier : 'basic';
  const tierDefaults = Auth.TIERS[requestedTier];
  const requestedAllocation = Number.isInteger(allocation_pct) && allocation_pct >= 0 && allocation_pct <= 100
    ? allocation_pct
    : tierDefaults.allocation_pct;

  const sql = neon(process.env.DATABASE_URL);
  await Auth.ensureTenantsTable(sql);

  const existing = await Auth.findTenantByEmail(sql, email);
  if (existing) return res.status(409).json({ error: 'Tenant with this email already exists', tenant_id: existing.id });

  const id = Auth.shortId('t');
  const passwordHash = await Auth.hashPassword(password);

  // New tenants start with onboarded:false so the wizard auto-fires on first
  // sign-in. The wizard sets it to true after the user completes (or skips).
  const initialSettings = { ...Auth.DEFAULT_SETTINGS, onboarded: false };
  await sql`
    INSERT INTO beacons_tenants
      (id, email, password_hash, display_name, tier, allocation_pct, settings, is_admin)
    VALUES
      (${id}, ${email.toLowerCase()}, ${passwordHash}, ${display_name || null},
       ${requestedTier}, ${requestedAllocation},
       ${JSON.stringify(initialSettings)}::jsonb, FALSE)
  `;

  const tenant = await Auth.findTenantById(sql, id);
  return res.status(201).json({ tenant: Auth.publicTenant(tenant) });
};
