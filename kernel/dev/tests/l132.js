// F14 updates: only the files release.json names are written; no crypto.subtle means no install; a releases.js that is
// there but unreadable fails the install and deletes nothing. Fails on a non-empty errs list.
const start = require('./dummies/base.js');
const fs = require('fs');
(async () => {
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  const { b, p, w, errs } = await start({});
  const extra = fs.readFileSync('fixtures/kernel-0.44.0-extra.zip').toString('base64');
  const plain = fs.readFileSync('fixtures/kernel-0.44.0.zip').toString('base64');
  const put = (name, b64) => p.evaluate(async ([name, b64]) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const d = await FP.folder.dir(['updates'], true);
    const fh = await d.getFileHandle(name, { create: true }); const wr = await fh.createWritable(); await wr.write(new Blob([bytes])); await wr.close();
  }, [name, b64]);
  const read = (dir, name) => p.evaluate(async ([dir, name]) => FP.files.readText(dir, name).then(t => (t == null ? null : t.slice(0, 40)), () => null), [dir, name]);

  // 1. A file in the zip that release.json doesn't name is not written.
  await put('kernel-0.44.0.zip', extra);
  const r1 = await p.evaluate(() => FP.updates.install('kernel-0.44.0.zip', { allowOlder: true }).then(r => r.version, e => 'ERR ' + e.message));
  console.log('install', r1);
  ok(r1 === '0.44.0', 'install worked: ' + r1);
  ok((await read(['runtime', '0.44.0'], 'fp-notlisted.js')) === null, 'F14 an unlisted .js was written');
  ok((await read(['runtime', '0.44.0'], 'fp-core.js')) !== null, 'a listed file was written');

  // 2. No crypto.subtle: nothing is checked, so nothing is installed.
  await put('kernel-0.44.0.zip', plain);
  const before = await read(['runtime'], 'releases.js');
  const r2 = await p.evaluate(async () => {
    Object.defineProperty(window.crypto, 'subtle', { get: () => undefined, configurable: true });
    const out = await FP.updates.install('kernel-0.44.0.zip', { allowOlder: true }).then(() => 'TOOK', e => e.message);
    delete window.crypto.subtle;
    return out;
  });
  console.log('no subtle', r2);
  ok(/can't check|secure context/.test(r2), 'F14 install without crypto.subtle: ' + r2);
  ok((await read(['runtime'], 'releases.js')) === before, 'releases.js changed without crypto.subtle');

  // 3. releases.js there but unreadable (half-synced): the install stops and other releases stay.
  await p.evaluate(async () => {
    const d = await FP.folder.dir(['runtime'], true);
    for (const v of ['0.43.0', '0.42.0']) { const sub = await d.getDirectoryHandle(v, { create: true }); const fh = await sub.getFileHandle('fp-core.js', { create: true }); const wr = await fh.createWritable(); await wr.write('x'); await wr.close(); }
    const fh = await d.getFileHandle('releases.js', { create: true }); const wr = await fh.createWritable(); await wr.write('window.FP_RELEASES = {"current":"0.4'); await wr.close();
  });
  const r3 = await p.evaluate(() => FP.updates.install('kernel-0.44.0.zip', { allowOlder: true }).then(() => 'TOOK', e => e.message));
  console.log('bad releases.js', r3);
  const dirs = await p.evaluate(() => FP.files.listDirs(['runtime']));
  ok(/can't be read/.test(r3), 'F14 unreadable releases.js: ' + r3);
  ok(dirs.includes('0.43.0') && dirs.includes('0.42.0'), 'F14 other releases deleted: ' + dirs.join());
  ok((await read(['runtime'], 'releases.js')) === 'window.FP_RELEASES = {"current":"0.4', 'releases.js was rewritten');
  await b.close();
  const all = fails.concat(errs);
  console.log('errs      :', JSON.stringify(all));
  process.exit(all.length ? 1 : 0);
})();
