-- 2026-05-08-beacons-tenants.sql
-- Multi-tenant accounts for Beacons. Replaces the single-passcode auth model
-- with email + password and an account record per customer.
--
-- Apply by hitting /api/beacons/auth/me once after deploy — the auth lib calls
-- ensureTenantsTable() lazily on every cold start. This file documents the
-- final shape.

CREATE TABLE IF NOT EXISTS beacons_tenants (
  id              TEXT PRIMARY KEY,                            -- short uid, e.g. 'pete' or 't_xxxx'
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,                               -- bcrypt
  display_name    TEXT,
  tier            TEXT NOT NULL DEFAULT 'basic',               -- 'pete' | 'basic' | 'pro' | 'premium'
  allocation_pct  INTEGER NOT NULL DEFAULT 100,                -- % of global monthly cap (0-100)
  settings        JSONB NOT NULL DEFAULT '{}'::jsonb,          -- { web_search_enabled, ... }
  is_admin        BOOLEAN NOT NULL DEFAULT FALSE,              -- admin can create new tenants
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beacons_tenants_email ON beacons_tenants (email);
CREATE INDEX IF NOT EXISTS idx_beacons_tenants_tier  ON beacons_tenants (tier);

-- Default tier prices (in $/mo) live in /lib/auth.js TIERS map. Keep in sync
-- when you add tiers.
