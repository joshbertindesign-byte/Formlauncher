// F38 media: Windows reserved names (CON, NUL, COM1...) are not file names; the capture folders (signatures, photos, files,
// library) are recognised whatever their capital letters; the viewer's blob URL isn't revoked after 60 seconds.
// Fails on a non-empty errs list.
const start = require('./dummies/base.js');
(async () => {
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  const A = await start({ seed: 'dummies/snap15.json', at: '2026-11-18T13:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  await A.w(1500);
  const r = await A.p.evaluate(async () => {
    const out = {};
    out.names = ['CON.pdf', 'nul', 'Com1.txt', 'LPT9.png', 'AUX', 'Console.pdf', 'communication.pdf', 'COM10.pdf', 'prn.PDF'].map(n => FP.media.safeName(n));
    const d = await FP.folder.dir(['media', 'Photos'], true);
    const fh = await d.getFileHandle('x.png', { create: true }); const wr = await fh.createWritable(); await wr.write('x'); await wr.close();
    await FP.folder.dir(['media', 'LIBRARY'], true);
    await FP.folder.dir(['media', 'Drawings'], true);
    const top = await FP.media.browse([]);
    out.folders = top.folders;
    out.addInto = await FP.media.add(new File(['x'], 'a.txt', { type: 'text/plain' }), 'Signatures').then(p => 'TOOK ' + p, e => e.message.slice(0, 40));
    out.check = FP.media.check({ media: [{ path: 'Library/x.pdf' }, { path: 'PHOTOS/y.png' }] });
    // The viewer's URL stays good: nothing revokes it a minute later.
    await FP.media.add(new File(['%PDF-1.4'], 'v.pdf', { type: 'application/pdf' }), 'Drawings');
    let revoked = 0; const rv = URL.revokeObjectURL; URL.revokeObjectURL = u => { revoked++; return rv.call(URL, u); };
    window.open = () => ({});
    await FP.media.view('Drawings/v.pdf');
    await new Promise(r => setTimeout(r, 61000));
    URL.revokeObjectURL = rv;
    out.revoked = revoked;
    return out;
  });
  console.log(JSON.stringify(r));
  const want = ['_CON.pdf', '_nul', '_Com1.txt', '_LPT9.png', '_AUX', 'Console.pdf', 'communication.pdf', 'COM10.pdf', '_prn.PDF'];
  ok(JSON.stringify(r.names) === JSON.stringify(want), 'F38 safeName ' + JSON.stringify(r.names));
  ok(!r.folders.includes('Photos') && !r.folders.includes('LIBRARY') && r.folders.includes('Drawings'), 'F38 capture folders listed: ' + r.folders.join());
  ok(/^media\/|stores|capture/i.test(r.addInto) || !/^TOOK/.test(r.addInto), 'F38 add into Signatures: ' + r.addInto);
  ok(r.check.length === 2, 'F38 check of Library/ and PHOTOS/ paths: ' + JSON.stringify(r.check));
  ok(r.revoked === 0, 'F38 blob URL revoked ' + r.revoked + ' time(s)');
  await A.b.close();
  const all = fails.concat(A.errs);
  console.log('errs      :', JSON.stringify(all));
  process.exit(all.length ? 1 : 0);
})();
