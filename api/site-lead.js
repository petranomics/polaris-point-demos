// /api/site-lead.js — Visitor inquiry capture + instant auto-reply.
//
// POST { slug, name, email, phone, message } -> { ok }
//
// 1. Stores the inquiry in site_inquiries (separate from the sales `leads`
//    table, which tracks Polaris Point's own prospects).
// 2. Emails the visitor an instant confirmation (auto-reply).
// 3. Notifies the business owner at the site's contact email.
//
// Email is best-effort: a delivery failure never blocks capturing the lead.
//
// Env: DATABASE_URL, RESEND_API_KEY (for email; capture still works without it).

const { neon } = require('@neondatabase/serverless');

let _tableEnsured = false;
async function ensureTable(sql) {
  if (_tableEnsured) return;
  await sql`
    CREATE TABLE IF NOT EXISTS site_inquiries (
      id          BIGSERIAL PRIMARY KEY,
      slug        TEXT NOT NULL,
      name        TEXT,
      email       TEXT,
      phone       TEXT,
      message     TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_site_inquiries_slug ON site_inquiries (slug, created_at DESC)`;
  _tableEnsured = true;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[<>&]/g, function (c) {
    return c === '<' ? '&lt;' : c === '>' ? '&gt;' : '&amp;';
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' });

  var body = req.body || {};
  var slug = (body.slug || '').toString().trim();
  var email = (body.email || '').toString().trim();
  var name = (body.name || '').toString().trim();
  var phone = (body.phone || '').toString().trim();
  var message = (body.message || '').toString().trim().slice(0, 4000);
  if (!slug) return res.status(400).json({ error: 'slug required' });
  if (!email) return res.status(400).json({ error: 'email required' });

  var sql = neon(process.env.DATABASE_URL);

  // Load the site config for business name + owner contact + auto-reply copy.
  var cfg = {};
  try {
    var rows = await sql`SELECT site_config FROM sites WHERE slug = ${slug} AND status = 'active'`;
    if (rows.length && rows[0].site_config) {
      cfg = typeof rows[0].site_config === 'string' ? JSON.parse(rows[0].site_config) : rows[0].site_config;
    }
  } catch (e) { /* fall back to bare capture */ }

  // 1) Store the inquiry (this is the part that must not fail silently).
  try {
    await ensureTable(sql);
    await sql`
      INSERT INTO site_inquiries (slug, name, email, phone, message)
      VALUES (${slug}, ${name}, ${email}, ${phone}, ${message})
    `;
  } catch (err) {
    return res.status(500).json({ error: 'Could not save inquiry: ' + err.message });
  }

  // 2) + 3) Email — best-effort, never blocks the 200.
  var businessName = cfg.businessName || cfg.businessNameShort || 'the team';
  var ar = (cfg.automation && cfg.automation.leadAutoReply) || {};
  var ownerEmail = cfg.email || '';
  try {
    var Email = require('../lib/email');
    if (Email && typeof Email.sendEmail === 'function' && process.env.RESEND_API_KEY) {
      var replyText = ar.replyText ||
        ('Thanks for reaching out to ' + businessName + '! We received your message and will get back to you shortly. ' +
         'If it\'s urgent, feel free to call us.');
      // Visitor auto-reply
      await Email.sendEmail({
        to: email,
        subject: 'Thanks for contacting ' + businessName,
        replyTo: ownerEmail || undefined,
        text: replyText,
        html: '<p>' + esc(replyText) + '</p>' +
              (cfg.phone ? '<p>Phone: ' + esc(cfg.phone) + '</p>' : '') +
              '<p style="color:#888;font-size:12px">This is an automated confirmation.</p>'
      }).catch(function () {});
      // Owner notification
      if (ownerEmail) {
        await Email.sendEmail({
          to: ownerEmail,
          subject: 'New website inquiry from ' + (name || email),
          replyTo: email,
          text: 'New inquiry via your website:\n\nName: ' + name + '\nEmail: ' + email +
                '\nPhone: ' + phone + '\n\nMessage:\n' + message,
          html: '<h3>New website inquiry</h3>' +
                '<p><b>Name:</b> ' + esc(name) + '<br><b>Email:</b> ' + esc(email) +
                '<br><b>Phone:</b> ' + esc(phone) + '</p>' +
                '<p><b>Message:</b><br>' + esc(message).replace(/\n/g, '<br>') + '</p>'
        }).catch(function () {});
      }
    }
  } catch (e) { /* email is non-fatal */ }

  return res.status(200).json({ ok: true });
};
