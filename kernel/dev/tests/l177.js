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
    const pub = (kind, id, def) => FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, def), { basedOn: null, note: 'l177' });
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
      try { await FP.defs.retire(k, id, { note: 'l177', force: k === 'form' }); out[id] = 'retired'; } catch (e) { out[id] = e.message; }
    }
    try { await FP.defs.retire('structure', 'zz-kept', { note: 'l177', force: true }); out['zz-kept'] = 'retired'; } catch (e) { out['zz-kept'] = e.message; }
    FP.current.clearCache();
    return out;
  });
  A.say('retired', JSON.stringify(setup));
  expect('everything retired', Object.values(setup).every(v => v === 'retired'), setup);

  const open = async (kind, id) => { await p.evaluate(async ([k, i]) => { await FP.editor.openDef(k, i); }, [kind, id]); await w(1200); };
  const tabOf = k => p.click(`.ffe3-tab[data-tab="${k}"]`).then(() => w(250));
  const pref = () => p.evaluate(() => { try { return localStorage.getItem('fpe-show-retired'); } catch (_) { return 'ERR'; } });
  // The select (in the open editor) whose first option reads `first`: its chosen text, classes and the problem line beside it.
  const pickerState = first => p.evaluate(first => {
    const s = Array.from(document.querySelectorAll('select')).find(x => x.options.length && x.options[0].textContent === first);
    if (!s) return null;
    const n = s.parentElement.querySelector('.ffe-retnote');
    return { chosen: s.options[s.selectedIndex].textContent, value: s.value, dim: s.classList.contains('ret'), note: n && !n.hidden ? n.textContent : '', toggle: !!s.parentElement.querySelector('.ffe-retoggle') };
  }, first);
  const tabs = () => p.$$eval('.ffe3-tab', ts => ts.map(t => t.textContent));
  const probs = () => p.$$eval('.fpe-probs li', ls => ls.map(l => l.textContent));
  await p.evaluate(() => { try { localStorage.setItem('fpe-show-retired', '0'); } catch (_) { /* none */ } });

  // A form that already uses a retired structure and opens a retired form: both stay, and both are problems.
  await open('form', 'zz-user');
  const pr = await probs(), tb = await tabs();
  A.say('tabs', JSON.stringify(tb));
  A.say('problems', JSON.stringify(pr));
  expect('the problems list names the retired structure', pr.some(x => /zz-kept is retired/.test(x)), pr);
  expect('the problems list names the retired form', pr.some(x => /zz-tgt-old.*retired/.test(x)), pr);
  expect('the Data tab counts the structure', tb.some(x => /^Data ✗1/.test(x)), tb);
  expect('the Fields tab counts the form', tb.some(x => /^Fields ✗1/.test(x)), tb);

  // The reference is still there on the source, shown retired, with the problem line, while Show retired is off.
  await tabOf('data');
  await p.click('.ffm-r[data-key="s:thing"]'); await w(400);
  let st = await pickerState('choose a structure…');
  A.say('source structure', JSON.stringify(st));
  expect('the source keeps its retired structure', st && st.value === 'zz-kept', st);
  expect('shown with the retired suffix', st && /Kept things \(zz-kept\) \(retired\)$/.test(st.chosen), st);
  expect('dimmed', st && st.dim === true, st);
  expect('the problem line', st && st.note === 'zz-kept is retired: pick another, or an admin can reinstate it', st);
  expect('the toggle is there', st && st.toggle === true, st);
  await p.screenshot({ path: 'out/l177-source.png' });

  // The button's form too.
  await tabOf('fields');
  await p.click('.ffm-r[data-key="f:go"]'); await w(400);
  st = await pickerState('—');
  A.say('form picker', JSON.stringify(st));
  expect('the field keeps its retired form', st && st.value === 'zz-tgt-old' && /Target old \(zz-tgt-old\) \(retired\)$/.test(st.chosen), st);
  expect('with the problem line', st && st.note === 'zz-tgt-old is retired: pick another, or an admin can reinstate it', st);

  // Picking another one clears the line; the draft is not silently changed by just looking.
  await p.evaluate(() => { const s = Array.from(document.querySelectorAll('select')).find(x => x.options.length && x.options[0].textContent === '—'); s.value = 'zz-tgt-live'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await w(500);
  st = await pickerState('—');
  expect('choosing a live form clears the line', st && st.note === '' && st.dim === false, st);
  await w(500);
  expect('and the form problem goes', !(await probs()).some(x => /zz-tgt-old/.test(x)), await probs());
  expect('the structure problem stays', (await probs()).some(x => /zz-kept is retired/.test(x)), await probs());

  // A retired structure's values are still shown on the form's source, not hidden: the item ID row stays.
  await tabOf('data');
  const rows = await p.$$eval('.ffm-r', rs => rs.map(r => r.dataset.key));
  expect('its source rows are still on the map', rows.includes('s:thing'), rows);
  expect('the preference was not changed by looking', (await pref()) === '0', await pref());

  A.say('errs', JSON.stringify(bad.concat(A.errs)));
  await A.b.close();
  if (bad.length || A.errs.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
