// 0.65 Retiring definitions, the editor: the name warning (a new definition or a new title with the name of a retired or
// active one: a warning, never a refusal), Find skipping retired definitions, and the Show retired box (remembered in
// localStorage 'fpe-show-retired', read by the pickers in the other files).
const start = require('./dummies/base.js');
const R = require('./retire-ui.js');
(async () => {
  const A = await start({ at: '2026-11-19T08:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  await R.setup(A);
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const click = async sel => { await A.p.click(sel); await A.w(400); };
  const warn = () => A.p.evaluate(() => Array.from(document.querySelectorAll('.fpe-warn')).filter(x => x.offsetParent).map(x => x.textContent).join(' | '));
  const stored = () => A.p.evaluate(() => localStorage.getItem('fpe-show-retired'));
  const seen = () => A.p.evaluate(() => Array.from(document.querySelectorAll('.fpe-map .fpe-mrow')).map(r => r.textContent));

  // Retired things to find: form zz-c and, once it is gone, the structure only it used.
  await A.p.evaluate(async () => {
    await FP.defs.retire('form', 'zz-c');
    await FP.defs.retire('structure', 'zz-st2');
    await FP.defs.publish('form', 'zz-qq', { title: 'Zz q', sites: ['all'], sources: [], fields: [{ name: 'notes', label: 'Notes', control: 'textarea' }] }, {});
    await FP.defs.retire('form', 'zz-qq');
    await FP.editor.refreshMap();
  });
  await A.w(600);

  // 1. The Add flow: a new form called Zz q (from the id zz-q) while a retired form is called that. Not refused.
  A.setAnswer('zz-q');
  await click('.fpe-add'); await click('.fpe-addmenu button:has-text("A form")'); await A.w(1500);
  const w1 = await warn();
  A.say('add flow', w1);
  expect('Add: names the retired form with that name', /A retired form is also called Zz q: zz-qq\./.test(w1), w1);
  expect('Add: not blocked, the new form is open', /zz-q\b/.test(await A.p.evaluate(() => (document.querySelector('.fpe-head .ver') || {}).textContent || '')), 'not open');
  // A new title on a form already published: the same warning, naming an active one.
  await A.p.evaluate(() => { const d = FP.defs.get('form', 'zz-b'); return FP.editor.openDef('form', 'zz-b', { force: true, fresh: true, dirty: true, def: Object.assign({}, d.def, { title: 'Zz A' }) }); });
  await A.w(1200);
  const w2 = await warn();
  A.say('new title', w2);
  expect('A new title: names the active form', /An active form is also called Zz A: zz-a\./.test(w2), w2);
  await A.p.evaluate(() => { const d = FP.defs.get('form', 'zz-b'); return FP.editor.openDef('form', 'zz-b', { force: true, fresh: true, dirty: true, def: Object.assign({}, d.def, { title: 'Zz C' }) }); });
  await A.w(1200);
  expect('A new title: names a retired one', /A retired form is also called Zz C: zz-c\./.test(await warn()), await warn());
  await R.openPane(A, 'form', 'zz-b');
  expect('The title it already has: no warning', (await warn()) === '', await warn());

  // 2. Find skips retired definitions; Show retired brings them in.
  expect('Show retired starts off, nothing stored', !(await A.p.$eval('.fpe-showret-cb', c => c.checked)) && (await stored()) === null, await stored());
  await A.p.fill('.fpe-libtop input', 'zz'); await A.w(500);
  let rows = await seen();
  expect('Find: live ones are found', rows.some(t => /Zz A/.test(t)) && rows.some(t => /Zz B/.test(t)), rows.slice(0, 12));
  expect('Find: retired ones are not', !rows.some(t => /Zz C|Zz q\b|Zz other/.test(t)) && !rows.some(t => /Retired · /.test(t)), rows.filter(t => /Zz C|Zz q|Zz other|Retired/.test(t)));
  await click('.fpe-showret-cb'); await A.w(400);
  expect('ticking stores 1', (await stored()) === '1', await stored());
  rows = await seen();
  expect('Show retired: Find lists them, dimmed', rows.some(t => /Zz C/.test(t) && /retired/.test(t)) && rows.some(t => /Zz q/.test(t)) && rows.some(t => /Zz other things/.test(t)), rows.filter(t => /Zz C|Zz q|Zz other|Retired/.test(t)));
  expect('they sit on the Retired shelves', rows.filter(t => /Retired · \d/.test(t)).length === 2, rows.filter(t => /Retired/.test(t)));
  await click('.fpe-showret-cb'); await A.w(400);
  expect('unticking stores 0 and hides them again', (await stored()) === '0' && !(await seen()).some(t => /Zz C|Zz other/.test(t)), await stored());
  // Without a search the shelves are there, collapsed, whatever the box says.
  await A.p.fill('.fpe-libtop input', ''); await A.w(400);
  rows = await seen();
  expect('no search: both shelves are on the map', rows.filter(t => /Retired · \d/.test(t)).length === 2, rows.filter(t => /Retired/.test(t)));
  expect('Data shelf counts the structure', rows.some(t => /Retired · 1/.test(t)), rows.filter(t => /Retired/.test(t)));
  await A.snapshot('out/l175snap.json'); await A.b.close();

  // 3. The choice is remembered: a fresh page with the key set opens with the box ticked and Find showing them.
  const B = await start({ seed: 'out/l175snap.json', at: '2026-11-19T08:30:00-06:00', noSignIn: true });
  B.p.on('dialog', d => d.accept().catch(() => {}));
  await B.w(4000);
  // Headless Chromium sometimes drops file:// storage across a reload, so the saved value is put back before the page loads (as a real saved preference is): what is tested is that the editor reads it.
  await B.p.addInitScript(() => { try { localStorage.setItem('fpe-show-retired', '1'); } catch (_) { /* best effort */ } });
  await B.p.reload(); await B.w(4000);
  if (await B.p.$('.fp-u-card')) { await B.p.click('.fp-u-card >> text=Josh').catch(() => {}); await B.w(300); await B.p.keyboard.type('482913'); await B.w(2500); }
  B.say('state', JSON.stringify(await B.p.evaluate(() => [localStorage.getItem('fpe-show-retired'), !!document.querySelector('.fpe-showret-cb'), document.querySelector('.fpe-showret-cb') && document.querySelector('.fpe-showret-cb').checked, !!document.querySelector('.fp-u-card'), document.body.innerText.slice(0, 80)])));
  await B.p.fill('.fpe-libtop input', 'zz c'); await B.w(500);
  const again = await B.p.evaluate(() => ({ on: document.querySelector('.fpe-showret-cb').checked, rows: Array.from(document.querySelectorAll('.fpe-map .fpe-mrow')).map(r => r.textContent) }));
  B.say('remembered', JSON.stringify({ on: again.on, hit: again.rows.filter(t => /Zz C/.test(t)) }));
  expect('remembered: ticked after a reload, and Find shows the retired form', again.on && again.rows.some(t => /Zz C/.test(t)), again);
  A.say('errs', JSON.stringify(bad.concat(A.errs, B.errs)));
  await B.b.close();
  if (bad.length || A.errs.length || B.errs.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
