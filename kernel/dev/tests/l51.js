const start = require('./dummies/base.js');
(async () => {
  const T = await start({ seed: 'dummies/snap7.json' });
  const { b, p, w, errs, say, add } = T;
  await add('A form', 'zz');
  await p.click('.ffm-r[data-key="+f"]'); await w(400);
  await p.click('.ffm-props button:text-matches("^Media")'); await w(600);
  say('on', await p.$$eval('.ffm-r.on', l => l.map(r => r.dataset.key)));
  say('name', await p.$eval('.ffm-props label.ffe-set >> nth=1', x => x.querySelector('input').value).catch(e => e.message));
  await p.fill('.ffm-props label.ffe-set >> nth=0 >> input', 'Setup sheet'); await w(500);
  say('name2', await p.$eval('.ffm-props label.ffe-set >> nth=1', x => x.querySelector('input').value + ' / ' + x.querySelector('.err').textContent).catch(e => e.message));
  say('lab', await p.$eval('.ffm-props label.ffe-set >> nth=0', x => x.outerHTML.slice(0,300)));
  say('on2', await p.$$eval('.ffm-r.on', l => l.map(r => r.dataset.key)));
  await p.click('.ffm-r[data-key="+f"]'); await w(400);
  await p.click('.ffm-props button:text-matches("^Value")'); await w(600);
  await p.fill('.ffm-props label.ffe-set >> nth=0 >> input', 'Some value'); await w(500);
  say('on3', await p.$$eval('.ffm-r.on', l => l.map(r => r.dataset.key)));
  await b.close();
})();
