const start = require('./base.js');
(async () => {
  const t = await start({});
  const r = await t.p.evaluate(() => FP.formulaTests.run());
  console.log('passed', r.passed, 'failed', r.failed);
  r.results.filter(x => !x.ok).forEach(x => console.log('FAIL', x.name, JSON.stringify(x.got), 'want', JSON.stringify(x.want)));
  console.log('errs', t.errs); await t.b.close();
})();
