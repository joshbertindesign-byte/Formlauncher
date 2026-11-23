// Pilot scenario A: lines, needs, start a shift (sub-form per line). Snapshot for the next stage.
const pilot = require('./pt.js');
(async () => {
  const t = await pilot({ at: '2026-11-19T05:40:00-06:00' });
  const { p, w, say } = t;
  await t.signIn('Josh', '482913');
  // Lines: 1 and 2 active; Line 3 runs two strands, A and B.
  await t.open('lines');
  for (const [id, belongs, on] of [['Line 1', null, true], ['Line 2', null, true], ['Line 3 A', 'Line 3', true], ['Line 3 B', 'Line 3', true]]) {
    await t.fill('lineId', id); await w(600);
    if (belongs) await t.fill('belongsTo', belongs);
    await t.seg('active', on ? 'Active' : 'Off');
    say('line ' + id, await t.why());
    await t.save('Save line');
  }
  say('lines', JSON.stringify((await t.items('lines')).filter(x => x.active).map(x => [x.$id, x.line, x.$status])));
  // Needs
  await t.open('needs');
  const need = async (line, prof, color, racks, prio) => {
    await t.pick('line', line); await t.pick('profile', prof); await t.seg('color', color);
    await t.fill('racks', racks); await t.seg('priority', prio); await w(800);
    say('need ' + prof, (await t.val('label')) + ' | ' + (await t.why()));
    await t.save('Add the need');
  };
  await need('Line 1', '805 CLAYTON', 'White', 3, '1 · first');
  await need('Line 1', '803 ABI', 'Almond', 2, '2');
  await need('Line 2', 'V819 MI WINDOWS', 'White', 5, '1 · first');
  await need('Line 2', '805 CLAYTON', 'White', 2, '2');
  await need('Line 3', '818 ABI', 'Black', 2, '1 · first');
  await need('Line 3', 'V816 MI WINDOWS', 'White', 4, '2');
  say('needs', JSON.stringify((await t.items('needs')).map(x => [x.$id, x.line, x.label, x.priority, x.$status])));
  await p.screenshot({ path: '../pilot/a-needs.png', fullPage: true });
  // Start the shift at 5:55
  await t.at('2026-11-19T05:55:00-06:00');
  await t.open('start-shift');
  say('start', await t.text('#form'));
  for (const l of ['Line 1', 'Line 2', 'Line 3 A']) await p.click(`[data-name="lineList"] button:text-is("${l}")`);
  await t.seg('caliper', 'Yes'); await w(800);
  say('why', await t.why());
  await p.click('.fpf button:has-text("What runs on each line")'); await w(3000);
  for (let i = 0; i < 3; i++) {
    const sheet = '.fpf-sheet:last-of-type';
    say('run ' + i, (await p.$eval(sheet, x => x.innerText.replace(/\n+/g, ' / '))).slice(0, 700));
    await p.click(`${sheet} [data-name="material"] button:text-is("Virgin")`); await w(800);
    await p.screenshot({ path: `../pilot/a-run${i}.png`, fullPage: true });
    say('run why', await p.$eval(`${sheet} .fpf-why`, x => x.innerText));
    await p.click(`${sheet} .fpf-foot button:has-text("Done")`); await w(2500);
  }
  say('back', await t.text('#form'));
  await t.save('Start the shift');
  say('after', await t.why());
  say('shifts', JSON.stringify(await t.items('shifts')));
  say('runs', JSON.stringify((await t.items('runs')).map(x => [x.$id, x.line, x.need, x.profile, x.color, x.lengthNom, x.pcsPerRack, x.startAt, x.shiftEndAt, x.$status])));
  await t.snapshot('snapPilotA.json');
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
