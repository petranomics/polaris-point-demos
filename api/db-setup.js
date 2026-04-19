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

    // Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'junior',
        email TEXT,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Sites table
    await sql`
      CREATE TABLE IF NOT EXISTS sites (
        id SERIAL PRIMARY KEY,
        site_name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        template TEXT NOT NULL,
        domain TEXT,
        vercel_url TEXT,
        repo_url TEXT,
        deploy_date TIMESTAMP DEFAULT NOW(),
        status TEXT DEFAULT 'active',
        analytics_enabled BOOLEAN DEFAULT true,
        hosting_plan TEXT DEFAULT 'starter',
        monthly_revenue NUMERIC(10,2) DEFAULT 0,
        owner TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Outreach columns (added for outreach pipeline)
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS outreach_status TEXT`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_contacted TIMESTAMP`;
    await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_followup DATE`;

    // Client admin columns (Phase 1: per-client passwords + DB-backed config)
    await sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS admin_password_hash TEXT`;
    await sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS site_config JSONB`;
    await sql`ALTER TABLE sites ADD COLUMN IF NOT EXISTS config_updated_at TIMESTAMP DEFAULT NOW()`;

    // Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_leads_owner ON leads(owner)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_site ON analytics(site)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics(created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sites_slug ON sites(slug)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sites_status ON sites(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sites_owner ON sites(owner)`;

    // Seed senior admins if not exists
    await sql`INSERT INTO users (username, password_hash, full_name, role, email)
      VALUES ('peter@polarispoint.io', '95f81a04b0c59efc5ee2a6e0a9883813d42f7ea6c158aaa44c61e1fd9b14d6bb', 'Pete', 'senior', 'peter@polarispoint.io')
      ON CONFLICT (username) DO NOTHING`;
    await sql`INSERT INTO users (username, password_hash, full_name, role, email)
      VALUES ('michael@polarispoint.io', 'efc916351c52c40befb6072d73de47a2518a5c19dd966407452b2e6eac7ac857', 'Michael', 'senior', 'michael@polarispoint.io')
      ON CONFLICT (username) DO NOTHING`;

    return res.status(200).json({ success: true, message: 'All tables created, senior admins seeded' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
