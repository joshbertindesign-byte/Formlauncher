// 0.42.2: Purge all data keeps the people.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const tree = () => p.evaluate(async () => { const walk = async (d, depth) => { const o = []; for await (const [n, h] of d.entries()) { if (h.kind === 'directory') { o.push(n + (depth < 1 ? '(' + (await walk(h, depth + 1)).join(',') + ')' : '/')); } } return o; }; return (await walk(window.__root, 0)).join(' '); });
  say('before', await tree());
  await p.click('.fpe-adminbtn:not(.fpe-helpbtn)'); await w(1500);
  // 0.45: off until the folder is marked as a test folder
  await p.click('.fpa-tabs button:has-text("Purge all data")'); await w(1000);
  say('off', (await p.$eval('.fpa-body, .ffm, body', x => x.innerText)).match(/Purge is off[^\n]*/) + ' · refused: ' + await p.evaluate(() => FP.editor.purgeAll().then(() => 'purged?!', e => e.message.slice(0, 60))));
  await p.evaluate(async () => { const fh = await FP.folder.handle.getFileHandle('THIS IS A TEST FOLDER.txt', { create: true }); const w = await fh.createWritable(); await w.write('test copy'); await w.close(); });
  await p.click('.fpa-tabs button:has-text("Launchers")'); await w(600);
  await p.click('.fpa-tabs button:has-text("Purge all data")'); await w(1000);
  await p.click('.ffm-r[data-key="purge"]'); await w(500);
  say('pane', await p.$eval('.ffm-props', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 300)));
  await p.screenshot({ path: 'l64.png' });
  await p.click('.ffm-props button.primary'); await w(800);
  say('no word', await p.$$eval('.fpe-toast, [class*=toast]', l => l.map(x => x.innerText).join(' | ')));
  await p.fill('.ffm-props input[placeholder="type PURGE"]', 'PURGE');
  await p.click('.ffm-props button.primary'); await w(3000);
  say('toast', await p.$$eval('.fpe-toast, [class*=toast]', l => l.map(x => x.innerText).join(' | ')));
  say('after', await tree());
  say('state', JSON.stringify(await p.evaluate(async () => ({ defs: FP.defs.list().length, users: (await FP.users.list(true)).map(u => u.name), sites: (await FP.sites.list()).length, terms: (await FP.identity.all()).length, groups: (await FP.groups.list()).length, media: (await FP.media.browse([])).folders }))));
  await p.click('text=☰ Map').catch(() => {}); await w(800);
  say('map', await p.$$eval('.fpe-mrow', l => l.map(x => x.innerText.replace(/\n+/g, ' ')).join(' | ')));
  say('errs', JSON.stringify(errs));
  await b.close();
})();
