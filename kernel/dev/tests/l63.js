// 0.42.1: Collapse all.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap14.json' });
  await w(1500);
  await p.click('.fpe-mrow:has-text("Die setup check")'); await w(1500);
  const rows = () => p.$$eval('.fpe-mrow', l => l.map(x => x.innerText.replace(/\n+/g, ' ')).join(' | '));
  say('before', await rows());
  await p.click('button:has-text("Collapse all")'); await w(800);
  say('all', await rows());
  await p.screenshot({ path: 'l63.png' });
  await p.reload(); await w(2500);
  say('kept', await rows());
  await p.click('button:has-text("Collapse to forms")'); await w(800);
  say('forms', await rows());
  say('errs', JSON.stringify(errs));
  await b.close();
})();
