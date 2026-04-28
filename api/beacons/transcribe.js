// /api/beacons/transcribe.js — Whisper transcription endpoint.
//
// POST { audio: <base64>, mime: 'audio/webm', filename?, language? }
//   → { text, duration, language }
//
// Used as the reliability fallback when the browser's Web Speech API
// can't reach Google's speech service (e.g., privacy extensions blocking,
// corporate firewall). The client records audio with MediaRecorder, base64
// encodes the blob, and posts it here. We forward to OpenAI Whisper.
//
// Requires OPENAI_API_KEY env var. Without it the endpoint returns a clear
// 503 so the client UI can tell the user how to enable the fallback.

const G = require('../../lib/google');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-beacons-auth');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  if (!process.env.BEACONS_PASSCODE_HASH) return res.status(500).json({ error: 'BEACONS_PASSCODE_HASH not configured' });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'Whisper fallback unavailable — set OPENAI_API_KEY in Vercel env vars to enable.' });
  }
  if (!G.checkBeaconsAuth(req)) return res.status(401).json({ error: 'Invalid auth' });

  const body = req.body || {};
  if (!body.audio) return res.status(400).json({ error: 'Missing audio (base64)' });

  const buffer = Buffer.from(body.audio, 'base64');
  if (!buffer.length) return res.status(400).json({ error: 'Empty audio' });
  if (buffer.length > 25 * 1024 * 1024) return res.status(413).json({ error: 'Audio over 25MB — too long for one Whisper call. Split into chunks.' });

  const mime = (body.mime || 'audio/webm').toString();
  const ext = mime.includes('mp4') ? 'mp4'
    : mime.includes('mpeg') || mime.includes('mp3') ? 'mp3'
    : mime.includes('wav') ? 'wav'
    : mime.includes('ogg') ? 'ogg'
    : 'webm';
  const filename = (body.filename || 'recording').toString() + '.' + ext;

  try {
    const form = new FormData();
    const blob = new Blob([buffer], { type: mime });
    form.append('file', blob, filename);
    form.append('model', body.model || 'whisper-1');
    if (body.language) form.append('language', String(body.language));

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: form
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error('Whisper API ' + resp.status + ': ' + text.slice(0, 300));
    }
    const data = await resp.json();
    return res.status(200).json({
      text: (data.text || '').trim(),
      duration: data.duration,
      language: data.language
    });
  } catch (err) {
    console.error('transcribe error', err);
    return res.status(500).json({ error: err.message || 'Transcription failed' });
  }
};
