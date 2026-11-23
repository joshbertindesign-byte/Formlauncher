// 0.45 Safe now: media files that could carry script are sandboxed; clock warnings stand above the launcher;
// wrong PINs lock the person on every terminal.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1200);
  // S1: an HTML file in media, shown by a media field: it is shown, its script doesn't run.
  const r = await p.evaluate(async () => {
    await FP.files.writeText(['media'], 'evil.html', '<p>Setup</p><script>try { parent.__pwned = 1; } catch (e) {} document.title = "ran";</script>');
    await FP.files.writeText(['media'], 'sheet.pdf', '%PDF-1.4');
    const def = { title: 'Media', sites: ['all'], media: [{ path: 'evil.html', title: 'Evil', tags: {} }], buttons: [],
      fields: [{ name: 'm', control: 'media', label: 'Files', embed: true }] };
    const host = document.createElement('div'); host.id = 'mt'; document.body.appendChild(host);
    window.__mt = await FP.forms.open(host, 'media-t', { def, preview: true, draft: false });
    await new Promise(res => setTimeout(res, 1200));
    const fr = host.querySelector('iframe');
    const a = await FP.media.open('evil.html'), pdf = await FP.media.open('sheet.pdf');
    return { sandbox: fr ? fr.getAttribute('sandbox') : 'no frame', pwned: window.__pwned || null, active: a.active, pdfActive: pdf.active };
  });
  say('media', JSON.stringify(r));
  // S3: five wrong PINs, each "on another terminal" (the terminal's own lock cleared between), lock the person.
  const lock = await p.evaluate(async () => {
    const dana = (await FP.users.list(true)).find(u => u.name === 'Dana Ruiz');
    const out = [];
    for (let i = 0; i < 5; i++) { await FP.kv.set('pinLock', { fails: 0, until: 0 }); out.push(await FP.users.verify(dana.id, '000000').then(() => 'ok', e => e.message.slice(0, 30))); await FP.outbox.flush(); }
    await FP.kv.set('pinLock', { fails: 0, until: 0 });
    FP.current.clearCache();
    const right = await FP.users.verify(dana.id, '864201').then(() => 'signed in', e => e.message);
    return { tries: out.join(' | '), right };
  });
  say('lock', JSON.stringify(lock));
  // A5: a clock disagreement stands above the launcher's notices.
  await p.goto('file:///home/claude/kernel/launcher.html'); await w(3000);
  if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh'); await w(300); await p.keyboard.type('482913'); await w(2000); }
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('fp-clock', { detail: { ahead: [{ terminal: 'T02', aheadMs: 7 * 60000 }] } })));
  await w(300);
  say('clock', await p.$eval('.fpl-notice.bad', x => x.textContent).catch(() => 'no banner'));
  say('errs', JSON.stringify(errs));
  await b.close();
})();
