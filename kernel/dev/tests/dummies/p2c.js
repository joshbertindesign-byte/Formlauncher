const pilot = require('./pt.js');
(async () => {
  const t = await pilot({ at: '2026-11-19T05:50:00-06:00' });
  const { p, w, say } = t;
  console.log(await p.evaluate(() => Array.from(document.querySelectorAll('h1,input,button')).map(x => x.tagName + '.' + x.className + ':' + (x.textContent || x.placeholder).slice(0, 40) + ' parent=' + x.parentElement.className).join('\n')));
  await t.b.close();
})();
