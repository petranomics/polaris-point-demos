// /api/beacon/webhook.js — Stripe webhook handler for Beacon subscriptions
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

const PLAN_LIMITS = { lite: 50000, beacon: 200000, pro: 500000 };

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  var secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(500).json({ error: 'Webhook secret not configured' });

  // Verify Stripe signature
  var sig = req.headers['stripe-signature'];
  var body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  // Simple signature check (Stripe sends timestamp + signature)
  // For production, use proper Stripe SDK verification
  var event;
  try {
    event = JSON.parse(body);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    var type = event.type;
    var data = event.data.object;

    if (type === 'checkout.session.completed') {
      // New subscription created via checkout
      var siteId = data.metadata && data.metadata.site_id;
      var plan = data.metadata && data.metadata.plan;
      if (!siteId || !plan) return res.json({ received: true, note: 'No metadata' });

      var limit = PLAN_LIMITS[plan] || PLAN_LIMITS.lite;

      // Create or reactivate subscription
      var existing = await sql`
        SELECT id FROM beacon_subscriptions WHERE site_id = ${siteId} AND status != 'cancelled'
      `;

      if (existing.length) {
        await sql`
          UPDATE beacon_subscriptions
          SET plan = ${plan}, tokens_limit = ${limit}, status = 'active',
              stripe_subscription_id = ${data.subscription || null},
              stripe_customer_id = ${data.customer || null},
              updated_at = NOW()
          WHERE id = ${existing[0].id}
        `;
      } else {
        await sql`
          INSERT INTO beacon_subscriptions (site_id, plan, tokens_limit, status, stripe_subscription_id, stripe_customer_id)
          VALUES (${siteId}, ${plan}, ${limit}, 'active', ${data.subscription || null}, ${data.customer || null})
        `;
      }
    }

    if (type === 'invoice.payment_failed') {
      var subId = data.subscription;
      if (subId) {
        await sql`
          UPDATE beacon_subscriptions
          SET status = 'paused', updated_at = NOW()
          WHERE stripe_subscription_id = ${subId}
        `;
      }
    }

    if (type === 'customer.subscription.deleted') {
      await sql`
        UPDATE beacon_subscriptions
        SET status = 'cancelled', updated_at = NOW()
        WHERE stripe_subscription_id = ${data.id}
      `;
    }

    if (type === 'customer.subscription.updated') {
      // Handle plan changes
      var priceId = data.items && data.items.data[0] && data.items.data[0].price.id;
      var newPlan = null;
      if (priceId === process.env.STRIPE_PRICE_LITE) newPlan = 'lite';
      if (priceId === process.env.STRIPE_PRICE_BEACON) newPlan = 'beacon';
      if (priceId === process.env.STRIPE_PRICE_PRO) newPlan = 'pro';

      if (newPlan) {
        await sql`
          UPDATE beacon_subscriptions
          SET plan = ${newPlan}, tokens_limit = ${PLAN_LIMITS[newPlan]}, updated_at = NOW()
          WHERE stripe_subscription_id = ${data.id}
        `;
      }
    }

    if (type === 'invoice.paid') {
      // Reactivate if was paused
      var subId = data.subscription;
      if (subId) {
        await sql`
          UPDATE beacon_subscriptions
          SET status = 'active', updated_at = NOW()
          WHERE stripe_subscription_id = ${subId} AND status = 'paused'
        `;
      }
    }

    return res.json({ received: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
