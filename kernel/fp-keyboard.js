/* Form Platform kernel: the on-screen keyboard (0.43)
 * Load after fp-forms.js.
 *
 * Terminals may have a touch screen, a keyboard, a scanner, any of them. The keyboard here shows when a field is
 * tapped with a finger (auto), on every field (always), or never; a terminal's setting says which. Typing on real
 * keys tucks it away. Numbers get a wide three-row pad along the bottom; text gets a full keyboard along the bottom.
 * A field can ask for numbers, text, or none (a scanned rack ID).
 *
 * The page keeps room for it: the CSS variable --fp-kb-bottom is the space it takes, which the page, sub-form
 * sheets and the save bar leave free (--fp-kb-right stays defined, always 0px, for CSS that still reads it). Whichever field has focus gets the keys, so a sub-form
 * sheet on top owns the keyboard while it is open.
 *
 * FP.keyboard.mode       'auto' | 'always' | 'never'   (the launcher sets it from the terminal's settings)
 *                        A form set to keyboard: always (data-keyboard on its root) gets it always, unless the
 *                        terminal is set to never (0.44.5). FP.keyboard.modeFor(element) says which applies.
 * FP.keyboard.setMode(m)
 * FP.keyboard.hide()
 * FP.keyboard.kindOf(input) -> 'numbers' | 'text' | null
 *
 * 0.71: the number pad is along the bottom on every screen (250 px: a 56 px bar and three rows of five keys):
 *          7 8 9 ⌫ Clear
 *          4 5 6 ± .
 *          1 2 3 0 Next
 *        (digits as on a calculator or keypad, the rarely used keys at the right edge, Next where the thumb ends).
 *        A keyboard-always form no longer keeps a place on the right: between fields the keyboard rests as its 56 px bar
 *        ("Tap a box to type") and opens when a box is tapped.
 *        The field is scrolled to the middle of the FREE area (below the head, above the keyboard and the save bar).
 *        FP.keyboard.hidden(field) -> { hidden, free, reason } says whether the keyboard (ours; a device keyboard seen by
 *        navigator.virtualKeyboard or visualViewport) leaves the field, its label and its message in view. While it
 *        does not, the bar turns into a typing card: label, the value as typed (large), unit or hint, the message,
 *        and Back / Next keys. It goes away by itself when the field is in view again. The decision is made as if the
 *        card were not there (its extra height is discounted), so the card cannot make its own reason go away and back.
 */
(function () {
  'use strict';
  const FP = window.FP;
  if (!FP || !FP.forms) throw new Error('Load fp-forms.js before fp-keyboard.js');

  const NUM_H = 250, FULL_H = 344, BAR_H = 56, CARD_H = 120, MIN_FREE = 120;
  const CSS = `
  :root{--fp-kb-right:0px}
  body{padding-right:var(--fp-kb-right,0px);padding-bottom:var(--fp-kb-bottom,0px)}
  .fpf-sheet{right:var(--fp-kb-right,0px);bottom:var(--fp-kb-bottom,0px)}
  .fpf-foot{bottom:var(--fp-kb-bottom,0px)}
  .fpk{position:fixed;z-index:9500;background:var(--surface-2);border-color:var(--line-2);border-style:solid;border-width:0;box-shadow:0 -4px 18px rgba(0,0,0,.14);font:18px/1 var(--font-sans,system-ui,"Segoe UI",sans-serif);color:var(--fg);user-select:none;-webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column}
  .fpk.bottom{left:0;right:0;bottom:0;height:${FULL_H}px;border-top-width:1px}
  .fpk-bar{display:flex;align-items:center;gap:8px;height:${BAR_H}px;padding:0 8px 0 14px;font-size:var(--fs-md,14px);color:var(--muted);flex:0 0 auto}
  .fpk-id{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center}
  .fpk-top{display:flex;align-items:baseline;gap:10px;min-width:0}
  .fpk-bar b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fg);font-size:var(--fs-base,16px);font-weight:650;flex:0 1 auto}
  .fpk-sub{color:var(--muted);font-size:var(--fs-md,14px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  .fpk:not(.focus) .fpk-sub{display:none}
  .fpk-card{display:none}
  .fpk.focus .fpk-card{display:block}
  .fpk.focus .fpk-bar{height:${CARD_H}px;padding:8px 8px 8px 14px;border-bottom:1px solid var(--line)}
  .fpk-row{display:flex;align-items:baseline;gap:10px;min-width:0}
  .fpk-val{font-size:32px;line-height:1.2;font-weight:650;font-variant-numeric:tabular-nums;color:var(--fg);white-space:pre;overflow:hidden;text-overflow:ellipsis;min-width:0}
  .fpk-val .empty{color:var(--muted);font-weight:400}
  .fpk-val .caret{color:var(--accent);font-weight:400;margin:0 1px}
  .fpk-val .sel{background:var(--accent-t)}
  .fpk-unit{font-size:var(--fs-base,16px);color:var(--muted);white-space:nowrap}
  .fpk-err{font-size:var(--fs-md,14px);font-weight:650;color:var(--bad);min-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .fpk-bar .fpk-cardkey{display:none}
  .fpk.focus .fpk-bar .fpk-cardkey{display:inline-block;height:var(--touch-lg,56px);min-width:96px}
  .fpk-bar button.go{background:var(--accent);color:var(--accent-fg);border-color:transparent}
  .fpk-bar button{font:inherit;font-size:var(--fs-md,14px);font-weight:650;height:var(--touch,48px);min-width:var(--touch,48px);padding:0 14px;border:1.5px solid var(--line-2);border-radius:12px;background:var(--surface);color:var(--fg);cursor:pointer}
  .fpk-keys{flex:1;display:grid;gap:6px;padding:0 8px 8px}
  .fpk.bottom .fpk-keys{grid-template-columns:repeat(20,1fr);grid-auto-rows:1fr}
  .fpk.num .fpk-keys{grid-template-columns:repeat(5,1fr);grid-auto-rows:1fr}
  .fpk-keys button{font:inherit;font-size:22px;min-height:var(--touch,48px);border:0;border-radius:12px;background:var(--surface);color:var(--fg);box-shadow:0 1px 0 var(--line-2);cursor:pointer;padding:0}
  .fpk.num .fpk-keys button{min-height:var(--touch-lg,56px);font-size:26px;font-weight:600}
  .fpk.num .fpk-keys button.fn{font-size:24px}.fpk.num .fpk-keys button.go{font-size:var(--fs-base,16px);font-weight:650}
  .fpk-keys button:active,.fpk-keys button.down{background:var(--line)}
  .fpk-keys button.fn{background:var(--line);font-size:var(--fs-base,16px);font-weight:650}
  .fpk-keys button.go{background:var(--accent);color:var(--accent-fg);font-size:var(--fs-base,16px);font-weight:650}
  .fpk-keys button.on{background:var(--fg);color:var(--bg)}
  .fpk-keys .w2{grid-column:span 2}.fpk-keys .w3{grid-column:span 3}.fpk-keys .w4{grid-column:span 4}.fpk-keys .w8{grid-column:span 8}
  .fpk-keys .h2{grid-row:span 2}
  .fpk.idle .fpk-keys{display:none}
  .fpk.idle .fpk-bar button{visibility:hidden}
  .fpk.idle .fpk-bar b{color:var(--muted);font-weight:500}`;

  let mode = 'auto';
  let lastPointer = { type: null, at: 0 };
  // A finger (or mouse) still down when the keyboard would close: it closes once it lifts, so the form doesn't move
  // under the tap and the button pressed gets it (0.44.5).
  let pointerDown = false, closeAfterUp = null;
  let target = null, panel = null, kind = null, shift = false, symbols = false;
  let cardOn = false, lastScroll = 0, checkTimer = null;

  function injectCss() {
    if (document.getElementById('fpk-css')) return;
    const s = document.createElement('style'); s.id = 'fpk-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  /* Which keyboard a field gets: its own setting, else numbers for number fields, text for the rest it types into. */
  const TYPED = new Set(['', 'text', 'search', 'tel', 'email', 'url', 'number', 'password']);
  function kindOf(x) {
    if (!x || x.disabled || x.readOnly) return null;
    const tag = x.tagName;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') return null;
    if (tag === 'INPUT' && !TYPED.has((x.getAttribute('type') || '').toLowerCase())) return null;
    if (!x.closest('.fpf, .fpf-sheet, .fpf-dialog')) return null;   // the platform's forms, not the editor's own boxes
    const own = x.dataset.kb || (x.closest('[data-kb]') && x.closest('[data-kb]').dataset.kb);
    if (own === 'none') return null;
    if (own === 'numbers' || own === 'text') return own;
    const im = x.dataset.kbIm != null ? x.dataset.kbIm : x.inputMode;
    if (tag === 'INPUT' && ((x.getAttribute('type') || '') === 'number' || ['decimal', 'numeric', 'tel'].includes(im))) return 'numbers';
    return 'text';
  }

  // Keep the device's own keyboard away while ours is up (Windows' touch keyboard, a tablet's).
  function quiet(x) { if (x.dataset.kbIm == null) { x.dataset.kbIm = x.inputMode || ''; x.inputMode = 'none'; } }
  function unquiet(x) { if (x && x.dataset.kbIm != null) { x.inputMode = x.dataset.kbIm; delete x.dataset.kbIm; } }

  function labelOf(x) {
    const cell = x.closest('.fpf-cell');
    const l = cell && cell.querySelector('.fpf-label');
    return l ? l.firstChild ? l.firstChild.textContent : l.textContent : (x.placeholder || '');
  }

  /* Typing into the field as a person would: at the caret, then the field's own input handling runs. */
  function insert(text) {
    if (!target) return;
    const x = target;
    let a = x.selectionStart, b = x.selectionEnd;
    if (a == null) { x.value += text; }
    else { x.setRangeText(text, a, b, 'end'); }
    x.dispatchEvent(new Event('input', { bubbles: true }));
    if (shift && kind === 'text' && !symbols) { shift = false; paint(); }
  }
  function backspace() {
    if (!target) return;
    const x = target;
    const a = x.selectionStart, b = x.selectionEnd;
    if (a == null) x.value = x.value.slice(0, -1);
    else if (a !== b) x.setRangeText('', a, b, 'end');
    else if (a > 0) x.setRangeText('', a - 1, a, 'end');
    x.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function sign() {
    if (!target) return;
    const v = target.value;
    target.value = v.startsWith('-') ? v.slice(1) : '-' + v;
    target.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function clear() { if (!target) return; target.value = ''; target.dispatchEvent(new Event('input', { bubbles: true })); }

  /* The fields of the sheet or form the field is in, in order. */
  function fieldsOf(x) {
    const root = x.closest('.fpf-sheet') || x.closest('.fpf') || document.body;
    return Array.from(root.querySelectorAll('input, textarea, select')).filter(n => !n.disabled && n.offsetParent !== null && !n.closest('.fpk'));
  }
  /* Next: what Enter does on that field (the form moves on), else the next field in the same sheet or form. */
  function next() {
    if (!target) return;
    const x = target;
    if (x.tagName === 'INPUT') x.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    setTimeout(() => {
      if (document.activeElement !== x) return;
      const fields = fieldsOf(x);
      const to = fields[fields.indexOf(x) + 1];
      if (to) to.focus(); else hide();
    }, 0);
  }
  /* Back: the field before this one in the same sheet or form (nothing, at the first). */
  function back() {
    if (!target) return;
    const fields = fieldsOf(target);
    const to = fields[fields.indexOf(target) - 1];
    if (to) to.focus();
  }

  // Three rows of five (0.71): digits as on a keypad, the rarely used keys at the right edge, Next at the bottom right.
  const NUM = [['7'], ['8'], ['9'], ['⌫', 'fn', backspace], ['Clear', 'fn', clear],
    ['4'], ['5'], ['6'], ['±', 'fn', sign], ['.'],
    ['1'], ['2'], ['3'], ['0'], ['Next', 'go', next]];
  const ROWS = {
    lower: ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
    upper: ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
    sym: ['1234567890', '-/:;()$&@"', '.,?!\'#%*+', '_\\<>[]|'],
  };

  function key(label, cls, act) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label; if (cls) b.className = cls;
    // pointerdown keeps the field focused (a click would move focus to the key)
    b.addEventListener('pointerdown', e => { e.preventDefault(); b.classList.add('down'); (act || (() => insert(label)))(); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, () => b.classList.remove('down')));
    b.addEventListener('mousedown', e => e.preventDefault());
    return b;
  }

  function paint() {
    if (panel && !target) { paintIdle(); return; }
    if (!panel) return;
    panel.classList.remove('idle');
    const keys = panel.querySelector('.fpk-keys');
    keys.replaceChildren();
    panel.querySelector('.fpk-bar b').textContent = labelOf(target);
    if (kind === 'numbers') {
      NUM.forEach(([l, c, a]) => keys.appendChild(key(l, c, a)));
      return;
    }
    // Full keyboard: 20 columns; each letter key 2 wide.
    const rows = ROWS[symbols ? 'sym' : shift ? 'upper' : 'lower'];
    rows.forEach((r, i) => {
      if (i === 2) keys.appendChild(spacer(1));
      if (i === 3) keys.appendChild(key(symbols ? '' : '⇧', 'fn w3' + (shift ? ' on' : ''), () => { if (!symbols) { shift = !shift; paint(); } }));
      r.split('').forEach(ch => keys.appendChild(key(ch, 'w2')));
      if (i === 0) { /* 20 of 20 */ }
      if (i === 1) { /* 20 */ }
      if (i === 2) keys.appendChild(spacer(1));
      if (i === 3) keys.appendChild(key('⌫', 'fn w3', backspace));
    });
    keys.appendChild(key(symbols ? 'ABC' : '?123', 'fn w3', () => { symbols = !symbols; paint(); }));
    keys.appendChild(key('-', 'w2'));
    keys.appendChild(key('space', 'w8', () => insert(' ')));
    keys.appendChild(key('.', 'w2'));
    keys.appendChild(key('Clear', 'fn w2', clear));
    keys.appendChild(key('Next', 'go w3', next));
  }
  function spacer(n) { const d = document.createElement('div'); d.style.gridColumn = `span ${n}`; return d; }

  // A keyboard-always form showing keeps the keyboard up as its resting bar (0.71; no place is kept beside the form).
  function reserveWanted() {
    if (mode === 'never') return false;
    return Array.from(document.querySelectorAll('[data-keyboard="always"]')).some(f => f.isConnected && f.offsetParent !== null);
  }
  function place() {
    if (!panel) return;
    const idle = !target, card = cardOn && !idle;
    const base = idle ? BAR_H : kind === 'numbers' ? NUM_H : FULL_H;
    panel.className = 'fpk bottom' + (idle ? ' idle' : '') + (!idle && kind === 'numbers' ? ' num' : '') + (card ? ' focus' : '');
    panel.style.height = `${base + (card ? CARD_H - BAR_H : 0)}px`;
    const root = document.documentElement.style;
    root.setProperty('--fp-kb-right', '0px');
    root.setProperty('--fp-kb-bottom', `${panel.offsetHeight}px`);
  }
  function paintIdle() {
    panel.querySelector('.fpk-keys').replaceChildren();
    panel.classList.add('idle');
    panel.querySelector('.fpk-bar b').textContent = 'Tap a box to type';
    panel.querySelector('.fpk-sub').textContent = '';
  }
  function ensurePanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'On-screen keyboard');
    const bar = document.createElement('div'); bar.className = 'fpk-bar';
    const id = document.createElement('div'); id.className = 'fpk-id';
    const top = document.createElement('div'); top.className = 'fpk-top';
    const name = document.createElement('b');
    const sub = document.createElement('span'); sub.className = 'fpk-sub';
    top.append(name, sub);
    // The typing card (focus mode): the value as typed, its unit, the field's message.
    const cardBox = document.createElement('div'); cardBox.className = 'fpk-card';
    const row = document.createElement('div'); row.className = 'fpk-row';
    const val = document.createElement('span'); val.className = 'fpk-val'; val.setAttribute('aria-live', 'polite'); val.setAttribute('aria-atomic', 'true');
    const unit = document.createElement('span'); unit.className = 'fpk-unit';
    row.append(val, unit);
    const err = document.createElement('div'); err.className = 'fpk-err'; err.setAttribute('aria-live', 'polite');
    cardBox.append(row, err);
    id.append(top, cardBox);
    const backKey = key('Back', 'fpk-cardkey', back), nextKey = key('Next', 'fpk-cardkey go', next);
    const hideBtn = document.createElement('button'); hideBtn.type = 'button'; hideBtn.textContent = 'Hide ▾';
    hideBtn.addEventListener('pointerdown', e => e.preventDefault());
    hideBtn.onclick = () => { const t = target; hide(); if (t) t.blur(); };
    bar.append(id, backKey, nextKey, hideBtn);
    const keys = document.createElement('div'); keys.className = 'fpk-keys';
    panel.append(bar, keys);
    document.body.appendChild(panel);
  }
  // The resting bar: shown while a keyboard-always form is up, gone with it.
  function sync() {
    if (target) return;
    if (reserveWanted()) { injectCss(); const fresh = !panel; ensurePanel(); kind = 'numbers'; cardOn = false; if (fresh || !panel.classList.contains('idle')) paintIdle(); place(); }
    else if (panel) hide();
  }

  /* ---- Where the field is, and what the keyboard leaves free ---- */
  const css = n => getComputedStyle(n);
  const pinned = n => { const p = css(n).position; return p === 'sticky' || p === 'fixed'; };
  const shown = n => !!n && !n.hidden && n.getClientRects().length > 0;
  // The top of the keyboard on screen: ours when it is up, else a device keyboard if the browser reports one.
  function keyboardTop() {
    const vh = window.innerHeight;
    let t = vh;
    if (panel) t = Math.min(t, panel.getBoundingClientRect().top + (cardOn && target ? CARD_H - BAR_H : 0));   // as if the card were not there
    try {
      const vk = navigator.virtualKeyboard;
      if (vk && vk.boundingRect && vk.boundingRect.height > 0) t = Math.min(t, vk.boundingRect.top);
      const vv = window.visualViewport;
      if (vv && Math.abs(vv.scale - 1) < 0.01 && vv.height < vh - 80) t = Math.min(t, vv.offsetTop + vv.height);
    } catch (_) { /* no such API */ }
    return t;
  }
  /* The free area: below the sticky bars and the tinted form head, above the keyboard and the save bar. */
  function freeArea(x) {
    const sheet = x.closest('.fpf-sheet');
    let top = 0, bottom = keyboardTop();
    const note = n => { if (shown(n)) { const r = n.getBoundingClientRect(); if (r.bottom > top && r.top <= top + 2) top = r.bottom; } };
    if (sheet) { const c = sheet.querySelector('.fpf-crumbs'); if (c && pinned(c)) note(c); }
    else {
      const bar = document.querySelector('.fpl-bar'); if (bar && pinned(bar)) note(bar);
      const head = document.querySelector('.fpl-formhead'); if (shown(head) && !x.closest('.fpl-formhead')) { const r = head.getBoundingClientRect(); if (r.bottom > top) top = r.bottom; }
    }
    const foot = (sheet || x.closest('.fpf') || document).querySelector('.fpf-foot');
    if (shown(foot)) {
      const r = foot.getBoundingClientRect();
      const kb = panel ? panel.getBoundingClientRect().top : r.bottom;
      const lift = cardOn && target && Math.abs(r.bottom - kb) <= 2 ? CARD_H - BAR_H : 0;   // the foot rides on the keyboard; undo the card's share
      if ((x.compareDocumentPosition(foot) & Node.DOCUMENT_POSITION_FOLLOWING) && r.top + lift < bottom) bottom = r.top + lift;
    }
    return { top, bottom };
  }
  // What has to be seen with the field: the box, its label, a message line (a table cell: the box alone).
  function partsOf(x) {
    const parts = [x];
    const cell = x.closest('.fpf-cell');
    if (cell && !x.closest('td, th')) {
      const l = cell.querySelector('.fpf-label'); if (l) parts.push(l);
      const m = cell.querySelector('.fpf-msg'); if (m && m.textContent.trim()) parts.push(m);
    }
    return parts;
  }
  /* Is the field hidden? Its box, label or message is not wholly inside the free area, or the area is under 120 px. */
  function hidden(field) {
    const x = field || target;
    if (!x || !x.isConnected) return { hidden: false, free: window.innerHeight, reason: 'no field' };
    const a = freeArea(x), free = Math.round(a.bottom - a.top);
    if (free < MIN_FREE) return { hidden: true, free, reason: `only ${free} px free` };
    for (const n of partsOf(x)) {
      const r = n.getBoundingClientRect();
      if (r.top < a.top - 1) return { hidden: true, free, reason: n === x ? 'field above the free area' : 'label or message above the free area' };
      if (r.bottom > a.bottom + 1) return { hidden: true, free, reason: n === x ? 'field under the keyboard' : 'label or message under the keyboard' };
    }
    return { hidden: false, free, reason: 'in view' };
  }

  /* Scroll so the field (with its label and message) sits in the middle of the free area; a taller one: its top at the area's top. */
  function scrollField(x) {
    if (!x || !x.isConnected) return;
    const a = freeArea(x);
    const cell = x.closest('.fpf-cell');
    const u = cell && !x.closest('td, th') ? cell : x;
    const r = u.getBoundingClientRect();
    const free = a.bottom - a.top;
    const want = r.height > free - 8 ? a.top + 4 : a.top + (free - r.height) / 2;
    const delta = r.top - want;
    if (Math.abs(delta) < 2) return;
    let sc = null;
    for (let n = x.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const o = css(n).overflowY;
      if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight + 1) sc = n;   // the outermost one
    }
    (sc || window).scrollBy({ top: delta, behavior: 'smooth' });
  }

  /* The typing card: the field's label, value, unit or hint and message, mirrored while it shows. */
  function paintCard() {
    if (!panel || !target || !cardOn) return;
    const x = target, cell = x.closest('.fpf-cell');
    const q = s => cell ? cell.querySelector(s) : null;
    panel.querySelector('.fpk-bar b').textContent = labelOf(x);
    const unit = q('.unit'), hint = q('.fpf-hint') || q('.fpf-tip');
    panel.querySelector('.fpk-sub').textContent = hint ? hint.textContent : '';
    panel.querySelector('.fpk-unit').textContent = unit ? unit.textContent : '';
    const m = q('.fpf-msg');
    panel.querySelector('.fpk-err').textContent = m ? m.textContent.trim() : '';
    const val = panel.querySelector('.fpk-val');
    const v = x.type === 'password' ? '•'.repeat(x.value.length) : x.value;
    const a = x.selectionStart == null ? v.length : x.selectionStart, b = x.selectionEnd == null ? a : x.selectionEnd;
    const tail = t => (t.length > 40 ? '…' + t.slice(-40) : t);
    const mk = (cls, t) => { const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = t; return s; };
    const parts = [];
    if (!v && x.placeholder) parts.push(mk('empty', x.placeholder));
    parts.push(document.createTextNode(tail(v.slice(0, a))));
    if (b > a) parts.push(mk('sel', v.slice(a, b))); else { const c = mk('caret', '|'); c.setAttribute('aria-hidden', 'true'); parts.push(c); }
    parts.push(document.createTextNode(v.slice(b, b + 40)));
    val.replaceChildren(...parts);
  }
  /* Look again: is the field in view? Turn the card on or off to match. */
  function check() {
    checkTimer = null;
    if (!panel || !target) return;
    if (Date.now() - lastScroll < 120) { queueCheck(200); return; }   // still scrolling
    const h = hidden(target);
    if (h.hidden !== cardOn) {
      cardOn = h.hidden; place();
      if (cardOn) scrollField(target);   // the keyboard grew: find the middle of what is left
    }
    paintCard();
  }
  function queueCheck(ms) { clearTimeout(checkTimer); checkTimer = setTimeout(check, ms || 0); }

  function show(x) {
    const k = kindOf(x);
    if (!k) { hide(); return; }
    injectCss();
    if (target && target !== x) unquiet(target);
    target = x; kind = k; shift = false; symbols = false; cardOn = false;
    quiet(x);
    ensurePanel();
    panel.querySelector('.fpk-sub').textContent = '';
    paint();
    place();
    // The field stays in view in the middle of what the keyboard leaves free; then look whether it is.
    setTimeout(() => { if (target === x) { scrollField(x); queueCheck(300); } }, 30);
  }

  function hide() {
    if (target) unquiet(target);
    target = null; cardOn = false;
    clearTimeout(checkTimer); checkTimer = null;
    // A keyboard-always form still showing: the keyboard rests as its bar instead (0.71).
    if (panel && reserveWanted()) { kind = 'numbers'; paintIdle(); place(); return; }
    if (panel) { panel.remove(); panel = null; }
    const root = document.documentElement.style;
    root.setProperty('--fp-kb-right', '0px');
    root.setProperty('--fp-kb-bottom', '0px');
  }

  // A form can ask for the keyboard always (0.44.5: data-keyboard="always" on it); a terminal set to never still wins.
  const modeFor = x => {
    if (mode === 'never') return 'never';
    const f = x && x.closest ? x.closest('[data-keyboard]') : null;
    return f && f.dataset.keyboard === 'always' ? 'always' : mode;
  };
  // A finger on a field: our keyboard, not the device's (set before focus lands, so Windows' never opens).
  document.addEventListener('pointerdown', e => {
    if (e.target && e.target.closest && e.target.closest('.fpk')) return;
    lastPointer = { type: e.pointerType, at: Date.now() };
    pointerDown = true;
    const x = e.target;
    const m = modeFor(x);
    if (m === 'never') return;
    if ((m === 'always' || e.pointerType === 'touch' || e.pointerType === 'pen') && kindOf(x)) quiet(x);
  }, true);
  document.addEventListener('focusin', e => {
    const x = e.target;
    const m = modeFor(x);
    if (m === 'never') return;
    if (!kindOf(x)) {
      // Focus on a button or other control: close, but not under a finger still down on it (0.44.5).
      if (panel && !(x.closest && x.closest('.fpk'))) { if (pointerDown && target) closeAfterUp = target; else hide(); }
      return;
    }
    const touched = (lastPointer.type === 'touch' || lastPointer.type === 'pen') && Date.now() - lastPointer.at < 1500;
    if (m === 'always' || touched || panel) show(x);
  });
  const closeIfLeft = x => { if (target === x && document.activeElement !== x) hide(); };
  document.addEventListener('focusout', e => {
    const x = e.target;
    setTimeout(() => { if (pointerDown) closeAfterUp = x; else closeIfLeft(x); }, 120);
  });
  const lifted = () => {
    pointerDown = false;
    const x = closeAfterUp;
    closeAfterUp = null;
    if (x) setTimeout(() => closeIfLeft(x), 0);   // after the click has landed
  };
  document.addEventListener('pointerup', lifted, true);
  document.addEventListener('pointercancel', lifted, true);
  // Real keys: the person has a keyboard; ours steps aside (auto only).
  document.addEventListener('keydown', e => {
    if (!e.isTrusted || modeFor(target) !== 'auto' || !panel) return;
    if (e.key && (e.key.length === 1 || e.key === 'Backspace')) { const t = target; hide(); if (t) unquiet(t); }
  }, true);
  window.addEventListener('resize', () => { if (panel) { place(); queueCheck(); } else sync(); });
  // Look again when the screen, the scrolling or the field changes (scrollend where there is one, else a pause after the last scroll).
  const hasEnd = 'onscrollend' in window;
  document.addEventListener('scroll', () => { lastScroll = Date.now(); if (panel && target && !hasEnd) queueCheck(250); }, { capture: true, passive: true });
  if (hasEnd) document.addEventListener('scrollend', () => { if (panel && target) queueCheck(); }, true);
  try { if (window.visualViewport) window.visualViewport.addEventListener('resize', () => { if (panel && target) queueCheck(); }); } catch (_) { /* none */ }
  try { if (navigator.virtualKeyboard) navigator.virtualKeyboard.addEventListener('geometrychange', () => { if (panel && target) queueCheck(); }); } catch (_) { /* none */ }
  document.addEventListener('input', e => { if (panel && target && e.target === target) { paintCard(); queueCheck(); } }, true);
  document.addEventListener('selectionchange', () => { if (cardOn) paintCard(); });
  // Forms open and close without telling the keyboard: look again when the page changes (once a frame at most).
  let syncQueued = false;
  new MutationObserver(() => { if (syncQueued) return; syncQueued = true; requestAnimationFrame(() => { syncQueued = false; sync(); if (cardOn) paintCard(); }); })
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-keyboard'] });

  FP.keyboard = {
    get mode() { return mode; },
    setMode(m) { mode = ['auto', 'always', 'never'].includes(m) ? m : 'auto'; if (mode === 'never') hide(); sync(); },
    hide, kindOf, modeFor,
    showing: () => (panel && target ? { kind, field: target, card: cardOn } : null),
    hidden,
    resting: () => !!(panel && !target),
  };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-keyboard'] = '0.71.0';
})();
