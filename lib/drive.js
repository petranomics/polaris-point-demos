// /lib/drive.js — Google Drive helpers for Beacons.
//
// Lists user-owned files (skipping trash), downloads binaries, and exports
// Google native formats (Docs/Sheets/Slides) as plain text/CSV.

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3';

async function driveFetch(accessToken, path, init) {
  const url = path.startsWith('http') ? path : (DRIVE_BASE + path);
  const resp = await fetch(url, {
    ...(init || {}),
    headers: {
      Authorization: 'Bearer ' + accessToken,
      ...((init && init.headers) || {})
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('Drive API ' + resp.status + ' on ' + path + ': ' + text.slice(0, 300));
  }
  return resp;
}

async function listFiles(accessToken, { q, pageSize, pageToken, after } = {}) {
  const params = new URLSearchParams();
  // Files I own, not trashed, optionally newer-than-X
  const clauses = ["'me' in owners", 'trashed = false'];
  if (after) clauses.push(`modifiedTime > '${after}'`);
  if (q) clauses.push(`(${q})`);
  params.set('q', clauses.join(' and '));
  params.set('fields', 'files(id,name,mimeType,modifiedTime,size,webViewLink),nextPageToken');
  params.set('pageSize', String(pageSize || 100));
  params.set('orderBy', 'modifiedTime desc');
  if (pageToken) params.set('pageToken', pageToken);
  const resp = await driveFetch(accessToken, '/files?' + params.toString());
  return resp.json();
}

async function downloadFile(accessToken, fileId) {
  const resp = await driveFetch(accessToken, `/files/${fileId}?alt=media`);
  const ab = await resp.arrayBuffer();
  return Buffer.from(ab);
}

async function exportFile(accessToken, fileId, mimeType) {
  const params = new URLSearchParams({ mimeType });
  const resp = await driveFetch(accessToken, `/files/${fileId}/export?${params.toString()}`);
  return resp.text();
}

// Map Google-native mimeTypes to the format we ask Drive to export them as.
const EXPORT_MAP = {
  'application/vnd.google-apps.document': 'text/plain',
  'application/vnd.google-apps.spreadsheet': 'text/csv',
  'application/vnd.google-apps.presentation': 'text/plain'
};

// Office binaries we know how to extract on the server.
const SUPPORTED_BINARY_MIMES = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
};

function classifyFile(file) {
  if (EXPORT_MAP[file.mimeType]) {
    return { type: 'google-native', exportAs: EXPORT_MAP[file.mimeType] };
  }
  if (SUPPORTED_BINARY_MIMES[file.mimeType]) {
    return { type: 'binary', extension: SUPPORTED_BINARY_MIMES[file.mimeType] };
  }
  if (file.mimeType && (file.mimeType.startsWith('text/') || file.mimeType === 'application/json')) {
    return { type: 'text' };
  }
  return null;
}

// Extract text content from a downloaded buffer based on extension.
async function extractFromBuffer(buffer, extension) {
  if (extension === 'pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return (data.text || '').trim();
  }
  if (extension === 'docx') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return (result.value || '').trim();
  }
  if (extension === 'pptx') {
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
    return slides.map((s, i) => `--- Slide ${i + 1} ---\n${s}`).join('\n\n').trim();
  }
  return buffer.toString('utf8');
}

module.exports = {
  listFiles,
  downloadFile,
  exportFile,
  classifyFile,
  extractFromBuffer,
  EXPORT_MAP,
  SUPPORTED_BINARY_MIMES
};
