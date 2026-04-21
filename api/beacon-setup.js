// /api/beacon-setup.js — One-time Beacon table creation
// Usage: GET /api/beacon-setup (run once to add Beacon tables to Neon)
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const sql = neon(process.env.DATABASE_URL);

  try {
    // Beacon subscriptions
    await sql`
      CREATE TABLE IF NOT EXISTS beacon_subscriptions (
        id SERIAL PRIMARY KEY,
        site_id INTEGER REFERENCES sites(id),
        plan TEXT NOT NULL DEFAULT 'lite',
        status TEXT NOT NULL DEFAULT 'active',
        tokens_limit INTEGER NOT NULL DEFAULT 50000,
        tokens_used INTEGER NOT NULL DEFAULT 0,
        billing_period_start DATE DEFAULT CURRENT_DATE,
        stripe_subscription_id TEXT,
        stripe_customer_id TEXT,
        model_override TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Context documents (business info, website scrapes, brand voice, custom prompts)
    await sql`
      CREATE TABLE IF NOT EXISTS beacon_context (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER REFERENCES beacon_subscriptions(id) ON DELETE CASCADE,
        context_type TEXT NOT NULL,
        title TEXT,
        content TEXT NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Scheduled tasks (social posts, newsletters, competitor reports, etc.)
    await sql`
      CREATE TABLE IF NOT EXISTS beacon_tasks (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER REFERENCES beacon_subscriptions(id) ON DELETE CASCADE,
        task_type TEXT NOT NULL,
        frequency TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        last_run TIMESTAMP,
        next_run TIMESTAMP,
        last_output TEXT,
        config JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Chat messages
    await sql`
      CREATE TABLE IF NOT EXISTS beacon_messages (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER REFERENCES beacon_subscriptions(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tokens_used INTEGER DEFAULT 0,
        model TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Monitoring targets (competitors, review sites, keywords)
    await sql`
      CREATE TABLE IF NOT EXISTS beacon_monitoring (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER REFERENCES beacon_subscriptions(id) ON DELETE CASCADE,
        monitor_type TEXT NOT NULL,
        target_url TEXT,
        target_name TEXT,
        last_summary TEXT,
        last_check TIMESTAMP,
        config JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_beacon_sub_site ON beacon_subscriptions(site_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_beacon_sub_status ON beacon_subscriptions(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_beacon_ctx_sub ON beacon_context(subscription_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_beacon_tasks_next ON beacon_tasks(next_run)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_beacon_tasks_sub ON beacon_tasks(subscription_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_beacon_msg_sub ON beacon_messages(subscription_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_beacon_msg_created ON beacon_messages(created_at)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_beacon_mon_sub ON beacon_monitoring(subscription_id)`;

    return res.status(200).json({ success: true, message: 'Beacon tables created' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
