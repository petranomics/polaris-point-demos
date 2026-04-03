// /api/leads.js — CRUD for leads stored in Neon
// GET /api/leads?owner=x        — list leads (senior: all, junior: own)
// POST /api/leads               — create lead
// PUT /api/leads?id=x           — update lead
// DELETE /api/leads?id=x        — delete lead
const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  try {
    // GET — list leads
    if (req.method === 'GET') {
      var owner = req.query.owner;
      var all = req.query.all === 'true';
      var rows;
      if (all) {
        // Senior admin — get all leads
        rows = await sql`SELECT * FROM leads ORDER BY created_at DESC`;
      } else if (owner) {
        rows = await sql`SELECT * FROM leads WHERE owner = ${owner} ORDER BY created_at DESC`;
      } else {
        rows = await sql`SELECT * FROM leads ORDER BY created_at DESC`;
      }
      return res.status(200).json({ leads: rows });
    }

    // POST — create lead
    if (req.method === 'POST') {
      var b = req.body;
      if (!b || !b.biz_name) return res.status(400).json({ error: 'biz_name required' });

      var result = await sql`
        INSERT INTO leads (biz_name, industry, address, website, rating, years_in_biz,
          contact, contact_role, phone, email, contact_method, best_time,
          rank, tier, source, revenue, listing_url, stage, notes, owner)
        VALUES (${b.biz_name}, ${b.industry || ''}, ${b.address || ''}, ${b.website || ''},
          ${b.rating || ''}, ${b.years_in_biz || ''},
          ${b.contact || ''}, ${b.contact_role || ''}, ${b.phone || ''}, ${b.email || ''},
          ${b.contact_method || 'phone'}, ${b.best_time || ''},
          ${b.rank || 'warm'}, ${b.tier || 'undecided'}, ${b.source || ''}, ${b.revenue || ''},
          ${b.listing_url || ''}, ${b.stage || 0}, ${b.notes || ''}, ${b.owner || 'unknown'})
        RETURNING *
      `;
      return res.status(201).json({ lead: result[0] });
    }

    // PUT — update lead
    if (req.method === 'PUT') {
      var id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id required' });
      var b = req.body;
      if (!b) return res.status(400).json({ error: 'body required' });

      // Build dynamic update — only set fields that are provided
      var fields = ['biz_name', 'industry', 'address', 'website', 'rating', 'years_in_biz',
        'contact', 'contact_role', 'phone', 'email', 'contact_method', 'best_time',
        'rank', 'tier', 'source', 'revenue', 'listing_url', 'stage', 'notes'];

      // Simple approach: update all fields using coalesce
      var result = await sql`
        UPDATE leads SET
          biz_name = COALESCE(${b.biz_name || null}, biz_name),
          industry = COALESCE(${b.industry || null}, industry),
          address = COALESCE(${b.address || null}, address),
          website = COALESCE(${b.website || null}, website),
          rating = COALESCE(${b.rating || null}, rating),
          years_in_biz = COALESCE(${b.years_in_biz || null}, years_in_biz),
          contact = COALESCE(${b.contact || null}, contact),
          contact_role = COALESCE(${b.contact_role || null}, contact_role),
          phone = COALESCE(${b.phone || null}, phone),
          email = COALESCE(${b.email || null}, email),
          contact_method = COALESCE(${b.contact_method || null}, contact_method),
          best_time = COALESCE(${b.best_time || null}, best_time),
          rank = COALESCE(${b.rank || null}, rank),
          tier = COALESCE(${b.tier || null}, tier),
          source = COALESCE(${b.source || null}, source),
          revenue = COALESCE(${b.revenue || null}, revenue),
          listing_url = COALESCE(${b.listing_url || null}, listing_url),
          stage = COALESCE(${b.stage != null ? b.stage : null}, stage),
          notes = COALESCE(${b.notes != null ? b.notes : null}, notes),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      if (!result.length) return res.status(404).json({ error: 'Lead not found' });
      return res.status(200).json({ lead: result[0] });
    }

    // DELETE
    if (req.method === 'DELETE') {
      var id = req.query.id;
      if (!id) return res.status(400).json({ error: 'id required' });
      await sql`DELETE FROM leads WHERE id = ${id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
