// /api/beacons/google/save-as-doc.js — Create a Google Doc or Sheet from
// Beacon chat output with proper formatting (headings, lists, bold, etc.).
//
// POST  body: { title, text, format? }
//   format: 'doc' (default) | 'sheet'
//   - 'doc'  : markdown → Google Docs API batchUpdate (preserves formatting)
//   - 'sheet': markdown table → CSV → Google Sheet. Refuses if no table
//              is detected (the output isn't tabular).
// Returns { fileId, webViewLink, name, format }
//
// Auth: x-beacons-auth header.

const G = require('../../../lib/google');
const Markdown = require('../../../lib/markdown-to-gdocs');

// Create an empty Drive file of a given Google MIME type. For Docs we
// upload empty content and let Drive create the document, then drive its
// content via the Docs API. For Sheets we still use the multipart CSV
// auto-conversion (Sheets API is heavier; CSV import is fine).
async function createEmptyGoogleDoc(accessToken, name) {
  const resp = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink,mimeType', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.document'
    })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('Drive create (doc) failed: ' + resp.status + ' ' + text.slice(0, 300));
  }
  return resp.json();
}

async function batchUpdateDoc(accessToken, documentId, requests) {
  if (!requests || !requests.length) return;
  const resp = await fetch(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('Docs batchUpdate failed: ' + resp.status + ' ' + text.slice(0, 500));
  }
  return resp.json();
}

// Sheets path stays multipart-CSV (Drive auto-converts).
async function createGoogleSheetFromCsv(accessToken, name, csvBody) {
  const boundary = 'beacons_' + Math.random().toString(36).slice(2);
  const metadata = JSON.stringify({ name, mimeType: 'application/vnd.google-apps.spreadsheet' });
  const multipart =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    metadata + '\r\n' +
    `--${boundary}\r\n` +
    'Content-Type: text/csv; charset=UTF-8\r\n\r\n' +
    csvBody + '\r\n' +
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
    throw new Error('Drive create (sheet) failed: ' + resp.status + ' ' + text.slice(0, 300));
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
  if (!['doc', 'sheet'].includes(format)) {
    return res.status(400).json({ error: 'Unsupported format: ' + format });
  }

  // Default name: short slice of first non-blank line + timestamp.
  const stamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const fallbackTitle = (text.split('\n').find(l => l.trim()) || 'Beacon output')
    .replace(/[#*_`]/g, '') // strip markdown syntax from the title
    .replace(/\s+/g, ' ')
    .slice(0, 70);
  const name = (body.title || fallbackTitle) + ` · ${stamp}`;

  try {
    const accessToken = await G.getValidAccessToken();
    if (!accessToken) return res.status(400).json({ error: 'Google not connected' });

    if (format === 'sheet') {
      // Only meaningful if the output has a markdown table. Otherwise the
      // user gets a wall of text in cell A1. Refuse with a helpful hint.
      const csv = Markdown.markdownTableToCSV(text);
      if (!csv) {
        return res.status(400).json({
          error: 'No table found in output. Save as Doc instead, or ask Beacon to format the data as a markdown table first.'
        });
      }
      const file = await createGoogleSheetFromCsv(accessToken, name, csv);
      return res.status(200).json({
        fileId: file.id,
        name: file.name,
        webViewLink: file.webViewLink,
        mimeType: file.mimeType,
        format: 'sheet'
      });
    }

    // format === 'doc' — formatted Google Doc via Docs API
    const { requests } = Markdown.buildBatchRequests(text);
    const file = await createEmptyGoogleDoc(accessToken, name);
    if (requests.length) {
      try {
        await batchUpdateDoc(accessToken, file.id, requests);
      } catch (e) {
        // Formatting failed — fall back to plain text via Drive media import
        // so the user still gets SOMETHING in their Doc rather than empty.
        console.warn('Docs batchUpdate failed, falling back to plain text:', e.message);
        await batchUpdateDoc(accessToken, file.id, [{
          insertText: { location: { index: 1 }, text: text }
        }]).catch(() => {});
      }
    }
    return res.status(200).json({
      fileId: file.id,
      name: file.name,
      webViewLink: file.webViewLink,
      mimeType: file.mimeType,
      format: 'doc'
    });
  } catch (err) {
    console.error('save-as-doc error', err);
    return res.status(500).json({ error: err.message || 'Save failed' });
  }
};
