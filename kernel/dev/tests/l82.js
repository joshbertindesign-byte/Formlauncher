// 0.53 The stress test (Admin › Stress test): every suite but the year of data, on a test folder; then the page.
const start = require('./dummies/base.js');
const SUITES = (process.env.SUITES || 'formulas,definitions,orphans,pressure,files').split(',');
(async () => {
  const { b, p, w, errs, say, setAnswer } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('console', m => { if (m.text().startsWith('STRESS ')) console.log(m.text().slice(7)); });
  await w(1200);
  const off = await p.evaluate(async () => FP.stress.run({ suites: ['formulas'], bench: document.body }).then(() => 'ran?!', e => e.message));
  say('real folder', off);
  // Admin › Test folder marks it (0.53): the folder's name must be typed.
  const adm = async section => { await p.evaluate(async s => { document.body.innerHTML = '<div id="adm"></div>'; await FP.editor.admin(document.getElementById('adm'), { section: s }); }, section); await w(800); };
  await adm('test');
  say('ordinary', (await p.$eval('#adm', x => x.innerText.replace(/\n+/g, ' / '))).slice(0, 160));
  setAnswer('wrong name'); await p.click('button:has-text("Mark this folder")'); await w(800);
  say('wrong name', `${await p.evaluate(() => FP.folder.isTest())} · ${await p.$eval('body', x => x.innerText.match(/That isn't the folder's name[^.]*/) ? 'refused' : 'no message')}`);
  const folder = await p.evaluate(() => FP.folder.handle.name);
  setAnswer(folder); await p.click('button:has-text("Mark this folder")'); await w(1200);
  say('marked', `${await p.evaluate(() => FP.folder.isTest())} · ${(await p.$eval('#adm', x => x.innerText.replace(/\n+/g, ' / '))).slice(0, 90)}`);
  await p.evaluate(async () => { window.__bench = document.createElement('div'); document.body.appendChild(window.__bench); });
  const t0 = Date.now();
  await p.evaluate(async suites => {
    window.__log = [];
    await FP.stress.run({ suites, bench: window.__bench, say: t => { window.__say = t; }, onStart: t => console.log('STRESS … ' + t.suite + '/' + t.id), onDone: (t, r) => { window.__log.push([t.suite, t.id, r.result, Math.round(r.ms), r.detail, (r.errors || []).join(' | ')]); console.log(`STRESS ${r.result.padEnd(5)} ${(t.suite + '/' + t.id).padEnd(28)} ${String(Math.round(r.ms)).padStart(7)} ms  ${r.detail}${r.errors && r.errors.length ? '  ERR: ' + r.errors.join(' | ') : ''}`); } });
  }, SUITES).catch(e => say('run threw', e.message));
  const log = await p.evaluate(() => window.__log);
  say('took', `${Math.round((Date.now() - t0) / 1000)} s`);
  // The page.
  await p.evaluate(async () => { document.body.innerHTML = '<div id="adm"></div>'; await FP.editor.admin(document.getElementById('adm'), { section: 'stress' }); });
  await w(1000);
  say('page', (await p.$eval('#adm', x => x.innerText.replace(/\n+/g, ' / '))).slice(0, 300));
  await p.screenshot({ path: 'l82.png', fullPage: true });
  await adm('test');
  await p.click('button:has-text("Make it an ordinary folder again")'); await w(1000);
  say('unmarked', String(await p.evaluate(() => FP.folder.isTest())));
  say('errs', JSON.stringify(errs).slice(0, 600));
  await b.close();
})();
