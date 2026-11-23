const start = require('./base.js');
(async () => {
  const { b, p, w, errs, rows, props, say, add } = await start();
  const val = async n => { await p.click('.ffm-r[data-key="+v"]'); await w(300); await p.fill('.ffm-props input', n); await p.click('.ffm-props button:has-text("Add a value forms save to")'); await w(400); };
  // dies
  await add('A structure', 'dies');
  await p.click('.ffm-r[data-key="top"]'); await w(300); await p.fill('.ffm-props input >> nth=0', 'Dies'); await w(300);
  await p.click('.ffm-r[data-key="id"]'); await w(300); await p.fill('.ffm-props input >> nth=0', 'Die no.'); await p.selectOption('.ffm-props select', 'entered'); await w(400);
  for (const n of ['description', 'press', 'lowTemp', 'highTemp']) await val(n);
  say('dies', '\n  ' + await rows());
  await p.screenshot({ path: 'd2-dies.png' });
  await p.fill('.fpe-foot input, input[placeholder^="What changed"]', 'Die list: description, press, oven range');
  await p.click('button:has-text("Publish")'); await w(1500);
  say('pub', await p.$eval('.fpe-title, .fpe-head', x => x.innerText).catch(() => '?'));
  say('lib', await p.$$eval('.fpe-item', l => l.map(x => x.title || x.textContent).join(' | ')));
  // die-setups
  await add('A structure', 'die-setups');
  await p.click('.ffm-r[data-key="top"]'); await w(300); await p.fill('.ffm-props input >> nth=0', 'Die setups'); await w(300);
  await p.click('.ffm-r[data-key="id"]'); await w(300); await p.fill('.ffm-props input >> nth=0', 'Setup no.'); await p.selectOption('.ffm-props select', 'new'); await w(400);
  say('id new', await props());
  say('id in', await p.$$eval('.ffm-props input, .ffm-props select', l => l.map(x => x.tagName + ':' + (x.placeholder || '') + ':' + x.value).join(' | ')));
  for (const n of ['die', 'press', 'ovenTemp', 'result', 'notes']) await val(n);
  await p.click('.ffm-r[data-key="+st"]'); await w(400);
  say('st', await props());
  say('st in', await p.$$eval('.ffm-props input, .ffm-props select, .ffm-props textarea, .ffm-props [contenteditable]', l => l.map(x => x.tagName + ':' + (x.placeholder || '') + ':' + (x.value || x.textContent)).join(' | ')));
  say('rows', '\n  ' + await rows());
  await p.screenshot({ path: 'd3-setups.png' });
  say('errors', errs);
  await b.close();
})();
