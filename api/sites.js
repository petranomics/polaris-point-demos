// /api/sites.js — Site registry CRUD + analytics check
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    // GET /api/sites?check-analytics=SLUG — lightweight analytics check
    if (req.method === 'GET' && req.query['check-analytics']) {
      var slug = req.query['check-analytics'];
      var rows = await sql`SELECT analytics_enabled FROM sites WHERE slug = ${slug} AND status = 'active'`;
      if (!rows.length) return res.status(200).json({ enabled: true }); // default to enabled if not registered
      return res.status(200).json({ enabled: rows[0].analytics_enabled });
    }

    // GET /api/sites — list sites
    if (req.method === 'GET') {
      var owner = req.query.owner;
      var slug = req.query.slug;
      if (slug) {
        var rows = await sql`SELECT * FROM sites WHERE slug = ${slug}`;
        return res.status(200).json({ site: rows[0] || null });
      }
      if (owner) {
        var rows = await sql`SELECT * FROM sites WHERE owner = ${owner} ORDER BY created_at DESC`;
        return res.status(200).json({ sites: rows });
      }
      var rows = await sql`SELECT * FROM sites ORDER BY created_at DESC`;
      return res.status(200).json({ sites: rows });
    }

    // POST /api/sites — register new site
    if (req.method === 'POST') {
      var b = req.body;
      if (!b || !b.site_name || !b.slug) return res.status(400).json({ error: 'site_name and slug required' });
      var result = await sql`
        INSERT INTO sites (site_name, slug, template, domain, vercel_url, repo_url, status, analytics_enabled, hosting_plan, monthly_revenue, owner, notes, admin_password_hash, site_config)
        VALUES (${b.site_name}, ${b.slug}, ${b.template || 'plumber'}, ${b.domain || ''}, ${b.vercel_url || ''},
          ${b.repo_url || ''}, ${b.status || 'active'}, ${b.analytics_enabled !== false}, ${b.hosting_plan || 'starter'},
          ${b.monthly_revenue || 0}, ${b.owner || ''}, ${b.notes || ''},
          ${b.admin_password_hash || null}, ${b.site_config ? JSON.stringify(b.site_config) : null}::jsonb)
        ON CONFLICT (slug) DO UPDATE SET
          site_name = EXCLUDED.site_name, domain = COALESCE(EXCLUDED.domain, sites.domain),
          vercel_url = COALESCE(EXCLUDED.vercel_url, sites.vercel_url), repo_url = COALESCE(EXCLUDED.repo_url, sites.repo_url),
          admin_password_hash = COALESCE(EXCLUDED.admin_password_hash, sites.admin_password_hash),
          site_config = COALESCE(EXCLUDED.site_config, sites.site_config),
          config_updated_at = NOW(), updated_at = NOW()
        RETURNING *
      `;
      return res.status(201).json({ site: result[0] });
    }

    // PUT /api/sites?id=x — update site
    if (req.method === 'PUT') {
      var id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id required' });
      var b = req.body;

      // Automation patch — flips Business Automation feature flags and saves
      // the automation settings (Calendly URL, review URL, greeting) INSIDE
      // site_config (read-modify-write of the JSONB). The ops toggles and
      // shared/automation.js both read from here.
      if (b.automation) {
        var curRows = await sql`SELECT site_config FROM sites WHERE id = ${id}`;
        if (!curRows.length) return res.status(404).json({ error: 'Site not found' });
        var cfg = curRows[0].site_config || {};
        if (typeof cfg === 'string') { try { cfg = JSON.parse(cfg); } catch (e) { cfg = {}; } }
        cfg.features = Object.assign({}, cfg.features, b.automation.features || {});
        cfg.automation = Object.assign({}, cfg.automation, b.automation.config || {});
        var saved = await sql`
          UPDATE sites
          SET site_config = ${JSON.stringify(cfg)}::jsonb,
              config_updated_at = NOW(),
              updated_at = NOW()
          WHERE id = ${id}
          RETURNING id
        `;
        if (!saved.length) return res.status(404).json({ error: 'Site not found' });
        return res.status(200).json({ ok: true });
      }

      var result = await sql`
        UPDATE sites SET
          site_name = COALESCE(${b.site_name || null}, site_name),
          domain = COALESCE(${b.domain || null}, domain),
          status = COALESCE(${b.status || null}, status),
          analytics_enabled = COALESCE(${b.analytics_enabled != null ? b.analytics_enabled : null}, analytics_enabled),
          hosting_plan = COALESCE(${b.hosting_plan || null}, hosting_plan),
          monthly_revenue = COALESCE(${b.monthly_revenue != null ? b.monthly_revenue : null}, monthly_revenue),
          owner = COALESCE(${b.owner || null}, owner),
          notes = COALESCE(${b.notes != null ? b.notes : null}, notes),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      if (!result.length) return res.status(404).json({ error: 'Site not found' });
      return res.status(200).json({ site: result[0] });
    }

    // DELETE /api/sites?id=x
    if (req.method === 'DELETE') {
      var id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id required' });
      await sql`DELETE FROM sites WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
