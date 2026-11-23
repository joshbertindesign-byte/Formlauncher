// Pilot 0.51, step 3, a line terminal (shared: a supervisor signs in; kiosk view, the Lines board as home):
// the shift starts for Tom Reed on Line 1, Line 2 and Line 3 A; each run takes its need's and profile's values.
const pilot = require('../dummies/pt.js');
(async () => {
  const t = await pilot({ seed: 'snapQA.json', at: '2026-11-19T05:50:00-06:00' });
  const { p, w, say } = t;
  say('gate', (await t.text('.fp-u-card')).replace(/ \/ /g, ' · ').slice(0, 200));
  await t.signIn('Maria Lopez', '135790');
  say('home', `${await t.text('#title')} · board: ${await t.text('.fpl-board')} · tiles ${await p.$$eval('.fpl-tile', l => l.map(x => x.dataset.form).join(','))} · list ${await p.isVisible('#side')}`);
  await t.open('start-shift');
  say('people', await p.$$eval('[data-name="operator"] .fpc-people button', l => l.map(x => x.textContent).join(', ')));
  await p.click('[data-name="operator"] .fpc-people button:text-is("Tom Reed")'); await w(500);
  for (const l of ['Line 1', 'Line 2', 'Line 3 A']) await p.click(`[data-name="lineList"] button:text-is("${l}")`);
  await t.seg('caliper', 'Yes'); await w(800);
  say('shift', `${await t.val('shiftId')} · ${await t.why()}`);
  await p.click('.fpf button:has-text("What runs on each line")'); await w(3000);
  for (let i = 0; i < 3; i++) {
    const sheet = '.fpf-sheet:last-of-type';
    say('run ' + i, (await p.$eval(sheet, x => x.innerText.replace(/\n+/g, ' / '))).slice(0, 420));
    await p.click(`${sheet} [data-name="material"] button:text-is("Virgin")`); await w(800);
    if (i === 0) await p.screenshot({ path: 'q3-run.png' });
    await p.click(`${sheet} .fpf-foot button:has-text("Done")`); await w(2500);
  }
  await t.save('Start the shift');
  say('after', `${await t.text('#title')} · board: ${await t.board()}`);
  say('shift', JSON.stringify((await t.items('shifts')).map(x => [x.$id, x.operator, x.crew, x.lines, x.$status])));
  say('runs', JSON.stringify((await t.items('runs')).map(x => [x.$id, x.line, x.machine, x.operator, x.profile, x.part, x.customer, x.color, x.needLine, x.offLine, x.lengthNom, x.lengthTol, x.pcsPerRack, x.wtNom, x.gauge, x.material, x.materialKey, x.shift, x.$status])));
  const refs = await p.evaluate(async () => { FP.current.clearCache(); const r = await FP.current.load('shifts', { fresh: true, history: true }); return r.rows.map(x => ({ operator: x.refs.operator, user: x.refs.user && x.refs.user.name })); });
  say('who', JSON.stringify(refs));
  await p.screenshot({ path: 'q3-board.png' });
  await t.snapshot('snapQB.json');
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
