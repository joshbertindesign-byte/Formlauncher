// 0.52.1 Simulated terminals: launch.html?terminal=T09 runs as T09 on a test folder (its own ID, site, sign-ins and
// files), refused on a real folder; the computer's own terminal is untouched; Admin offers Open as.
const start = require('./dummies/base.js');
(async () => {
  // A real folder: refused.
  const R = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00', noSignIn: true });
  await R.p.goto('file:///home/claude/kernel/launcher.html?terminal=T09'); await R.w(3000);
  R.say('real folder', (await R.p.$eval('.fp-gate-card', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => 'no gate')).slice(0, 160));
  await R.b.close();
  // Marked as a test folder.
  const A = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  await A.w(1200);
  await A.p.evaluate(async () => { await FP.folder.handle.getFileHandle(FP.folder.TEST_MARK, { create: true }); });
  // The group pane offers Open as for its terminals.
  await A.p.click('.fpe-mrow:has-text("Production presses")'); await A.w(1500);
  A.say('group pane', (await A.p.$eval('.fpa-place', x => x.innerText.replace(/\n+/g, ' / '))).match(/Simulate[^]*?(?= \/ [A-Z][a-z]+ [a-z]+ ·| \/ Users who)/)?.[0] || 'no Simulate row');
  await A.snapshot('l81snap.json'); await A.b.close();

  const { b, p, w, errs, say } = await start({ seed: 'l81snap.json', at: '2026-11-18T13:05:00-06:00', noSignIn: true, dropKv: ['openSessions'] });
  p.on('dialog', d => d.accept().catch(() => {}));
  const signIn = async () => { if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh'); await w(300); await p.keyboard.type('482913'); await w(3000); } };
  await p.goto('file:///home/claude/kernel/launcher.html?terminal=T09'); await w(3000);
  say('gate', (await p.$eval('.fp-gate-card', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => 'no gate')).slice(0, 120));
  if (await p.$('.fp-gate-card button:has-text("(HOU)")')) { await p.click('.fp-gate-card button:has-text("(HOU)")'); await w(2500); }
  await signIn();
  say('T09', `${await p.$eval('.fpl-sim', x => x.textContent).catch(() => 'no badge')} · ${await p.$eval('#term', x => x.textContent)} · ${JSON.stringify(await p.evaluate(() => ({ id: FP.identity.terminalId, site: FP.identity.site, sim: FP.simulated })))}`);
  // It saves to its own file.
  const saved = await p.evaluate(async () => {
    await FP.entry.record({ entry: 'dies.update', item: { structure: 'dies', id: 'D-1047' }, form: { id: 'test', version: 1 }, values: { notes: 'from T09' } });
    await FP.outbox.flush();
    const day = FP.util.localDate(new Date());
    return { t09: await FP.files.readText(['data', 'dies', day], 'T09.jsonl').then(t => t.trim().split('\n').length, () => 0), reg: await FP.identity.lookup('T09').then(r => r && { site: r.site, simulated: r.simulated }) };
  });
  say('saved', JSON.stringify(saved));
  // Its settings are kept apart from the computer's own terminal (T01).
  say('kept apart', JSON.stringify(await p.evaluate(() => { const kv = new Map(window.__kvDump()); return { own: kv.get('terminalId'), sim: kv.get('sim:T09:terminalId'), simSite: kv.get('sim:T09:siteId'), folderShared: !kv.has('sim:T09:dataFolder') }; })));
  await p.goto('file:///home/claude/kernel/launcher.html'); await w(3000);
  say('own', `${JSON.stringify(await p.evaluate(() => ({ id: FP.identity.terminalId, sim: FP.simulated })))} · badge ${!!(await p.$('.fpl-sim'))}`);
  say('errs', JSON.stringify(errs));
  await b.close();
})();
