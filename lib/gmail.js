// /lib/gmail.js — Gmail API helpers for Beacons.
//
// Uses the access token from /lib/google.js (auto-refreshed). Pulls thread
// lists + full threads, parses headers + body, formats as plain text for
// the library.

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function gmailFetch(accessToken, path, init) {
  const url = path.startsWith('http') ? path : (GMAIL_BASE + path);
  const resp = await fetch(url, {
    ...(init || {}),
    headers: {
      Authorization: 'Bearer ' + accessToken,
      ...((init && init.headers) || {})
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('Gmail API ' + resp.status + ' on ' + path + ': ' + text.slice(0, 300));
  }
  return resp.json();
}

async function getProfile(accessToken) {
  return gmailFetch(accessToken, '/profile');
}

// q syntax: https://support.google.com/mail/answer/7190
// Default: skip Promotions/Social/Updates/Forums, skip spam/trash.
const DEFAULT_Q = '-category:promotions -category:social -category:updates -category:forums -in:spam -in:trash';

async function listThreads(accessToken, { q, maxResults, pageToken } = {}) {
  const params = new URLSearchParams();
  params.set('q', q || DEFAULT_Q);
  params.set('maxResults', String(maxResults || 100));
  if (pageToken) params.set('pageToken', pageToken);
  return gmailFetch(accessToken, '/threads?' + params.toString());
}

async function getThread(accessToken, threadId) {
  return gmailFetch(accessToken, '/threads/' + encodeURIComponent(threadId) + '?format=full');
}

// ---- Body extraction ----

function decodeBase64Url(data) {
  if (!data) return '';
  // Gmail uses URL-safe base64
  const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
  // Pad to multiple of 4
  const padded = b64 + '==='.slice((b64.length + 3) % 4);
  try {
    return Buffer.from(padded, 'base64').toString('utf8');
  } catch (e) {
    return '';
  }
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|tr|br|hr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Walk payload tree to find best text body. Prefer text/plain; fall back to
// stripped text/html.
function extractBody(payload) {
  if (!payload) return '';

  // Direct body on this part
  const here = (mime) => {
    if (payload.mimeType === mime && payload.body && payload.body.data) {
      return decodeBase64Url(payload.body.data);
    }
    return null;
  };

  // 1) prefer text/plain at this level
  const plain = here('text/plain');
  if (plain) return plain;

  // 2) walk parts looking for plain
  const parts = payload.parts || [];
  for (const p of parts) {
    const nestedPlain = extractBody(p);
    if (nestedPlain && p.mimeType === 'text/plain') return nestedPlain;
  }
  for (const p of parts) {
    if (p.mimeType === 'text/plain' && p.body && p.body.data) {
      return decodeBase64Url(p.body.data);
    }
  }

  // 3) try multipart/alternative recursion
  for (const p of parts) {
    if (p.mimeType && p.mimeType.startsWith('multipart/')) {
      const nested = extractBody(p);
      if (nested) return nested;
    }
  }

  // 4) fall back to text/html stripped
  const html = here('text/html');
  if (html) return stripHtml(html);
  for (const p of parts) {
    if (p.mimeType === 'text/html' && p.body && p.body.data) {
      return stripHtml(decodeBase64Url(p.body.data));
    }
  }

  return '';
}

function getHeader(headers, name) {
  if (!headers) return '';
  const lc = name.toLowerCase();
  const found = headers.find(h => h.name.toLowerCase() === lc);
  return found ? found.value : '';
}

// Format an entire thread as a single text block we can drop into the library.
function formatThread(thread) {
  const messages = thread.messages || [];
  if (!messages.length) return { title: '(empty thread)', body: '', date: null, subject: '' };

  const firstHeaders = (messages[0].payload || {}).headers;
  const subject = getHeader(firstHeaders, 'Subject') || '(no subject)';

  const blocks = messages.map((m, i) => {
    const h = (m.payload || {}).headers;
    const from = getHeader(h, 'From');
    const to = getHeader(h, 'To');
    const date = getHeader(h, 'Date');
    const body = extractBody(m.payload).trim();
    const header = [
      `[Message ${i + 1}]`,
      from ? `From: ${from}` : null,
      to ? `To: ${to}` : null,
      date ? `Date: ${date}` : null
    ].filter(Boolean).join('\n');
    return header + '\n\n' + body;
  });

  const lastDateHeader = getHeader((messages[messages.length - 1].payload || {}).headers, 'Date');
  const date = lastDateHeader ? new Date(lastDateHeader).toISOString() : null;

  return {
    title: subject,
    body: blocks.join('\n\n---\n\n'),
    date,
    subject,
    messageCount: messages.length,
    threadId: thread.id
  };
}

module.exports = {
  getProfile,
  listThreads,
  getThread,
  formatThread,
  DEFAULT_Q
};
