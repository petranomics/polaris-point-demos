// /api/beacons/extract.js — Server-side text extraction for SMALL uploads.
//
// POST  body: { filename, mime?, base64 }
//   - Decodes base64 → Buffer → /lib/extract.js
//   - Returns { content, extracted, meta, size, chars }
//
// Auth: x-beacons-auth (passcode hash) header.
//
// Body cap: Vercel serverless ~4.5MB. Base64 inflates ~33%, so original file
// must be under ~3.3MB. For larger files the client uses /api/beacons/blob-upload-token
// + /api/beacons/extract-blob.

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth, x-beacons-tenant');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.BEACONS_PASSCODE_HASH) return res.status(500).json({ error: 'BEACONS_PASSCODE_HASH not configured' });
  if (!checkAuth(req)) return res.status(401).json({ error: 'Invalid or missing auth' });

  const body = req.body || {};
  const filename = (body.filename || '').toString();
  const mime = (body.mime || '').toString();
  const base64 = (body.base64 || '').toString();
  if (!base64) return res.status(400).json({ error: 'Missing base64 file content' });

  try {
    const buffer = Buffer.from(base64, 'base64');
    const result = await extractBuffer(buffer, filename, mime);
    return res.status(200).json({ extracted: true, ...result });
  } catch (err) {
    console.error('beacons/extract error', err);
    const code = /Unsupported file type/.test(err.message) ? 400 : 500;
    return res.status(code).json({ error: err.message || 'Extraction failed' });
  }
};
