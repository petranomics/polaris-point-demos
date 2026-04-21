// /api/beacon/checkout.js — Create Stripe Checkout session for Beacon subscription
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  var stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return res.status(500).json({ error: 'Stripe not configured' });

  var priceMap = {
    lite: process.env.STRIPE_PRICE_LITE,
    beacon: process.env.STRIPE_PRICE_BEACON,
    pro: process.env.STRIPE_PRICE_PRO
  };

  try {
    var body = req.body;
    if (!body.site_id || !body.plan) {
      return res.status(400).json({ error: 'Missing site_id or plan' });
    }

    var priceId = priceMap[body.plan];
    if (!priceId) return res.status(400).json({ error: 'Invalid plan: ' + body.plan });

    var returnUrl = body.return_url || 'https://polarispoint.io/admin';

    // Create Stripe Checkout Session via API (no SDK, keep it lightweight)
    var params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('success_url', returnUrl + '?beacon_success=1&site_id=' + body.site_id);
    params.append('cancel_url', returnUrl + '?beacon_cancel=1');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('metadata[site_id]', body.site_id);
    params.append('metadata[plan]', body.plan);
    if (body.customer_email) params.append('customer_email', body.customer_email);

    var resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(stripeKey + ':').toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    var session = await resp.json();
    if (session.error) return res.status(400).json({ error: session.error.message });

    return res.json({ url: session.url, session_id: session.id });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
