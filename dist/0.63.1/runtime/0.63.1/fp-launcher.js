/* Form Platform runtime: launchers (step 19)
 * Load last, after fp-defs.js.
 *
 * FP.launcher.start() runs a launcher page: the bar (title, saving state, terminal
 * and site, Print, who is signed in), the startup and sign-in gates, and the form.
 * Which form: launch.html?launcher=NAME (a shortcut, 0.48), launch.html?form=id (&version=3), or
 * window.FP_LAUNCH = { form, version } in an older launcher file.
 *
 *   version "latest"  follows each newly published version (reloading when the form is clean)
 *   version 3         stays on version 3, a trial version included, whatever is published after
 *
 * FP.launchers keeps the shortcuts (0.48): launchers/launchers.json lists each one (its name, form, version,
 * who made it). A Windows shortcut points at launch.html?launcher=NAME and opens that one form full screen, with
 * no home screen. launch.html is the only HTML file in the data folder; it loads whichever release runs
 * (runtime/releases.js, through runtime/boot.js). Launcher files from before 0.48 become entries in the list
 * when a release is installed, and each file becomes a one-line page that goes on to its shortcut's address.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.defs || !FP.forms) throw new Error('Load fp-defs.js before fp-launcher.js');

  const VERSION = '0.63.1';
  /* The runtime, in load order. */
  const KERNEL = ['fp-config', 'fp-core', 'fp-identity', 'fp-entry', 'fp-session', 'fp-formula', 'fp-current', 'fp-kinds', 'fp-sites', 'fp-lookup',
    'fp-users', 'fp-media', 'fp-sources', 'fp-forms', 'fp-controls', 'fp-visuals', 'fp-keyboard', 'fp-defs', 'fp-due', 'fp-launcher', 'fp-updates'];
  const LAUNCHERS = ['launchers'];

  /* Runs before any kernel file in a launcher file: a missing or broken file shows a red banner instead of a blank page. */
  const preamble = where => `window.__fpProblems = [];
window.__fpReport = function (msg) {
  window.__fpProblems.push(msg);
  var show = function () {
    var b = document.getElementById('fp-problems');
    if (!b) { b = document.createElement('div'); b.id = 'fp-problems';
      b.style.cssText = 'position:sticky;top:0;z-index:10000;background:#fde8e6;color:#7a1a12;border-bottom:2px solid #b42318;padding:12px 16px;font:14px/1.45 system-ui,"Segoe UI",sans-serif;white-space:pre-wrap';
      document.body.prepend(b); }
    b.textContent = 'Problem found. This page will not work until it is fixed:\\n- ' + window.__fpProblems.join('\\n- ');
  };
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
};
window.addEventListener('error', function (e) {
  var t = e.target;
  if (t && t.tagName === 'SCRIPT') window.__fpReport('Could not load ' + t.getAttribute('src') + '. ${where}');
  else if (e.message && e.message !== 'Script error.' && !/ResizeObserver loop/.test(e.message)) window.__fpReport(e.message + (e.filename ? ' (' + e.filename.split('/').pop() + ' line ' + e.lineno + ')' : ''));
}, true);
window.addEventListener('unhandledrejection', function (e) { window.__fpReport('Unhandled error: ' + (e.reason && e.reason.message || e.reason)); });`;

  const CSS = `
  *{box-sizing:border-box}
  body{margin:0;background:#f4f6f8;color:#1b1f24;font:16px/1.45 system-ui,"Segoe UI",sans-serif}
  .fpl-bar{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:12px;padding:10px 16px;background:#1b2633;color:#fff}
  .fpl-here{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 12px;background:#eef3fa;border:1px solid #d5deea;border-radius:12px;margin-bottom:12px}
  .fpl-here[hidden]{display:none}
  .fpl-check{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 12px;background:#fff7e0;border:1px solid #f0d58a;border-radius:12px;margin-bottom:12px}
  .fpl-check[hidden]{display:none}
  .fpl-alerts{margin-bottom:14px}.fpl-alerts[hidden]{display:none}.fpl-alerts h2{font-size:16px;margin:0 0 8px;color:#7a1a12}
  .fpl-acard{display:flex;flex-direction:column;gap:4px;padding:12px 14px;border-radius:12px;border:2px solid #f0a8a0;background:#fff5f4;margin-bottom:8px}
  .fpl-acard.high{border-color:#b42318}.fpl-acard.acked{border-color:#d9dee5;background:#f7f8fa}
  .fpl-acard .w{font-size:14px;color:#3d4a5c}.fpl-acard .s{font-weight:600;color:#7a1a12}.fpl-acard.acked .s{color:#3d4a5c}
  .fpl-acard ul{margin:4px 0;padding-left:18px;font-size:14px;color:#3d4a5c}
  .fpl-acard .fix{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:4px}
  .fpl-acard .fix input{flex:1 1 220px;font:inherit;min-height:44px;padding:6px 10px;border:1px solid #c9d0d9;border-radius:10px}
  .fpl-check .k{flex:1 1 260px;font-weight:600;color:#5a4300}
  .fpl-check button{font:inherit;font-weight:600;min-height:44px;padding:6px 16px;border-radius:10px;border:1px solid #1f5fbf;background:#1f5fbf;color:#fff;cursor:pointer}
  .fpl-check button:disabled{opacity:.6;cursor:default}
  .fpl-here .k{font-weight:600;color:#3d4a5c;margin-right:4px}
  .fpl-here button{font:inherit;font-weight:600;min-height:44px;padding:6px 16px;border-radius:999px;border:1px solid #b9c6d8;background:#fff;color:#1b2633;cursor:pointer}
  .fpl-here button.on{background:#1f5fbf;border-color:#1f5fbf;color:#fff}
  .fpl-bar h1{font-size:18px;margin:0;flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .fpl-bar h1 small{font-size:13px;font-weight:600;color:#1b2633;background:#f2c94c;border-radius:6px;padding:2px 7px;margin-left:8px;vertical-align:2px}
  .fpl-meta{font-size:13px;color:#c6d0dc;white-space:nowrap}
  .fpl-bar button{white-space:nowrap;font:inherit;font-size:14px;min-height:40px;padding:6px 12px;border-radius:10px;border:1px solid #4a5a6c;background:#26364a;color:#fff;cursor:pointer}
  .fpl-dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#2fbf5b;margin-right:6px;vertical-align:middle}
  .fpl-dot.wait{background:#e0a100}.fpl-dot.bad{background:#e5484d}
  .fpl-sim{font-size:13px;font-weight:700;color:#1b2633;background:#f2c94c;border-radius:6px;padding:3px 8px;white-space:nowrap}
  .fpl-main{max-width:1100px;margin:0 auto;padding:18px 16px 0}
  .fpl-main.wide{max-width:1680px;padding-top:12px}
  .fpl-notice{background:#fdf3d8;color:#6b4a00;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:14px}
  .fpl-notice.info{background:#e8f0fb;color:#1d3f73}
  .fpl-notice.bad{background:#fde8e6;color:#7a1a12;border:1px solid #f3b0a8}
  .fpl-notice button{margin-left:8px;font:inherit;font-size:14px;padding:4px 10px;border-radius:8px;border:1px solid #c9a24a;background:#fff;cursor:pointer}
  .fpl-menu{position:fixed;z-index:60;background:#fff;color:#1b1f24;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:6px;min-width:220px}
  .fpl-menu button{display:block;width:100%;text-align:left;font:inherit;min-height:48px;padding:8px 14px;border:0;border-radius:8px;background:none;cursor:pointer}
  .fpl-menu button:hover{background:#eef1f5}
  .fpl-menu small{display:block;color:#5b6573;font-size:13px}
  .fpl-err{background:#fde8e6;color:#7a1a12;border-radius:10px;padding:14px;white-space:pre-wrap}
  .fpl-home{display:flex;flex-direction:column;gap:14px;padding-bottom:24px}
  .fpl-board{margin:0 0 16px}
  .fpl-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px}
  .fpl-tile{display:flex;flex-direction:column;justify-content:center;gap:4px;min-height:84px;padding:12px 16px;border:1px solid #d9dee5;border-left:5px solid #2a78d6;border-radius:12px;background:#fff;color:#1b1f24;font:inherit;text-align:left;cursor:pointer}
  .fpl-tile b{font-size:17px}.fpl-tile:hover{border-color:#9db8dc}
  .fpl-due{display:flex;flex-direction:column;gap:8px;margin:0 0 14px}
  .fpl-due:empty{display:none}
  .fpl-due h2{font-size:15px;margin:0;color:#3b4552}
  .fpl-dcard{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;padding:6px 12px;border:1px solid #d9dee5;border-left:6px solid #2a78d6;border-radius:12px;background:#fff}
  .fpl-dcard.late{border-left-color:#d97706;background:#fffaf0}.fpl-dcard.missed{border-left-color:#c0362c;background:#fff5f4}
  .fpl-dcard b{font-size:16px}.fpl-dcard .w{font-size:14px;color:#3b4552}.fpl-dcard.late .w{color:#8a4b00;font-weight:600}.fpl-dcard.missed .w{color:#a1261c;font-weight:600}
  .fpl-dcard .s{flex:1 1 200px;font-size:13px;color:#5b6573}
  .fpl-dcard button{min-height:38px}.fpl-dcard .fix{display:flex;gap:6px;flex:1 1 100%}.fpl-dcard.fold .w{flex:1 1 auto}.fpl-dcard input{min-height:38px;font:inherit;padding:0 8px;border:1px solid #c9d0d9;border-radius:8px;flex:1 1 160px}
  .fpl-dnext{font-size:13px;color:#5b6573}
  .fpl-badge{display:inline-block;align-self:flex-start;font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;background:#e7f1fb;color:#1d4f86}
  .fpl-badge.late{background:#f9eeda;color:#8a4b00}.fpl-badge.missed{background:#fbebeb;color:#a1261c}
  .fpl-side .fpl-badge{margin-left:6px}
  .fpl-tile.small{min-height:60px;border-left-color:#94a3b8}.fpl-tile.small b{font-size:15px}
  .fpl-cap{font-size:13px;font-weight:700;color:#5b6573;margin-top:4px}
  .fpl-card{background:#fff;border:1px solid #d9dee5;border-radius:12px;padding:14px 16px}
  .fpl-card.quiet{background:#fbfcfd}
  .fpl-card h2{margin:0 0 6px;font-size:19px}.fpl-card h3{margin:0 0 4px;font-size:16px}.fpl-card p{margin:0 0 8px}.fpl-card ul{margin:4px 0 0;padding-left:20px}
  .fpl-sub{color:#5b6573;font-size:14px}
  .fpl-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:8px}
  .fpl-row button,.fpl-row select,.fpl-row input{font:inherit;font-size:15px;min-height:44px;padding:6px 14px;border-radius:10px;border:1px solid #c9d0d9;background:#fff}
  .fpl-row input{flex:1 1 200px}
  .fpl-row button{cursor:pointer}.fpl-row button.primary{background:#1f5fbf;border-color:#1f5fbf;color:#fff;font-weight:600}
  .fpl-approvals{display:flex;flex-direction:column;gap:8px}.fpl-approvals>h2{margin:0;font-size:19px}
  .fpl-appr{border-left:5px solid #b45309}
  .fpl-entry{display:flex;flex-wrap:wrap;gap:4px 10px;font-size:14px;padding:4px 0;border-bottom:1px solid #eef1f5}
  .fpl-this summary{cursor:pointer;font-weight:600}
  .fpl-recs{display:grid;grid-template-columns:minmax(260px,380px) minmax(0,1fr);gap:14px;align-items:start}
  @media (max-width:820px){.fpl-recs{grid-template-columns:minmax(0,1fr)}}
  .fpl-rlist{display:flex;flex-direction:column;gap:6px;max-height:70vh;overflow:auto}
  .fpl-rlist button{text-align:left;font:inherit;padding:10px 12px;border:1px solid #d9dee5;border-left:5px solid #2a78d6;border-radius:10px;background:#fff;cursor:pointer;min-height:48px}
  .fpl-rlist button.fixed{border-left-color:#b45309}.fpl-rlist button.on{background:#eaf1fc}
  .fpl-rlist small{display:block;color:#5b6573;font-size:13px}
  .fpl-fix label{display:flex;flex-direction:column;gap:3px;margin:0 0 10px;font-size:14px;color:#5b6573}
  .fpl-fix input,.fpl-fix select{font:inherit;font-size:16px;min-height:44px;padding:6px 10px;border-radius:10px;border:1px solid #c9d0d9;color:#1b1f24}
  .fpl-side{display:none}
  .fpl-menubtn{display:none}
  .fpl-main.split{max-width:none;display:grid;grid-template-columns:270px minmax(0,1fr);column-gap:18px;align-items:start}
  .fpl-main.split>*{grid-column:2}
  .fpl-main.split>.fpl-side{grid-column:1;grid-row:1 / span 3;display:flex;flex-direction:column;gap:4px;position:sticky;top:72px;max-height:calc(100vh - 86px);overflow:auto;padding-bottom:16px}
  .fpl-side button{display:block;width:100%;text-align:left;font:inherit;font-size:15px;min-height:48px;padding:8px 12px;border:1px solid transparent;border-radius:10px;background:none;color:#1b1f24;cursor:pointer}
  .fpl-side button:hover{background:#e9edf2}.fpl-side button.on{background:#fff;border-color:#c9d6e8;box-shadow:inset 4px 0 0 #2a78d6;font-weight:600}
  .fpl-side button.small{font-size:14px;min-height:40px;color:#3b4552}
  .fpl-side .fpl-cap{padding:8px 12px 2px}
  @media (max-width:900px){
    .fpl-main.split{display:block}
    .fpl-main.split>.fpl-side{display:none;position:fixed;z-index:55;top:60px;left:0;bottom:0;width:min(320px,86vw);max-height:none;background:#f4f6f8;padding:12px;box-shadow:0 10px 30px rgba(0,0,0,.25)}
    .fpl-main.split>.fpl-side.open{display:flex}
    body.fpl-split .fpl-menubtn{display:inline-block}
  }
  @media print{.fpl-bar,.fpl-notice,.fpl-side{display:none!important}.fpl-main.split{display:block}}
  @media (max-width:640px){.fpl-meta.term{display:none}}`;

  const el = (tag, cls, text) => FP.dom.el(tag, cls, text);   // one copy, in fp-core (0.50)
  const button = (text, cls, onclick) => { const b = el('button', cls, text); b.type = 'button'; if (onclick) b.onclick = onclick; return b; };
  const timeOf = iso => { const d = new Date(iso); return isNaN(d) ? '' : (d.toDateString() === new Date().toDateString() ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })); };
  const formTitle = id => { const d = FP.defs.get('form', id); return (d && d.def && d.def.title) || id; };

  /* ---------- A launcher page ----------
   * One launcher for every terminal (0.41). With no form named it is the terminal's home screen: who signs in
   * decides what it shows. A user sees the forms of this terminal's group (or the terminal's own list);
   * supervisors and up see those, then every form at the site, and a supervisor sees what waits for their
   * approval first. A form named in the address or a launcher file opens straight away, by the same rules:
   * a user who can't use it here is told so and offered to sign in as someone who can.
   * Until a site has any terminal group or terminal list, everyone there sees every form (as before 0.41). */
  function start() {
    const mods = FP.modules || {};
    const wrong = KERNEL.filter(m => mods[m] !== VERSION).map(m => (mods[m]
      ? `${m}.js is version ${mods[m]}; this launcher needs ${VERSION}. Replace it with the new copy.`
      : `${m}.js did not load, or stopped with an error. Replace it with the new copy.`));
    if (wrong.length) { wrong.forEach(window.__fpReport); return; }

    const st = el('style'); st.textContent = CSS; document.head.appendChild(st);
    const bar = el('div', 'fpl-bar');
    const homeBtn = button('⌂ Home'); homeBtn.hidden = true;
    // The admin view (0.51): the terminal's forms listed down the left; on a narrow screen they fold into a menu.
    const menuBtn = button('☰ Forms', 'fpl-menubtn');
    const side = el('nav', 'fpl-side'); side.setAttribute('aria-label', 'Forms');
    const titleEl = el('h1', null, 'Loading…');
    const saved = el('span', 'fpl-meta');
    const dot = el('span', 'fpl-dot');
    const outbox = el('span', null, 'Saved');
    // Folder permission can lapse mid-session (F19): a Reconnect button asks the browser again, then saves what is waiting.
    const reconnect = button('Reconnect', 'fpl-reconnect'); reconnect.id = 'reconnect'; reconnect.hidden = true;
    reconnect.onclick = async () => {
      reconnect.disabled = true;
      try { await FP.folder.reauthorize(); if (FP.outbox) await FP.outbox.flush(); } catch (e) { outbox.title = e.message; }
      reconnect.disabled = false;
      if (FP.outbox) showOutbox();
    };
    saved.append(dot, outbox, reconnect);
    const term = el('span', 'fpl-meta term');
    const printBtn = button('Print'); printBtn.hidden = true;
    const editorBtn = button('Editor'); editorBtn.hidden = true;
    const who = button('Sign in');
    bar.append(menuBtn, homeBtn, titleEl, saved, term, printBtn, editorBtn, who);
    // A simulated terminal (0.52.1) says so, so it is never taken for the real one.
    if (FP.simulated) { const sb = el('span', 'fpl-sim', `Simulated ${FP.simulated}`); sb.title = 'This tab runs as that terminal, on a test folder'; bar.insertBefore(sb, saved); }
    const main = el('main', 'fpl-main');
    const notice = el('div');
    const host = el('div');
    // ids for pages and tests that look for these parts
    [[titleEl, 'title'], [outbox, 'outbox'], [dot, 'dot'], [term, 'term'], [printBtn, 'print'], [who, 'who'], [notice, 'notice'], [host, 'form'], [homeBtn, 'home'], [editorBtn, 'editor'], [side, 'side'], [menuBtn, 'menu']].forEach(([n, id]) => { n.id = id; });
    // Clocks that disagree (0.45): a standing warning, kept above other notices until the page reloads. Entries are
    // stamped with this terminal's clock, so a wrong clock makes the record's times wrong.
    const clockBox = el('div');
    // What this terminal works on (0.60): when its group or it is for several lines, which one, picked here; HERE().
    const hereBox = el('div', 'fpl-here'); hereBox.id = 'here'; hereBox.hidden = true;
    // A duty done by looking the form over (0.60): Checked, nothing new, over the open form.
    const checkBar = el('div', 'fpl-check'); checkBar.id = 'checkoff'; checkBar.hidden = true;
    main.append(side, clockBox, hereBox, notice, checkBar, host);
    menuBtn.onclick = () => side.classList.toggle('open');
    window.addEventListener('fp-clock', e => {
      const d = e.detail || {};
      const mins = ms => Math.max(1, Math.round(ms / 60000));
      let text = null;
      if (d.behindMs) text = `This terminal's clock is at least ${mins(d.behindMs)} min behind the last time saved for ${d.item ? `${d.item.structure} ${d.item.id}` : 'an item'}.`;
      else if (Array.isArray(d.ahead) && d.ahead.length) text = `Clocks disagree: ${d.ahead.map(x => `${FP.identity.label ? FP.identity.label(x.terminal) : x.terminal} saves times ${mins(x.aheadMs)} min ahead of this terminal`).join('; ')}.`;
      if (!text) return;
      clockBox.replaceChildren(el('div', 'fpl-notice bad', `${text} One of the clocks is wrong, and saved times depend on it: ask IT to check the clocks (Windows: Settings › Time › Sync now).`));
    });
    document.body.prepend(bar, main);

    const launch = window.FP_LAUNCH || {};
    const q = new URLSearchParams(location.search);
    let oneForm = !!launch.form;                  // one form, no home screen: a shortcut (or an older launcher file)
    const shortcut = q.get('launcher');           // launch.html?launcher=NAME (0.48): read from the list once the folder is open
    if (shortcut) oneForm = true;
    let formId = launch.form || q.get('form') || null;
    const want = launch.version != null ? launch.version : q.get('version');
    // A version is a positive whole number; anything else is ignored (the latest runs) with a note once the page is up.
    const goodVersion = v => (/^[1-9]\d{0,8}$/.test(String(v).trim()) ? Number(v) : null);
    let badVersion = null;
    let pinned = null;
    if (want != null && want !== '' && want !== 'latest') { pinned = goodVersion(want); if (pinned == null) badVersion = String(want); }
    let inst = null;
    // Forms shown on the home screen (0.47, a form set to home: a line board), and what one asked the next form to start with.
    let boards = [];
    let startWith = null;
    const dropBoards = () => { boards.forEach(b => { try { b.destroy(); } catch (e) { /* gone */ } }); boards = []; };
    let titleText = formId || 'Form';
    let place = { forms: [], group: null, name: '', setUp: false };
    let termText = '';

    const setTitle = (t, doc) => {
      titleText = t;
      document.title = t;
      titleEl.replaceChildren(document.createTextNode(t));
      if (formId && pinned != null) titleEl.appendChild(el('small', null, `v${pinned}${doc && doc.trial ? ' trial' : ''}`));
    };
    function showOutbox(s) {
      s = s || FP.outbox.status();
      if (s.pending > 0) { dot.className = 'fpl-dot ' + (s.state === 'waiting' ? 'bad' : 'wait'); outbox.textContent = `${s.pending} waiting to save`; }
      else { dot.className = 'fpl-dot'; outbox.textContent = 'All saved'; }
      if (s.state === 'waiting' && s.lastError) outbox.title = s.lastError;
      reconnect.hidden = !(s.pending > 0 && s.state === 'waiting' && /permission|reconnect/i.test(String(s.lastError || '')));
    }
    async function showUser() {
      const u = await FP.users.current();
      const role = u ? FP.users.topRole(u.roles) : 'user';
      who.textContent = u ? (role === 'user' ? u.name : `${u.name} · ${FP.users.ROLE_LABEL[role].toLowerCase()}`) : 'Sign in';
      // A shared terminal: the name in the bar is who is responsible here; tapping it hands over to another supervisor.
      if (u && shared()) {
        who.textContent = `Responsible: ${u.name}`;
        who.title = 'What is saved on this terminal is under this sign-in. The people doing the work tap their name on each form. Tap to hand over to another supervisor.';
      } else who.title = u ? 'Tap to switch who is signed in' : '';
      editorBtn.hidden = shared() || !(u && await FP.users.can(FP.defs.publishRole));
    }
    const say = (text, kind, btn) => {
      const n = el('div', 'fpl-notice' + (kind ? ' ' + kind : ''), text);
      if (btn) n.appendChild(btn);
      notice.replaceChildren(n);
    };
    // The editor sits next to this launcher (runtime/editor.html in the data folder).
    const editorUrl = () => (window.FP_BOOT && window.FP_BOOT.base ? window.FP_BOOT.base : '') + 'editor.html';
    editorBtn.onclick = () => window.open(editorUrl(), '_blank');

    /* This terminal: its group or own list of forms, and whether its site has any set up yet. */
    async function loadPlace() {
      const tid = FP.identity.terminalId, site = FP.identity.site;
      const ft = await FP.groups.forTerminal(tid).catch(() => ({ group: null, forms: [], name: '' }));
      const groups = await FP.groups.list().catch(() => []);
      const ts = await FP.groups.terminals().catch(() => new Map());
      const reg = await FP.identity.all().catch(() => []);
      const siteOf = id => (reg.find(r => r.terminalId === id) || {}).site;
      // A terminal named in a group is set up whichever site the group is at (the group's forms, home form and view are matched by terminal ID).
      const setUp = !!ft.group || groups.some(g => g.site === site) || Array.from(ts.entries()).some(([id, t]) => t.forms && t.forms.length && (id === tid || siteOf(id) === site));
      const usable = id => { const d = FP.defs.get('form', id); return !!(d && !d.retired && FP.defs.usedHere('form', id)); };
      place = { group: ft.group, name: ft.name, forms: ft.forms.filter(usable), setUp, signedInFor: ft.signedInFor || 15, signIn: ft.signIn || 'anyone',
        homeForm: ft.homeForm || null, view: ft.view === 'admin' ? 'admin' : 'kiosk' };
      setView();
      if (FP.keyboard) FP.keyboard.setMode(ft.keyboard || 'auto');   // this terminal's on-screen keyboard (0.43)
      termText = `${ft.group ? ft.group.name + ' · ' : ''}${tid}${ft.name ? ' ' + ft.name : ''}`;
      paintHere(ft.for || null);
      term.textContent = `${termText} · ${site}`;
      FP.sites.current().then(x => { if (x) term.textContent = `${termText} · ${x.name}`; }).catch(() => {});
    }
    /* The picker of what it works on: one button per item when it is for several; the pick is kept on this terminal. */
    const hereKey = () => `fp-here:${FP.identity.terminalId}`;
    function paintHere(forSetting) {
      if (!FP.kinds || !FP.kinds.setHere) return;
      let kept = null;
      try { kept = localStorage.getItem(hereKey()); } catch (_) { kept = null; }
      const h = FP.kinds.setHere(forSetting, kept);
      hereBox.hidden = !(h.items.length > 1);
      if (hereBox.hidden) { hereBox.replaceChildren(); return; }
      const sd = FP.structures.has(h.list) ? FP.structures.get(h.list) : null;
      const what = ((sd && sd.itemId && sd.itemId.label) || (sd && sd.label) || 'Item').replace(/s$/, '');
      hereBox.replaceChildren(el('span', 'k', h.current ? `${what}:` : `Which ${what.toLowerCase()}?`));
      h.items.forEach(x => {
        const b = button(x, x === h.current ? 'on' : '', () => {
          try { localStorage.setItem(hereKey(), x); } catch (_) { /* this tab only */ }
          paintHere(forSetting);
        });
        b.setAttribute('aria-pressed', String(x === h.current));
        hereBox.appendChild(b);
      });
    }
    const siteForms = () => FP.defs.list('form').filter(d => !d.retired && d.def && d.def.launchable && FP.defs.usedHere('form', d.id))
      .sort((a, b) => formTitle(a.id).localeCompare(formTitle(b.id)));
    // A shared terminal (0.50.1): a supervisor is signed in but the people using it are not, so only its own forms open.
    const shared = () => !!(place && place.signIn === 'supervisors');
    const gateOpts = title => Object.assign({ title }, shared() ? { role: 'supervisor' } : {});
    async function mayOpen(id) {
      if (shared()) return place.forms.includes(id);
      if (await FP.users.can('supervisor')) return true;
      return !place.setUp || place.forms.includes(id);
    }

    /* The home form (0.51): the terminal's choice, one of its forms; not chosen, older forms set to home: true. */
    const isHomeTagged = id => { const d = FP.defs.get('form', id); return !!(d && d.def && d.def.home); };
    function homeForms() {
      const mine = place.setUp ? place.forms : siteForms().map(d => d.id);
      if (place.homeForm === 'none') return [];
      if (place.homeForm) return mine.includes(place.homeForm) ? [place.homeForm] : [];
      return mine.filter(isHomeTagged);
    }
    const adminView = () => !oneForm && place && place.view === 'admin';
    function setView() {
      const on = adminView();
      main.classList.toggle('split', on);
      document.body.classList.toggle('fpl-split', on);
      if (!on) side.classList.remove('open');
    }
    /* The list down the left (admin view): Home, this terminal's forms, then (supervisors) the rest at the site. */
    async function paintSide() {
      if (!adminView()) { side.replaceChildren(); return; }
      const sup = !shared() && await FP.users.can('supervisor');
      const mine = place.setUp ? place.forms : (sup ? [] : siteForms().map(d => d.id));
      const item = (text, on, fn, cls) => { const b = button(text, (cls || '') + (on ? ' on' : ''), () => { side.classList.remove('open'); fn(); }); if (on) b.setAttribute('aria-current', 'page'); return b; };
      const kids = [item('⌂ Home', !formId && !recState.open, () => goHome())];
      mine.forEach(id => { const b = item(formTitle(id), formId === id, () => pick(id)); b.dataset.form = id; kids.push(b); });
      if (sup) {
        kids.push(item('Records', !!recState.open, () => recordsScreen().catch(e => host.replaceChildren(el('div', 'fpl-err', e.message)))));
        const rest = siteForms().filter(d => !mine.includes(d.id));
        if (rest.length) {
          kids.push(el('div', 'fpl-cap', mine.length ? 'Every form at this site' : 'Forms at this site'));
          rest.forEach(d => { const b = item(formTitle(d.id), formId === d.id, () => pick(d.id), 'small'); b.dataset.form = d.id; kids.push(b); });
        }
      }
      side.replaceChildren(...kids);
      badges();
    }

    /* A pinned form: what it was checked against when published, and what is in use now. */
    function pinNotes(doc) {
      const latest = FP.defs.get('form', formId);
      const notes = [];
      if (latest && latest.version !== doc.version) notes.push(`This launcher stays on version ${doc.version}${doc.trial ? ' (a trial)' : ''}; version ${latest.version} is the current one.`);
      const changed = Object.entries(doc.uses || {}).map(([key, v]) => {
        const [kind, id] = key.split('/');
        const now = FP.defs.get(kind, id);
        return now && now.version !== v ? `${FP.defs.LABELS[kind]} ${id} v${v} → v${now.version}` : null;
      }).filter(Boolean);
      if (changed.length) notes.push(`Changed since this version was published: ${changed.join(', ')}.`);
      if (notes.length) say(notes.join(' '), 'info');
    }

    /* Someone who can't use this form here: say so, and offer to sign in as someone who can. */
    async function refuse() {
      const u = await FP.users.current();
      const t = formTitle(formId);
      setTitle(t);
      printBtn.hidden = true;
      const box = el('div', 'fpl-card');
      box.appendChild(el('h2', null, `${t} isn't on ${FP.identity.terminalId}`));
      if (shared()) box.appendChild(el('p', null, `Only ${place.group ? `the forms of ${place.group.name}` : `${FP.identity.terminalId}'s forms`} open on this shared terminal, whoever is signed in. Ask an admin to add ${t} to it.`));
      else box.appendChild(el('p', null, `${u ? u.name : 'You'} can fill in ${place.group ? `the forms of ${place.group.name}` : `${FP.identity.terminalId}'s forms`} here. A supervisor can fill in any form at this site, or ask one to add ${t} to this terminal.`));
      const row = el('div', 'fpl-row');
      if (!shared()) row.appendChild(button('Sign in as someone who can', 'primary', async () => { await FP.users.signOut('switched'); await signInAgain(); }));
      if (!oneForm) row.appendChild(button('Go to this terminal\'s forms', null, () => goHome()));
      box.appendChild(row);
      host.replaceChildren(box);
    }

    // A save button with then: "close" goes back to the home screen; a one-form launcher has none, so it starts the next record.
    const closer = () => { goHome().catch(() => {}); };
    async function openForm() {
      if (!formId) return goHome();
      recState.open = false;
      homeBtn.hidden = oneForm || adminView();
      paintSide().catch(() => {});
      if (inst) { inst.destroy(); inst = null; }
      dropBoards();
      notice.replaceChildren();
      const prefill = startWith; startWith = null;
      if (!(await mayOpen(formId))) return refuse();
      try {
        let doc;
        if (pinned != null) {
          doc = await FP.defs.version('form', formId, pinned);
          if (!doc) throw new Error(`Form ${formId} has no version ${pinned}. Make this launcher again, pinned to a version that exists.`);
          if (doc.retired) throw new Error(`Version ${pinned} of form ${formId} retired it.`);
          inst = await FP.forms.open(host, formId, { doc, onClose: oneForm ? undefined : closer, responsible: shared() });
        } else {
          inst = await FP.forms.open(host, formId, Object.assign({ onClose: oneForm ? undefined : closer, responsible: shared() }, prefill ? { prefill } : {}));
          doc = FP.defs.get('form', formId);
        }
        setTitle(doc.def.title || formId, doc);
        paintCheck();
        main.classList.toggle('wide', doc.def.density === 'compact' && !adminView());   // compact forms use a big screen's width (0.44)
        printBtn.hidden = !inst.canPrint();
        if (pinned != null) pinNotes(doc);
        approvalsNote();
      } catch (e) {
        host.replaceChildren(el('div', 'fpl-err', e.message));
        setTitle(formId);
      }
    }

    /* ---------- Home: approvals first (supervisors), then this terminal's forms ---------- */
    async function goHome() {
      if (oneForm) return openForm();
      if (inst && inst.isDirty() && !confirm('Leave this form? What you typed stays on this terminal as a draft.')) return;
      if (inst) { inst.destroy(); inst = null; }
      dropBoards();
      formId = null; pinned = null;
      history.replaceState(null, '', location.pathname);
      homeBtn.hidden = true; printBtn.hidden = true;
      main.classList.remove('wide');
      notice.replaceChildren();
      checkBar.hidden = true; checkBar.replaceChildren();
      recState.open = false;
      await loadPlace();
      setTitle(place.group ? place.group.name : 'Forms');
      await paintSide();
      await paintHome();
    }
    function pick(id, prefill) {
      formId = id; pinned = null; startWith = prefill || null;
      history.replaceState(null, '', `${location.pathname}?form=${encodeURIComponent(id)}`);
      openForm();
    }
    const tile = (id, small) => {
      const t = el('button', 'fpl-tile' + (small ? ' small' : ''));
      t.type = 'button';
      t.appendChild(el('b', null, formTitle(id)));
      t.onclick = () => pick(id);
      t.dataset.form = id;
      return t;
    };
    /* Due (0.54): what this terminal's forms are due, late or missed, at the top of the home page and as a badge on
     * each form's tile and in the list down the left. FP.due works it out once a minute and records misses. */
    let dueList = [];
    const dueBox = el('section', 'fpl-due');
    dueBox.id = 'due';
    const urgent = x => x.state === 'missed' || x.state === 'late' || x.state === 'due';
    const shownDue = () => dueList.filter(x => urgent(x) && (x.state !== 'missed' || Date.now() - x.end < 12 * 3600000));
    // Missed checks fold into one line (0.55.2): what is due now stays on top; a supervisor opens the misses to excuse them.
    let missesOpen = false;
    async function paintDue() {
      const list = shownDue();
      const sup = await FP.users.can('supervisor').catch(() => false);
      const kids = [];
      const sub = x => [x.item ? `${x.item.id}` : x.scopeLabel, x.owner && x.owner.signedIn ? null : `for ${x.ownerText}`, x.critical ? 'critical' : null].filter(Boolean).join(' · ');
      const card = x => {
        const c = el('div', 'fpl-dcard ' + x.state.replace(' ', '-'));
        c.dataset.slot = x.id; c.dataset.form = x.formId;
        c.append(el('b', null, x.title + (x.label ? ` · ${x.label}` : '')), el('span', 'w', FP.due.words(x)));
        const s2 = sub(x); if (s2) c.appendChild(el('span', 's', s2));
        if (x.state !== 'missed') c.appendChild(button('Open it', 'primary', () => pick(x.formId, prefillFor(x))));
        else if (sup) {
          const why = el('input'); why.placeholder = 'Why it was missed (e.g. line down)'; why.autocomplete = 'off';
          const fix = el('div', 'fix');
          c.appendChild(fix);
          fix.append(why, button('Excuse it', null, async () => {
            try { await FP.due.excuse(x, why.value); x.state = 'excused'; x.excused = why.value.trim(); await paintDue(); }
            catch (e) { say(e.message); }
          }));
        }
        return c;
      };
      const now = list.filter(x => x.state !== 'missed'), missed = list.filter(x => x.state === 'missed');
      if (now.length) kids.push(el('h2', null, now.some(x => x.state === 'late') ? 'Checks due and late' : 'Due now'));
      now.forEach(x => kids.push(card(x)));
      if (missed.length) {
        const first = missed.reduce((a, b) => (a.end < b.end ? a : b));
        const head = el('div', 'fpl-dcard missed fold');
        head.append(el('b', null, `Missed: ${missed.length} check${missed.length === 1 ? '' : 's'}`), el('span', 'w', `since ${timeOf(new Date(first.end).toISOString())}`));
        if (sup) {
          const tg = button(missesOpen ? 'Hide' : (missed.length === 1 ? 'Show it' : 'Show them'), null, () => { missesOpen = !missesOpen; paintDue().catch(() => {}); });
          tg.setAttribute('aria-expanded', String(missesOpen));
          head.appendChild(tg);
        }
        kids.push(head);
        if (sup && missesOpen) missed.forEach(x => kids.push(card(x)));
      }
      const next = dueList.filter(x => x.state === 'upcoming').sort((a, b) => a.start - b.start)[0];
      if (next && !now.length && !adminView()) kids.push(el('div', 'fpl-dnext', `Next: ${next.title} at ${timeOf(new Date(next.start).toISOString())}`));
      dueBox.replaceChildren(...kids);
      badges();
    }
    // A slot for one item opens its form on that item: the form's source for the item's structure takes its ID.
    function prefillFor(x) {
      if (!x.item) return null;
      const d = FP.defs.get('form', x.formId);
      const src = d && d.def && (d.def.sources || []).find(s => s && s.structure && String(s.structure).split('~')[0] === x.item.structure && s.id && s.id.field);
      return src ? { [src.id.field]: x.item.id } : null;
    }
    function badges() {
      const worst = new Map();
      const rank = { missed: 0, late: 1, due: 2 };
      shownDue().forEach(x => { const w = worst.get(x.formId); if (!w || rank[x.state] < rank[w.state]) worst.set(x.formId, x); });
      document.querySelectorAll('.fpl-tile[data-form], .fpl-side [data-form]').forEach(t => {
        const old = t.querySelector('.fpl-badge'); if (old) old.remove();
        const x = worst.get(t.dataset.form);
        if (x) t.appendChild(el('span', 'fpl-badge ' + x.state, x.state === 'due' ? `Due by ${timeOf(new Date(x.end).toISOString())}` : x.state === 'late' ? 'Late' : 'Missed'));
      });
    }
    window.addEventListener('fp-due', e => { dueList = (e.detail && e.detail.list) || []; paintDue().catch(() => {}); paintCheck(); paintAlerts().catch(() => {}); });
    /* Alerts (0.62): misses climbing a responsibility center's ladder. On the home page: the ones this person was told of,
     * and the ones missed at this terminal; each says where it has got to, with Acknowledge for someone told. */
    const alertBox = el('section', 'fpl-alerts'); alertBox.id = 'alerts';
    let alertOpen = {};
    async function paintAlerts() {
      if (!FP.alerts) return;
      const u = await FP.users.current().catch(() => null);
      const list = await FP.alerts.forUser(u, { terminalId: FP.identity.terminalId }).catch(() => []);
      alertBox.hidden = !list.length;
      if (!list.length) { alertBox.replaceChildren(); return; }
      const kids = [el('h2', null, list.some(a => !a.ackAt) ? `Alerts: ${list.filter(a => !a.ackAt).length} not acknowledged` : 'Alerts')];
      list.forEach(a => {
        const told = u && a.told.some(t => (t.ids || []).includes(u.id));
        const c = el('div', 'fpl-acard' + (a.ackAt ? ' acked' : a.level >= 2 ? ' high' : ''));
        c.dataset.alert = a.id;
        c.append(el('b', null, `${a.title}${a.item ? ` · ${a.item}` : ''}`),
          el('span', 'w', `Missed ${timeOf(a.dueBy || a.since)}${a.where && !a.item ? ` at ${a.where}` : ''} · ${a.centerName}${a.responsible ? ` · responsible: ${a.responsible}` : ''}`),
          el('span', 's', FP.alerts.words(a)));
        if (alertOpen[a.id]) {
          const ul = el('ul');
          ul.appendChild(el('li', null, `${timeOf(a.since)}: missed, shown at the line`));
          a.told.forEach(t => ul.appendChild(el('li', null, `${timeOf(t.at)}: level ${t.level}, ${t.passed ? `${t.to}: everyone away, passed on` : `told ${t.to}${t.people.length ? ` (${t.people.join(', ')})` : ''}`}`)));
          if (a.ackAt) ul.appendChild(el('li', null, `${timeOf(a.ackAt)}: acknowledged by ${a.ackBy}${a.ackNote ? `: ${a.ackNote}` : ''}`));
          c.appendChild(ul);
        }
        const row = el('div', 'fix');
        row.appendChild(button(alertOpen[a.id] ? 'Hide what happened' : 'What happened', null, () => { alertOpen[a.id] = !alertOpen[a.id]; paintAlerts().catch(() => {}); }));
        if (!a.ackAt && (told || (u && FP.users.topRole(u.roles) !== 'user'))) {
          const note = el('input'); note.placeholder = 'What is being done (e.g. line down, checking now)'; note.autocomplete = 'off';
          row.append(note, button('Acknowledge', 'primary', async () => {
            try { await FP.alerts.ack(a.id, note.value); await paintAlerts(); say(`Acknowledged: ${a.title}. It stops climbing; it closes when the check is done again or excused.`, 'info'); }
            catch (e) { say(e.message, 'bad'); }
          }));
        }
        c.appendChild(row);
        kids.push(c);
      });
      alertBox.replaceChildren(...kids);
    }
    /* Over the open form: each duty it does that looking it over counts for, due or late now, with Checked, nothing new. */
    function paintCheck() {
      const mine = formId ? dueList.filter(x => (x.state === 'due' || x.state === 'late') && x.duty && x.duty.confirm && (x.forms || [x.formId]).includes(formId)) : [];
      checkBar.hidden = !mine.length;
      if (!mine.length) { checkBar.replaceChildren(); return; }
      checkBar.replaceChildren(el('span', 'k', `${mine[0].title}${mine[0].label ? ` · ${mine[0].label}` : ''} is ${mine.some(x => x.state === 'late') ? 'late' : 'due'}${mine[0].center ? ` (${mine[0].center.name})` : ''}. Looked it over and nothing needs changing?`));
      mine.forEach(x => {
        const b = button(mine.length > 1 || x.item ? `Checked${x.item ? ` ${x.item.id}` : ''}: nothing new` : 'Checked: nothing new', 'primary', async () => {
          b.disabled = true;
          try {
            await FP.due.checkOff(x);
            dueList = dueList.filter(y => y.id !== x.id);
            paintCheck(); paintDue().catch(() => {}); badges();
            say(`Checked: ${x.title}${x.item ? ` · ${x.item.id}` : ''}, at ${timeOf(new Date().toISOString())}.`, 'info');
          } catch (e) { b.disabled = false; say(e.message, 'bad'); }
        });
        b.dataset.slot = x.id;
        checkBar.appendChild(b);
      });
    }

    async function paintHome() {
      const u = await FP.users.current();
      // On a shared terminal the signed-in supervisor sees what everyone there sees: its forms, nothing more.
      const sup = !shared() && await FP.users.can('supervisor');
      const page = el('div', 'fpl-home');
      page.append(alertBox, dueBox);
      paintAlerts().catch(() => {});
      // Who is responsible on a shared terminal is in the bar (0.55.2), not on the home screen: the people doing the
      // work don't need it there.
      if (sup) {
        const waiting = await FP.approvals.list(FP.identity.site).catch(() => []);
        if (waiting.length) page.appendChild(approvalsPart(waiting));
        // Records (0.49): a supervisor finds a saved record and corrects it, with the reason kept (in the list, in the admin view).
        const rr = el('div', 'fpl-row');
        rr.appendChild(button('Records: find and correct a saved record', null, () => recordsScreen().catch(e => host.replaceChildren(el('div', 'fpl-err', e.message)))));
        if (!adminView()) page.appendChild(rr);
      } else if (u) {
        const mine = (await FP.approvals.list(FP.identity.site).catch(() => [])).filter(a => a.userId === u.id);
        if (mine.length) {
          const box = el('div', 'fpl-card quiet');
          box.appendChild(el('h3', null, `Waiting for a supervisor's approval: ${mine.length}`));
          const ul = el('ul');
          mine.forEach(a => ul.appendChild(el('li', null, `${a.title} · ${timeOf(a.at)}${a.summary ? ' · ' + a.summary : ''}`)));
          box.appendChild(ul);
          page.appendChild(box);
        }
      }
      const shown = place.setUp ? place.forms : (sup ? [] : siteForms().map(d => d.id));
      // The home form (0.51, the terminal's choice) sits at the top, open; its cards' buttons open the other forms.
      const homes = homeForms();
      const boardHosts = homes.map(id => { const h = el('div', 'fpl-board'); h.dataset.form = id; page.appendChild(h); return [id, h]; });
      const homeFormsList = homes;
      const tiles = adminView() ? [] : shown.filter(id => !homes.includes(id));
      if (adminView()) {
        // The forms are down the left: the home page holds the home form and what waits, nothing more.
        if (!homes.length && !shared()) page.appendChild(el('div', 'fpl-card quiet', (place.setUp && !place.forms.length) || (!place.setUp && sup && !siteForms().length) ? `No forms on ${FP.identity.terminalId} yet: ask a supervisor.` : 'Choose a form on the left.'));
      } else if (tiles.length) {
        if (sup || homeFormsList.length) page.appendChild(el('div', 'fpl-cap', homeFormsList.length ? 'Other forms' : `Forms on ${place.group ? place.group.name : FP.identity.terminalId}`));
        const grid = el('div', 'fpl-tiles');
        tiles.forEach(id => grid.appendChild(tile(id)));
        page.appendChild(grid);
      } else if (!sup && !homeFormsList.length) {
        page.appendChild(el('div', 'fpl-card', `No forms on ${FP.identity.terminalId} yet: ask a supervisor.`));
      }
      if (sup && !adminView()) {
        const rest = siteForms().filter(d => !shown.includes(d.id) && !homeFormsList.includes(d.id));
        if (rest.length) {
          const site = await FP.sites.current().catch(() => null);
          page.appendChild(el('div', 'fpl-cap', shown.length ? `Every form at ${site ? site.name : FP.identity.site}` : `Forms at ${site ? site.name : FP.identity.site}${place.setUp ? ` (none set for ${FP.identity.terminalId} yet)` : ''}`));
          const grid = el('div', 'fpl-tiles');
          rest.forEach(d => grid.appendChild(tile(d.id, true)));
          page.appendChild(grid);
        }
      }
      if (await FP.users.can('admin')) page.appendChild(terminalPart());
      dropBoards();
      host.replaceChildren(page);
      paintDue().catch(() => {});
      for (const [id, h] of boardHosts) {
        try { boards.push(await FP.forms.open(h, id, { onOpenForm: (form, prefill) => pick(form, prefill), draft: false })); }
        catch (e) { h.replaceChildren(el('div', 'fpl-err', `${formTitle(id)}: ${e.message}`)); }
      }
    }

    /* ---------- Records (0.49): find a saved record and correct it (supervisors and up) ----------
     * A correction is a new entry naming the one it corrects, with the reason; the original stays in the history. */
    const recState = { structure: null, find: '', sel: null };
    async function recordsScreen() {
      if (!(await FP.users.can('supervisor'))) throw new Error('Records are for supervisors.');
      if (inst) { inst.destroy(); inst = null; }
      dropBoards();
      formId = null; homeBtn.hidden = adminView(); printBtn.hidden = true;
      recState.open = true;
      paintSide().catch(() => {});
      setTitle('Records');
      const structures = FP.defs.list('structure').filter(d => !d.retired && FP.defs.usedHere('structure', d.id)).sort((x, y) => String(x.def.label || x.id).localeCompare(String(y.def.label || y.id)));
      if (!recState.structure || !structures.some(d => d.id === recState.structure)) recState.structure = structures[0] ? structures[0].id : null;
      const users = new Map((await FP.users.list().catch(() => [])).map(u => [u.id, u.name]));
      const data = recState.structure ? await FP.current.load(recState.structure, { fresh: true, history: true }).catch(() => null) : null;
      const rows = data ? data.rows.slice().sort((x, y) => String(y.writtenAt).localeCompare(String(x.writtenAt))) : [];
      const page = el('div', 'fpl-home');
      const tools = el('div', 'fpl-row');
      const ss = el('select');
      structures.forEach(d => { const o = el('option', null, d.def.label || d.id); o.value = d.id; ss.appendChild(o); });
      ss.value = recState.structure || '';
      ss.onchange = () => { recState.structure = ss.value; recState.sel = null; recordsScreen(); };
      const fi = el('input'); fi.placeholder = 'Find: ID, person, terminal'; fi.value = recState.find; fi.autocomplete = 'off';
      tools.append(ss, fi);
      page.appendChild(tools);
      const grid = el('div', 'fpl-recs');
      const list = el('div', 'fpl-rlist');
      const side = el('div', 'fpl-card');
      grid.append(list, side);
      page.appendChild(grid);
      const who = r => users.get(r.userId) || r.userId || '';
      const paintList = () => {
        const q = recState.find.trim().toLowerCase();
        const shown = rows.filter(r => !q || [r.item.id, who(r), FP.identity.label ? FP.identity.label(r.terminalId) : r.terminalId].some(x => String(x || '').toLowerCase().includes(q))).slice(0, 60);
        list.replaceChildren(...shown.map(r => {
          const b = button('', (r.corrections.length ? 'fixed' : '') + (recState.sel === r.entryId ? ' on' : ''), () => { recState.sel = r.entryId; paintList(); paintRecord(); });
          b.append(el('b', null, r.item.id), el('small', null, `${formTitle(r.form && r.form.id)} · ${timeOf(r.writtenAt)} · ${who(r)}${r.corrections.length ? ' · corrected' : ''}`));
          return b;
        }));
        if (!shown.length) list.appendChild(el('div', 'fpl-sub', rows.length ? 'Nothing matches.' : 'Nothing saved here yet.'));
      };
      fi.oninput = () => { recState.find = fi.value; paintList(); };
      async function paintRecord() {
        const r = rows.find(x => x.entryId === recState.sel);
        side.replaceChildren();
        if (!r) { side.appendChild(el('p', 'fpl-sub', 'Pick a record to see it as it was saved.')); return; }
        side.appendChild(await FP.forms.recordPart(r, { who: who(r) }));
        const row = el('div', 'fpl-row');
        row.append(button('Print', null, () => FP.forms.printRecord(r, { who: who(r) }).catch(e => say(e.message))), button('Correct…', 'primary', () => paintFix(r)));
        side.appendChild(row);
      }
      function paintFix(r) {
        const box = el('div', 'fpl-fix');
        const doc = r.form && FP.defs.get('form', r.form.id);
        const def = doc ? (FP.sources ? FP.sources.normalize(doc.def) : doc.def) : { fields: [] };
        const labelOf = k => { const f = (def.fields || []).find(x => x && x.writes === `${r.item.structure}.${k}`); return f ? (f.label || f.name) : k; };
        const edits = {};
        box.appendChild(el('h3', null, `Correct ${r.item.id}`));
        Object.keys(r.values || {}).filter(k => k !== 'reason').forEach(k => {
          const v = r.values[k];
          if (v != null && typeof v === 'object') return;
          const l = el('label'); l.appendChild(document.createTextNode(labelOf(k)));
          let node;
          if (typeof v === 'boolean') { node = el('select'); [['true', 'Yes'], ['false', 'No']].forEach(([x, t]) => { const o = el('option', null, t); o.value = x; node.appendChild(o); }); node.value = String(v); node.onchange = () => { edits[k] = node.value === 'true'; }; }
          else { node = el('input'); node.type = typeof v === 'number' ? 'number' : 'text'; node.value = v == null ? '' : String(v); node.oninput = () => { edits[k] = typeof v === 'number' ? (node.value === '' ? null : Number(node.value)) : node.value; }; }
          l.appendChild(node); box.appendChild(l);
        });
        const rl = el('label'); rl.appendChild(document.createTextNode('Why it is corrected (kept with the correction)'));
        const ri = el('input'); ri.placeholder = 'e.g. typo: 1.21 was entered as 12.1'; rl.appendChild(ri); box.appendChild(rl);
        const note = el('div', 'fpl-sub');
        const row = el('div', 'fpl-row');
        row.append(button('Save the correction', 'primary', async () => {
          try {
            const changed = {};
            Object.entries(edits).forEach(([k, v]) => { if (JSON.stringify(v) !== JSON.stringify(r.values[k])) changed[k] = v; });
            if (!Object.keys(changed).length) throw new Error('Nothing is changed.');
            if (!ri.value.trim()) throw new Error('Say why it is corrected.');
            await FP.entry.correct(r, changed, ri.value.trim());
            await FP.outbox.flush();
            FP.current.clearCache();
            say(`The correction to ${r.item.id} is saved. The original stays in its history.`, 'info');
            await recordsScreen();
          } catch (e) { note.textContent = e.message; }
        }), button('Cancel', null, () => paintRecord()));
        box.append(row, note);
        side.replaceChildren(box);
      }
      paintList();
      await paintRecord();
      host.replaceChildren(page);
    }

    /* What waits for a supervisor's approval, oldest first: approve it (it is saved) or not (it isn't). */
    function approvalsPart(waiting) {
      const box = el('section', 'fpl-approvals');
      box.appendChild(el('h2', null, `Waiting for your approval: ${waiting.length}`));
      waiting.forEach(a => {
        const card = el('div', 'fpl-card fpl-appr');
        card.dataset.approval = a.id;
        card.appendChild(el('h3', null, a.title));
        card.appendChild(el('p', 'fpl-sub', `${a.userName || 'Someone'} · ${FP.identity.label(a.terminalId)} · ${timeOf(a.at)}`));
        if (a.summary) card.appendChild(el('p', null, a.summary));
        const more = el('details');
        more.appendChild(el('summary', null, 'Everything it saves'));
        (a.entries || []).forEach(e => {
          const vals = Object.entries(e.values || {}).filter(([, v]) => v != null && v !== '' && typeof v !== 'object');
          const d = el('div', 'fpl-entry');
          d.appendChild(el('b', null, `${e.item.structure} ${e.item.id}`));
          d.appendChild(el('span', null, vals.map(([k, v]) => `${k}: ${v}`).join(' · ') || 'no values'));
          more.appendChild(d);
        });
        card.appendChild(more);
        const why = el('input'); why.placeholder = 'Why not (optional)'; why.autocomplete = 'off';
        const row = el('div', 'fpl-row');
        const decide = ok => async () => {
          row.querySelectorAll('button').forEach(x => { x.disabled = true; });
          try {
            await FP.approvals.decide(a.id, ok, ok ? '' : why.value.trim());
            say(ok ? `${a.title} from ${a.userName || 'someone'} is approved and saved.` : `${a.title} from ${a.userName || 'someone'} is not approved: nothing was saved.`, 'info');
          } catch (e) { say(e.message); }
          await paintHome();
        };
        row.append(button('Approve', 'primary', decide(true)), button('Not approved', null, decide(false)), why);
        card.appendChild(row);
        box.appendChild(card);
      });
      return box;
    }
    /* A supervisor on a form: a note when something waits for them. */
    async function approvalsNote() {
      if (oneForm && !(await FP.users.can('supervisor'))) return;
      if (!(await FP.users.can('supervisor'))) return;
      const n = (await FP.approvals.list(FP.identity.site).catch(() => [])).length;
      if (!n || notice.children.length) return;
      say(`${n} waiting for your approval.`, 'info', oneForm ? null : button('See them', null, () => goHome()));
    }

    /* This terminal's ID and site (admins): kept on this machine. */
    function terminalPart() {
      const box = el('details', 'fpl-card quiet fpl-this');
      box.appendChild(el('summary', null, `This terminal: ${FP.identity.terminalId} at ${FP.identity.site}`));
      const row = el('div', 'fpl-row');
      const ss = el('select');
      FP.sites.list().then(sites => sites.filter(x => x.active).forEach(x => { const o = el('option', null, `${x.name} (${x.id})`); o.value = x.id; o.selected = x.id === FP.identity.site; ss.appendChild(o); })).catch(() => {});
      row.append(ss, button('Move it to this site', null, async () => {
        if (!ss.value || ss.value === FP.identity.site) return;
        if (!confirm(`Move ${FP.identity.terminalId} to ${ss.value}? It takes that site's forms from now on and leaves its group; what it saved keeps its old site.`)) return;
        try { if (place.group) await FP.groups.leave(FP.identity.terminalId); await FP.sites.assign(ss.value); location.reload(); } catch (e) { say(e.message); }
      }));
      row.appendChild(button('Change its ID…', null, async () => {
        if (!confirm(`Change ${FP.identity.terminalId}'s ID? What it already saved keeps ${FP.identity.terminalId}; its group and forms stay with the old ID.`)) return;
        await FP.startup.reassign({ title: 'Launcher' }); location.reload();
      }));
      box.appendChild(row);
      return box;
    }

    // A newer version was published: a launcher following latest reloads it (after the record is saved, if needed).
    let pendingReload = false;
    // Nothing opens before the terminal's settings are read and someone has signed in (0.50.1: a definitions
    // event during sign-in used to open the form behind the sign-in screen, before the terminal's forms were known).
    let started = false;
    window.addEventListener('fp-defs', () => {
      if (!started) return;
      if (!formId) { if (inst === null && FP.users) loadPlace().then(async () => { if (!formId) { await paintSide(); await paintHome(); } }).catch(() => {}); return; }
      if (pinned != null) { if (inst) FP.defs.version('form', formId, pinned).then(d => d && pinNotes(d)).catch(() => {}); return; }
      const doc = FP.defs.get('form', formId);
      if (doc && !inst) { openForm(); return; }
      if (!doc || !inst || doc.version === inst.version) return;
      if (!inst.isDirty()) { openForm(); return; }
      if (pendingReload) return;
      pendingReload = true;
      const b = button('Load it now (unsaved values are kept as a draft)');
      b.onclick = () => { pendingReload = false; openForm(); };
      say(`A new version of this form (v${doc.version}) was published.`, null, b);
    });
    window.addEventListener('fp-outbox', e => showOutbox(e.detail));
    homeBtn.onclick = () => goHome();

    // Print: the record on screen, or a blank form; with everything linked when the form opens others.
    printBtn.onclick = e => {
      e.stopPropagation();
      const old = document.querySelector('.fpl-menu');
      if (old) { old.remove(); return; }
      const m = el('div', 'fpl-menu');
      const item = (label, note, mode, tree) => {
        const b = el('button', null, label);
        b.appendChild(el('small', null, note));
        b.onclick = () => { m.remove(); if (inst) inst.print(mode, { tree }).catch(err => window.__fpReport('Print failed: ' + err.message)); };
        m.appendChild(b);
      };
      const tree = inst && inst.hasTree();
      item('Print this record', 'What is on the screen now', 'record', false);
      if (tree) item('Print this record with everything linked', 'Forms open over it and records linked to it, each on its own page', 'record', true);
      item('Print a blank form', 'For filling in by hand', 'blank', false);
      if (tree) item('Print a blank form with all its sub-forms', 'Every form it can open, each on its own page', 'blank', true);
      const r = printBtn.getBoundingClientRect();
      m.style.top = (r.bottom + 6) + 'px';
      m.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
      document.body.appendChild(m);
      setTimeout(() => document.addEventListener('click', () => m.remove(), { once: true }), 0);
    };

    // Whoever signs in decides what shows: home again, or the form if they may use it.
    async function afterSignIn() { await showUser(); await loadPlace(); if (formId) await openForm(); else await paintHome(); }
    async function signInAgain() { await loadPlace(); await FP.users.gate(gateOpts(titleText)); await afterSignIn(); }
    who.onclick = async () => {
      if (inst && inst.isDirty() && !confirm('Switch user? The values typed so far stay on this terminal as a draft.')) return;
      await FP.users.signOut('switched');
      await signInAgain();
    };

    FP.launcher.current = () => inst;   // the form on screen (for the update check and for testing)
    FP.launcher.home = () => goHome();  // back to the home screen, painted afresh (tests, and a page that wants it)
    return FP.startup.run({ title: 'Form' }).then(async ready => {
      term.textContent = `${ready.terminalId} · ${ready.site}`;
      // A test folder says so (0.53), so it is never taken for the real one.
      FP.folder.isTest().then(t => { if (t) { const tb = el('span', 'fpl-sim', 'TEST FOLDER'); tb.title = 'This data folder is marked as a test folder (Admin > Test folder)'; bar.insertBefore(tb, saved); } }).catch(() => {});
      // The test clock (0.62): how far ahead a rehearsal has put the time, and everything worked out again when it jumps.
      const clockChip = el('span', 'fpl-sim'); clockChip.id = 'testclock'; clockChip.hidden = true; bar.insertBefore(clockChip, saved);
      const showClock = () => { const o = FP.testClock ? FP.testClock.offset() : 0; clockChip.hidden = !o; clockChip.textContent = `Test clock ${FP.testClock ? FP.testClock.text() : ''} · ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`; };
      if (FP.testClock) { await FP.testClock.load().catch(() => {}); showClock(); setInterval(showClock, 15000); }
      window.addEventListener('fp-testclock', () => { showClock(); FP.current.clearCache(); if (FP.due && FP.due.poke) FP.due.poke(); });
      // A rehearsal (0.62, test folders only): launch.html?as=USER signs that person in without their PIN, while the
      // rehearsal allows it (Admin › Test folder › Rehearsal).
      const as = new URLSearchParams(location.search).get('as');
      if (as && FP.users.rehearsalSignIn) await FP.users.rehearsalSignIn(as).catch(e => say(e.message, 'bad'));
      if (shortcut) {
        const sc = await FP.launchers.get(shortcut).catch(() => null);
        if (!sc) {
          setTitle('Shortcut');
          host.replaceChildren(el('div', 'fpl-err', `There is no shortcut named ${shortcut}: it may have been removed. Open launch.html and pick the form on the home screen, or ask an admin for a new shortcut.`));
          return { instance: () => null, home: () => {}, open: () => {} };
        }
        formId = sc.form;
        pinned = sc.version == null || sc.version === 'latest' ? null : goodVersion(sc.version);
        if (sc.version != null && sc.version !== 'latest' && pinned == null) badVersion = String(sc.version);
        titleText = formId;
      }
      await FP.defs.load();
      await loadPlace();
      if (formId) setTitle(formTitle(formId)); else setTitle(place.group ? place.group.name : 'Forms');
      await FP.users.gate(gateOpts(formId ? formTitle(formId) : `Sign in at ${ready.terminalId}`));
      await showUser();
      showOutbox();
      FP.defs.watch();
      FP.users.watchIdle(() => (place && place.signedInFor) || 15, () => signInAgain());   // the group's setting (0.46)
      // "Not you?" under a form's save buttons: switch who is signed in, as the bar's name button does.
      window.addEventListener('fp-switch-user', () => who.onclick());
      if (FP.users.watchSignIn) FP.users.watchSignIn(async u => { if (!u) await signInAgain(); else await afterSignIn(); });
      started = true;
      if (formId) await openForm(); else await goHome();
      if (badVersion != null) say(`"${badVersion}" isn't a version number (a whole number, 1 or more), so the latest version is shown. Ask for a new shortcut if you meant a particular version.`, 'info');
      // What this terminal's forms are due (0.54): worked out once a minute; misses are recorded as they happen.
      if (FP.due && !oneForm) FP.due.watch(() => ({ group: place.group, forms: place.forms }));
      // A new release of the platform: reload onto it once nothing unsaved is on screen.
      if (FP.updates) FP.updates.watch({
        isSafe: () => !inst || (!inst.isDirty() && !(inst.waiting && inst.waiting().length) && FP.outbox.status().state !== 'writing'),
        onReady: (v, newer) => say(`${newer ? 'An update' : 'A change of version'} (${v}) is ready. This page reloads by itself as soon as nothing unsaved is on screen.`, 'info'),
      });
      return { instance: () => inst, home: () => goHome(), open: id => pick(id) };
    }).catch(e => window.__fpReport('Startup failed: ' + (e.message || e)));
  }

  /* ---------- Launcher files ---------- */
  const escHtml = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  /* launch.html, at the top of the data folder: the one launcher every terminal opens (0.41). */
  function homeHtml() {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Forms</title>
<!-- The launcher every terminal opens: its home screen shows the forms of the terminal and who signs in.
     Written by the Form Platform when a release is installed; don't edit. -->
<script>
${preamble('Check the runtime folder (next to this file) has finished syncing.')}
</script>
<script>window.FP_PAGE = 'launcher';</script>
</head>
<body>
<script src="runtime/releases.js"></script>
<script src="runtime/boot.js"></script>
<script>if (!window.__fpBootRetrying && window.FP && FP.launcher) FP.launcher.start();</script>
</body>
</html>
`;
  }

  const NAME_RE = /^[a-z][a-z0-9-]{0,60}$/;
  const LIST = 'launchers.json';
  const nameFor = (formId, version) => `${formId}${version == null || version === 'latest' ? '' : '-v' + version}`;
  const addressOf = name => `launch.html?launcher=${name}`;

  async function requirePublisher() {
    if (FP.users && !(await FP.users.can(FP.defs.publishRole))) throw new Error('Only a publisher or an admin can make shortcuts.');
  }
  async function readList() {
    const d = await FP.files.readJson(LAUNCHERS, LIST).catch(() => null);
    return d && d.fp === 'launchers' && Array.isArray(d.list) ? d.list.filter(x => x && NAME_RE.test(x.name || '') && x.form) : [];
  }
  const writeList = list => FP.files.writeJson(LAUNCHERS, LIST, { fp: 'launchers', v: 1, list: list.slice().sort((a, b) => a.name.localeCompare(b.name)) });

  /* What an older launcher file says, read back: { form, version, made, by }. */
  function parseOld(text) {
    const m = /window\.FP_LAUNCH = (\{[^\n]*\});/.exec(text || '');
    try { return m ? JSON.parse(m[1]) : null; } catch (_) { return null; }
  }
  /* An older launcher file, once its shortcut is on the list: a page that goes straight on to the shortcut. */
  function stubHtml(name) {
    const to = `../${addressOf(name)}`;
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${escHtml(to)}">
<title>${escHtml(name)}</title>
<!-- Launcher files are gone (0.48): this goes on to the shortcut ${escHtml(name)}. Point the Windows shortcut at
     launch.html?launcher=${escHtml(name)} instead, then remove this file in Admin > Launchers. -->
</head>
<body><p><a href="${escHtml(to)}">Open ${escHtml(name)}</a></p></body>
</html>
`;
  }

  FP.launchers = {
    KERNEL,
    VERSION,
    preamble,
    homeHtml,
    addressOf,
    /* Write launch.html at the top of the data folder. */
    async makeHome() {
      await requirePublisher();
      await FP.files.writeText([], 'launch.html', homeHtml());
      return 'launch.html';
    },
    /* One shortcut by name, or null. */
    async get(name) {
      return (await readList()).find(x => x.name === name) || null;
    },
    /* Add (or replace) a shortcut to a form: the latest version, or pinned to one. Returns its name. */
    async make(formId, opts) {
      opts = opts || {};
      await requirePublisher();
      const doc = FP.defs.get('form', formId);
      if (!doc || doc.retired) throw new Error(`No published form named ${formId}.`);
      if (!doc.def.launchable) throw new Error(`Form ${formId} isn't launchable. Set launchable: true on it first.`);
      const version = opts.version == null || opts.version === 'latest' ? 'latest' : Number(opts.version);
      if (version !== 'latest' && !(await FP.defs.version('form', formId, version))) throw new Error(`Form ${formId} has no version ${version}.`);
      const name = opts.name || nameFor(formId, version);
      if (!NAME_RE.test(name)) throw new Error('A shortcut name uses lowercase letters, digits and -.');
      const user = FP.users ? await FP.users.current() : null;
      const list = (await readList()).filter(x => x.name !== name);
      list.push({ name, form: formId, version, made: new Date().toISOString(), by: opts.by || (user ? user.name : null) });
      await writeList(list);
      return name;
    },
    /* The shortcuts, with their address and whether their form is still there; older launcher files too. */
    async list() {
      const out = [];
      for (const x of await readList()) {
        const doc = FP.defs.get('form', x.form);
        out.push(Object.assign({}, x, { address: addressOf(x.name),
          problem: !doc ? `form ${x.form} is not published` : doc.retired ? `form ${x.form} is retired` : !doc.def.launchable ? `form ${x.form} is no longer launchable` : null }));
      }
      const names = (await FP.files.list(LAUNCHERS).catch(() => [])).filter(n => n.endsWith('.html'));
      for (const n of names) {
        const old = parseOld(await FP.files.readText(LAUNCHERS, n).catch(() => ''));
        out.push({ name: n, file: true, form: old && old.form, version: old && old.version, made: old && old.made, by: old && old.by,
          problem: old ? 'an older launcher file: installing a release puts it on the list' : `an older file: point shortcuts at ${addressOf(n.replace(/\.html$/, ''))}, then remove it` });
      }
      return out;
    },
    async remove(name) {
      await requirePublisher();
      if (/\.html$/.test(name)) { if (!/^[a-z][a-z0-9-]{0,60}\.html$/.test(name)) throw new Error('Not a launcher file name.'); return FP.files.remove(LAUNCHERS, name); }
      await writeList((await readList()).filter(x => x.name !== name));
    },
    /* Installing a release (0.48): each older launcher file goes on the list, and the file goes on to its shortcut. */
    async convertOld() {
      const list = await readList();
      const done = [];
      for (const n of (await FP.files.list(LAUNCHERS).catch(() => [])).filter(x => x.endsWith('.html'))) {
        const old = parseOld(await FP.files.readText(LAUNCHERS, n).catch(() => ''));
        if (!old || !old.form) continue;
        const name = n.replace(/\.html$/, '');
        if (!NAME_RE.test(name)) continue;
        if (!list.some(x => x.name === name)) list.push({ name, form: old.form, version: old.version == null ? 'latest' : old.version, made: old.made || null, by: old.by || null });
        await FP.files.writeText(LAUNCHERS, n, stubHtml(name));
        done.push(name);
      }
      if (done.length) await writeList(list);
      return done;
    },
  };

  FP.launcher = { start };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-launcher'] = '0.63.1';
})();
