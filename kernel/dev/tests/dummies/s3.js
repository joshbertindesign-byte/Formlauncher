const start = require('./base.js');
(async () => {
  const { b, p, w, errs, rows, props, say, add } = await start();
  await add('A structure', 'dies');
  await p.click('.ffm-r[data-key="top"]'); await w(300); await p.fill('.ffm-props input >> nth=0', 'Dies'); await w(300);
  await p.click('.ffm-r[data-key="id"]'); await w(300); await p.fill('.ffm-props input >> nth=0', 'Die no.'); await p.selectOption('.ffm-props select', 'entered'); await w(400);
  say('id', await props());
  await p.click('.ffm-r[data-key="+v"]'); await w(300); await p.fill('.ffm-props input', 'description'); await p.click('.ffm-props button:has-text("Add a value forms save to")'); await w(500);
  say('rows', '\n  ' + await rows());
  say('v', await props());
  say('v in', await p.$$eval('.ffm-props input, .ffm-props select, .ffm-props textarea', l => l.map(x => x.tagName + ':' + (x.type||'') + ':' + (x.placeholder || '') + ':' + (x.tagName === 'SELECT' ? [...x.options].map(o => o.value + '=' + o.text).join(',') : '')).join(' | ')));
  await p.screenshot({ path: 'd1-value.png' });
  say('errors', errs);
  await b.close();
})();
