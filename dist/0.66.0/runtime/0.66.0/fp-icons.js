/* Form Platform: icons and the identity primitives (UI refresh, Release B, step 7)
 * Colour marks the kind of data; shape marks the kind of thing; text is left for names. This file holds the shared pieces the screens use
 * so they all say it the same way: a hand-drawn glyph set (inline SVG, no library), the tile (the shape holding a glyph) and the chip.
 *
 *   FP.icons.svg(name, { size })      an <svg class="fpi"> for a glyph (size in px, default 1em); null for an unknown name
 *   FP.icons.tile({ glyph, tone, shape, fill, size })   a <span class="fpi-tile ..."> holding a glyph
 *        tone   'runs' | 'inv' | 'rec' | 'case' | 'ord' | 'list' (the kind colour) or omitted (neutral)
 *        shape  'form' (rounded square, default) | 'structure' (hexagon) | 'function' (circle) | 'place' (small rounded square)
 *        fill   'tint' (default: tinted tile, kind-coloured glyph) | 'solid' (kind colour, writes data) | 'outline' (dashed, only shows data) | 'plain' (neutral)
 *   FP.icons.chip(text, { glyph, tone, mono })  a small pill; a glyph first when given
 *   FP.icons.toneClass(tone)          the class that sets --kc and --kt (the kind colour and its tint) for anything inside
 *   FP.icons.forControl(control)      the glyph for a field's control (text, number, choice, date, ...)
 *   FP.icons.add(name, parts)         register one more glyph from another file (a taken name is left alone)
 *   FP.icons.names                    every glyph name
 *
 * Fields: a filled tile writes data, a dashed tile only shows it, and an arrow chip says which structure it writes to (down) or reads from (eye).
 * Never colour alone: the shape and the glyph say the same thing.
 * Built with createElementNS (no innerHTML). Colours are theme tokens, so everything follows day and night.
 */
(function () {
  'use strict';
  const FP = (window.FP = window.FP || {});
  const NS = 'http://www.w3.org/2000/svg';

  /* Each glyph is a list of parts on a 24 x 24 grid: a path string, { c: [cx, cy, r] }, { r: [x, y, w, h, rx] } or { t: 'text' }. */
  const G = {
    doc: ['M7 3h7l4 4v14H7z M14 3v4h4'],
    table: ['M4 5h16v14H4z M4 10h16 M10 5v14'],
    fn: [{ t: 'ƒ' }],
    screen: ['M3 5h18v11H3z M9 20h6 M12 16v4'],
    pin: ['M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z', { c: [12, 11, 2.2] }],
    play: ['M8 5l11 7-11 7z'],
    stop: ['M6 6h12v12H6z'],
    box: ['M3 8l9-5 9 5v8l-9 5-9-5z M3 8l9 5 9-5 M12 13v8'],
    check: ['M5 12.5l4.5 4.5L19 7.5'],
    flag: ['M6 21V4 M6 5h11l-2 4 2 4H6'],
    list: ['M9 6h11 M9 12h11 M9 18h11 M4 6h.01 M4 12h.01 M4 18h.01'],
    hash: ['M5 9h14 M5 15h14 M10 4L8 20 M16 4l-2 16'],
    text: ['M5 6h14 M12 6v13 M9 19h6'],
    cal: ['M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4'],
    toggle: [{ r: [3, 7, 18, 10, 5] }, { c: [16, 12, 2.6] }],
    choice: ['M4 7h7v10H4z M13 7h7v10h-7z'],
    camera: ['M4 8h4l2-3h4l2 3h4v11H4z', { c: [12, 13.5, 3.3] }],
    pen: ['M4 20l4-1 11-11-3-3L5 16z'],
    scan: ['M4 8V4h4 M16 4h4v4 M20 16v4h-4 M8 20H4v-4 M7 12h10'],
    search: [{ c: [11, 11, 6] }, 'M16 16l4 4'],
    eye: ['M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z', { c: [12, 12, 3] }],
    down: ['M12 4v14 M6 13l6 6 6-6'],
    plus: ['M12 5v14 M5 12h14'],
    minus: ['M5 12h14'],
    chev: ['M9 6l6 6-6 6'],
    back: ['M15 6l-6 6 6 6'],
    refresh: ['M20 12a8 8 0 1 1-3-6.2 M20 4v5h-5'],
    book: ['M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z M5 17a3 3 0 0 1 3-3h10'],
    user: [{ c: [12, 8, 3.5] }, 'M5 20a7 7 0 0 1 14 0'],
    gear: [{ c: [12, 12, 3] }, 'M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2.1 2.1 M16.3 16.3l2.1 2.1 M5.6 18.4l2.1-2.1 M16.3 7.7l2.1-2.1'],
    help: [{ c: [12, 12, 9] }, 'M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7 M12 17h.01'],
    // added for the operator screens and editor
    moon: ['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'],
    sun: [{ c: [12, 12, 4] }, 'M12 2v2 M12 20v2 M2 12h2 M20 12h2 M4.9 4.9l1.4 1.4 M17.7 17.7l1.4 1.4 M4.9 19.1l1.4-1.4 M17.7 6.3l1.4-1.4'],
    alert: ['M12 4l9 16H3z M12 10v4 M12 17h.01'],
    lock: [{ r: [5, 11, 14, 9, 2] }, 'M8 11V8a4 4 0 0 1 8 0v3'],
  };
  const FOR_CONTROL = { text: 'text', textarea: 'text', number: 'hash', choice: 'choice', chips: 'choice', toggle: 'toggle', date: 'cal', time: 'cal', datetime: 'cal',
    file: 'doc', draw: 'pen', photo: 'camera', scan: 'scan', pick: 'search', table: 'table', value: 'fn', person: 'user', media: 'doc', badge: 'flag', slider: 'hash', tally: 'hash',
    rating: 'hash', timer: 'play', records: 'list', board: 'list', kpi: 'hash', gauge: 'hash', chart: 'table', buttons: 'list', note: 'text', html: 'text' };
  const TONES = ['runs', 'inv', 'rec', 'case', 'ord', 'list'];

  const CSS = `
.fpi{width:1em;height:1em;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none;vertical-align:-.125em}
.fpi text{fill:currentColor;stroke:none}
.fpi-k-runs{--kc:var(--k-runs);--kt:var(--k-runs-t)}.fpi-k-inv{--kc:var(--k-inv);--kt:var(--k-inv-t)}
.fpi-k-rec{--kc:var(--k-rec);--kt:var(--k-rec-t)}.fpi-k-case{--kc:var(--k-case);--kt:var(--k-case-t)}
.fpi-k-ord{--kc:var(--k-ord);--kt:var(--k-ord-t)}.fpi-k-list{--kc:var(--k-list);--kt:var(--k-list-t)}
.fpi-tile{--s:30px;width:var(--s);height:var(--s);display:inline-grid;place-items:center;flex:none;box-sizing:border-box;
  background:var(--kt,var(--surface-2));color:var(--kc,var(--muted));border-radius:9px;font-size:calc(var(--s)*.55)}
.fpi-tile.fpi-structure{clip-path:polygon(25% 6%,75% 6%,100% 50%,75% 94%,25% 94%,0 50%);border-radius:0}
.fpi-tile.fpi-function{border-radius:50%}
.fpi-tile.fpi-place{border-radius:6px}
.fpi-tile.fpi-plain{background:var(--surface-2);color:var(--muted);border:1px solid var(--line)}
.fpi-tile.fpi-outline{background:none;border:1.5px dashed var(--line-2);color:var(--muted)}
.fpi-tile.fpi-solid{background:var(--kc,var(--fg));color:var(--surface)}
.fpi-chip{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:550;
  background:var(--kt,var(--surface-2));color:var(--kc,var(--muted));white-space:nowrap}
.fpi-chip.fpi-mono{font-family:var(--font-mono);font-size:11px}
`;
  const style = document.createElement('style');
  style.id = 'fp-icons';
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);

  const mk = (tag, attrs) => { const n = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(k => n.setAttribute(k, attrs[k])); return n; };
  function svg(name, opts) {
    const parts = G[name];
    if (!parts) return null;
    const s = mk('svg', { class: 'fpi', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' });
    if (opts && opts.size) { s.style.width = opts.size + 'px'; s.style.height = opts.size + 'px'; }
    parts.forEach(p => {
      if (typeof p === 'string') s.appendChild(mk('path', { d: p }));
      else if (p.c) s.appendChild(mk('circle', { cx: p.c[0], cy: p.c[1], r: p.c[2] }));
      else if (p.r) s.appendChild(mk('rect', { x: p.r[0], y: p.r[1], width: p.r[2], height: p.r[3], rx: p.r[4] || 0 }));
      else if (p.t) { const t = mk('text', { x: 12, y: 17.5, 'text-anchor': 'middle', 'font-size': 17, 'font-style': 'italic', 'font-family': 'Georgia,serif' }); t.textContent = p.t; s.appendChild(t); }
    });
    return s;
  }
  const toneClass = tone => (TONES.includes(tone) ? 'fpi-k-' + tone : '');
  function tile(o) {
    o = o || {};
    const t = document.createElement('span');
    t.className = ['fpi-tile', o.shape && o.shape !== 'form' ? 'fpi-' + o.shape : '', o.fill && o.fill !== 'tint' ? 'fpi-' + o.fill : '', toneClass(o.tone)].filter(Boolean).join(' ');
    if (o.size) t.style.setProperty('--s', o.size + 'px');
    const g = o.glyph && svg(o.glyph);
    if (g) t.appendChild(g);
    return t;
  }
  function chip(text, o) {
    o = o || {};
    const c = document.createElement('span');
    c.className = ['fpi-chip', o.mono ? 'fpi-mono' : '', toneClass(o.tone)].filter(Boolean).join(' ');
    const g = o.glyph && svg(o.glyph);
    if (g) c.appendChild(g);
    c.appendChild(document.createTextNode(text == null ? '' : String(text)));
    return c;
  }
  /* A screen that needs a glyph this file does not have registers it from its own file: FP.icons.add('name', [ 'M... path', { c: [cx, cy, r] }, ... ]).
   * A name already taken is left alone (returns false), so two files cannot quietly redraw each other's. */
  function add(name, parts) { if (!/^[a-z][a-z0-9-]*$/.test(name) || G[name] || !Array.isArray(parts)) return false; G[name] = parts; return true; }
  FP.icons = { svg, tile, chip, toneClass, add, forControl: control => FOR_CONTROL[control] || 'text', get names() { return Object.keys(G); }, tones: TONES.slice() };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-icons'] = '0.66.0';
})();
