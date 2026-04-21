// /api/beacon/context.js — Manage context documents for Beacon subscriptions
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    // GET — list context docs for a subscription
    if (req.method === 'GET') {
      var subId = req.query.subscription_id;
      if (!subId) return res.status(400).json({ error: 'Missing subscription_id' });

      var rows = await sql`
        SELECT id, context_type, title, content, metadata, created_at
        FROM beacon_context
        WHERE subscription_id = ${subId}
        ORDER BY created_at ASC
      `;
      return res.json({ context: rows });
    }

    // POST — add context document
    if (req.method === 'POST') {
      var body = req.body;
      if (!body.subscription_id) return res.status(400).json({ error: 'Missing subscription_id' });
      if (!body.content) return res.status(400).json({ error: 'Missing content' });

      var type = body.context_type || 'document';
      var title = body.title || '';
      var content = body.content;
      var metadata = body.metadata || null;

      // If type is 'website', scrape the URL and store the text
      if (type === 'website' && body.url) {
        try {
          var scrapeResp = await fetch(body.url, {
            headers: { 'User-Agent': 'PolarisPoint-Beacon/1.0' },
            signal: AbortSignal.timeout(10000)
          });
          var html = await scrapeResp.text();
          // Strip HTML tags, keep text
          content = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 50000); // Cap at 50K chars
          title = title || body.url;
          metadata = { source_url: body.url, scraped_at: new Date().toISOString() };
        } catch (e) {
          return res.status(400).json({ error: 'Failed to scrape URL: ' + e.message });
        }
      }

      // Cap individual document size
      if (content.length > 100000) {
        content = content.substring(0, 100000) + '\n...(truncated at 100K characters)';
      }

      var result = await sql`
        INSERT INTO beacon_context (subscription_id, context_type, title, content, metadata)
        VALUES (${body.subscription_id}, ${type}, ${title}, ${content}, ${metadata ? JSON.stringify(metadata) : null})
        RETURNING id, context_type, title, created_at
      `;

      return res.json({ context: result[0] });
    }

    // DELETE — remove context document
    if (req.method === 'DELETE') {
      var id = req.query.id;
      if (!id) return res.status(400).json({ error: 'Missing id' });

      await sql`DELETE FROM beacon_context WHERE id = ${id}`;
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
