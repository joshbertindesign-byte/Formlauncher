/* Form Platform kernel: identity and startup gate (step 2)
 * Load after fp-core.js.
 *
 * FP.identity  — this device's terminal ID and a random device key, kept in IndexedDB,
 *                plus a registry in the data folder (_terminals/{id}.json) used to
 *                catch two devices claiming the same terminal ID.
 * FP.startup   — a full-screen gate every launcher shows until the data folder is
 *                connected and the device has a terminal ID. Edge only grants folder
 *                permission from a tap, so the gate's button is that tap.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.kv || !FP.files) throw new Error('Load fp-core.js before fp-identity.js');

  const ID_PATTERN = /^[A-Z0-9][A-Z0-9-]{0,15}$/;
  /* The editor is always the terminal "Editor" (0.41), on whatever computer opens it: no ID to set up, no site.
   * Underneath, each computer's editor writes its own files (EDITOR-xxxx), so two editors open at once never
   * write the same file; everything shows it as Editor. */
  const EDITOR_RE = /^EDITOR(-|$)/;
  const REGISTRY = ['_terminals'];

  function newDeviceKey() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  /* Tell every other open page on this device when the terminal ID changes.
   * A page still holding the old ID would keep writing to the old terminal's
   * files, so other pages reload and come back through the startup gate. */
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('fp-identity' + (FP.simulated ? '~' + FP.simulated : '')) : null;
  function announce() { if (channel) channel.postMessage({ type: 'terminal-changed' }); }
  if (channel) channel.onmessage = e => { if (e.data && e.data.type === 'terminal-changed') location.reload(); };

  /* ---------- What this device is (0.43) ----------
   * Its screen as a form gets it (the window's usable size in screen points), the whole screen, the Windows
   * scaling, touch; and when real keys or a scanner were last seen. A browser can't see a keyboard nobody types
   * on, or a screen's inches; neither is needed. Written with the terminal's registry entry. */
  const device = { keysSeenAt: null, scannerSeenAt: null, written: null };
  const sizeKey = () => [window.innerWidth, window.innerHeight, window.devicePixelRatio || 1];
  function measure() {
    const touch = (navigator.maxTouchPoints || 0) > 0 || (window.matchMedia && matchMedia('(any-pointer: coarse)').matches);
    return {
      width: window.innerWidth, height: window.innerHeight,
      screenWidth: window.screen ? screen.width : null, screenHeight: window.screen ? screen.height : null,
      scale: Math.round((window.devicePixelRatio || 1) * 100) / 100,
      orientation: window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait',
      touch: !!touch, touchPoints: navigator.maxTouchPoints || 0,
      at: new Date().toISOString(),
    };
  }
  // Write again when the screen changes or keys are first seen; at most once a minute.
  let pending = null;
  function noteChange() {
    if (pending || !FP.identity || !FP.identity.terminalId || FP.identity.editor) return;
    const w = device.written;
    if (w && w.screen === JSON.stringify(sizeKey()) && w.keys === device.keysSeenAt && w.scanner === device.scannerSeenAt) return;
    const wait = w ? Math.max(3000, 60000 - (Date.now() - w.at)) : 3000;
    pending = setTimeout(() => { pending = null; FP.identity.checkIn().catch(() => {}); }, wait);
  }
  window.addEventListener('resize', () => { clearTimeout(noteChange.t); noteChange.t = setTimeout(noteChange, 2000); });
  // Real keys (the in-app keyboard makes none). A scanner types six or more characters at under 50 ms each, then Enter.
  let burst = [];
  document.addEventListener('keydown', e => {
    if (!e.isTrusted) return;
    const now = Date.now();
    const printable = e.key && e.key.length === 1;
    if (printable || e.key === 'Enter' || e.key === 'Backspace' || e.key === 'Tab') {
      const firstKeys = !device.keysSeenAt || now - Date.parse(device.keysSeenAt) > 10 * 60000;
      if (firstKeys) { device.keysSeenAt = new Date(now).toISOString(); noteChange(); }
    }
    if (printable) { burst = burst.filter(t => now - t < 50 * 12); if (burst.length && now - burst[burst.length - 1] > 50) burst = []; burst.push(now); }
    else if (e.key === 'Enter') {
      if (burst.length >= 6) { const was = device.scannerSeenAt; device.scannerSeenAt = new Date(now).toISOString(); if (!was || now - Date.parse(was) > 10 * 60000) noteChange(); }
      burst = [];
    } else burst = [];
  }, true);

  /* ---------- Identity ---------- */
  FP.identity = {
    terminalId: null,
    deviceKey: null,
    site: null, // the site this terminal is at (fp-sites.js)
    editor: false, // this page is the editor (terminal Editor)

    normalize: id => String(id || '').trim().toUpperCase(),
    valid: id => ID_PATTERN.test(id) && !EDITOR_RE.test(id),
    isEditor: id => EDITOR_RE.test(String(id || '')),
    /* How a terminal ID is shown: the editor's are all "Editor". */
    label: id => (EDITOR_RE.test(String(id || '')) ? 'Editor' : (id || '')),
    /* This page is the editor: terminal Editor, no site (it works on every site). */
    asEditor() {
      const k = String(FP.identity.deviceKey || '').replace(/[^0-9a-z]/gi, '').toUpperCase();
      FP.identity.terminalId = 'EDITOR-' + (k.slice(0, 4) || '0000');
      FP.identity.site = null;
      FP.identity.editor = true;
      return FP.identity.terminalId;
    },

    async load() {
      let key = await FP.kv.get('deviceKey');
      if (!key) { key = newDeviceKey(); await FP.kv.set('deviceKey', key); }
      FP.identity.deviceKey = key;
      FP.identity.terminalId = (await FP.kv.get('terminalId')) || null;
      FP.identity.site = (await FP.kv.get('siteId')) || null;
      // A simulated terminal is the one its address names (0.52.1).
      if (FP.simulated && FP.identity.terminalId !== FP.simulated) { await FP.kv.set('terminalId', FP.simulated); FP.identity.terminalId = FP.simulated; }
      return FP.identity.terminalId;
    },

    /* Registry entry for an ID, or null. */
    lookup: id => FP.files.readJson(REGISTRY, id + '.json'),

    /* Entry if another device holds this ID, else null. Registry may lag by OneDrive sync time. */
    async conflict(id) {
      const entry = await FP.identity.lookup(id);
      return entry && entry.deviceKey !== FP.identity.deviceKey ? entry : null;
    },

    async assign(id) {
      id = FP.identity.normalize(id);
      if (!FP.identity.valid(id)) throw new Error('Use 1–16 letters, digits or dashes, e.g. T05.');
      await FP.kv.set('terminalId', id);
      FP.identity.terminalId = id;
      await FP.identity.checkIn();
      announce();
      return id;
    },

    async clear() {
      await FP.kv.del('terminalId');
      FP.identity.terminalId = null;
      announce();
    },

    /* Record that this device holds its ID and was seen now, with its screen and what it has been typed on (0.43). */
    async checkIn() {
      const id = FP.identity.terminalId;
      if (!id || FP.identity.editor) return;
      const before = await FP.identity.lookup(id).catch(() => null);
      const same = before && before.deviceKey === FP.identity.deviceKey ? before : {};
      const later = (a, b) => (!a ? b || null : !b ? a : a > b ? a : b);
      await FP.files.writeJson(REGISTRY, id + '.json', {
        terminalId: id,
        site: FP.identity.site,
        deviceKey: FP.identity.deviceKey,
        lastSeen: new Date().toISOString(),
        userAgent: navigator.userAgent,
        kernel: FP.version,
        screen: measure(),
        simulated: FP.simulated ? true : undefined,   // a simulated terminal on someone's computer (0.52.1)
        keysSeenAt: later(device.keysSeenAt, same.keysSeenAt),
        scannerSeenAt: later(device.scannerSeenAt, same.scannerSeenAt),
        checkpoints: same.checkpoints === false ? false : undefined,   // the per-terminal opt-out is kept (F2)
      });
      device.written = { screen: JSON.stringify(sizeKey()), keys: device.keysSeenAt, scanner: device.scannerSeenAt, at: Date.now() };
    },
    /* This device as the editor shows it: "1920×1080 · touch · keys seen". */
    describe(entry) {
      if (!entry || !entry.screen) return '';
      const sc = entry.screen;
      const bits = [`${sc.width}×${sc.height}`];
      if (sc.scale && sc.scale !== 1) bits.push(`${Math.round(sc.scale * 100)}%`);
      bits.push(sc.touch ? 'touch' : 'no touch');
      bits.push(entry.scannerSeenAt ? 'scanner seen' : entry.keysSeenAt ? 'keys seen' : 'no keys seen');
      return bits.join(' · ');
    },

    /* Take a terminal out of the registry (one replaced or gone), so its ID can be used again without a warning.
     * Admins only; not this terminal. */
    async forget(id) {
      if (FP.users && !(await FP.users.can('admin'))) throw new Error('Only an admin can remove a terminal.');
      id = FP.identity.normalize(id);
      if (id === FP.identity.terminalId) throw new Error('This is the terminal you are on; change its ID instead.');
      await FP.files.remove(REGISTRY, id + '.json');
    },

    /* All registry entries, newest first. */
    async all() {
      const names = (await FP.files.list(REGISTRY)).filter(n => n.endsWith('.json'));
      const entries = [];
      for (const n of names) {
        const e = await FP.files.readJson(REGISTRY, n);
        entries.push(e || { terminalId: n.replace(/\.json$/, ''), unreadable: true });
      }
      return entries.sort((a, b) => String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')));
    },
  };

  /* ---------- Startup gate ---------- */
  const CSS = `
    .fp-gate{position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
      padding:16px;background:rgba(15,20,25,.6);font:var(--fs-base,16px)/1.45 var(--font-sans,system-ui,"Segoe UI",sans-serif)}
    .fp-gate-card{width:100%;max-width:440px;max-height:calc(100vh - 32px);overflow:auto;background:var(--surface);color:var(--fg);border:1px solid var(--line);border-radius:16px;
      padding:24px;box-shadow:var(--shadow)}
    .fp-gate-card h1{font-size:var(--fs-xl,20px);font-weight:650;margin:0 0 8px}
    .fp-gate-card p{margin:0 0 16px;color:var(--muted);font-size:var(--fs-base,16px)}
    .fp-gate-card input{font:inherit;font-size:var(--fs-entry,17px);width:100%;min-height:var(--touch-lg,56px);padding:10px 14px;border:1.5px solid var(--line-2);border-radius:12px;
      margin:0 0 12px;text-transform:uppercase;background:var(--surface);color:var(--fg)}
    .fp-gate-card input:focus{outline:2px solid var(--focus);outline-offset:1px}
    .fp-gate-card button{font:inherit;font-size:var(--fs-entry,17px);font-weight:650;width:100%;min-height:var(--touch-lg,56px);padding:12px 16px;border-radius:14px;border:0;
      background:var(--accent);color:var(--accent-fg);cursor:pointer;margin-top:4px}
    .fp-gate-card button.fp-secondary{background:var(--surface-2);color:var(--fg);border:1.5px solid var(--line-2)}
    .fp-gate-card button:disabled{opacity:.6;cursor:default}
    .fp-gate-msg{min-height:1.4em;margin-top:10px;font-size:var(--fs-base,16px)}
    .fp-gate-msg.fp-bad{color:var(--bad);font-weight:600}
    .fp-gate-msg.fp-warn{color:var(--warn);font-weight:600}`;

  function injectCss() {
    if (document.getElementById('fp-gate-css')) return;
    const s = document.createElement('style');
    s.id = 'fp-gate-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function el(tag, props, children) {
    const n = document.createElement(tag);
    Object.assign(n, props || {});
    (children || []).forEach(c => n.appendChild(c));
    return n;
  }

  FP.startup = {
    /* Resolves with { terminalId, folder } once the device is ready.
     * options.title — app name shown on the gate. */
    run(options) {
      const title = (options && options.title) || 'Start';
      injectCss();
      const gate = el('div', { className: 'fp-gate' });
      const card = el('div', { className: 'fp-gate-card' });
      gate.appendChild(card);
      document.body.appendChild(gate);

      return new Promise(resolve => {
        function render(heading, text, controls) {
          card.replaceChildren(
            el('h1', { textContent: heading }),
            el('p', { textContent: text }),
            ...controls
          );
        }

        function message(text, kind) {
          let m = card.querySelector('.fp-gate-msg');
          if (!m) { m = el('div', { className: 'fp-gate-msg' }); card.appendChild(m); }
          m.textContent = text || '';
          m.className = 'fp-gate-msg' + (kind ? ' fp-' + kind : '');
        }

        function button(label, action, secondary) {
          const b = el('button', { textContent: label, className: secondary ? 'fp-secondary' : '' });
          b.onclick = async () => {
            b.disabled = true;
            try { await action(); }
            catch (err) {
              if (err && err.name === 'AbortError') message('Cancelled.', 'warn');
              else message(String(err && err.message || err), 'bad');
            }
            b.disabled = false;
          };
          return b;
        }

        async function finish() {
          try { await FP.identity.checkIn(); } catch (_) { /* registry is best-effort */ }
          // Write anything saved on this device while the folder was unavailable.
          if (FP.outbox) FP.outbox.flush().catch(() => {});
          gate.remove();
          resolve({ terminalId: FP.identity.terminalId, site: FP.identity.site, folder: FP.folder.handle.name });
        }

        function askTerminalId() {
          const input = el('input', { placeholder: 'e.g. T05', autocomplete: 'off' });
          const assign = async force => {
            const id = FP.identity.normalize(input.value);
            if (!FP.identity.valid(id)) { message(EDITOR_RE.test(id) ? 'Editor is the editor\'s own name: pick another, e.g. T05.' : 'Use 1–16 letters, digits or dashes, e.g. T05.', 'bad'); return; }
            if (!force) {
              const other = await FP.identity.conflict(id);
              if (other) {
                const seen = other.lastSeen ? new Date(other.lastSeen).toLocaleString() : 'unknown';
                render('Terminal ID in use',
                  `${id} belongs to another device, last seen ${seen}. Two devices with one ID would write to the same files. Assign it only if that device has been retired.`,
                  [button(`Assign ${id} anyway`, () => assign(true)), button('Pick a different ID', askTerminalId, true)]);
                return;
              }
            }
            await FP.identity.assign(id);
            next();
          };
          input.onkeydown = e => { if (e.key === 'Enter') assign(false); };
          render('Name this terminal',
            'Each device needs its own terminal ID. It is kept on this device until an admin changes it.',
            [input, button('Save terminal ID', () => assign(false))]);
          input.focus();
        }

        /* Every terminal is at one site. The first terminal set up creates the first site. */
        async function askSite() {
          const sites = (await FP.sites.list()).filter(s => s.active);
          if (!sites.length) {
            const code = el('input', { placeholder: 'Site code, e.g. ABI', autocomplete: 'off' });
            const name = el('input', { placeholder: 'Site name, e.g. Abilene', autocomplete: 'off' });
            name.style.textTransform = 'none';
            render('Name your first site',
              'Sites keep facilities or areas apart. Every terminal belongs to one site, and everything it saves is marked with it. Admins can add more sites later.',
              [code, name, button('Create site', async () => { const id = await FP.sites.create(code.value, name.value); await FP.sites.assign(id); next(); })]);
            code.focus();
            return;
          }
          render(`Which site is ${FP.identity.terminalId} at?`,
            'Chosen once for this terminal. Only an admin can change it later.',
            sites.filter(s => s.active !== false).map(s => button(`${s.name} (${s.id})`, async () => { await FP.sites.assign(s.id); next(); }, true)));
        }

        async function next() {
          if (!FP.folder.supported) {
            render('Browser not supported', 'This app needs Microsoft Edge or Google Chrome to reach the data folder.', []);
            return;
          }
          await FP.identity.load();
          if (options && options.editor) FP.identity.asEditor();
          const state = await FP.folder.restore();
          if (state === 'none') {
            render('Connect the data folder',
              'Choose the platform data folder in the synced SharePoint library. This is needed once per device.',
              [button('Choose data folder', async () => { await FP.folder.connect(); next(); })]);
            return;
          }
          if (state !== 'granted') {
            const who = FP.identity.terminalId ? ` on ${FP.identity.terminalId}` : '';
            render(title, `Tap Start to connect to the data folder${who}.`,
              [button('Start', async () => {
                const p = await FP.folder.reauthorize();
                if (p === 'granted') next();
                else message('Permission was not granted. Tap Start and choose Allow.', 'bad');
              })]);
            return;
          }
          if (FP.identity.editor) { finish(); return; }
          // A simulated terminal (0.52.1): only on a test folder; its site is the one it already has here, if any.
          if (FP.simulated) {
            if (!(await FP.folder.isTest())) {
              render('Simulated terminals are for test folders',
                `This address opens the launcher as terminal ${FP.simulated}, for trying several terminals from one computer. That is only allowed on a data folder marked as a test folder (in the editor: Admin > Test folder). Open the launcher without ?terminal= to use this computer's own terminal.`, []);
              return;
            }
            if (!FP.identity.site) {
              const reg = await FP.identity.lookup(FP.simulated).catch(() => null);
              const sites = await FP.sites.list().catch(() => []);
              if (reg && reg.site && sites.some(x => x.id === reg.site && x.active !== false)) await FP.sites.assign(reg.site);
            }
          }
          if (!FP.identity.terminalId) { askTerminalId(); return; }
          if (FP.sites && !FP.identity.site) { await askSite(); return; }
          // Its site is gone from the data folder: the data was purged (0.44.5), so this terminal is set up again.
          if (FP.sites && FP.identity.site) {
            const sites = await FP.sites.list().catch(() => null);
            if (sites && !sites.some(x => x.id === FP.identity.site)) {
              const was = FP.identity.terminalId;
              await FP.identity.clear();
              await FP.kv.del('siteId'); FP.identity.site = null;
              render('Set this terminal up again', `The data folder was cleared out, so ${was} and its site are gone. Give this terminal its ID and site again.`,
                [button('Set it up', async () => askTerminalId())]);
              return;
            }
          }
          finish();
        }

        next().catch(err => render('Startup error', String(err && err.message || err), []));
      });
    },

    /* Clear the terminal ID and run the gate again (admin action). */
    async reassign(options) {
      await FP.identity.clear();
      return FP.startup.run(options);
    },
  };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-identity'] = '0.65.0';
})();
