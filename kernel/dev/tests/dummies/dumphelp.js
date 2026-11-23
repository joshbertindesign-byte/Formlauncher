const start = require('./base.js');
(async () => {
  const t = await start({});
  const html = await t.p.evaluate(() => FP.help.exportHtml());
  require('fs').writeFileSync('help.html', html);
  const txt = await t.p.evaluate(h => { const d = document.createElement('div'); d.innerHTML = h; return d.innerText; }, html.replace(/^[\s\S]*<body>/, ''));
  require('fs').writeFileSync('help.txt', txt);
  console.log('errs', t.errs); await t.b.close();
})();
