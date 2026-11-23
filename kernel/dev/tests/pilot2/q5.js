// Pilot 0.51, step 5: the QC office taps a running line on the needs board for its checks; the line terminal ends
// the shift (scrap on each line, who ended it); the production report adds it up.
const pilot = require('../dummies/pt.js');
(async () => {
  const t = await pilot({ seed: 'snapQC.json', at: '2026-11-19T09:40:00-06:00' });
  const { p, w, say } = t;
  const toGroup = async name => { await p.evaluate(async n => { const g = (await FP.groups.list()).find(x => x.name === n); await FP.groups.update(g.id, { terminals: ['T01'] }); await FP.launcher.home(); }, name); await w(2500); };
  await t.signIn('Josh', '482913');
  await toGroup('QC office');
  say('office', `${await t.text('#title')} · its checks shown before a tap: ${await p.isVisible('[data-name="nowChecks"]')}`);
  await p.click('.fpl-board [data-name="now"] tr:has(td:text-is("Line 1"))'); await w(1500);
  say('tap Line 1', (await t.text('.fpl-board [data-name="nowChecks"]')).slice(0, 200));
  await p.click('.fpl-board [data-name="now"] tr:has(td:text-is("Line 3 A"))'); await w(1500);
  say('tap Line 3 A', (await t.text('.fpl-board [data-name="nowChecks"]')).slice(0, 200));
  await p.screenshot({ path: 'q5-office.png' });
  // The end of the shift, at the line terminal.
  await toGroup('Line terminals');
  await t.at('2026-11-19T17:55:00-06:00');
  await t.signIn('Maria Lopez', '135790');
  await t.open('end-shift');
  say('end', `${await t.val('shiftPick')} · ${await t.val('missed')}`);
  await p.click('[data-name="who"] .fpc-people button:text-is("Ana Diaz")'); await w(400);
  const cells = await p.$$('[data-name="scrap"] input');
  for (let i = 0; i < cells.length; i++) { await cells[i].fill(String(50 + i * 25)); await w(150); }
  await t.seg('caliperOff', 'Yes'); await w(800);
  say('why', await t.why());
  await t.save('End the shift');
  say('shift', JSON.stringify((await t.items('shifts')).map(x => [x.$id, x.endedBy, x.endedAt ? 'ended at' : '-', x.$status])));
  say('runs', JSON.stringify((await t.items('runs')).map(x => [x.$id, x.scrapFt, x.endReason, x.missed, x.$status])));
  say('board', await t.board());
  // The report, at the office.
  await t.signIn('Josh', '482913');
  await toGroup('QC office');
  await p.click('#side button[data-form="production-report"]'); await w(3500);
  say('report', (await t.text('#form')).slice(0, 400));
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
