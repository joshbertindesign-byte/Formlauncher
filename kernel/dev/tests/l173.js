// 0.65 Retiring definitions, the editor: Retire from a definition's pane (blocked: each blocker and its fix, the button off;
// free: what only it uses, ticked by hand, a replacement, a note), the Retired shelf on the map with its count and "replaced by",
// the retired banner, and Reinstate for an admin (refused while something it needs is retired).
const start = require('./dummies/base.js');
const R = require('./retire-ui.js');
(async () => {
  const A = await start({ at: '2026-11-19T08:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  await R.setup(A);
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const state = (kind, id) => A.p.evaluate(([k, i]) => { const d = FP.defs.get(k, i); return d ? (d.retired ? 'retired' : 'active') : 'none'; }, [kind, id]);
  const click = async sel => { await A.p.click(sel); await A.w(400); };

  // 1. Blocked: zz-a is opened by zz-opener.
  await R.openPane(A, 'form', 'zz-a');
  expect('Retire and Duplicate are offered to a publisher', !!(await A.p.$('.fpe-retire-btn')) && !!(await A.p.$('.fpe-dup-btn')), 'missing');
  await click('.fpe-retire-btn');
  const blocked = await R.dlgText(A);
  A.say('blocked', JSON.stringify(blocked));
  expect('blocked: names the blocker', blocked && /Zz Opener/.test(blocked) && /form zz-opener/.test(blocked), blocked);
  expect('blocked: gives the fix', /Retire form Zz Opener first, or take the Zz A form out of it/.test(blocked || ''), blocked);
  expect('blocked: Retire is disabled', await A.p.$eval('.fpe-retire-go', b => b.disabled), 'enabled');
  expect('no Retire anyway', !/anyway|force/i.test(blocked || ''), blocked);
  await A.p.keyboard.press('Escape'); await A.w(200);
  expect('Escape closes the dialog', !(await A.p.$('.fpe-dlg')), 'still open');
  expect('nothing retired', (await state('form', 'zz-a')) === 'active', 'retired');
  // A structure many forms use is blocked too.
  await R.openPane(A, 'structure', 'zz-st');
  await click('.fpe-retire-btn');
  const bs = await R.dlgText(A);
  expect('structure blocked: names its forms', ['Zz A', 'Zz B', 'Zz Opener'].every(n => (bs || '').includes(n)), bs);
  await A.p.keyboard.press('Escape'); await A.w(200);

  // 2. Free: zz-opener. What only it uses is offered, unticked; tick the form, leave the function; replaced by zz-b.
  await R.openPane(A, 'form', 'zz-opener');
  await click('.fpe-retire-btn');
  const free = await A.p.evaluate(() => ({ text: document.querySelector('.fpe-dlg').innerText, boxes: Array.from(document.querySelectorAll('.fpe-dlg input[type=checkbox]')).map(c => ({ v: c.value, on: c.checked })),
    replaced: Array.from(document.querySelectorAll('.fpe-dlg select option')).map(o => o.value), disabled: document.querySelector('.fpe-retire-go').disabled }));
  A.say('free', JSON.stringify(free));
  expect('free: the checklist heading', /Also retire what only this uses/.test(free.text), free.text);
  expect('free: what only it uses, all unticked', free.boxes.map(b => b.v).sort().join() === 'form/zz-a,function/ZzOnly' && free.boxes.every(b => !b.on), free.boxes);
  expect('free: Replaced by lists the other forms, not itself', free.replaced.includes('zz-b') && free.replaced.includes('zz-c') && !free.replaced.includes('zz-opener'), free.replaced);
  expect('free: Retire is on', !free.disabled, free);
  await A.p.check('.fpe-dlg input[value="form/zz-a"]');
  await A.p.selectOption('.fpe-dlg select', 'zz-b');
  await A.p.fill('.fpe-dlg input[placeholder^="Why"]', 'Replaced by the new one');
  await click('.fpe-retire-go'); await A.w(1200);
  const t1 = await R.toastText(A);
  A.say('toast', t1);
  expect('says what was retired', /Retired form Zz Opener together with Zz A/.test(t1) && /Replaced by Zz B/.test(t1), t1);
  expect('opener, zz-a retired; the function stays', (await state('form', 'zz-opener')) === 'retired' && (await state('form', 'zz-a')) === 'retired' && (await state('function', 'ZzOnly')) === 'active', 'states');
  const doc = await A.p.evaluate(() => { const d = FP.defs.get('form', 'zz-opener'); return { sup: d.supersededBy, note: d.note }; });
  expect('supersededBy and note kept', doc.sup === 'zz-b' && /Replaced by the new one/.test(doc.note), doc);

  // 3. The Retired shelf on the map.
  await A.p.evaluate(() => FP.editor.refreshMap()); await A.w(700);
  const shelf = await A.p.evaluate(() => Array.from(document.querySelectorAll('.fpe-map .fpe-mrow')).filter(r => /Retired · \d+/.test(r.textContent)).map(r => r.textContent.trim()));
  A.say('shelves', JSON.stringify(shelf));
  expect('the Forms shelf counts 2 and nothing else is counted', shelf.length === 1 && /Retired · 2/.test(shelf[0]), shelf);
  const live = () => A.p.evaluate(() => Array.from(document.querySelectorAll('.fpe-map .fpe-mrow:not(.dim)')).map(r => r.textContent).filter(t => /Zz Opener|Zz A\b/.test(t)).length);
  expect('retired forms are not in the live lists', (await live()) === 0, await live());
  await click('.fpe-map .fpe-mrow:has-text("Retired · 2")');
  const rows = await A.p.evaluate(() => Array.from(document.querySelectorAll('.fpe-map .fpe-mrow.dim')).map(r => r.textContent));
  A.say('shelf rows', JSON.stringify(rows));
  expect('the shelf unfolds to the retired forms, dimmed and tagged retired', rows.some(t => /Zz Opener/.test(t) && /retired/.test(t)) && rows.some(t => /Zz A/.test(t)), rows);
  expect('the replaced form says replaced by', rows.some(t => /Zz Opener.*replaced by Zz B/.test(t)), rows);
  // Open the retired row: its pane has the banner, no Retire button, no publish bar.
  await click('.fpe-map .fpe-mrow.dim:has-text("Zz Opener")'); await A.w(900);
  const pane = await A.p.evaluate(() => ({ banner: (document.querySelector('.fpe-retired') || {}).innerText || '', retire: !!document.querySelector('.fpe-retire-btn'), reinstate: !!document.querySelector('.fpe-reinstate-btn'), foot: document.querySelector('.fpe-foot') && !document.querySelector('.fpe-foot').offsetParent }));
  A.say('banner', JSON.stringify(pane.banner));
  expect('banner: retired, by whom, replaced by', /Retired/.test(pane.banner) && /Josh/.test(pane.banner) && /Replaced by Zz B/.test(pane.banner), pane.banner);
  expect('no Retire on a retired definition; Reinstate for an admin; no publish bar', !pane.retire && pane.reinstate && pane.foot, pane);

  // 4. Reinstate (admin): refused while zz-a, which it opens, is retired; shows the refusal text.
  await click('.fpe-reinstate-btn'); await A.w(800);
  const refused = await A.p.evaluate(() => (document.querySelector('.fpe-retired .err') || {}).textContent || '');
  A.say('refused', refused);
  expect('reinstate refusal text shown', /zz-a, which is retired/.test(refused), refused);
  expect('still retired', (await state('form', 'zz-opener')) === 'retired', 'state');
  await R.openPane(A, 'form', 'zz-a');
  await click('.fpe-reinstate-btn'); await A.w(1200);
  expect('zz-a reinstated', (await state('form', 'zz-a')) === 'active', await state('form', 'zz-a'));
  await R.openPane(A, 'form', 'zz-opener');
  await click('.fpe-reinstate-btn'); await A.w(1200);
  expect('then the opener', (await state('form', 'zz-opener')) === 'active', await state('form', 'zz-opener'));
  expect('the pane is the live one again', !!(await A.p.$('.fpe-retire-btn')) && !(await A.p.$('.fpe-retired')), 'banner');
  A.say('errs', JSON.stringify(bad.concat(A.errs)));
  await A.b.close();
  if (bad.length || A.errs.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
