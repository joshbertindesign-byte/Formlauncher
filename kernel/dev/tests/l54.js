// 0.40: sub-forms at run time, and the changed-since-you-opened-it check.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap14.json' });
  p.on('dialog', d => d.accept().catch(() => {}));
  const setup = await p.evaluate(async () => {
    await FP.defs.publish('structure', 'retests', { label: 'Re-tests', kind: 'records', itemId: { made: 'new', label: 'Re-test no.', prefix: 'RT' }, containers: { temp: {}, die: {} }, sites: ['all'] }, { note: 't' });
    await FP.defs.load();
    const M = JSON.parse(JSON.stringify(FP.defs.get('form', 'die-setup').def));
    delete M.acknowledge;
    M.fields.push({ name: 'retestTemp', label: 'Re-test temperature', control: 'number' }, { name: 'samplesAvg', label: 'Average wall', control: 'number' }, { name: 'samplesAll', label: 'All walls', control: 'text' });
    M.buttons = [{ name: 'save', label: 'Save', action: 'save' }, { name: 'retestBtn', label: 'Record re-test', action: 'subform', subform: 'retest' },
      { name: 'samplesBtn', label: 'Wall samples', action: 'subform', subform: 'samples' }, { name: 'quickBtn', label: 'Quick re-test', action: 'subform', subform: 'quick' }];
    M.subforms = [
      { name: 'retest', label: 'Re-test', title: '"Re-test for " & dieNo', sources: [{ name: 'rt', kind: 'item', structure: 'retests', id: { generate: true }, values: { temp: 'both', die: 'both' } }],
        fields: [{ name: 'temp', label: 'Temperature', control: 'number', required: true, writes: 'rt.temp' }, { name: 'dieOf', label: 'Die', control: 'value', formula: 'dieNo & " on " & die.press', snapshot: 'rt.die' }],
        back: [{ to: 'retestTemp', from: 'temp' }] },
      { name: 'samples', label: 'Wall sample', title: '"Sample " & index', repeat: { count: 3 }, fields: [{ name: 'wall', label: 'Wall (in)', control: 'number', required: true }],
        back: [{ to: 'samplesAvg', from: 'wall', how: 'avg' }, { to: 'samplesAll', from: 'wall', how: 'join' }] },
      { name: 'quick', label: 'Quick re-test', saves: 'own', sources: [{ name: 'q', kind: 'item', structure: 'retests', id: { generate: true }, values: { temp: 'both' } }],
        fields: [{ name: 'temp', label: 'Temperature', control: 'number', required: true, writes: 'q.temp' }] },
    ];
    window.__M = M;
    const probs = FP.forms.check(M);
    const bad = JSON.parse(JSON.stringify(M));
    bad.subforms[1].back = [{ to: 'retestTemp', from: 'wall' }, { to: 'samplesAll', from: 'wall', how: 'avg' }];
    bad.subforms[0].back = [{ to: 'retestTemp', from: 'temp', how: 'avg' }];
    const probs2 = FP.forms.check(bad);
    document.body.innerHTML = '<div id="h" style="padding:20px;max-width:900px"></div>';
    window.__i = await FP.forms.open(document.getElementById('h'), 'test-master', { def: M });
    return { probs, probs2 };
  });
  say('check ok', JSON.stringify(setup.probs));
  say('mismatch', setup.probs2.join(' | '));
  const fill = async (sel, v) => { await p.fill(sel, String(v)); await p.keyboard.press('Tab'); await w(300); };
  await fill('#h [data-name="dieNo"] input', 'D-1047');
  await fill('#h [data-name="ovenTemp"] input', '905');
  say('buttons', JSON.stringify(await p.evaluate(() => __i.buttons())));
  // once, saved with the master
  await p.locator('#h').getByRole('button', { name: /^Record re-test/ }).click(); await w(1200);
  say('sheet', await p.$eval('.fpf-sheet', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 200)));
  await fill('.fpf-sheet [data-name="temp"] input', '870');
  say('btn html', await p.$$eval('.fpf-sheet button', l => l.map(x => x.outerHTML).join(' ')));
  await p.screenshot({ path: 'l54-sheet.png' });
  await p.locator('.fpf-sheet').getByRole('button', { name: 'Done', exact: true }).click(); await w(1200);
  say('after retest', JSON.stringify(await p.evaluate(() => ({ v: __i.values().retestTemp, waiting: __i.waiting(), runs: __i.runs().retest }))));
  // three samples
  await p.locator('#h').getByRole('button', { name: /^Wall samples/ }).click(); await w(1000);
  for (const v of ['0.10', '0.12', '0.14']) {
    say('sample sheet', await p.$eval('.fpf-sheet .fpf-crumbs', x => x.innerText.replace(/\n+/g, ' ')));
    await fill('.fpf-sheet [data-name="wall"] input', v);
    await p.locator('.fpf-sheet').getByRole('button', { name: 'Done', exact: true }).click(); await w(1000);
  }
  say('after samples', JSON.stringify(await p.evaluate(() => ({ avg: __i.values().samplesAvg, all: __i.values().samplesAll, sheets: document.querySelectorAll('.fpf-sheet').length }))));
  // saved on its own
  await p.locator('#h').getByRole('button', { name: /^Quick re-test/ }).click(); await w(1000);
  await fill('.fpf-sheet [data-name="temp"] input', '880');
  await p.locator('.fpf-sheet').getByRole('button', { name: 'Save', exact: true }).click(); await w(1500);
  say('foot', await p.$eval('#h .fpf-why', x => x.textContent));
  say('btn states', await p.$$eval('#h .fpf-substate', l => l.map(x => x.textContent).join(' | ')));
  const mid = await p.evaluate(async () => { FP.current.clearCache(); const d = await FP.current.load('retests'); return Array.from(d.items.values()).map(i => `${i.id} temp=${i.values.temp} refs=${JSON.stringify(i.refs)}`); });
  say('retests before master save', mid.join(' | '));
  await p.screenshot({ path: 'l54-master.png' });
  await p.locator('#h').getByRole('button', { name: 'Save', exact: true }).click(); await w(2000);
  const after = await p.evaluate(async () => {
    FP.current.clearCache();
    const r = await FP.current.load('retests'); const d = await FP.current.load('die-setups');
    const last = Array.from(d.items.values()).pop();
    return { retests: Array.from(r.items.values()).map(i => `${i.id} temp=${i.values.temp} die=${i.values.die} refs=${JSON.stringify(i.refs)}`), ds: last.id, runs: JSON.stringify(__i.runs()), waiting: __i.waiting().length };
  });
  for (const [k, v] of Object.entries(after)) say(k, Array.isArray(v) ? v.join(' | ') : v);
  // changed since you opened it
  await p.evaluate(async () => { __i.destroy(); window.__j = await FP.forms.open(document.getElementById('h'), 'fix-die', { def: { title: 'Fix a die', sources: [{ name: 'die', kind: 'item', structure: 'dies', id: { field: 'dieNo' }, values: { description: 'both' } }],
    fields: [{ name: 'dieNo', label: 'Die no.', control: 'text', required: true }, { name: 'now', label: 'Now', control: 'value', formula: 'die.description' }, { name: 'description', label: 'Description', control: 'text', writes: 'die.description' }] } }); });
  await w(800);
  await fill('#h [data-name="dieNo"] input', 'D-1047'); await w(800);
  say('desc loaded', await p.$eval('#h [data-name="now"]', x => x.innerText));
  await p.evaluate(async () => { await FP.entry.record({ entry: 'dies.save', item: { structure: 'dies', id: 'D-1047' }, form: { id: 'other', version: 1 }, values: { description: 'Changed on T02' } }); });
  await fill('#h [data-name="description"] input', 'Mine');
  await p.locator('#h').getByRole('button', { name: 'Save', exact: true }).click(); await w(1500);
  say('dialog', await p.$eval('.fpf-dialog', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '(none)'));
  await p.click('.fpf-dialog button:text-is("See both")'); await w(300);
  await p.screenshot({ path: 'l54-conflict.png' });
  await p.click('.fpf-dialog button:text-is("Keep theirs")'); await w(1000);
  say('desc now', await p.$eval('#h [data-name="description"] input', x => x.value));
  say('foot', await p.$eval('#h .fpf-why', x => x.textContent));
  await fill('#h [data-name="description"] input', 'Mine after all');
  await p.locator('#h').getByRole('button', { name: 'Save', exact: true }).click(); await w(1500);
  say('dialog 2', await p.$eval('.fpf-dialog', x => x.innerText).catch(() => '(none)'));
  say('die now', await p.evaluate(async () => { FP.current.clearCache(); return (await FP.current.item('dies', 'D-1047')).values.description; }));
  say('errors', errs);
  await b.close();
})();
