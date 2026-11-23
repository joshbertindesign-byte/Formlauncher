// Pilot 0.51, step 2, the QC office PC (admin view): lines on, profiles changed by tapping them, needs added,
// a need changed by tapping it on the board. Snapshot for the line terminals.
const pilot = require('../dummies/pt.js');
(async () => {
  const t = await pilot({ seed: 'snapQ.json', at: '2026-11-19T05:20:00-06:00' });
  const { p, w, say } = t;
  // T01 is a line terminal: only supervisors and up sign in. Josh (admin) makes it the QC office PC for this step.
  say('gate', (await t.text('.fp-u-card')).slice(0, 120));
  await t.signIn('Josh', '482913');
  await p.evaluate(async () => { const g = (await FP.groups.list()).find(x => x.name === 'QC office'); await FP.groups.update(g.id, { terminals: ['T01'] }); await FP.launcher.home(); });
  await w(2500);
  const side = async () => (await p.$$eval('#side button', l => l.map(x => x.textContent + (x.classList.contains('on') ? '*' : '')))).join(' | ');
  say('office', `${await t.text('#title')} · list: ${await side()} · home form ${await p.$$eval('.fpl-board', l => l.map(x => x.dataset.form).join(','))}`);
  const open = async form => { await p.click(`#side button[data-form="${form}"]`); await w(2500); };
  // Lines: tap Line 1 and Line 2 in the list and turn them on; Line 3 runs two strands.
  await open('lines');
  for (const id of ['Line 1', 'Line 2']) {
    await p.click(`[data-name="all"] tr:has(td:text-is("${id}"))`); await w(900);
    say('tap ' + id, `${await t.val('lineId')} · belongs to ${await t.val('belongsTo')}`);
    await t.seg('active', 'Active'); await t.save('Save line');
  }
  for (const id of ['Line 3 A', 'Line 3 B']) {
    await t.fill('lineId', id); await w(600); await t.fill('belongsTo', 'Line 3'); await t.seg('active', 'Active');
    say('new ' + id, await t.why()); await t.save('Save line');
  }
  say('lines', JSON.stringify((await t.items('lines')).filter(x => x.active).map(x => `${x.$id}→${x.line}`)));
  // Profiles: tap one to change it.
  await open('profiles');
  await p.click('[data-name="all"] tr:has(td:text-is("805 CLAYTON"))'); await w(1200);
  say('tap profile', `${await t.val('isNew')} · length ${await t.val('lengthIn')} · ${await t.val('pcsPerRack')} a rack · marked ${await p.$$eval('[data-name="all"] tr.sel', l => l.length)}`);
  await p.fill('[data-name="notes"] textarea', 'Watch the color on startup'); await w(400);
  await t.save('Save profile');
  say('saved profile', `notes ${(await t.items('profiles')).find(x => x.$id === '805 CLAYTON').notes}`);
  // Needs.
  await open('needs');
  const need = async (line, prof, color, racks, prio) => {
    await t.pick('line', line); await t.pick('profile', prof); await t.seg('color', color);
    await t.fill('racks', racks); await t.seg('priority', prio); await w(700);
    await t.save('Add the need');
  };
  await need('Line 1', '805 CLAYTON', 'White', 3, '1 · first');
  await need('Line 1', '803 ABI', 'Almond', 2, '2');
  await need('Line 2', 'V819 MI WINDOWS', 'White', 5, '1 · first');
  await need('Line 2', '805 CLAYTON', 'White', 2, '2');
  await need('Line 3', '818 ABI', 'Black', 2, '1 · first');
  await need('Line 3', 'V816 MI WINDOWS', 'White', 4, '2');
  say('needs', JSON.stringify((await t.items('needs')).map(x => [x.$id, x.line, x.label, x.part, x.customer, x.colorName, x.$status])));
  // Change a need: tap it on the board.
  await open('change-need');
  say('before tap', `${await t.val('done')} · ${await t.why()}`);
  await p.click('[data-name="open"] .fpv-tile:has-text("803 ABI")'); await w(1200);
  say('tapped', `${await t.val('pick')} · ${await t.val('done')} · racks ${await t.val('racks')}`);
  await t.fill('racks', 4); await w(500);
  await t.save('Save the change');
  const n = (await t.items('needs')).find(x => x.profile === '803 ABI');
  say('changed', `${n.label} · ${n.racks} racks · ${n.$status}`);
  await p.screenshot({ path: 'q2-office.png' });
  // Back to a line terminal for the next step.
  await p.evaluate(async () => { const g = (await FP.groups.list()).find(x => x.name === 'Line terminals'); await FP.groups.update(g.id, { terminals: ['T01'] }); });
  await w(800);
  await t.snapshot('snapQA.json');
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
