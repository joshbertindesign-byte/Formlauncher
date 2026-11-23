const start = require('./base.js');
(async () => {
  const { b, p, w, errs, rows, props, say, add } = await start();
  await p.screenshot({ path: 'd0-empty.png' });
  await p.click('.fpe-add'); await w(300);
  say('menu', await p.$$eval('button', l => l.map(b => b.textContent).filter(t => /^A /.test(t) || /A (form|structure|function|media)/.test(t)).join(' | ')));
  await p.screenshot({ path: 'd0-add.png' });
  await p.click('.fpe-add'); await w(200);
  await add('A structure', 'dies');
  say('rows', '\n  ' + await rows());
  await p.screenshot({ path: 'd1-new.png' });
  say('errors', errs);
  await b.close();
})();
