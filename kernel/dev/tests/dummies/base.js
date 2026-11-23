const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
// The kernel these tests run against: the checkout they sit in (a worktree runs its own copy).
const ROOT = path.resolve(__dirname, '../../..');
const SP = ROOT + '/dev/tests/';
const here = u => String(u).replace('file:///home/claude/kernel/', 'file://' + ROOT + '/');
const FAKE = fs.readFileSync(SP + 'fake3.js', 'utf8').match(/const FAKE = `([\s\S]*?)`;/)[1]
  .replace("window.__memkv = {", "window.__kvDump = () => Array.from(mem.entries()).map(([k, v]) => [k, v === window.__root ? '__ROOT__' : v]); window.__memkv = {");
module.exports = async function start(opts = {}) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1366, height: 860 }, deviceScaleFactor: opts.scale || 1 });
  const go = p.goto.bind(p); p.goto = (u, o) => go(here(u), o);
  // The form editor's outline is in tabs (0.58): a row asked for by its key is looked for on each tab in turn.
  const showRow = async sel => {
    const m = /\.ffm-r\[data-key="([^"]+)"\]/.exec(sel);
    if (!m) return;
    const found = await p.evaluate(k => {
      const has = () => !!document.querySelector(`.ffm-r[data-key="${CSS.escape(k)}"]`);
      if (has() || !document.querySelector('.ffe3-tab')) return true;
      const first = /^(s:|id:|v:|\+v:|\+s$|r:)/.test(k) ? 'data' : /^(f:|\+f$)/.test(k) ? 'fields' : 'form';
      const order = [first].concat(['fields', 'data', 'form'].filter(t => t !== first));
      return order.find(t => { const b = document.querySelector(`.ffe3-tab[data-tab="${t}"]`); if (b) b.click(); return has(); }) || false;
    }, m[1]).catch(() => false);
    if (found) await new Promise(r => setTimeout(r, 150));
  };
  for (const fn of ['click', '$eval', 'fill']) { const orig = p[fn].bind(p); p[fn] = async (sel, ...rest) => { await showRow(String(sel)); return orig(sel, ...rest); }; }
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let answer = null; p.on('dialog', d => { const a = answer; answer = null; a != null ? d.accept(a) : d.accept(); });
  await p.addInitScript(FAKE);
  // The map's Structures, Formulas and Forms headings start closed (0.53.1); the tests find rows in them, so open them.
  // The map folds while a form is open (0.58); the older tests click it with a form open, so it stays unless asked.
  if (!opts.foldForms) await p.addInitScript(() => { try { localStorage.setItem('fpe-fold-forms', '0'); } catch (_) { /* no storage */ } });
  await p.addInitScript(() => { try { if (!localStorage.getItem('fpe-map-open')) localStorage.setItem('fpe-map-open', JSON.stringify({ 'head:structures': true, 'head:functions': true, 'head:forms': true, 'head:data': true, formulas: true, 'kind:builtin': true })); } catch (_) { /* no storage */ } });
  if (opts.seed) {
    let seed = fs.readFileSync(opts.seed, 'utf8');
    // A launcher on another device: leave out kv keys of the device that made the seed (its sign-ins).
    if (opts.dropKv) { const S = JSON.parse(seed); S.kv = S.kv.filter(([k]) => !opts.dropKv.includes(k)); seed = JSON.stringify(S); }
    await p.addInitScript(`(() => { const S = ${seed};
      const put = async (dir, tree) => { for (const [n, v] of Object.entries(tree)) { if (typeof v === 'string') { const fh = await dir.getFileHandle(n, { create: true }); const w = await fh.createWritable(); await w.write(v); await w.close(); } else await put(await dir.getDirectoryHandle(n, { create: true }), v); } };
      window.__seeded = put(window.__root, S.files);
      for (const [k, v] of S.kv) window.__memkv.set(k, v === '__ROOT__' ? window.__root : v);
      const g = window.__memkv.get; window.__memkv.get = async k => { await window.__seeded; return g(k); };
    })();`);
  }
  await p.route('**/fp-core.js', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(ROOT + '/fp-core.js', 'utf8').replace('FP.kv = {', 'FP.kv = window.__memkv || {') }));
  // A fixed start time (the pilot's snapshot is made before its scenarios' dates, whatever day it runs).
  if (opts.at) { await p.clock.install({ time: new Date(opts.at) }); await p.clock.resume(); }
  await p.goto('file:///home/claude/kernel/editor.html' + (opts.query || ''));
  const w = ms => p.waitForTimeout(ms);
  if (!opts.seed) {
    await p.click('text=Choose data folder'); await w(400);
    // 0.41: the editor is the terminal Editor, with no ID or site to set up
    if (await p.$('text=Save terminal ID')) { await p.fill('.fp-gate-card input', 'T01'); await p.click('text=Save terminal ID'); await require(SP + 'site-step.js')(p, 'HOU', 'Houston'); }
    await p.fill('.fp-u-card input', 'Josh'); await p.click('text=Continue'); await w(200);
    await p.keyboard.type('482913'); await w(900); await p.keyboard.type('482913'); await w(1500);
  } else if (!opts.noSignIn) {
    await w(2000);
    if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh').catch(() => {}); await w(300); await p.keyboard.type('482913'); await w(1500); }
  }
  const snapshot = async file => {
    const S = await p.evaluate(async () => {
      const walk = async dir => { const o = {}; for await (const [n, h] of dir.entries()) o[n] = h.kind === 'file' ? await (await h.getFile()).text() : await walk(h); return o; };
      const kv = []; return { files: await walk(window.__root), kv };
    });
    S.kv = await p.evaluate(() => window.__kvDump ? window.__kvDump() : []);
    fs.writeFileSync(file, JSON.stringify(S));
  };
  const rows = () => p.$$eval('.ffm-r', l => l.map(r => r.dataset.key + (r.querySelector('.ffm-mark') ? r.querySelector('.ffm-mark').textContent : '') + '=' + (r.querySelector('.t') || r).textContent + ' (' + ((r.querySelector('.d') || {}).textContent || '') + ')').join('\n  '));
  const props = () => p.$eval('.ffm-props', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '(no props)');
  const say = (k, v) => console.log(k.padEnd(9), ':', v);
  const add = async (kind, name) => { answer = name; await p.click('.fpe-add'); await w(300); await p.click(`.fpe-addmenu button:has-text("${kind}"), button:has-text("${kind}")`); await w(1500); };
  return { snapshot, b, p, w, errs, rows, props, say, add, setAnswer: a => { answer = a; }, SP };
};

module.exports.ROOT = ROOT;
module.exports.here = here;
