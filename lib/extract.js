// /lib/extract.js — Shared text extraction for binary uploads.
//
// Used by:
//   - /api/beacons/extract.js     (small files, base64 inline body)
//   - /api/beacons/extract-blob.js (large files, fetched from Vercel Blob URL)
//
// Routes by extension/mime to pdf-parse / mammoth / pizzip / exceljs.

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

const ALLOWED_MIMES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/octet-stream'
];

const ALLOWED_EXTS = ['pdf', 'docx', 'pptx', 'xlsx', 'xls', 'txt', 'md', 'csv', 'json', 'html', 'eml', 'mbox'];

async function extractBuffer(buffer, filename, mime) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  let content = '';
  let meta = {};

  if (ext === 'pdf' || mime === 'application/pdf') {
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
  } else if (
    ext === 'xlsx' || ext === 'xls' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel'
  ) {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const sheetTexts = [];
    wb.eachSheet((sheet) => {
      const rows = [];
      sheet.eachRow({ includeEmpty: false }, (row) => {
        const cells = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          let v = cell.value;
          if (v && typeof v === 'object') {
            if (v.richText) v = v.richText.map(t => t.text).join('');
            else if (v.formula) v = v.result != null ? String(v.result) : '=' + v.formula;
            else if (v.text) v = v.text;
            else if (v instanceof Date) v = v.toISOString().slice(0, 10);
            else v = JSON.stringify(v);
          }
          cells.push(v == null ? '' : String(v));
        });
        rows.push(cells.join('\t'));
      });
      if (rows.length) sheetTexts.push(`=== Sheet: ${sheet.name} ===\n${rows.join('\n')}`);
    });
    content = sheetTexts.join('\n\n').trim();
    meta = { sheetCount: wb.worksheets.length };
  } else if (['txt', 'md', 'csv', 'json', 'html', 'eml', 'mbox'].includes(ext)) {
    content = buffer.toString('utf8').trim();
  } else {
    throw new Error('Unsupported file type: ' + (ext || mime || 'unknown'));
  }

  return { content, meta, size: buffer.length, chars: content.length };
}

module.exports = { extractBuffer, ALLOWED_MIMES, ALLOWED_EXTS };
