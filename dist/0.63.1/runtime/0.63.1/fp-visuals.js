/* Form Platform runtime: visuals (step 17)
 * Load after fp-controls.js and before fp-defs.js.
 *
 * Display controls that draw what a formula gives, usually a lookup's list of
 * records. Like value and badge, each is a field: its formula is worked out as
 * the form changes, and every few minutes on a form with visuals.
 *
 *   kpi            one number, with a target and a change since before     a number
 *   gauge          a number against a scale with coloured bands             a number
 *   chart          lines or bars from a list of records                      a list
 *   control-chart  points with mean and control limits, flagging points
 *                  outside them, runs on one side and trends                 a list (or numbers)
 *   pareto         counts by category, largest first, with the categories
 *                  that make up most of the total marked                     a list
 *   board          a tile per record, coloured by its status                 a list
 *   records        a table of records; tap a row for all its values          a list
 *   summary        records added up into rows and columns (a pivot)          a list
 *   tree           an item and what it leads to, branch by branch (a trace)  an item or a list
 *
 * Records name their values by key: a container (measuredOD), id, or the facts
 * every lookup record has: $at (when), $site, $status, $action, $firstAt.
 * Settings that are formulas (target, compare, limits, lines) are worked out
 * with the main formula. Every visual has "Show data" with the numbers it drew.
 * Drawn with the page's own SVG and HTML: no libraries.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.forms) throw new Error('Load fp-forms.js before fp-visuals.js');

  const S = (name, type, label, extra) => Object.assign({ name, type, label }, extra || {});

  /* ---------- Colours (validated categorical order; status kept apart) ---------- */
  const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  const LIGHT_SERIES = '#86b6ef'; // sequential step 250 of the series blue
  /* Own properties only: a status or key named constructor / __proto__ must not reach Object.prototype (F35). */
  const hasOwn = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
  const own = (o, k) => (hasOwn(o, k) ? o[k] : undefined);
  /* Smallest and largest of a list, by loop: Math.min(...list) throws past about 100,000 values. */
  const extent = list => { let lo = Infinity, hi = -Infinity; for (let i = 0; i < list.length; i++) { const v = list[i]; if (v < lo) lo = v; if (v > hi) hi = v; } return { lo, hi }; };
  const STATUS = { good: '#0ca30c', warn: '#fab219', bad: '#d03b3b' };
  const TONE_TEXT = { good: '#006300', warn: '#8a5a00', bad: '#b42318' };
  const ICON = { good: '✓', warn: '!', bad: '✕' };
  const INK = { primary: '#1b1f24', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7', surface: '#fcfcfb' };

  const CSS = `
  .fpv{background:${INK.surface};border:1px solid rgba(11,11,11,.08);border-radius:12px;padding:12px 14px;position:relative}
  .fpv svg{display:block;width:100%;overflow:visible;font:12px system-ui,"Segoe UI",sans-serif}
  .fpv-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin:0 0 8px;font-size:13px;color:${INK.secondary}}
  .fpv-legend span{display:inline-flex;align-items:center;gap:6px}
  .fpv-key{display:inline-block;width:14px;height:3px;border-radius:2px}
  .fpv-key.box{width:10px;height:10px;border-radius:2px}
  .fpv-note{margin-top:8px;font-size:14px;color:${INK.secondary};display:flex;gap:8px;align-items:baseline}
  .fpv-note b{font-weight:700}
  .fpv-flag{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;color:#fff;font-size:12px;font-weight:700;flex:none}
  .fpv details{margin-top:8px;font-size:13px;color:${INK.secondary}}
  .fpv summary{cursor:pointer;min-height:32px;display:flex;align-items:center}
  .fpv-table{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
  .fpv-table th{text-align:left;font-weight:600;color:${INK.secondary};border-bottom:1px solid ${INK.axis};padding:6px 8px;white-space:nowrap}
  .fpv-table td{border-bottom:1px solid ${INK.grid};padding:6px 8px;color:${INK.primary}}
  .fpv-table td.num,.fpv-table th.num{text-align:right}
  .fpv-scroll{max-height:320px;overflow:auto}
  .fpv-scroll .fpv-table th{position:sticky;top:0;z-index:1;background:${INK.surface}}
  .fpv-tip{position:fixed;z-index:9600;pointer-events:none;background:#fff;border:1px solid rgba(11,11,11,.12);border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.14);padding:8px 10px;font:13px/1.35 system-ui,"Segoe UI",sans-serif;color:${INK.primary};max-width:280px}
  .fpv-tip .h{color:${INK.secondary};margin-bottom:4px}
  .fpv-tip .r{display:flex;align-items:center;gap:8px}
  .fpv-tip .r b{font-weight:700}
  .fpv-tip .r span{color:${INK.secondary}}
  .fpv-kpi{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px}
  .fpv-big{font-size:38px;font-weight:600;line-height:1.1;color:${INK.primary}}
  .fpv-big small{font-size:18px;font-weight:500;color:${INK.secondary};margin-left:4px}
  .fpv-delta{font-size:15px;font-weight:600}
  .fpv-chip{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;padding:3px 10px 3px 4px;border-radius:999px;background:#f0efec}
  .fpv-meter{position:relative;height:14px;border-radius:7px;background:#e6e9ee;margin:10px 0 4px}
  .fpv-meter i{position:absolute;left:0;top:0;bottom:0;border-radius:7px}
  .fpv-meter u{position:absolute;top:-4px;bottom:-4px;width:2px;background:${INK.surface}}
  .fpv-scale{position:relative;height:18px;font-size:12px;color:${INK.muted}}
  .fpv-scale span{position:absolute;transform:translateX(-50%);white-space:nowrap}
  .fpv-scale span:first-child{transform:none}.fpv-scale span:last-child{transform:translateX(-100%)}
  .fpv-par{display:grid;grid-template-columns:minmax(80px,32%) 1fr auto;gap:6px 10px;align-items:center;font-size:13px}
  .fpv-par .lab{color:${INK.primary};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fpv-par .fpv-pb{position:relative;height:18px}
  .fpv-par .fpv-pb i{position:absolute;left:0;top:0;bottom:0;border-radius:0 4px 4px 0;min-width:2px}
  .fpv-par .fpv-pb b{position:absolute;top:0;line-height:18px;font-weight:600;color:${INK.primary};padding-left:6px;white-space:nowrap}
  .fpv-par .cum{color:${INK.muted};font-variant-numeric:tabular-nums;text-align:right;min-width:44px}
  .fpv-par .head{color:${INK.muted};font-size:12px}
  .fpv-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
  .fpv-tile{background:#fff;border:1px solid rgba(11,11,11,.1);border-left:5px solid #c3c2b7;border-radius:10px;padding:8px 10px;min-height:64px}
  .fpv-tile b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:15px;overflow:hidden;overflow-wrap:anywhere}
  .fpv-tile .sub{font-size:13px;color:${INK.secondary};overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fpv-tile .st{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:600;margin-top:4px}
  .fpv-tile .fpv-prog{height:8px;margin:6px 0 2px}
  .fpv-pivot{width:100%;border-collapse:collapse;font-size:13px;font-variant-numeric:tabular-nums}
  .fpv-pivot th{font-weight:600;color:${INK.secondary};border-bottom:1px solid ${INK.axis};padding:6px 8px;white-space:nowrap;text-align:right}
  .fpv-pivot th.k,.fpv-pivot td.k{text-align:left}
  .fpv-pivot th.grp{text-align:center;border-bottom:1px solid ${INK.grid};color:${INK.primary}}
  .fpv-pivot td{border-bottom:1px solid ${INK.grid};padding:6px 8px;color:${INK.primary};text-align:right;white-space:nowrap}
  .fpv-pivot tr.sub td.k{padding-left:24px;color:${INK.secondary}}
  .fpv-pivot tr.lvl td{font-weight:600}
  .fpv-pivot tr.tot td{font-weight:700;border-top:1px solid ${INK.axis}}
  .fpv-pivot td.best{background:#e6f4ea;color:#006300;font-weight:700}
  .fpv-pivot td.muted{color:${INK.muted}}
  .fpv-sum{display:flex;flex-wrap:wrap;gap:6px 16px;margin:0 0 10px;font-size:14px;color:${INK.secondary}}
  .fpv-sum b{color:${INK.primary}}
  .fpv-records tr.row{cursor:pointer}.fpv-records tr.row:hover td{background:#f4f6f8}
  .fpv-tile.pick{cursor:pointer}.fpv-tile.sel{outline:3px solid #1f5fbf;outline-offset:-1px;background:#f3f7fd}
  .fpv-records tr.sel td{background:#e7f0fd;box-shadow:inset 0 -2px 0 #1f5fbf}
  .fpv-tree,.fpv-tree ul{list-style:none;margin:0;padding:0}
  .fpv-tree ul{margin-left:18px;border-left:2px solid ${INK.grid};padding-left:8px}
  .fpv-tnode{display:flex;align-items:flex-start;gap:6px;padding:3px 0}
  .fpv-tnode .tg{flex:none;width:32px;min-height:32px;border:0;background:none;font:inherit;font-size:16px;color:${INK.secondary};cursor:pointer}
  .fpv-tnode .tg[disabled]{cursor:default;color:transparent}
  .fpv-tnode .bd{flex:1 1 auto;min-width:0;border-left:4px solid #c3c2b7;border-radius:8px;padding:4px 10px;background:#fff;border-top:1px solid rgba(11,11,11,.08);border-right:1px solid rgba(11,11,11,.08);border-bottom:1px solid rgba(11,11,11,.08)}
  .fpv-tnode .bd.pick{cursor:pointer}.fpv-tnode .bd.sel{outline:3px solid #1f5fbf;outline-offset:-1px;background:#f3f7fd}
  .fpv-tnode b{font-size:15px}.fpv-tnode .lv{font-size:12px;color:${INK.secondary};margin-left:6px}
  .fpv-tnode .sub{font-size:13px;color:${INK.secondary}}
  .fpv-tnode .st{font-size:12px;font-weight:600;margin-left:6px}
  .fpv-tbranch{font-size:12px;font-weight:600;color:${INK.secondary};text-transform:uppercase;letter-spacing:.04em;padding:6px 0 2px}
  .fpv-tbranch .n{font-weight:400;text-transform:none;letter-spacing:0;margin-left:6px}
  .fpv-tbranch.err{color:${TONE_TEXT.bad};text-transform:none;letter-spacing:0}
  .fpv-tmore{font-size:13px;color:${INK.secondary};padding:2px 0 4px 38px}
  .fpv-records td.info{width:40px;text-align:center}.fpv-info{font:inherit;font-size:18px;min-width:36px;min-height:36px;border:0;background:none;color:#1f5fbf;cursor:pointer}
  .fpv-records tr.more td{background:#f8f9fa;color:${INK.secondary};white-space:pre-wrap}
  .fpv-empty{color:#5b6573;font-size:15px}`;
  function injectCss() {
    if (document.getElementById('fp-visuals-css')) return;
    const st = document.createElement('style');
    st.id = 'fp-visuals-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---------- Helpers ---------- */
  const el = (tag, cls, text) => FP.dom.el(tag, cls, text);   // one copy, in fp-core (0.50)
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs, text) => { const n = document.createElementNS(NS, tag); Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v)); if (text != null) n.textContent = text; return n; };
  const special = v => !!(v && typeof v === 'object' && v.__fp);
  const toNum = v => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : null);
  const FACT = { $at: 'When', $firstAt: 'First seen', $site: 'Site', $status: 'Status', $action: 'Last action' };
  const ISO_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
  const toTime = v => (typeof v === 'string' && ISO_RE.test(v) ? Date.parse(v.length === 10 ? v + 'T00:00:00' : v) : null);

  function fmt(n, decimals) {
    if (n == null || !isFinite(n)) return '—';
    const d = decimals != null ? decimals : Math.abs(n) >= 100 ? 0 : Math.abs(n) >= 10 ? 1 : Math.abs(n) >= 1 ? 2 : 3;
    return n.toLocaleString(undefined, { minimumFractionDigits: decimals != null ? d : 0, maximumFractionDigits: d });
  }
  function fmtAxis(n, step) {
    if (Math.abs(n) >= 10000) return (n / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + 'K';
    const d = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
    return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function fmtTime(t, span) {
    const d = new Date(t);
    if (span != null && span < 2 * 864e5) return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  const fmtWhen = t => new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  function fmtCell(v, decimals) {
    if (v == null) return '—';
    if (typeof v === 'number') return fmt(v, decimals);
    const t = toTime(v);
    if (t != null && v.length > 10) return fmtWhen(t);
    if (Array.isArray(v)) return v.map(x => fmtCell(x, decimals)).join(', ');
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  }

  function niceTicks(lo, hi, count) {
    if (!(hi > lo)) { const pad = Math.abs(lo) * 0.1 || 1; lo -= pad; hi += pad; }
    const raw = (hi - lo) / Math.max(1, count);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || 10 * mag;
    const start = Math.floor(lo / step) * step, end = Math.ceil(hi / step) * step;
    const ticks = [];
    for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v / step) * step);
    return { ticks, step, lo: start, hi: end };
  }

  /* A formula's value as a list of records; a list of plain values becomes [{ value }]. */
  function records(v) {
    if (!Array.isArray(v)) return null;
    return v.map(x => (x && typeof x === 'object' && !Array.isArray(x) ? x : { value: x }));
  }

  /* One tooltip for the page: values lead, names follow. Built with textContent. */
  let tip = null;
  function showTip(x, y, head, rows) {
    if (!tip) { tip = el('div', 'fpv-tip'); document.body.appendChild(tip); }
    tip.replaceChildren();
    if (head) tip.appendChild(el('div', 'h', head));
    rows.forEach(r => {
      const row = el('div', 'r');
      if (r.color) { const k = el('i', 'fpv-key'); k.style.background = r.color; row.appendChild(k); }
      row.append(el('b', null, r.value), el('span', null, r.label || ''));
      tip.appendChild(row);
    });
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - w - 8, x + 14) + 'px';
    tip.style.top = Math.max(8, y - h - 12) + 'px';
  }
  const hideTip = () => { if (tip) tip.hidden = true; };

  /* The card a visual draws in, with "Show data" under it. */
  function frame(box) {
    injectCss();
    const card = el('div', 'fpv');
    box.replaceChildren(card);
    return card;
  }
  // Show data under a chart (0.51): only where the form asks for it (showData), so operators aren't given a table to puzzle over.
  function dataTable(card, cols, rows, f) {
    if (!rows.length || !(f && f.showData)) return;
    const det = el('details');
    det.appendChild(el('summary', null, `Show data (${rows.length})`));
    const sc = el('div', 'fpv-scroll');
    const t = el('table', 'fpv-table');
    const hr = el('tr');
    cols.forEach(c => hr.appendChild(el('th', c.num ? 'num' : null, c.label)));
    t.appendChild(hr);
    rows.forEach(r => { const tr = el('tr'); cols.forEach(c => tr.appendChild(el('td', c.num ? 'num' : null, c.get(r)))); t.appendChild(tr); });
    sc.appendChild(t);
    det.appendChild(sc);
    card.appendChild(det);
  }
  const notReady = (box, v, d, what) => {
    if (special(v)) { box.replaceChildren(el('span', d.state, d.text)); return true; }
    if (what && !what(v)) return false;
    return false;
  };
  const say = (box, text) => { injectCss(); box.replaceChildren(el('div', 'fpv-empty', text)); };
  const widthOf = box => Math.max(240, Math.round(box.clientWidth || (box.parentElement && box.parentElement.clientWidth) || 640));

  /* Axes and gridlines for an SVG plot. */
  function plotArea(card, W, H, yTicks, yFmt, left) {
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, height: H, role: 'img' });
    card.appendChild(s);
    const m = { l: left, r: 56, t: 10, b: 26 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const y = v => m.t + ph - ((v - yTicks.lo) / (yTicks.hi - yTicks.lo)) * ph;
    yTicks.ticks.forEach(tk => {
      s.appendChild(svg('line', { x1: m.l, x2: m.l + pw, y1: y(tk), y2: y(tk), stroke: INK.grid, 'stroke-width': 1 }));
      s.appendChild(svg('text', { x: m.l - 8, y: y(tk) + 4, 'text-anchor': 'end', fill: INK.muted }, yFmt(tk)));
    });
    return { s, m, pw, ph, y };
  }
  const leftFor = (ticks, f) => 14 + extent(ticks.ticks.map(t => f(t).length)).hi * 7;
  /* Reference lines across the plot, labelled at the right; labels are spread so none overlap. */
  function refLines(p, list) {
    const items = list.filter(r => r.value != null && isFinite(r.value)).map(r => Object.assign({ yy: p.y(r.value) }, r)).sort((a, b) => a.yy - b.yy);
    items.forEach(r => p.s.appendChild(svg('line', { x1: p.m.l, x2: p.m.l + p.pw, y1: r.yy, y2: r.yy, stroke: r.color, 'stroke-width': 1.25 })));
    let last = -Infinity;
    items.forEach(r => { const ly = Math.max(r.yy + 4, last + 13); last = ly; p.s.appendChild(svg('text', { x: p.m.l + p.pw + 6, y: ly, fill: INK.secondary, 'font-size': 11 }, r.label)); });
  }
  /* x labels: a few, evenly spread; the first starts at its point and the last ends at its point. */
  function xLabels(p, positions, text) {
    const n = positions.length;
    const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(p.pw / 90))));
    positions.forEach((x, i) => {
      if (i % every && i !== n - 1) return;
      if (i !== n - 1 && i !== 0 && n - 1 - i < every * 0.7) return;
      const anchor = n > 1 && i === 0 && x - p.m.l < 30 ? 'start' : n > 1 && i === n - 1 && p.m.l + p.pw - x < 30 ? 'end' : 'middle';
      const t = text(i);
      p.s.appendChild(svg('text', { x, y: p.m.t + p.ph + 18, 'text-anchor': anchor, fill: INK.muted }, t.length > 14 ? t.slice(0, 13) + '…' : t));
    });
  }

  /* ---------- kpi ---------- */
  FP.forms.register('kpi', {
    describe: { label: 'KPI', category: 'visual', data: 'a number', help: 'One number, with an optional target and a change since before.',
      settings: [S('unit', 'text', 'Unit'), S('decimals', 'integer', 'Decimals', { min: 0 }),
        S('target', 'formula', 'Target', { help: 'A number or formula; the KPI shows whether it is met.' }), S('better', 'choice', 'Better is', { options: ['higher', 'lower'], default: 'higher' }),
        S('compare', 'formula', 'Compare with', { help: 'The value before, e.g. last week\'s; shows the change.' }), S('compareLabel', 'text', 'Compared with', { help: 'e.g. last week' })] },
    render(box, v, f, d, x) {
      if (notReady(box, v, d)) return;
      const n = toNum(v);
      // Blank (nothing to work it out from yet, e.g. a percent of 0): a dash, not a complaint.
      if (n == null && (v == null || v === '' || v === false)) { const c = frame(box); const big = el('div', 'fpv-big', '—'); big.style.color = INK.muted; c.appendChild(big); return; }
      if (n == null) { say(box, 'Not a number'); return; }
      const card = frame(box);
      const row = el('div', 'fpv-kpi');
      const big = el('div', 'fpv-big', fmt(n, f.decimals));
      if (f.unit) big.appendChild(el('small', null, f.unit));
      row.appendChild(big);
      const higher = f.better !== 'lower';
      const cmp = toNum(x.compare);
      if (cmp != null) {
        const delta = n - cmp;
        const up = delta > 0, good = delta === 0 ? null : (up === higher);
        const dl = el('span', 'fpv-delta', `${delta === 0 ? '■' : up ? '▲' : '▼'} ${delta > 0 ? '+' : ''}${fmt(delta, f.decimals)}${f.unit ? ' ' + f.unit : ''} vs ${f.compareLabel || 'before'}`);
        dl.style.color = good == null ? INK.secondary : good ? TONE_TEXT.good : TONE_TEXT.bad;
        row.appendChild(dl);
      }
      card.appendChild(row);
      const tg = toNum(x.target);
      if (tg != null) {
        const met = higher ? n >= tg : n <= tg;
        const chip = el('div', 'fpv-chip');
        const flag = el('span', 'fpv-flag', met ? ICON.good : ICON.bad);
        flag.style.background = met ? STATUS.good : STATUS.bad;
        chip.append(flag, el('span', null, `${met ? 'Meets' : 'Misses'} target ${fmt(tg, f.decimals)}${f.unit ? ' ' + f.unit : ''}`));
        chip.style.marginTop = '8px';
        card.appendChild(chip);
      }
    },
  });

  /* ---------- gauge ---------- */
  FP.forms.register('gauge', {
    describe: { label: 'Gauge', category: 'visual', data: 'a number', help: 'A number on a scale, coloured by the band it falls in.',
      settings: [S('min', 'number', 'Lowest', { default: 0 }), S('max', 'number', 'Highest', { required: true }),
        S('bands', 'list', 'Bands', { help: 'From the lowest up, each band ends at "to".', of: [S('to', 'number', 'Up to', { required: true }), S('tone', 'tone', 'Colour', { required: true }), S('label', 'text', 'Label')] }),
        S('unit', 'text', 'Unit'), S('decimals', 'integer', 'Decimals', { min: 0 })] },
    check(f, where, p) { if (typeof f.max === 'number' && f.max <= (f.min || 0)) p.push(`${where}: max must be above min`); },
    render(box, v, f, d) {
      if (notReady(box, v, d)) return;
      const n = toNum(v);
      if (n == null) { say(box, 'Not a number'); return; }
      const lo = f.min || 0, hi = f.max;
      const bands = (f.bands || []).slice().sort((a, b) => a.to - b.to);
      const band = bands.find(b => n <= b.to) || bands[bands.length - 1] || null;
      const card = frame(box);
      const row = el('div', 'fpv-kpi');
      const big = el('div', 'fpv-big', fmt(n, f.decimals));
      if (f.unit) big.appendChild(el('small', null, f.unit));
      row.appendChild(big);
      if (band) {
        const chip = el('div', 'fpv-chip');
        const flag = el('span', 'fpv-flag', ICON[band.tone]);
        flag.style.background = STATUS[band.tone];
        if (band.tone === 'warn') flag.style.color = '#0b0b0b';
        chip.append(flag, el('span', null, band.label || ({ good: 'Good', warn: 'Watch', bad: 'Act' })[band.tone]));
        row.appendChild(chip);
      }
      card.appendChild(row);
      const pct = x => Math.max(0, Math.min(100, ((x - lo) / (hi - lo)) * 100));
      const meter = el('div', 'fpv-meter');
      const fill = el('i');
      fill.style.width = pct(n) + '%';
      fill.style.background = band ? STATUS[band.tone] : SERIES[0];
      meter.appendChild(fill);
      bands.slice(0, -1).forEach(b => { if (b.to > lo && b.to < hi) { const u = el('u'); u.style.left = pct(b.to) + '%'; meter.appendChild(u); } });
      meter.title = `${fmt(n, f.decimals)}${f.unit ? ' ' + f.unit : ''} on a scale of ${fmt(lo)} to ${fmt(hi)}`;
      card.appendChild(meter);
      const scale = el('div', 'fpv-scale');
      // Band ends between the two scale ends, leaving out any too close to a neighbour to read.
      const inner = bands.map(b => b.to).filter(t => t > lo && t < hi && pct(t) > 8 && pct(t) < 92);
      const marks = [lo];
      inner.forEach(t => { if (pct(t) - pct(marks[marks.length - 1]) >= 8) marks.push(t); });
      marks.push(hi);
      marks.forEach(t => { const sp = el('span', null, fmt(t)); sp.style.left = pct(t) + '%'; scale.appendChild(sp); });
      card.appendChild(scale);
    },
  });

  /* ---------- chart: lines or bars ---------- */
  const AGG = ['none', 'count', 'sum', 'average', 'min', 'max', 'latest'];
  function aggregate(list, how) {
    const nums = list.map(r => r.y).filter(n => n != null);
    switch (how) {
      case 'count': return list.length;
      case 'sum': return nums.reduce((a, b) => a + b, 0);
      case 'average': return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
      case 'min': return nums.length ? extent(nums).lo : null;
      case 'max': return nums.length ? extent(nums).hi : null;
      default: return nums.length ? nums[nums.length - 1] : null; // latest
    }
  }
  const dayKey = t => { const dt = new Date(t); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; };

  const CHART = {
    describe: { label: 'Chart', category: 'visual', data: 'a list of records', help: 'Lines or bars from a list, e.g. a lookup over entries.',
      settings: [S('type', 'choice', 'Type', { options: ['line', 'bar'], default: 'line' }),
        S('x', 'text', 'Across (x)', { help: 'A key of each record; default $at, when it was written.' }),
        S('y', 'text', 'Up (y)', { help: 'A key with a number. Leave out to count records.' }),
        S('series', 'text', 'One line or bar per', { help: 'A key that splits the records, e.g. profile. At most 8.' }),
        S('aggregate', 'choice', 'Combine records at the same x', { options: AGG, help: 'Bars default to sum (count without y); lines plot every record.' }),
        S('lines', 'map', 'Reference lines', { help: 'Label: formula, e.g. { "Max": "spec.max" }.', keys: 'text', values: 'formula' }),
        S('last', 'integer', 'Show the last', { min: 1, help: 'Points (or x positions for bars).' }),
        S('unit', 'text', 'Unit'), S('decimals', 'integer', 'Decimals', { min: 0 }), S('height', 'integer', 'Height (px)', { min: 120 }),
        S('showData', 'boolean', 'Show data under it', { help: 'A Show data table under it (0.51); off unless the form asks.' })] },
    render(box, v, f, d, x) {
      if (notReady(box, v, d)) return;
      const recs = records(v);
      if (!recs) { say(box, 'Not a list'); return; }
      if (!recs.length) { say(box, 'Nothing to show yet'); return; }
      const bar = f.type === 'bar';
      const xKey = f.x || '$at', yKey = f.y || (recs.every(r => 'value' in r) ? 'value' : null);
      const how = f.aggregate || (bar ? (yKey ? 'sum' : 'count') : 'none');
      const timeX = recs.filter(r => r[xKey] != null).every(r => toTime(r[xKey]) != null);
      // Points: { x (time or label), s (series), y }
      let pts = recs.map(r => ({ xv: r[xKey], t: timeX ? toTime(r[xKey]) : null, s: f.series ? String(r[f.series] == null ? '—' : r[f.series]) : '', y: yKey ? toNum(r[yKey]) : 1, r }))
        .filter(p => p.xv != null && (how === 'count' || p.y != null));
      if (!pts.length) { say(box, 'Nothing to show yet'); return; }
      if (timeX) pts.sort((a, b) => a.t - b.t);
      // Bars over time group by day; categories keep their first-seen order.
      if (how !== 'none') {
        const groups = new Map();
        pts.forEach(p => {
          const k = timeX && bar ? dayKey(p.t) : String(p.xv);
          const g = groups.get(k + '\u0000' + p.s) || { k, s: p.s, list: [], t: timeX ? (bar ? toTime(dayKey(p.t)) : p.t) : null };
          g.list.push(p);
          groups.set(k + '\u0000' + p.s, g);
        });
        pts = Array.from(groups.values()).map(g => ({ xv: g.k, t: g.t, s: g.s, y: aggregate(g.list, how), n: g.list.length }));
      }
      const seriesNames = Array.from(new Set(pts.map(p => p.s))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const shownSeries = seriesNames.slice(0, 8);
      pts = pts.filter(p => shownSeries.includes(p.s));
      const xs = Array.from(new Set(pts.map(p => (timeX ? p.t : String(p.xv)))));
      if (timeX) xs.sort((a, b) => a - b);
      const keepX = f.last && xs.length > f.last ? new Set(xs.slice(-f.last)) : null;
      if (keepX) pts = pts.filter(p => keepX.has(timeX ? p.t : String(p.xv)));
      const xList = keepX ? xs.slice(-f.last) : xs;
      const color = s => SERIES[shownSeries.indexOf(s)];
      const refs = Object.entries(x.lines || {}).map(([label, val]) => ({ label, y: toNum(val) })).filter(r => r.y != null);

      const card = frame(box);
      if (shownSeries.length > 1) {
        const lg = el('div', 'fpv-legend');
        shownSeries.forEach(s => { const sp = el('span'); const k = el('i', 'fpv-key' + (bar ? ' box' : '')); k.style.background = color(s); sp.append(k, document.createTextNode(s)); lg.appendChild(sp); });
        if (seriesNames.length > 8) lg.appendChild(el('span', null, `(+${seriesNames.length - 8} more not shown)`));
        card.appendChild(lg);
      }
      const ys = pts.map(p => p.y).concat(refs.map(r => r.y));
      const ext = extent(ys);
      let lo = ext.lo, hi = ext.hi;
      if (bar) lo = Math.min(0, lo), hi = Math.max(0, hi);
      const yt = niceTicks(lo, hi, 5);
      const yFmt = t => fmtAxis(t, yt.step);
      const W = widthOf(box) - 30, H = f.height || 240;
      const p = plotArea(card, W, H, yt, yFmt, leftFor(yt, yFmt));
      const span = timeX && xList.length > 1 ? xList[xList.length - 1] - xList[0] : null;
      // x positions: time scale for lines over time; even bands otherwise.
      const band = p.pw / Math.max(1, xList.length);
      const xPos = xv => {
        if (timeX && !bar) return xList.length > 1 ? p.m.l + ((xv - xList[0]) / (xList[xList.length - 1] - xList[0])) * p.pw : p.m.l + p.pw / 2;
        return p.m.l + band * (xList.indexOf(xv) + 0.5);
      };
      const xOf = pt => xPos(timeX ? pt.t : String(pt.xv));
      xLabels(p, xList.map(xPos), i => (timeX ? fmtTime(xList[i], span) : String(xList[i])));
      p.s.appendChild(svg('line', { x1: p.m.l, x2: p.m.l + p.pw, y1: p.y(Math.max(yt.lo, Math.min(yt.hi, 0)) || yt.lo), y2: p.y(Math.max(yt.lo, Math.min(yt.hi, 0)) || yt.lo), stroke: INK.axis, 'stroke-width': 1 }));
      refLines(p, refs.map(r => ({ value: r.y, label: `${r.label} ${fmt(r.y, f.decimals)}`, color: INK.secondary })));
      const valText = y => `${fmt(y, f.decimals)}${f.unit ? ' ' + f.unit : ''}`;

      if (bar) {
        const n = shownSeries.length;
        const bw = Math.max(3, Math.min(24, (band * 0.8) / n - 2));
        const base = p.y(Math.max(yt.lo, Math.min(yt.hi, 0)));
        pts.forEach(pt => {
          const i = shownSeries.indexOf(pt.s);
          const cx = xOf(pt) - (n * (bw + 2)) / 2 + i * (bw + 2) + bw / 2;
          const top = p.y(pt.y), h = Math.abs(base - top), r = Math.min(4, h / 2, bw / 2);
          const up = pt.y >= 0;
          const x0 = cx - bw / 2, x1 = cx + bw / 2, ye = up ? top : top;
          const dPath = up
            ? `M${x0},${base}V${ye + r}Q${x0},${ye} ${x0 + r},${ye}H${x1 - r}Q${x1},${ye} ${x1},${ye + r}V${base}Z`
            : `M${x0},${base}V${ye - r}Q${x0},${ye} ${x0 + r},${ye}H${x1 - r}Q${x1},${ye} ${x1},${ye - r}V${base}Z`;
          const path = svg('path', { d: dPath, fill: color(pt.s) });
          const hit = svg('rect', { x: cx - Math.max(bw, 24) / 2, y: p.m.t, width: Math.max(bw, 24), height: p.ph, fill: 'transparent' });
          const head = timeX ? fmtTime(pt.t) : String(pt.xv);
          hit.addEventListener('pointermove', e => { path.setAttribute('opacity', '.8'); showTip(e.clientX, e.clientY, head, [{ value: valText(pt.y), label: pt.s || (how === 'count' ? 'records' : ''), color: color(pt.s) }]); });
          hit.addEventListener('pointerleave', () => { path.removeAttribute('opacity'); hideTip(); });
          p.s.append(path, hit);
        });
      } else {
        shownSeries.forEach(sn => {
          const line = pts.filter(pt => pt.s === sn);
          if (!line.length) return;
          p.s.appendChild(svg('path', { d: line.map((pt, i) => `${i ? 'L' : 'M'}${xOf(pt).toFixed(1)},${p.y(pt.y).toFixed(1)}`).join(''), fill: 'none', stroke: color(sn), 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
          const dots = line.length <= 40 ? line : [line[line.length - 1]];
          dots.forEach(pt => p.s.appendChild(svg('circle', { cx: xOf(pt), cy: p.y(pt.y), r: 4, fill: color(sn), stroke: INK.surface, 'stroke-width': 2 })));
          if (shownSeries.length <= 4) { const last = line[line.length - 1]; p.s.appendChild(svg('text', { x: xOf(last) + 8, y: p.y(last.y) - 8, fill: INK.secondary, 'font-size': 11 }, fmt(last.y, f.decimals))); }
        });
        // Crosshair: snaps to the nearest x and lists every series there.
        const cross = svg('line', { y1: p.m.t, y2: p.m.t + p.ph, stroke: INK.axis, 'stroke-width': 1, visibility: 'hidden' });
        const overlay = svg('rect', { x: p.m.l, y: p.m.t, width: p.pw, height: p.ph, fill: 'transparent' });
        p.s.append(cross, overlay);
        overlay.addEventListener('pointermove', e => {
          const r = p.s.getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          let best = null;
          pts.forEach(pt => { const dx = Math.abs(xOf(pt) - px); if (!best || dx < best.dx) best = { dx, pt }; });
          if (!best) return;
          const at = timeX ? best.pt.t : String(best.pt.xv);
          const xx = xOf(best.pt);
          cross.setAttribute('x1', xx); cross.setAttribute('x2', xx); cross.setAttribute('visibility', 'visible');
          const here = shownSeries.map(sn => pts.filter(q => q.s === sn).reduce((b, q) => (!b || Math.abs(xOf(q) - xx) < Math.abs(xOf(b) - xx) ? q : b), null)).filter(Boolean);
          showTip(e.clientX, e.clientY, timeX ? fmtWhen(at) : String(at), here.map(q => ({ value: valText(q.y), label: q.s, color: color(q.s) })));
        });
        overlay.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
      }
      dataTable(card, [
        { label: timeX ? 'When' : (f.x || 'x'), get: pt => (timeX ? fmtWhen(pt.t) : String(pt.xv)) },
        ...(f.series ? [{ label: f.series, get: pt => pt.s }] : []),
        { label: yKey || 'count', num: true, get: pt => fmt(pt.y, f.decimals) },
      ], pts, f);
    },
  };
  FP.forms.register('chart', CHART);

  /* ---------- control-chart: individuals with moving-range limits ---------- */
  FP.forms.register('control-chart', {
    describe: { label: 'Control chart', category: 'visual', data: 'a list of records (or numbers)',
      help: 'Each reading in order, with the mean and control limits (mean ± 2.66 × average moving range unless given). Flags points outside the limits, runs on one side of the mean, and steady trends.',
      settings: [S('value', 'text', 'Reading', { help: 'The key with the number; not needed for a list of numbers.' }),
        S('x', 'text', 'Labelled by', { help: 'Default $at, when it was written.' }),
        S('center', 'formula', 'Mean (fixed)'), S('ucl', 'formula', 'Upper control limit (fixed)'), S('lcl', 'formula', 'Lower control limit (fixed)'),
        S('usl', 'formula', 'Upper spec limit'), S('lsl', 'formula', 'Lower spec limit'),
        S('last', 'integer', 'Show the last', { min: 2, default: 50 }), S('runLength', 'integer', 'Run length to flag', { min: 5, default: 8 }),
        S('unit', 'text', 'Unit'), S('decimals', 'integer', 'Decimals', { min: 0 }), S('height', 'integer', 'Height (px)', { min: 140 }),
        S('showData', 'boolean', 'Show data under it', { help: 'A Show data table under it (0.51); off unless the form asks.' })] },
    render(box, v, f, d, x) {
      if (notReady(box, v, d)) return;
      const recs = records(v);
      if (!recs) { say(box, 'Not a list'); return; }
      const key = f.value || 'value', xKey = f.x || '$at';
      let pts = recs.map(r => ({ y: toNum(r[key]), t: toTime(r[xKey]), lab: r[xKey], r })).filter(pt => pt.y != null);
      if (pts.every(pt => pt.t != null)) pts.sort((a, b) => a.t - b.t);
      pts = pts.slice(-(f.last || 50));
      if (!pts.length) { say(box, 'No readings yet'); return; }
      const ys = pts.map(pt => pt.y);
      const mean = toNum(x.center) != null ? toNum(x.center) : ys.reduce((a, b) => a + b, 0) / ys.length;
      const mrs = ys.slice(1).map((y, i) => Math.abs(y - ys[i]));
      const mrBar = mrs.length ? mrs.reduce((a, b) => a + b, 0) / mrs.length : 0;
      const ucl = toNum(x.ucl) != null ? toNum(x.ucl) : mrs.length ? mean + 2.66 * mrBar : null;
      const lcl = toNum(x.lcl) != null ? toNum(x.lcl) : mrs.length ? mean - 2.66 * mrBar : null;
      const usl = toNum(x.usl), lsl = toNum(x.lsl);
      // Rules: outside the limits; a run on one side of the mean; a steady trend of 6.
      const flags = pts.map(() => []);
      const findings = [];
      const out = pts.map((pt, i) => (ucl != null && pt.y > ucl) || (lcl != null && pt.y < lcl) ? i : -1).filter(i => i >= 0);
      out.forEach(i => flags[i].push('outside the control limits'));
      if (out.length) findings.push(`${out.length} point${out.length === 1 ? '' : 's'} outside the control limits`);
      const runN = f.runLength || 8;
      let run = 0, side = 0, runs = 0;
      pts.forEach((pt, i) => {
        const sd = pt.y > mean ? 1 : pt.y < mean ? -1 : 0;
        run = sd !== 0 && sd === side ? run + 1 : sd !== 0 ? 1 : 0;
        side = sd;
        if (run >= runN) { for (let k = i - run + 1; k <= i; k++) if (!flags[k].includes('run')) flags[k].push('run'); if (run === runN) runs++; }
      });
      if (runs) findings.push(`${runs} run${runs === 1 ? '' : 's'} of ${runN} or more on one side of the mean`);
      let trend = 1, trends = 0;
      for (let i = 1; i < pts.length; i++) {
        const dir = Math.sign(pts[i].y - pts[i - 1].y), prev = i > 1 ? Math.sign(pts[i - 1].y - pts[i - 2].y) : 0;
        trend = dir !== 0 && dir === prev ? trend + 1 : dir !== 0 ? 2 : 1;
        if (trend >= 6) { for (let k = i - trend + 1; k <= i; k++) if (!flags[k].includes('trend')) flags[k].push('trend'); if (trend === 6) trends++; }
      }
      if (trends) findings.push(`${trends} steady trend${trends === 1 ? '' : 's'} of 6 or more`);
      const flagged = i => flags[i].length > 0;

      const card = frame(box);
      const all = ys.concat([mean, ucl, lcl, usl, lsl].filter(n => n != null));
      const ext = extent(all);
      const yt = niceTicks(ext.lo, ext.hi, 5);
      const yFmt = t => fmtAxis(t, yt.step);
      const W = widthOf(box) - 30, H = f.height || 260;
      const p = plotArea(card, W, H, yt, yFmt, leftFor(yt, yFmt));
      const dx = pts.length > 1 ? p.pw / (pts.length - 1) : 0;
      const X = i => (pts.length > 1 ? p.m.l + i * dx : p.m.l + p.pw / 2);
      const dec = f.decimals;
      refLines(p, [
        { value: usl, label: `USL ${fmt(usl, dec)}`, color: INK.secondary }, { value: lsl, label: `LSL ${fmt(lsl, dec)}`, color: INK.secondary },
        { value: ucl, label: `UCL ${fmt(ucl, dec)}`, color: STATUS.bad }, { value: lcl, label: `LCL ${fmt(lcl, dec)}`, color: STATUS.bad },
        { value: mean, label: `Mean ${fmt(mean, dec)}`, color: INK.muted },
      ]);
      const timed = pts.every(pt => pt.t != null);
      const span = timed && pts.length > 1 ? pts[pts.length - 1].t - pts[0].t : null;
      xLabels(p, pts.map((pt, i) => X(i)), i => (timed ? fmtTime(pts[i].t, span) : String(pts[i].lab == null ? i + 1 : pts[i].lab)));
      p.s.appendChild(svg('path', { d: pts.map((pt, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${p.y(pt.y).toFixed(1)}`).join(''), fill: 'none', stroke: SERIES[0], 'stroke-width': 2, 'stroke-linejoin': 'round' }));
      pts.forEach((pt, i) => p.s.appendChild(svg('circle', { cx: X(i), cy: p.y(pt.y), r: flagged(i) ? 5 : 4, fill: flagged(i) ? STATUS.bad : SERIES[0], stroke: INK.surface, 'stroke-width': 2 })));
      const cross = svg('line', { y1: p.m.t, y2: p.m.t + p.ph, stroke: INK.axis, 'stroke-width': 1, visibility: 'hidden' });
      const overlay = svg('rect', { x: p.m.l - 12, y: p.m.t, width: p.pw + 24, height: p.ph, fill: 'transparent' });
      p.s.append(cross, overlay);
      overlay.addEventListener('pointermove', e => {
        const r = p.s.getBoundingClientRect();
        const px = ((e.clientX - r.left) / r.width) * W;
        const i = pts.length > 1 ? Math.max(0, Math.min(pts.length - 1, Math.round((px - p.m.l) / dx))) : 0;
        cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible');
        const rows = [{ value: `${fmt(pts[i].y, dec)}${f.unit ? ' ' + f.unit : ''}`, label: key, color: flagged(i) ? STATUS.bad : SERIES[0] }];
        flags[i].forEach(fl => rows.push({ value: '⚠', label: fl === 'run' ? `part of a run on one side of the mean` : fl === 'trend' ? 'part of a steady trend' : fl }));
        showTip(e.clientX, e.clientY, timed ? fmtWhen(pts[i].t) : `Reading ${i + 1}`, rows);
      });
      overlay.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
      const note = el('div', 'fpv-note');
      const ok = !findings.length;
      const flag = el('span', 'fpv-flag', ok ? ICON.good : '!');
      flag.style.background = ok ? STATUS.good : STATUS.bad;
      note.append(flag, el('span', null, ok
        ? `In control: ${pts.length} reading${pts.length === 1 ? '' : 's'}, none outside the limits, no runs or trends.`
        : `Out of control: ${findings.join('; ')}.`));
      if (pts.length < 2) note.lastChild.textContent = 'One reading so far: limits need at least two.';
      card.appendChild(note);
      dataTable(card, [
        { label: timed ? 'When' : '#', get: pt => (timed ? fmtWhen(pt.t) : String(pts.indexOf(pt) + 1)) },
        { label: key, num: true, get: pt => fmt(pt.y, dec) },
        { label: 'Flag', get: pt => flags[pts.indexOf(pt)].map(fl => (fl === 'run' ? 'run' : fl === 'trend' ? 'trend' : 'outside limits')).join(', ') },
      ], pts, f);
    },
  });

  /* ---------- pareto: counts by category, largest first ---------- */
  FP.forms.register('pareto', {
    describe: { label: 'Pareto', category: 'visual', data: 'a list of records (or values)',
      help: 'Counts by category, largest first, with the running share of the total; the categories that make up the cutoff share are marked.',
      settings: [S('category', 'text', 'Category', { help: 'The key to count by; a key holding a list counts each item (e.g. defects).' }),
        S('count', 'text', 'Add up', { help: 'A key with a number to add up instead of counting records.' }),
        S('top', 'integer', 'Show the top', { min: 2, default: 8, help: 'The rest are added up as Other.' }),
        S('cutoff', 'number', 'Mark up to (%)', { default: 80 }),
        S('showData', 'boolean', 'Show data under it', { help: 'A Show data table under it (0.51); off unless the form asks.' })] },
    render(box, v, f, d) {
      if (notReady(box, v, d)) return;
      const recs = records(v);
      if (!recs) { say(box, 'Not a list'); return; }
      const key = f.category || 'value';
      const counts = new Map();
      recs.forEach(r => {
        const cats = Array.isArray(r[key]) ? r[key] : [r[key]];
        const amount = f.count ? toNum(r[f.count]) || 0 : 1;
        cats.filter(c => c != null && c !== '').forEach(c => counts.set(String(c), (counts.get(String(c)) || 0) + amount));
      });
      let rows = Array.from(counts, ([c, n]) => ({ c, n })).sort((a, b) => b.n - a.n || a.c.localeCompare(b.c));
      if (!rows.length) { say(box, 'Nothing counted yet'); return; }
      const top = f.top || 8;
      if (rows.length > top) { const rest = rows.slice(top - 1); rows = rows.slice(0, top - 1).concat([{ c: `Other (${rest.length})`, n: rest.reduce((a, b) => a + b.n, 0), other: true }]); }
      const total = rows.reduce((a, b) => a + b.n, 0);
      const cutoff = f.cutoff || 80;
      let cum = 0, vital = 0;
      rows.forEach(r => { const before = cum; cum += r.n; r.cum = total > 0 ? (cum / total) * 100 : 0; r.vital = !r.other && total > 0 && before / total * 100 < cutoff; if (r.vital) vital++; });
      const max = extent(rows.map(r => r.n)).hi;
      const card = frame(box);
      const g = el('div', 'fpv-par');
      g.append(el('span', 'head', ''), el('span', 'head', f.count ? `Total of ${f.count}` : 'Count'), el('span', 'head', 'Running %'));
      rows.forEach(r => {
        const lab = el('span', 'lab', r.c);
        lab.title = r.c;
        const barBox = el('span', 'fpv-pb');
        const fill = el('i');
        const w = max > 0 ? (r.n / max) * 82 : 0;
        fill.style.width = w + '%';
        fill.style.background = r.vital ? SERIES[0] : LIGHT_SERIES;
        const val = el('b', null, fmt(r.n, f.count ? undefined : 0));
        val.style.left = w + '%';
        barBox.append(fill, val);
        barBox.addEventListener('pointermove', e => showTip(e.clientX, e.clientY, r.c, [{ value: fmt(r.n), label: `${fmt(total > 0 ? (r.n / total) * 100 : 0, 1)}% of ${fmt(total)}`, color: fill.style.background }, { value: `${fmt(r.cum, 0)}%`, label: 'running total' }]));
        barBox.addEventListener('pointerleave', hideTip);
        g.append(lab, barBox, el('span', 'cum', `${fmt(r.cum, 0)}%`));
      });
      card.appendChild(g);
      card.appendChild(el('div', 'fpv-note', `Dark bars: the ${vital} categor${vital === 1 ? 'y' : 'ies'} making up ${cutoff}% of all ${fmt(total)}.`));
      dataTable(card, [{ label: f.category || 'Category', get: r => r.c }, { label: f.count || 'Count', num: true, get: r => fmt(r.n) }, { label: 'Running %', num: true, get: r => fmt(r.cum, 1) }], rows, f);
    },
  });

  /* ---------- board: a tile per record ---------- */
  FP.forms.register('board', {
    describe: { label: 'Status board', category: 'visual', data: 'a list of records', help: 'A tile per record, coloured by its status.',
      settings: [S('title', 'text', 'Tile title', { help: 'A key; default id.' }), S('status', 'text', 'Status', { help: 'A key; default $status (or $action).' }),
        S('colors', 'map', 'Colours', { help: 'Status: good, warn or bad.', keys: 'text', values: 'tone' }),
        S('show', 'text', 'Under the title', { help: 'e.g. {profile} · {qty} pcs' }),
        S('progress', 'object', 'Progress bar', { help: 'How far each has got: done of total, e.g. made of racks.', of: [S('done', 'text', 'Done (a key)', { required: true }), S('of', 'text', 'Out of (a key)', { required: true })] }),
        S('sort', 'choice', 'Order', { options: ['newest', 'title', 'status', 'given'], default: 'newest', help: 'given: as the formula lists them (use SORT).' }), S('limit', 'integer', 'At most', { min: 1, default: 60 }),
        S('select', 'boolean', 'Tapping a tile selects it', { help: 'The tile stays marked and NAME.selected is its record (0.51).' })] },
    render(box, v, f, d, x, h) {
      if (notReady(box, v, d)) return;
      const recs = records(v);
      if (!recs) { say(box, 'Not a list'); return; }
      if (!recs.length) { say(box, 'Nothing to show yet'); return; }
      const tKey = f.title || 'id';
      const sKey = f.status || (recs.some(r => r.$status != null) ? '$status' : '$action');
      const tone = st => { const t = own(f.colors, String(st)); return hasOwn(STATUS, t) ? t : null; };
      let list = recs.slice();
      if (f.sort === 'given') { /* as the formula lists them */ }
      else if ((f.sort || 'newest') === 'newest') list.sort((a, b) => String(b.$at || '').localeCompare(String(a.$at || '')));
      else if (f.sort === 'title') list.sort((a, b) => String(a[tKey]).localeCompare(String(b[tKey]), undefined, { numeric: true }));
      else list.sort((a, b) => String(a[sKey]).localeCompare(String(b[sKey])));
      const limit = f.limit || 60;
      const card = frame(box);
      const tally = new Map();
      recs.forEach(r => tally.set(String(r[sKey] == null ? '—' : r[sKey]), (tally.get(String(r[sKey] == null ? '—' : r[sKey])) || 0) + 1));
      const sum = el('div', 'fpv-sum');
      tally.forEach((n, st) => { const sp = el('span'); sp.append(el('b', null, String(n)), document.createTextNode(' ' + st)); sum.appendChild(sp); });
      card.appendChild(sum);
      const grid = el('div', 'fpv-board');
      list.slice(0, limit).forEach(r => {
        const st = r[sKey] == null ? '—' : String(r[sKey]);
        const tn = tone(st);
        const tile = el('div', 'fpv-tile');
        if (tn) tile.style.borderLeftColor = STATUS[tn];
        tile.appendChild(el('b', null, String(r[tKey] == null ? '—' : r[tKey])));
        if (f.show) tile.appendChild(el('div', 'sub', f.show.replace(/\{([$\w]+)\}/g, (_, k) => fmtCell(own(r, k)))));
        if (f.progress && f.progress.done && f.progress.of) {
          // done of total: a bar and "7 of 20".
          const dn = toNum(r[f.progress.done]) || 0, of = toNum(r[f.progress.of]);
          if (of != null && of > 0) {
            const m = el('div', 'fpv-meter fpv-prog');
            const i = el('i'); i.style.width = Math.min(100, (dn / of) * 100) + '%'; i.style.background = dn >= of ? STATUS.good : SERIES[0];
            m.appendChild(i);
            tile.append(m, el('div', 'sub', `${fmt(dn, 0)} of ${fmt(of, 0)}`));
          }
        }
        const stEl = el('div', 'st');
        if (tn) { const fl = el('span', 'fpv-flag', ICON[tn]); fl.style.background = STATUS[tn]; if (tn === 'warn') fl.style.color = '#0b0b0b'; stEl.appendChild(fl); }
        stEl.appendChild(el('span', null, st));
        if (tn) stEl.style.color = TONE_TEXT[tn];
        tile.appendChild(stEl);
        if (r.$at) tile.title = `Last change ${fmtWhen(Date.parse(r.$at))}`;
        if (f.select && h && h.select) {
          const rid = r.$id != null ? String(r.$id) : r.id != null ? String(r.id) : null;
          tile.classList.add('pick'); tile.tabIndex = 0;
          if (rid != null && h.selectedId && h.selectedId() === rid) tile.classList.add('sel');
          tile.onclick = () => h.select(r);
          tile.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); h.select(r); } };
        }
        grid.appendChild(tile);
      });
      card.appendChild(grid);
      if (list.length > limit) card.appendChild(el('div', 'fpv-note', `Showing ${limit} of ${list.length}.`));
    },
  });

  /* ---------- tree: an item and what it leads to (0.55) ----------
   * The formula gives the top: an item or a list. Each branch is a formula worked out for every item above it, named
   * item (and parent, the one above that): RunOf(item.run) under a rack, HourChecksOfRun(item.$id) under a run. A branch
   * says which it hangs under (top, or another branch's name; itself for a chain like lot → the lot it came from).
   * Nothing here knows what the items are. Branches open and close; tapping an item can select it (NAME.selected). */
  const treeKey = r => (r && typeof r === 'object' ? (r.$entry != null ? String(r.$entry) : r.$id != null ? String(r.$id) : r.id != null ? String(r.id) : JSON.stringify(r).slice(0, 80)) : String(r));
  const undersOf = l => String((l && l.under) || 'top').split(',').map(x => x.trim()).filter(Boolean);
  const asRecs = x => (x == null || (x && typeof x === 'object' && x.__fp) ? [] : Array.isArray(x) ? x : [x]).map(r => (r && typeof r === 'object' ? r : { value: r }));
  FP.forms.register('tree', {
    describe: { label: 'Trace tree', category: 'visual', data: 'an item or a list of items (the top)', help: 'An item and what it leads to, as a tree opened branch by branch: each branch is a formula worked out for every item above it (named item), e.g. the run of a rack, the checks of that run, the racks it made.',
      settings: [S('topLabel', 'text', 'Top label', { help: 'e.g. Rack' }), S('title', 'text', 'Top title', { help: 'e.g. {$id} · {profile}; default the ID' }), S('show', 'text', 'Under the top title', { help: 'e.g. {pieces} pcs · {line}' }),
        S('levels', 'list', 'Branches', { help: 'Each: a name, what it hangs under (top or another branch), and a formula with item, the one above it.', of: [
          S('name', 'name', 'Name', { required: true }), S('label', 'text', 'Label', { help: 'e.g. Hour checks' }),
          S('under', 'text', 'Hangs under', { help: 'top (the default), another branch\'s name, or several with commas; top, lot (its own name) follows a chain: the lot a lot came from, and so on' }),
          S('formula', 'formula', 'What it holds', { required: true, names: ['item', 'parent'], help: 'Worked out for each item above it, named item: RunOf(item.run), HourChecksOfRun(item.$id)' }),
          S('title', 'text', 'Title', { help: 'e.g. {line} · {profile}; default the ID' }), S('show', 'text', 'Under the title', { help: 'e.g. {$at} · {speed} ft/min' }),
          S('status', 'text', 'Status (a key)', { help: 'Shown beside the title; default $status' }), S('colors', 'map', 'Colours', { help: 'Status: good, warn or bad.', keys: 'text', values: 'tone' }),
          S('open', 'boolean', 'Open at first', { help: 'Its items show what hangs under them without a tap' }), S('limit', 'integer', 'At most', { min: 1, default: 25 })] }),
        S('depth', 'integer', 'Levels deep at most', { min: 1, default: 6 }), S('empty', 'text', 'When there is nothing', { help: 'e.g. Scan or type a rack ID' }),
        S('select', 'boolean', 'Tapping an item selects it', { help: 'It stays marked and NAME.selected is that item, for other fields (e.g. a records table of its entries).' })] },
    check(f, where, p, h) {
      const lv = Array.isArray(f.levels) ? f.levels : [];
      if (!lv.length) p.push(`${where}: a trace tree needs at least one branch`);
      const names = new Set(lv.map(l => l && l.name).filter(Boolean));
      if (names.has('top')) p.push(`${where}: top is the tree's top; give the branch another name`);
      if (names.size !== lv.filter(l => l && l.name).length) p.push(`${where}: two branches have the same name`);
      lv.forEach((l, i) => {
        if (!l) return;
        const w = `${where}, branch ${l.name || i + 1}`;
        undersOf(l).forEach(u => { if (u !== 'top' && !names.has(u)) p.push(`${w}: hangs under ${u}, which is not a branch (top, or ${Array.from(names).join(', ')})`); });
        if (l.formula && h && h.formulaOk) h.formulaOk(w, l.formula);
      });
      if (!lv.some(l => l && undersOf(l).includes('top'))) p.push(`${where}: no branch hangs under top, so nothing shows under the top items`);
    },
    // Worked out before drawing (the form calls it with its formula's value): ev(formula, { item, parent }).
    async prepare(f, v, ev) {
      const levels = (Array.isArray(f.levels) ? f.levels : []).filter(l => l && l.name && l.formula);
      const maxDepth = f.depth || 6, maxNodes = 400;
      let count = 0;
      const all = [];
      async function grow(node, levelName, depth, path) {
        for (const L of levels.filter(l => undersOf(l).includes(levelName))) {
          if (depth >= maxDepth) { node.deeper = true; return; }
          if (count >= maxNodes) { node.cut = true; return; }
          const got = await ev(L.formula, { item: node.r, parent: node.parent ? node.parent.r : null }).catch(e => ({ __fp: 'error', message: e.message }));
          const branch = { level: L, nodes: [], total: 0, error: got && got.__fp === 'error' ? (got.message || 'it could not be worked out') : null };
          const list = branch.error ? [] : asRecs(got);
          branch.total = list.length;
          for (const r of list.slice(0, L.limit || 25)) {
            if (count >= maxNodes) { node.cut = true; break; }
            const key = `${L.name}:${treeKey(r)}`;
            const child = { r, level: L, parent: node, key, branches: [], loop: path.includes(key) };
            count++; all.push(r);
            branch.nodes.push(child);
            if (!child.loop) await grow(child, L.name, depth + 1, path.concat(key));
          }
          node.branches.push(branch);
        }
      }
      const roots = asRecs(v).slice(0, 25).map(r => ({ r, level: null, parent: null, key: `top:${treeKey(r)}`, branches: [] }));
      for (const n of roots) { count++; all.push(n.r); await grow(n, 'top', 1, [n.key]); }
      return { roots, all, count, cut: count >= maxNodes };
    },
    render(box, v, f, d, x, h) {
      if (notReady(box, v, d)) return;
      const t = x && x.__prepared;
      if (!t || !t.roots.length) { say(box, f.empty || 'Nothing to trace yet'); return; }
      const card = frame(box);
      const open = box.__open || (box.__open = new Map());   // a node's path -> open; kept while the form is open
      const fill = (tpl, r, dflt) => (tpl ? tpl.replace(/\{([$\w]+)\}/g, (_, k) => fmtCell(own(r, k))) : dflt);
      const selecting = !!(f.select && h && h.select);
      // The node tapped is marked by where it sits: two nodes can share an ID (a run, and a check saved on that run).
      if (!(selecting && h.selectedId && h.selectedId() != null)) box.__selPath = null;
      const draw = (node, ul, path, above) => {
        const li = el('li');
        const row = el('div', 'fpv-tnode');
        const L = node.level;
        const p = path + '/' + node.key;
        const has = node.branches.some(b => b.nodes.length || b.error) || node.deeper || node.cut;
        const isOpen = open.has(p) ? open.get(p) : (L ? !!L.open : true);
        const tg = el('button', 'tg', has ? (isOpen ? '▾' : '▸') : '');
        tg.type = 'button';
        if (has) { tg.setAttribute('aria-expanded', String(isOpen)); tg.setAttribute('aria-label', isOpen ? 'Close' : 'Open'); tg.onclick = () => { open.set(p, !isOpen); render2(); }; } else tg.disabled = true;
        const bd = el('div', 'bd');
        const r = node.r;
        const sKey = (L && L.status) || '$status';
        const st = r[sKey];
        const tone = L && L.colors && hasOwn(STATUS, own(L.colors, String(st))) ? L.colors[String(st)] : null;
        if (tone) bd.style.borderLeftColor = STATUS[tone];
        const head = el('div');
        head.appendChild(el('b', null, fill(L ? L.title : f.title, r, treeKey(r))));
        if (!L && f.topLabel) head.appendChild(el('span', 'lv', f.topLabel));
        if (L && !node.loop && above.has(treeKey(r))) head.appendChild(el('span', 'lv', '↑ also above'));
        if (st != null && st !== '') { const s2 = el('span', 'st', String(st)); if (tone) s2.style.color = TONE_TEXT[tone]; head.appendChild(s2); }
        if (node.loop) head.appendChild(el('span', 'lv', '↩ already above'));
        bd.appendChild(head);
        const sub = fill(L ? L.show : f.show, r, '');
        if (sub) bd.appendChild(el('div', 'sub', sub));
        if (selecting) {
          bd.classList.add('pick'); bd.tabIndex = 0;
          if (h.selectedId && h.selectedId() === (r.$id != null ? String(r.$id) : r.id != null ? String(r.id) : null) && box.__selPath === p) bd.classList.add('sel');
          const pick = () => { box.__selPath = box.__selPath === p ? null : p; h.select(r); };
          bd.onclick = pick;
          bd.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } };
        }
        row.append(tg, bd);
        li.appendChild(row);
        if (has && isOpen) {
          const sub2 = el('ul');
          node.branches.forEach(b => {
            if (!b.nodes.length && !b.error) return;
            const bh = el('li', 'fpv-tbranch' + (b.error ? ' err' : ''));
            bh.textContent = b.error ? `${b.level.label || b.level.name}: ${b.error}` : (b.level.label || b.level.name);
            if (!b.error && b.total > 1) bh.appendChild(el('span', 'n', String(b.total)));
            sub2.appendChild(bh);
            const up = new Set(above); up.add(treeKey(r));
            b.nodes.forEach(n => draw(n, sub2, p, up));
            if (b.total > b.nodes.length) sub2.appendChild(el('li', 'fpv-tmore', `Showing ${b.nodes.length} of ${b.total}.`));
          });
          if (node.deeper) sub2.appendChild(el('li', 'fpv-tmore', 'Deeper levels are left out (Levels deep at most).'));
          if (node.cut) sub2.appendChild(el('li', 'fpv-tmore', 'The tree stops at 400 items.'));
          li.appendChild(sub2);
        }
        ul.appendChild(li);
      };
      const render2 = () => {
        const ul = el('ul', 'fpv-tree');
        t.roots.forEach(n => draw(n, ul, '', new Set()));
        card.replaceChildren(ul);
      };
      render2();
    },
  });

  /* ---------- records: a table of records ---------- */
  FP.forms.register('records', {
    describe: { label: 'Records table', category: 'visual', data: 'a list of records', help: 'A table of records; tap a row to see all its values.',
      settings: [S('columns', 'list', 'Columns', { help: 'Leave out for every key of the first record.', of: [S('key', 'text', 'Key', { required: true }), S('label', 'text', 'Heading'), S('decimals', 'integer', 'Decimals', { min: 0 }), S('format', 'text', 'Format', { help: 'As TEXT does: 0.0% · #,##0 · MMM d h:mm AM/PM' })] }),
        S('sort', 'text', 'Sort by', { help: 'A key; default $at.' }), S('ascending', 'boolean', 'Oldest or smallest first'), S('limit', 'integer', 'At most', { min: 1, default: 50 }), S('empty', 'text', 'When there are none', { help: 'e.g. None (0.49)' }),
        S('select', 'boolean', 'Tapping a row selects it', { help: 'The row stays marked and NAME.selected is its record, for other fields and rules (0.51).' }),
        S('details', 'boolean', 'Tapping a row shows all its values', { help: 'Off unless asked for (0.51). With selecting too, an ⓘ on each row shows them.' })] },
    render(box, v, f, d, x, h) {
      if (notReady(box, v, d)) return;
      const recs = records(v);
      if (!recs) { say(box, 'Not a list'); return; }
      if (!recs.length) { say(box, f.empty || 'Nothing to show yet'); return; }
      const cols = f.columns || Object.keys(recs[0]).filter(k => k[0] !== '$' || k === '$at').map(k => ({ key: k }));
      const sKey = f.sort || '$at';
      const list = recs.slice().sort((a, b) => {
        const x = a[sKey], y = b[sKey];
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x == null ? '' : x).localeCompare(String(y == null ? '' : y), undefined, { numeric: true });
        return f.ascending ? c : -c;
      }).slice(0, f.limit || 50);
      const card = frame(box);
      const sc = el('div', 'fpv-scroll');
      const t = el('table', 'fpv-table fpv-records');
      const hr = el('tr');
      const isNum = c => list.some(r => typeof r[c.key] === 'number');
      cols.forEach(c => hr.appendChild(el('th', isNum(c) ? 'num' : null, c.label || FACT[c.key] || c.key)));
      if (f.select && f.details && h && h.select) hr.appendChild(el('th', 'info'));
      t.appendChild(hr);
      list.forEach(r => {
        const tr = el('tr', 'row');
        tr.tabIndex = 0;
        cols.forEach(c => tr.appendChild(el('td', isNum(c) ? 'num' : null, c.format && r[c.key] != null && r[c.key] !== '' ? FP.fn.format(r[c.key], c.format) : fmtCell(r[c.key], c.decimals))));
        let more = null;
        const toggle = () => {
          if (more) { more.remove(); more = null; return; }
          more = el('tr', 'more');
          const td = el('td', null, Object.entries(r).map(([k, x]) => `${FACT[k] || k}: ${fmtCell(x)}`).join('\n'));
          td.colSpan = cols.length + (selecting && f.details ? 1 : 0);
          more.appendChild(td);
          tr.after(more);
        };
        // Tapping a row (0.51): selects it (select), shows its values (details), both (an ⓘ for the values), or nothing.
        const selecting = !!(f.select && h && h.select);
        const rid = r.$id != null ? String(r.$id) : r.id != null ? String(r.id) : null;
        if (selecting && rid != null && h.selectedId && h.selectedId() === rid) tr.classList.add('sel');
        const act = selecting ? () => h.select(r) : f.details ? toggle : null;
        if (selecting && f.details) {
          const td = el('td', 'info'); const ib = el('button', 'fpv-info', 'ⓘ'); ib.type = 'button'; ib.setAttribute('aria-label', 'All its values');
          ib.onclick = e => { e.stopPropagation(); toggle(); };
          td.appendChild(ib); tr.appendChild(td);
        }
        if (act) {
          tr.onclick = act;
          tr.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } };
        } else { tr.classList.remove('row'); tr.tabIndex = -1; }
        t.appendChild(tr);
      });
      sc.appendChild(t);
      card.appendChild(sc);
      if (recs.length > list.length) card.appendChild(el('div', 'fpv-note', `Showing ${list.length} of ${recs.length}.`));
    },
  });


  /* ---------- summary: records grouped into a table, like a spreadsheet's pivot ----------
   * rows: one or two keys (date, or date then crew); across: a key whose values become columns (line);
   * figures: label -> a formula over group, the records of that cell (SUM(group.scrapLbs) / SUM(group.totalLbs)).
   * formats: label -> a TEXT format (0.0%); totals, sort, descending, mark (lowest | highest), chart (bar | line), limit. */
  const groupKey = v => (v == null || v === '' ? '—' : Array.isArray(v) ? v.join(', ') : String(v));
  const cmpKeys = (a, b) => {
    if (a === '—') return 1; if (b === '—') return -1;
    const na = toNum(a), nb = toNum(b);
    if (na != null && nb != null) return na - nb;
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  };
  FP.forms.register('summary', {
    describe: { label: 'Summary table', category: 'visual', data: 'a list of records', help: 'Records added up into a table, like a spreadsheet\'s pivot: rows by one or two keys, columns by another, each cell worked out by formulas over group (the records in it).',
      settings: [S('rows', 'texts', 'Rows by', { required: true, help: 'One or two keys, e.g. profile, or date crew.' }), S('heading', 'text', 'Rows heading', { help: 'e.g. Date · crew; default the keys' }),
        S('across', 'text', 'Columns by', { help: 'A key whose values become columns, e.g. line.' }),
        S('figures', 'map', 'Figures', { required: true, keys: 'text', values: 'formula', perGroup: true, help: 'Name ← a formula over group, the records in the cell, e.g. Scrap % ← SUM(group.scrapLbs) / SUM(group.totalLbs).' }),
        S('formats', 'map', 'Formats', { keys: 'text', values: 'text', help: 'Name ← a format as TEXT takes, e.g. Scrap % ← 0.0%.' }),
        S('totals', 'boolean', 'Totals', { help: 'A total row (and a total column with columns by).' }),
        S('sort', 'text', 'Sort by', { help: 'A figure\'s name, or leave out to sort by the rows.' }), S('descending', 'boolean', 'Largest first'),
        S('mark', 'choice', 'Mark the', { options: ['lowest', 'highest'], help: 'With columns by: the best column of each row, by the first figure; otherwise the best row.' }),
        S('chart', 'choice', 'Chart above', { options: ['bar', 'line'], help: 'The first figure for each row (one line or bar per column).' }),
        S('decimals', 'integer', 'Decimals', { min: 0 }), S('limit', 'integer', 'At most rows', { min: 1, default: 100 })] },
    check(f, where, p) {
      if (f.rows && Array.isArray(f.rows) && (f.rows.length < 1 || f.rows.length > 2)) p.push(`${where}: rows by one or two keys`);
      Object.entries(f.formats || {}).forEach(([k]) => { if (!(f.figures || {})[k]) p.push(`${where}: formats names ${k}, which isn't a figure`); });
      if (f.sort && !(f.figures || {})[f.sort] && !(f.rows || []).includes(f.sort)) p.push(`${where}: sort by a figure's name (or one of the rows)`);
    },
    render(box, v, f, d) {
      if (notReady(box, v, d)) return;
      const recs = records(v);
      if (!recs) { say(box, 'Not a list'); return; }
      if (!recs.length) { say(box, 'Nothing to show yet'); return; }
      const rowKeys = (Array.isArray(f.rows) ? f.rows : [f.rows]).filter(Boolean).slice(0, 2);
      const figs = Object.entries(f.figures || {});
      if (!rowKeys.length || !figs.length) { say(box, 'Say what the rows are and what to work out'); return; }
      const fmts = f.formats || {};
      const calc = (formula, group) => { try { return FP.fn.evaluate(formula, { group }, {}); } catch (e) { return { __fp: 'error', message: e.message }; } };
      const show = (label, x) => {
        if (special(x)) return x.__fp === 'error' ? '!' : '—';
        if (x == null || x === '') return '—';
        if (hasOwn(fmts, label) && fmts[label]) return FP.fn.format(x, fmts[label]);
        return typeof x === 'number' ? fmt(x, f.decimals) : fmtCell(x, f.decimals);
      };
      const acrossVals = f.across ? Array.from(new Set(recs.map(r => groupKey(r[f.across])))).sort(cmpKeys) : [null];
      const cellsFor = list => {
        const out = Object.create(null);
        acrossVals.forEach(av => {
          const g = av == null ? list : list.filter(r => groupKey(r[f.across]) === av);
          out[av == null ? '' : av] = figs.map(([label, fx]) => (g.length ? calc(fx, g) : null));
        });
        if (f.across && f.totals) out['\u0000all'] = figs.map(([label, fx]) => calc(fx, list));
        return out;
      };
      // Rows, then sub-rows.
      const by = (list, k) => { const m = new Map(); list.forEach(r => { const key = groupKey(r[k]); if (!m.has(key)) m.set(key, []); m.get(key).push(r); }); return m; };
      const sortVal = row => {
        if (!f.sort || rowKeys.includes(f.sort)) return null;
        const i = figs.findIndex(([l]) => l === f.sort);
        const c = row.cells[f.across ? (f.totals ? '\u0000all' : null) : ''];
        const x = c ? c[i] : calc(figs[i][1], row.list);
        return special(x) ? null : x;
      };
      const order = list => {
        const sk = f.sort && rowKeys.includes(f.sort) ? null : f.sort;
        list.sort((a, b) => {
          let c;
          if (sk) { const x = sortVal(a), y = sortVal(b); c = x == null && y == null ? 0 : x == null ? 1 : y == null ? -1 : cmpKeys(x, y); if (x != null && y != null && f.descending) c = -c; }
          else { c = cmpKeys(a.key, b.key); if (f.descending) c = -c; }
          return c;
        });
        return list;
      };
      let top = Array.from(by(recs, rowKeys[0]).entries()).map(([key, list]) => ({ key, list }));
      top.forEach(r => { r.cells = cellsFor(r.list); });
      top = order(top);
      if (rowKeys[1]) top.forEach(r => { r.subs = order(Array.from(by(r.list, rowKeys[1]).entries()).map(([key, list]) => ({ key, list, cells: cellsFor(list) }))); });
      const limit = f.limit || 100;
      const shown = top.slice(0, limit);

      const card = frame(box);
      // A chart of the first figure, one line or bar per column.
      if (f.chart && shown.length) {
        const pct = /%\s*$/.test(fmts[figs[0][0]] || '');
        const pts = [];
        shown.forEach(r => acrossVals.forEach(av => {
          const x = r.cells[av == null ? '' : av][0];
          if (typeof x === 'number' && isFinite(x)) pts.push({ x: r.key, y: pct ? x * 100 : x, s: av == null ? figs[0][0] : av });
        }));
        if (pts.length) {
          card.appendChild(el('div', 'fpv-note', `${figs[0][0]} by ${f.heading || rowKeys[0]}`)).style.margin = '0 0 4px';
          const holder = el('div');
          card.appendChild(holder);
          CHART.render(holder, pts, { type: f.chart, x: 'x', y: 'y', series: 's', aggregate: 'latest', unit: pct ? '%' : undefined, decimals: f.decimals, height: 220 }, { state: 'value' }, {});
          const inner = holder.querySelector('.fpv');
          if (inner) { inner.style.border = 'none'; inner.style.padding = '0'; inner.style.background = 'transparent'; }
          const det = holder.querySelector('details'); if (det) det.remove();
        }
      }
      const sc = el('div', 'fpv-scroll');
      sc.style.maxHeight = '520px';
      const t = el('table', 'fpv-pivot');
      const cols = acrossVals.concat(f.across && f.totals ? ['\u0000all'] : []);
      const many = figs.length > 1;
      // Headers: with columns by and several figures, a row of column values above the figure names.
      if (f.across) {
        const h1 = el('tr');
        h1.appendChild(el('th', 'k', f.heading || rowKeys.join(' · ')));
        cols.forEach(c => { const th = el('th', many ? 'grp' : null, c === '\u0000all' ? 'Total' : c); if (many) th.colSpan = figs.length; h1.appendChild(th); });
        t.appendChild(h1);
        if (many) { const h2 = el('tr'); h2.appendChild(el('th', 'k', '')); cols.forEach(() => figs.forEach(([l]) => h2.appendChild(el('th', null, l)))); t.appendChild(h2); }
      } else {
        const h = el('tr'); h.appendChild(el('th', 'k', f.heading || rowKeys.join(' · '))); figs.forEach(([l]) => h.appendChild(el('th', null, l))); t.appendChild(h);
      }
      // The best cell of a row (columns by) or the best row (no columns), by the first figure.
      const better = (x, y) => (f.mark === 'lowest' ? x < y : x > y);
      const bestCol = row => {
        if (!f.mark || !f.across) return null;
        let best = null;
        acrossVals.forEach(av => { const x = row.cells[av][0]; if (typeof x === 'number' && isFinite(x) && (best == null || better(x, row.cells[best][0]))) best = av; });
        return acrossVals.filter(av => typeof row.cells[av][0] === 'number').length > 1 ? best : null;
      };
      let bestRow = null;
      if (f.mark && !f.across) shown.forEach(r => { const x = r.cells[''][0]; if (typeof x === 'number' && isFinite(x) && (!bestRow || better(x, bestRow.cells[''][0]))) bestRow = r; });
      const rowEl = (row, cls) => {
        const tr = el('tr', cls);
        tr.appendChild(el('td', 'k', row.label != null ? row.label : fmtCell(row.key === '—' ? null : row.key)));
        const bc = bestCol(row);
        cols.forEach(c => (row.cells[c == null ? '' : c] || []).forEach((x, i) => {
          const td = el('td', null, show(figs[i][0], x));
          if (i === 0 && ((bc != null && c === bc) || (bestRow === row && !f.across))) td.className = 'best';
          if (x == null) td.className = 'muted';
          if (special(x) && x.__fp === 'error') td.title = x.message;
          tr.appendChild(td);
        }));
        return tr;
      };
      shown.forEach(r => {
        t.appendChild(rowEl(r, r.subs ? 'lvl' : null));
        (r.subs || []).forEach(sr => t.appendChild(rowEl(sr, 'sub')));
      });
      if (f.totals) t.appendChild(rowEl({ label: 'Total', key: 'Total', cells: cellsFor(recs) }, 'tot'));
      sc.appendChild(t);
      card.appendChild(sc);
      if (top.length > shown.length) card.appendChild(el('div', 'fpv-note', `Showing ${shown.length} of ${top.length} rows.`));
      card.appendChild(el('div', 'fpv-note', `${recs.length} record${recs.length === 1 ? '' : 's'}.`));
    },
  });

  window.addEventListener('scroll', hideTip, { passive: true, capture: true });

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-visuals'] = '0.63.1';
})();
