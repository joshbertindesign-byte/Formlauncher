// Signed out behind the editor's back: the bar follows, and Publish asks for a sign-in, then publishes.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, add, say } = await start();
  await add('A structure', 'probe-signout');
  await p.evaluate(() => FP.users.signOut('switched'));   // as another window would
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await w(1500);
  say('gate', await p.$eval('.fp-u-card', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 80)).catch(() => 'no gate'));
  await p.click('.fp-u-card >> text=Josh'); await w(300); await p.keyboard.type('482913'); await w(1500);
  say('bar', await p.$eval('.fpe-who, button:has-text("Josh")', x => x.textContent).catch(() => '?'));
  // signed out again, then Publish
  await p.evaluate(() => FP.users.signOut('switched'));
  await p.click('.ffe-kinds button[data-kind="records"]').catch(() => {}); await w(400);
  await p.fill('input[placeholder^="What changed"]', 'test'); await p.click('button.primary:has-text("Publish")'); await w(1200);
  say('gate2', await p.$eval('.fp-u-card', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 60)).catch(() => 'no gate'));
  await p.click('.fp-u-card >> text=Josh'); await w(300); await p.keyboard.type('482913'); await w(2500);
  say('after', await p.$eval('.fpe-head', x => x.innerText.replace(/\n/g, ' ')).catch(() => '?'));
  say('msg', await p.evaluate(async () => { await FP.users.signOut('x'); return FP.defs.publish('structure', 'zz', { label: 'x', sites: ['all'] }).then(() => 'ok', e => e.message); }));
  say('errors', errs);
  await b.close();
})();
