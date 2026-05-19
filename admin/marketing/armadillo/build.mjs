/**
 * One-off generator for visual marketing one-pagers. Each platform gets a
 * single A4-portrait page with: hero, big price-per-post callout with
 * formula breakdown, three punch metrics with inline mini-charts, a
 * media-kit mockup that mirrors the OneSheet "professional" layout, and a
 * CTA strip. Output is standalone HTML — no app dependencies — so the user
 * can double-click any file and review in a browser.
 *
 * Run from repo root: `node marketing/preview/build.mjs`
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(here, { recursive: true });

const ORANGE = '#BF5700';
const SUCCESS = '#7EC8A0';

// ---------- Shared visual components ----------

const css = `
  :root {
    --bg: #0F1117;
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
    background: #0a0c11;
    color: var(--text);
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .topnav {
    position: sticky; top: 0; z-index: 50;
    background: #0a0c11; border-bottom: 1px solid var(--border);
    padding: 12px 24px; display: flex; align-items: center; justify-content: space-between;
    font-size: 12px;
  }
  .topnav .brand { font-weight: 700; color: var(--burnt); letter-spacing: 2px; text-transform: uppercase; font-size: 10px; }
  .topnav a { color: var(--muted); text-decoration: none; margin-left: 14px; }
  .topnav a:hover { color: var(--text); }

  /* Print-friendly page: ~8.5 x 11 in @ 96dpi = 816 x 1056 but we go a bit
     wider for screen comfort and let the print stylesheet snap it back. */
  .page {
    width: 880px;
    margin: 28px auto;
    background: var(--bg);
    border-radius: 14px;
    border: 1px solid var(--border);
    overflow: hidden;
    box-shadow: 0 12px 48px rgba(0,0,0,0.5);
  }
  @media print {
    @page { size: letter; margin: 0; }
    html, body { background: #fff; }
    .topnav, .footer-nav { display: none; }
    .page { width: 100%; margin: 0; border: 0; border-radius: 0; box-shadow: none; }
  }

  .hero {
    padding: 30px 40px 22px;
    border-bottom: 1px solid var(--border);
    position: relative;
    background: linear-gradient(135deg, rgba(191,87,0,0.08) 0%, transparent 60%);
  }
  .hero .eyebrow {
    font-size: 10px; letter-spacing: 3px; text-transform: uppercase;
    color: var(--burnt); font-weight: 700;
  }
  .hero h1 {
    font-size: 32px; line-height: 1.1; margin: 8px 0 6px;
    letter-spacing: -0.02em; font-weight: 700;
  }
  .hero .sub {
    font-size: 14px; color: var(--muted); margin: 0; max-width: 640px; line-height: 1.5;
  }
  .platform-pill {
    position: absolute; top: 30px; right: 40px;
    display: inline-flex; align-items: center; gap: 8px;
    padding: 6px 14px; border-radius: 999px;
    background: rgba(255,255,255,0.05); border: 1px solid var(--border);
    font-size: 11px; font-weight: 600;
  }
  .platform-pill .dot { width: 8px; height: 8px; border-radius: 50%; }

  /* Hero metric callout — the headline price-per-post number */
  .price-callout {
    margin: 0; padding: 28px 40px;
    display: grid; grid-template-columns: 1.1fr 1fr; gap: 32px;
    border-bottom: 1px solid var(--border);
  }
  .price-big {
    display: flex; flex-direction: column; gap: 4px;
  }
  .price-big .label {
    font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted);
  }
  .price-big .figure {
    font-size: 72px; font-weight: 800; line-height: 1; color: var(--burnt);
    letter-spacing: -0.03em;
  }
  .price-big .range {
    font-size: 13px; color: var(--muted); margin-top: 4px;
  }
  .formula {
    display: flex; flex-direction: column; gap: 10px;
    border-left: 1px solid var(--border); padding-left: 28px;
  }
  .formula .step {
    display: flex; gap: 12px; align-items: flex-start;
  }
  .formula .num {
    flex-shrink: 0;
    width: 22px; height: 22px; border-radius: 50%;
    background: var(--burnt); color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700;
  }
  .formula .step-text { font-size: 12px; line-height: 1.5; }
  .formula .step-text strong { color: var(--text); }
  .formula .step-text .muted { color: var(--muted); }

  /* Dashboard preview — multi-chart grid showing what the product produces */
  .dashboard-preview {
    padding: 24px 40px 8px;
    border-bottom: 1px solid var(--border);
  }
  .dashboard-preview .dash-header {
    display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 16px;
  }
  .dashboard-preview h3 {
    font-size: 16px; font-weight: 700; margin: 0;
  }
  .dashboard-preview .dash-sub {
    font-size: 11px; color: var(--muted); letter-spacing: 1px; text-transform: uppercase;
  }
  .dash-grid {
    display: grid; gap: 14px;
    grid-template-columns: 1.6fr 1fr;
    grid-template-rows: auto auto;
  }
  .dash-card {
    background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 14px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .dash-card.tall { grid-row: span 2; }
  .dash-card .ch-label {
    font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); font-weight: 600;
    display: flex; justify-content: space-between; align-items: baseline;
  }
  .dash-card .ch-label .ch-highlight {
    color: var(--burnt-light); font-size: 12px; font-weight: 700; letter-spacing: 0;
    text-transform: none;
  }
  .dash-card .ch-body { display: flex; align-items: center; flex: 1; }

  /* Punch metrics row */
  .metrics {
    padding: 18px 40px;
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px;
    border-bottom: 1px solid var(--border);
  }
  .metric-card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px;
    display: flex; flex-direction: column; gap: 10px;
  }
  .metric-card .label {
    font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase;
    color: var(--muted); font-weight: 600;
  }
  .metric-card .value {
    font-size: 26px; font-weight: 700; color: var(--burnt-light);
    letter-spacing: -0.02em;
  }
  .metric-card .desc {
    font-size: 11px; line-height: 1.4; color: var(--muted);
  }
  .metric-card .chart { margin-top: auto; }

  /* Media kit preview */
  .kit-section {
    padding: 28px 40px 32px;
    display: grid; grid-template-columns: 0.85fr 1fr; gap: 28px;
    align-items: start;
  }
  .kit-blurb h2 {
    font-size: 18px; margin: 0 0 8px; font-weight: 700;
  }
  .kit-blurb p {
    font-size: 12px; line-height: 1.5; color: var(--muted); margin: 0 0 10px;
  }
  .kit-blurb .kit-features {
    list-style: none; padding: 0; margin: 12px 0 0;
    font-size: 12px;
  }
  .kit-blurb .kit-features li {
    padding: 4px 0 4px 18px; position: relative; color: var(--text);
  }
  .kit-blurb .kit-features li::before {
    content: '✓'; position: absolute; left: 0; top: 4px;
    color: var(--success); font-weight: 700; font-size: 11px;
  }

  /* The media kit mockup — looks like the OneSheet professional layout */
  .kit-mock {
    background: white; color: #1a1a1a;
    border-radius: 8px; overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    font-size: 8px;
    width: 100%;
    aspect-ratio: 8.5 / 11;
    position: relative;
    font-family: 'Inter', sans-serif;
  }
  .kit-mock .kit-header {
    background: #1B1F23; padding: 14px 16px 10px;
    position: relative;
  }
  .kit-mock .kit-accent {
    position: absolute; top: 0; left: 0; right: 0; height: 3px;
  }
  .kit-mock .kit-header-content { display: flex; align-items: center; gap: 10px; }
  .kit-mock .kit-avatar {
    width: 38px; height: 38px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 700; color: white;
  }
  .kit-mock .kit-name { color: white; font-size: 13px; font-weight: 700; line-height: 1.1; }
  .kit-mock .kit-tag { color: rgba(255,255,255,0.6); font-size: 7px; margin-top: 2px; }
  .kit-mock .kit-pills { display: flex; gap: 3px; margin-top: 5px; flex-wrap: wrap; }
  .kit-mock .kit-pill {
    font-size: 5px; padding: 1.5px 5px; border-radius: 2px; color: white; font-weight: 600;
  }
  .kit-mock .kit-pill.muted { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.65); }
  .kit-mock .kit-stats {
    padding: 8px 14px; border-bottom: 1px solid #eee;
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;
  }
  .kit-mock .kit-stat-tile {
    background: #fafafa; border-radius: 4px; padding: 6px 4px; text-align: center;
  }
  .kit-mock .kit-stat-tile .v { font-size: 11px; font-weight: 700; line-height: 1; }
  .kit-mock .kit-stat-tile .l { font-size: 5.5px; color: #999; margin-top: 2px; text-transform: uppercase; letter-spacing: 0.4px; }
  .kit-mock .kit-body { display: flex; height: calc(100% - 158px); }
  .kit-mock .kit-left {
    flex: 1.05; padding: 10px 12px; border-right: 1px solid #f0f0f0;
    display: flex; flex-direction: column; gap: 8px;
  }
  .kit-mock .kit-right {
    flex: 1; padding: 10px 12px; background: #fafafa;
    display: flex; flex-direction: column; gap: 8px;
  }
  .kit-mock .kit-section-label {
    font-size: 5.5px; text-transform: uppercase; letter-spacing: 1.5px; color: #aaa; font-weight: 700;
  }
  .kit-mock .kit-bio { font-size: 7px; line-height: 1.55; color: #444; }
  .kit-mock .kit-cta-block {
    border-left: 2px solid; padding: 5px 8px; border-radius: 0 4px 4px 0;
    font-size: 6.5px; font-style: italic; line-height: 1.4;
  }
  .kit-mock .kit-offerings {
    display: grid; grid-template-columns: 1fr 1fr; gap: 4px;
  }
  .kit-mock .kit-offering {
    background: #fafafa; padding: 4px 6px; border-radius: 3px;
  }
  .kit-mock .kit-offering .n { font-size: 6.5px; font-weight: 700; line-height: 1.2; }
  .kit-mock .kit-offering .d { font-size: 5.5px; color: #888; line-height: 1.3; margin-top: 1px; }
  .kit-mock .kit-insight-row { display: flex; gap: 8px; align-items: flex-start; }
  .kit-mock .kit-badges { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .kit-mock .kit-badge {
    border-radius: 3px; padding: 4px 6px; text-align: center;
  }
  .kit-mock .kit-badge .v { font-size: 9px; font-weight: 800; line-height: 1; }
  .kit-mock .kit-badge .l { font-size: 5px; color: #aaa; margin-top: 1.5px; text-transform: uppercase; letter-spacing: 0.4px; }
  .kit-mock .kit-bar-row { display: flex; align-items: center; gap: 4px; font-size: 5.5px; }
  .kit-mock .kit-bar-row .name { color: #666; width: 30px; text-align: right; }
  .kit-mock .kit-bar-row .bar-track { flex: 1; height: 6px; background: #eee; border-radius: 3px; overflow: hidden; }
  .kit-mock .kit-bar-row .bar-fill { height: 100%; border-radius: 3px; }
  .kit-mock .kit-bar-row .v { font-weight: 700; width: 16px; text-align: left; color: #444; }
  .kit-mock .kit-hashtags { display: flex; flex-wrap: wrap; gap: 2.5px; }
  .kit-mock .kit-hashtag {
    font-size: 6px; padding: 2px 5px; border-radius: 6px; font-weight: 700;
  }
  .kit-mock .kit-footer {
    position: absolute; bottom: 0; left: 0; right: 0;
    background: #fafafa; padding: 4px 12px; font-size: 5.5px;
    color: #999; display: flex; justify-content: space-between; align-items: center;
    border-top: 1px solid #eee;
  }

  /* Engagement donut SVG container */
  .donut-wrap {
    width: 64px; height: 64px; flex-shrink: 0;
    position: relative;
  }
  .donut-wrap text { font-family: inherit; }

  /* CTA strip */
  .cta {
    padding: 18px 40px; display: flex; align-items: center; justify-content: space-between;
    background: linear-gradient(90deg, rgba(191,87,0,0.12), transparent);
    border-top: 1px solid var(--border);
  }
  .cta .cta-text { font-size: 13px; }
  .cta .cta-text strong { font-weight: 700; }
  .cta .cta-text .muted { color: var(--muted); }
  .cta .cta-btn {
    background: var(--burnt); color: white; padding: 10px 18px;
    border-radius: 8px; font-size: 12px; font-weight: 700;
    text-decoration: none; text-transform: uppercase; letter-spacing: 1.5px;
  }

  .footer-nav {
    max-width: 880px; margin: 16px auto 40px;
    text-align: center; font-size: 11px; color: var(--muted);
  }
  .footer-nav a {
    color: var(--muted); text-decoration: none; margin: 0 8px;
  }
  .footer-nav a:hover { color: var(--burnt); }
`;

/** 7-day x 24-hour heatmap with orange intensity squares — mirrors the
 *  PeakHours component in src/components/charts/PeakHours.tsx. Input is
 *  a 7x24 grid of values; the helper normalizes and colors each cell. */
function heatmapPostingTimes(grid, accent = ORANGE) {
  const cellW = 12, cellH = 14, gap = 2;
  const w = 24 * (cellW + gap) + 36;
  const h = 7 * (cellH + gap) + 16;
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const max = Math.max(1, ...grid.flat());
  const cellColor = (v) => {
    const intensity = v / max;
    return `rgba(${parseInt(accent.slice(1,3),16)}, ${parseInt(accent.slice(3,5),16)}, ${parseInt(accent.slice(5,7),16)}, ${0.04 + intensity * 0.85})`;
  };
  let cells = '';
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const x = 28 + hour * (cellW + gap);
      const y = day * (cellH + gap);
      cells += `<rect x="${x}" y="${y}" width="${cellW}" height="${cellH}" rx="2" fill="${cellColor(grid[day][hour])}" />`;
    }
  }
  let dayLabels = '';
  for (let day = 0; day < 7; day++) {
    dayLabels += `<text x="0" y="${day * (cellH + gap) + cellH - 3}" font-size="9" font-weight="600" fill="#8B8D97">${days[day]}</text>`;
  }
  const hourLabels = '<text x="28" y="' + (h - 2) + '" font-size="8" fill="#8B8D97">12a</text>' +
    `<text x="${28 + 6 * (cellW + gap)}" y="${h - 2}" font-size="8" fill="#8B8D97">6a</text>` +
    `<text x="${28 + 12 * (cellW + gap)}" y="${h - 2}" font-size="8" fill="#8B8D97">12p</text>` +
    `<text x="${28 + 18 * (cellW + gap)}" y="${h - 2}" font-size="8" fill="#8B8D97">6p</text>`;
  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" preserveAspectRatio="xMidYMid meet">
      ${dayLabels}${cells}${hourLabels}
    </svg>`;
}

/** Vertical bars showing engagement per hour-of-day (0-23). */
function peakHoursBars(hourValues, accent = ORANGE) {
  const w = 320, h = 70;
  const barW = (w - 20) / 24;
  const max = Math.max(...hourValues, 1);
  const bars = hourValues.map((v, i) => {
    const x = 10 + i * barW;
    const bh = (v / max) * (h - 18);
    const y = h - 14 - bh;
    return `<rect x="${x + 1}" y="${y}" width="${barW - 2}" height="${bh}" rx="2" fill="${accent}" opacity="${0.3 + (v / max) * 0.7}"/>`;
  }).join('');
  const labels =
    `<text x="10" y="${h - 2}" font-size="8" fill="#8B8D97">12a</text>` +
    `<text x="${10 + 6 * barW}" y="${h - 2}" font-size="8" fill="#8B8D97">6a</text>` +
    `<text x="${10 + 12 * barW}" y="${h - 2}" font-size="8" fill="#8B8D97">12p</text>` +
    `<text x="${10 + 18 * barW}" y="${h - 2}" font-size="8" fill="#8B8D97">6p</text>`;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%">${bars}${labels}</svg>`;
}

/** Pie / donut chart for content-type breakdown. */
function contentMixPie(segments, accent = ORANGE) {
  const cx = 50, cy = 50, r = 38;
  const total = segments.reduce((s, x) => s + x.value, 0);
  let start = -Math.PI / 2;
  const slices = segments.map((seg, i) => {
    const angle = (seg.value / total) * Math.PI * 2;
    const end = start + angle;
    const large = angle > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start);
    const y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end);
    const y2 = cy + r * Math.sin(end);
    const path = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    const color = seg.color || (i === 0 ? accent : `rgba(${parseInt(accent.slice(1,3),16)}, ${parseInt(accent.slice(3,5),16)}, ${parseInt(accent.slice(5,7),16)}, ${0.85 - i * 0.18})`);
    start = end;
    return `<path d="${path}" fill="${color}" />`;
  }).join('');
  const legend = segments.map((seg, i) => `
    <div style="display:flex; align-items:center; gap:6px; font-size: 11px; line-height: 1.6;">
      <span style="width: 9px; height: 9px; border-radius: 50%; background: ${seg.color || (i === 0 ? accent : `rgba(${parseInt(accent.slice(1,3),16)}, ${parseInt(accent.slice(3,5),16)}, ${parseInt(accent.slice(5,7),16)}, ${0.85 - i * 0.18})`)};"></span>
      <span style="color: var(--text); font-weight: 500;">${seg.label}</span>
      <span style="color: var(--muted); margin-left: auto;">${Math.round((seg.value / total) * 100)}%</span>
    </div>
  `).join('');
  return `
    <div style="display:flex; align-items:center; gap:14px;">
      <svg viewBox="0 0 100 100" width="92" height="92">${slices}<circle cx="${cx}" cy="${cy}" r="22" fill="var(--card)" /></svg>
      <div style="flex:1; display:flex; flex-direction:column; gap:3px;">${legend}</div>
    </div>`;
}

/** Hashtag-style pills row (largest first). */
function hashtagPills(tags, accent = ORANGE) {
  const rgb = `${parseInt(accent.slice(1,3),16)}, ${parseInt(accent.slice(3,5),16)}, ${parseInt(accent.slice(5,7),16)}`;
  return `
    <div style="display:flex; flex-wrap:wrap; gap:5px;">
      ${tags.map((t, i) => `
        <span style="font-size: 11px; padding: 4px 10px; border-radius: 12px; font-weight: 600; background: ${i === 0 ? accent : `rgba(${rgb}, ${0.14 - i * 0.018})`}; color: ${i === 0 ? 'white' : accent};">
          ${t.tag} <span style="opacity: 0.7; font-weight: 500; margin-left: 2px;">${t.eng}</span>
        </span>
      `).join('')}
    </div>`;
}

/** Top-posts mini grid — 4 small post tiles with engagement count. */
function topPostsGrid(posts, accent = ORANGE) {
  return `
    <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px;">
      ${posts.map(p => `
        <div style="background: var(--card-light); border: 1px solid var(--border); border-radius: 6px; padding: 10px 8px; text-align: center;">
          <div style="font-size: 18px; font-weight: 800; color: ${accent};">${p.value}</div>
          <div style="font-size: 9px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-top: 3px; line-height: 1.3;">${p.label}</div>
        </div>
      `).join('')}
    </div>`;
}

/** Tiny line-chart SVG showing 'engagement trending up' style */
function lineChart(points, color = ORANGE) {
  const w = 220, h = 50;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const coords = points.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 6) - 3;
    return [x, y];
  });
  const path = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;
  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="50">
      <defs>
        <linearGradient id="g-${color.replace('#','')}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.35" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#g-${color.replace('#','')})" />
      <path d="${path}" stroke="${color}" stroke-width="1.8" fill="none" stroke-linecap="round" />
      ${coords.map((p, i) => i === coords.length - 1
        ? `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="${color}" />`
        : '').join('')}
    </svg>`;
}

/** Mini horizontal bar chart used for content-type comparison */
function barChart(rows, color = ORANGE) {
  const max = Math.max(...rows.map(r => r.value));
  return `
    <div style="display:flex; flex-direction:column; gap:6px; width:100%;">
      ${rows.map(r => `
        <div style="display:flex; align-items:center; gap:8px; font-size:10px;">
          <div style="width: 50px; color: var(--muted); text-align: right; font-weight: 600;">${r.label}</div>
          <div style="flex: 1; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
            <div style="height: 100%; width: ${(r.value / max * 100).toFixed(0)}%; background: ${color}; border-radius: 4px;"></div>
          </div>
          <div style="width: 30px; font-weight: 700; color: var(--text);">${r.display}</div>
        </div>
      `).join('')}
    </div>`;
}

/** Donut SVG showing a percentage value */
function donut(rate, accent = ORANGE, size = 64) {
  const dashLen = Math.min(rate / 10, 1) * 251.2;
  return `
    <div class="donut-wrap" style="width:${size}px; height:${size}px;">
      <svg viewBox="0 0 100 100" style="width:100%; height:100%; transform: rotate(-90deg);">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#f0f0f0" stroke-width="8"/>
        <circle cx="50" cy="50" r="40" fill="none" stroke="${accent}" stroke-width="8"
          stroke-dasharray="${dashLen} ${(251.2 - dashLen).toFixed(1)}" stroke-linecap="round"/>
      </svg>
      <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
        <span style="font-size: ${size * 0.22}px; font-weight: 800; color: ${accent}; line-height: 1;">${rate}%</span>
        <span style="font-size: ${size * 0.085}px; color: #999; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 1px;">Eng. Rate</span>
      </div>
    </div>`;
}

/** Returns a mini media kit mockup HTML block — the "professional" layout
 *  variant from OneSheet.tsx, scaled down to fit in a marketing one-pager. */
function kitMock(data) {
  const { accent, name, niche, city, handle, bio, stats, offerings, contentMix, hashtags, callToAction } = data;
  // Convert hex to rgb for translucent accents.
  const rgb = (h => `${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)}`)(accent);
  return `
    <div class="kit-mock">
      <div class="kit-header">
        <div class="kit-accent" style="background: ${accent};"></div>
        <div class="kit-header-content">
          <div class="kit-avatar" style="background: ${accent};">${name[0]}</div>
          <div style="flex: 1;">
            <div class="kit-name">${name}</div>
            <div class="kit-tag">${data.tagline}</div>
            <div class="kit-pills">
              <span class="kit-pill" style="background: ${accent};">${niche}</span>
              <span class="kit-pill muted">${city}</span>
              <span class="kit-pill muted">@${handle}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="kit-stats">
        ${stats.map(s => `
          <div class="kit-stat-tile">
            <div class="v" style="color: ${accent};">${s.v}</div>
            <div class="l">${s.l}</div>
          </div>
        `).join('')}
      </div>
      <div class="kit-body">
        <div class="kit-left">
          <div class="kit-bio">${bio}</div>
          <div class="kit-cta-block" style="border-color: ${accent}; background: rgba(${rgb},0.05);">
            ${callToAction}
          </div>
          <div>
            <div class="kit-section-label" style="margin-bottom: 4px;">Sponsorship Packages</div>
            <div class="kit-offerings">
              ${offerings.map(o => `
                <div class="kit-offering">
                  <div class="n">${o.n}</div>
                  <div class="d">${o.d}</div>
                </div>`).join('')}
            </div>
          </div>
        </div>
        <div class="kit-right">
          <div class="kit-section-label">Performance</div>
          <div class="kit-insight-row">
            ${donut(data.engRate, accent, 56)}
            <div class="kit-badges">
              <div class="kit-badge" style="background: rgba(${rgb},0.08);">
                <div class="v" style="color: ${accent};">${data.heroValue}</div>
                <div class="l">${data.heroLabel}</div>
              </div>
              <div class="kit-badge" style="background: rgba(${rgb},0.05);">
                <div class="v" style="color: ${accent};">${data.secondaryValue}</div>
                <div class="l">${data.secondaryLabel}</div>
              </div>
            </div>
          </div>
          <div>
            <div class="kit-section-label" style="margin-bottom: 4px;">Content Mix</div>
            ${contentMix.map(c => `
              <div class="kit-bar-row">
                <span class="name">${c.name}</span>
                <span class="bar-track"><span class="bar-fill" style="width:${c.pct}%; background: ${accent};"></span></span>
                <span class="v">${c.pct}%</span>
              </div>`).join('')}
          </div>
          <div>
            <div class="kit-section-label" style="margin-bottom: 4px;">Top Hashtags</div>
            <div class="kit-hashtags">
              ${hashtags.map((h, i) => `<span class="kit-hashtag" style="background: ${i === 0 ? accent : `rgba(${rgb},${0.14 - i * 0.018})`}; color: ${i === 0 ? 'white' : accent};">#${h}</span>`).join('')}
            </div>
          </div>
        </div>
      </div>
      <div class="kit-footer">
        <span>Generated by Armadillo Analytics</span>
        <span>${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
      </div>
    </div>`;
}

/** Full page renderer */
function buildPage({ slug, title, eyebrow, sub, accent, color, samplePostValue, postValueRange, formula, metrics, dashboard, kitData, footerNote }) {
  const charts = metrics.map(m => m.chart ?? '').join('');
  void charts; // referenced inline in metric cards
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Armadillo Analytics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${css}</style>
</head>
<body>
  <div class="topnav">
    <span class="brand">Armadillo Analytics · Marketing Preview</span>
    <div>
      <a href="index.html">All pages</a>
    </div>
  </div>

  <div class="page">
    <section class="hero">
      <div class="platform-pill">
        <span class="dot" style="background: ${color};"></span>
        ${eyebrow}
      </div>
      <div class="eyebrow">${eyebrow}</div>
      <h1>${title}</h1>
      <p class="sub">${sub}</p>
    </section>

    <section class="price-callout">
      <div class="price-big">
        <span class="label">Estimated price per post</span>
        <span class="figure">$${samplePostValue.toLocaleString()}</span>
        <span class="range">Typical range: ${postValueRange}</span>
      </div>
      <div class="formula">
        <div style="font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-bottom: 2px;">How we get there</div>
        ${formula.map((step, i) => `
          <div class="step">
            <span class="num">${i + 1}</span>
            <span class="step-text">${step}</span>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="dashboard-preview">
      <div class="dash-header">
        <h3>What you see in the dashboard</h3>
        <span class="dash-sub">Live previews · ${dashboard.summary}</span>
      </div>
      <div class="dash-grid">
        <div class="dash-card tall">
          <div class="ch-label">Best time to post <span class="ch-highlight">${dashboard.bestTime}</span></div>
          <div class="ch-body">${heatmapPostingTimes(dashboard.heatmap, color)}</div>
        </div>
        <div class="dash-card">
          <div class="ch-label">Engagement over time <span class="ch-highlight">${dashboard.engTrend}</span></div>
          <div class="ch-body" style="height: 70px;">${lineChart(dashboard.engOverTime, color)}</div>
        </div>
        <div class="dash-card">
          <div class="ch-label">Peak hours <span class="ch-highlight">${dashboard.peakHour}</span></div>
          <div class="ch-body">${peakHoursBars(dashboard.hourly, color)}</div>
        </div>
      </div>
    </section>

    <section class="metrics">
      ${metrics.map(m => `
        <div class="metric-card">
          <span class="label">${m.label}</span>
          <span class="value">${m.value}</span>
          <span class="desc">${m.desc}</span>
          ${m.chart ? `<div class="chart">${m.chart}</div>` : ''}
        </div>
      `).join('')}
    </section>

    <section class="dashboard-preview" style="border-bottom: 1px solid var(--border);">
      <div class="dash-header">
        <h3>Content optimization at a glance</h3>
        <span class="dash-sub">Three more cards from the live dashboard</span>
      </div>
      <div class="dash-grid" style="grid-template-columns: 1fr 1fr 1fr;">
        <div class="dash-card">
          <div class="ch-label">Content mix <span class="ch-highlight">${dashboard.contentMix[0].label} wins</span></div>
          <div class="ch-body" style="padding: 4px 0;">${contentMixPie(dashboard.contentMix, color)}</div>
        </div>
        <div class="dash-card">
          <div class="ch-label">Top hashtags</div>
          <div class="ch-body" style="padding: 4px 0;">${hashtagPills(dashboard.topHashtags, color)}</div>
        </div>
        <div class="dash-card">
          <div class="ch-label">Performance highlights</div>
          <div class="ch-body" style="padding: 4px 0;">${topPostsGrid(dashboard.highlights, color)}</div>
        </div>
      </div>
    </section>

    <section class="kit-section">
      <div class="kit-blurb">
        <h2>One-click media kit</h2>
        <p>Every metric on this page lands in your media kit automatically. Pick what to show, drop in your branding, export to PDF or a 1080×1080 social card. Auto-refreshes when you fetch fresh data.</p>
        <ul class="kit-features">
          <li>Live data pulled from your handle</li>
          <li>Toggle which stats appear, hide the rest</li>
          <li>Switch between up to 3 accounts</li>
          <li>PDF + social card + CSV exports</li>
        </ul>
      </div>
      ${kitMock(kitData)}
    </section>

    <section class="cta">
      <div class="cta-text">
        <strong>Try it free.</strong> <span class="muted">No credit card. 30 fresh scrapes per platform per month on any tier.</span>
      </div>
      <a class="cta-btn" href="https://armadillo-analytics.app">Get started</a>
    </section>
  </div>

  <div class="footer-nav">
    <a href="index.html">All pages</a> ·
    <a href="tiktok.html">TikTok</a> ·
    <a href="instagram.html">Instagram</a> ·
    <a href="youtube.html">YouTube</a> ·
    <a href="twitter.html">Twitter</a> ·
    <a href="linkedin.html">LinkedIn</a> ·
    <a href="all-platforms.html">All Platforms</a> ·
    <a href="agency-white-label.html">Agency</a>
    ${footerNote ? `<div style="margin-top: 10px; font-size: 10px;">${footerNote}</div>` : ''}
  </div>
</body>
</html>`;
}

// ---------- Sample data generators ----------

/** Build a 7x24 engagement heatmap given a list of peak slots. Each peak
 *  contributes a value at its (day,hour) and a decayed echo at neighboring
 *  cells, so the heatmap looks organic rather than spiky. Returns an array
 *  of 7 arrays of 24 numbers normalized to [0, 1]. */
function makeHeatmap(peaks) {
  const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0.04 + Math.random() * 0.08));
  for (const { day, hour, weight = 1 } of peaks) {
    for (let dd = -1; dd <= 1; dd++) {
      for (let dh = -2; dh <= 2; dh++) {
        const d = (day + dd + 7) % 7;
        const h = hour + dh;
        if (h < 0 || h > 23) continue;
        const decay = 1 - (Math.abs(dd) * 0.4 + Math.abs(dh) * 0.25);
        if (decay <= 0) continue;
        grid[d][h] = Math.max(grid[d][h], decay * weight);
      }
    }
  }
  return grid;
}

/** Build a 24-element hourly bar series from peak hours. */
function makeHourly(peakHours) {
  const arr = Array.from({ length: 24 }, () => 0.06 + Math.random() * 0.1);
  for (const { hour, weight = 1 } of peakHours) {
    for (let dh = -2; dh <= 2; dh++) {
      const h = hour + dh;
      if (h < 0 || h > 23) continue;
      const decay = 1 - Math.abs(dh) * 0.3;
      arr[h] = Math.max(arr[h], decay * weight);
    }
  }
  return arr;
}

// ---------- Per-platform data ----------
// Sample numbers below are illustrative of a mid-tier creator on each
// platform; they let the price-per-post callout show a real-feeling dollar
// figure rather than placeholder text. Brand and engagement specifics are
// grounded in our compound-metrics formulas (estimatedCPM, estimatedPostValue).

const PLATFORMS = {
  tiktok: {
    title: 'TikTok',
    color: '#00F2EA',
    eyebrow: 'For TikTok creators',
    sub: 'Algorithmic-distribution metrics no other dashboard computes. Reposts filtered at the scrape layer so your numbers reflect your work — not someone else’s viral hit.',
    samplePostValue: 2510,
    postValueRange: '$800 – $9,200 for accounts with 50K–500K followers',
    formula: [
      'Pull <strong>followers</strong> and <strong>engagement rate</strong> from your latest scrape. <span class="muted">Sample: 84K followers, 6.2% engagement.</span>',
      'Convert to a <strong>platform-tuned CPM</strong> using TikTok creator benchmarks ($5–30 range). <span class="muted">Higher engagement = higher CPM, capped.</span>',
      'Multiply <strong>(followers / 1000) × CPM × engagement multiplier</strong> to land the final value. <span class="muted">→ ~$2,510 per sponsored post.</span>',
    ],
    metrics: [
      {
        label: 'FYP Hit Rate',
        value: '34%',
        desc: 'Posts where views exceed 1.5× your follower count — proves the algorithm pushed you beyond your bubble.',
        chart: lineChart([12, 18, 22, 14, 28, 31, 26, 34], '#00F2EA'),
      },
      {
        label: 'Save:Like Ratio',
        value: '8.4%',
        desc: 'TikTok weights saves heavily. High ratio = bookmark-worthy content, not scroll-by entertainment.',
        chart: barChart([
          { label: 'Saves', value: 8.4, display: '8%' },
          { label: 'Comments', value: 5.7, display: '6%' },
          { label: 'Shares', value: 3.1, display: '3%' },
        ], '#00F2EA'),
      },
      {
        label: 'Sound Strategy',
        value: '62 / 38',
        desc: 'Original vs trending sound split with per-group engagement. Settles the "original or trend?" question with your own data.',
        chart: barChart([
          { label: 'Original', value: 9200, display: '9.2K' },
          { label: 'Trending', value: 5600, display: '5.6K' },
        ], '#00F2EA'),
      },
    ],
    dashboard: {
      summary: 'last 30 days · 342 videos',
      bestTime: 'Wed/Thu 7-9 PM',
      heatmap: makeHeatmap([
        { day: 2, hour: 19, weight: 1.0 }, { day: 3, hour: 20, weight: 0.95 },
        { day: 1, hour: 21, weight: 0.7 }, { day: 5, hour: 14, weight: 0.6 },
        { day: 6, hour: 11, weight: 0.55 },
      ]),
      engTrend: '+24% over 30 days',
      engOverTime: [3.2, 3.6, 4.1, 4.4, 5.0, 5.3, 5.8, 6.2],
      peakHour: '8 PM',
      hourly: makeHourly([
        { hour: 19, weight: 0.85 }, { hour: 20, weight: 1.0 }, { hour: 21, weight: 0.9 },
        { hour: 12, weight: 0.45 }, { hour: 14, weight: 0.55 },
      ]),
      contentMix: [
        { label: 'GRWM', value: 42 },
        { label: 'Reviews', value: 33 },
        { label: 'Tutorials', value: 25 },
      ],
      topHashtags: [
        { tag: '#skincare', eng: '12.4K' }, { tag: '#GRWM', eng: '8.9K' },
        { tag: '#productreview', eng: '6.2K' }, { tag: '#beautytips', eng: '4.8K' },
        { tag: '#austin', eng: '3.1K' },
      ],
      highlights: [
        { value: '34%', label: 'FYP Hit Rate' },
        { value: '+24%', label: 'Eng. Trend' },
        { value: '8.4%', label: 'Save:Like' },
        { value: '5/wk', label: 'Posting Freq' },
      ],
    },
    kitData: {
      accent: '#00F2EA',
      name: 'Maya Chen',
      tagline: 'Beauty, skincare, and chaos',
      niche: 'Beauty & Skincare',
      city: 'Austin, TX',
      handle: 'mayachen.tv',
      bio: 'Skincare creator obsessed with finding the products that actually work. Three years of daily content, six brand partnerships, and a community that buys what I recommend.',
      callToAction: 'Looking for product reviews, brand integrations, or dedicated videos? Let’s talk.',
      stats: [
        { v: '84.2K', l: 'Followers' },
        { v: '6.2%', l: 'Eng. Rate' },
        { v: '$2.5K', l: 'Est. Value' },
        { v: '342', l: 'Videos' },
      ],
      engRate: 6.2,
      heroValue: '34%',
      heroLabel: 'FYP Hit Rate',
      secondaryValue: '8.4%',
      secondaryLabel: 'Save:Like',
      offerings: [
        { n: 'Dedicated Video', d: '60s integrated review' },
        { n: 'Brand Bundle', d: '3 videos over 30 days' },
        { n: 'UGC Package', d: 'Content for brand use' },
        { n: 'Live Feature', d: 'Brand in livestream' },
      ],
      contentMix: [
        { name: 'GRWM', pct: 42 },
        { name: 'Review', pct: 33 },
        { name: 'Tutorial', pct: 25 },
      ],
      hashtags: ['skincare', 'GRWM', 'productreview', 'beautytips', 'austin'],
    },
  },

  instagram: {
    title: 'Instagram',
    color: '#E1306C',
    eyebrow: 'For Instagram creators',
    sub: 'Format-aware analytics that treat Reels, carousels, and photos as different products. Carousel sweet spot, save:like ratio, and tag multiplier — the metrics IG’s algorithm actually rewards.',
    samplePostValue: 3080,
    postValueRange: '$1,200 – $12,400 for accounts with 50K–500K followers',
    formula: [
      'Pull <strong>followers</strong> and <strong>engagement rate</strong> from your latest scrape. <span class="muted">Sample: 127K followers, 4.8% engagement.</span>',
      'Convert to a <strong>platform-tuned CPM</strong> using Instagram creator benchmarks ($5–30 range, weighted higher when carousel/save signals are strong).',
      'Multiply <strong>(followers / 1000) × CPM × engagement multiplier</strong>. <span class="muted">→ ~$3,080 per sponsored Reel or in-feed post.</span>',
    ],
    metrics: [
      {
        label: 'Carousel Sweet Spot',
        value: '7 slides',
        desc: 'Bucketed engagement by slide count tells you whether to make 3-slide quick hits or 10-slide deep dives.',
        chart: barChart([
          { label: '1', value: 1200, display: '1.2K' },
          { label: '2-3', value: 2400, display: '2.4K' },
          { label: '4-7', value: 4800, display: '4.8K' },
          { label: '8-10', value: 3600, display: '3.6K' },
        ], '#E1306C'),
      },
      {
        label: 'Save:Like Ratio',
        value: '11.2%',
        desc: 'Saves are IG’s strongest algorithmic signal. High ratio = your content is "I’ll come back to this" material.',
        chart: lineChart([7, 8, 9, 11, 10, 12, 11, 13], '#E1306C'),
      },
      {
        label: 'Reels vs Feed',
        value: '+62%',
        desc: 'Engagement lift on Reels vs your photo and carousel posts — tells you where to spend your production time.',
        chart: barChart([
          { label: 'Reels', value: 4200, display: '4.2K' },
          { label: 'Carousel', value: 2600, display: '2.6K' },
          { label: 'Photo', value: 1400, display: '1.4K' },
        ], '#E1306C'),
      },
    ],
    dashboard: {
      summary: 'last 30 days · 24 posts',
      bestTime: 'Sat/Sun 10 AM-12 PM',
      heatmap: makeHeatmap([
        { day: 5, hour: 11, weight: 1.0 }, { day: 6, hour: 10, weight: 0.95 },
        { day: 0, hour: 11, weight: 0.85 }, { day: 2, hour: 18, weight: 0.6 },
        { day: 4, hour: 19, weight: 0.7 },
      ]),
      engTrend: '+18% over 30 days',
      engOverTime: [3.8, 4.0, 3.9, 4.2, 4.5, 4.6, 4.7, 4.8],
      peakHour: '11 AM',
      hourly: makeHourly([
        { hour: 10, weight: 0.85 }, { hour: 11, weight: 1.0 }, { hour: 12, weight: 0.7 },
        { hour: 18, weight: 0.6 }, { hour: 19, weight: 0.55 },
      ]),
      contentMix: [
        { label: 'Reels', value: 55 },
        { label: 'Carousel', value: 30 },
        { label: 'Photo', value: 15 },
      ],
      topHashtags: [
        { tag: '#pasta', eng: '18.7K' }, { tag: '#italian', eng: '14.2K' },
        { tag: '#easyrecipes', eng: '9.8K' }, { tag: '#foodie', eng: '7.4K' },
        { tag: '#nyc', eng: '4.1K' },
      ],
      highlights: [
        { value: '+62%', label: 'Reels Lift' },
        { value: '11.2%', label: 'Save:Like' },
        { value: '7', label: 'Slide SweetSpot' },
        { value: '4/wk', label: 'Posting Freq' },
      ],
    },
    kitData: {
      accent: '#E1306C',
      name: 'Sofia Romano',
      tagline: 'Italian recipes for the home cook',
      niche: 'Food & Cooking',
      city: 'Brooklyn, NY',
      handle: 'sofia.cooks',
      bio: 'Daughter of an Italian grandmother. Sharing the recipes I grew up with — adapted for tiny kitchens and impossible schedules. Featured in Bon Appétit and The Kitchn.',
      callToAction: 'Open to product partnerships with kitchenware, pantry staples, and meal-delivery brands.',
      stats: [
        { v: '127.4K', l: 'Followers' },
        { v: '4.8%', l: 'Eng. Rate' },
        { v: '$3.1K', l: 'Est. Value' },
        { v: '1.2K', l: 'Posts' },
      ],
      engRate: 4.8,
      heroValue: '7 slides',
      heroLabel: 'Carousel Sweet Spot',
      secondaryValue: '+62%',
      secondaryLabel: 'Reels Lift',
      offerings: [
        { n: 'Sponsored Reel', d: '15-60s video integration' },
        { n: 'Carousel Recipe', d: 'Full recipe in-feed' },
        { n: 'Story Package', d: '3 slides + link sticker' },
        { n: 'UGC Bundle', d: 'Content for brand use' },
      ],
      contentMix: [
        { name: 'Reels', pct: 55 },
        { name: 'Carousel', pct: 30 },
        { name: 'Photo', pct: 15 },
      ],
      hashtags: ['pasta', 'italian', 'easyrecipes', 'foodie', 'nyc'],
    },
  },

  youtube: {
    title: 'YouTube',
    color: '#FF0000',
    eyebrow: 'For YouTubers',
    sub: 'Built around the two questions that drive YouTube growth: is the algorithm finding me, and which content format should I make more of? Discovery Rate, Shorts vs Long-form Lift, Title Hook Strength.',
    samplePostValue: 4050,
    postValueRange: '$1,500 – $18,000 for channels with 50K–500K subscribers',
    formula: [
      'Pull <strong>subscribers</strong> and <strong>engagement rate</strong> from your scrape. <span class="muted">Sample: 218K subs, 3.4% engagement.</span>',
      'Convert to a <strong>YouTube-tuned CPM</strong> ($10–35 range, premium because YouTube sponsorships pay more than display ads).',
      'Multiply <strong>(subs / 1000) × CPM × watch-time multiplier</strong>. <span class="muted">→ ~$4,050 per integrated sponsorship.</span>',
    ],
    metrics: [
      {
        label: 'Discovery Rate',
        value: '46%',
        desc: 'Videos where views exceed 1.5× subscribers — proves YouTube’s algorithm is pushing you into Browse/Suggested.',
        chart: lineChart([28, 32, 38, 34, 42, 45, 41, 46], '#FF0000'),
      },
      {
        label: 'Shorts vs Long-form',
        value: '+2.4×',
        desc: 'Lift in engagement on Shorts vs regular videos. Settles the platform’s biggest strategic question for your channel.',
        chart: barChart([
          { label: 'Shorts', value: 28000, display: '28K' },
          { label: 'Long', value: 11500, display: '11K' },
        ], '#FF0000'),
      },
      {
        label: 'Title Hook',
        value: '30–60 chars',
        desc: 'Your titles in the 30–60 character range outperform shorter or longer ones — tested on your last 25 videos.',
        chart: barChart([
          { label: '<30', value: 8500, display: '8.5K' },
          { label: '30-60', value: 14200, display: '14K' },
          { label: '60+', value: 6300, display: '6.3K' },
        ], '#FF0000'),
      },
    ],
    dashboard: {
      summary: 'last 30 days · 8 videos · 12 shorts',
      bestTime: 'Tue/Thu 7-9 PM ET',
      heatmap: makeHeatmap([
        { day: 1, hour: 19, weight: 1.0 }, { day: 3, hour: 20, weight: 0.95 },
        { day: 5, hour: 14, weight: 0.7 }, { day: 6, hour: 11, weight: 0.55 },
        { day: 2, hour: 18, weight: 0.75 },
      ]),
      engTrend: '+12% over 90 days',
      engOverTime: [2.8, 2.9, 3.0, 3.1, 3.2, 3.3, 3.4, 3.4],
      peakHour: '7 PM ET',
      hourly: makeHourly([
        { hour: 18, weight: 0.85 }, { hour: 19, weight: 1.0 }, { hour: 20, weight: 0.9 },
        { hour: 13, weight: 0.5 }, { hour: 14, weight: 0.55 },
      ]),
      contentMix: [
        { label: 'Tutorials', value: 48 },
        { label: 'Reviews', value: 32 },
        { label: 'Shorts', value: 20 },
      ],
      topHashtags: [
        { tag: '#programming', eng: '24K' }, { tag: '#developer', eng: '18K' },
        { tag: '#tech', eng: '12K' }, { tag: '#sideproject', eng: '9.4K' },
        { tag: '#startup', eng: '6.8K' },
      ],
      highlights: [
        { value: '46%', label: 'Discovery Rate' },
        { value: '+2.4×', label: 'Shorts Lift' },
        { value: '30-60', label: 'Title Hook' },
        { value: '2/wk', label: 'Posting Freq' },
      ],
    },
    kitData: {
      accent: '#FF0000',
      name: 'Marcus Tate',
      tagline: 'Building software, in public',
      niche: 'Tech & Reviews',
      city: 'Seattle, WA',
      handle: 'marcustate',
      bio: 'Software engineer turning side projects into real businesses on camera. 218K subs, three years of weekly content, deep-dive tutorials watched by engineering teams at Stripe, Vercel, and Anthropic.',
      callToAction: 'Open to integrated sponsorships from developer tools, infra, and tech-adjacent brands.',
      stats: [
        { v: '218K', l: 'Subscribers' },
        { v: '3.4%', l: 'Eng. Rate' },
        { v: '$4.1K', l: 'Est. Value' },
        { v: '495', l: 'Videos' },
      ],
      engRate: 3.4,
      heroValue: '46%',
      heroLabel: 'Discovery Rate',
      secondaryValue: '2.4×',
      secondaryLabel: 'Shorts Lift',
      offerings: [
        { n: 'Dedicated Video', d: 'Full review of product' },
        { n: 'Integrated Sponsor', d: '60s mid-roll segment' },
        { n: 'Shorts Mention', d: 'Quick feature spot' },
        { n: 'Product Placement', d: 'Organic integration' },
      ],
      contentMix: [
        { name: 'Tutorials', pct: 48 },
        { name: 'Reviews', pct: 32 },
        { name: 'Shorts', pct: 20 },
      ],
      hashtags: ['programming', 'developer', 'tech', 'sideproject', 'startup'],
    },
  },

  twitter: {
    title: 'Twitter / X',
    color: '#1DA1F2',
    eyebrow: 'For X creators',
    sub: 'A dashboard that pulls apart what "engagement" means on X. Quote:Retweet ratio, Reply Engagement, Thread Performance — the signals that prove conversation, not just one-tap shares.',
    samplePostValue: 1840,
    postValueRange: '$600 – $6,800 for accounts with 50K–500K followers',
    formula: [
      'Pull <strong>followers</strong> and <strong>engagement rate</strong> from your scrape. <span class="muted">Sample: 96K followers, 5.1% engagement.</span>',
      'Convert to a <strong>platform-tuned CPM</strong> ($5–25 range; X creator monetization is leaner than IG or TikTok).',
      'Multiply <strong>(followers / 1000) × CPM × engagement multiplier</strong>. <span class="muted">→ ~$1,840 per sponsored tweet or thread.</span>',
    ],
    metrics: [
      {
        label: 'Quote:Retweet Ratio',
        value: '38%',
        desc: 'Quotes prove commentary, retweets prove one-tap shares. Higher ratio = stronger algorithmic signal and better brand pitch.',
        chart: barChart([
          { label: 'Quotes', value: 380, display: '380' },
          { label: 'RTs', value: 1000, display: '1K' },
        ], '#1DA1F2'),
      },
      {
        label: 'Reply Engagement',
        value: '2.3%',
        desc: 'Replies per view. Twitter’s algorithm weights discussion density — this is the cleanest measure of your conversation power.',
        chart: lineChart([1.1, 1.4, 1.8, 1.6, 2.0, 2.2, 2.1, 2.3], '#1DA1F2'),
      },
      {
        label: 'Thread Performance',
        value: '+184%',
        desc: 'Engagement lift on thread starters vs standalone tweets. Threads outperform on X — we measure by how much for you.',
        chart: barChart([
          { label: 'Threads', value: 2840, display: '2.8K' },
          { label: 'Single', value: 1000, display: '1K' },
        ], '#1DA1F2'),
      },
    ],
    dashboard: {
      summary: 'last 30 days · 184 tweets · 12 threads',
      bestTime: 'Mon-Wed 8-11 AM PT',
      heatmap: makeHeatmap([
        { day: 1, hour: 9, weight: 1.0 }, { day: 2, hour: 10, weight: 0.95 },
        { day: 3, hour: 9, weight: 0.85 }, { day: 1, hour: 14, weight: 0.6 },
        { day: 4, hour: 15, weight: 0.55 },
      ]),
      engTrend: '+9% over 30 days',
      engOverTime: [4.6, 4.7, 4.8, 4.9, 5.0, 5.0, 5.1, 5.1],
      peakHour: '9 AM PT',
      hourly: makeHourly([
        { hour: 8, weight: 0.7 }, { hour: 9, weight: 1.0 }, { hour: 10, weight: 0.95 },
        { hour: 11, weight: 0.7 }, { hour: 14, weight: 0.55 }, { hour: 15, weight: 0.6 },
      ]),
      contentMix: [
        { label: 'Threads', value: 55 },
        { label: 'Singles', value: 35 },
        { label: 'Replies', value: 10 },
      ],
      topHashtags: [
        { tag: '#saas', eng: '38K' }, { tag: '#startups', eng: '24K' },
        { tag: '#b2b', eng: '14K' }, { tag: '#building', eng: '11K' },
        { tag: '#product', eng: '8.2K' },
      ],
      highlights: [
        { value: '38%', label: 'Quote:RT' },
        { value: '+184%', label: 'Thread Lift' },
        { value: '2.3%', label: 'Reply Eng.' },
        { value: '6/wk', label: 'Posting Freq' },
      ],
    },
    kitData: {
      accent: '#1DA1F2',
      name: 'Jordan Lee',
      tagline: 'Startup tactics, no fluff',
      niche: 'Startup & Tech',
      city: 'San Francisco',
      handle: 'jordanleewrites',
      bio: 'Former early-stage operator at three Series-A startups. Now writing threads on growth, product, and the unglamorous middle of company-building. 96K readers; threads regularly cited by VCs and operators.',
      callToAction: 'Open to sponsored threads for B2B SaaS, dev tools, and startup-adjacent products.',
      stats: [
        { v: '96.4K', l: 'Followers' },
        { v: '5.1%', l: 'Eng. Rate' },
        { v: '$1.8K', l: 'Est. Value' },
        { v: '2.1K', l: 'Posts' },
      ],
      engRate: 5.1,
      heroValue: '38%',
      heroLabel: 'Quote:RT',
      secondaryValue: '+184%',
      secondaryLabel: 'Thread Lift',
      offerings: [
        { n: 'Sponsored Thread', d: '8-12 tweet deep-dive' },
        { n: 'Single Tweet', d: 'Standalone integration' },
        { n: 'Newsletter Mention', d: 'Feature in monthly' },
        { n: 'Space Co-Host', d: 'Twitter Spaces feature' },
      ],
      contentMix: [
        { name: 'Threads', pct: 55 },
        { name: 'Singles', pct: 35 },
        { name: 'Replies', pct: 10 },
      ],
      hashtags: ['saas', 'startups', 'b2b', 'building', 'product'],
    },
  },

  linkedin: {
    title: 'LinkedIn',
    color: '#0A66C2',
    eyebrow: 'For LinkedIn creators',
    sub: 'The platform where the algorithm rewards format choices over follower counts. Document Boost, External Link Penalty, Reaction Diversity — the LinkedIn-specific levers nobody else surfaces.',
    samplePostValue: 6240,
    postValueRange: '$2,200 – $18,500 for accounts with 25K–250K followers',
    formula: [
      'Pull <strong>followers</strong>, <strong>engagement rate</strong>, and the LinkedIn-specific authority signals. <span class="muted">Sample: 42K followers, 7.1% engagement.</span>',
      'Convert to a <strong>LinkedIn-tuned CPM</strong> ($30–80 range — LinkedIn sponsored posts price materially higher than other platforms because of audience targeting).',
      'Multiply <strong>(followers / 1000) × CPM × engagement multiplier</strong>. <span class="muted">→ ~$6,240 per sponsored post. Premium because the audience is decision-makers.</span>',
    ],
    metrics: [
      {
        label: 'Document Boost',
        value: '+312%',
        desc: 'Engagement lift on PDF/carousel posts vs other types. The single biggest LinkedIn algorithm hack, measured on your account.',
        chart: barChart([
          { label: 'Docs', value: 6400, display: '6.4K' },
          { label: 'Text', value: 1550, display: '1.5K' },
          { label: 'Image', value: 2100, display: '2.1K' },
        ], '#0A66C2'),
      },
      {
        label: 'External Link Penalty',
        value: '-44%',
        desc: 'Engagement delta when your post body contains a URL. Calls out the hidden cost — LinkedIn demotes external links.',
        chart: barChart([
          { label: 'No link', value: 3200, display: '3.2K' },
          { label: 'With', value: 1800, display: '1.8K' },
        ], '#0A66C2'),
      },
      {
        label: 'Reaction Diversity',
        value: '78 / 100',
        desc: 'Shannon-entropy score across LinkedIn reaction types. High = varied emotion (Insightful, Celebrate, Support). Quality signal.',
        chart: barChart([
          { label: 'Insight', value: 42, display: '42%' },
          { label: 'Like', value: 28, display: '28%' },
          { label: 'Celeb.', value: 18, display: '18%' },
          { label: 'Support', value: 12, display: '12%' },
        ], '#0A66C2'),
      },
    ],
    dashboard: {
      summary: 'last 30 days · 22 posts · 6 documents',
      bestTime: 'Tue/Wed 8-10 AM',
      heatmap: makeHeatmap([
        { day: 1, hour: 9, weight: 1.0 }, { day: 2, hour: 8, weight: 0.95 },
        { day: 3, hour: 9, weight: 0.85 }, { day: 1, hour: 11, weight: 0.55 },
        { day: 0, hour: 19, weight: 0.45 },
      ]),
      engTrend: '+22% over 30 days',
      engOverTime: [5.4, 5.8, 6.0, 6.4, 6.6, 6.9, 7.0, 7.1],
      peakHour: '8 AM',
      hourly: makeHourly([
        { hour: 7, weight: 0.55 }, { hour: 8, weight: 1.0 }, { hour: 9, weight: 0.95 },
        { hour: 10, weight: 0.75 }, { hour: 17, weight: 0.4 }, { hour: 18, weight: 0.35 },
      ]),
      contentMix: [
        { label: 'Documents', value: 45 },
        { label: 'Long-form', value: 40 },
        { label: 'Polls', value: 15 },
      ],
      topHashtags: [
        { tag: '#ai', eng: '42K' }, { tag: '#leadership', eng: '28K' },
        { tag: '#strategy', eng: '18K' }, { tag: '#transformation', eng: '12K' },
        { tag: '#corporate', eng: '8.4K' },
      ],
      highlights: [
        { value: '+312%', label: 'Doc Boost' },
        { value: '78/100', label: 'Reaction Qty' },
        { value: '-44%', label: 'Link Penalty' },
        { value: '5/wk', label: 'Posting Freq' },
      ],
    },
    kitData: {
      accent: '#0A66C2',
      name: 'Dr. Amelia Park',
      tagline: 'AI strategy for non-technical leaders',
      niche: 'AI Strategy',
      city: 'Boston',
      handle: 'ameliapark',
      bio: 'Former McKinsey partner, now advising Fortune 500 boards on AI deployment. Weekly long-form posts read by C-suites at JPMorgan, Mastercard, and Pfizer. Forbes contributor.',
      callToAction: 'Available for keynote speaking, board advisory, and corporate AI strategy workshops.',
      stats: [
        { v: '42K', l: 'Followers' },
        { v: '7.1%', l: 'Eng. Rate' },
        { v: '$6.2K', l: 'Est. Value' },
        { v: '410', l: 'Posts' },
      ],
      engRate: 7.1,
      heroValue: '+312%',
      heroLabel: 'Doc Boost',
      secondaryValue: '78/100',
      secondaryLabel: 'Reaction Quality',
      offerings: [
        { n: 'Keynote Speaking', d: 'AI strategy keynote' },
        { n: 'Board Advisory', d: 'Quarterly retainer' },
        { n: 'Workshop (1 day)', d: 'Onsite AI roadmap' },
        { n: 'Sponsored Post', d: 'Thought leadership' },
      ],
      contentMix: [
        { name: 'Documents', pct: 45 },
        { name: 'Long-form', pct: 40 },
        { name: 'Polls', pct: 15 },
      ],
      hashtags: ['ai', 'leadership', 'strategy', 'transformation', 'corporate'],
    },
  },

  'all-platforms': {
    title: 'Every platform you publish on',
    color: ORANGE,
    eyebrow: 'For multi-platform creators',
    sub: 'One login, five platforms, one media kit that pulls live numbers from all of them. Cross-platform compound metrics calibrated per network. The dashboard built for creators who don’t fit in one box.',
    samplePostValue: 3540,
    postValueRange: 'Calibrated per platform: $1.2K (IG) – $6.2K (LinkedIn)',
    formula: [
      'Connect handles for every platform you publish on — TikTok, Instagram, YouTube, X, LinkedIn.',
      'Each platform’s metrics are calibrated to its own CPM range and algorithmic signals. <span class="muted">Same brand-readiness composite, different inputs.</span>',
      'Your media kit aggregates across all of them. One pitch deck, every platform, every metric a brand asks for.',
    ],
    metrics: [
      {
        label: 'Cross-platform reach',
        value: '548K',
        desc: 'Combined audience across all connected platforms. Single number for the "how big is your audience?" question.',
        chart: barChart([
          { label: 'IG', value: 127, display: '127K' },
          { label: 'TT', value: 84, display: '84K' },
          { label: 'YT', value: 218, display: '218K' },
          { label: 'X', value: 96, display: '96K' },
          { label: 'LI', value: 42, display: '42K' },
        ], ORANGE),
      },
      {
        label: 'Brand Readiness',
        value: '82 / 100',
        desc: 'Composite of engagement, consistency, follower tier, content quality. Same score brands underwrite against.',
        chart: lineChart([62, 65, 68, 71, 74, 77, 80, 82], ORANGE),
      },
      {
        label: 'Weighted CPM',
        value: '$28',
        desc: 'Audience-weighted estimated CPM across all your platforms. Anchors what to charge for a multi-platform campaign.',
        chart: barChart([
          { label: 'IG', value: 22, display: '$22' },
          { label: 'TT', value: 18, display: '$18' },
          { label: 'YT', value: 32, display: '$32' },
          { label: 'X', value: 16, display: '$16' },
          { label: 'LI', value: 65, display: '$65' },
        ], ORANGE),
      },
    ],
    dashboard: {
      summary: 'last 30 days · 5 platforms · 184 posts',
      bestTime: 'Mixed schedule per network',
      heatmap: makeHeatmap([
        { day: 1, hour: 19, weight: 0.95 }, { day: 2, hour: 9, weight: 0.9 },
        { day: 3, hour: 20, weight: 0.85 }, { day: 5, hour: 11, weight: 0.8 },
        { day: 6, hour: 14, weight: 0.65 }, { day: 4, hour: 17, weight: 0.6 },
      ]),
      engTrend: '+15% across all networks',
      engOverTime: [4.4, 4.6, 4.8, 5.0, 5.1, 5.3, 5.4, 5.4],
      peakHour: '7-9 PM ET',
      hourly: makeHourly([
        { hour: 8, weight: 0.5 }, { hour: 9, weight: 0.7 }, { hour: 12, weight: 0.45 },
        { hour: 18, weight: 0.85 }, { hour: 19, weight: 1.0 }, { hour: 20, weight: 0.9 },
      ]),
      contentMix: [
        { label: 'TikTok', value: 32 },
        { label: 'Instagram', value: 28 },
        { label: 'YouTube', value: 18 },
        { label: 'X', value: 14 },
        { label: 'LinkedIn', value: 8 },
      ],
      topHashtags: [
        { tag: '#creator', eng: '34K' }, { tag: '#lifestyle', eng: '22K' },
        { tag: '#tech', eng: '14K' }, { tag: '#la', eng: '9.2K' },
        { tag: '#multiplatform', eng: '6.4K' },
      ],
      highlights: [
        { value: '548K', label: 'Combined' },
        { value: '82/100', label: 'Brand Ready' },
        { value: '$28', label: 'Weighted CPM' },
        { value: '5', label: 'Platforms' },
      ],
    },
    kitData: {
      accent: ORANGE,
      name: 'Riley Park',
      tagline: 'Creator across five platforms',
      niche: 'Lifestyle & Tech',
      city: 'Los Angeles',
      handle: 'rileypark',
      bio: 'Cross-platform creator — TikTok skits, Instagram lifestyle, YouTube deep-dives, X commentary, LinkedIn op-eds. Combined audience over 500K, growing 8% monthly across platforms.',
      callToAction: 'Available for integrated multi-platform campaigns. Single price, every platform.',
      stats: [
        { v: '548K', l: 'Combined' },
        { v: '5.4%', l: 'Avg Eng.' },
        { v: '$3.5K', l: 'Est. Value' },
        { v: '5', l: 'Platforms' },
      ],
      engRate: 5.4,
      heroValue: '82/100',
      heroLabel: 'Brand Readiness',
      secondaryValue: '$28',
      secondaryLabel: 'Weighted CPM',
      offerings: [
        { n: 'Multi-platform deal', d: 'IG + TT + YT integrated' },
        { n: 'TikTok Bundle', d: '3 videos, 30 days' },
        { n: 'Newsletter + LI', d: 'B2B thought leadership' },
        { n: 'Full Suite', d: 'All 5 platforms, 60 days' },
      ],
      contentMix: [
        { name: 'TikTok', pct: 32 },
        { name: 'Instagram', pct: 28 },
        { name: 'YouTube', pct: 18 },
        { name: 'X', pct: 14 },
        { name: 'LinkedIn', pct: 8 },
      ],
      hashtags: ['creator', 'multi-platform', 'lifestyle', 'tech', 'la'],
    },
  },

  'agency-white-label': {
    title: 'Armadillo for Agencies',
    color: ORANGE,
    eyebrow: 'White-label · Coming soon',
    sub: 'Manage every client’s analytics across every platform, branded as your agency. Roster management, scheduled reports, white-label dashboards. Built with our first ten agency partners — pilot pricing available.',
    samplePostValue: 'TBD',
    postValueRange: 'Pricing anchored to roster size, not seat count — pilot terms for early partners',
    formula: [
      'Add your full creator roster under one agency login. Each creator scoped independently; no data bleed.',
      'Bulk-refresh on a schedule (weekly, monthly). Generate end-of-month branded reports for every client with one click.',
      'Ship to client inboxes from your domain, in your branding, with no Armadillo marks visible. Your agency is the brand.',
    ],
    metrics: [
      {
        label: 'Roster cap',
        value: 'Unlimited',
        desc: 'Add every creator you represent. Each has their own profile, handles per platform, persona, media kit.',
        chart: barChart([
          { label: 'Roster', value: 50, display: '50' },
          { label: 'Platforms', value: 5, display: '5' },
          { label: 'Reports', value: 250, display: '250/mo' },
        ], ORANGE),
      },
      {
        label: 'White-label depth',
        value: 'Full',
        desc: 'Logo, accent color, custom domain, PDF branding, email from your domain. Zero Armadillo marks visible.',
        chart: barChart([
          { label: 'Logo', value: 1, display: '✓' },
          { label: 'Colors', value: 1, display: '✓' },
          { label: 'Domain', value: 1, display: '✓' },
          { label: 'Email', value: 1, display: '✓' },
        ], ORANGE),
      },
      {
        label: 'Bulk reporting',
        value: '1 click',
        desc: 'Generate branded end-of-month PDFs for every creator on every platform. Scheduled delivery to client inboxes.',
        chart: lineChart([10, 15, 20, 25, 35, 45, 55, 65], ORANGE),
      },
    ],
    dashboard: {
      summary: '38 creators · 5 platforms · 2.4K posts / mo',
      bestTime: 'Aggregated across roster',
      heatmap: makeHeatmap([
        { day: 1, hour: 9, weight: 0.85 }, { day: 2, hour: 11, weight: 0.8 },
        { day: 3, hour: 19, weight: 0.95 }, { day: 4, hour: 18, weight: 0.85 },
        { day: 5, hour: 14, weight: 0.7 }, { day: 6, hour: 11, weight: 0.6 },
      ]),
      engTrend: '+11% roster-wide MoM',
      engOverTime: [4.8, 4.9, 5.1, 5.2, 5.3, 5.4, 5.4, 5.4],
      peakHour: 'Distributed',
      hourly: makeHourly([
        { hour: 9, weight: 0.7 }, { hour: 11, weight: 0.65 }, { hour: 14, weight: 0.6 },
        { hour: 17, weight: 0.75 }, { hour: 19, weight: 1.0 }, { hour: 20, weight: 0.95 },
      ]),
      contentMix: [
        { label: 'Food', value: 32 },
        { label: 'Lifestyle', value: 28 },
        { label: 'Fitness', value: 24 },
        { label: 'Gaming', value: 16 },
      ],
      topHashtags: [
        { tag: '#talent', eng: '120K' }, { tag: '#creators', eng: '88K' },
        { tag: '#campaigns', eng: '54K' }, { tag: '#agency', eng: '32K' },
        { tag: '#partnership', eng: '21K' },
      ],
      highlights: [
        { value: '38', label: 'Active Creators' },
        { value: '12M', label: 'Combined Reach' },
        { value: '$2.4M', label: 'Annual Bookings' },
        { value: '250', label: 'Reports / Mo' },
      ],
    },
    kitData: {
      accent: ORANGE,
      name: 'Lone Star Talent',
      tagline: 'Boutique creator management',
      niche: 'Talent Agency',
      city: 'Austin, TX',
      handle: 'lonestartalent',
      bio: 'We rep 38 creators across food, lifestyle, fitness, and gaming. Quarterly campaign retainers for brands looking to deploy across 3+ creators. Six-figure deals; six-month relationships.',
      callToAction: 'Roster booking, campaign management, and creator vetting for brand partners.',
      stats: [
        { v: '38', l: 'Creators' },
        { v: '5', l: 'Platforms' },
        { v: '12M', l: 'Combined' },
        { v: '$2.4M', l: 'Annual' },
      ],
      engRate: 5.4,
      heroValue: 'Unlimited',
      heroLabel: 'Roster',
      secondaryValue: '1 click',
      secondaryLabel: 'Bulk Reports',
      offerings: [
        { n: 'Single creator', d: 'Brand <-> creator match' },
        { n: 'Campaign (3+)', d: 'Multi-creator deploy' },
        { n: 'Quarterly retainer', d: 'Full roster access' },
        { n: 'Custom roster', d: 'Bespoke creator team' },
      ],
      contentMix: [
        { name: 'Food', pct: 32 },
        { name: 'Lifestyle', pct: 28 },
        { name: 'Fitness', pct: 24 },
        { name: 'Gaming', pct: 16 },
      ],
      hashtags: ['talent', 'agency', 'creators', 'campaigns', 'brands'],
    },
    footerNote: 'White-label is in active development. Reach out at hello@armadillo-analytics.app to be in the first cohort.',
  },
};

// ---------- Build all pages ----------

for (const [slug, data] of Object.entries(PLATFORMS)) {
  const html = buildPage({
    slug,
    ...data,
    accent: data.color,
  });
  writeFileSync(resolve(here, `${slug}.html`), html, 'utf8');
  console.log(`Built ${slug}.html`);
}

// Index page with cards
const indexCards = [
  { slug: 'tiktok', title: 'TikTok', desc: '$2,510 per post · FYP Hit Rate, Save:Like, Sound Strategy', color: '#00F2EA' },
  { slug: 'instagram', title: 'Instagram', desc: '$3,080 per post · Carousel Sweet Spot, Reels Lift', color: '#E1306C' },
  { slug: 'youtube', title: 'YouTube', desc: '$4,050 per sponsorship · Discovery Rate, Shorts vs Long', color: '#FF0000' },
  { slug: 'twitter', title: 'Twitter / X', desc: '$1,840 per post · Quote:RT, Thread Performance', color: '#1DA1F2' },
  { slug: 'linkedin', title: 'LinkedIn', desc: '$6,240 per post · Document Boost, Reaction Diversity', color: '#0A66C2' },
  { slug: 'all-platforms', title: 'All Platforms (unified)', desc: 'Cross-platform creators · 5 networks, one media kit', color: ORANGE },
  { slug: 'agency-white-label', title: 'Agency White-Label', desc: 'Aspirational pitch · Roster management + branding', color: ORANGE },
];

const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Marketing Previews — Armadillo Analytics</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>${css}
    .index-wrap { max-width: 900px; margin: 60px auto 80px; padding: 0 28px; }
    .index-wrap h1 { font-size: 36px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 10px; }
    .index-wrap > p { font-size: 14px; color: var(--muted); margin: 0 0 32px; max-width: 600px; line-height: 1.6; }
    .index-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 16px;
    }
    .index-card {
      display: block; padding: 22px; background: var(--card); border: 1px solid var(--border);
      border-radius: 12px; text-decoration: none; color: var(--text); transition: all 0.18s;
    }
    .index-card:hover { border-color: var(--burnt); transform: translateY(-3px); }
    .index-card .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 8px; vertical-align: middle; }
    .index-card .t { font-weight: 700; font-size: 17px; }
    .index-card .d { font-size: 12px; color: var(--muted); margin-top: 6px; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="topnav">
    <span class="brand">Armadillo Analytics · Marketing Preview</span>
  </div>
  <main class="index-wrap">
    <h1>Marketing one-pagers</h1>
    <p>Seven visual pitch pages — one per platform, one unified, one agency white-label. Each fits on a printed page, leads with the estimated price-per-post, and includes a rendered media-kit mockup.</p>
    <div class="index-grid">
      ${indexCards.map(c => `
        <a class="index-card" href="${c.slug}.html">
          <div class="t"><span class="dot" style="background: ${c.color};"></span>${c.title}</div>
          <div class="d">${c.desc}</div>
        </a>
      `).join('')}
    </div>
  </main>
</body>
</html>`;
writeFileSync(resolve(here, 'index.html'), indexHtml, 'utf8');
console.log('Built index.html');
