// /lib/email.js — Outbound email via Resend.
//
// Send transactional email (welcome, password reset, budget alerts, etc.)
// from a single helper so call sites don't repeat Resend setup.
//
// Required env: RESEND_API_KEY
// Optional env: BEACON_EMAIL_FROM (default: 'onboarding@resend.dev' — Resend's
//               testing address that works without domain verification. Once
//               polarispoint.io is verified in Resend, set this to e.g.
//               'beacon@polarispoint.io')
//
// All functions return a Promise that resolves on success or rejects on
// failure. Callers should swallow failures non-fatally when email is a
// side-effect of a primary action (e.g., signup) — the user shouldn't see an
// account-creation 500 just because the welcome email bounced.

const { Resend } = require('resend');

function client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  return new Resend(key);
}

function fromAddress() {
  const env = (process.env.BEACON_EMAIL_FROM || '').trim();
  if (env) return env;
  return 'Beacon <onboarding@resend.dev>';
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---- Generic sender ------------------------------------------------------

async function sendEmail({ to, subject, html, text, replyTo, tags }) {
  if (!to)      throw new Error('sendEmail: "to" is required');
  if (!subject) throw new Error('sendEmail: "subject" is required');
  if (!html && !text) throw new Error('sendEmail: html or text is required');

  const resend = client();
  const payload = {
    from: fromAddress(),
    to: Array.isArray(to) ? to : [to],
    subject,
    ...(html ? { html } : {}),
    ...(text ? { text } : {}),
    ...(replyTo ? { reply_to: replyTo } : {}),
    ...(tags ? { tags } : {})
  };
  const { data, error } = await resend.emails.send(payload);
  if (error) throw new Error('Resend error: ' + (error.message || JSON.stringify(error)));
  return data; // { id: '...' }
}

// ---- Branded HTML template ----------------------------------------------
// Minimal dark-themed email shell that matches the Beacon UI vibe. Keeps to
// inline styles only — most email clients strip <style>.

function emailShell({ headline, bodyHtml, ctaUrl, ctaText, footnoteHtml }) {
  const cta = ctaUrl && ctaText
    ? `<div style="margin:28px 0">
        <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#5B8DEF;color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:8px;font-size:15px">${escapeHtml(ctaText)}</a>
      </div>`
    : '';
  const foot = footnoteHtml
    ? `<div style="margin-top:32px;padding-top:18px;border-top:1px solid rgba(91,141,239,.15);font-size:12px;color:#94a3b8;line-height:1.5">${footnoteHtml}</div>`
    : '';
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#050D1E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0">
  <div style="max-width:580px;margin:0 auto;padding:32px 28px">
    <div style="font-size:22px;font-weight:700;letter-spacing:.02em;color:#E8C547;margin-bottom:6px">Beacon</div>
    <div style="font-family:'JetBrains Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.18em;color:#94a3b8;margin-bottom:24px">Polaris Point</div>
    <h1 style="font-size:22px;font-weight:600;margin:0 0 16px;color:#e2e8f0;line-height:1.3">${escapeHtml(headline)}</h1>
    <div style="font-size:15px;line-height:1.6;color:#cbd5e1">${bodyHtml}</div>
    ${cta}
    ${foot}
  </div>
</body></html>`;
}

// ---- Welcome email -------------------------------------------------------

async function sendWelcomeEmail({ to, displayName, tempPassword, signinUrl }) {
  const name = displayName || to.split('@')[0];
  const url = signinUrl || 'https://polarispoint.io/beacon';
  const html = emailShell({
    headline: `Welcome to Beacon, ${escapeHtml(name)}.`,
    bodyHtml: `
      <p>Your Beacon account is ready. Sign in with:</p>
      <p style="background:rgba(20,28,45,.5);border:1px solid rgba(91,141,239,.15);border-radius:8px;padding:14px 16px;font-family:'JetBrains Mono',monospace;font-size:13px;color:#e2e8f0">
        Email: <strong>${escapeHtml(to)}</strong><br>
        Temp password: <strong>${escapeHtml(tempPassword)}</strong>
      </p>
      <p>Change the password from Settings after you sign in — that link's only good once.</p>
      <p>The first time you log in, Beacon will ask you a few priming questions (3 minutes, optional). The answers shape how Beacon writes for you, who it considers your audience, and what to avoid. Worth doing once.</p>`,
    ctaUrl: url,
    ctaText: 'Sign in to Beacon',
    footnoteHtml: `If you didn't expect this email, just ignore it — no account is active without you signing in first. Questions? Reply to this email.`
  });
  const text = `Welcome to Beacon, ${name}.

Sign in at ${url}
Email: ${to}
Temp password: ${tempPassword}

Change your password from Settings after signing in.

Reply to this email with any questions.`;
  return sendEmail({ to, subject: 'Welcome to Beacon', html, text, replyTo: 'peter@polarispoint.io' });
}

// ---- Password reset email ------------------------------------------------

async function sendPasswordResetEmail({ to, displayName, resetUrl, expiresInMinutes }) {
  const name = displayName || to.split('@')[0];
  const expires = expiresInMinutes || 60;
  const html = emailShell({
    headline: `Reset your Beacon password`,
    bodyHtml: `
      <p>Hi ${escapeHtml(name)} — someone (hopefully you) asked to reset the password for <strong>${escapeHtml(to)}</strong>.</p>
      <p>Click the button below to set a new one. The link works once and expires in ${expires} minutes.</p>`,
    ctaUrl: resetUrl,
    ctaText: 'Set a new password',
    footnoteHtml: `If you didn't ask for this, ignore the email — your current password keeps working and no one can use this link without your inbox.`
  });
  const text = `Reset your Beacon password.

If you asked to reset the password for ${to}, open this link to set a new one. It expires in ${expires} minutes.

${resetUrl}

If you didn't ask for this, ignore this email.`;
  return sendEmail({ to, subject: 'Reset your Beacon password', html, text, replyTo: 'peter@polarispoint.io' });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  fromAddress
};
