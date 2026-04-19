// /api/config.js — Client site config CRUD
// GET  /api/config?slug=xxx         → Load config from DB (public, cached)
// PUT  /api/config?slug=xxx         → Save config to DB (auth required)
// POST /api/config?action=login     → Verify admin password
var { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var sql = neon(process.env.DATABASE_URL);
  if (!sql) return res.status(500).json({ error: 'Database not configured' });

  var masterHash = process.env.MASTER_ADMIN_HASH || '';

  // ── GET: Load config ──
  if (req.method === 'GET') {
    var slug = req.query.slug;
    if (!slug) return res.status(400).json({ error: 'slug required' });

    try {
      var rows = await sql`
        SELECT site_config, template, site_name, config_updated_at
        FROM sites WHERE slug = ${slug} AND status = 'active'
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'Site not found' });

      var site = rows[0];
      if (!site.site_config) return res.status(404).json({ error: 'No config stored for this site' });

      // Cache for 60 seconds at Vercel edge
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      return res.status(200).json({
        config: site.site_config,
        template: site.template,
        name: site.site_name,
        updated_at: site.config_updated_at
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── POST: Login (verify password) ──
  if (req.method === 'POST') {
    var body = req.body || {};
    var action = req.query.action || body.action;

    if (action === 'login') {
      var slug = body.slug;
      var hash = body.hash;
      if (!slug || !hash) return res.status(400).json({ error: 'slug and hash required' });

      try {
        // Check master password first
        if (masterHash && hash === masterHash) {
          return res.status(200).json({ valid: true, slug: slug, role: 'master' });
        }

        // Check client password
        var rows = await sql`
          SELECT admin_password_hash FROM sites
          WHERE slug = ${slug} AND status = 'active'
        `;
        if (rows.length === 0) return res.status(404).json({ error: 'Site not found' });

        var stored = rows[0].admin_password_hash;
        if (!stored) return res.status(401).json({ valid: false, error: 'No admin password set for this site' });

        if (hash === stored) {
          return res.status(200).json({ valid: true, slug: slug, role: 'client' });
        }

        return res.status(401).json({ valid: false, error: 'Incorrect password' });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: 'Unknown action: ' + action });
  }

  // ── PUT: Save config ──
  if (req.method === 'PUT') {
    var slug = req.query.slug;
    var body = req.body || {};
    var config = body.config;
    var hash = body.hash;

    if (!slug) return res.status(400).json({ error: 'slug required' });
    if (!config) return res.status(400).json({ error: 'config required' });
    if (!hash) return res.status(401).json({ error: 'hash required for authentication' });

    try {
      // Verify password (master or client)
      var authorized = false;

      if (masterHash && hash === masterHash) {
        authorized = true;
      } else {
        var rows = await sql`
          SELECT admin_password_hash FROM sites
          WHERE slug = ${slug} AND status = 'active'
        `;
        if (rows.length === 0) return res.status(404).json({ error: 'Site not found' });
        if (rows[0].admin_password_hash === hash) authorized = true;
      }

      if (!authorized) return res.status(401).json({ error: 'Unauthorized' });

      // Save config
      await sql`
        UPDATE sites
        SET site_config = ${JSON.stringify(config)}::jsonb,
            config_updated_at = NOW(),
            updated_at = NOW()
        WHERE slug = ${slug}
      `;

      return res.status(200).json({ success: true, slug: slug });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
