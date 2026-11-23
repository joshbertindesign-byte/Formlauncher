// 0.41: installing the release writes launch.html; it boots the home screen.
const start = require('./dummies/base.js'); const fs = require('fs');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap14.json' });
  const zip = fs.readFileSync('fixtures/kernel-0.42.0.zip').toString('base64');
  const r = await p.evaluate(async z => {
    const bytes = Uint8Array.from(atob(z), c => c.charCodeAt(0));
    let d = window.__root; d = await d.getDirectoryHandle('updates', { create: true });
    const fh = await d.getFileHandle('kernel-0.42.0.zip', { create: true }); const wr = await fh.createWritable(); await wr.write(new Blob([bytes])); await wr.close();
    const out = await FP.updates.install('kernel-0.42.0.zip', { allowOlder: true });
    const t = await FP.files.readText([], 'launch.html');
    return { v: out.version, launch: !!t && /runtime\/boot\.js/.test(t) };
  }, zip).catch(e => ({ err: e.message }));
  say('install', JSON.stringify(r));
  say('errs', JSON.stringify(errs));
  await b.close();
})();
