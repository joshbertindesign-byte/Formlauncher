// 0.43: Admin › Packs: install the production pilot pack through the page; make a pack back.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  await p.click('.fpe-adminbtn:not(.fpe-helpbtn)'); await w(1500);
  await p.click('.fpa-tabs button:has-text("Packs")'); await w(1000);
  await p.click('.ffm-r[data-key="pick"]'); await w(500);
  await p.setInputFiles('.ffm-props input[type=file]', 'pilot/production-pilot.json'); await w(2500);
  say('rows', (await p.$$eval('.ffm-r', l => l.map(x => x.innerText.replace(/\n+/g, ' ')))).slice(0, 6).join(' | '));
  say('install row', await p.$eval('.ffm-r[data-key="+install"]', x => x.innerText).catch(e => e.message.slice(0, 80)));
  await p.screenshot({ path: 'l66-plan.png', fullPage: true });
  await p.click('.ffm-r[data-key="+install"]'); await w(15000);
  say('toast', await p.$$eval('.fpe-toast, [class*=toast]', l => l.map(x => x.innerText).join(' | ')));
  say('defs', JSON.stringify(await p.evaluate(() => ({ forms: FP.defs.list('form').map(d => d.id).filter(x => ['hourly', 'rack', 'production-report'].includes(x)), profiles: 0 }))));
  say('items', JSON.stringify(await p.evaluate(async () => [(await FP.current.load('profiles', { fresh: true })).items.size, (await FP.current.load('lines', { fresh: true })).items.size])));
  const pk = await p.evaluate(async () => { const x = await FP.packs.make({ name: 'Back', structures: ['profiles'] }); return [x.definitions.length, x.items.profiles.length, Object.keys(x.items.profiles[0].values).length]; });
  say('made', JSON.stringify(pk));
  say('errs', JSON.stringify(errs));
  await b.close();
})();
