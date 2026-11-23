// Pilot 0.55, step 6: the QC office traces a rack (a customer return): scan its ID, the trace tree shows its run, and
// under the run its shift, its need, its hour checks and the other racks it made; a branch opens and closes, and
// tapping an hour check selects it.
const pilot = require('../dummies/pt.js');
(async () => {
  const t = await pilot({ seed: 'snapQC.json', at: '2026-11-19T10:00:00-06:00' });
  const { p, w, say } = t;
  await t.signIn('Josh', '482913');
  await p.evaluate(async () => { const g = (await FP.groups.list()).find(x => x.name === 'QC office'); await FP.groups.update(g.id, { terminals: ['T01'] }); await FP.launcher.home(); });
  await w(2500);
  const racks = await p.evaluate(async () => Array.from((await FP.current.load('racks')).items.keys()));
  say('racks', racks.join(', '));
  await p.click('.fpl-side [data-form="trace-rack"]'); await w(2500);
  say('empty', await t.text('[data-name="trace"]'));
  await p.fill('[data-name="rackId"] input', 'NO-SUCH-RACK'); await w(2500);
  say('unknown', `${await t.text('[data-name="found"]')} · ${await t.text('[data-name="trace"]')}`);
  await p.fill('[data-name="rackId"] input', racks[0]); await w(4000);
  say('found', await t.text('[data-name="found"]'));
  say('tree', (await t.text('[data-name="trace"]')).slice(0, 900));
  // Close the run, then open it again; tap the first hour check.
  await p.click('[data-name="trace"] .fpv-tree > li > ul > li .tg'); await w(800);
  say('closed', (await t.text('[data-name="trace"]')).slice(0, 200));
  await p.click('[data-name="trace"] .fpv-tree > li > ul > li .tg'); await w(800);
  const check = await p.$('[data-name="trace"] li.fpv-tbranch:has-text("Hour checks") + li .bd');
  if (check) { await check.click(); await w(1500); say('selected', await p.$$eval('[data-name="trace"] .bd.sel', l => l.map(x => x.innerText.replace(/\n+/g, ' / ')).join(' | '))); }
  else say('selected', 'no hour check to tap');
  await p.screenshot({ path: 'q6-trace.png', fullPage: true });
  say('errs', JSON.stringify(t.errs).slice(0, 400));
  await t.b.close();
})();
