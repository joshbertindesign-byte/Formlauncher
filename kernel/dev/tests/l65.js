// 0.42.3: purge takes drafts too, and the map forgets them.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap14.json' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  await p.evaluate(async () => { await FP.defs.drafts.save('form', 'half-done', { def: { title: 'Half done', fields: [] } }); await FP.defs.drafts.save('structure', 'scratch', { def: { label: 'Scratch' } }); window.dispatchEvent(new CustomEvent('fp-drafts')); });
  await w(800);
  // an edited form left open
  await p.click('.fpe-mrow:has-text("Add or change a die")'); await w(1500);
  await p.click('.ffm-r[data-key="form"]'); await w(300); await p.fill('.ffm-props input >> nth=0', 'Add or change a die!'); await w(400);
  say('map before', await p.$$eval('.fpe-mrow', l => l.map(x => x.innerText.replace(/\n+/g, ' ')).filter(t => /raft|Half|Scratch/.test(t)).join(' | ')));
  await p.click('.fpe-adminbtn:not(.fpe-helpbtn)'); await w(1500);
  say('drafts now', JSON.stringify(await p.evaluate(async () => (await FP.defs.drafts.list()).map(d => d.kind + ':' + d.id))));
  await p.evaluate(async () => { const fh = await FP.folder.handle.getFileHandle('THIS IS A TEST FOLDER.txt', { create: true }); const w = await fh.createWritable(); await w.write('test copy'); await w.close(); });
  await p.click('.fpa-tabs button:has-text("Purge all data")'); await w(800);
  await p.click('.ffm-r[data-key="purge"]'); await w(400);
  await p.fill('.ffm-props input[placeholder="type PURGE"]', 'PURGE'); await p.click('.ffm-props button.primary'); await w(4000);
  say('drafts after', JSON.stringify(await p.evaluate(async () => (await FP.defs.drafts.list()).map(d => d.kind + ':' + d.id))));
  say('map after', await p.$$eval('.fpe-mrow', l => l.map(x => x.innerText.replace(/\n+/g, ' ')).join(' | ')));
  say('errs', JSON.stringify(errs));
  await b.close();
})();
