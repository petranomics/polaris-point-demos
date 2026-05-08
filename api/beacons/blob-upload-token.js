// /api/beacons/blob-upload-token.js — Issues scoped client tokens for direct
// browser→Vercel Blob uploads. Used for files >3MB that exceed the serverless
// body cap.
//
// Flow (client side):
//   import { upload } from '@vercel/blob/client'
//   await upload(pathname, file, {
//     access: 'public',
//     handleUploadUrl: '/api/beacons/blob-upload-token',
//     clientPayload: JSON.stringify({ tenant }),
//   });
//
// The Vercel Blob SDK calls THIS endpoint twice: once to mint a token
// (onBeforeGenerateToken), once when upload finishes (onUploadCompleted).
//
// Path scheme: beacons/{tenant}/{yyyy-mm}/{rand}-{safe-filename}
//   - tenant comes from x-beacons-tenant header (default 'default')
//   - server validates the pathname starts with the tenant prefix
//
// Required env: BLOB_READ_WRITE_TOKEN (auto-set when a Blob store is connected)

const { handleUpload } = require('@vercel/blob/client');
const { ALLOWED_MIMES } = require('../../lib/extract');

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
  if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Blob storage not configured. Connect a Blob store in Vercel and set BLOB_READ_WRITE_TOKEN.' });
  if (!checkAuth(req)) return res.status(401).json({ error: 'Invalid or missing auth' });

  const tenant = safeTenant(req.headers['x-beacons-tenant']);
  const expectedPrefix = `beacons/${tenant}/`;

  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error(`Pathname must start with ${expectedPrefix}`);
        }
        return {
          allowedContentTypes: ALLOWED_MIMES,
          maximumSizeInBytes: 50 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ tenant, clientPayload: clientPayload || null })
        };
      },
      onUploadCompleted: async () => {
        // Cleanup hook. We delete blobs in /extract-blob after extraction,
        // so nothing to do here.
      }
    });
    return res.status(200).json(jsonResponse);
  } catch (err) {
    console.error('beacons/blob-upload-token error', err);
    return res.status(400).json({ error: err.message || 'Token generation failed' });
  }
};
