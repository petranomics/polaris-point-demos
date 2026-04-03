// /api/db-setup.js — One-time database table creation
// Usage: GET /api/db-setup (run once, then delete or disable)
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Leads table
    await sql`
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        biz_name TEXT NOT NULL,
        industry TEXT,
        address TEXT,
        website TEXT,
        rating TEXT,
        years_in_biz TEXT,
        contact TEXT,
        contact_role TEXT,
        phone TEXT,
        email TEXT,
        contact_method TEXT,
        best_time TEXT,
        rank TEXT DEFAULT 'warm',
        tier TEXT DEFAULT 'undecided',
        source TEXT,
        revenue TEXT,
        listing_url TEXT,
        stage INTEGER DEFAULT 0,
        notes TEXT,
        owner TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Analytics events table
    await sql`
      CREATE TABLE IF NOT EXISTS analytics (
        id SERIAL PRIMARY KEY,
        site TEXT NOT NULL,
        event TEXT NOT NULL DEFAULT 'pageview',
        path TEXT,
        referrer TEXT,
        user_agent TEXT,
        ip TEXT,
        country TEXT,
        session_id TEXT,
        meta JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_site ON analytics(site)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics(created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event)`;

    return res.status(200).json({ success: true, message: 'Tables created' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
