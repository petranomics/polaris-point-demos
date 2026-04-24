// /api/beacon/subscriptions.js — CRUD Beacon subscriptions
const { neon } = require('@neondatabase/serverless');

const PLAN_LIMITS = { lite: 50000, beacon: 200000, pro: 500000 };

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    // GET — list subscriptions
    if (req.method === 'GET') {
      var siteId = req.query.site_id;
      var slug = req.query.site_slug;
      var rows;

      if (siteId) {
        rows = await sql`
          SELECT bs.*, s.site_name, s.slug, s.domain
          FROM beacon_subscriptions bs
          JOIN sites s ON bs.site_id = s.id
          WHERE bs.site_id = ${siteId}
          ORDER BY bs.created_at DESC
        `;
      } else if (slug) {
        rows = await sql`
          SELECT bs.*, s.site_name, s.slug, s.domain
          FROM beacon_subscriptions bs
          JOIN sites s ON bs.site_id = s.id
          WHERE s.slug = ${slug} AND bs.status = 'active'
          ORDER BY bs.created_at DESC LIMIT 1
        `;
      } else {
        rows = await sql`
          SELECT bs.*, s.site_name, s.slug, s.domain
          FROM beacon_subscriptions bs
          JOIN sites s ON bs.site_id = s.id
          ORDER BY bs.created_at DESC
        `;
      }

      return res.json({ subscriptions: rows });
    }

    // POST — create subscription or login
    if (req.method === 'POST') {
      var body = req.body;

      // Add client auth columns if not exist
      await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS industry TEXT DEFAULT 'general'`;
      await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS client_email TEXT`;
      await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS client_password_hash TEXT`;
      await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS client_name TEXT`;

      // Client login action
      if (req.query.action === 'login') {
        if (!body.email || !body.password_hash) {
          return res.status(400).json({ error: 'Missing email or password' });
        }
        var loginRows = await sql`
          SELECT bs.*, s.site_name, s.slug, s.domain
          FROM beacon_subscriptions bs
          LEFT JOIN sites s ON bs.site_id = s.id
          WHERE bs.client_email = ${body.email}
            AND bs.client_password_hash = ${body.password_hash}
            AND bs.status = 'active'
          ORDER BY bs.created_at DESC LIMIT 1
        `;
        if (!loginRows.length) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }
        return res.json({ subscription: loginRows[0] });
      }

      // Create subscription (allow without site_id for standalone Beacon)
      var plan = body.plan || 'lite';
      var limit = PLAN_LIMITS[plan] || PLAN_LIMITS.lite;
      var industry = body.industry || 'general';

      var result = await sql`
        INSERT INTO beacon_subscriptions (site_id, plan, tokens_limit, status, industry, client_email, client_password_hash, client_name)
        VALUES (${body.site_id || null}, ${plan}, ${limit}, 'active', ${industry}, ${body.client_email || null}, ${body.client_password_hash || null}, ${body.client_name || null})
        RETURNING *
      `;

      // Create scheduled tasks based on plan + industry
      var subId = result[0].id;

      if (industry === 'real_estate') {
        // Real estate task set
        await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
          VALUES (${subId}, 'listing_post', 'weekly', NOW() + INTERVAL '7 days')`;
        await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
          VALUES (${subId}, 'social_post', 'weekly', NOW() + INTERVAL '7 days')`;
        await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
          VALUES (${subId}, 'newsletter', 'monthly', NOW() + INTERVAL '30 days')`;
        await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
          VALUES (${subId}, 'neighborhood_guide', 'monthly', NOW() + INTERVAL '14 days')`;
        await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
          VALUES (${subId}, 'past_client_nurture', 'monthly', NOW() + INTERVAL '30 days')`;

        if (plan === 'beacon' || plan === 'pro') {
          await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
            VALUES (${subId}, 'market_report', 'monthly', NOW() + INTERVAL '30 days')`;
          await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
            VALUES (${subId}, 'competitor_report', 'monthly', NOW() + INTERVAL '30 days')`;
        }
        if (plan === 'pro') {
          await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
            VALUES (${subId}, 'growth_strategy', 'quarterly', NOW() + INTERVAL '90 days')`;
        }
      } else {
        // Default task set (general / local service)
        await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
          VALUES (${subId}, 'social_post', 'weekly', NOW() + INTERVAL '7 days')`;
        await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
          VALUES (${subId}, 'newsletter', 'monthly', NOW() + INTERVAL '30 days')`;
        await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
          VALUES (${subId}, 'blog', 'monthly', NOW() + INTERVAL '14 days')`;

        if (plan === 'beacon' || plan === 'pro') {
          await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
            VALUES (${subId}, 'competitor_report', 'monthly', NOW() + INTERVAL '30 days')`;
        }
        if (plan === 'pro') {
          await sql`INSERT INTO beacon_tasks (subscription_id, task_type, frequency, next_run)
            VALUES (${subId}, 'growth_strategy', 'quarterly', NOW() + INTERVAL '90 days')`;
        }
      }

      return res.json({ subscription: result[0] });
    }

    // PUT — update subscription
    if (req.method === 'PUT') {
      var id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Missing id' });

      var body = req.body;
      var updates = {};

      if (body.plan) {
        updates.plan = body.plan;
        updates.tokens_limit = PLAN_LIMITS[body.plan] || PLAN_LIMITS.lite;
      }
      if (body.status) updates.status = body.status;

      var result = await sql`
        UPDATE beacon_subscriptions
        SET plan = COALESCE(${body.plan || null}, plan),
            tokens_limit = COALESCE(${updates.tokens_limit || null}, tokens_limit),
            status = COALESCE(${body.status || null}, status),
            updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      return res.json({ subscription: result[0] });
    }

    // DELETE — cancel subscription
    if (req.method === 'DELETE') {
      var id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Missing id' });

      await sql`UPDATE beacon_subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = ${id}`;
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
