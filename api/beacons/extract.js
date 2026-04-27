// /api/beacons/extract.js — Server-side text extraction for binary uploads
//
// POST  body: { filename, mime?, base64 }
//   - Decodes base64 → Buffer
//   - Routes by extension to pdf-parse / mammoth / pizzip-based PPTX parser
//   - Returns { content, extracted, meta, size }
//
// Auth: same x-beacons-auth header used elsewhere.
//
// Vercel body-size cap is ~4.5MB by default; with base64 inflation that means
// the original file must be under ~3.3MB. For larger files we'll add a
// Vercel Blob upload path later.

function checkAuth(req) {
  const expected = process.env.BEACONS_PASSCODE_HASH;
  if (!expected) return false;
  const got = (req.headers['x-beacons-auth'] || '').toString();
  if (got.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < got.length; i++) mismatch |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return mismatch === 0;
}

function extractPptxText(buffer) {
  const PizZip = require('pizzip');
  const zip = new PizZip(buffer);
  const slides = [];
  Object.keys(zip.files)
    .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => parseInt(a.match(/slide(\d+)/)[1], 10) - parseInt(b.match(/slide(\d+)/)[1], 10))
    .forEach(f => {
      const xml = zip.files[f].asText();
      const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
      const texts = matches.map(t => t.replace(/<a:t[^>]*>|<\/a:t>/g, '').trim()).filter(Boolean);
      slides.push(texts.join(' '));
    });

  // Also pick up speaker notes
  const notes = [];
  Object.keys(zip.files)
    .filter(f => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f))
    .sort((a, b) => parseInt(a.match(/notesSlide(\d+)/)[1], 10) - parseInt(b.match(/notesSlide(\d+)/)[1], 10))
    .forEach(f => {
      const xml = zip.files[f].asText();
      const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
      const texts = matches.map(t => t.replace(/<a:t[^>]*>|<\/a:t>/g, '').trim()).filter(Boolean);
      notes.push(texts.join(' '));
    });

  const out = slides.map((s, i) => `--- Slide ${i + 1} ---\n${s}`).join('\n\n');
  if (notes.some(Boolean)) {
    return out + '\n\n=== Speaker notes ===\n' +
      notes.map((n, i) => n ? `[Slide ${i + 1}] ${n}` : '').filter(Boolean).join('\n');
  }
  return out;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.BEACONS_PASSCODE_HASH) return res.status(500).json({ error: 'BEACONS_PASSCODE_HASH not configured' });
  if (!checkAuth(req)) return res.status(401).json({ error: 'Invalid or missing auth' });

  const body = req.body || {};
  const filename = (body.filename || '').toString();
  const mime = (body.mime || '').toString();
  const base64 = (body.base64 || '').toString();
  if (!base64) return res.status(400).json({ error: 'Missing base64 file content' });

  const buffer = Buffer.from(base64, 'base64');
  const ext = (filename.split('.').pop() || '').toLowerCase();

  try {
    let content = '';
    let meta = {};

    if (ext === 'pdf' || mime === 'application/pdf') {
      // Lazy require to avoid cold-start side effects (pdf-parse runs a test
      // parse on import unless its package.json sentinel files are present).
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      content = (data.text || '').trim();
      meta = { pages: data.numpages, info: data.info ? { title: data.info.Title, author: data.info.Author } : null };
    } else if (
      ext === 'docx' ||
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      content = (result.value || '').trim();
    } else if (
      ext === 'pptx' ||
      mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ) {
      content = extractPptxText(buffer).trim();
    } else {
      return res.status(400).json({ error: 'Unsupported file type: ' + (ext || mime || 'unknown') });
    }

    return res.status(200).json({
      content,
      extracted: true,
      meta,
      size: buffer.length,
      chars: content.length
    });
  } catch (err) {
    console.error('beacons/extract error', err);
    return res.status(500).json({ error: err.message || 'Extraction failed' });
  }
};
