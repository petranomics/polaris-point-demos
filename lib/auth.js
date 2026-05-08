// /lib/auth.js — Multi-tenant auth for Beacons.
//
// Replaces the single-passcode model. Every API call resolves to a tenant
// record (id, email, tier, allocation_pct, settings, ...).
//
// AUTH HEADER: clients send `x-beacons-auth: <jwt>` for new tokens, or
// `x-beacons-auth: <legacy-passcode-sha256>` for backwards compat with Pete's
// existing personal Beacons setup. resolveTenant() tries JWT first, falls
// back to legacy passcode → maps to the bootstrap 'pete' tenant.
//
// REQUIRED ENVS:
//   BEACONS_JWT_SECRET    — random 32+ char string. Sign/verify tokens.
//   BEACONS_PASSCODE_HASH — legacy passcode hash (Pete's personal access).
//   BEACONS_ADMIN_KEY     — admin secret for /api/beacons/auth/create. Pete only.
//   DATABASE_URL          — Neon connection.
//
// BCRYPT cost: 10 rounds (~50ms on Vercel cold start; fine for serverless).

const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const BCRYPT_ROUNDS = 10;
const JWT_TTL_DAYS = 30;

// Tier definitions. Allocation defaults; admin can override per-tenant.
// Pricing is informational — billing is manual until Stripe is wired.
const TIERS = {
  pete:    { allocation_pct: 100, monthly_price_usd: 0,   web_search_default: true,  opus_allowed: true  },
  basic:   { allocation_pct: 10,  monthly_price_usd: 50,  web_search_default: true,  opus_allowed: false },
  pro:     { allocation_pct: 25,  monthly_price_usd: 100, web_search_default: true,  opus_allowed: false },
  premium: { allocation_pct: 50,  monthly_price_usd: 200, web_search_default: true,  opus_allowed: true  }
};

const DEFAULT_SETTINGS = {
  web_search_enabled: true
};

let _tenantsTableEnsured = false;

async function ensureTenantsTable(sql) {
  if (_tenantsTableEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS beacons_tenants (
      id              TEXT PRIMARY KEY,
      email           TEXT UNIQUE NOT NULL,
      password_hash   TEXT NOT NULL,
      display_name    TEXT,
      tier            TEXT NOT NULL DEFAULT 'basic',
      allocation_pct  INTEGER NOT NULL DEFAULT 100,
      settings        JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_admin        BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_beacons_tenants_email ON beacons_tenants (email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_beacons_tenants_tier  ON beacons_tenants (tier)`;
  _tenantsTableEnsured = true;
}

function shortId(prefix) {
  return (prefix ? prefix + '_' : '') + crypto.randomBytes(6).toString('hex');
}

function jwtSecret() {
  const s = process.env.BEACONS_JWT_SECRET;
  if (!s || s.length < 16) throw new Error('BEACONS_JWT_SECRET not set or too short (need 16+ chars)');
  return s;
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  if (!hash) return false;
  try { return await bcrypt.compare(plain, hash); }
  catch { return false; }
}

function signToken(tenant) {
  return jwt.sign(
    { sub: tenant.id, email: tenant.email, tier: tenant.tier },
    jwtSecret(),
    { expiresIn: `${JWT_TTL_DAYS}d` }
  );
}

function verifyToken(token) {
  try { return jwt.verify(token, jwtSecret()); }
  catch { return null; }
}

function legacyPasscodeOk(headerVal) {
  const expected = process.env.BEACONS_PASSCODE_HASH;
  if (!expected) return false;
  if (typeof headerVal !== 'string' || headerVal.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < headerVal.length; i++) mismatch |= headerVal.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

// Bootstrap Pete's tenant record on first run if it doesn't exist.
// Lets the legacy passcode keep working — it now maps to a real tenant row.
async function ensurePeteTenant(sql) {
  const rows = await sql`SELECT id FROM beacons_tenants WHERE id = 'pete' LIMIT 1`;
  if (rows.length) return;
  const placeholderEmail = 'pete@polarispoint.local';
  // Random unusable bcrypt hash — Pete authenticates via legacy passcode, not password.
  const placeholderHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
  await sql`
    INSERT INTO beacons_tenants (id, email, password_hash, display_name, tier, allocation_pct, settings, is_admin)
    VALUES ('pete', ${placeholderEmail}, ${placeholderHash}, 'Pete', 'pete', 100,
            ${JSON.stringify(DEFAULT_SETTINGS)}::jsonb, TRUE)
    ON CONFLICT (id) DO NOTHING
  `;
}

async function findTenantById(sql, id) {
  const rows = await sql`SELECT * FROM beacons_tenants WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

async function findTenantByEmail(sql, email) {
  const rows = await sql`SELECT * FROM beacons_tenants WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;
  return rows[0] || null;
}

// resolveTenant: turn the request's auth header into a tenant record.
// Returns null on any failure (do not leak which step failed).
async function resolveTenant(req) {
  if (!process.env.DATABASE_URL) return null;
  const headerVal = (req.headers['x-beacons-auth'] || '').toString();
  if (!headerVal) return null;

  const sql = neon(process.env.DATABASE_URL);
  await ensureTenantsTable(sql);
  await ensurePeteTenant(sql);

  // Try JWT first (longer than 64 char passcode hash, has dots)
  if (headerVal.includes('.') && headerVal.length > 80) {
    const claims = verifyToken(headerVal);
    if (claims && claims.sub) {
      const tenant = await findTenantById(sql, claims.sub);
      if (tenant) return tenant;
    }
  }

  // Fallback: legacy passcode hash → Pete
  if (legacyPasscodeOk(headerVal)) {
    return await findTenantById(sql, 'pete');
  }

  return null;
}

// Settings helper — merges DB settings over tier defaults so unset fields
// inherit sensible defaults.
function effectiveSettings(tenant) {
  const tier = TIERS[tenant.tier] || TIERS.basic;
  return {
    web_search_enabled: tier.web_search_default,
    ...DEFAULT_SETTINGS,
    ...(tenant.settings || {})
  };
}

// Public-shape tenant for client consumption (no password_hash)
function publicTenant(tenant) {
  if (!tenant) return null;
  const tier = TIERS[tenant.tier] || TIERS.basic;
  return {
    id: tenant.id,
    email: tenant.email,
    display_name: tenant.display_name,
    tier: tenant.tier,
    allocation_pct: tenant.allocation_pct,
    is_admin: !!tenant.is_admin,
    settings: effectiveSettings(tenant),
    tier_info: {
      monthly_price_usd: tier.monthly_price_usd,
      opus_allowed: tier.opus_allowed
    },
    created_at: tenant.created_at
  };
}

module.exports = {
  TIERS,
  DEFAULT_SETTINGS,
  JWT_TTL_DAYS,
  ensureTenantsTable,
  ensurePeteTenant,
  shortId,
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  legacyPasscodeOk,
  findTenantById,
  findTenantByEmail,
  resolveTenant,
  effectiveSettings,
  publicTenant
};
