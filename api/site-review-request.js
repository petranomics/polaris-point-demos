// /api/site-review-request.js — Automated review-request emails.
//
// Two modes on one path:
//   POST { slug, customerEmail, customerName?, serviceName?, delayDays? }
//        -> enqueue a review request, scheduled for now + delayDays
//        (delayDays falls back to the site's automation.reviewRequest.delayDays,
//         then 3). Trigger this when a job/booking is marked complete — from
//         ops/admin, or after a Calendly event, or via an API call.
//
//   GET  (Vercel cron) -> send all due, unsent requests and mark them sent.
//        Protected by CRON_SECRET when set (Vercel sends it as a Bearer token).
//
// Env: DATABASE_URL, RESEND_API_KEY, optional CRON_SECRET.

const { neon } = require('@neondatabase/serverless');

let _tableEnsured = false;
async function ensureTable(sql) {
  if (_tableEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS site_review_requests (
      id            BIGSERIAL PRIMARY KEY,
      slug          TEXT NOT NULL,
      customer_name TEXT,
      customer_email TEXT NOT NULL,
      service_name  TEXT,
      send_after    TIMESTAMPTZ NOT NULL,
      sent_at       TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_review_req_due ON site_review_requests (send_after) WHERE sent_at IS NULL`;
  _tableEnsured = true;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[<>&]/g, function (c) {
    return c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;';
  });
}

async function loadConfig(sql, slug) {
  try {
    var rows = await sql`SELECT site_config FROM sites WHERE slug = ${slug} AND status = 'active'`;
    if (rows.length && rows[0].site_config) {
      return typeof rows[0].site_config === 'string' ? JSON.parse(rows[0].site_config) : rows[0].site_config;
    }
  } catch (e) { /* ignore */ }
  return {};
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' });

  var sql = neon(process.env.DATABASE_URL);

  // ── POST: enqueue a request ──
  if (req.method === 'POST') {
    var body = req.body || {};
    var slug = (body.slug || '').toString().trim();
    var customerEmail = (body.customerEmail || '').toString().trim();
    if (!slug) return res.status(400).json({ error: 'slug required' });
    if (!customerEmail) return res.status(400).json({ error: 'customerEmail required' });

    var cfg = await loadConfig(sql, slug);
    var rr = (cfg.automation && cfg.automation.reviewRequest) || {};
    var delayDays = Number(body.delayDays);
    if (!isFinite(delayDays) || delayDays < 0) delayDays = Number(rr.delayDays);
    if (!isFinite(delayDays) || delayDays < 0) delayDays = 3;
    var sendAfter = new Date(Date.now() + delayDays * 86400000);

    try {
      await ensureTable(sql);
      await sql`
        INSERT INTO site_review_requests (slug, customer_name, customer_email, service_name, send_after)
        VALUES (${slug}, ${(body.customerName || '').toString()}, ${customerEmail},
                ${(body.serviceName || '').toString()}, ${sendAfter.toISOString()})
      `;
    } catch (err) {
      return res.status(500).json({ error: 'Could not enqueue: ' + err.message });
    }
    return res.status(200).json({ ok: true, scheduledFor: sendAfter.toISOString() });
  }

  // ── GET: cron processes due requests ──
  if (req.method === 'GET') {
    if (process.env.CRON_SECRET) {
      var auth = req.headers['authorization'] || '';
      if (auth !== 'Bearer ' + process.env.CRON_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    var due = [];
    try {
      await ensureTable(sql);
      due = await sql`
        SELECT id, slug, customer_name, customer_email, service_name
        FROM site_review_requests
        WHERE sent_at IS NULL AND send_after <= NOW()
        ORDER BY send_after ASC
        LIMIT 100
      `;
    } catch (err) {
      return res.status(500).json({ error: 'Query failed: ' + err.message });
    }
    if (!due.length) return res.status(200).json({ ok: true, sent: 0 });

    var Email = null;
    try { Email = require('../lib/email'); } catch (e) { /* */ }
    if (!Email || !process.env.RESEND_API_KEY) {
      return res.status(200).json({ ok: true, sent: 0, note: 'Email not configured; requests left pending' });
    }

    var cfgCache = {};
    var sent = 0;
    for (var i = 0; i < due.length; i++) {
      var r = due[i];
      if (!cfgCache[r.slug]) cfgCache[r.slug] = await loadConfig(sql, r.slug);
      var cfg = cfgCache[r.slug];
      var rr = (cfg.automation && cfg.automation.reviewRequest) || {};
      var businessName = cfg.businessName || cfg.businessNameShort || 'us';
      var reviewUrl = rr.reviewUrl || '';
      var first = (r.customer_name || '').split(' ')[0] || 'there';
      var bodyText = 'Hi ' + first + ',\n\nThanks for choosing ' + businessName +
        (r.service_name ? ' for your ' + r.service_name : '') + '! ' +
        'We\'d be grateful if you could take a moment to leave us a review — it really helps.' +
        (reviewUrl ? '\n\nLeave a review: ' + reviewUrl : '') +
        '\n\nThank you,\n' + businessName;
      try {
        await Email.sendEmail({
          to: r.customer_email,
          replyTo: cfg.email || undefined,
          subject: 'How did we do? — ' + businessName,
          text: bodyText,
          html: '<p>Hi ' + esc(first) + ',</p>' +
                '<p>Thanks for choosing <b>' + esc(businessName) + '</b>' +
                (r.service_name ? ' for your ' + esc(r.service_name) : '') +
                '! We\'d be grateful if you could leave us a quick review — it really helps.</p>' +
                (reviewUrl ? '<p><a href="' + esc(reviewUrl) + '" style="background:#5B8DEF;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Leave a review</a></p>' : '') +
                '<p>Thank you,<br>' + esc(businessName) + '</p>'
        });
        await sql`UPDATE site_review_requests SET sent_at = NOW() WHERE id = ${r.id}`;
        sent++;
      } catch (e) { /* leave pending; retry next run */ }
    }
    return res.status(200).json({ ok: true, sent: sent, due: due.length });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
};
