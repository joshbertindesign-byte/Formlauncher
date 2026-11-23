// Smoke: every pilot form opens at a launcher with no problem, as Josh (admin).
const pilot = require('./pt.js');
(async () => {
  const t = await pilot({ at: '2026-11-19T05:50:00-06:00' });
  const { p, w, say } = t;
  await t.signIn('Josh', '482913');
  say('home', await t.text('#form'));
  for (const f of ['profiles', 'lines', 'needs', 'change-need', 'start-shift', 'hourly', 'rack', 'changeover', 'end-shift', 'needs-board', 'production-report']) {
    await t.open(f);
    say(f, (await t.text('#form')).slice(0, 400));
    await p.screenshot({ path: `../pilot/s-${f}.png`, fullPage: true });
  }
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
