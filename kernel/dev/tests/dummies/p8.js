// 0.44.4: a line runs another line's open need nobody is running; it is told so, and the run, racks and need keep it.
const pilot = require('./pt.js');
(async () => {
  const t = await pilot({ at: '2026-11-19T05:40:00-06:00' });
  const { p, w, say } = t;
  await t.signIn('Josh', '482913');
  await t.open('lines');
  for (const id of ['Line 1', 'Line 2']) { await t.fill('lineId', id); await w(600); await t.seg('active', 'Active'); await t.save('Save line'); }
  // Every need is on Line 1.
  await t.open('needs');
  const need = async (line, prof, color, racks, prio) => { await t.pick('line', line); await t.pick('profile', prof); await t.seg('color', color); await t.fill('racks', racks); await t.seg('priority', prio); await w(800); await t.save('Add the need'); };
  await need('Line 1', '805 CLAYTON', 'White', 3, '1 · first');
  await need('Line 1', '803 ABI', 'Almond', 2, '2');
  await need('Line 1', 'V819 MI WINDOWS', 'White', 1, '3 · last');
  await t.at('2026-11-19T05:55:00-06:00');
  await t.open('start-shift');
  for (const l of ['Line 1', 'Line 2']) await p.click(`[data-name="lineList"] button:text-is("${l}")`);
  await t.seg('caliper', 'Yes'); await w(800);
  await p.click('.fpf button:has-text("What runs on each line")'); await w(3000);
  const sheet = '.fpf-sheet:last-of-type';
  const opts = async () => p.$$eval(`${sheet} [data-name="need"] option`, l => l.map(o => o.textContent));
  // Line 1: its own needs, its first need filled in.
  say('L1 opts', (await opts()).join(' | '));
  say('L1 need', await p.$eval(`${sheet} [data-name="need"] select`, s => s.selectedOptions[0].textContent) + ' | noNeeds shown: ' + await p.$eval(`${sheet} [data-name="noNeeds"]`, x => !x.hidden && x.offsetParent !== null).catch(() => false));
  await p.click(`${sheet} [data-name="material"] button:text-is("Virgin")`); await w(600);
  await p.click(`${sheet} .fpf-foot button:has-text("Done")`); await w(2500);
  // Line 2: none of its own; Line 1's other needs (not the one Line 1 just took) are offered, marked.
  say('L2 sheet', (await p.$eval(sheet, x => x.innerText.replace(/\n+/g, ' / '))).slice(0, 360));
  say('L2 opts', (await opts()).join(' | '));
  const o = await p.$$eval(`${sheet} [data-name="need"] option`, l => l.map(x => [x.value, x.textContent]));
  const pick = o.find(([v, tx]) => /803 ABI/.test(tx));
  await p.selectOption(`${sheet} [data-name="need"] select`, pick[0]); await w(1200);
  say('L2 told', await p.$eval(`${sheet} [data-name="needFrom"]`, x => x.innerText.replace(/\n+/g, ' / ')));
  await p.screenshot({ path: '../pilot/e-borrow.png', fullPage: true });
  await p.click(`${sheet} [data-name="material"] button:text-is("Virgin")`); await w(600);
  await p.click(`${sheet} .fpf-foot button:has-text("Done")`); await w(2500);
  await t.save('Start the shift');
  say('runs', JSON.stringify((await t.items('runs')).map(x => [x.$id, x.need, x.needLine, x.offLine, x.profile])));
  // A rack on Line 2 counts toward Line 1's need, marked as made off its line.
  await t.at('2026-11-19T07:00:00-06:00');
  await t.open('rack');
  await t.pick('run', 'Line 2');
  await t.fill('rackId', 'R5001'); await w(800);
  say('rack note', await t.text('[data-name="needProgress"]'));
  await t.save('Save rack');
  const n = (await t.items('needs')).find(x => x.profile === '803 ABI');
  say('need', JSON.stringify({ made: n.made, madeOffLine: n.madeOffLine, madeOnLines: n.madeOnLines, note: n.offLineNote, status: n.$status }));
  say('rack', JSON.stringify((await t.items('racks')).map(x => [x.$id, x.line, x.need, x.needLine, x.offLine])));
  // Line 1 changes over: the need Line 2 is running isn't offered to it.
  await t.open('changeover');
  await t.pick('run', 'Line 1');
  await t.fill('partialLeft', 0); await w(1200);
  say('L1 changeover opts', (await t.options('need')).join(' | '));
  // The needs board says it.
  await t.open('needs-board');
  say('board', (await t.text('[data-name="board"]')).slice(0, 400));
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
