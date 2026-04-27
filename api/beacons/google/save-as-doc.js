// /api/beacons/google/save-as-doc.js — Create a Google Doc from chat output.
//
// POST  body: { title, text, format? }
//   format: 'doc' (default) | 'sheet'
//   - 'doc' : text/plain → Drive creates a Google Doc
//   - 'sheet': text/csv → Drive creates a Google Sheet
//   Returns { fileId, webViewLink, name, format }
//
// Auth: x-beacons-auth header.

const G = require('../../../lib/google');

const FORMAT_MAP = {
  doc: {
    contentType: 'text/plain',
    googleMime: 'application/vnd.google-apps.document'
  },
  sheet: {
    contentType: 'text/csv',
    googleMime: 'application/vnd.google-apps.spreadsheet'
  }
};

async function createGoogleFile(accessToken, { name, contentType, googleMime, body }) {
  // Drive multipart upload: metadata + content body in one request. Drive
  // auto-converts text/plain → Doc, text/csv → Sheet via the metadata mime.
  const boundary = 'beacons_' + Math.random().toString(36).slice(2);
  const metadata = JSON.stringify({ name, mimeType: googleMime });

  const multipart =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata + '\r\n' +
    `--${boundary}\r\n` +
    `Content-Type: ${contentType}; charset=UTF-8\r\n\r\n` +
    body + '\r\n' +
    `--${boundary}--`;

  const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'multipart/related; boundary=' + boundary
    },
    body: multipart
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('Drive create failed: ' + resp.status + ' ' + text.slice(0, 300));
  }
  return resp.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!G.checkBeaconsAuth(req)) return res.status(401).json({ error: 'Invalid auth' });
  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' });

  const body = req.body || {};
  const text = (body.text || '').toString();
  if (!text.trim()) return res.status(400).json({ error: 'Missing text' });
  const format = (body.format || 'doc').toString();
  if (!FORMAT_MAP[format]) return res.status(400).json({ error: 'Unsupported format: ' + format });

  // Default name: short slice of the text + a timestamp.
  const stamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const fallbackTitle = (text.split('\n').find(l => l.trim()) || 'Beacon output')
    .replace(/\s+/g, ' ')
    .slice(0, 70);
  const name = (body.title || fallbackTitle) + ` · ${stamp}`;

  try {
    const accessToken = await G.getValidAccessToken();
    if (!accessToken) return res.status(400).json({ error: 'Google not connected' });

    const cfg = FORMAT_MAP[format];
    const file = await createGoogleFile(accessToken, {
      name,
      contentType: cfg.contentType,
      googleMime: cfg.googleMime,
      body: text
    });

    return res.status(200).json({
      fileId: file.id,
      name: file.name,
      webViewLink: file.webViewLink,
      mimeType: file.mimeType,
      format
    });
  } catch (err) {
    console.error('save-as-doc error', err);
    return res.status(500).json({ error: err.message || 'Save failed' });
  }
};
