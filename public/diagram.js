import { renderMotionGraph } from './motion-graph.js';
// Renders {type:'flow',title,steps[]} as SVG and {type:'table',title,headers,rows} as an HTML table.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function wrap(text, n) {
  const words = String(text).split(/\s+/), lines = []; let l = '';
  for (const w of words) { if ((l + ' ' + w).trim().length > n && l) { lines.push(l); l = w; } else l = (l + ' ' + w).trim(); }
  if (l) lines.push(l); return lines.slice(0, 4);
}
export function renderDiagram(host, d) {
  host.innerHTML = '';
  if (!d || typeof d !== 'object') return;
  if (d.type === 'motion' && Number.isFinite(d.v) && Number.isFinite(d.s)) { renderMotionGraph(host, d); return; }
  const title = d.title ? `<div class="board-title" style="margin-top:12px">${esc(d.title)}</div>` : '';
  if (d.type === 'table' && Array.isArray(d.headers) && Array.isArray(d.rows)) {
    const th = d.headers.map(h => `<th style="border:1px solid #c9d3ea;padding:4px 8px;color:#2f5bea">${esc(h)}</th>`).join('');
    const tr = d.rows.slice(0, 8).map(r => '<tr>' + (Array.isArray(r) ? r : [r]).map(c => `<td style="border:1px solid #dde3ef;padding:4px 8px">${esc(c)}</td>`).join('') + '</tr>').join('');
    host.innerHTML = title + `<table style="border-collapse:collapse;margin-top:6px;font-size:15px;color:#1f2a44"><tr>${th}</tr>${tr}</table>`;
    return;
  }
  if (d.type === 'map' && d.center && Array.isArray(d.branches)) {
    const br = d.branches.slice(0, 6), W = 640, rowH = 78, H = Math.max(120, Math.ceil(br.length / 2) * rowH + 70);
    let g = `<rect x="${W / 2 - 90}" y="8" width="180" height="44" rx="22" fill="#2f5bea"/><text x="${W / 2}" y="35" text-anchor="middle" fill="#fff" font-size="14" font-weight="600" font-family="system-ui,'Noto Sans Devanagari',sans-serif">${esc(String(d.center).slice(0, 26))}</text>`;
    br.forEach((b, i) => {
      const col = i % 2, row = Math.floor(i / 2), x = col ? W / 2 + 14 : 6, y = 70 + row * rowH, w = W / 2 - 20;
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 3);
      g += `<path d="M${W / 2} 52 L${x + w / 2} ${y}" stroke="#9db4f5" stroke-width="2" fill="none"/>`;
      g += `<rect x="${x}" y="${y}" width="${w}" height="${rowH - 10}" rx="10" fill="#e8eeff" stroke="#2f5bea" stroke-width="1.5"/>`;
      g += `<text x="${x + 10}" y="${y + 18}" fill="#2f5bea" font-size="13" font-weight="600" font-family="system-ui,'Noto Sans Devanagari',sans-serif">${esc(String(b.label || '').slice(0, 34))}</text>`;
      g += items.map((it, j) => `<text x="${x + 10}" y="${y + 36 + j * 14}" fill="#1f2a44" font-size="12" font-family="system-ui,'Noto Sans Devanagari',sans-serif">• ${esc(String(it).slice(0, 44))}</text>`).join('');
    });
    host.innerHTML = title + `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">${g}</svg>`;
    return;
  }
  const steps = Array.isArray(d.steps) ? d.steps.slice(0, 6) : [];
  if (!steps.length) return;
  const w = 150, h = 62, gap = 34, W = steps.length * w + (steps.length - 1) * gap + 20, H = h + 24;
  let g = '';
  steps.forEach((s, i) => {
    const x = 10 + i * (w + gap), lines = wrap(s, 18);
    g += `<rect x="${x}" y="12" width="${w}" height="${h}" rx="10" fill="#e8eeff" stroke="#2f5bea" stroke-width="2"/>`;
    g += `<text x="${x + w / 2}" y="${12 + h / 2 - (lines.length - 1) * 8 + 5}" text-anchor="middle" fill="#1f2a44" font-size="13" font-family="system-ui,'Noto Sans Devanagari',sans-serif">` +
      lines.map((ln, j) => `<tspan x="${x + w / 2}" dy="${j ? 16 : 0}">${esc(ln)}</tspan>`).join('') + '</text>';
    if (i < steps.length - 1) { const ax = x + w + 4; g += `<path d="M${ax} ${12 + h / 2} H${ax + gap - 10}" stroke="#2f5bea" stroke-width="3"/><path d="M${ax + gap - 14} ${12 + h / 2 - 6} L${ax + gap - 6} ${12 + h / 2} L${ax + gap - 14} ${12 + h / 2 + 6}" fill="none" stroke="#2f5bea" stroke-width="3"/>`; }
  });
  host.innerHTML = title + `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px">${g}</svg>`;
}
