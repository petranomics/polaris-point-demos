// /api/beacon/billing.js — Stripe Customer Portal for managing subscriptions
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  var stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  const sql = neon(process.env.DATABASE_URL);

  try {
    // GET — billing status for a subscription
    if (req.method === 'GET') {
      var subId = req.query.subscription_id;
      if (!subId) return res.status(400).json({ error: 'Missing subscription_id' });

      var rows = await sql`
        SELECT plan, status, tokens_limit, tokens_used, billing_period_start,
               stripe_subscription_id, stripe_customer_id, created_at
        FROM beacon_subscriptions WHERE id = ${subId}
      `;
      if (!rows.length) return res.status(404).json({ error: 'Subscription not found' });

      var sub = rows[0];
      return res.json({
        plan: sub.plan,
        status: sub.status,
        tokens_used: sub.tokens_used,
        tokens_limit: sub.tokens_limit,
        tokens_pct: Math.round((sub.tokens_used / sub.tokens_limit) * 100),
        billing_period_start: sub.billing_period_start,
        has_stripe: !!sub.stripe_subscription_id
      });
    }

    // POST — create a Stripe Customer Portal session
    if (req.method === 'POST') {
      var body = req.body;
      if (!body.subscription_id) return res.status(400).json({ error: 'Missing subscription_id' });

      var rows = await sql`
        SELECT stripe_customer_id FROM beacon_subscriptions WHERE id = ${body.subscription_id}
      `;
      if (!rows.length || !rows[0].stripe_customer_id) {
        return res.status(400).json({ error: 'No Stripe customer linked' });
      }

      var returnUrl = body.return_url || 'https://polarispoint.io/admin';

      var params = new URLSearchParams();
      params.append('customer', rows[0].stripe_customer_id);
      params.append('return_url', returnUrl);

      var resp = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(stripeKey + ':').toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      var session = await resp.json();
      if (session.error) return res.status(400).json({ error: session.error.message });

      return res.json({ url: session.url });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
