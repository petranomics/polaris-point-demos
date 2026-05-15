// /lib/markdown-to-gdocs.js — Convert markdown text into Google Docs API
// batchUpdate requests so exports preserve headings, lists, bold/italic, and
// code formatting instead of dumping a wall of plain text.
//
// Strategy: build the plain text first (markdown syntax stripped) with
// trackers for ranges that need styling. Emit ONE insertText request with
// the full text, then a series of updateParagraphStyle / updateTextStyle /
// createParagraphBullets requests against those tracked ranges.
//
// Why this shape: Google Docs index math is brittle. If you insert text
// piecemeal, every later request needs index-offset bookkeeping. A single
// insert + post-hoc ranged styling is far easier to reason about.
//
// Supported markdown:
//   # / ## / ### / ####  → HEADING_1 / 2 / 3 / 4
//   **bold**             → text style bold
//   *italic*  _italic_   → text style italic
//   `code`               → monospace font
//   - / * unordered list → BULLET_DISC_CIRCLE_SQUARE
//   1. / 2. ordered list → NUMBERED_DECIMAL_NESTED
//   ---                  → horizontal rule (rendered as a blank line)
//   blank line           → paragraph break
//
// Skips (left as plain text): images, tables (use Sheets for those),
// blockquotes, footnotes. Links are kept inline but not hyperlinked yet —
// a v2 enhancement.

// Returns {plainText, requests} ready for documents.batchUpdate.
function buildBatchRequests(markdown) {
  const md = String(markdown || '').replace(/\r\n/g, '\n');
  const lines = md.split('\n');

  // First pass: parse blocks (paragraph, heading, list-item, hr, blank).
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: 'heading', level: headingMatch[1].length, text: headingMatch[2].trim() });
      i++;
      continue;
    }
    if (/^-{3,}\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    const ulMatch = line.match(/^[\s]{0,3}[-*+]\s+(.+)$/);
    if (ulMatch) {
      // Group consecutive bullet lines into one list block
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^[\s]{0,3}[-*+]\s+(.+)$/);
        if (!m) break;
        items.push(m[1].trim());
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }
    const olMatch = line.match(/^[\s]{0,3}\d+\.\s+(.+)$/);
    if (olMatch) {
      const items = [];
      while (i < lines.length) {
        const m = lines[i].match(/^[\s]{0,3}\d+\.\s+(.+)$/);
        if (!m) break;
        items.push(m[1].trim());
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }
    if (line.trim() === '') {
      blocks.push({ type: 'blank' });
      i++;
      continue;
    }
    // Paragraph: gather until blank line or special block
    const para = [line];
    i++;
    while (i < lines.length) {
      const nxt = lines[i];
      if (
        nxt.trim() === '' ||
        /^(#{1,4})\s+/.test(nxt) ||
        /^-{3,}\s*$/.test(nxt) ||
        /^[\s]{0,3}[-*+]\s+/.test(nxt) ||
        /^[\s]{0,3}\d+\.\s+/.test(nxt)
      ) break;
      para.push(nxt);
      i++;
    }
    blocks.push({ type: 'paragraph', text: para.join(' ').replace(/\s+/g, ' ').trim() });
  }

  // Second pass: build flat text + collect styling ranges.
  // Google Docs documents start at index 1 (index 0 is reserved). All ranges
  // are computed against the inserted-text segment which starts at index 1.
  let cursor = 1;
  const paragraphRanges = []; // { start, end, kind: 'heading'|'paragraph'|'list-ul'|'list-ol', level? }
  const inlineRanges = [];    // { start, end, bold?, italic?, code? }
  let plainText = '';

  function appendPlain(text) {
    plainText += text;
    cursor += text.length;
  }

  // Parse inline (**bold**, *italic*, `code`) into ranges within a paragraph.
  // We also strip the markdown syntax from the plain text.
  function parseInline(text, segStart) {
    // Order matters: code first (so its asterisks aren't interpreted), then
    // bold, then italic. Simple non-nested parser — enough for our needs.
    const out = [];
    const collected = [];
    let pos = 0;
    let cursorInSeg = segStart;
    while (pos < text.length) {
      // Code: `...`
      const codeStart = text.indexOf('`', pos);
      // Bold: **...**
      let boldStart = text.indexOf('**', pos);
      // Italic: *...* or _..._  (avoid matching ** as italic)
      let italicStart = -1;
      for (let j = pos; j < text.length; j++) {
        const ch = text[j];
        if ((ch === '*' && text[j + 1] !== '*' && (j === 0 || text[j - 1] !== '*')) || ch === '_') {
          italicStart = j;
          break;
        }
      }
      // Pick the nearest start
      const starts = [
        { kind: 'code', idx: codeStart, delim: '`' },
        { kind: 'bold', idx: boldStart, delim: '**' },
        { kind: 'italic', idx: italicStart, delim: text[italicStart] || '*' }
      ].filter(s => s.idx >= 0).sort((a, b) => a.idx - b.idx);
      if (!starts.length) {
        // No more markers — emit rest as plain
        const rest = text.slice(pos);
        collected.push(rest);
        cursorInSeg += rest.length;
        break;
      }
      const next = starts[0];
      // Plain text before the marker
      if (next.idx > pos) {
        const chunk = text.slice(pos, next.idx);
        collected.push(chunk);
        cursorInSeg += chunk.length;
      }
      // Find closing delimiter
      const after = next.idx + next.delim.length;
      const closeIdx = text.indexOf(next.delim, after);
      if (closeIdx < 0) {
        // No close — treat as plain
        const chunk = text.slice(next.idx);
        collected.push(chunk);
        cursorInSeg += chunk.length;
        pos = text.length;
        break;
      }
      const inner = text.slice(after, closeIdx);
      const rangeStart = cursorInSeg;
      collected.push(inner);
      cursorInSeg += inner.length;
      out.push({ start: rangeStart, end: cursorInSeg, kind: next.kind });
      pos = closeIdx + next.delim.length;
    }
    return { stripped: collected.join(''), inline: out };
  }

  function appendParagraph(text, paraKind, level) {
    const paraStart = cursor;
    const parsed = parseInline(text, cursor);
    appendPlain(parsed.stripped + '\n');
    // The paragraph range is the stripped text + the newline. Newline is
    // what defines a paragraph boundary in Google Docs.
    paragraphRanges.push({
      start: paraStart,
      end: cursor, // includes the newline
      kind: paraKind,
      level: level || null
    });
    for (const r of parsed.inline) {
      inlineRanges.push(r);
    }
  }

  for (const b of blocks) {
    if (b.type === 'heading') {
      appendParagraph(b.text, 'heading', b.level);
    } else if (b.type === 'paragraph') {
      appendParagraph(b.text, 'paragraph');
    } else if (b.type === 'ul') {
      for (const item of b.items) {
        appendParagraph(item, 'list-ul');
      }
    } else if (b.type === 'ol') {
      for (const item of b.items) {
        appendParagraph(item, 'list-ol');
      }
    } else if (b.type === 'hr') {
      // Blank-line proxy for horizontal rules — keeps things simple.
      appendPlain('\n');
    } else if (b.type === 'blank') {
      appendPlain('\n');
    }
  }

  // Build the request array.
  const requests = [];

  // 1) Insert the full text
  if (plainText.length > 0) {
    requests.push({
      insertText: {
        location: { index: 1 },
        text: plainText
      }
    });
  }

  // 2) Paragraph styles (headings + list paragraphs styled as NORMAL)
  for (const p of paragraphRanges) {
    if (p.kind === 'heading') {
      const namedStyle = ({ 1: 'HEADING_1', 2: 'HEADING_2', 3: 'HEADING_3', 4: 'HEADING_4' })[p.level] || 'HEADING_2';
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: p.start, endIndex: p.end },
          paragraphStyle: { namedStyleType: namedStyle },
          fields: 'namedStyleType'
        }
      });
    }
  }

  // 3) Bullets for list paragraphs (must be done per-list-paragraph)
  for (const p of paragraphRanges) {
    if (p.kind === 'list-ul') {
      requests.push({
        createParagraphBullets: {
          range: { startIndex: p.start, endIndex: p.end },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE'
        }
      });
    } else if (p.kind === 'list-ol') {
      requests.push({
        createParagraphBullets: {
          range: { startIndex: p.start, endIndex: p.end },
          bulletPreset: 'NUMBERED_DECIMAL_NESTED'
        }
      });
    }
  }

  // 4) Inline text styles (bold/italic/code)
  for (const r of inlineRanges) {
    if (r.end <= r.start) continue;
    if (r.kind === 'bold') {
      requests.push({
        updateTextStyle: {
          range: { startIndex: r.start, endIndex: r.end },
          textStyle: { bold: true },
          fields: 'bold'
        }
      });
    } else if (r.kind === 'italic') {
      requests.push({
        updateTextStyle: {
          range: { startIndex: r.start, endIndex: r.end },
          textStyle: { italic: true },
          fields: 'italic'
        }
      });
    } else if (r.kind === 'code') {
      requests.push({
        updateTextStyle: {
          range: { startIndex: r.start, endIndex: r.end },
          textStyle: { weightedFontFamily: { fontFamily: 'Roboto Mono' } },
          fields: 'weightedFontFamily'
        }
      });
    }
  }

  return { plainText, requests };
}

// Detect if markdown contains a pipe-table — used to gate Sheets export.
function hasMarkdownTable(markdown) {
  const text = String(markdown || '');
  const lines = text.split('\n');
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    // Two consecutive lines: first with at least one `|`, second a separator
    // row like `| --- | --- |`.
    if (a.includes('|') && /^[\s|:-]+$/.test(b) && b.includes('-')) {
      return true;
    }
  }
  return false;
}

// Convert a markdown pipe-table (the first one found) to CSV. Returns null if
// no table is present. CSV is RFC-4180-ish: quote cells containing commas or
// double-quotes; escape inner quotes by doubling.
function markdownTableToCSV(markdown) {
  const text = String(markdown || '');
  const lines = text.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    if (a.includes('|') && /^[\s|:-]+$/.test(b) && b.includes('-')) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  const rows = [];
  // Header
  rows.push(parsePipeRow(lines[start]));
  // Body — collect until a blank line or a line with no `|`
  for (let i = start + 2; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln.includes('|')) break;
    if (!ln.trim()) break;
    rows.push(parsePipeRow(ln));
  }
  return rows.map(r => r.map(csvEscape).join(',')).join('\n');
}

function parsePipeRow(line) {
  // Strip leading/trailing pipes then split on pipe
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map(c => c.trim());
}

function csvEscape(cell) {
  const v = String(cell || '');
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return '"' + v.replace(/"/g, '""') + '"';
  }
  return v;
}

module.exports = {
  buildBatchRequests,
  hasMarkdownTable,
  markdownTableToCSV,
};
