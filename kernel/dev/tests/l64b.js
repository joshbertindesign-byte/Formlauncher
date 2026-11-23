// After a purge: the launcher on a terminal set up before.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say, snapshot } = await start({ seed: 'dummies/snap15b.json' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  await p.evaluate(async () => { const fh = await FP.folder.handle.getFileHandle('THIS IS A TEST FOLDER.txt', { create: true }); const w = await fh.createWritable(); await w.write('test copy'); await w.close(); });
  await p.evaluate(() => FP.editor.purgeAll());
  await snapshot('purged.json');
  await b.close();
  const T = await start({ seed: 'purged.json' });
  T.p.on('dialog', d => d.accept().catch(() => {}));
  await T.p.goto('file:///home/claude/kernel/launcher.html'); await T.w(3000);
  T.say('launcher', (await T.p.innerText('body')).replace(/\n+/g, ' / ').slice(0, 400));
  await T.p.click('text=Set it up'); await T.w(500);
  await T.p.fill('.fp-gate-card input', 'T01'); await T.p.click('text=Save terminal ID'); await T.w(1000);
  T.say('site step', (await T.p.innerText('.fp-gate-card')).replace(/\n+/g, ' / '));
  await require('./site-step.js')(T.p, 'HOU', 'Houston'); await T.w(2500);
  T.say('home', (await T.p.innerText('body')).replace(/\n+/g, ' / ').slice(0, 300));
  T.say('errs', JSON.stringify(T.errs));
  await T.b.close();
})();
