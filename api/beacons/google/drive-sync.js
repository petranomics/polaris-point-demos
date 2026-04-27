// /api/beacons/google/drive-sync.js — Pull files from the dedicated Google
// Drive into the library. Same dual-auth (user via x-beacons-auth, cron via
// CRON_SECRET) and idempotent-by-id (gdrive_<fileId>) pattern as Gmail sync.

const { neon } = require('@neondatabase/serverless');
const G = require('../../../lib/google');
const D = require('../../../lib/drive');

const MAX_FILES_PER_RUN = 30;
const MAX_BYTES = 5 * 1024 * 1024; // skip files > 5MB to avoid blowing function limits

function checkCronAuth(req) {
  if (!process.env.CRON_SECRET) return false;
  return (req.headers.authorization || '') === 'Bearer ' + process.env.CRON_SECRET;
}

async function ensureSyncTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS beacons_sync_state (
      service TEXT PRIMARY KEY,
      last_sync_at TIMESTAMPTZ,
      last_history_id TEXT,
      thread_count INTEGER NOT NULL DEFAULT 0,
      meta JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function getSyncState(sql, service) {
  const rows = await sql`SELECT * FROM beacons_sync_state WHERE service = ${service}`;
  return rows[0] || null;
}

async function setSyncState(sql, service, { lastSyncAt, threadCount, meta }) {
  await sql`
    INSERT INTO beacons_sync_state (service, last_sync_at, thread_count, meta, updated_at)
    VALUES (${service}, ${lastSyncAt || null}, ${threadCount || 0}, ${meta ? JSON.stringify(meta) : null}::jsonb, NOW())
    ON CONFLICT (service) DO UPDATE SET
      last_sync_at = EXCLUDED.last_sync_at,
      thread_count = beacons_sync_state.thread_count + EXCLUDED.thread_count,
      meta = EXCLUDED.meta,
      updated_at = NOW()
  `;
}

async function ingestFile(sql, accessToken, file) {
  const id = 'gdrive_' + file.id;

  // Skip if we already have it AND modifiedTime is the same.
  const existing = await sql`SELECT data FROM beacons_items WHERE id = ${id}`;
  if (existing[0]) {
    const stored = existing[0].data;
    if (stored && stored.drive_modified_time === file.modifiedTime) {
      return { ok: true, skipped: true, reason: 'unchanged' };
    }
  }

  const classification = D.classifyFile(file);
  if (!classification) {
    return { ok: false, reason: 'unsupported mime: ' + file.mimeType };
  }

  // Skip large binaries (PDF parse memory + function timeout).
  if (file.size && parseInt(file.size, 10) > MAX_BYTES) {
    return { ok: false, reason: 'too large (' + file.size + ' bytes)' };
  }

  let content = '';
  let extension = '';

  try {
    if (classification.type === 'google-native') {
      content = await D.exportFile(accessToken, file.id, classification.exportAs);
      extension = classification.exportAs === 'text/csv' ? 'csv' : 'txt';
    } else if (classification.type === 'binary') {
      const buffer = await D.downloadFile(accessToken, file.id);
      extension = classification.extension;
      content = await D.extractFromBuffer(buffer, extension);
    } else if (classification.type === 'text') {
      const buffer = await D.downloadFile(accessToken, file.id);
      content = buffer.toString('utf8');
      extension = (file.name.split('.').pop() || 'txt').toLowerCase();
    }
  } catch (e) {
    return { ok: false, reason: 'extract failed: ' + e.message };
  }

  if (!content || !content.trim()) {
    return { ok: false, reason: 'empty content' };
  }

  const item = {
    id,
    kind: 'file',
    title: file.name,
    extension,
    mime: file.mimeType,
    size: file.size ? parseInt(file.size, 10) : content.length,
    content,
    extracted: true,
    drive_file_id: file.id,
    drive_modified_time: file.modifiedTime,
    drive_link: file.webViewLink,
    created_at: file.modifiedTime || new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await sql`
    INSERT INTO beacons_items (id, data, kind, created_at, updated_at)
    VALUES (${id}, ${JSON.stringify(item)}::jsonb, 'file', ${item.created_at}, ${item.updated_at})
    ON CONFLICT (id) DO UPDATE SET
      data = EXCLUDED.data,
      updated_at = EXCLUDED.updated_at
  `;
  return { ok: true };
}

async function runSync({ db, accessToken }) {
  const state = await getSyncState(db, 'drive');
  const after = (state && state.last_sync_at) ? state.last_sync_at : null;

  // List files (one page = 100 files max). If `after` is set, only files
  // modified since the last successful sync. On first run, lists everything
  // owned by the user, sorted by modifiedTime desc.
  const page = await D.listFiles(accessToken, { pageSize: MAX_FILES_PER_RUN * 2, after });
  const files = (page.files || []).slice(0, MAX_FILES_PER_RUN * 2);

  if (!files.length) {
    await setSyncState(db, 'drive', {
      lastSyncAt: new Date().toISOString(),
      threadCount: 0,
      meta: { lastRun: 'no new files' }
    });
    return { ok: true, ingested: 0, skipped: 0, errors: 0, total: 0 };
  }

  let ingested = 0;
  let skipped = 0;
  let errors = 0;
  const errorList = [];
  let processed = 0;

  // Serial — Drive API + extraction is heavy enough that parallel hurts.
  for (const file of files) {
    if (processed >= MAX_FILES_PER_RUN) break;
    processed++;
    try {
      const result = await ingestFile(db, accessToken, file);
      if (result.ok && result.skipped) skipped++;
      else if (result.ok) ingested++;
      else { errors++; errorList.push({ name: file.name, reason: result.reason }); }
    } catch (e) {
      errors++;
      errorList.push({ name: file.name, reason: e.message });
    }
  }

  await setSyncState(db, 'drive', {
    lastSyncAt: new Date().toISOString(),
    threadCount: ingested,
    meta: { lastRun: 'ok', ingested, skipped, errors, errorList: errorList.slice(0, 5) }
  });

  return {
    ok: true,
    ingested,
    skipped,
    errors,
    total: processed,
    hasMore: files.length > MAX_FILES_PER_RUN,
    errorList: errorList.slice(0, 5)
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });

  const isCron = checkCronAuth(req);
  if (!isCron && !G.checkBeaconsAuth(req)) return res.status(401).json({ error: 'Invalid auth' });

  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    await G.ensureSchema();
    await ensureSyncTable(sql);

    const accessToken = await G.getValidAccessToken();
    if (!accessToken) {
      return res.status(400).json({ error: 'Google not connected. Connect first.' });
    }

    const result = await runSync({ db: sql, accessToken });
    return res.status(200).json(result);
  } catch (err) {
    console.error('drive-sync error', err);
    return res.status(500).json({ error: err.message || 'Sync failed' });
  }
};
