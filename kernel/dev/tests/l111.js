// F10 a hard limit or rule that is Waiting or errors blocks saving; F17 a table's per-cell limits and minRows are
// settings that publish accepts and that work; F30 number: Infinity refused, decimals and placeholder applied, a
// choice's warn colour has CSS and a value shows to its decimals.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const bad = [];
  const expect = (what, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); say(what, ok ? 'ok ' + JSON.stringify(got) : 'WRONG ' + JSON.stringify(got) + ' wanted ' + JSON.stringify(want)); if (!ok) bad.push(what); };
  const def = {
    title: 'Limits test', sites: ['all'], sources: [{ name: 'chk', kind: 'item', structure: 'die-setups', id: { generate: true }, values: { notes: 'write' } }],
    fields: [
      { name: 'notes', label: 'Notes', control: 'text', writes: 'chk.notes' },
      { name: 'cap', label: 'Cap', control: 'number' },
      { name: 'od', label: 'OD', control: 'number', decimals: 2, placeholder: 'in inches', limits: { max: 'cap' } },
      { name: 'gate', label: 'Gate', control: 'number' },
      { name: 'code', label: 'Code', control: 'text', rule: 'gate > 0', ruleText: 'No' },
      { name: 'boom', label: 'Boom', control: 'text', rule: '1 / 0 = 1' },
      { name: 'grade', label: 'Grade', control: 'choice', options: ['A', 'B'], colors: { A: 'warn', B: 'good' } },
      { name: 'shown', label: 'Shown', control: 'value', formula: '2 / 3', decimals: 2 },
      { name: 'cells', label: 'Cells', control: 'table', addRows: true, startRows: 1, minRows: 2, columns: [{ name: 'v', label: 'V', control: 'number', limits: { min: 1, max: 5 } }] },
    ],
  };
  await p.evaluate(async d => { window.__d = d; window.__probs = FP.forms.check(d); document.body.innerHTML = '<div id="h" style="padding:20px;max-width:900px"></div>'; window.__i = await FP.forms.open(document.getElementById('h'), 'lim-test', { def: d, draft: false }); }, def);
  await w(1200);
  say('check', JSON.stringify(await p.evaluate(() => window.__probs)));
  expect('publish check accepts limits and minRows', await p.evaluate(() => window.__probs.filter(x => /limits|minRows|not a setting/.test(x))), []);
  const probs = () => p.evaluate(() => { const o = {}; document.querySelectorAll('.fpf-cell[data-name]').forEach(c => { const m = c.querySelector('.fpf-msg'); if (m && m.textContent.trim()) o[c.dataset.name] = m.textContent.trim(); }); return o; });
  const canSave = () => p.evaluate(() => window.__i.buttons().find(x => x.action === 'save').enabled);
  const typed = async (name, v) => { await p.fill(`[data-name="${name}"] input`, v); await p.keyboard.press('Tab'); await w(500); };
  // F10: limit formula waiting for cap
  await typed('od', '5');
  expect('limit waiting: cannot save', await canSave(), false);
  say('why (limit)', JSON.stringify(await p.evaluate(() => document.querySelector('.fpf-why').textContent)));
  await typed('cap', '4');
  expect('limit known, value over: cannot save', await canSave(), false);
  await typed('cap', '6');
  // the rule waits on gate; and another rule errors
  await typed('code', 'x');
  expect('rule waiting: cannot save', await canSave(), false);
  await typed('gate', '1');
  await p.fill('[data-name="code"] input', 'x'); await w(400);
  await typed('boom', 'y');
  expect('rule error: cannot save', await canSave(), false);
  await p.fill('[data-name="boom"] input', ''); await p.keyboard.press('Tab'); await w(500);
  // F17: table cell limits and minRows
  const cell = '[data-name="cells"] table input';
  await p.fill(cell, '9'); await p.keyboard.press('Tab'); await w(500);
  const tableMsg = async () => p.evaluate(() => { const c = document.querySelector('[data-name="cells"] .fpf-msg'); return c ? c.textContent.trim() : ''; });
  expect('table cell over its limit', /at most 5/.test(await tableMsg()), true);
  await p.fill(cell, '3'); await p.keyboard.press('Tab'); await w(500);
  expect('table minRows', /At least 2 rows/.test(await tableMsg()), true);
  await p.click('[data-name="cells"] button:has-text("Add row")'); await w(300);
  await p.fill('[data-name="cells"] tr:nth-of-type(3) input', '2'); await p.keyboard.press('Tab'); await w(500);
  expect('table ok', await tableMsg(), '');
  expect('all fine: can save', await canSave(), true);
  // F30
  await typed('od', '1e999');
  expect('1e999 is not a number', /number/i.test((await probs()).od || ''), true);
  await typed('od', '1.23456');
  expect('decimals applied', await p.evaluate(() => window.__i.values().od), 1.23);
  expect('placeholder applied', await p.$eval('[data-name="od"] input', x => x.placeholder), 'in inches');
  await p.click('[data-name="grade"] button:has-text("A")'); await w(300);
  const bg = await p.$eval('[data-name="grade"] button.on', x => getComputedStyle(x).backgroundColor);
  say('warn colour', bg);
  expect('warn has its own colour', bg !== 'rgb(31, 95, 191)' && bg !== 'rgba(0, 0, 0, 0)', true);
  expect('value control shows decimals', await p.$eval('[data-name="shown"] .fpf-value', x => x.textContent.trim()), '0.67');
  say('errs', JSON.stringify(errs));
  await b.close();
  if (bad.length || errs.length) { console.log('FAILED:', bad.join(', ')); process.exit(1); }
})();
