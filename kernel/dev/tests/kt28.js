const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../..') + '/kernel-test.html'); await p.waitForTimeout(800);
  const banner = await p.$('#fp-problems'); if (banner) console.log('BANNER:', await banner.textContent());
  console.log(await p.evaluate(() => { const a = FP.formulaTests.run(), l = FP.lookupTests.run(); return `formula ${a.passed}/${a.passed + a.failed} lookup ${l.passed}/${l.passed + l.failed} ` + JSON.stringify(a.results.concat(l.results).filter(r => !r.ok)); }));
  console.log('errors', errs); await b.close();
})();
