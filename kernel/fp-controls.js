/* Form Platform runtime: more controls (step 14)
 * Load after fp-forms.js and before fp-defs.js.
 *
 *   chips      several choices at once                 { options: [...] }                 -> ["A", "C"]
 *   slider     a number on a scale                     { min, max, step, unit }           -> 7.5
 *   tally      a counter with - and +                  { min, max, step }                 -> 12
 *   timer      start, stop, reset                      { }                                 -> seconds
 *   rating     1 to max stars                          { max: 5 }                          -> 4
 *   file       files, or the camera                    { accept, camera, multiple, max }  -> paths in media/
 *   draw       a drawing pad (signatures, sketches)    { height, hint }                    -> a path in media/
 *   pick       an existing item of a structure         { structure, filter, show, fill }   -> the item ID
 *   person     who did it, on a shared terminal        { pin: supervisors | everyone }     -> the person's name (0.50.1)
 *   table      rows of small fields                    { columns, rows | addRows, style }  -> [{...}, ...]
 *              or one row per item of a list source    { rowsFrom, columns: [{ name, edit }] } -> [{ row: id, ...changed }]
 *
 * Controls are generic ways of entering a kind of value. Purpose comes from the
 * field that uses one: its label, options and where it writes.
 *
 * file and draw save into the media folder when the form is saved (0.42): signatures in media/signatures/,
 * photos (the camera, or image files) in media/photos/, other files in media/files/, each named
 * form_record_field_person_date-time (see fp-media.js). A table is a fixed grid (rows: a list
 * of row names, also a matrix), a list people add rows to (addRows: true), or,
 * with style: "cards", a repeat group shown as cards.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.forms) throw new Error('Load fp-forms.js before fp-controls.js');

  const CSS = `
  .fpc-chips{display:flex;flex-wrap:wrap;gap:6px}
  .fpc-chips button{font:inherit;min-height:44px;padding:6px 14px;border:1px solid var(--l-n-83);border-radius:999px;background:var(--s-n-100);cursor:pointer}
  .fpc-chips button.on{background:var(--s-blue-42);border-color:var(--l-blue-42);color:var(--t-n-100)}
  .fpc-row{display:flex;align-items:center;gap:10px}
  .fpc-row input[type=range]{flex:1;min-height:44px;padding:0;border:0}
  .fpc-big{font:inherit;font-size:22px;font-weight:700;min-width:56px;min-height:52px;border:1px solid var(--l-n-83);border-radius:12px;background:var(--s-n-100);cursor:pointer}
  .fpc-num{font-size:24px;font-weight:700;min-width:64px;text-align:center}
  .fpc-btn{font:inherit;min-height:44px;padding:6px 14px;border:1px solid var(--l-n-83);border-radius:10px;background:var(--s-n-100);cursor:pointer}
  .fpc-btn.primary{background:var(--s-blue-42);border-color:var(--l-blue-42);color:var(--t-n-100)}
  .fpc-stars button{font-size:30px;line-height:1;min-width:48px;min-height:48px;border:0;background:none;cursor:pointer;color:var(--t-n-83)}
  .fpc-stars button.on{color:var(--t-amber-70)}
  .fpc-cam{position:fixed;inset:0;z-index:9500;background:var(--s-n-0);display:flex;flex-direction:column}
  .fpc-cam video{flex:1 1 auto;min-height:0;width:100%;object-fit:contain;background:var(--s-n-0)}
  .fpc-cam-bar{display:flex;align-items:center;justify-content:center;gap:16px;padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:var(--s-n-0);color:var(--t-n-100);flex-wrap:wrap}
  .fpc-cam-bar .fpc-btn{min-height:52px;padding:8px 18px;background:var(--s-n-19);border-color:var(--l-n-38);color:var(--t-n-100)}
  .fpc-cam-shot{width:72px;height:72px;border-radius:50%;border:5px solid var(--l-n-95);background:var(--s-red-54);cursor:pointer;flex:none}
  .fpc-cam-shot:disabled{opacity:.4;cursor:default}
  .fpc-cam-count{min-width:90px;text-align:center;font-size:15px}
  .fpc-cam-msg{position:absolute;top:16px;left:16px;right:16px;padding:12px 14px;border-radius:10px;background:var(--s-red-94);color:var(--t-red-27);font-size:15px}
  .fpc-cam-flash{position:absolute;inset:0;background:var(--s-n-100);opacity:0;pointer-events:none;transition:opacity .25s}
  .fpc-thumbs{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
  .fpc-thumb{position:relative;width:96px;height:96px;border-radius:10px;overflow:hidden;border:1px solid var(--l-n-88);background:var(--s-n-100);display:flex;align-items:center;justify-content:center;font-size:12px;text-align:center;padding:4px}
  .fpc-thumb img{width:100%;height:100%;object-fit:cover}
  .fpc-thumb button{position:absolute;top:3px;right:3px;width:28px;height:28px;border-radius:50%;border:0;background:rgba(0,0,0,.6);color:var(--t-n-100);cursor:pointer}
  .fpc-sig{width:100%;height:170px;border:1px solid var(--l-n-83);border-radius:10px;background:var(--pad-bg,#fff);touch-action:none;display:block}/* theme-exception: pad fallback */
  .fpc-list{border:1px solid var(--l-n-88);border-radius:10px;margin-top:6px;max-height:260px;overflow:auto;background:var(--s-n-100)}
  .fpc-list button{display:block;width:100%;text-align:left;font:inherit;min-height:44px;padding:8px 12px;border:0;border-bottom:1px solid var(--l-n-95);background:var(--s-n-100);cursor:pointer}
  .fpc-list button:hover{background:var(--s-n-100)}
  .fpc-picked{display:flex;align-items:center;gap:10px;min-height:48px;padding:6px 12px;border:1px solid var(--l-n-83);border-radius:10px;background:var(--s-n-95)}
  .fpc-picked span{flex:1}
  .fpc-people{display:flex;flex-wrap:wrap;gap:6px}
  .fpc-people button{font:inherit;min-height:48px;padding:6px 16px;border:1px solid var(--l-n-83);border-radius:10px;background:var(--s-n-100);cursor:pointer}
  .fpc-people button.sup{border-style:dashed;color:var(--t-blue-42);font-weight:600}
  .fpc-picked .fpc-ok{font-size:13px;color:var(--t-green-47);font-weight:600}
  .fpc-picked .fpc-unv{font-size:13px;color:var(--t-n-42)}
  .fpc-table{width:100%;border-collapse:collapse}
  .fpc-table th{font-size:13px;color:var(--t-n-42);text-align:left;font-weight:600;padding:4px 6px}
  .fpc-table td{padding:4px 6px;vertical-align:top}
  .fpc-table input,.fpc-table select{min-height:44px}
  .fpc-table .rowlabel{font-weight:600;white-space:nowrap;padding-top:14px}
  .fpc-pin{overflow:auto;border:1px solid var(--l-n-88);border-radius:10px;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
  .fpc-pin .fpc-table th{position:sticky;top:0;z-index:2;background:var(--s-n-100);box-shadow:inset 0 -1px 0 var(--d-n-88);padding:8px 6px}
  .fpc-pin.first .fpc-table tr>*:first-child{position:sticky;left:0;z-index:1;background:var(--s-n-100);box-shadow:inset -1px 0 0 var(--d-n-88)}
  .fpc-pin.first .fpc-table tr>th:first-child{z-index:3;background:var(--s-n-100)}
  .fpc-card{border:1px solid var(--l-n-88);border-radius:12px;padding:10px 12px;margin-bottom:10px;background:var(--s-n-100)}
  .fpc-card-head{display:flex;justify-content:space-between;align-items:center;font-weight:600;margin-bottom:6px}
  .fpc-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px 12px}
  .fpc-card-grid label{display:block;font-size:13px;color:var(--t-n-42);margin-bottom:3px}
  .fpc-note{font-size:13px;color:var(--t-n-42);margin-top:4px}
  /* ---------- UI Release B: the operator look ---------- */
  .fpc-chips{gap:8px}
  .fpc-chips button{min-height:var(--touch);padding:6px 18px;border:1.5px solid var(--line-2);background:var(--surface);color:var(--fg);font-weight:650}
  .fpc-chips button.on{border-color:var(--kc,var(--accent));background:var(--kt,var(--accent-t));color:var(--kc,var(--accent))}
  .fpc-chips button.on::before{content:"\\2713" / "";margin-right:6px;font-weight:700}
  .fpc-big{min-width:var(--touch-lg);width:var(--touch-lg);height:var(--touch-lg);min-height:var(--touch-lg);border:1.5px solid var(--line-2);border-radius:14px;background:var(--surface);color:var(--fg);font-size:28px;line-height:1;display:grid;place-items:center;padding:0}
  .fpc-big:active{background:var(--surface-2)}
  .fpc-big+.fpc-num{flex:1}
  .fpc-row input[type=range]~.fpc-num{font-size:24px;border:0;background:none;padding:0}
  .fpc-num{min-width:64px;text-align:center;font-size:34px;font-weight:700;font-variant-numeric:tabular-nums;border:1px solid var(--line);border-radius:14px;padding:6px;background:var(--surface-2);color:var(--fg)}
  .fpc-btn{min-height:var(--touch);padding:6px 18px;border:1.5px solid var(--line-2);border-radius:12px;background:var(--surface);color:var(--fg);font-weight:650}
  .fpc-btn.primary{background:var(--accent);border-color:var(--accent);color:var(--accent-fg)}
  .fpc-stars button{min-width:var(--touch);min-height:var(--touch);color:var(--muted)}
  .fpc-stars button.on{color:var(--warn)}
  .fpc-photo{border:1.5px dashed var(--line-2);border-radius:12px;min-height:72px;padding:10px 12px;justify-content:center;flex-wrap:wrap;color:var(--muted);font-weight:600}
  .fpc-sig{border:1.5px dashed var(--line-2);border-radius:12px}
  .fpc-thumb{width:112px;height:112px;border-color:var(--line);background:var(--surface)}
  .fpc-thumb button{width:var(--touch);height:var(--touch);top:0;right:0;border-radius:0 10px 0 12px}
  .fpc-list{border-color:var(--line);background:var(--surface)}
  .fpc-list button{min-height:var(--touch);background:var(--surface);color:var(--fg);border-bottom-color:var(--line)}
  .fpc-list button:hover{background:var(--surface-2)}
  .fpc-picked{min-height:var(--touch);border:1.5px solid var(--line-2);border-radius:12px;background:var(--surface-2);font-size:var(--fs-entry);font-weight:650}
  .fpc-picked .fpc-ok{font-size:var(--fs-sm);color:var(--good)}
  .fpc-picked .fpc-unv,.fpc-note,.fpc-table th,.fpc-card-grid label{color:var(--muted)}
  .fpc-note{font-size:var(--fs-sm)}
  .fpc-people{gap:8px}
  .fpc-people button{min-height:var(--touch-lg);padding:6px 22px;border:1.5px solid var(--line-2);border-radius:12px;background:var(--surface);color:var(--fg);font-size:var(--fs-entry);font-weight:650}
  .fpc-people button:active{background:var(--surface-2)}
  .fpc-people button.sup{border-style:dashed;color:var(--accent)}
  .fpc-table input,.fpc-table select{min-height:52px;font-size:var(--fs-entry)}
  .fpc-card{border-radius:14px;border-color:var(--line);background:var(--surface)}`;
  if (!document.getElementById('fp-controls-css')) {
    const s = document.createElement('style');
    s.id = 'fp-controls-css';
    s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }

  const S = (name, type, label, extra) => Object.assign({ name, type, label }, extra || {});
  const MEDIA = [];
  const opts = f => (f.options || []).map(o => (o && typeof o === 'object' ? { value: o.value, label: o.label || String(o.value) } : { value: o, label: String(o) }));
  const num = x => (typeof x === 'number' ? x : x == null || x === '' ? null : Number(String(x).replace(',', '.')));
  const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /* ---------- chips ---------- */
  // Options listed, or from a formula (0.43): optionsFrom gives a list (items stand for their IDs), optionLabel what each says.
  FP.forms.register('chips', {
    describe: { label: 'Chips', category: 'entry', value: 'a list of the options picked', help: 'Several choices at once.',
      settings: [S('options', 'options', 'Options', { help: 'Required unless options come from a formula.' }), S('optionsFrom', 'formula', 'Options from a formula', { help: 'e.g. EACH(FILTER(lines, item.active), item.$id)' }),
        S('optionLabel', 'formula', 'Each option says', { help: 'With options from a formula: a formula with item.' }), S('max', 'integer', 'At most', { min: 1 })] },
    check(f, where, p) {
      if (!(Array.isArray(f.options) && f.options.length) && !f.optionsFrom) p.push(`${where}: chips need options, or options from a formula`);
    },
    make(f, api) {
      const wrap = api.el('div', 'fpc-chips');
      const chosen = new Set();
      let list = opts(f);
      let btns = [];
      const key = v => String(v);
      const paint = () => btns.forEach(({ b, o }) => { b.className = chosen.has(key(o.value)) ? 'on' : ''; b.setAttribute('aria-pressed', chosen.has(key(o.value))); });
      const build = () => {
        wrap.replaceChildren();
        btns = list.map(o => {
          const b = api.el('button', null, o.label);
          b.type = 'button';
          b.onclick = () => { if (chosen.has(key(o.value))) chosen.delete(key(o.value)); else chosen.add(key(o.value)); paint(); api.fire(); };
          wrap.appendChild(b);
          return { b, o };
        });
        if (!list.length && f.optionsFrom) wrap.appendChild(api.el('span', 'fpc-note', 'Nothing to choose from yet'));
        paint();
      };
      build();
      const out = {
        wrap,
        // Picked ones that are no longer offered stay picked until the options arrive (a draft before its formula).
        get: () => { if (!chosen.size) return null; const offered = list.filter(o => chosen.has(key(o.value))).map(o => o.value); const extra = Array.from(chosen).filter(k => !list.some(o => key(o.value) === k)); return offered.concat(extra); },
        set: v => { chosen.clear(); (Array.isArray(v) ? v : v == null ? [] : [v]).forEach(x => chosen.add(key(x))); paint(); },
        focus: () => btns[0] && btns[0].b.focus(),
        problem: () => (f.max && chosen.size > f.max ? `Choose at most ${f.max}` : null),
      };
      if (f.optionsFrom && !(Array.isArray(f.options) && f.options.length)) {
        out.setOptions = v => {
          const raw = Array.isArray(v) ? v : [];
          const seen = new Set();
          const next = raw.map(o => (o && typeof o === 'object' ? { value: o.value != null ? o.value : o.$id != null ? o.$id : o.id, label: o.label != null ? String(o.label) : String(o.value != null ? o.value : o.$id != null ? o.$id : o.id) } : { value: o, label: String(o) }))
            .filter(o => o.value != null && o.value !== '' && !seen.has(key(o.value)) && seen.add(key(o.value)));
          if (JSON.stringify(next) === JSON.stringify(list)) return;
          list = next;
          build();
        };
      }
      return out;
    },
  });

  /* ---------- slider ---------- */
  FP.forms.register('slider', {
    describe: { label: 'Slider', category: 'entry', value: 'a number', help: 'A number on a scale.',
      settings: [S('min', 'number', 'Lowest', { required: true }), S('max', 'number', 'Highest', { required: true }), S('step', 'number', 'Step'), S('unit', 'text', 'Unit')] },
    check(f, where, p) { if (typeof f.min === 'number' && typeof f.max === 'number' && f.max <= f.min) p.push(`${where}: max must be above min`); },
    make(f, api) {
      const wrap = api.el('div');
      const row = api.el('div', 'fpc-row');
      const r = api.el('input'); r.type = 'range'; r.min = f.min; r.max = f.max; r.step = f.step || 1;
      const out = api.el('span', 'fpc-num', '—');
      let touched = false;
      const paint = () => { out.textContent = touched ? `${r.value}${f.unit ? ' ' + f.unit : ''}` : '—'; };
      r.oninput = () => { touched = true; paint(); api.fire(); };
      r.value = f.default != null ? f.default : (f.min + f.max) / 2;
      row.append(r, out);
      wrap.appendChild(row);
      return {
        wrap,
        get: () => (touched ? Number(r.value) : null),
        set: v => { touched = v != null; r.value = v == null ? (f.default != null ? f.default : (f.min + f.max) / 2) : v; paint(); },
        focus: () => r.focus(),
      };
    },
  });

  /* ---------- tally ---------- */
  FP.forms.register('tally', {
    describe: { label: 'Tally', category: 'entry', value: 'a number', help: 'A counter with − and +.',
      settings: [S('min', 'number', 'Lowest'), S('max', 'number', 'Highest'), S('step', 'number', 'Step')] },
    make(f, api) {
      const wrap = api.el('div', 'fpc-row');
      const minus = api.el('button', 'fpc-big', '−'); minus.type = 'button'; minus.setAttribute('aria-label', 'Less');
      const plus = api.el('button', 'fpc-big', '+'); plus.type = 'button'; plus.setAttribute('aria-label', 'More');
      const out = api.el('span', 'fpc-num', '0');
      let n = null;
      const step = f.step || 1, lo = f.min != null ? f.min : 0, hi = f.max != null ? f.max : Infinity;
      const paint = () => { out.textContent = n == null ? '0' : String(n); };
      minus.onclick = () => { n = Math.max(lo, (n || 0) - step); paint(); api.fire(); };
      plus.onclick = () => { n = Math.min(hi, (n || 0) + step); paint(); api.fire(); };
      wrap.append(minus, out, plus);
      return { wrap, get: () => n, set: v => { n = v == null ? null : Number(v); paint(); }, focus: () => plus.focus() };
    },
  });

  /* ---------- timer ---------- */
  FP.forms.register('timer', {
    describe: { label: 'Timer', category: 'entry', value: 'seconds', help: 'Start, stop and reset.', settings: [] },
    make(f, api) {
      const wrap = api.el('div', 'fpc-row');
      const out = api.el('span', 'fpc-num', '0:00');
      const go = api.el('button', 'fpc-btn primary', 'Start'); go.type = 'button';
      const reset = api.el('button', 'fpc-btn', 'Reset'); reset.type = 'button';
      let base = 0, startedAt = null, tick = null;
      const secs = () => base + (startedAt ? (Date.now() - startedAt) / 1000 : 0);
      const paint = () => { out.textContent = mmss(secs()); go.textContent = startedAt ? 'Stop' : base ? 'Continue' : 'Start'; };
      go.onclick = () => {
        if (startedAt) { base = secs(); startedAt = null; clearInterval(tick); }
        else { startedAt = Date.now(); tick = setInterval(() => { if (!wrap.isConnected) { clearInterval(tick); return; } paint(); }, 500); }
        paint(); api.fire();
      };
      reset.onclick = () => { base = 0; startedAt = null; clearInterval(tick); paint(); api.fire(); };
      wrap.append(out, go, reset);
      return {
        wrap,
        get: () => { const s = Math.round(secs()); return s || startedAt ? s : null; },
        set: v => { clearInterval(tick); startedAt = null; base = v == null ? 0 : Number(v); paint(); },
        focus: () => go.focus(),
        problem: () => (startedAt ? 'Stop the timer first' : null),
      };
    },
  });

  /* ---------- rating ---------- */
  FP.forms.register('rating', {
    describe: { label: 'Rating', category: 'entry', value: 'a number from 1', help: 'Stars from 1 to max.', settings: [S('max', 'integer', 'Stars', { min: 2, default: 5 })] },
    make(f, api) {
      const wrap = api.el('div', 'fpc-stars');
      const max = f.max || 5;
      let n = null;
      const btns = Array.from({ length: max }, (_, i) => {
        const b = api.el('button', null, '★'); b.type = 'button'; b.setAttribute('aria-label', `${i + 1} of ${max}`);
        b.onclick = () => { n = n === i + 1 ? null : i + 1; paint(); api.fire(); };
        wrap.appendChild(b);
        return b;
      });
      const paint = () => btns.forEach((b, i) => { b.className = n != null && i < n ? 'on' : ''; });
      return { wrap, get: () => n, set: v => { n = v == null ? null : Number(v); paint(); }, focus: () => btns[0].focus() };
    },
  });

  /* ---------- photo and file: files kept until the form is saved ---------- */
  function fileControl(f, api) {
    const wrap = api.el('div');
    const input = api.el('input'); input.type = 'file'; input.hidden = true;
    if (f.accept) input.accept = f.accept;
    input.multiple = f.multiple !== false;
    // camera: true opens the camera inside the page (Windows tablets and PCs ignore the file box's
    // camera hint); choosing a file is still offered beside it.
    const hasCamera = !!(f.camera && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const add = api.el('button', 'fpc-btn' + (hasCamera ? ' primary' : ''), hasCamera ? (f.buttonLabel || 'Take photo') : (f.buttonLabel || 'Add')); add.type = 'button';
    const choose = api.el('button', 'fpc-btn', f.fileLabel || 'Choose file'); choose.type = 'button';
    const buttons = api.el('div', 'fpc-row fpc-photo');
    const thumbs = api.el('div', 'fpc-thumbs');
    const note = api.el('div', 'fpc-note');
    let files = [];
    const urls = [];
    const paint = () => {
      urls.splice(0).forEach(u => URL.revokeObjectURL(u));
      thumbs.replaceChildren(...files.map((file, i) => {
        const t = api.el('div', 'fpc-thumb');
        if (/^image\//.test(file.type)) { const u = URL.createObjectURL(file); urls.push(u); const img = api.el('img'); img.src = u; img.alt = file.name; t.appendChild(img); }
        else t.textContent = file.name;
        const x = api.el('button', null, '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Remove ' + file.name);
        x.onclick = () => { files.splice(i, 1); paint(); api.fire(); };
        t.appendChild(x);
        return t;
      }));
    };
    const room = () => (f.multiple === false ? 1 : f.max ? Math.max(0, f.max - files.length) : Infinity);
    function take(list) {
      const max = (FP.media && FP.media.maxBytes) || 25 * 1048576;
      const big = [];
      list.forEach(file => { if (file.size > max) big.push(file.name); else files.push(file); });
      if (f.multiple === false) files = files.slice(-1);
      if (f.max) files = files.slice(0, f.max);
      note.textContent = big.length ? `Too big (over ${Math.round(max / 1048576)} MB): ${big.join(', ')}` : '';
      paint(); api.fire();
    }
    input.onchange = () => { take(Array.from(input.files)); input.value = ''; };

    /* The camera, full screen: tap the round button for each photo, Done to go back. */
    async function openCamera() {
      const box = api.el('div', 'fpc-cam');
      const video = api.el('video'); video.autoplay = true; video.muted = true; video.setAttribute('playsinline', '');
      const flash = api.el('div', 'fpc-cam-flash');
      const bar = api.el('div', 'fpc-cam-bar');
      const shot = api.el('button', 'fpc-cam-shot'); shot.type = 'button'; shot.setAttribute('aria-label', 'Take photo'); shot.disabled = true;
      const count = api.el('div', 'fpc-cam-count', '');
      const flip = api.el('button', 'fpc-btn', 'Switch camera'); flip.type = 'button'; flip.hidden = true;
      const done = api.el('button', 'fpc-btn', 'Done'); done.type = 'button';
      bar.append(flip, shot, count, done);
      box.append(video, flash, bar);
      document.body.appendChild(box);
      let stream = null, cams = [], camIndex = -1, taken = 0;
      const stop = () => { if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; };
      const close = () => { stop(); box.remove(); document.removeEventListener('keydown', onKey); add.focus(); };
      const onKey = e => { if (e.key === 'Escape') close(); else if ((e.key === ' ' || e.key === 'Enter') && !shot.disabled && document.activeElement !== done && document.activeElement !== flip) { e.preventDefault(); snap(); } };
      document.addEventListener('keydown', onKey);
      done.onclick = close;
      const fail = (e) => {
        const m = api.el('div', 'fpc-cam-msg');
        m.textContent = e && e.name === 'NotAllowedError' ? 'The camera was blocked. Allow it for this page (the camera icon at the right of the address bar), or press Done and use Choose file.'
          : e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') ? 'No camera was found on this device. Press Done and use Choose file.'
          : e && e.name === 'NotReadableError' ? 'The camera is in use by another app. Close it and try again, or use Choose file.'
          : `The camera could not start (${(e && e.message) || e}). Press Done and use Choose file.`;
        box.appendChild(m);
      };
      async function start(deviceId) {
        stop();
        shot.disabled = true;
        const video1 = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } };
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: Object.assign(video1, { width: { ideal: 1920 }, height: { ideal: 1080 } }) });
        video.srcObject = stream;
        await video.play().catch(() => {});
        const track = stream.getVideoTracks()[0];
        const id = track && track.getSettings ? track.getSettings().deviceId : null;
        if (id) FP.kv.set('cameraId', id).catch(() => {});
        cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
        camIndex = Math.max(0, cams.findIndex(d => d.deviceId === id));
        flip.hidden = cams.length < 2;
        shot.disabled = false;
        shot.focus();
      }
      flip.onclick = () => start(cams[(camIndex + 1) % cams.length].deviceId).catch(fail);
      function snap() {
        if (!video.videoWidth || room() <= 0) return;
        const c = document.createElement('canvas');
        c.width = video.videoWidth; c.height = video.videoHeight;
        c.getContext('2d').drawImage(video, 0, 0);
        flash.style.transition = 'none'; flash.style.opacity = '.8';
        requestAnimationFrame(() => { flash.style.transition = ''; flash.style.opacity = '0'; });
        c.toBlob(blob => {
          if (!blob) return;
          const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
          take([new File([blob], `photo-${stamp}${taken ? '-' + (taken + 1) : ''}.jpg`, { type: 'image/jpeg' })]);
          taken++;
          count.textContent = `${taken} taken`;
          if (room() <= 0) close();
        }, 'image/jpeg', 0.9);
      }
      shot.onclick = snap;
      try {
        const saved = await FP.kv.get('cameraId').catch(() => null);
        await start(saved).catch(e => (saved ? start(null) : Promise.reject(e)));
      } catch (e) { fail(e); }
    }

    add.onclick = () => (hasCamera ? openCamera() : input.click());
    choose.onclick = () => input.click();
    buttons.append(add);
    if (hasCamera) buttons.append(choose);
    wrap.append(buttons, input, thumbs, note);
    return {
      wrap,
      get: () => (files.length ? files.slice() : null),
      formulaValue: () => (files.length ? files.map(x => x.name) : null),
      set: v => { files = Array.isArray(v) ? v.filter(x => x instanceof Blob) : []; paint(); },
      focus: () => add.focus(),
      media: async () => files.map(file => ({ file })),
    };
  }
  FP.forms.register('file', {
    describe: { label: 'File or photo', category: 'entry', value: 'paths of the files in the media folder', help: 'Files, or the camera. Saved into the media folder (photos in media/photos), named form_record_field_person_time.',
      settings: [S('accept', 'text', 'File types', { help: 'e.g. image/* or .pdf' }), S('camera', 'boolean', 'Offer the camera'), S('multiple', 'boolean', 'More than one', { default: true }),
        S('max', 'integer', 'At most', { min: 1 }), S('buttonLabel', 'text', 'Main button label'), S('fileLabel', 'text', 'Choose-file button label')].concat(MEDIA) },
    make: fileControl,
  });

  /* ---------- draw: a drawing pad ---------- */
  FP.forms.register('draw', {
    describe: { label: 'Drawing pad', category: 'entry', value: 'the path of the drawing in the media folder', help: 'Signatures and sketches. Saved into media/signatures, named form_record_field_person_time.',
      settings: [S('height', 'integer', 'Height (px)', { min: 80 })].concat(MEDIA) },
    make(f, api) {
      const wrap = api.el('div');
      const c = api.el('canvas', 'fpc-sig');
      if (f.height) c.style.height = f.height + 'px';
      const bar = api.el('div', 'fpc-row');
      const clear = api.el('button', 'fpc-btn', 'Clear'); clear.type = 'button';
      bar.style.marginTop = '6px';
      bar.append(api.el('span', 'fpc-note', f.hint || 'Draw with a finger or the mouse.'), clear);
      wrap.append(c, bar);
      let strokes = 0, last = null, data = null;
      const ctx = () => c.getContext('2d');
      const fit = () => {
        const r = c.getBoundingClientRect();
        if (!r.width) return;
        const w = Math.round(r.width * devicePixelRatio), h = Math.round(r.height * devicePixelRatio);
        if (c.width === w && c.height === h) return;
        c.width = w; c.height = h;
        const g = ctx(); g.lineWidth = 2.5 * devicePixelRatio; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = (FP.theme && FP.theme.token('pad-ink')) || '#111'; // theme-exception: '#111' only when FP.theme is absent (a unit-test stub)
        if (data) { const img = new Image(); img.onload = () => ctx().drawImage(img, 0, 0, c.width, c.height); img.src = data; }
      };
      const pt = e => { const r = c.getBoundingClientRect(); return [(e.clientX - r.left) * devicePixelRatio, (e.clientY - r.top) * devicePixelRatio]; };
      c.onpointerdown = e => { fit(); c.setPointerCapture(e.pointerId); last = pt(e); };
      c.onpointermove = e => {
        if (!last) return;
        const p = pt(e), g = ctx();
        g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke();
        last = p;
      };
      c.onpointerup = c.onpointercancel = () => { if (!last) return; last = null; strokes++; data = c.toDataURL('image/png'); api.fire(); };
      clear.onclick = () => { strokes = 0; data = null; ctx().clearRect(0, 0, c.width, c.height); api.fire(); };
      requestAnimationFrame(fit);
      return {
        wrap,
        get: () => data,
        formulaValue: () => (data ? 'drawn' : null),
        single: true,
        set: v => { data = typeof v === 'string' && v.startsWith('data:image') ? v : null; strokes = data ? 1 : 0; ctx().clearRect(0, 0, c.width, c.height); fit(); if (data) { const img = new Image(); img.onload = () => ctx().drawImage(img, 0, 0, c.width, c.height); img.src = data; } },
        focus: () => clear.focus(),
        media: async () => {
          if (!data) return [];
          // A data: URL to a file without fetch (blocked on pages opened from file://).
          const bin = atob(data.slice(data.indexOf(',') + 1));
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          return [{ file: new File([bytes], `${f.name}.png`, { type: 'image/png' }) }];
        },
      };
    },
  });

  /* ---------- pick: choose an existing item ---------- */
  /* ---------- person: who did it (0.50.1) ----------
   * For a terminal where a supervisor signs in and stays responsible, and the people doing the work don't sign in:
   * each taps their name (no PIN). A supervisor taps "I am a supervisor" and enters their PIN, so a supervisor's
   * name is only ever on a record with their PIN behind it. pin: everyone asks everyone for their PIN.
   * The value is the person's name; the record also keeps who it was and whether a PIN confirmed it (a reference
   * named after the field: { structure: users, id, name, verified }). */
  FP.forms.register('person', {
    describe: { label: 'Who did it', category: 'entry', value: 'the person\'s name', help: 'On a shared terminal: each person taps their name; a supervisor confirms with their PIN. The record keeps whether a PIN confirmed it.',
      settings: [S('pin', 'choice', 'Who enters a PIN', { options: ['supervisors', 'everyone'], help: 'supervisors (or left out): people tap their name; supervisors and up confirm with their PIN. everyone: each person confirms with their PIN.' })] },
    make(f, api) {
      const wrap = api.el('div');
      const people = api.el('div', 'fpc-people');
      const picked = api.el('div', 'fpc-picked'); picked.hidden = true;
      const label = api.el('span');
      const tag = api.el('small');
      const change = api.el('button', 'fpc-btn', 'Change'); change.type = 'button';
      picked.append(label, tag, change);
      const note = api.el('div', 'fpc-note');
      wrap.append(people, picked, note);
      let who = null, users = null;
      const isSup = u => (u.roles || []).some(r => ['supervisor', 'publisher', 'admin'].includes(r));
      const show = () => {
        picked.hidden = !who; people.hidden = !!who;
        if (!who) return;
        label.textContent = who.name;
        tag.textContent = who.verified ? '✓ PIN' : 'not confirmed by PIN';
        tag.className = who.verified ? 'fpc-ok' : 'fpc-unv';
      };
      const confirm = async role => {
        note.textContent = '';
        const ok = await FP.users.approve(role, role === 'supervisor' ? 'Your PIN puts your name on this record.' : 'Find your name, then enter your PIN: it puts your name on this record.').catch(e => { note.textContent = e.message; return null; });
        if (!ok) return;
        who = { id: ok.userId, name: ok.name, verified: true };
        show(); api.fire();
      };
      async function paintPeople() {
        if (!users) users = (await FP.users.list().catch(() => [])).filter(u => u.active !== false);
        people.replaceChildren();
        if (f.pin === 'everyone') {
          const b = api.el('button', 'sup', 'Who are you? (PIN)'); b.type = 'button'; b.onclick = () => confirm('user');
          people.appendChild(b);
          return;
        }
        users.filter(u => !isSup(u)).sort((a, b) => a.name.localeCompare(b.name)).forEach(u => {
          const b = api.el('button', null, u.name); b.type = 'button';
          b.onclick = () => { who = { id: u.id, name: u.name, verified: false }; show(); api.fire(); };
          people.appendChild(b);
        });
        const s = api.el('button', 'sup', 'I am a supervisor'); s.type = 'button'; s.onclick = () => confirm('supervisor');
        people.appendChild(s);
      }
      change.onclick = () => { who = null; show(); paintPeople(); api.fire(); };
      paintPeople().catch(() => {});
      return {
        wrap,
        get: () => (who ? who.name : null),
        // From a draft or a prefill: the name only, so a PIN is never carried over; a supervisor's name is dropped.
        set: v => {
          if (v == null || v === '') { who = null; show(); return; }
          const name = typeof v === 'object' ? v.name : String(v);
          (users ? Promise.resolve() : FP.users.list().then(l => { users = l; })).then(() => {
            const u = (users || []).find(x => x.name === name);
            who = u && !isSup(u) && f.pin !== 'everyone' ? { id: u.id, name: u.name, verified: false } : null;
            show(); if (!who) paintPeople().catch(() => {});
            if (api.recalc) api.recalc();
          }).catch(() => {});
        },
        ref: () => (who ? { structure: 'users', id: who.id, name: who.name, verified: who.verified } : null),
        focus: () => { const b = people.querySelector('button'); if (b) b.focus(); },
      };
    },
  });

  FP.forms.register('pick', {
    describe: { label: 'Item picker', category: 'entry', value: 'the item ID', help: 'Choose an existing item of a structure, by typing or scanning.',
      settings: [S('structure', 'structure', 'Structure'), S('filter', 'formula', 'Only items where', { help: 'A formula over the item\'s values, e.g. status <> "Shipped".' }),
        S('show', 'text', 'Shown as', { help: 'e.g. {id} · qty {qty}' }), S('fill', 'map', 'Fills fields', { help: 'Field of this form: container of the item.', keys: 'field', values: 'text' }),
        S('closedToo', 'boolean', 'Closed ones too', { help: 'Off: only the open items, by the structure\'s kind (a list\'s items in use, runs still running, orders not done). 0.60.' }),
        S('placeholder', 'text', 'Placeholder')] },
    make(f, api) {
      const wrap = api.el('div');
      const search = api.el('input'); search.placeholder = f.placeholder || (`Type or scan the ${(((FP.structures.get(f.structure) || {}).itemId || {}).label || 'ID').replace(/^[A-Z](?=[a-z])/, c => c.toLowerCase())} to find…`); search.autocomplete = 'off';
      const list = api.el('div', 'fpc-list'); list.hidden = true;
      const picked = api.el('div', 'fpc-picked'); picked.hidden = true;
      const label = api.el('span');
      const change = api.el('button', 'fpc-btn', 'Change'); change.type = 'button';
      picked.append(label, change);
      wrap.append(search, list, picked);
      let value = null, items = null;
      const facts = it => Object.assign({}, it.values, { id: it.id, status: it.status, lastAction: it.lastAction, firstAt: it.firstAt, lastAt: it.lastAt });
      const text = it => (f.show || '{id}').replace(/\{(\w+)\}/g, (_, k) => { const v = facts(it)[k]; return v == null ? '—' : String(v); });
      async function loadItems() {
        const r = await FP.current.load(f.structure);
        items = Array.from(r.items.values())
          .filter(it => f.closedToo || !FP.kinds || FP.kinds.isOpen(f.structure, it))
          .filter(it => !f.filter || FP.fn.evaluate(f.filter, facts(it)) === true)
          .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
      }
      async function paintList() {
        if (!items) { list.hidden = false; list.replaceChildren(api.el('div', 'fpc-note', 'Loading…')); await loadItems(); }
        const q = search.value.trim().toLowerCase();
        const hits = items.filter(it => !q || text(it).toLowerCase().includes(q)).slice(0, 40);
        list.replaceChildren(...hits.map(it => { const b = api.el('button', null, text(it)); b.type = 'button'; b.onclick = () => choose(it); return b; }));
        if (!hits.length) list.appendChild(api.el('div', 'fpc-note', q ? 'Nothing matches.' : 'Nothing to pick.'));
        list.hidden = false;
      }
      function choose(it) {
        value = it.id;
        label.textContent = text(it);
        picked.hidden = false; search.hidden = true; list.hidden = true;
        Object.entries(f.fill || {}).forEach(([field, container]) => api.setField(field, it.values[container] == null ? null : it.values[container]));
        api.fire();
      }
      search.onfocus = () => { items = null; paintList(); };   // read again each time: an item saved since shows
      search.oninput = () => { paintList(); };
      search.onkeydown = async e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (!items) await loadItems();
        const q = search.value.trim().toLowerCase();
        if (!q) return;   // nothing typed: Enter picks nothing (it used to pick the most recent item)
        const exact = items.find(it => it.id.toLowerCase() === q) || items.find(it => text(it).toLowerCase().includes(q));
        if (exact) { choose(exact); api.next(); }
      };
      change.onclick = () => { value = null; picked.hidden = true; search.hidden = false; search.value = ''; search.focus(); api.fire(); };
      return {
        wrap,
        get: () => value,
        set: v => {
          value = v == null ? null : String(v);
          if (!value) { picked.hidden = true; search.hidden = false; search.value = ''; items = null; return; }
          label.textContent = value; picked.hidden = false; search.hidden = true;
          (items ? Promise.resolve() : loadItems()).then(() => { const it = items.find(x => x.id === value); if (it) label.textContent = text(it); }).catch(() => {});
        },
        focus: () => (search.hidden ? change.focus() : search.focus()),
      };
    },
  });

  /* ---------- table with one row per item of a list source ----------
   * Shows each item's values; columns marked edit can be changed. Only changed cells are saved, each
   * changed row as an entry on its own item (the form does the saving). Typing survives the list
   * refreshing, as long as the item is still in it. */
  function itemRows(f, api) {
    const wrap = api.el('div');
    const cols = f.columns || [];
    const rows = new Map();   // id -> { item, cells: { name: { node, get, set } }, tr }
    let order = [];
    const show = v => (v == null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? (v.__fp ? '' : JSON.stringify(v)) : String(v));
    const same = (a, b) => (a == null || a === '' ? b == null || b === '' : JSON.stringify(a) === JSON.stringify(b) || String(a) === String(b));
    function cell(c, item) {
      const orig = item[c.name];
      let node, get, set;
      if (c.control === 'choice' || c.control === 'toggle') {
        const list = c.control === 'toggle' ? [{ value: true, label: 'Yes' }, { value: false, label: 'No' }] : opts(c);
        node = api.el('select');
        node.appendChild(api.el('option', null, '')).value = '';
        list.forEach((o, i) => { const op = api.el('option', null, o.label); op.value = String(i); node.appendChild(op); });
        get = () => (node.value === '' ? null : list[Number(node.value)].value);
        set = v => { const i = list.findIndex(o => o.value === v); node.value = i < 0 ? '' : String(i); };
        node.onchange = api.fire;
      } else {
        node = api.el('input');
        if (c.control === 'date') node.type = 'date';
        if (c.control === 'number' || (c.control == null && typeof orig === 'number')) node.inputMode = 'decimal';
        node.autocomplete = 'off';
        const isNum = c.control === 'number' || (c.control == null && typeof orig === 'number');
        get = () => { const t = node.value.trim(); if (!t) return null; if (isNum) { const n = num(t); return isNaN(n) ? { bad: t } : n; } return t; };
        set = v => { node.value = v == null ? '' : String(v); };
        node.oninput = api.fire;
      }
      set(orig == null ? null : orig);
      return { node, get, set };
    }
    function paint() {
      wrap.replaceChildren();
      if (!order.length) { wrap.appendChild(api.el('div', 'fpc-note', f.empty || 'Nothing in the list right now.')); return; }
      const t = api.el('table', 'fpc-table');
      const hr = api.el('tr');
      hr.appendChild(api.el('th', null, f.rowLabel || 'ID'));
      cols.forEach(c => hr.appendChild(api.el('th', null, (c.label || c.name) + (c.unit ? ` (${c.unit})` : ''))));
      t.appendChild(hr);
      order.forEach(id => {
        const r = rows.get(id);
        const tr = api.el('tr');
        tr.appendChild(api.el('td', 'rowlabel', id));
        r.ro = {};
        cols.forEach(c => { const td = api.el('td'); if (r.cells[c.name]) td.appendChild(r.cells[c.name].node); else { td.textContent = show(r.item[c.name]); r.ro[c.name] = td; } tr.appendChild(td); });
        t.appendChild(tr);
      });
      wrap.appendChild(pinned(t, f, api));
    }
    function setRows(list) {
      const items = (Array.isArray(list) ? list : []).filter(it => it && typeof it === 'object');
      const ids = items.map(it => String(it.$id != null ? it.$id : it.id));
      const before = order.join('\n');
      items.forEach((it, k) => {
        const id = ids[k];
        const r = rows.get(id);
        if (r) {
          // Fresh values for cells nobody has touched.
          cols.forEach(c => { const x = r.cells[c.name]; if (x && same(x.get(), r.item[c.name])) x.set(it[c.name] == null ? null : it[c.name]); });
          r.item = it;
        } else {
          const nr = { item: it, cells: {} };
          rows.set(id, nr);
          cols.filter(c => c.edit).forEach(c => { nr.cells[c.name] = cell(c, it); });
        }
      });
      Array.from(rows.keys()).forEach(id => { if (!ids.includes(id)) rows.delete(id); });
      order = ids;
      if (order.join('\n') !== before || !wrap.firstChild) paint();
      else order.forEach(id => { const r = rows.get(id); Object.keys(r.ro || {}).forEach(n => { r.ro[n].textContent = show(r.item[n]); }); });
    }
    function changes() {
      const out = [];
      order.forEach(id => {
        const r = rows.get(id);
        const o = { row: id };
        let any = false;
        cols.filter(c => c.edit).forEach(c => { const v = r.cells[c.name].get(); if (v != null && !same(v, r.item[c.name])) { o[c.name] = v; any = true; } });
        if (any) out.push(o);
      });
      return out.length ? out : null;
    }
    paint();
    return {
      wrap,
      get: changes,
      set: v => { if (v == null) { rows.forEach(r => cols.filter(c => c.edit).forEach(c => r.cells[c.name].set(r.item[c.name] == null ? null : r.item[c.name]))); } else (Array.isArray(v) ? v : []).forEach(o => { const r = o && rows.get(String(o.row)); if (r) Object.keys(o).forEach(k => { if (r.cells[k]) r.cells[k].set(o[k]); }); }); },
      setRows,
      focus: () => { const r = rows.get(order[0]); const c = r && Object.values(r.cells)[0]; if (c) c.node.focus(); },
      problem() {
        for (const id of order) {
          const r = rows.get(id);
          for (const c of cols.filter(x => x.edit)) {
            const v = r.cells[c.name].get();
            if (v && typeof v === 'object' && 'bad' in v) return `${id}: ${c.label || c.name} needs a number`;
          }
        }
        return null;
      },
    };
  }

  /* ---------- table: grid, add-row list, matrix or repeat cards ---------- */
  const CELLS = ['text', 'number', 'choice', 'toggle', 'date'];
  /* A table whose header (and first column) stay in view while it scrolls inside a box of N rows (0.43). */
  function pinned(t, f, api) {
    if (!f.pinHeader && !f.pinFirst) return t;
    const box = api.el('div', 'fpc-pin' + (f.pinFirst ? ' first' : ''));
    if (f.pinHeader) box.style.maxHeight = `${40 + (f.visibleRows || 8) * 56}px`;
    box.appendChild(t);
    return box;
  }

  FP.forms.register('table', {
    describe: { label: 'Table', category: 'entry', value: 'a list of rows ({ row, column: value })', help: 'A fixed grid, a list people add rows to, or repeating cards.',
      settings: [
        S('columns', 'list', 'Columns', { required: true, of: [S('name', 'name', 'Name', { required: true }), S('label', 'text', 'Label'), S('control', 'choice', 'Control', { options: CELLS }),
          S('options', 'options', 'Options'), S('unit', 'text', 'Unit'), S('required', 'boolean', 'Required'),
          S('limits', 'object', 'Allowed range', { help: 'For a number column: a value outside it cannot be saved.', of: [S('min', 'number', 'Lowest'), S('max', 'number', 'Highest')] }),
          S('edit', 'boolean', 'Can be changed', { help: 'For rows from a list: people change this value, and each changed row saves to its own item.' })] }),
        S('rowsFrom', 'name', 'Rows from a list source', { help: 'One row per item of a list source of this form.' }),
        S('rows', 'list', 'Fixed rows', { help: 'Each row\'s name, and a label when it should read differently.', strings: 'key', of: [S('key', 'text', 'Name', { required: true }), S('label', 'text', 'Label')] }), S('rowLabel', 'text', 'Row heading'), S('allRows', 'boolean', 'Every row must be filled'),
        S('addRows', 'boolean', 'People add rows'), S('startRows', 'integer', 'Rows to start with', { min: 0 }), S('maxRows', 'integer', 'At most rows', { min: 1 }), S('minRows', 'integer', 'At least rows', { min: 1, help: 'Once any row is filled in, this many rows must be.' }),
        S('style', 'choice', 'Style', { options: ['grid', 'cards'] }), S('addLabel', 'text', 'Add button label'), S('itemLabel', 'text', 'Card heading'),
        S('empty', 'text', 'When the list is empty', { help: 'For rows from a list, e.g. No runs are open' }),
        S('pinHeader', 'boolean', 'Pin the header row', { help: 'The table scrolls inside itself and its headings stay in view.' }),
        S('visibleRows', 'integer', 'Rows shown before it scrolls', { min: 2, help: 'With the header pinned; 8 unless you say.' }),
        S('pinFirst', 'boolean', 'Pin the first column', { help: 'The row names stay in view when the table scrolls sideways.' })] },
    check(f, where, p, h) {
      if (!Array.isArray(f.columns) || !f.columns.length) return;
      const seen = new Set();
      f.columns.forEach(c => {
        if (!c || !h.NAME_RE.test(c.name || '')) return;
        if (seen.has(c.name)) p.push(`${where}: column ${c.name} is used twice`);
        else seen.add(c.name);
        if (c && c.control === 'choice' && !(Array.isArray(c.options) && c.options.length)) p.push(`${where}: column ${c.name} needs options`);
      });
      if (!f.rows && !f.addRows && !f.rowsFrom) p.push(`${where}: give rows (a fixed grid), addRows: true, or rowsFrom (a list source)`);
      if (f.rows && !Array.isArray(f.rows)) p.push(`${where}: rows is a list of row names`);
    },
    make(f, api) {
      if (f.rowsFrom) return itemRows(f, api);
      const wrap = api.el('div');
      const fixed = Array.isArray(f.rows) ? f.rows.map(r => (r && typeof r === 'object' ? { key: r.key, label: r.label || String(r.key) } : { key: r, label: String(r) })) : null;
      const cols = f.columns;
      let rows = []; // [{ key?, cells: { name: { get, set, el } } }]
      const cards = f.style === 'cards';
      const addBtn = api.el('button', 'fpc-btn', f.addLabel || 'Add row'); addBtn.type = 'button';

      function cellInput(c) {
        let node, get, set;
        if (c.control === 'choice' || c.control === 'toggle') {
          const list = c.control === 'toggle' ? [{ value: true, label: 'Yes' }, { value: false, label: 'No' }] : opts(c);
          node = api.el('select');
          node.appendChild(api.el('option', null, '')).value = '';
          list.forEach((o, i) => { const op = api.el('option', null, o.label); op.value = String(i); node.appendChild(op); });
          get = () => (node.value === '' ? null : list[Number(node.value)].value);
          set = v => { const i = list.findIndex(o => o.value === v); node.value = i < 0 ? '' : String(i); };
          node.onchange = api.fire;
        } else {
          node = api.el('input');
          if (c.control === 'date') node.type = 'date';
          if (c.control === 'number') node.inputMode = 'decimal';
          node.autocomplete = 'off';
          get = () => {
            const s = node.value.trim();
            if (!s) return null;
            if (c.control === 'number') { const n = num(s); return isNaN(n) ? { bad: s } : n; }
            return s;
          };
          set = v => { node.value = v == null ? '' : String(v); };
          node.oninput = api.fire;
        }
        return { node, get, set };
      }

      function addRow(key, label, values) {
        const r = { key, label, cells: {} };
        cols.forEach(c => { r.cells[c.name] = cellInput(c); if (values && values[c.name] !== undefined) r.cells[c.name].set(values[c.name]); });
        rows.push(r);
      }

      function paint() {
        wrap.replaceChildren();
        if (cards) {
          rows.forEach((r, i) => {
            const card = api.el('div', 'fpc-card');
            const head = api.el('div', 'fpc-card-head', r.label || `${f.itemLabel || 'Item'} ${i + 1}`);
            if (!fixed) { const x = api.el('button', 'fpc-btn', 'Remove'); x.type = 'button'; x.onclick = () => { rows.splice(i, 1); paint(); api.fire(); }; head.appendChild(x); }
            const grid = api.el('div', 'fpc-card-grid');
            cols.forEach(c => { const box = api.el('div'); box.append(api.el('label', null, (c.label || c.name) + (c.unit ? ` (${c.unit})` : '') + (c.required ? ' *' : '')), r.cells[c.name].node); grid.appendChild(box); });
            card.append(head, grid);
            wrap.appendChild(card);
          });
        } else {
          const t = api.el('table', 'fpc-table');
          const hr = api.el('tr');
          if (fixed) hr.appendChild(api.el('th', null, f.rowLabel || ''));
          cols.forEach(c => hr.appendChild(api.el('th', null, (c.label || c.name) + (c.unit ? ` (${c.unit})` : '') + (c.required ? ' *' : ''))));
          if (!fixed) hr.appendChild(api.el('th'));
          t.appendChild(hr);
          rows.forEach((r, i) => {
            const tr = api.el('tr');
            if (fixed) tr.appendChild(api.el('td', 'rowlabel', r.label));
            cols.forEach(c => { const td = api.el('td'); td.appendChild(r.cells[c.name].node); tr.appendChild(td); });
            if (!fixed) { const td = api.el('td'); const x = api.el('button', 'fpc-btn', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Remove row'); x.onclick = () => { rows.splice(i, 1); paint(); api.fire(); }; td.appendChild(x); tr.appendChild(td); }
            t.appendChild(tr);
          });
          wrap.appendChild(pinned(t, f, api));
        }
        if (!fixed) {
          addBtn.disabled = f.maxRows != null && rows.length >= f.maxRows;
          wrap.appendChild(addBtn);
        }
      }
      addBtn.onclick = () => { addRow(null, null, null); paint(); const box = wrap.querySelector('.fpc-pin'); if (box) box.scrollTop = box.scrollHeight; const first = rows[rows.length - 1].cells[cols[0].name].node; first.focus(); api.fire(); };

      function reset(value) {
        rows = [];
        const byKey = new Map((Array.isArray(value) ? value : []).map(v => [v && v.row, v]));
        if (fixed) fixed.forEach(r => addRow(r.key, r.label, byKey.get(r.key)));
        else (Array.isArray(value) ? value : []).forEach(v => addRow(null, null, v));
        if (!fixed && !rows.length) for (let i = 0; i < (f.startRows != null ? f.startRows : 1); i++) addRow(null, null, null);
        paint();
      }

      const filled = r => cols.some(c => { const v = r.cells[c.name].get(); return v != null; });
      function value() {
        const out = [];
        rows.forEach(r => {
          if (!filled(r)) return;
          const o = fixed ? { row: r.key } : {};
          cols.forEach(c => { const v = r.cells[c.name].get(); if (v != null && !(typeof v === 'object' && 'bad' in v)) o[c.name] = v; });
          out.push(o);
        });
        return out.length ? out : null;
      }
      reset(null);
      return {
        wrap,
        get: value,
        set: reset,
        focus: () => { const r = rows[0]; if (r) r.cells[cols[0].name].node.focus(); },
        problem() {
          const name = (r, i) => (fixed ? r.label : `Row ${i + 1}`);
          for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (!fixed && !filled(r)) continue;
            if (fixed && !filled(r) && !f.allRows) continue;
            for (const c of cols) {
              const v = r.cells[c.name].get();
              const label = c.label || c.name;
              if (v && typeof v === 'object' && 'bad' in v) return `${name(r, i)}: ${label} needs a number`;
              if (v == null && c.required) return `${name(r, i)}: ${label} is required`;
              if (typeof v === 'number' && c.limits) {
                if (c.limits.min != null && v < c.limits.min) return `${name(r, i)}: ${label} must be at least ${c.limits.min}`;
                if (c.limits.max != null && v > c.limits.max) return `${name(r, i)}: ${label} must be at most ${c.limits.max}`;
              }
            }
          }
          const n = rows.filter(filled).length;
          if (f.minRows && n && n < f.minRows) return `At least ${f.minRows} rows`;
          return null;
        },
      };
    },
  });

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-controls'] = '0.68.0';
})();
