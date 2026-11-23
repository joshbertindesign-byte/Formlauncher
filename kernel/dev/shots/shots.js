// The screenshot harness for the UI refresh: opens every key screen against the Test pack's demo data and saves one labelled PNG each.
//   node dev/shots/shots.js [outDir] [day|night]      (default: dev/shots/out, day)
// The data is the Test pack (made-up) plus a few needs, so the boards are not empty. The page clock, the window size and the
// data are fixed, so two runs on the same code give the same pixels; compare.js then reports what changed.
const path = require('path'), fs = require('fs');
const start = require('../tests/dummies/base.js');
const siteStep = require('../tests/site-step.js');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, 'out'));
const MODE = process.argv[3] || 'day';
const PACK = fs.readFileSync(path.join(__dirname, '../packs/test-pack/test-pack.json'), 'utf8');
const AT = '2026-11-19T08:30:00-06:00';
fs.mkdirSync(OUT, { recursive: true });
const failed = [];

// Set the theme the way the product will (a per-terminal preference); before 0.64 nothing reads it and every shot is Day.
const withTheme = p => p.addInitScript(m => { try { localStorage.setItem('fp-theme', m); } catch (_) { /* best effort */ } }, MODE);
const shot = async (p, name, note) => {
  try { await p.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false }); console.log('shot', name.padEnd(22), note || ''); }
  catch (e) { failed.push(`${name}: ${e.message}`); console.error('FAILED', name, e.message); }
};

(async () => {
  // 1. Build the demo folder in the editor, take the editor shots, then save the folder for the launcher pages.
  const A = await start({ at: AT });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  await withTheme(A.p);
  await A.p.evaluate(async pack => {
    await FP.folder.handle.getFileHandle('THIS IS A TEST FOLDER.txt', { create: true });
    await FP.packs.install(FP.packs.read(pack));
    const needs = [['N-DEMO-1', 'Line 1', '101 ACME', 'White', 3, 'Normal'], ['N-DEMO-2', 'Line 1', '106 NORTHWIND', 'Almond', 2, 'High'], ['N-DEMO-3', 'Line 2', '113 GLOBEX', 'Brown', 5, 'Normal']];
    for (const [id, line, profile, color, racks, priority] of needs) {
      const prof = profile.split(' ');
      await FP.entry.record({ entry: 'needs.create', item: { structure: 'needs', id }, form: { id: 'needs', version: 1 }, values: { line, profile, part: prof[0], customer: prof[1], color, racks, priority } });
    }
    if (FP.outbox) await FP.outbox.flush();
    FP.current.clearCache();
  }, PACK);
  await A.w(3000);   // no reload: the demo folder lives in this page's memory
  await shot(A.p, '01-editor-map', 'the editor, the map');
  await A.p.evaluate(() => FP.editor.openDef('form', 'needs')); await A.w(3000);
  await shot(A.p, '02-editor-form', 'the form editor (Add a need)');
  await A.p.evaluate(() => FP.editor.openDef('structure', 'racks')); await A.w(3000);
  await shot(A.p, '03-editor-structure', 'the structure editor (Racks)');
  await A.p.click('.fpe-adminbtn:not(.fpe-helpbtn)').catch(() => {}); await A.w(2000);
  await shot(A.p, '04-admin', 'Admin');
  await A.p.click('.fpe-helpbtn').catch(() => {}); await A.w(2000);
  await shot(A.p, '05-help', 'Help');
  await A.snapshot(path.join(OUT, 'shots-seed.json')); await A.b.close();

  // 2. The launcher on a line terminal (T01, kiosk) and the QC office (T02, admin view), signed in as the admin.
  const launcher = async (term, label, steps) => {
    const { b, p, w } = await start({ seed: path.join(OUT, 'shots-seed.json'), at: '2026-11-19T08:45:00-06:00', noSignIn: true, dropKv: ['openSessions'] });
    p.on('dialog', d => d.accept().catch(() => {}));
    await withTheme(p);
    await p.goto('file:///home/claude/kernel/launcher.html'); await w(3000);
    if (await p.$('text=Save terminal ID')) { await p.fill('.fp-gate-card input', term); await p.click('text=Save terminal ID'); await siteStep(p, 'TST', 'Test Plant'); await w(2500); }
    if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh').catch(() => {}); await w(300); await p.keyboard.type('482913'); await w(4500); }
    await steps(p, w);
    await b.close();
  };
  await launcher('T01', 'line', async (p, w) => {
    await shot(p, '06-launcher-line', 'T01 home: the line board and form cards');
    await p.click('.fpl-tile[data-form="rack"]').catch(() => {}); await w(3000);
    await shot(p, '07-launcher-form', 'T01 the Rack form');
  });
  await launcher('T02', 'office', async (p, w) => {
    await shot(p, '08-launcher-office', 'T02 admin view: the needs board');
    await p.click('#side button[data-form="production-report"]').catch(() => {}); await w(3500);
    await shot(p, '09-dashboard', 'the production report (charts and tables)');
    await p.click('#side button[data-form="needs"]').catch(() => {}); await w(3000);
    await shot(p, '10-launcher-needs', 'T02 Add a need');
  });
  console.log(failed.length ? `${failed.length} shot(s) failed` : `done: ${fs.readdirSync(OUT).filter(f => f.endsWith('.png')).length} screenshots in ${OUT}`);
  if (failed.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
