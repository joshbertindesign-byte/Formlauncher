// 0.66 Retiring definitions, Admin: the Unused finder (Admin > Clean-up) lists forms, structures and formulas nothing active
// uses, leaves out a form a launcher shortcut names, retires one in a tap (the row goes), and Admin > Launchers flags a
// shortcut to a retired form and points it at its replacement.
const start = require('./dummies/base.js');
const fs = require('fs'), path = require('path');
const PACK = fs.readFileSync(path.join(__dirname, '../packs/test-pack/test-pack.json'), 'utf8');
(async () => {
  const A = await start({ at: '2026-11-19T08:00:00-06:00' });
  const { p, w } = A;
  p.on('dialog', d => d.accept().catch(() => {}));
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  await p.evaluate(async text => {
    await FP.folder.handle.getFileHandle('THIS IS A TEST FOLDER.txt', { create: true });
    await FP.packs.install(FP.packs.read(text));
    const pub = (kind, id, def) => FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, def), { note: 'l179' });
    const form = t => ({ title: t, sources: [], fields: [{ name: 'x', control: 'text', label: 'X' }], layout: [['x 6']] });
    await pub('structure', 'zz-orph', { label: 'Zz orphan', kind: 'list', roles: { active: 'active' }, itemId: { label: 'Id', made: 'entered' }, containers: { active: {} } });
    await pub('function', 'ZzOrphFn', { label: 'Zz orphan function', output: 'number', inputs: [], formula: '1' });
    await pub('form', 'zz-orph-form', form('Zz orphan form'));
    await pub('form', 'zz-named', form('Zz named form'));          // a shortcut names it: counts as use
    await pub('form', 'zz-new', Object.assign(form('Zz new'), { launchable: true }));
    await pub('form', 'zz-old', Object.assign(form('Zz old'), { launchable: true }));
    await FP.launchers.make('zz-old', { name: 'zz-old-sc' });
    await FP.files.writeJson(['launchers'], 'launchers.json', { fp: 'launchers', v: 1, list: [
      { name: 'zz-old-sc', form: 'zz-old', version: 'latest', made: '2026-11-01T00:00:00.000Z', by: 'Josh' },
      { name: 'zz-named-sc', form: 'zz-named', version: 'latest', made: '2026-11-01T00:00:00.000Z', by: 'Josh' }] });
    await FP.defs.retire('form', 'zz-old', { note: 'replaced', supersededBy: 'zz-new' });
    if (FP.outbox) await FP.outbox.flush();
  }, PACK).catch(e => { bad.push('setup: ' + e.message); console.log('setup:', e.message); });
  await w(1500);
  const openAdmin = async sec => { await p.click('.fpe-adminbtn:not(.fpe-helpbtn)'); await w(1500); await p.locator(`button:text-is("${sec}")`).first().click(); await w(1500); await p.waitForFunction(() => !/Loading…/.test((document.querySelector('.fpa-body, .fpe-admin') || document.body).innerText), null, { timeout: 15000 }).catch(() => {}); await w(1500); };

  // The Unused finder.
  await openAdmin('Clean-up');
  const text = () => p.evaluate(() => { const r = document.querySelector('.ffm-r'); return r ? r.parentElement.parentElement.innerText : ''; });
  let t = await text();
  expect('finder heading', /Unused finder/i.test(t), t.slice(0, 300));
  expect('orphan form listed', /Zz orphan form/.test(t), 'missing');
  expect('orphan structure listed', /Zz orphan/.test(t) && /zz-orph/.test(t), 'missing');
  expect('orphan function listed', /ZzOrphFn/.test(t), 'missing');
  expect('why shown', /On no terminal or group/.test(t) && /No form saves to or reads it/.test(t), 'no why');
  expect('launcher-named form excluded', !/Zz named form/.test(t), 'listed');
  expect('kind groups', /Forms/i.test(t) && /Structures/i.test(t) && /Formulas/i.test(t), 'groups');
  // Retire one.
  const row = p.locator('.ffm-r:has-text("Zz orphan form")').first();
  await row.click().catch(() => {}); await w(500);
  await p.locator('button.small:text-is("Retire")').first().click(); await w(2500);
  const st = await p.evaluate(() => ({ retired: (FP.defs.get('form', 'zz-orph-form') || {}).retired }));
  expect('retired', st.retired === true, st);
  t = await text();
  expect('row disappeared', !/Zz orphan form/.test(t), 'still listed');
  // Retire all shown in a group (confirmation lists names; the dialog is accepted).
  let asked = '';
  p.removeAllListeners('dialog'); p.on('dialog', d => { asked = d.message(); d.accept().catch(() => {}); });
  await p.evaluate(async () => { await FP.defs.publish('structure', 'zz-orph2', { sites: ['all'], label: 'Zz orphan two', kind: 'list', roles: { active: 'active' }, itemId: { label: 'Id', made: 'entered' }, containers: { active: {} } }, { note: 'l179' }); });
  await openAdmin('Clean-up');
  const all = p.locator('.ffm-r:has-text("retire all")').first();
  if (await all.count()) { await all.click(); await w(2500); }
  else bad.push('no retire-all row');
  expect('confirm lists names', /Zz orphan/.test(asked) && /Zz orphan two/.test(asked), asked);
  const gone = await p.evaluate(() => ['zz-orph', 'zz-orph2'].map(i => (FP.defs.get('structure', i) || {}).retired));
  expect('both structures retired', gone.every(Boolean), gone);
  t = await text();
  expect('structures group empties', !/Zz orphan two/.test(t), 'still listed');

  // Launchers: the shortcut to the retired form is flagged and repointed.
  await openAdmin('Launchers');
  t = await text();
  expect('retired shortcut flagged', /zz-old-sc/.test(t) && /retired, replaced by Zz new/.test(t), t.slice(0, 600));
  await p.locator('.ffm-r:has-text("retired, replaced by")').first().click(); await w(500);
  await p.locator('button:has-text("Point it at Zz new")').first().click(); await w(2500);
  const sc = await p.evaluate(async () => (await FP.launchers.get('zz-old-sc')));
  expect('shortcut repointed', sc && sc.form === 'zz-new' && sc.version === 'latest', sc);
  t = await text();
  expect('flag gone', !/retired, replaced by/.test(t), 'still flagged');
  await A.b.close();
  console.log('errs      :', JSON.stringify(bad.concat(A.errs)));
  if (bad.length || A.errs.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
