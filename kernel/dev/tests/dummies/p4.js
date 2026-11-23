// Pilot scenario B: hour checks as the clock moves: due, late, closed (missed).
const pilot = require('./pt.js');
(async () => {
  const t = await pilot({ seed: 'snapPilotA.json', at: '2026-11-19T06:10:00-06:00' });
  const { p, w, say } = t;
  await t.signIn('Josh', '482913');
  // 0.47: the line board on the home screen shows each line's checks; a check opens from its card.
  const tiles = async () => t.board();
  const check = async (o) => {
    if (o.run) await t.act(o.run, 'Hourly check'); else if (!o.here) await t.open('hourly');
    say('form', `run=${await t.val('run')} slot=${await t.val('slot')}`);
    if (o.slot) await t.pick('slot', o.slot);
    await t.seg('lineStatus', o.status || 'Running');
    if ((o.status || 'Running') !== 'Down') {
      await t.fill('lengthAct', o.length); await t.seg('surface', o.surface || 'Pass'); await t.seg('colorCheck', o.color || 'Pass');
      await t.fill('speed', o.speed || 42); if (o.weight) await t.fill('weight', o.weight);
    }
    await w(800);
    say('  msgs', await p.$$eval('.fpf-msg', l => l.map(x => x.textContent).filter(Boolean).join(' | ')));
    say('  why', await t.why());
    await t.save('Save check');
  };
  say('06:10 tiles', await tiles());
  await p.screenshot({ path: '../pilot/b-board-0610.png', fullPage: true });
  await t.act('Line 1', 'Hourly check');
  await p.screenshot({ path: '../pilot/b-hourly-0610.png', fullPage: true });
  await check({ here: true, length: 179.1, weight: 0.24 });
  say('after L1', await tiles());
  await check({ run: 'Line 2', length: 192.6, weight: 0.065 });   // 0.6 over: warns
  // 07:20: L1 7AM due; L2 7AM due; L3A 6AM late + 7AM due
  await t.at('2026-11-19T07:20:00-06:00');
  say('07:20 tiles', await tiles());
  await t.open('hourly');
  say('07:20 default', `run=${await t.val('run')} slot=${await t.val('slot')} options=${(await t.options('slot')).join(',')}`);
  await p.screenshot({ path: '../pilot/b-hourly-0720.png', fullPage: true });
  await check({ length: 225.05, here: true });                 // the default: L3A 6 AM (late)
  say('after L3A 6', await tiles());
  await check({ run: 'Line 3 A', slot: '7 AM', status: 'Down' });   // the line down this hour
  await check({ run: 'Line 1', length: 179.0, surface: 'Fail' });
  // 08:30: L2's 7 AM is late, 8 due for everyone; L1 6 is done, 7 done.
  await t.at('2026-11-19T08:30:00-06:00');
  say('08:30 tiles', await tiles());
  // 09:05: L2's 7 AM has closed (missed); a stale slot can't be saved.
  await t.at('2026-11-19T09:05:00-06:00');
  say('09:05 tiles', await tiles());
  await t.act('Line 2', 'Hourly check');
  say('09:05 L2 slots', (await t.options('slot')).join(','));
  await p.screenshot({ path: '../pilot/b-hourly-0905.png', fullPage: true });
  const runs = await t.items('runs');
  say('runs', JSON.stringify(runs.map(r => [r.$id, r.checks, (r.doneSlots || []).map(s => new Date(s).getHours()), r.missed, r.avgSpeed, r.avgLength, r.surfaceFails, r.lineStatus])));
  await t.snapshot('snapPilotB.json');
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
