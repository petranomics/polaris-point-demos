// /api/beacon-trial-setup.js — Add trial + referral schema
// Run once: GET /api/beacon-trial-setup
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const sql = neon(process.env.DATABASE_URL);

  try {
    // Ensure client columns exist first (from earlier migration)
    await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS client_name TEXT`;
    await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS client_email TEXT`;
    await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS client_password_hash TEXT`;

    // Add trial + referral columns to beacon_subscriptions
    await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS billing_term TEXT DEFAULT 'monthly'`;
    await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP`;
    await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS read_only_until TIMESTAMP`;
    await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS delete_after TIMESTAMP`;
    await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE`;
    await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS referred_by_code TEXT`;
    await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS free_months_earned INTEGER DEFAULT 0`;
    await sql`ALTER TABLE beacon_subscriptions ADD COLUMN IF NOT EXISTS enterprise_seats INTEGER DEFAULT 1`;

    // Referrals tracking table
    await sql`
      CREATE TABLE IF NOT EXISTS beacon_referrals (
        id SERIAL PRIMARY KEY,
        referrer_subscription_id INTEGER REFERENCES beacon_subscriptions(id) ON DELETE CASCADE,
        referee_subscription_id INTEGER REFERENCES beacon_subscriptions(id) ON DELETE CASCADE,
        referral_code TEXT,
        free_month_awarded BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Trial codes (custom codes admin can issue for beta/enterprise trials)
    await sql`
      CREATE TABLE IF NOT EXISTS beacon_trial_codes (
        id SERIAL PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        tier TEXT DEFAULT 'lite',
        trial_weeks INTEGER DEFAULT 6,
        max_uses INTEGER DEFAULT 1,
        times_used INTEGER DEFAULT 0,
        notes TEXT,
        industry TEXT DEFAULT 'general',
        created_by TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP
      )
    `;

    // Email log (for trial expiration sequence — will send once email infra is connected)
    await sql`
      CREATE TABLE IF NOT EXISTS beacon_emails (
        id SERIAL PRIMARY KEY,
        subscription_id INTEGER REFERENCES beacon_subscriptions(id) ON DELETE CASCADE,
        email_type TEXT NOT NULL,
        subject TEXT,
        body TEXT,
        recipient TEXT,
        status TEXT DEFAULT 'pending',
        sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_beacon_refcode ON beacon_subscriptions(referral_code)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_beacon_trial_code ON beacon_trial_codes(code)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_beacon_emails_status ON beacon_emails(status)`;

    // Backfill referral codes for existing subscriptions that don't have one
    var existing = await sql`SELECT id, client_name FROM beacon_subscriptions WHERE referral_code IS NULL`;
    for (var i = 0; i < existing.length; i++) {
      var name = (existing[i].client_name || 'user').toUpperCase().replace(/[^A-Z]/g, '').substring(0, 6) || 'USER';
      var code = name + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      try {
        await sql`UPDATE beacon_subscriptions SET referral_code = ${code} WHERE id = ${existing[i].id}`;
      } catch (e) { /* collision, skip */ }
    }

    return res.status(200).json({
      success: true,
      message: 'Trial + referral schema ready',
      backfilled_codes: existing.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
