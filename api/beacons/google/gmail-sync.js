// /api/beacons/google/gmail-sync.js — Pull new Gmail threads into the library.
//
// POST: triggers a sync.
//   - First run: pulls last 90 days of threads (capped at MAX_INITIAL).
//   - Subsequent runs: pulls threads newer than the last sync timestamp,
//     using Gmail's `q=newer_than:` operator (cheap + simple).
//
// Auth:
//   - Pete: x-beacons-auth header (manual sync from the UI)
//   - Cron: Authorization: Bearer ${process.env.CRON_SECRET}

const { neon } = require('@neondatabase/serverless');
const G = require('../../../lib/google');
const Gm = require('../../../lib/gmail');

const INITIAL_DAYS = 90;
const MAX_INITIAL_THREADS = 200;
const MAX_INCREMENTAL_THREADS = 200;
const FETCH_CONCURRENCY = 8;

function checkUserAuth(req) {
  return G.checkBeaconsAuth(req);
}

function checkCronAuth(req) {
  if (!process.env.CRON_SECRET) return false;
  const got = (req.headers.authorization || '').toString();
  return got === 'Bearer ' + process.env.CRON_SECRET;
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

async function setSyncState(sql, service, { lastSyncAt, lastHistoryId, threadCount, meta }) {
  await sql`
    INSERT INTO beacons_sync_state (service, last_sync_at, last_history_id, thread_count, meta, updated_at)
    VALUES (${service}, ${lastSyncAt || null}, ${lastHistoryId || null}, ${threadCount || 0}, ${meta ? JSON.stringify(meta) : null}::jsonb, NOW())
    ON CONFLICT (service) DO UPDATE SET
      last_sync_at = EXCLUDED.last_sync_at,
      last_history_id = COALESCE(EXCLUDED.last_history_id, beacons_sync_state.last_history_id),
      thread_count = beacons_sync_state.thread_count + EXCLUDED.thread_count,
      meta = EXCLUDED.meta,
      updated_at = NOW()
  `;
}

// Run async fns with bounded concurrency, returning results in input order.
async function pMap(items, mapper, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try {
        results[i] = { ok: true, value: await mapper(items[i], i) };
      } catch (err) {
        results[i] = { ok: false, error: err };
      }
    }
  });
  await Promise.all(workers);
  return results;
}

async function runSync({ db, accessToken, accountEmail }) {
  const state = await getSyncState(db, 'gmail');
  const isInitial = !state || !state.last_sync_at;

  // Build query: skip self-sent and self-received from the dedicated Beacon
  // address itself (so we don't ingest bounce notifications, etc.).
  let q = Gm.DEFAULT_Q;
  if (accountEmail) q += ` -from:${accountEmail}`;

  if (isInitial) {
    q += ` newer_than:${INITIAL_DAYS}d`;
  } else {
    // Add a small overlap window so messages right at the edge don't get missed.
    const sinceMs = new Date(state.last_sync_at).getTime() - 30 * 60 * 1000; // 30-min overlap
    const days = Math.max(1, Math.ceil((Date.now() - sinceMs) / (1000 * 60 * 60 * 24)));
    q += ` newer_than:${days}d`;
  }

  const cap = isInitial ? MAX_INITIAL_THREADS : MAX_INCREMENTAL_THREADS;

  // List thread IDs (one call, up to 100 per page).
  const threadIds = [];
  let pageToken = null;
  let pages = 0;
  while (threadIds.length < cap && pages < 5) {
    const page = await Gm.listThreads(accessToken, { q, maxResults: 100, pageToken });
    (page.threads || []).forEach(t => threadIds.push(t.id));
    pageToken = page.nextPageToken;
    pages++;
    if (!pageToken) break;
  }
  const slice = threadIds.slice(0, cap);

  if (!slice.length) {
    await setSyncState(db, 'gmail', {
      lastSyncAt: new Date().toISOString(),
      threadCount: 0,
      meta: { lastRun: 'no new threads', accountEmail }
    });
    return { ok: true, ingested: 0, skipped: 0, total: 0, isInitial };
  }

  // De-dup against existing items in beacons_items so re-runs don't dupe.
  const existing = await db`
    SELECT id FROM beacons_items
    WHERE id = ANY(${slice.map(id => 'gmail_' + id)}::text[])
  `;
  const existingIds = new Set(existing.map(r => r.id));
  const toFetch = slice.filter(id => !existingIds.has('gmail_' + id));

  // Fetch threads in parallel batches.
  const fetched = await pMap(toFetch, (id) => Gm.getThread(accessToken, id), FETCH_CONCURRENCY);

  // Persist as items.
  let ingested = 0;
  let errors = 0;
  for (let i = 0; i < toFetch.length; i++) {
    const result = fetched[i];
    if (!result.ok) { errors++; continue; }
    const thread = result.value;
    const formatted = Gm.formatThread(thread);
    if (!formatted.body) { continue; }
    const id = 'gmail_' + toFetch[i];
    const item = {
      id,
      kind: 'email_thread',
      title: formatted.title,
      content: formatted.body,
      size: formatted.body.length,
      thread_id: formatted.threadId,
      message_count: formatted.messageCount,
      thread_date: formatted.date,
      created_at: formatted.date || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    try {
      await db`
        INSERT INTO beacons_items (id, data, kind, created_at, updated_at)
        VALUES (${id}, ${JSON.stringify(item)}::jsonb, 'email_thread', ${item.created_at}, ${item.updated_at})
        ON CONFLICT (id) DO UPDATE SET
          data = EXCLUDED.data,
          updated_at = EXCLUDED.updated_at
      `;
      ingested++;
    } catch (e) {
      errors++;
    }
  }

  await setSyncState(db, 'gmail', {
    lastSyncAt: new Date().toISOString(),
    threadCount: ingested,
    meta: {
      lastRun: 'ok',
      isInitial,
      ingested,
      skipped: existingIds.size,
      errors,
      accountEmail
    }
  });

  return {
    ok: true,
    ingested,
    skipped: existingIds.size,
    errors,
    total: slice.length,
    isInitial
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'GET or POST only' });

  // Vercel cron uses GET with a Bearer token; manual UI uses POST with x-beacons-auth.
  const isCron = checkCronAuth(req);
  if (!isCron && !checkUserAuth(req)) return res.status(401).json({ error: 'Invalid auth' });

  if (!process.env.DATABASE_URL) return res.status(500).json({ error: 'DATABASE_URL not configured' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    await G.ensureSchema();
    await ensureSyncTable(sql);

    const accessToken = await G.getValidAccessToken();
    if (!accessToken) {
      return res.status(400).json({ error: 'Google not connected. Connect first.' });
    }

    const account = await G.getGoogleAccount();
    const accountEmail = account ? account.email : null;

    const result = await runSync({ db: sql, accessToken, accountEmail });
    return res.status(200).json(result);
  } catch (err) {
    console.error('gmail-sync error', err);
    return res.status(500).json({ error: err.message || 'Sync failed' });
  }
};
