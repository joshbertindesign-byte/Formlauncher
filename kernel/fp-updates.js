/* Form Platform: installing new versions of the platform (kernel updates)
 * Load after fp-launcher.js.
 *
 * Where things live in the data folder:
 *
 *   updates/                 a release zip dropped here (kernel-0.26.0.zip) is offered to admins
 *   runtime/0.26.0/          one folder per release: its kernel files, never overwritten while in use
 *   runtime/releases.js      which release runs (current) and which are kept for falling back
 *   runtime/boot.js          loads the current release's files into a page
 *   runtime/launcher.html    the generic launcher page   (small pages that load releases.js + boot.js)
 *   runtime/editor.html      the editor
 *   runtime/kernel-test.html the test page (checks, the kernel's own tests, installing updates)
 *   launchers/launchers.json the shortcuts (0.48): launch.html?launcher=NAME opens one form
 *   launch.html              the one launcher every terminal opens (its home screen), loading runtime/…
 *
 * Installing (admins only): the zip is read with the browser's own decompression, and nothing
 * changes unless every file is there, matches the zip's release.json (SHA-256 per file) and says
 * the same version. The release's files are written to their own folder, then the pages, then
 * releases.js last, which is the switch. The three newest releases are kept; older ones are removed.
 * Launcher files are made again so they load through boot.js.
 *
 * Every page loaded through boot.js watches releases.js. When another release becomes current and
 * all of its files have arrived on this terminal, the page reloads at a safe moment (nothing
 * unsaved on screen). A page whose files arrived only partly falls back to the release before
 * (boot.js does that), and moves on once the rest has synced.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.launchers) throw new Error('Load fp-launcher.js before fp-updates.js');

  const KEEP = 3;
  const UPDATES = ['updates'];
  const RUNTIME = ['runtime'];
  const VERSION_RE = /^\d+\.\d+\.\d+$/;
  const ZIP_RE = /\.zip$/i;
  const CHECK_EVERY = 2 * 60 * 1000;   // how often a page looks for a new release
  const RETRY_SAFE = 15 * 1000;        // how often it looks for a safe moment once one is ready

  const cmp = (a, b) => {
    const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
    return 0;
  };
  const moduleVersion = (name, text) => { const m = new RegExp(`\\['${name}'\\] = '([0-9.]+)'`).exec(text || ''); return m ? m[1] : null; };

  /* ---------- Reading a zip (no library: the browser's own deflate) ---------- */
  async function inflate(bytes) {
    if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot unzip files. Use Edge.');
    const out = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(out).arrayBuffer());
  }
  /* A zip file's contents: Map name → Uint8Array. Plain zips only (stored or deflated, no zip64). */
  async function readZip(blob) {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let eocd = -1;
    for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('not a zip file');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = new Map();
    const dec = new TextDecoder();
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('the zip is damaged');
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commentLen = dv.getUint16(p + 32, true);
      const local = dv.getUint32(p + 42, true);
      const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      if (name.endsWith('/')) continue;
      if (dv.getUint32(local, true) !== 0x04034b50) throw new Error('the zip is damaged');
      const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      const raw = buf.subarray(start, start + csize);
      if (method === 0) files.set(name, raw.slice());
      else if (method === 8) files.set(name, await inflate(raw));
      else throw new Error(`the zip uses a compression this page can't read (${name})`);
    }
    return files;
  }
  async function sha256(bytes) {
    if (!(window.crypto && crypto.subtle)) return null;
    const h = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return Array.from(h, b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- Checking a release ---------- */
  /* { version, manifest, files: Map, problems: [] } for a zip. Nothing is written. */
  async function inspect(blob) {
    const problems = [];
    let files;
    try { files = await readZip(blob); } catch (e) { return { version: null, problems: [`it can't be read: ${e.message}`] }; }
    const text = name => (files.has(name) ? new TextDecoder().decode(files.get(name)) : null);
    let manifest = null;
    try { manifest = JSON.parse(text('release.json')); } catch (_) { manifest = null; }
    if (!manifest || !VERSION_RE.test(manifest.version || '') || !manifest.files || !manifest.load || !Array.isArray(manifest.load.launcher)) {
      return { version: null, problems: ['it is not a platform release (no valid release.json inside)'] };
    }
    const version = manifest.version;
    for (const [name, hash] of Object.entries(manifest.files)) {
      if (!files.has(name)) { problems.push(`${name} is missing from the zip`); continue; }
      const got = await sha256(files.get(name));
      if (got && got !== hash) problems.push(`${name} doesn't match release.json (damaged or changed)`);
    }
    const loaded = new Set([].concat(...Object.values(manifest.load)));
    loaded.forEach(m => {
      const t = text(m + '.js');
      if (t == null) { problems.push(`${m}.js is missing`); return; }
      const v = moduleVersion(m, t);
      if (v !== version) problems.push(`${m}.js says ${v || 'no version'}, not ${version}`);
    });
    ['boot.js', 'shell-launcher.html', 'shell-editor.html'].forEach(n => {
      if (!files.has(n)) problems.push(`${n} is missing`);
      else if (!manifest.files[n]) problems.push(`${n} has no checksum in release.json`);
    });
    return { version, manifest, files, problems };
  }

  /* ---------- What is installed ---------- */
  /* runtime/releases.js, read back: { current, kept: [], load: {version: {page: [modules]}}, installedAt, by } or null. */
  async function installed() {
    const t = await FP.files.readText(RUNTIME, 'releases.js').catch(() => null);
    const m = t && /window\.FP_RELEASES = (\{[\s\S]*\});/.exec(t);
    try { return m ? JSON.parse(m[1]) : null; } catch (_) { return null; }
  }
  /* Like installed(), but throws when releases.js is there and can't be read: treating that as "nothing installed" would
   * make an install delete the other releases (a half-synced file is the usual cause). A missing file is a first install. */
  async function installedStrict() {
    const t = await FP.files.readText(RUNTIME, 'releases.js').catch(() => null);
    if (t == null) return null;
    const m = /window\.FP_RELEASES = (\{[\s\S]*\});/.exec(t);
    let cfg = null;
    try { cfg = m ? JSON.parse(m[1]) : null; } catch (_) { cfg = null; }
    if (!cfg || !cfg.current) throw new Error('Not installed: runtime/releases.js is there but can\'t be read (it may still be syncing). Wait for OneDrive to finish, then try again; nothing was changed.');
    return cfg;
  }
  const releasesText = cfg => `/* Which release of the platform runs, written by the installer. Don't edit: use Updates in the editor. */
window.FP_RELEASES = ${JSON.stringify(cfg)};
`;
  /* Has every file of a release arrived (on this terminal), at the right version? */
  async function complete(version, cfg) {
    const load = (cfg && cfg.load && cfg.load[version]) || null;
    if (!load) return false;
    const mods = Array.from(new Set([].concat(...Object.values(load))));
    for (const m of mods) {
      const t = await FP.files.readText(RUNTIME.concat(version), m + '.js').catch(() => null);
      if (moduleVersion(m, t) !== version) return false;
    }
    return true;
  }

  async function requireAdmin() {
    if (FP.users && !(await FP.users.can('admin'))) throw new Error('Only an admin can install updates.');
  }

  /* Release zips waiting in updates/, newest first: [{ name, version, newer, problems }]. */
  async function pending() {
    const cfg = await installed();
    const now = cfg ? cfg.current : null;
    const out = [];
    for (const name of (await FP.files.list(UPDATES)).filter(n => ZIP_RE.test(n))) {
      const f = await FP.files.readFile(UPDATES, name);
      const r = f ? await inspect(f) : { version: null, problems: ['it could not be opened'] };
      out.push({ name, version: r.version, newer: !!r.version && (!now || cmp(r.version, now) > 0), problems: r.problems });
    }
    return out.sort((a, b) => cmp(b.version || '0.0.0', a.version || '0.0.0'));
  }

  /* Install the release zip updates/{name}. Returns what was done.
   * opts.onStep({ text, part, version }) hears each step as it starts; part is how far along, 0 to 1 (0.44). */
  async function install(name, opts) {
    opts = opts || {};
    const step = (text, part, version) => { if (opts.onStep) { try { opts.onStep({ text, part, version }); } catch (_) { /* the display only */ } } };
    await requireAdmin();
    if (!(window.crypto && crypto.subtle)) throw new Error('Not installed: this browser can\'t check the release\'s files here (no secure context), and an unchecked release is never installed. Open the editor from Edge or Chrome.');
    step(`Reading ${name}`, 0.02);
    const f = await FP.files.readFile(UPDATES, name);
    if (!f) throw new Error(`updates/${name} isn't there.`);
    step('Checking every file in the release', 0.06);
    const r = await inspect(f);
    if (r.problems.length) throw new Error(`Not installed: ${r.problems.join('; ')}.`);
    const cfg = (await installedStrict()) || { current: null, kept: [], load: {} };
    if (cfg.current && cmp(r.version, cfg.current) <= 0 && !opts.allowOlder) throw new Error(`Not installed: ${r.version} isn't newer than ${cfg.current}, which is running. To go back to an older release, use Go back.`);
    const dir = RUNTIME.concat(r.version);
    // 1. The release's own folder: every file, then the zip itself as the record of what was installed.
    const js = Array.from(r.files).filter(([n]) => /\.js$/.test(n) && n !== 'boot.js' && Object.prototype.hasOwnProperty.call(r.manifest.files, n));   // only what release.json names (and so checked)
    for (let i = 0; i < js.length; i++) {
      step(`Writing file ${i + 1} of ${js.length}: ${js[i][0]}`, 0.1 + 0.65 * (i / js.length), r.version);
      await FP.files.writeText(dir, js[i][0], new Blob([js[i][1]]));
    }
    step('Keeping a copy of the release', 0.76, r.version);
    await FP.files.writeText(dir, 'release.json', new Blob([r.files.get('release.json')]));
    await FP.files.writeText(dir, name, f);
    // 2. The shared pages and the loader, from the release.
    step('Writing the pages and the loader', 0.8, r.version);
    await FP.files.writeText(RUNTIME, 'boot.js', new Blob([r.files.get('boot.js')]));
    await FP.files.writeText(RUNTIME, 'launcher.html', new Blob([r.files.get('shell-launcher.html')]));
    await FP.files.writeText(RUNTIME, 'editor.html', new Blob([r.files.get('shell-editor.html')]));
    if (r.files.has('shell-kernel-test.html')) await FP.files.writeText(RUNTIME, 'kernel-test.html', new Blob([r.files.get('shell-kernel-test.html')]));
    // 3. The switch: releases.js names the new release, with the two before it kept to fall back on.
    step(`Switching every page to ${r.version}`, 0.85, r.version);
    const user = FP.users ? await FP.users.current() : null;
    const kept = [r.version].concat((cfg.kept || []).filter(v => v !== r.version)).sort((a, b) => cmp(b, a)).slice(0, KEEP);
    const load = {};
    kept.forEach(v => { load[v] = v === r.version ? r.manifest.load : cfg.load[v]; });
    const next = { current: r.version, kept, load, installedAt: new Date().toISOString(), by: user ? user.name : null, from: cfg.current };
    await FP.files.writeText(RUNTIME, 'releases.js', releasesText(next));
    // 4. Tidy: releases no longer kept, and kernel files from before releases had folders.
    step('Removing releases no longer kept', 0.89, r.version);
    const removed = [];
    const root = await FP.folder.dir(RUNTIME, true);
    for (const d of await FP.files.listDirs(RUNTIME)) if (VERSION_RE.test(d) && !kept.includes(d)) { await root.removeEntry(d, { recursive: true }); removed.push(d); }
    for (const n of await FP.files.list(RUNTIME)) if (/^fp-[a-z-]+\.js$/.test(n)) await FP.files.remove(RUNTIME, n);
    // 5. Launcher files from before 0.48 go on the shortcut list; each file goes on to its shortcut.
    step('Moving launcher files to shortcuts', 0.93, r.version);
    const remade = FP.launchers.convertOld ? await FP.launchers.convertOld().catch(() => []) : [];
    // The one launcher every terminal opens (0.41), at the top of the data folder.
    await FP.files.writeText([], 'launch.html', FP.launchers.homeHtml());
    // 6. The zip leaves updates/, so the offer doesn't come back.
    await FP.files.remove(UPDATES, name);
    step('Done', 1, r.version);
    return { version: r.version, from: cfg.current, kept, removed, launchers: remade.length };
  }

  /* ---------- Installing, on screen (0.44) ----------
   * install() with a panel over the page: a spinner, the step it is on and a bar, so it is plain that it started and
   * is still going. Leaving the page while it runs asks first, and this page doesn't move to the new release until
   * the panel has shown how it went. */
  const PCSS = `
  .fpu-veil{position:fixed;inset:0;z-index:10050;background:rgba(15,23,32,.45);display:flex;align-items:center;justify-content:center;padding:16px;font:16px/1.45 var(--font-sans,system-ui,"Segoe UI",sans-serif)}
  .fpu-card{background:#fff;color:#1b1f24;border-radius:14px;padding:22px 24px 18px;width:min(460px,100%);box-shadow:0 20px 50px rgba(0,0,0,.3)}
  .fpu-card h2{margin:0 0 6px;font-size:19px;display:flex;align-items:center;gap:12px}
  .fpu-spin{width:22px;height:22px;box-sizing:border-box;border:3px solid #c7d7ef;border-top-color:#1f5fbf;border-radius:50%;animation:fpu-spin .8s linear infinite;flex:none}
  @keyframes fpu-spin{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion:reduce){.fpu-spin{animation-duration:2.5s}}
  .fpu-mark{width:22px;height:22px;border-radius:50%;flex:none;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:700}
  .fpu-card.ok .fpu-mark{background:#1a7f37}.fpu-card.bad .fpu-mark{background:#b42318}
  .fpu-step{color:#5b6573;font-size:14px;min-height:21px;overflow-wrap:anywhere}
  .fpu-bar{height:8px;border-radius:999px;background:#e6e9ee;overflow:hidden;margin:12px 0 8px}
  .fpu-bar i{display:block;height:100%;width:2%;background:#1f5fbf;transition:width .25s}
  .fpu-card.ok .fpu-bar i{background:#1a7f37}.fpu-card.bad .fpu-bar i{background:#b42318}
  .fpu-note{font-size:13px;color:#5b6573;margin:0}
  .fpu-card.bad .fpu-step{color:#b42318}
  .fpu-foot{display:flex;justify-content:flex-end;margin-top:12px}
  .fpu-foot button{font:inherit;font-weight:600;min-height:44px;padding:6px 18px;border-radius:10px;border:1px solid #c9d0d9;background:#fff;cursor:pointer}`;
  let busy = false, holdUntil = 0;
  function installPanel() {
    if (!document.getElementById('fp-updates-css')) { const st = document.createElement('style'); st.id = 'fp-updates-css'; st.textContent = PCSS; document.head.appendChild(st); }
    const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    const veil = mk('div', 'fpu-veil');
    const card = mk('div', 'fpu-card');
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'fpu-title');
    const h = mk('h2'); const spin = mk('span', 'fpu-spin'); spin.setAttribute('aria-hidden', 'true');
    const title = mk('span', null, 'Installing the update'); title.id = 'fpu-title';
    h.append(spin, title);
    const stepEl = mk('div', 'fpu-step', 'Starting…'); stepEl.setAttribute('role', 'status'); stepEl.setAttribute('aria-live', 'polite');
    const bar = mk('div', 'fpu-bar'); const fill = mk('i'); bar.appendChild(fill);
    bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100'); bar.setAttribute('aria-labelledby', 'fpu-title');
    const note = mk('p', 'fpu-note', 'Keep this page open until it finishes. Terminals keep working meanwhile.');
    const foot = mk('div', 'fpu-foot');
    card.append(h, stepEl, bar, note, foot);
    veil.appendChild(card);
    document.body.appendChild(veil);
    const pct = part => { const v = Math.round(Math.max(0.02, Math.min(1, part)) * 100); fill.style.width = v + '%'; bar.setAttribute('aria-valuenow', String(v)); };
    const finish = (cls, mark, head, line, more) => {
      card.classList.add(cls);
      const m = mk('span', 'fpu-mark', mark); m.setAttribute('aria-hidden', 'true');
      spin.replaceWith(m);
      title.textContent = head; stepEl.textContent = line; note.textContent = more || '';
      const close = mk('button', null, 'Close'); close.type = 'button'; close.onclick = () => veil.remove();
      foot.replaceChildren(close); close.focus();
    };
    return {
      set(s) { if (s.version) title.textContent = `Installing ${s.version}`; stepEl.textContent = s.text; if (s.part != null) pct(s.part); },
      ok(head, line, more) { pct(1); finish('ok', '✓', head, line, more); setTimeout(() => veil.remove(), 6000); },
      bad(line) { finish('bad', '!', 'Not installed', line, 'Nothing switched: every page keeps the release it runs.'); },
    };
  }
  async function installShown(name, opts) {
    if (busy) throw new Error('An update is already installing.');
    busy = true;
    const panel = installPanel();
    const guard = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', guard);
    try {
      const r = await install(name, Object.assign({}, opts, { onStep: s => panel.set(s) }));
      holdUntil = Date.now() + 4000;
      panel.ok(`Installed ${r.version}`, `${r.from ? `Was ${r.from}. ` : ''}${r.launchers ? `${r.launchers} older launcher file${r.launchers === 1 ? '' : 's'} moved to shortcuts.` : ''}`,
        'Every terminal moves to it by itself, once nothing unsaved is on its screen. This page does too, in a moment.');
      return r;
    } catch (e) {
      const why = e.message.replace(/^Not installed: /, '');
      panel.bad(why.charAt(0).toUpperCase() + why.slice(1));
      throw e;
    } finally {
      busy = false;
      window.removeEventListener('beforeunload', guard);
    }
  }

  /* Make an older kept release current again (or a newer kept one, after going back). */
  async function useRelease(version) {
    await requireAdmin();
    const cfg = await installed();
    if (!cfg || !(cfg.kept || []).includes(version)) throw new Error(`Release ${version} isn't kept here.`);
    if (!(await complete(version, cfg))) throw new Error(`Release ${version} is missing files on this terminal.`);
    const user = FP.users ? await FP.users.current() : null;
    await FP.files.writeText(RUNTIME, 'releases.js', releasesText(Object.assign({}, cfg, { current: version, installedAt: new Date().toISOString(), by: user ? user.name : null, from: cfg.current })));
    return { version, from: cfg.current };
  }

  /* ---------- Pages loaded through boot.js: move to a new release at a safe moment ---------- */
  let watching = null;
  function watch(opts) {
    opts = opts || {};
    const boot = window.FP_BOOT;
    if (!boot || watching) return;               // a page loaded straight from its files (the test page) doesn't move
    let ready = null;
    const failedKey = 'fp-boot-failed';
    const tryReload = () => {
      if (!ready) return;
      if (busy || Date.now() < holdUntil) { setTimeout(tryReload, 1500); return; }   // the install panel first (0.44)
      let safe = true;
      try { safe = opts.isSafe ? !!opts.isSafe() : true; } catch (_) { safe = false; }
      if (!safe) { setTimeout(tryReload, RETRY_SAFE); return; }
      try { const f = JSON.parse(sessionStorage.getItem(failedKey) || '{}'); delete f[ready]; sessionStorage.setItem(failedKey, JSON.stringify(f)); } catch (_) { /* storage is best-effort */ }
      location.reload();
    };
    const check = async () => {
      if (ready || !FP.folder.handle) return;
      const cfg = await installed().catch(() => null);
      if (!cfg || !cfg.current || cfg.current === FP.version) return;
      if (!(await complete(cfg.current, cfg).catch(() => false))) return;   // still syncing: wait
      ready = cfg.current;
      if (opts.onReady) opts.onReady(ready, cmp(ready, FP.version) > 0);
      tryReload();
    };
    watching = setInterval(() => check().catch(() => {}), CHECK_EVERY);
    window.addEventListener('fp-update-needed', () => check().catch(() => {}));
    setTimeout(() => check().catch(() => {}), 5000);
    return { check };
  }

  FP.updates = { KEEP, cmp, readZip, inspect, installed, complete, pending, install, installShown, useRelease, watch, releasesText, installing: () => busy };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-updates'] = '0.63.1';
})();
