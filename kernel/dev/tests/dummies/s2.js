const start = require('./base.js');
(async () => {
  const { b, p, w, errs, rows, props, say, add } = await start();
  await add('A structure', 'dies');
  for (const k of ['top', 'id', '+v']) { await p.click(`.ffm-r[data-key="${k}"]`); await w(400); say(k, await props()); say(k + ' in', await p.$$eval('.ffm-props input, .ffm-props select, .ffm-props textarea', l => l.map(x => x.tagName + ':' + (x.type||'') + ':' + (x.placeholder || '') + ':' + (x.tagName === 'SELECT' ? [...x.options].map(o => o.value + '=' + o.text).join(',') : '')).join(' | '))); }
  await p.screenshot({ path: 'd1-value.png' });
  say('errors', errs);
  await b.close();
})();
