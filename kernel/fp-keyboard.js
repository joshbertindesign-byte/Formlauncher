/* Form Platform kernel: the on-screen keyboard (0.43)
 * Load after fp-forms.js.
 *
 * Terminals may have a touch screen, a keyboard, a scanner, any of them. The keyboard here shows when a field is
 * tapped with a finger (auto), on every field (always), or never; a terminal's setting says which. Typing on real
 * keys tucks it away. Numbers get a number pad docked beside the form; text gets a full keyboard along the bottom.
 * A field can ask for numbers, text, or none (a scanned rack ID).
 *
 * The page keeps room for it: the CSS variables --fp-kb-right and --fp-kb-bottom are the space it takes, which
 * the page, sub-form sheets and the save bar leave free. Whichever field has focus gets the keys, so a sub-form
 * sheet on top owns the keyboard while it is open.
 *
 * FP.keyboard.mode       'auto' | 'always' | 'never'   (the launcher sets it from the terminal's settings)
 *                        A form set to keyboard: always (data-keyboard on its root) gets it always, unless the
 *                        terminal is set to never (0.44.5). FP.keyboard.modeFor(element) says which applies.
 * FP.keyboard.setMode(m)
 * FP.keyboard.hide()
 * FP.keyboard.kindOf(input) -> 'numbers' | 'text' | null
 *
 * 0.46: while a keyboard-always form is on a wide screen, the number pad's place stays taken, the pad resting
 * (greyed) between fields, so the form doesn't widen and narrow under the operator's finger at every tap.
 */
(function () {
  'use strict';
  const FP = window.FP;
  if (!FP || !FP.forms) throw new Error('Load fp-forms.js before fp-keyboard.js');

  const NUMPAD_W = 320, FULL_H = 300, BAR_H = 44;
  const CSS = `
  body{padding-right:var(--fp-kb-right,0px);padding-bottom:var(--fp-kb-bottom,0px)}
  .fpf-sheet{right:var(--fp-kb-right,0px);bottom:var(--fp-kb-bottom,0px)}
  .fpf-foot{bottom:var(--fp-kb-bottom,0px)}
  .fpk{position:fixed;z-index:9500;background:#e7eaee;border-color:#c9d0d9;border-style:solid;border-width:0;box-shadow:0 -4px 18px rgba(0,0,0,.12);font:18px/1 system-ui,"Segoe UI",sans-serif;color:#1b1f24;user-select:none;-webkit-user-select:none;touch-action:manipulation;display:flex;flex-direction:column}
  .fpk.right{top:0;right:0;bottom:0;width:${NUMPAD_W}px;border-left-width:1px}
  .fpk.bottom{left:0;right:0;bottom:0;height:${FULL_H}px;border-top-width:1px}
  .fpk-bar{display:flex;align-items:center;gap:8px;height:${BAR_H}px;padding:0 8px 0 14px;font-size:14px;color:#5b6573;flex:0 0 auto}
  .fpk-bar b{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#1b1f24;font-size:15px}
  .fpk-bar button{font:inherit;font-size:14px;font-weight:600;height:34px;padding:0 12px;border:1px solid #c9d0d9;border-radius:8px;background:#fff;color:#1b1f24;cursor:pointer}
  .fpk-keys{flex:1;display:grid;gap:6px;padding:0 8px 8px}
  .fpk.right .fpk-keys{grid-template-columns:repeat(3,1fr);grid-auto-rows:1fr;align-content:end;max-height:520px;margin-top:auto}
  .fpk.bottom .fpk-keys{grid-template-columns:repeat(20,1fr);grid-auto-rows:1fr}
  .fpk-keys button{font:inherit;font-size:20px;min-height:44px;border:0;border-radius:8px;background:#fff;color:#1b1f24;box-shadow:0 1px 0 #b8c0ca;cursor:pointer;padding:0}
  .fpk-keys button:active,.fpk-keys button.down{background:#cfd8e3}
  .fpk-keys button.fn{background:#d3d9e0;font-size:16px;font-weight:600}
  .fpk-keys button.go{background:#1f5fbf;color:#fff;font-size:16px;font-weight:600}
  .fpk-keys button.on{background:#1b2633;color:#fff}
  .fpk-keys .w2{grid-column:span 2}.fpk-keys .w3{grid-column:span 3}.fpk-keys .w4{grid-column:span 4}.fpk-keys .w8{grid-column:span 8}
  .fpk-keys .h2{grid-row:span 2}
  .fpk.idle .fpk-keys{opacity:.4;pointer-events:none}
  .fpk.idle .fpk-bar button{visibility:hidden}
  .fpk.idle .fpk-bar b{color:#5b6573;font-weight:500}`;

  let mode = 'auto';
  let lastPointer = { type: null, at: 0 };
  // A finger (or mouse) still down when the keyboard would close: it closes once it lifts, so the form doesn't move
  // under the tap and the button pressed gets it (0.44.5).
  let pointerDown = false, closeAfterUp = null;
  let target = null, panel = null, kind = null, shift = false, symbols = false;

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

  /* Next: what Enter does on that field (the form moves on), else the next field in the same sheet or form. */
  function next() {
    if (!target) return;
    const x = target;
    if (x.tagName === 'INPUT') x.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    setTimeout(() => {
      if (document.activeElement !== x) return;
      const root = x.closest('.fpf-sheet') || x.closest('.fpf') || document.body;
      const all = Array.from(root.querySelectorAll('input, textarea, select, button.on, .fpf-seg button')).filter(n => !n.disabled && n.offsetParent !== null && !n.closest('.fpk'));
      const fields = all.filter(n => n.tagName !== 'BUTTON');
      const i = fields.indexOf(x);
      const to = fields[i + 1];
      if (to) to.focus(); else hide();
    }, 0);
  }

  const NUM = [['7'], ['8'], ['9'], ['4'], ['5'], ['6'], ['1'], ['2'], ['3'], ['±', 'fn', sign], ['0'], ['.'], ['⌫', 'fn', backspace], ['Clear', 'fn', clear], ['Next', 'go', next]];
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

  const wide = () => window.innerWidth >= 900 && window.innerWidth > window.innerHeight;
  // A keyboard-always form showing on a wide screen keeps the pad's place (0.46).
  function reserveWanted() {
    if (mode === 'never' || !wide()) return false;
    return Array.from(document.querySelectorAll('[data-keyboard="always"]')).some(f => f.isConnected && f.offsetParent !== null);
  }
  function place() {
    if (!panel) return;
    const side = (kind === 'numbers' || !target) && wide();
    panel.className = 'fpk ' + (side ? 'right' : 'bottom') + (target ? '' : ' idle');
    if (!side) panel.style.height = kind === 'numbers' ? `${BAR_H + 4 * 56 + 8}px` : '';
    else panel.style.height = '';
    const root = document.documentElement.style;
    // Typing text on a form that keeps the pad's place: the full keyboard along the bottom, the place kept beside.
    root.setProperty('--fp-kb-right', side || reserveWanted() ? `${NUMPAD_W}px` : '0px');
    root.setProperty('--fp-kb-bottom', side ? '0px' : `${panel.offsetHeight}px`);
  }
  function paintIdle() {
    const keys = panel.querySelector('.fpk-keys');
    keys.replaceChildren();
    panel.classList.add('idle');
    panel.querySelector('.fpk-bar b').textContent = 'Tap a box to type';
    NUM.forEach(([l, c]) => keys.appendChild(key(l, c, () => {})));
  }
  function ensurePanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.setAttribute('role', 'group'); panel.setAttribute('aria-label', 'On-screen keyboard');
    const bar = document.createElement('div'); bar.className = 'fpk-bar';
    const name = document.createElement('b');
    const hideBtn = document.createElement('button'); hideBtn.type = 'button'; hideBtn.textContent = 'Hide ▾';
    hideBtn.addEventListener('pointerdown', e => e.preventDefault());
    hideBtn.onclick = () => { const t = target; hide(); if (t) t.blur(); };
    bar.append(name, hideBtn);
    const keys = document.createElement('div'); keys.className = 'fpk-keys';
    panel.append(bar, keys);
    document.body.appendChild(panel);
  }
  // The resting pad: shown while a keyboard-always form is up, gone with it.
  function sync() {
    if (target) return;
    if (reserveWanted()) { injectCss(); const fresh = !panel; ensurePanel(); kind = 'numbers'; if (fresh || !panel.classList.contains('idle')) paintIdle(); place(); }
    else if (panel) hide();
  }

  function show(x) {
    const k = kindOf(x);
    if (!k) { hide(); return; }
    injectCss();
    if (target && target !== x) unquiet(target);
    target = x; kind = k; shift = false; symbols = false;
    quiet(x);
    ensurePanel();
    paint();
    place();
    // The field stays in view above or beside the keyboard.
    setTimeout(() => { if (target === x) x.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 30);
  }

  function hide() {
    if (target) unquiet(target);
    target = null;
    // A keyboard-always form still showing: the pad rests in its place instead (0.46).
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
  window.addEventListener('resize', () => { if (panel) place(); else sync(); });
  // Forms open and close without telling the keyboard: look again when the page changes (once a frame at most).
  let syncQueued = false;
  new MutationObserver(() => { if (syncQueued) return; syncQueued = true; requestAnimationFrame(() => { syncQueued = false; sync(); }); })
    .observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'data-keyboard'] });

  FP.keyboard = {
    get mode() { return mode; },
    setMode(m) { mode = ['auto', 'always', 'never'].includes(m) ? m : 'auto'; if (mode === 'never') hide(); sync(); },
    hide, kindOf, modeFor,
    showing: () => (panel && target ? { kind, field: target } : null),
    resting: () => !!(panel && !target),
  };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-keyboard'] = '0.62.0';
})();
