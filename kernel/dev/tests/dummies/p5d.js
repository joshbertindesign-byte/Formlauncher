const pilot = require('./pt.js');
(async () => {
  const t = await pilot({ seed: 'snapPilotB.json', at: '2026-11-19T09:10:00-06:00' });
  const { p, w, say } = t;
  await t.signIn('Josh', '482913');
  await t.open('rack');
  const sel = await p.$('[data-name="run"] select');
  say('opts', JSON.stringify(await sel.$$eval('option', l => l.map(o => [o.value, o.textContent]))));
  say('value0', await sel.evaluate(s => s.value));
  await sel.selectOption('1'); await w(100);
  say('value1', await sel.evaluate(s => s.value));
  await w(1500);
  say('value2', await sel.evaluate(s => s.value));
  say('opts2', JSON.stringify(await sel.$$eval('option', l => l.map(o => [o.value, o.textContent]))));
  await t.b.close();
})();
