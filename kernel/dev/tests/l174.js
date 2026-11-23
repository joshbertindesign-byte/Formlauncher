// 0.65 Retiring definitions, the editor: who sees what (a publisher who is not an admin retires but sees no Reinstate; a
// supervisor sees neither Retire nor Duplicate), and Duplicate as new form (id refusals, Share or Copy for each structure and
// function, the new form opens, what was copied is shown).
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
  const has = sel => A.p.$(sel).then(x => !!x);

  // A publisher who is not an admin retires zz-c, and sees the banner without Reinstate.
  await R.signInAs(A, 'Pat Publisher', ['publisher']);
  await R.openPane(A, 'form', 'zz-c');
  expect('publisher: Retire and Duplicate offered', (await has('.fpe-retire-btn')) && (await has('.fpe-dup-btn')), 'missing');
  await click('.fpe-retire-btn');
  expect('free form: a Replaced by picker', /Replaced by \(optional\)/.test(await R.dlgText(A)), await R.dlgText(A));
  await click('.fpe-retire-go'); await A.w(1200);
  expect('publisher retired it', (await state('form', 'zz-c')) === 'retired', await state('form', 'zz-c'));
  const pane = await A.p.evaluate(() => ({ banner: (document.querySelector('.fpe-retired') || {}).innerText || '', reinstate: !!document.querySelector('.fpe-reinstate-btn'), retire: !!document.querySelector('.fpe-retire-btn') }));
  A.say('publisher banner', JSON.stringify(pane.banner));
  expect('publisher sees the retired banner', /Retired/.test(pane.banner) && /Pat Publisher/.test(pane.banner), pane.banner);
  expect('publisher sees no Reinstate, and a line saying an admin can', !pane.reinstate && /An admin can reinstate it/.test(pane.banner), pane);
  expect('no Retire on a retired one', !pane.retire, pane);
  // History still works on a retired definition.
  await click('.fpe-icon[title^="History"]'); await A.w(600);
  const hist = await A.p.evaluate(() => (document.querySelector('.fpe-hist') || {}).innerText || '');
  expect('history lists the retiring version', /retired/.test(hist), hist);

  // A supervisor sees neither.
  await R.signInAs(A, 'Sue Supervisor', ['supervisor']);
  await R.openPane(A, 'form', 'zz-b');
  expect('supervisor: no Retire, no Duplicate', !(await has('.fpe-retire-btn')) && !(await has('.fpe-dup-btn')), 'shown');
  await R.openPane(A, 'form', 'zz-c');
  expect('supervisor: banner, no Reinstate', (await has('.fpe-retired')) && !(await has('.fpe-reinstate-btn')), 'wrong');

  // Duplicate as new form (an admin; a publisher can too). zz-b uses the structure zz-st and the function ZzTwice.
  await R.signInAdmin(A);
  await R.openPane(A, 'form', 'zz-b');
  await click('.fpe-dup-btn');
  const dlg = await R.dlgText(A);
  A.say('dialog', JSON.stringify(dlg));
  expect('dialog explains sharing', /one item never lives in two structures, so sharing is usual/i.test(dlg), dlg);
  const uses = await A.p.evaluate(() => Array.from(document.querySelectorAll('.fpe-dlg select')).map(s => `${s.dataset.use}=${s.value}`));
  expect('a Share or Copy choice for each, Share by default', uses.sort().join() === 'function/ZzTwice=share,structure/zz-st=share', uses);
  // Refusals, shown as typed.
  await A.p.fill('.fpe-dlg input[aria-label="New form id"]', 'Bad Id');
  expect('bad id: the refusal text, Duplicate off', /lowercase letters, digits and -/.test(await R.dlgText(A)) && await A.p.$eval('.fpe-dup-go', b => b.disabled), await R.dlgText(A));
  await A.p.fill('.fpe-dlg input[aria-label="New form id"]', 'zz-c');
  expect('retired id: never reused', /Form zz-c already exists \(retired: an id is never reused\)/.test(await R.dlgText(A)), await R.dlgText(A));
  await A.p.fill('.fpe-dlg input[aria-label="New form id"]', 'zz-a');
  expect('existing id refused', /Form zz-a already exists/.test(await R.dlgText(A)) && await A.p.$eval('.fpe-dup-go', b => b.disabled), await R.dlgText(A));
  // Copy the structure, share the function.
  await A.p.fill('.fpe-dlg input[aria-label="New form id"]', 'zz-b-copy');
  await A.p.fill('.fpe-dlg input[aria-label="New form title"]', 'Zz B again');
  await A.p.selectOption('.fpe-dlg select[data-use="structure/zz-st"]', 'copy');
  await click('.fpe-dup-go'); await A.w(1800);
  const t = await R.toastText(A);
  A.say('toast', t);
  expect('shows what was copied', /Made form zz-b-copy/.test(t) && /Copied: structure zz-st as /.test(t), t);
  const made = await A.p.evaluate(() => {
    const d = FP.defs.get('form', 'zz-b-copy'), o = FP.defs.get('form', 'zz-b');
    const st = x => (x.def.sources || []).map(s => s.structure).join();
    const copies = FP.defs.list('structure').filter(s => !s.retired && /^zz-st-/.test(s.id) || (s.id !== 'zz-st' && s.id !== 'zz-st2' && /zz/.test(s.id))).map(s => s.id);
    return { title: d && d.def.title, st: d && st(d), orig: st(o), copies, fnUses: d && JSON.stringify(d.def.fields).includes('ZzTwice'), pane: (document.querySelector('.fpe-head h2') || {}).textContent };
  });
  A.say('made', JSON.stringify(made));
  expect('the new form exists with its title', made.title === 'Zz B again', made);
  expect('its structure is a copy; the original keeps its own', made.st && made.st !== 'zz-st' && made.orig === 'zz-st' && made.copies.includes(made.st), made);
  expect('the function stays shared', made.fnUses, made);
  expect('the new form is open', made.pane === 'Zz B again', made);

  // Share both: nothing copied.
  await R.openPane(A, 'form', 'zz-a');
  await click('.fpe-dup-btn');
  await A.p.fill('.fpe-dlg input[aria-label="New form id"]', 'zz-a-twin');
  await click('.fpe-dup-go'); await A.w(1800);
  const t2 = await R.toastText(A);
  const twin = await A.p.evaluate(() => { const d = FP.defs.get('form', 'zz-a-twin'); return d ? (d.def.sources || []).map(s => s.structure).join() : null; });
  expect('sharing: the same structure, nothing copied', twin === 'zz-st' && /shared with the original/.test(t2), { twin, t2 });
  A.say('errs', JSON.stringify(bad.concat(A.errs)));
  await A.b.close();
  if (bad.length || A.errs.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
