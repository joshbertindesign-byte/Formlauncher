// 0.38.1: search keeps the focus; the library folds from its own corner; a slimmer bar.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap8.json', scale: 2 });
  await p.click('.fpe-lib input:not([type=checkbox])'); await p.keyboard.type('die s', { delay: 80 }); await w(300);
  say('typed', await p.$eval('.fpe-lib input:not([type=checkbox])', x => x.value) + ' | focused: ' + await p.evaluate(() => document.activeElement && document.activeElement.placeholder));
  say('found', await p.$$eval('.fpe-item', l => l.map(x => x.textContent).join(' | ')));
  say('bar', await p.$eval('.fpe-bar', x => Math.round(x.getBoundingClientRect().height) + 'px: ' + x.innerText.replace(/\n/g, ' · ')));
  await p.keyboard.press('Escape'); await p.fill('.fpe-lib input:not([type=checkbox])', ''); await w(200);
  await p.click('.fpe-item:has-text("Die setup check")'); await w(1500);
  await p.screenshot({ path: 'l44-open.png' });
  await p.click('.fpe-libhead button'); await w(500);
  say('hidden', await p.$eval('.fpe-libtab', x => getComputedStyle(x).display + ' ' + x.textContent));
  await p.screenshot({ path: 'l44-hidden.png' });
  await p.click('.fpe-libtab'); await w(500);
  say('shown', await p.$eval('.fpe-lib', x => getComputedStyle(x).display));
  say('errors', errs);
  await b.close();
})();
