const pilot = require('./pt.js');
(async () => {
  const t = await pilot({ at: '2026-11-19T05:50:00-06:00' });
  const { p, w, say } = t;
  await t.signIn('Josh', '482913');
  say('body', (await t.text('body')).slice(0, 500));
  say('now', await p.evaluate(() => new Date().toString()));
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
