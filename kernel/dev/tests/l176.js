// 0.66 Retiring definitions: the form editor's pickers. A retired structure, function, lookup or form is left out of every
// picker of existing definitions unless "Show retired" is on (the fpe-show-retired preference, which the small toggle by a
// picker also sets); a retired one already chosen stays on show, suffixed (retired), with a problem line; and a form that
// already uses a retired structure lists it in its problems instead of losing the reference.
const start = require('./dummies/base.js');
const fs = require('fs'), path = require('path');
const PACK = path.join(__dirname, '../packs/test-pack/test-pack.json');
(async () => {
  const A = await start({ at: '2026-11-19T08:00:00-06:00' });
  const { p, w } = A;
  p.on('dialog', d => d.accept().catch(() => {}));
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };

  await p.evaluate(async text => { await FP.packs.install(FP.packs.read(text)); FP.current.clearCache(); }, fs.readFileSync(PACK, 'utf8'));
  const setup = await p.evaluate(async () => {
    const pub = (kind, id, def) => FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, def), { basedOn: null, note: 'l176' });
    const st = { label: 'Things', kind: 'list', roles: { active: 'active' }, itemId: { label: 'Thing', made: 'entered' }, containers: { name: {}, active: {} } };
    await pub('structure', 'zz-live', Object.assign({}, st, { label: 'Live things' }));
    await pub('structure', 'zz-old', Object.assign({}, st, { label: 'Old things' }));
    await pub('structure', 'zz-kept', Object.assign({}, st, { label: 'Kept things' }));
    await pub('function', 'ZzLive', { label: 'Live fn', output: 'number', inputs: [{ name: 'a', type: 'number', required: false }], formula: 'COALESCE(a, 0) + 1' });
    await pub('function', 'ZzOld', { label: 'Old fn', output: 'number', inputs: [{ name: 'a', type: 'number', required: false }], formula: 'COALESCE(a, 0) + 2' });
    await pub('function', 'ZzLookOld', { label: 'Old lookup', kind: 'lookup', output: 'record', inputs: [{ name: 'k', type: 'text' }], reads: { structure: 'zz-live', from: 'items', match: { name: 'k' }, return: '*', summary: 'latest', window: 'all' } });
    const f = (title, extra) => Object.assign({ title, sources: [], fields: [{ name: 'note', control: 'text', label: 'Note' }] }, extra || {});
    await pub('form', 'zz-tgt-live', f('Target live'));
    await pub('form', 'zz-tgt-old', f('Target old'));
    // Uses a structure (zz-kept) that is retired afterwards, and opens the old form.
    await pub('form', 'zz-user', f('Uses retired', {
      sources: [{ name: 'thing', kind: 'item', structure: 'zz-kept', id: { field: 'note' }, values: { name: 'write' } }],
      fields: [{ name: 'note', control: 'text', label: 'Note', writes: 'thing.name' }, { name: 'go', control: 'buttons', label: 'Go', formula: 'RANGE(1, 3)', form: 'zz-tgt-old' }],
    }));
    await pub('form', 'zz-main', f('Main', { fields: [{ name: 'note', control: 'text', label: 'Note' }, { name: 'go', control: 'buttons', label: 'Go', formula: 'RANGE(1, 3)', form: 'zz-tgt-live' }] }));
    const out = {};
    for (const [k, id] of [['structure', 'zz-old'], ['function', 'ZzOld'], ['function', 'ZzLookOld'], ['form', 'zz-tgt-old']]) {
      try { await FP.defs.retire(k, id, { note: 'l176', force: k === 'form' }); out[id] = 'retired'; } catch (e) { out[id] = e.message; }
    }
    try { await FP.defs.retire('structure', 'zz-kept', { note: 'l176', force: true }); out['zz-kept'] = 'retired'; } catch (e) { out['zz-kept'] = e.message; }
    FP.current.clearCache();
    return out;
  });
  A.say('retired', JSON.stringify(setup));
  expect('everything retired', Object.values(setup).every(v => v === 'retired'), setup);

  const open = async (kind, id) => { await p.evaluate(async ([k, i]) => { await FP.editor.openDef(k, i); }, [kind, id]); await w(900); };
  // The options of the select (in the open editor) whose first option reads `first`.
  const optsOf = first => p.evaluate(first => { const s = Array.from(document.querySelectorAll('select')).find(x => x.options.length && x.options[0].textContent === first); return s ? Array.from(s.options).map(o => o.textContent) : null; }, first);
  const clickToggle = async first => { await p.evaluate(first => { const s = Array.from(document.querySelectorAll('select')).find(x => x.options.length && x.options[0].textContent === first); s.parentElement.querySelector('.ffe-retoggle input').click(); }, first); await w(200); };
  const pref = () => p.evaluate(() => { try { return localStorage.getItem('fpe-show-retired'); } catch (_) { return 'ERR'; } });
  const tabOf = k => p.click(`.ffe3-tab[data-tab="${k}"]`).then(() => w(200));
  const has = (o, t) => !!o && o.some(x => x.includes(t));
  const off = () => p.evaluate(() => localStorage.setItem('fpe-show-retired', '0'));

  await p.evaluate(() => { try { localStorage.removeItem('fpe-show-retired'); } catch (_) { /* none */ } });
  expect('preference starts unset', (await pref()) === null, await pref());

  // 1. A new source: which structure's item?
  await open('form', 'zz-main');
  await tabOf('data');
  await p.click('.ffm-r[data-key="+s"]'); await w(300);
  await p.click('text=A structure'); await w(300);
  let o = await optsOf('choose a structure…');
  A.say('source picker', JSON.stringify(o));
  expect('source structure picker lists the live ones', has(o, 'Live things (zz-live)'), o);
  expect('source structure picker omits the retired', !has(o, 'Old things') && !has(o, 'Kept things'), o);
  await clickToggle('choose a structure…');
  o = await optsOf('choose a structure…');
  expect('Show retired lists it, suffixed', has(o, 'Old things (zz-old) (retired)'), o);
  expect('the toggle set the preference', (await pref()) === '1', await pref());
  await p.screenshot({ path: 'out/l176-source.png' });
  await clickToggle('choose a structure…');
  o = await optsOf('choose a structure…');
  expect('Show retired off hides it again', !has(o, 'zz-old') && (await pref()) === '0', { o, pref: await pref() });

  // 2. The form a buttons field opens.
  await open('form', 'zz-main');
  await tabOf('fields');
  await p.click('.ffm-r[data-key="f:go"]'); await w(400);
  o = await optsOf('—');
  A.say('form picker', JSON.stringify(o && o.filter(x => /Target/.test(x))));
  expect('form picker lists the live form', has(o, 'Target live (zz-tgt-live)'), o);
  expect('form picker omits the retired form', !has(o, 'zz-tgt-old'), o);
  await clickToggle('—');
  o = await optsOf('—');
  expect('form picker with Show retired', has(o, 'Target old (zz-tgt-old) (retired)'), o);
  expect('the preference persists', (await pref()) === '1', await pref());
  await open('form', 'zz-main'); await tabOf('fields'); await p.click('.ffm-r[data-key="f:go"]'); await w(400);
  o = await optsOf('—');
  expect('a new editor reads the preference', has(o, 'zz-tgt-old'), o);
  await off();

  // 3. A calculated value's function (a lookup is a function too), and a lookup's structure.
  await p.evaluate(async () => {
    const cur = FP.defs.get('structure', 'zz-live');
    await FP.defs.publish('structure', 'zz-live', Object.assign({}, cur.def, { calculated: { c1: { fn: 'ZzLive', inputs: {} } } }), { basedOn: cur.version, note: 'l176' });
    await FP.defs.publish('function', 'ZzLookNew', { sites: ['all'], label: 'New lookup', kind: 'lookup', output: 'record', inputs: [{ name: 'k', type: 'text' }], reads: { structure: 'zz-live', from: 'items', match: { name: 'k' }, return: '*', summary: 'latest', window: 'all' } }, { basedOn: null, note: 'l176' });
    FP.current.clearCache();
  });
  await open('structure', 'zz-live');
  A.say('rows', JSON.stringify(await p.$$eval('.ffm-r', rs => rs.map(r => r.dataset.key))));
  const cv = await p.$('.ffm-r[data-key="v:c1"]') || await p.$('.ffm-r[data-key="c:c1"]');
  if (cv) { await cv.click(); await w(400); }
  o = await optsOf('choose a function…');
  A.say('function picker', JSON.stringify(o && o.filter(x => /Zz/.test(x))));
  expect('function picker lists the live function', has(o, 'ZzLive'), o);
  expect('function picker omits the retired function and lookup', !has(o, 'ZzOld') && !has(o, 'ZzLookOld'), o);
  expect('function picker lists a live lookup', has(o, 'ZzLookNew'), o);
  await clickToggle('choose a function…');
  o = await optsOf('choose a function…');
  expect('function picker with Show retired', has(o, 'ZzOld') && has(o, 'ZzLookOld') && o.filter(x => /ZzOld|ZzLookOld/.test(x)).every(x => /\(retired\)$/.test(x)), o);
  await off();

  await open('function', 'ZzLookNew');
  await p.click('.ffm-r[data-key="rd"]'); await w(400);
  o = await optsOf('choose a structure…');
  A.say('lookup structure picker', JSON.stringify(o));
  expect('lookup structure picker omits the retired structure', has(o, 'Live things') && !has(o, 'zz-old'), o);
  await clickToggle('choose a structure…');
  o = await optsOf('choose a structure…');
  expect('lookup structure picker with Show retired', has(o, 'Old things (zz-old) (retired)'), o);
  await off();

  A.say('errs', JSON.stringify(bad.concat(A.errs)));
  await A.b.close();
  if (bad.length || A.errs.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
