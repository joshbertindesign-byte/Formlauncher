// 0.44.3: start shift with lines added and taken out after the per-line sub-form: each line needs its own run, a line taken out drops its run.
const pilot = require('./pt.js');
(async () => {
  const t = await pilot({ at: '2026-11-19T05:40:00-06:00' });
  const { p, w, say } = t;
  await t.signIn('Josh', '482913');
  await t.open('lines');
  for (const [id, belongs] of [['Line 1', null], ['Line 2', null]]) { await t.fill('lineId', id); await w(600); await t.seg('active', 'Active'); await t.save('Save line'); }
  await t.open('needs');
  const need = async (line, prof, color, racks, prio) => { await t.pick('line', line); await t.pick('profile', prof); await t.seg('color', color); await t.fill('racks', racks); await t.seg('priority', prio); await w(800); await t.save('Add the need'); };
  await need('Line 1', '805 CLAYTON', 'White', 3, '1 · first');
  await need('Line 2', 'V819 MI WINDOWS', 'White', 5, '1 · first');
  await t.at('2026-11-19T05:55:00-06:00');
  await t.open('start-shift');
  const sheetText = async () => (await p.$$eval('.fpf-sheet', xs => xs.map(x => x.innerText.replace(/\n+/g, ' / ').slice(0, 420)))).join(' ### ');
  const btnState = async () => p.$eval('.fpf button:has-text("What runs on each line")', b => b.innerText.replace(/\n+/g, ' ') + (b.disabled ? ' [disabled]' : ''));
  // S2: one line first, then a second
  await p.click('[data-name="lineList"] button:text-is("Line 1")'); await t.seg('caliper', 'Yes'); await w(800);
  say('btn1', await btnState());
  await p.click('.fpf button:has-text("What runs on each line")'); await w(2500);
  say('sheet1', await sheetText());
  await p.click('.fpf-sheet:last-of-type [data-name="material"] button:text-is("Virgin")'); await w(600);
  await p.click('.fpf-sheet:last-of-type .fpf-foot button:has-text("Done")'); await w(2500);
  say('after1', (await sheetText()) || '(no sheet)');
  say('btn after1', await btnState() + ' | why ' + await t.why());
  await p.click('[data-name="lineList"] button:text-is("Line 2")'); await w(1200);
  say('btn 2 lines', await btnState() + ' | why ' + await t.why());
  await p.click('.fpf button:has-text("What runs on each line")'); await w(2500);
  say('sheet2', await sheetText());
  await p.click('.fpf-sheet:last-of-type [data-name="material"] button:text-is("Virgin")'); await w(600);
  await p.click('.fpf-sheet:last-of-type .fpf-foot button:has-text("Done")'); await w(2500);
  say('after2', ((await sheetText()) || '(no sheet)') + ' | ' + await btnState() + ' | why ' + await t.why());
  // take Line 1 out: its run goes, Save is fine with Line 2 alone
  await p.click('[data-name="lineList"] button:text-is("Line 1")'); await w(1500);
  say('minus L1', await btnState() + ' | why ' + await t.why() + ' | toast ' + await p.$$eval('.fpf-toast', x => x.map(y => y.textContent).join(' | ')));
  // put Line 1 back: it is to do again
  await p.click('[data-name="lineList"] button:text-is("Line 1")'); await w(1500);
  say('plus L1', await btnState() + ' | why ' + await t.why() + ' | save disabled ' + await p.$eval('.fpf-foot button:has-text("Start the shift")', b => b.disabled));
  await p.click('.fpf button:has-text("What runs on each line")'); await w(2500);
  say('sheet L1', (await sheetText()).slice(0, 120));
  await p.click('.fpf-sheet:last-of-type [data-name="material"] button:text-is("Virgin")'); await w(600);
  await p.click('.fpf-sheet:last-of-type .fpf-foot button:has-text("Done")'); await w(2500);
  say('both', ((await sheetText()) || '(no sheet)') + ' | ' + await btnState() + ' | why ' + await t.why());
  await t.save('Start the shift');
  say('runs', JSON.stringify((await t.items('runs')).map(x => [x.$id, x.line, x.need, x.profile])));
  await p.screenshot({ path: 'dbgss.png' });
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
