// 0.44: installing an update shows a panel: spinner, the step it is on, a bar; then how it went.
const start = require('./dummies/base.js');
const fs = require('fs');
(async () => {
  const { b, p, w, errs, say } = await start({});
  const zip = fs.readFileSync('fixtures/kernel-0.44.0.zip').toString('base64');
  await p.evaluate(async b64 => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const d = await FP.folder.dir(['updates'], true);
    const fh = await d.getFileHandle('kernel-0.44.0.zip', { create: true }); const wr = await fh.createWritable(); await wr.write(new Blob([bytes])); await wr.close();
    window.__steps = [];
    new MutationObserver(() => { const s = document.querySelector('.fpu-step'); if (s && window.__steps[window.__steps.length - 1] !== s.textContent) window.__steps.push(s.textContent); }).observe(document.body, { subtree: true, childList: true, characterData: true });
    // Slow the writes down the way a OneDrive folder is, so the panel can be seen working.
    const wt = FP.files.writeText; FP.files.writeText = async (...a) => { await new Promise(r => setTimeout(r, 40)); return wt(...a); };
    window.__run = FP.updates.installShown('kernel-0.44.0.zip', { allowOlder: true }).then(r => ({ ok: r.version }), e => ({ err: e.message }));
  }, zip);
  await w(700);
  say('during', JSON.stringify(await p.evaluate(() => ({ panel: !!document.querySelector('.fpu-veil'), spin: !!document.querySelector('.fpu-spin'), title: document.querySelector('#fpu-title').textContent, busy: FP.updates.installing() }))));
  await p.screenshot({ path: 'l69-during.png' });
  say('result', JSON.stringify(await p.evaluate(() => window.__run)));
  await w(200);
  say('after', JSON.stringify(await p.evaluate(() => ({ cls: document.querySelector('.fpu-card').className, title: document.querySelector('#fpu-title').textContent, step: document.querySelector('.fpu-step').textContent, bar: document.querySelector('.fpu-bar').getAttribute('aria-valuenow'), busy: FP.updates.installing() }))));
  await p.screenshot({ path: 'l69-done.png' });
  const steps = await p.evaluate(() => window.__steps);
  say('steps', steps.length + ': ' + steps.filter(s => !/^Writing file/.test(s)).join(' › ') + ` (+${steps.filter(s => /^Writing file/.test(s)).length} file steps)`);
  await p.click('.fpu-foot button'); await w(200);
  say('closed', String(!(await p.$('.fpu-veil'))));
  // A zip that isn't a release: the panel says so.
  await p.evaluate(async () => { const d = await FP.folder.dir(['updates'], true); const fh = await d.getFileHandle('bad.zip', { create: true }); const wr = await fh.createWritable(); await wr.write(new Blob(['not a zip'])); await wr.close(); });
  say('bad', JSON.stringify(await p.evaluate(() => FP.updates.installShown('bad.zip').then(() => 'installed?!', e => e.message))));
  say('badpanel', await p.$eval('.fpu-card', x => x.className + ' · ' + x.innerText.replace(/\n+/g, ' / ')));
  await p.screenshot({ path: 'l69-bad.png' });
  say('errs', JSON.stringify(errs));
  await b.close();
})();
