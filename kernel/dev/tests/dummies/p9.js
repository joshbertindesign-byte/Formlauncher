// Pilot 0.46 Faster checks: All pass, the line's status carried from the last check, the saved banner naming
// what was saved, the number pad resting in its place, "Saving as … · Not you?", material from the line's last run.
const pilot = require('./pt.js');
(async () => {
  const t = await pilot({ seed: 'snapPilotA.json', at: '2026-11-19T06:10:00-06:00' });
  const { p, w, say } = t;
  await t.signIn('Josh', '482913');
  const pressed = name => p.$$eval(`[data-name="${name}"] .fpf-seg button[aria-pressed="true"]`, l => l.map(b => b.textContent).join(',') || '—').catch(() => 'hidden');
  say('board', await t.board());
  await t.act('Line 1', 'Hourly check');
  // O5: the pad rests in its place while the form is up; focusing a number doesn't move the form.
  const formW = () => p.$eval('.fpf', x => Math.round(x.getBoundingClientRect().width));
  const before = await formW();
  say('resting', JSON.stringify(await p.evaluate(() => ({ resting: FP.keyboard.resting(), right: getComputedStyle(document.documentElement).getPropertyValue('--fp-kb-right').trim() }))));
  await p.click('[data-name="lengthAct"] input'); await w(400);
  const during = await formW();
  say('pad', JSON.stringify(await p.evaluate(() => { const s = FP.keyboard.showing(); return s && s.kind; })) + ` · form ${before}px → ${during}px`);
  // O4: no check yet on this run: Running.
  say('status', await pressed('lineStatus'));
  // O1: who saves.
  say('as', await t.text('.fpf-as'));
  // O3: All pass.
  await t.pick('run', 'Line 2');
  await t.fill('lengthAct', 192.1);
  say('before', `${await pressed('surface')} ${await pressed('colorCheck')}`);
  await p.click('button:has-text("All pass")'); await w(600);
  say('all pass', `${await pressed('surface')} ${await pressed('colorCheck')} ${await pressed('gaugeCheck')}`);
  await t.seg('lineStatus', 'Start up');
  await t.fill('speed', 40);
  await w(600);
  say('why', await t.why());
  await p.click('.fpf-foot button:has-text("Save check")'); await w(700);
  // O6: the banner names the run and the hour.
  say('banner', await t.text('.fpf-toast.saved'));
  await p.screenshot({ path: '../pilot/f-allpass.png' });
  await w(2000);
  // O4: the next hour starts from what the last check said (Start up).
  await t.at('2026-11-19T07:20:00-06:00'); await t.open('hourly');
  await t.pick('run', 'Line 2'); await w(800);
  say('next hour', `${await t.val('slot')} · ${await pressed('lineStatus')}`);
  // Down hides the checks and All pass.
  await t.seg('lineStatus', 'Down'); await w(500);
  say('down', `${await p.isVisible('button:has-text("All pass")')} · ${await pressed('surface')}`);
  // O9: a changeover to a run of the same profile starts with the line's last material.
  await t.at('2026-11-19T10:30:00-06:00');
  await t.open('changeover');
  await t.pick('run', 'Line 1'); await w(600);
  say('co default', `${await t.val('need')} · material ${await pressed('material')}`);
  await t.pick('need', 'Not on the needs list'); await w(600);
  await t.pick('otherProfile', '805 CLAYTON'); await w(1200);
  say('co same', `material ${await pressed('material')}`);
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
