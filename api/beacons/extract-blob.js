// /api/beacons/extract-blob.js — Extract text from a file already uploaded to
// Vercel Blob. Used for files >3MB.
//
// POST { blobUrl, filename, mime? }
//   → { content, extracted, meta, size, chars }
//
// Flow:
//   1. Validate caller's tenant matches the blob's tenant prefix in the URL.
//   2. Fetch the blob bytes (server-side — no inline body cap).
//   3. Run /lib/extract.js routing.
//   4. Delete the blob (we only persist extracted text in items).
//
// Required env: BLOB_READ_WRITE_TOKEN

const { del } = require('@vercel/blob');
const { extractBuffer } = require('../../lib/extract');

function checkAuth(req) {
  const expected = process.env.BEACONS_PASSCODE_HASH;
  if (!expected) return false;
  const got = (req.headers['x-beacons-auth'] || '').toString();
  if (got.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < got.length; i++) mismatch |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

function safeTenant(raw) {
  const t = (raw || 'default').toString().toLowerCase();
  return t.replace(/[^a-z0-9_-]/g, '_').slice(0, 64) || 'default';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth, x-beacons-tenant');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.BEACONS_PASSCODE_HASH) return res.status(500).json({ error: 'BEACONS_PASSCODE_HASH not configured' });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Blob storage not configured.' });
  if (!checkAuth(req)) return res.status(401).json({ error: 'Invalid or missing auth' });

  const body = req.body || {};
  const blobUrl = (body.blobUrl || '').toString();
  const filename = (body.filename || '').toString();
  const mime = (body.mime || '').toString();

  if (!blobUrl) return res.status(400).json({ error: 'Missing blobUrl' });
  if (!/^https:\/\/[^/]*\.public\.blob\.vercel-storage\.com\//.test(blobUrl)) {
    return res.status(400).json({ error: 'blobUrl must be a Vercel Blob public URL' });
  }

  const tenant = safeTenant(req.headers['x-beacons-tenant']);
  const expectedPrefix = `/beacons/${tenant}/`;
  let pathname;
  try { pathname = new URL(blobUrl).pathname; } catch { return res.status(400).json({ error: 'Invalid blobUrl' }); }
  if (!pathname.startsWith(expectedPrefix)) {
    return res.status(403).json({ error: 'Blob does not belong to caller tenant' });
  }

  try {
    const fetchResp = await fetch(blobUrl);
    if (!fetchResp.ok) {
      return res.status(502).json({ error: `Blob fetch failed: ${fetchResp.status}` });
    }
    const contentLength = parseInt(fetchResp.headers.get('content-length') || '0', 10);
    if (contentLength && contentLength > 50 * 1024 * 1024) {
      return res.status(413).json({ error: 'Blob exceeds 50MB extraction cap' });
    }
    const ab = await fetchResp.arrayBuffer();
    const buffer = Buffer.from(ab);

    const result = await extractBuffer(buffer, filename, mime);

    // Delete blob — we only persist extracted text in beacons_items.
    try {
      await del(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN });
    } catch (delErr) {
      console.warn('beacons/extract-blob: del failed (non-fatal)', delErr && delErr.message);
    }

    return res.status(200).json({ extracted: true, ...result });
  } catch (err) {
    console.error('beacons/extract-blob error', err);
    const code = /Unsupported file type/.test(err.message) ? 400 : 500;
    return res.status(code).json({ error: err.message || 'Extraction failed' });
  }
};
