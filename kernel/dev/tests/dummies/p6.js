// Pilot: the needs board and the production report, from the scenario's data.
const pilot = require('./pt.js');
(async () => {
  const t = await pilot({ seed: process.env.SEED || 'snapPilotD.json', at: '2026-11-19T18:20:00-06:00' });
  const { p, w, say } = t;
  await p.setViewportSize({ width: 1366, height: 1000 });
  await t.signIn('Josh', '482913');
  await t.open('needs-board'); await w(1500);
  say('board', (await t.text('#form')).slice(0, 900));
  await p.screenshot({ path: '../pilot/d-board.png', fullPage: true });
  await t.open('production-report'); await w(2500);
  for (const tab of ['Summary', 'Day & crew', 'Profiles', 'Best line', 'Last time run', 'Quality', 'Every run']) {
    await p.click(`.fpf-tabbar button:has-text("${tab}")`); await w(1200);
    if (tab === 'Last time run') { await t.pick('profileF', '805 CLAYTON'); await w(2500); }
    say(tab, (await t.text('.fpf-panel:not(.fpf-off)')).slice(0, 700));
    await p.screenshot({ path: `../pilot/d-report-${tab.replace(/\W+/g, '')}.png`, fullPage: true });
  }
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
