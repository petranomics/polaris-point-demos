// /api/beacons/settings.js — Read/update tenant-level settings.
//
// GET → { settings, tenant_summary }
//   Used by the settings modal on load.
//
// PUT { settings: { web_search_enabled?: bool, ... } } → { settings }
//   Merges into existing settings JSONB. Only known keys are accepted —
//   unknown keys are silently dropped to keep the schema clean.

const { neon } = require('@neondatabase/serverless');
const Auth = require('../../lib/auth');
const Budget = require('../../lib/budget');
const Pricing = require('../../lib/pricing');

const ALLOWED_SETTINGS_KEYS = ['web_search_enabled', 'onboarded'];

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!process.env.DATABASE_URL)       return res.status(500).json({ error: 'DATABASE_URL not configured' });
  if (!process.env.BEACONS_JWT_SECRET) return res.status(500).json({ error: 'BEACONS_JWT_SECRET not configured' });

  const tenant = await Auth.resolveTenant(req);
  if (!tenant) return res.status(401).json({ error: 'Not authenticated' });

  if (req.method === 'GET') {
    let budgetState = null;
    try {
      const sql = neon(process.env.DATABASE_URL);
      await Pricing.ensureUsageTable(sql);
      budgetState = await Budget.checkBudget(sql, tenant);
    } catch (e) {
      console.warn('budget lookup failed (non-fatal):', e.message);
    }
    return res.status(200).json({
      settings: Auth.effectiveSettings(tenant),
      tenant_summary: Auth.publicTenant(tenant),
      budget: budgetState
    });
  }

  if (req.method === 'PUT') {
    const incoming = (req.body && req.body.settings) || {};
    const merged = { ...(tenant.settings || {}) };
    for (const k of ALLOWED_SETTINGS_KEYS) {
      if (Object.prototype.hasOwnProperty.call(incoming, k)) {
        merged[k] = incoming[k];
      }
    }
    const sql = neon(process.env.DATABASE_URL);
    await sql`
      UPDATE beacons_tenants
         SET settings = ${JSON.stringify(merged)}::jsonb, updated_at = NOW()
       WHERE id = ${tenant.id}
    `;
    const updated = await Auth.findTenantById(sql, tenant.id);
    let budgetState = null;
    try { budgetState = await Budget.checkBudget(sql, updated); }
    catch (e) { console.warn('budget lookup failed:', e.message); }
    return res.status(200).json({
      settings: Auth.effectiveSettings(updated),
      tenant_summary: Auth.publicTenant(updated),
      budget: budgetState
    });
  }

  res.setHeader('Allow', 'GET, PUT, OPTIONS');
  return res.status(405).json({ error: 'Method not allowed' });
};
