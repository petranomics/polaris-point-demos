/**
 * Pitch-deck generator. Produces two keyboard-navigable HTML decks:
 *  - armadillo.html: single-product pitch for Armadillo Analytics
 *  - white-label.html: bundled "Polaris Point Platform" pitch for
 *    agencies (white-label sub-sites + centralized AI admin + Beacon
 *    + Armadillo analytics, all under one custom domain).
 *
 * Each deck is a single .html file with slides that respond to ←/→
 * arrow keys, space, and PageUp/PageDown. ESC opens an overview grid.
 *
 * Run from repo root:  node admin/marketing/decks/build.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(here, { recursive: true });

const ORANGE = '#BF5700';
const SUCCESS = '#7EC8A0';

// ---------- Shared CSS for both decks ----------
const css = `
  :root {
    --bg: #0a0c11;
    --slide: #0F1117;
    --card: #181B24;
    --card-light: #1F232E;
    --text: #E8E6E3;
    --muted: #8B8D97;
    --border: #2A2D38;
    --burnt: ${ORANGE};
    --burnt-light: #E8894A;
    --success: ${SUCCESS};
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }
  .deck {
    position: fixed; inset: 0;
    overflow: hidden;
  }
  .slides {
    display: flex;
    height: 100vh;
    transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
    will-change: transform;
  }
  .slide {
    flex: 0 0 100vw;
    height: 100vh;
    padding: 60px 80px 100px;
    background: var(--slide);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }
  .slide::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; height: 4px;
    background: linear-gradient(90deg, var(--burnt), var(--burnt-light));
    opacity: 0;
  }
  .slide.title-slide::before { opacity: 1; }
  .slide-num {
    position: absolute; top: 24px; right: 32px;
    font-size: 12px; color: var(--muted); font-weight: 600;
    letter-spacing: 2px;
  }
  .slide-brand {
    position: absolute; top: 24px; left: 32px;
    font-size: 10px; color: var(--burnt); letter-spacing: 3px;
    text-transform: uppercase; font-weight: 700;
  }
  h1 {
    font-size: 64px; font-weight: 800; letter-spacing: -0.02em;
    line-height: 1.05; margin: 0 0 18px;
  }
  h2 {
    font-size: 40px; font-weight: 700; letter-spacing: -0.02em;
    line-height: 1.1; margin: 0 0 18px;
  }
  h3 {
    font-size: 20px; font-weight: 700; margin: 0 0 12px;
  }
  .eyebrow {
    font-size: 11px; letter-spacing: 3px; text-transform: uppercase;
    color: var(--burnt); font-weight: 700; margin-bottom: 14px;
  }
  .sub {
    font-size: 19px; color: var(--muted); line-height: 1.55; margin: 0 0 32px;
    max-width: 780px;
  }
  .lead {
    font-size: 22px; color: var(--text); line-height: 1.55; margin: 0 0 24px;
    max-width: 760px;
  }
  .lead strong { color: var(--burnt-light); font-weight: 700; }

  /* Title slide */
  .slide.title-slide {
    justify-content: center;
    background: radial-gradient(ellipse at 30% 40%, rgba(191,87,0,0.18) 0%, transparent 55%), var(--slide);
  }
  .slide.title-slide h1 {
    font-size: 88px;
    background: linear-gradient(135deg, var(--text) 0%, var(--burnt-light) 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    margin-bottom: 24px;
    max-width: 1000px;
  }
  .slide.title-slide .sub {
    font-size: 24px; line-height: 1.45; max-width: 720px;
  }

  /* Grid layouts */
  .col-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 36px; }
  .col-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
  .col-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
  .col-1-1-2 { display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 28px; }

  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 26px 28px;
  }
  .card-accent {
    border-color: rgba(191,87,0,0.35);
    background: linear-gradient(135deg, rgba(191,87,0,0.08), var(--card));
  }
  .card h3 { font-size: 18px; }
  .card p { font-size: 14px; color: var(--muted); line-height: 1.55; margin: 8px 0 0; }
  .card .figure {
    font-size: 44px; font-weight: 800; color: var(--burnt-light);
    letter-spacing: -0.02em; line-height: 1;
    margin: 4px 0 6px;
  }

  ul.fancy {
    list-style: none; padding: 0; margin: 12px 0 0;
    font-size: 16px; line-height: 1.7;
  }
  ul.fancy li {
    padding: 6px 0 6px 28px; position: relative; color: var(--text);
  }
  ul.fancy li::before {
    content: ''; position: absolute; left: 0; top: 14px;
    width: 14px; height: 2px; background: var(--burnt);
  }

  /* Big-number callout */
  .big-stat {
    display: flex; flex-direction: column; align-items: flex-start;
    padding: 36px;
    border: 1px solid var(--border); border-radius: 18px;
    background: linear-gradient(135deg, rgba(191,87,0,0.10), transparent);
  }
  .big-stat .num {
    font-size: 96px; font-weight: 800; line-height: 1;
    color: var(--burnt); letter-spacing: -0.03em;
    margin-bottom: 8px;
  }
  .big-stat .label {
    font-size: 11px; letter-spacing: 3px; text-transform: uppercase;
    color: var(--muted); font-weight: 700;
  }
  .big-stat .ctx { font-size: 15px; color: var(--text); margin-top: 14px; line-height: 1.5; }

  /* Step list — for "How it works" slides */
  .steps {
    display: flex; flex-direction: column; gap: 18px;
  }
  .step-row {
    display: flex; gap: 22px; align-items: flex-start;
  }
  .step-num {
    flex-shrink: 0; width: 44px; height: 44px; border-radius: 50%;
    background: var(--burnt); color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 800;
  }
  .step-body { flex: 1; padding-top: 6px; }
  .step-body h3 { font-size: 19px; margin: 0 0 4px; }
  .step-body p { font-size: 14px; color: var(--muted); line-height: 1.55; margin: 0; }

  /* Pitch table */
  table.pitch {
    width: 100%; border-collapse: collapse; margin-top: 10px;
    font-size: 15px;
  }
  table.pitch th, table.pitch td {
    text-align: left; padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  table.pitch th {
    color: var(--muted); font-size: 11px; text-transform: uppercase;
    letter-spacing: 1.5px; font-weight: 600;
  }
  table.pitch td.tier { font-weight: 700; color: var(--burnt-light); }
  table.pitch td.check { text-align: center; color: var(--success); font-weight: 800; }

  /* Bottom nav */
  .deck-nav {
    position: fixed; bottom: 24px; left: 0; right: 0;
    display: flex; align-items: center; justify-content: center;
    gap: 14px;
    z-index: 10;
  }
  .deck-nav button {
    background: var(--card); border: 1px solid var(--border); color: var(--text);
    padding: 10px 16px; border-radius: 999px; font-size: 12px;
    cursor: pointer; letter-spacing: 1px; font-weight: 600;
    transition: all 0.15s;
  }
  .deck-nav button:hover { border-color: var(--burnt); color: var(--burnt-light); }
  .deck-nav .progress {
    font-size: 11px; color: var(--muted); letter-spacing: 2px;
    padding: 0 12px;
  }
  .help-hint {
    position: fixed; bottom: 24px; right: 32px;
    font-size: 10px; color: var(--muted); letter-spacing: 1.5px;
    text-transform: uppercase;
  }

  /* Overview mode */
  body.overview .slides {
    display: grid !important;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 16px;
    padding: 32px;
    transform: none !important;
    height: 100vh; overflow: auto;
  }
  body.overview .slide {
    flex: none; width: auto; height: 280px;
    border: 2px solid var(--border); border-radius: 12px;
    padding: 20px 24px 30px;
    cursor: pointer; overflow: hidden;
    transition: border-color 0.15s, transform 0.15s;
  }
  body.overview .slide:hover { border-color: var(--burnt); transform: translateY(-3px); }
  body.overview .slide h1 { font-size: 22px; margin-bottom: 6px; }
  body.overview .slide h2 { font-size: 18px; }
  body.overview .slide .sub, body.overview .slide .lead { font-size: 11px; -webkit-line-clamp: 2; }
  body.overview .slide-num { font-size: 9px; }
  body.overview .slide.title-slide h1 { font-size: 22px; -webkit-text-fill-color: var(--text); }
  body.overview .slide.title-slide .sub { font-size: 11px; }
  body.overview .col-2, body.overview .col-3, body.overview .col-4 { display: none; }
  body.overview .step-row, body.overview .big-stat, body.overview .card, body.overview ul.fancy, body.overview table.pitch { display: none; }
  body.overview .deck-nav, body.overview .help-hint { display: none; }

  /* Visual elements */
  .platform-row {
    display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px;
  }
  .platform-chip {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 8px 16px; border-radius: 999px;
    background: var(--card); border: 1px solid var(--border);
    font-size: 13px; font-weight: 600;
  }
  .platform-chip .dot { width: 10px; height: 10px; border-radius: 50%; }

  .gradient-bar {
    height: 4px; border-radius: 2px;
    background: linear-gradient(90deg, var(--burnt), var(--burnt-light));
    width: 80px; margin-bottom: 24px;
  }

  /* Product stack diagram for white-label deck */
  .stack {
    display: flex; flex-direction: column; gap: 10px;
    max-width: 720px;
  }
  .stack .layer {
    display: flex; align-items: center; gap: 14px;
    padding: 18px 22px; border-radius: 10px;
    background: var(--card); border: 1px solid var(--border);
  }
  .stack .layer.accent { border-color: var(--burnt); background: linear-gradient(90deg, rgba(191,87,0,0.12), var(--card) 60%); }
  .stack .layer .lname { font-weight: 700; font-size: 16px; min-width: 220px; }
  .stack .layer .ldesc { font-size: 13px; color: var(--muted); flex: 1; line-height: 1.45; }

  /* CTA */
  .cta-block {
    margin-top: auto;
    padding: 24px 32px;
    background: linear-gradient(90deg, rgba(191,87,0,0.18), transparent);
    border-radius: 12px;
    border: 1px solid rgba(191,87,0,0.3);
    display: flex; align-items: center; justify-content: space-between; gap: 24px;
  }
  .cta-block .cta-text { font-size: 18px; }
  .cta-block strong { font-weight: 700; color: var(--burnt-light); }
  .cta-block .btn {
    background: var(--burnt); color: white; padding: 14px 26px;
    border-radius: 10px; font-size: 13px; font-weight: 700;
    text-decoration: none; text-transform: uppercase; letter-spacing: 2px;
  }
`;

// ---------- Slide-level renderers ----------

function slide({ title, eyebrow, content, num, total, deckName, kind = 'standard' }) {
  return `
    <section class="slide ${kind === 'title' ? 'title-slide' : ''}">
      <span class="slide-brand">${deckName}</span>
      <span class="slide-num">${num.toString().padStart(2, '0')} / ${total.toString().padStart(2, '0')}</span>
      ${eyebrow ? `<div class="eyebrow">${eyebrow}</div>` : ''}
      ${kind === 'title' ? `<h1>${title}</h1>` : (title ? `<h2>${title}</h2>` : '')}
      ${kind !== 'title' ? '<div class="gradient-bar"></div>' : ''}
      ${content}
    </section>`;
}

function deck({ deckName, fileName, title, slides }) {
  const total = slides.length;
  const rendered = slides.map((s, i) => slide({ ...s, num: i + 1, total, deckName })).join('');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${css}</style>
</head>
<body>
  <div class="deck">
    <div class="slides" id="slides">${rendered}</div>
    <div class="deck-nav">
      <button onclick="goPrev()">← Prev</button>
      <span class="progress" id="progress">1 / ${total}</span>
      <button onclick="goNext()">Next →</button>
      <button onclick="toggleOverview()" style="margin-left: 12px;">⊞ Overview</button>
    </div>
    <div class="help-hint">← → arrows · Esc overview</div>
  </div>
  <script>
    var idx = 0;
    var total = ${total};
    var slidesEl = document.getElementById('slides');
    var progEl = document.getElementById('progress');
    function render() {
      slidesEl.style.transform = 'translateX(' + (-idx * 100) + 'vw)';
      progEl.textContent = (idx + 1) + ' / ' + total;
    }
    function goPrev() { if (idx > 0) { idx--; render(); } }
    function goNext() { if (idx < total - 1) { idx++; render(); } }
    function toggleOverview() {
      document.body.classList.toggle('overview');
    }
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { goPrev(); }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); goNext(); }
      else if (e.key === 'Escape') { toggleOverview(); }
      else if (e.key === 'Home') { idx = 0; render(); }
      else if (e.key === 'End') { idx = total - 1; render(); }
    });
    // Click an overview tile to jump to that slide
    slidesEl.addEventListener('click', function (e) {
      if (!document.body.classList.contains('overview')) return;
      var s = e.target.closest('.slide');
      if (!s) return;
      idx = Array.from(slidesEl.children).indexOf(s);
      document.body.classList.remove('overview');
      render();
    });
    render();
  </script>
</body>
</html>`;
}

// ============================================================
// ARMADILLO PITCH DECK
// ============================================================

const armadilloSlides = [
  // 1. Title
  {
    kind: 'title',
    title: 'Armadillo Analytics',
    content: `
      <p class="sub">Multi-platform creator analytics with metrics no other dashboard computes. Five platforms, one media kit, every number a brand actually pays for.</p>
      <div class="platform-row">
        <span class="platform-chip"><span class="dot" style="background:#E1306C;"></span>Instagram</span>
        <span class="platform-chip"><span class="dot" style="background:#00F2EA;"></span>TikTok</span>
        <span class="platform-chip"><span class="dot" style="background:#FF0000;"></span>YouTube</span>
        <span class="platform-chip"><span class="dot" style="background:#1DA1F2;"></span>Twitter / X</span>
        <span class="platform-chip"><span class="dot" style="background:#0A66C2;"></span>LinkedIn</span>
      </div>
    `,
  },

  // 2. The problem
  {
    title: 'Creators are stuck between five dashboards',
    eyebrow: 'The problem',
    content: `
      <p class="lead">You publish on five platforms. Each one gives you different metrics, none of them give you what brands ask for, and assembling a pitch deck the night before a deadline is the actual creator economy.</p>
      <div class="col-3" style="margin-top: 28px;">
        <div class="card">
          <h3>Fragmented data</h3>
          <p>Native analytics on each platform shows what happened. Never explains why. Never compares to other platforms.</p>
        </div>
        <div class="card">
          <h3>No brand-grade metrics</h3>
          <p>Likes don't pay rent. Brands want engagement rate, CPM, audience quality — calibrated per platform.</p>
        </div>
        <div class="card">
          <h3>Stale media kits</h3>
          <p>Built once in Canva, out of date the next week. Brands check live numbers anyway.</p>
        </div>
      </div>
    `,
  },

  // 3. The solution
  {
    title: 'One platform, every metric, every network',
    eyebrow: 'The solution',
    content: `
      <p class="lead">Connect your handles. Hit Fetch. Five platforms scraped, deep compound metrics computed, media kit auto-fills. <strong>Sixty seconds end-to-end.</strong></p>
      <div class="col-3" style="margin-top: 28px;">
        <div class="card card-accent">
          <h3>Live dashboard</h3>
          <p>Heatmaps, engagement trends, content performance, best posting times — all per-platform, all from one login.</p>
        </div>
        <div class="card card-accent">
          <h3>Compound metrics</h3>
          <p>40+ multivariable metrics no other tool computes: FYP Hit Rate, Save:Like Ratio, Document Boost, Discovery Rate, Reaction Diversity.</p>
        </div>
        <div class="card card-accent">
          <h3>One-click media kit</h3>
          <p>Branded PDF, social card, CSV. Refreshes the instant new data lands. Send it without rebuilding it.</p>
        </div>
      </div>
    `,
  },

  // 4. The hero metric — price per post
  {
    title: 'The number brands actually pay for',
    eyebrow: 'Price-per-post, derived',
    content: `
      <div class="col-2" style="align-items: start;">
        <div class="big-stat">
          <span class="label">Estimated price per post</span>
          <span class="num">$3,080</span>
          <span class="ctx">For an Instagram creator with 127K followers at 4.8% engagement. Range across platforms: $1.8K (X) – $6.2K (LinkedIn).</span>
        </div>
        <div class="steps">
          <div class="step-row">
            <div class="step-num">1</div>
            <div class="step-body">
              <h3>Followers × engagement rate</h3>
              <p>Pulled from the latest live scrape. Recalibrated every refresh.</p>
            </div>
          </div>
          <div class="step-row">
            <div class="step-num">2</div>
            <div class="step-body">
              <h3>Platform-tuned CPM</h3>
              <p>IG/TT/X $5-30 · YouTube $10-35 · LinkedIn $30-80. Anchored to real sponsored-post benchmarks per network.</p>
            </div>
          </div>
          <div class="step-row">
            <div class="step-num">3</div>
            <div class="step-body">
              <h3>Engagement multiplier</h3>
              <p>(followers / 1000) × CPM × (1 + engRate/3), capped at 3×. Higher-engagement accounts price up.</p>
            </div>
          </div>
        </div>
      </div>
    `,
  },

  // 5. The optimization layer
  {
    title: 'Tell creators what to post next, not just what they posted',
    eyebrow: 'Optimization signals',
    content: `
      <p class="lead">Every metric on the dashboard is actionable. Not "your engagement is 4.8%" — "your 30-60 character titles beat short ones by 2.3×, your 15-30 second Reels outperform longer ones, post Tuesday at 7 PM."</p>
      <div class="col-4" style="margin-top: 28px;">
        <div class="card">
          <h3 style="color: var(--burnt-light);">Best Time to Post</h3>
          <p>7×24 heatmap per platform. Peak slots highlighted so creators know exactly when to publish.</p>
        </div>
        <div class="card">
          <h3 style="color: var(--burnt-light);">FYP Hit Rate</h3>
          <p>% of TikToks where views exceeded follower count × 1.5. Single brand-pitch number proving algorithmic reach.</p>
        </div>
        <div class="card">
          <h3 style="color: var(--burnt-light);">Title Hook Strength</h3>
          <p>YouTube title char counts bucketed against avg views. Settles "how long should my title be?"</p>
        </div>
        <div class="card">
          <h3 style="color: var(--burnt-light);">Document Boost</h3>
          <p>LinkedIn PDF posts vs others. The single biggest LI algorithm signal, measured for the user's account.</p>
        </div>
      </div>
    `,
  },

  // 6. Media kit
  {
    title: 'The media kit brands actually receive',
    eyebrow: 'One-click pitch artifact',
    content: `
      <div class="col-2" style="align-items: start;">
        <div>
          <p class="lead">Every stat the user picks lands in the kit. Layout matches the persona — Visual (IG/TT), Professional (LinkedIn), Video (YouTube), Community (local business). Branding, colors, photo all configurable.</p>
          <ul class="fancy">
            <li>Live data from latest scrape</li>
            <li>Toggle which metrics appear, hide zero-valued</li>
            <li>Switch between 3 accounts per platform</li>
            <li>PDF + 1080×1080 social card + CSV</li>
            <li>Auto-refreshes when new data lands</li>
          </ul>
        </div>
        <div class="card" style="padding: 0; overflow: hidden;">
          <div style="background: #1B1F23; padding: 18px 20px; border-bottom: 4px solid var(--burnt);">
            <div style="color: white; font-size: 17px; font-weight: 700;">Maya Chen</div>
            <div style="color: rgba(255,255,255,0.6); font-size: 10px; margin-top: 2px;">Beauty & Skincare · @mayachen.tv</div>
          </div>
          <div style="padding: 18px 22px; background: white; color: #1a1a1a; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
            <div style="background: #fafafa; padding: 10px 6px; text-align: center; border-radius: 4px;">
              <div style="font-size: 18px; font-weight: 800; color: #00C9B7;">84K</div>
              <div style="font-size: 8px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Followers</div>
            </div>
            <div style="background: #fafafa; padding: 10px 6px; text-align: center; border-radius: 4px;">
              <div style="font-size: 18px; font-weight: 800; color: #00C9B7;">6.2%</div>
              <div style="font-size: 8px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Eng. Rate</div>
            </div>
            <div style="background: #fafafa; padding: 10px 6px; text-align: center; border-radius: 4px;">
              <div style="font-size: 18px; font-weight: 800; color: #00C9B7;">$2.5K</div>
              <div style="font-size: 8px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">Est. Value</div>
            </div>
            <div style="background: #fafafa; padding: 10px 6px; text-align: center; border-radius: 4px;">
              <div style="font-size: 18px; font-weight: 800; color: #00C9B7;">34%</div>
              <div style="font-size: 8px; color: #999; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">FYP Hit Rate</div>
            </div>
          </div>
          <div style="padding: 14px 20px; background: #fafafa; color: #1a1a1a; font-size: 11px; line-height: 1.5; color: #444;">
            "Skincare creator obsessed with finding products that actually work. Three years of daily content, six brand partnerships, a community that buys what I recommend."
          </div>
          <div style="background: #fafafa; padding: 10px 20px; font-size: 9px; color: #999; border-top: 1px solid #eee; display: flex; justify-content: space-between;">
            <span>Generated by Armadillo Analytics</span>
            <span>May 2026</span>
          </div>
        </div>
      </div>
    `,
  },

  // 7. Account isolation
  {
    title: 'Multi-account, with hard guarantees',
    eyebrow: 'Why agencies trust the data',
    content: `
      <p class="lead">Three handles per platform per login. Each one scoped end-to-end — switching accounts swaps the dashboard, swaps the kit, swaps everything. <strong>No bleed, ever.</strong></p>
      <div class="col-2" style="margin-top: 28px;">
        <div class="card">
          <h3>Per-account snapshot scoping</h3>
          <p style="color: var(--text); line-height: 1.6;">Every analytics snapshot is keyed to <code style="background: var(--card-light); padding: 2px 6px; border-radius: 3px; color: var(--burnt-light);">platform-username</code>. The kit reads only the active account's data. Cleanup runs on every mount to delete legacy unscoped keys.</p>
        </div>
        <div class="card">
          <h3>Repost / non-authored filter</h3>
          <p style="color: var(--text); line-height: 1.6;">TikTok reposts, LinkedIn reshares, Twitter retweets — all dropped at the scrape layer. The dashboard reflects what the creator wrote, not what they amplified. Brands check; the numbers hold.</p>
        </div>
      </div>
    `,
  },

  // 8. Pricing + CTA
  {
    title: 'Pricing',
    eyebrow: 'Get started',
    content: `
      <table class="pitch" style="margin-bottom: 28px;">
        <thead>
          <tr>
            <th></th>
            <th style="text-align: center;">Free</th>
            <th style="text-align: center;">Lite</th>
            <th style="text-align: center;">Pro</th>
          </tr>
        </thead>
        <tbody>
          <tr><td class="tier">Engagement rate, follower growth</td><td class="check">✓</td><td class="check">✓</td><td class="check">✓</td></tr>
          <tr><td class="tier">All compound metrics (40+)</td><td></td><td class="check">✓</td><td class="check">✓</td></tr>
          <tr><td class="tier">Media kit builder + export</td><td></td><td class="check">✓</td><td class="check">✓</td></tr>
          <tr><td class="tier">Multi-account (3 per platform)</td><td></td><td class="check">✓</td><td class="check">✓</td></tr>
          <tr><td class="tier">Audience demographics + authenticity</td><td></td><td></td><td class="check">✓</td></tr>
          <tr><td class="tier">Competitive benchmarking</td><td></td><td></td><td class="check">✓</td></tr>
          <tr><td class="tier">LinkedIn audience intel (seniority, industry)</td><td></td><td></td><td class="check">✓</td></tr>
          <tr><td class="tier">Sentiment analysis, brand affinity</td><td></td><td></td><td class="check">✓</td></tr>
          <tr><td class="tier">Refreshes / platform / month</td><td style="text-align:center;color:var(--muted);">30</td><td style="text-align:center;color:var(--muted);">30</td><td style="text-align:center;color:var(--muted);">30</td></tr>
        </tbody>
      </table>
      <div class="cta-block">
        <div class="cta-text">
          <strong>Try it free.</strong> No credit card. Connect a handle in 60 seconds, see your data on the dashboard immediately.
        </div>
        <a class="btn" href="https://armadillo-analytics.app">Get started</a>
      </div>
    `,
  },
];

writeFileSync(resolve(here, 'armadillo.html'), deck({
  deckName: 'Armadillo Analytics',
  fileName: 'armadillo.html',
  title: 'Armadillo Analytics — Pitch Deck',
  slides: armadilloSlides,
}), 'utf8');
console.log('Built armadillo.html');

// ============================================================
// WHITE-LABEL AGENCY PLATFORM PITCH DECK
// ============================================================

const whitelabelSlides = [
  // 1. Title
  {
    kind: 'title',
    title: 'Your agency, fully white-labeled',
    content: `
      <p class="sub">One custom domain. Sub-sites for every agent. Centralized AI admin, shared content library, social analytics for the whole team — all under your brand, none of ours.</p>
      <div class="platform-row" style="margin-top: 18px;">
        <span class="platform-chip"><span class="dot" style="background: var(--burnt);"></span>Polaris Point websites</span>
        <span class="platform-chip"><span class="dot" style="background: var(--success);"></span>Beacon marketing AI</span>
        <span class="platform-chip"><span class="dot" style="background: #5BA3CF;"></span>Armadillo analytics</span>
      </div>
    `,
  },

  // 2. The problem
  {
    title: 'Your agency runs on five tools, none of them yours',
    eyebrow: 'The agency problem',
    content: `
      <p class="lead">Squarespace for the website. Mailchimp for newsletters. Canva for content. Hootsuite for social. Linktree for the bio. Five logos visible to your clients, five logins, five bills, five places data lives. Your brand fights for oxygen against five other brands.</p>
      <div class="col-3" style="margin-top: 32px;">
        <div class="card">
          <h3>Fractured client experience</h3>
          <p>Your clients see Squarespace's branding when they edit their own site. Beneficial for Squarespace. Not for you.</p>
        </div>
        <div class="card">
          <h3>No central data</h3>
          <p>Your team's content lives in Notion. Your social analytics in Sprout. Your CRM in HubSpot. AI can't read across them.</p>
        </div>
        <div class="card">
          <h3>Sub-account chaos</h3>
          <p>Each agent has their own Mailchimp. Their own Canva. Their own social calendar. You have visibility into none of it.</p>
        </div>
      </div>
    `,
  },

  // 3. The solution overview
  {
    title: 'One platform. Your brand. Every tool your agency needs.',
    eyebrow: 'The solution',
    content: `
      <p class="lead">A bundled platform that runs your entire agency under <strong>your custom domain</strong>. Sub-sites for every agent. Beacon as your content engine with a shared knowledge library and per-agent sub-accounts. Armadillo for social analytics across every account. All white-labeled, all centralized.</p>
      <div class="stack" style="margin-top: 32px;">
        <div class="layer accent">
          <div class="lname">Your custom domain</div>
          <div class="ldesc">Everything below served from yourdomain.com. No Polaris Point, no Beacon, no Armadillo branding visible to your clients.</div>
        </div>
        <div class="layer">
          <div class="lname">Polaris Point websites</div>
          <div class="ldesc">Sub-sites for every agent / location / division. Each editable individually, all governed by your central admin.</div>
        </div>
        <div class="layer">
          <div class="lname">Beacon marketing AI</div>
          <div class="ldesc">Central knowledge library across your agency. Sub-accounts for agents. Generates social posts, newsletters, blog drafts in your brand voice.</div>
        </div>
        <div class="layer">
          <div class="lname">Armadillo analytics</div>
          <div class="ldesc">Multi-platform social analytics rolled up for the whole team. See every agent's performance in one dashboard.</div>
        </div>
      </div>
    `,
  },

  // 4. Sub-sites
  {
    title: 'A site for every agent, governed by you',
    eyebrow: 'White-label sub-sites',
    content: `
      <div class="col-2" style="align-items: start;">
        <div>
          <p class="lead">Each agent / division / property gets their own subpage under your domain: <strong>yourbrokerage.com/agents/lisa</strong>. They edit it, you control it, the design system stays consistent.</p>
          <ul class="fancy">
            <li>Identical layout, agent-specific content</li>
            <li>Agents edit headshots, bios, listings, contact info</li>
            <li>Central admin enforces design, branding, compliance</li>
            <li>Lead capture routes back to the agent + your CRM</li>
            <li>Custom domain coverage — every page is yourbrand.com</li>
          </ul>
        </div>
        <div>
          <div class="card card-accent">
            <h3>Real-estate brokerage example</h3>
            <p style="color: var(--text); margin-top: 8px;">A 38-agent boutique brokerage runs <strong>lonestarteamrealty.com</strong>:</p>
            <ul class="fancy" style="font-size: 14px;">
              <li>Main site: lonestarteamrealty.com</li>
              <li>Per-agent: /agents/maria, /agents/dan, /agents/lisa</li>
              <li>Per-listing: /properties/1247-elm-st</li>
              <li>Per-neighborhood: /neighborhoods/east-austin</li>
              <li>Internal: lonestarteamrealty.com/admin (your team only)</li>
            </ul>
            <p style="color: var(--muted); font-size: 13px; margin-top: 12px;">Lead forms route automatically: agent pages → agent inbox. Property pages → listing agent. Central admin sees every conversation.</p>
          </div>
        </div>
      </div>
    `,
  },

  // 5. Centralized AI admin
  {
    title: 'AI capability built into the back office',
    eyebrow: 'Centralized admin',
    content: `
      <p class="lead">One admin login governs your entire agency. AI-assisted across every product — generate site copy, draft newsletters, write listings, summarize a quarter's social performance, build campaign briefs.</p>
      <div class="col-3" style="margin-top: 28px;">
        <div class="card">
          <h3>AI site editing</h3>
          <p>Generate landing pages, refresh agent bios, write neighborhood guides. Brand voice trained on your existing content.</p>
        </div>
        <div class="card">
          <h3>Per-agent governance</h3>
          <p>Roles, permissions, content moderation. Agents can edit their own pages; you approve or auto-publish based on rules.</p>
        </div>
        <div class="card">
          <h3>Cross-product search</h3>
          <p>Search across every site, every Beacon doc, every Armadillo report from one search bar. AI surfaces what's relevant.</p>
        </div>
        <div class="card">
          <h3>Lead routing & SLA</h3>
          <p>Inbound leads auto-route to the right agent. SLA alerts when responses lag. Manager dashboard shows every open lead.</p>
        </div>
        <div class="card">
          <h3>Compliance & approvals</h3>
          <p>Real estate has rules. Set required disclaimers, mandatory fields, approval workflows for fair-housing compliance.</p>
        </div>
        <div class="card">
          <h3>Team analytics rollup</h3>
          <p>See team-wide site traffic, lead volume, conversion rates, AI usage in a single dashboard.</p>
        </div>
      </div>
    `,
  },

  // 6. Beacon
  {
    title: 'Beacon: your central content brain',
    eyebrow: 'Marketing AI',
    content: `
      <div class="col-2" style="align-items: start;">
        <div>
          <p class="lead">A shared knowledge library across your whole agency — listings, neighborhood data, brand voice, past campaigns. Beacon reads everything and writes in your voice for every channel.</p>
          <ul class="fancy">
            <li>Central library: every property, every blog post, every newsletter</li>
            <li>Brand voice profile shared across all agents</li>
            <li>Drafts social posts, newsletters, blog content, listing descriptions</li>
            <li>Per-agent sub-accounts: agents write their own social with brand-safe AI assist</li>
            <li>Manager review queue before anything publishes</li>
          </ul>
        </div>
        <div>
          <div class="card card-accent">
            <h3>Agent flow</h3>
            <ol style="padding-left: 22px; font-size: 14px; color: var(--text); line-height: 1.8;">
              <li>Agent uploads new listing photos + a few notes</li>
              <li>Beacon writes the listing description in brand voice</li>
              <li>Beacon drafts the matching Instagram caption, X thread, email blast</li>
              <li>Manager reviews + approves (or auto-publishes if rules say so)</li>
              <li>Beacon schedules the publish, tracks results in Armadillo</li>
            </ol>
            <p style="color: var(--muted); font-size: 13px; margin-top: 16px;">Three minutes of agent effort, four channels of polished marketing, central oversight throughout.</p>
          </div>
        </div>
      </div>
    `,
  },

  // 7. Armadillo
  {
    title: 'Armadillo: social analytics, every agent',
    eyebrow: 'Social analytics',
    content: `
      <p class="lead">Every agent's social handles connected to one rolled-up dashboard. See team performance, individual performance, what's working, what's not, what to invest in.</p>
      <div class="col-3" style="margin-top: 28px;">
        <div class="card">
          <h3 style="color: var(--burnt-light);">Team rollup</h3>
          <p>Aggregate followers, engagement, top performers across the agency. Manager sees the whole team in one view.</p>
        </div>
        <div class="card">
          <h3 style="color: var(--burnt-light);">Per-agent dashboards</h3>
          <p>Each agent gets their own Instagram / TikTok / LinkedIn dashboard with all 40+ compound metrics.</p>
        </div>
        <div class="card">
          <h3 style="color: var(--burnt-light);">Auto media kits</h3>
          <p>Generate branded media kits per agent for relocation, builder, or co-marketing partnerships. White-labeled to your brokerage.</p>
        </div>
        <div class="card">
          <h3 style="color: var(--burnt-light);">Content optimization</h3>
          <p>Best time to post per agent, content type winners, hashtag strategy — pushed back into Beacon for content briefs.</p>
        </div>
        <div class="card">
          <h3 style="color: var(--burnt-light);">Competitive benchmarks</h3>
          <p>How does your team perform vs other brokerages in the market? Same metrics, public data.</p>
        </div>
        <div class="card">
          <h3 style="color: var(--burnt-light);">Manager reports</h3>
          <p>Weekly / monthly auto-generated reports per agent, per team, per market. Email PDF in your branding.</p>
        </div>
      </div>
    `,
  },

  // 8. Custom domain / white-label
  {
    title: 'Every URL, every email, every PDF — your brand',
    eyebrow: 'White-label depth',
    content: `
      <p class="lead">There is no Polaris Point branding visible anywhere your clients touch. The system runs invisibly underneath. <strong>You are the brand. Always.</strong></p>
      <div class="col-2" style="margin-top: 28px;">
        <div class="card">
          <h3>Visible to your clients</h3>
          <ul class="fancy" style="font-size: 14px;">
            <li>yourbrand.com — every page</li>
            <li>Your logo, accent color, font system</li>
            <li>Emails sent from yourbrand.com</li>
            <li>PDFs branded as your agency</li>
            <li>Social cards stamped with your mark</li>
            <li>SSL cert in your name</li>
          </ul>
        </div>
        <div class="card">
          <h3>Hidden from your clients</h3>
          <ul class="fancy" style="font-size: 14px;">
            <li>Polaris Point branding (zero references)</li>
            <li>Beacon branding (running silently)</li>
            <li>Armadillo branding (analytics on your terms)</li>
            <li>"Powered by" footers (gone)</li>
            <li>Infrastructure vendors (Vercel, Neon, Anthropic — internal)</li>
            <li>Our pricing pages (replaced by yours)</li>
          </ul>
        </div>
      </div>
    `,
  },

  // 9. Use case deep-dive: real estate
  {
    title: 'Use case: a 38-agent boutique brokerage',
    eyebrow: 'Real estate example',
    content: `
      <p class="lead">Lone Star Team Realty is a 38-agent Austin brokerage. They were paying Squarespace + Mailchimp + Sprout + Canva + Notion. Annual stack cost: ~$31K, plus six different logos in front of clients.</p>
      <div class="col-2" style="margin-top: 28px;">
        <div>
          <h3 style="color: var(--burnt-light);">Before</h3>
          <ul class="fancy" style="font-size: 14px; color: var(--muted);">
            <li>Agent sites built on Squarespace, all branded "Powered by Squarespace"</li>
            <li>Mailchimp newsletters with Mailchimp branding in the footer</li>
            <li>Each agent ran their own Sprout, no team visibility</li>
            <li>Listings written manually, inconsistent voice across agents</li>
            <li>$31K/yr stack cost · 6 vendor logos · agent training in 5 tools</li>
          </ul>
        </div>
        <div>
          <h3 style="color: var(--burnt-light);">After (90 days)</h3>
          <ul class="fancy" style="font-size: 14px;">
            <li>Every page on lonestarteamrealty.com — agents, listings, neighborhoods</li>
            <li>Newsletters from team@lonestarteamrealty.com — zero vendor branding</li>
            <li>Team-wide Armadillo dashboard, manager sees every agent</li>
            <li>Beacon writes every listing in their voice — 3 minutes from photos to publish</li>
            <li>Cost: comparable budget · 1 brand visible · agent training in 1 admin</li>
          </ul>
        </div>
      </div>
    `,
  },

  // 10. Roadmap status
  {
    title: 'Status: building with our first cohort',
    eyebrow: 'Roadmap',
    content: `
      <p class="lead">The white-label platform is in active development. <strong>We're picking the first 10 agencies to build it with.</strong> Pilot pricing, weekly working sessions, deep integration with your existing workflow.</p>
      <div class="col-3" style="margin-top: 28px;">
        <div class="card card-accent">
          <h3>Q2 2026</h3>
          <p>Polaris Point sub-sites with custom domain · Centralized admin v1 · Per-agent permissions · AI site editing</p>
        </div>
        <div class="card card-accent">
          <h3>Q3 2026</h3>
          <p>Beacon central library + agent sub-accounts · Approval workflows · Brand voice training · Email white-labeling</p>
        </div>
        <div class="card card-accent">
          <h3>Q4 2026</h3>
          <p>Armadillo team rollup · Auto media kits per agent · Manager reports · Cross-product AI search</p>
        </div>
      </div>
      <p class="sub" style="margin-top: 32px; font-size: 16px;">Pilot pricing for first ten partners. Final pricing anchored to agency size, not seat count.</p>
    `,
  },

  // 11. CTA
  {
    title: 'Get on the list',
    eyebrow: 'Pilot cohort',
    content: `
      <p class="lead">If your agency manages 5+ creators / agents / properties today and your current stack feels like five logins too many, we want to build with you.</p>
      <div class="col-2" style="margin-top: 24px;">
        <div class="card">
          <h3>What we'll do together</h3>
          <ul class="fancy" style="font-size: 14px;">
            <li>Discovery workshop on your current stack</li>
            <li>Wireframe your custom-domain setup</li>
            <li>Migrate one team's site as a pilot</li>
            <li>Iterate weekly until everyone moves over</li>
          </ul>
        </div>
        <div class="card">
          <h3>What we need from you</h3>
          <ul class="fancy" style="font-size: 14px;">
            <li>Your agency name and size</li>
            <li>Platforms your team currently uses</li>
            <li>One hour for a working session</li>
            <li>Open mind about a 6-month commitment</li>
          </ul>
        </div>
      </div>
      <div class="cta-block" style="margin-top: 32px;">
        <div class="cta-text">
          <strong>Email us:</strong> hello@polarispoint.io · We'll be in touch within 48 hours.
        </div>
        <a class="btn" href="mailto:hello@polarispoint.io">Reach out</a>
      </div>
    `,
  },
];

writeFileSync(resolve(here, 'white-label.html'), deck({
  deckName: 'Polaris Point Platform',
  fileName: 'white-label.html',
  title: 'Polaris Point Platform — White-Label Agency Pitch',
  slides: whitelabelSlides,
}), 'utf8');
console.log('Built white-label.html');

// ---------- Index page for decks ----------
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Pitch Decks — Polaris Point</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${css}
    body { overflow: auto; }
    .deck { position: static; height: auto; }
    .index { max-width: 880px; margin: 60px auto; padding: 0 32px; }
    .index h1 { font-size: 44px; }
    .deck-card {
      display: flex; gap: 28px; align-items: center;
      background: var(--card); border: 1px solid var(--border);
      border-radius: 14px; padding: 28px;
      margin: 18px 0; text-decoration: none; color: var(--text);
      transition: all 0.18s;
    }
    .deck-card:hover { border-color: var(--burnt); transform: translateY(-2px); }
    .deck-card .num { font-size: 64px; font-weight: 800; color: var(--burnt); line-height: 1; min-width: 100px; }
    .deck-card h3 { font-size: 22px; margin: 0 0 6px; }
    .deck-card p { color: var(--muted); margin: 0; line-height: 1.55; }
  </style>
</head>
<body>
  <main class="index">
    <h1>Pitch Decks</h1>
    <p class="sub">Keyboard-navigable HTML decks. ← / → arrows or space to advance, Esc for overview.</p>

    <a class="deck-card" href="armadillo.html">
      <div class="num">01</div>
      <div>
        <h3>Armadillo Analytics</h3>
        <p>Single-product pitch · 8 slides · Problem → Solution → Price-per-post → Optimization → Media kit → Account isolation → Pricing → CTA</p>
      </div>
    </a>

    <a class="deck-card" href="white-label.html">
      <div class="num">02</div>
      <div>
        <h3>Polaris Point Platform — White-Label Agency Pitch</h3>
        <p>Bundled offering pitch · 11 slides · Sub-sites + Centralized AI admin + Beacon + Armadillo, all under one custom domain. Real-estate brokerage use case.</p>
      </div>
    </a>
  </main>
</body>
</html>`;
writeFileSync(resolve(here, 'index.html'), indexHtml, 'utf8');
console.log('Built decks/index.html');
