// Lookup editor (F4): "When several match" offers sum, average, min and max only when the lookup gives back one container;
// over the whole item or several containers only latest, first, count and list. Also the form's-time-window label is honest (F11).
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  await p.evaluate(async () => {
    await FP.defs.publish('structure', 'zz-st', { sites: ['all'], label: 'Zz', kind: 'list', itemId: { label: 'Id', made: 'entered' }, containers: { qty: {}, other: {} } }, { basedOn: null, note: 'l121' });
    await FP.defs.publish('function', 'ZzRows', { sites: ['all'], kind: 'lookup', output: 'any', inputs: [{ name: 'line', type: 'text' }],
      reads: { structure: 'zz-st', from: 'entries', match: {}, return: 'qty', summary: 'sum' } }, { basedOn: null, note: 'l121' }).catch(e => { window.__pubErr = e.message; });
  });
  say('published', String(await p.evaluate(() => window.__pubErr || 'ok')));
  await p.evaluate(() => FP.editor.openDef('function', 'ZzRows')); await w(1800);
  const offered = () => p.$$eval('.ffe-set select', l => l.map(s => Array.from(s.options).map(o => o.value).join(',')).filter(v => /latest/.test(v)));
  const open = async key => { await p.click(`.ffm-r[data-key="${key}"]`); await w(500); };
  await open('ret');
  const one = await offered();
  say('one container', JSON.stringify(one));
  // Pick the whole item: the summary falls back to something that works over a record.
  await p.click('.fpe-chip:has-text("the whole item")'); await w(600);
  const whole = await offered();
  say('whole item', JSON.stringify(whole));
  const sum = await p.evaluate(() => FP.editor && JSON.stringify(((document.querySelector('.ffe-set select') || {}).value) || null));
  say('summary now', sum);
  await open('win');
  say('window options', JSON.stringify(await p.$$eval('.ffe-set select', l => l.map(s => Array.from(s.options).map(o => o.textContent)).filter(o => o.some(t => /time window/.test(t)))[0] || [])));
  const bad = [];
  if (!one.some(v => /sum/.test(v))) bad.push('one container should offer sum: ' + JSON.stringify(one));
  if (!whole.length || whole.some(v => /sum|average|min|max/.test(v))) bad.push('whole item must not offer sum/average/min/max: ' + JSON.stringify(whole));
  say('errs', JSON.stringify(errs.concat(bad)));
  await b.close();
  if (bad.length) process.exit(1);
})();
