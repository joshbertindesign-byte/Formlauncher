// 0.42: form-level media: tag matching, read again when the file changes, signatures saved with names.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap14.json' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const r = await p.evaluate(async () => {
    const put = async (parts, name, text) => { let d = window.__root; for (const x of parts) d = await d.getDirectoryHandle(x, { create: true }); const fh = await d.getFileHandle(name, { create: true }); const wr = await fh.createWritable(); await wr.write(text); await wr.close(); };
    await put(['media', 'notices'], 'Lockout notice.pdf', '%PDF notice');
    const def = JSON.parse(JSON.stringify(FP.defs.get('form', 'die-setup').def));
    const out = {};
    out.pick1047 = (await FP.media.pick(def, { die: 'D-1047' })).map(m => m.title + (m.missing ? ' (missing)' : ''));
    out.pick1052 = (await FP.media.pick(def, { die: 'D-1052' })).length;
    def.media.push({ path: 'notices/Lockout notice.pdf', tags: { die: 'all' } });
    out.pickAll = (await FP.media.pick(def, { die: 'D-1052' })).map(m => m.title);
    out.checkBad = FP.media.check({ media: [{ path: 'signatures/x.png' }, { path: 'a.pdf', tags: { 'Bad Tag': 'x' } }, { path: 'a.pdf' }] });
    out.parsed = FP.media.parseTags('die: D-1047, D-1052; kind: setup sheet');
    out.name = FP.media.parseName('signatures/2026-11/die-setup_DS-T01-20261118-0830-0032_sign_Dana-Ruiz_2026-11-18-083004.png');
    // a form with a signature, a photo and a read-first of the notice
    const f = { title: 'Sign-off', sites: ['all'], media: [{ path: 'notices/Lockout notice.pdf', title: 'Lockout notice', tags: { kind: 'notice' } }],
      sources: [{ name: 'chk', kind: 'item', structure: 'die-setups', id: { generate: true }, values: { notes: 'write' } }],
      acknowledge: [{ name: 'lock', label: 'Lockout', show: 'media', where: { kind: '"notice"' } }],
      fields: [{ name: 'notes', label: 'Notes', control: 'text', writes: 'chk.notes', required: true }, { name: 'sign', label: 'Signature', control: 'draw' },
        { name: 'pics', label: 'Photos', control: 'file', camera: true, accept: 'image/*' }, { name: 'doc', label: 'Notice', control: 'media', where: { kind: '"notice"' }, embed: false }] };
    out.formProblems = FP.forms.check(f);
    window.__F = f;
    document.body.innerHTML = '<div id="h" style="padding:20px;max-width:900px"></div>';
    window.__i = await FP.forms.open(document.getElementById('h'), 'sign-off', { def: f });
    return out;
  });
  Object.entries(r).forEach(([k, v]) => say(k, typeof v === 'string' ? v : JSON.stringify(v)));
  await w(1500);
  say('ack', await p.$eval('.fpf-acks', x => x.innerText.replace(/\n+/g, ' / ')).catch(e => e.message));
  say('media', await p.$eval('[data-name="doc"]', x => x.innerText.replace(/\n+/g, ' / ')).catch(e => e.message));
  const pop = p.context().waitForEvent('page', { timeout: 3000 }).catch(() => null);
  await p.click('.fpf-ack button:has-text("Open")'); const pg = await pop; if (pg) await pg.close();
  await w(500); await p.click('.fpf-ack button.ok'); await w(1200);
  say('acked', await p.$eval('.fpf-acks', x => x.innerText.replace(/\n+/g, ' / ')));
  // sign and photo
  const c = await p.$('[data-name="sign"] canvas'); const bb = await c.boundingBox();
  await p.mouse.move(bb.x + 20, bb.y + 20); await p.mouse.down(); await p.mouse.move(bb.x + 120, bb.y + 60, { steps: 8 }); await p.mouse.up(); await w(300);
  await p.setInputFiles('[data-name="pics"] input[type=file]', { name: 'pic.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) });
  await p.fill('[data-name="notes"] input', 'All good'); await p.keyboard.press('Tab'); await w(500);
  await p.click('#h button:has-text("Save")'); await w(2500);
  say('saved', JSON.stringify(await p.evaluate(async () => {
    FP.current.clearCache();
    const rows = (await FP.current.load('die-setups')).rows.filter(r => r.form && r.form.id === 'sign-off');
    const sub = (await FP.current.load('submissions')).rows.filter(r => r.form && r.form.id === 'sign-off');
    const walk = async (parts) => { let d = window.__root; for (const x of parts) d = await d.getDirectoryHandle(x); const o = []; for await (const [n, h] of d.entries()) o.push(n); return o; };
    const month = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; })();
    return { item: rows.map(r => [r.item.id, r.values]), sub: sub.map(r => r.values), sigs: await walk(['media', 'signatures', month]).catch(e => e.message), photos: await walk(['media', 'photos', month]).catch(e => e.message) };
  })));
  // the file changes: read again
  await p.evaluate(async () => {
    await new Promise(r => setTimeout(r, 1100));
    let d = window.__root; for (const x of ['media', 'notices']) d = await d.getDirectoryHandle(x); const fh = await d.getFileHandle('Lockout notice.pdf'); const wr = await fh.createWritable(); await wr.write('%PDF notice rev 2'); await wr.close();
    document.body.innerHTML = '<div id="h" style="padding:20px;max-width:900px"></div>';
    window.__i = await FP.forms.open(document.getElementById('h'), 'sign-off', { def: window.__F });
  });
  await w(1500);
  say('changed', await p.$eval('.fpf-acks', x => x.innerText.replace(/\n+/g, ' / ')));
  say('errs', JSON.stringify(errs));
  await b.close();
})();
