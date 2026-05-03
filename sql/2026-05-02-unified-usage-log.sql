-- Phase 1 unification: extend beacons_usage_log into a multi-app usage log.
-- Additive only. Existing rows backfilled to app='beacons', provider='anthropic'.
-- Safe to re-run.

ALTER TABLE beacons_usage_log
  ADD COLUMN IF NOT EXISTS app         TEXT,
  ADD COLUMN IF NOT EXISTS endpoint    TEXT,
  ADD COLUMN IF NOT EXISTS provider    TEXT,
  ADD COLUMN IF NOT EXISTS tenant_id   TEXT,
  ADD COLUMN IF NOT EXISTS latency_ms  INTEGER,
  ADD COLUMN IF NOT EXISTS metadata    JSONB;

UPDATE beacons_usage_log
   SET app = 'beacons'
 WHERE app IS NULL;

UPDATE beacons_usage_log
   SET provider = 'anthropic'
 WHERE provider IS NULL;

CREATE INDEX IF NOT EXISTS idx_usage_log_app       ON beacons_usage_log (app, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_log_tenant    ON beacons_usage_log (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_log_provider  ON beacons_usage_log (provider, created_at DESC);
