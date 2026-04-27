// /api/beacons/google/save-as-slides.js — Create a Google Slides deck from
// a chat reply.
//
// POST { text, title? } → splits text into slides (heading-aware), creates a
// new Slides presentation in Drive with TITLE_AND_BODY layouts, fills the
// title + body placeholders, and returns webViewLink.
//
// Splitting strategy:
//   1. If markdown headings exist (# / ##), one slide per heading.
//   2. Else if --- horizontal rules exist, one slide per section.
//   3. Else group paragraphs into ~100-word chunks.
//
// Auth: x-beacons-auth header.

const G = require('../../../lib/google');

const SLIDES_BASE = 'https://slides.googleapis.com/v1';

async function slidesFetch(accessToken, path, init) {
  const resp = await fetch(SLIDES_BASE + path, {
    ...(init || {}),
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      ...((init && init.headers) || {})
    }
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('Slides API ' + resp.status + ' on ' + path + ': ' + text.slice(0, 300));
  }
  return resp.json();
}

function splitIntoSlides(text) {
  const t = (text || '').trim();
  if (!t) return [{ title: 'Beacon output', body: '' }];

  // Strategy 1: Markdown headings (# or ##)
  const headingMatches = t.match(/^#{1,2} .+$/gm);
  if (headingMatches && headingMatches.length >= 2) {
    const sections = t.split(/^(#{1,2} .+)$/gm).filter(Boolean);
    const slides = [];
    let current = null;
    for (const part of sections) {
      const m = part.match(/^(#{1,2}) (.+)$/);
      if (m) {
        if (current) slides.push(current);
        current = { title: m[2].trim().slice(0, 100), body: '' };
      } else if (current) {
        current.body += part;
      }
    }
    if (current) slides.push(current);
    if (slides.length) return slides.map(s => ({ title: s.title, body: s.body.trim().slice(0, 2500) }));
  }

  // Strategy 2: horizontal rule sections (---)
  const ruleSplit = t.split(/^-{3,}\s*$/m).map(s => s.trim()).filter(Boolean);
  if (ruleSplit.length >= 2) {
    return ruleSplit.map((section, idx) => {
      const lines = section.split('\n');
      const firstLine = (lines[0] || '').replace(/^[#*\s>-]+/, '').trim();
      const title = firstLine.slice(0, 100) || `Section ${idx + 1}`;
      const body = (firstLine.length > 100 ? section : lines.slice(1).join('\n')).trim().slice(0, 2500);
      return { title, body };
    });
  }

  // Strategy 3: chunk paragraphs into ~100-word slides
  const paragraphs = t.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length <= 1) {
    return [{ title: (paragraphs[0] || 'Beacon output').split('\n')[0].slice(0, 100), body: t.slice(0, 2500) }];
  }
  const slides = [];
  let current = [];
  let currentWords = 0;
  for (const p of paragraphs) {
    const wordCount = p.split(/\s+/).length;
    if (currentWords + wordCount > 100 && current.length) {
      const sectionText = current.join('\n\n');
      const firstLine = current[0].split('\n')[0].replace(/^[#*\s>-]+/, '').trim();
      slides.push({
        title: firstLine.slice(0, 100) || `Slide ${slides.length + 1}`,
        body: sectionText.slice(0, 2500)
      });
      current = [];
      currentWords = 0;
    }
    current.push(p);
    currentWords += wordCount;
  }
  if (current.length) {
    const sectionText = current.join('\n\n');
    const firstLine = current[0].split('\n')[0].replace(/^[#*\s>-]+/, '').trim();
    slides.push({
      title: firstLine.slice(0, 100) || `Slide ${slides.length + 1}`,
      body: sectionText.slice(0, 2500)
    });
  }
  return slides;
}

async function createSlidesPresentation(accessToken, { name, slides }) {
  // 1. Create blank presentation. The API auto-creates one default slide.
  const presentation = await slidesFetch(accessToken, '/presentations', {
    method: 'POST',
    body: JSON.stringify({ title: name })
  });
  const presentationId = presentation.presentationId;

  // 2. Build createSlide requests for each user slide. We'll add slides at
  //    the end and delete the auto-created one afterward.
  const slideObjectIds = slides.map((_, i) => `bs_${Date.now().toString(36)}_${i}`);
  const createRequests = slideObjectIds.map((objectId, idx) => ({
    createSlide: {
      objectId,
      insertionIndex: idx + 1,
      slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' }
    }
  }));
  await slidesFetch(accessToken, '/presentations/' + presentationId + ':batchUpdate', {
    method: 'POST',
    body: JSON.stringify({ requests: createRequests })
  });

  // 3. Re-fetch the presentation to find placeholder objectIds for each
  //    new slide (Slides API assigns these dynamically).
  const full = await slidesFetch(accessToken, '/presentations/' + presentationId);
  const fillRequests = [];
  full.slides.forEach(page => {
    const ourIdx = slideObjectIds.indexOf(page.objectId);
    if (ourIdx === -1) {
      // Auto-created default slide → delete
      fillRequests.push({ deleteObject: { objectId: page.objectId } });
      return;
    }
    const slide = slides[ourIdx];
    (page.pageElements || []).forEach(el => {
      if (el.shape && el.shape.placeholder) {
        const phType = el.shape.placeholder.type;
        if (phType === 'TITLE' || phType === 'CENTERED_TITLE') {
          if (slide.title) fillRequests.push({ insertText: { objectId: el.objectId, text: slide.title } });
        } else if (phType === 'BODY') {
          if (slide.body) fillRequests.push({ insertText: { objectId: el.objectId, text: slide.body } });
        }
      }
    });
  });
  if (fillRequests.length) {
    await slidesFetch(accessToken, '/presentations/' + presentationId + ':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: fillRequests })
    });
  }

  return {
    presentationId,
    name: presentation.title || name,
    slideCount: slides.length,
    webViewLink: 'https://docs.google.com/presentation/d/' + presentationId + '/edit'
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!G.checkBeaconsAuth(req)) return res.status(401).json({ error: 'Invalid auth' });

  const body = req.body || {};
  const text = (body.text || '').toString();
  if (!text.trim()) return res.status(400).json({ error: 'Missing text' });

  const stamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const fallbackTitle = (text.split('\n').find(l => l.trim()) || 'Beacon deck')
    .replace(/^[#*\s>-]+/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 70);
  const name = (body.title || fallbackTitle) + ` · ${stamp}`;

  try {
    const accessToken = await G.getValidAccessToken();
    if (!accessToken) return res.status(400).json({ error: 'Google not connected' });

    const slides = splitIntoSlides(text);
    const result = await createSlidesPresentation(accessToken, { name, slides });
    return res.status(200).json(result);
  } catch (err) {
    console.error('save-as-slides error', err);
    return res.status(500).json({ error: err.message || 'Save-as-slides failed' });
  }
};
