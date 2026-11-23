const pilot = require('./pt.js');
(async () => {
  const t = await pilot({ seed: 'snapPilotD.json', at: '2026-11-19T18:20:00-06:00' });
  const { p, say } = t;
  await t.signIn('Josh', '482913');
  say('checks', JSON.stringify(await p.evaluate(async () => { const v = await FP.fn.callAsync('ChecksRecent', {}); return v.map(r => [r.slot, r.line, r.lineStatus, r.$at]); })));
  say('rows', JSON.stringify(await p.evaluate(async () => { const r = await FP.current.load('runs', { fresh: true }); return r.rows.filter(x => x.action === 'hourly').map(x => [x.item.id, x.writtenAt, x.values.slot, x.values.line]); })));
  await t.b.close();
})();
