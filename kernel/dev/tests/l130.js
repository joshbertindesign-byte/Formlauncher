// F5 packs carry the media library entries, tag names and files their forms use (installing recreates them, ids kept, or
// pointed at an entry of the same name already here; a file too big to carry is reported "not carried", the form installs);
// F36 a pack's items need an admin; F40 usedBy counts tag rules once per form; F42 revise starts from the freshest entry;
// F43 the library refuses changes when FP.users is missing. Fails on a non-empty errs list.
const start = require('./dummies/base.js');
(async () => {
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  const A = await start({ seed: 'dummies/snap15.json', at: '2026-11-18T13:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  await A.w(1500);
  const a = await A.p.evaluate(async () => {
    const out = {};
    const L = FP.media.library;
    await L.setTag('kind', {});
    const small = await L.add(new File(['Line 1 start-up sheet, Rev A'], 'startup.txt', { type: 'text/plain' }), { name: 'Line 1 start-up', tags: { kind: 'setup sheet' }, folder: 'setup sheets' });
    const big = await L.add(new File([new Uint8Array(3 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' }), { name: 'Big drawing', tags: { kind: 'drawing' }, folder: 'drawings' });
    const pub = (id, def) => FP.defs.publish('form', id, Object.assign({ sites: ['all'], sources: [], fields: [{ name: 'line', control: 'choice', label: 'Line', options: ['L1', 'L2'] }, { name: 'sheet', control: 'media', label: 'Sheet', where: { kind: 'x' } }], layout: [['line 6'], ['sheet 12']] }, def), { basedOn: null, note: 'l130' });
    await pub('zz-startup', { title: 'Start-up', media: [{ entry: small.id }, { entry: big.id }, { library: { kind: 'setup sheet' } }] });
    await pub('zz-tagonly', { title: 'Tag only', media: [{ library: { kind: 'setup sheet' } }] });
    out.small = small.id; out.big = big.id;
    // F40: the tag-rule form counts, and zz-startup (entry + rule) is listed once.
    out.usedBy = L.usedBy(small.id).slice().sort();
    out.usedByBig = L.usedBy(big.id);
    // F42: another terminal revised it; this one's cache is stale.
    await FP.entry.record({ entry: 'media-library.revise', item: { structure: 'media-library', id: small.id }, form: { id: 'media-library', version: 1 },
      values: { path: small.path, revision: 2, history: [{ revision: 1, path: small.path, at: null, by: null, note: '' }], note: 'other terminal', revisedAt: new Date().toISOString() } });
    await FP.outbox.flush();
    const r = await L.revise(small.id, new File(['Rev C'], 'c.txt', { type: 'text/plain' }), 'Rev C');
    out.revision = r.revision; out.history = r.history.length;
    const pack = await FP.packs.make({ name: 'Library pack', only: new Set(['form/zz-startup']) });
    out.pack = { entries: pack.library.entries.map(e => ({ id: e.id, name: e.name, file: !!e.file })), tags: pack.library.tags.map(t => t.name) };
    out.text = JSON.stringify(pack);
    return out;
  });
  ok(JSON.stringify(a.usedBy) === JSON.stringify(['zz-startup', 'zz-tagonly']), 'F40 usedBy small: ' + JSON.stringify(a.usedBy));
  ok(JSON.stringify(a.usedByBig) === JSON.stringify(['zz-startup']), 'F40 usedBy big: ' + JSON.stringify(a.usedByBig));
  ok(a.revision === 3 && a.history === 2, `F42 revise from stale cache: revision ${a.revision}, history ${a.history} (want 3, 2)`);
  ok(a.pack.entries.length === 3 || a.pack.entries.length === 2, 'pack entries ' + JSON.stringify(a.pack.entries));
  ok(a.pack.entries.some(e => e.id === a.small && e.file) && a.pack.entries.some(e => e.id === a.big && !e.file), 'pack carries the small file only: ' + JSON.stringify(a.pack.entries));
  ok(a.pack.tags.includes('kind'), 'pack carries the tag name');
  console.log('A', JSON.stringify({ usedBy: a.usedBy, rev: a.revision, hist: a.history, pack: a.pack }));

  // A fresh folder: the pack installs, the library is rebuilt.
  const B = await start({ at: '2026-11-19T08:00:00-06:00' });
  B.p.on('dialog', d => d.accept().catch(() => {}));
  const b = await B.p.evaluate(async ([text, small, big]) => {
    const out = {};
    const p = FP.packs.read(text);
    const r = await FP.packs.install(p);
    out.r = r;
    const L = FP.media.library; await L.load({ fresh: true });
    const e = L.get(small), g = L.get(big);
    out.entry = e ? { name: e.name, tags: e.tags, active: e.active, file: !!(await FP.media.stat(e.path)) } : null;
    out.bigEntry = g ? { name: g.name, file: !!(await FP.media.stat(g.path)) } : null;
    out.tags = L.tags().map(t => t.name);
    const d = FP.defs.get('form', 'zz-startup');
    out.media = d ? d.def.media.filter(m => m.entry).map(m => m.entry) : null;
    out.problems = d ? FP.media.check(d.def) : ['no form'];
    out.again = (await FP.packs.plan(p)).defs.map(x => x.how).join(',') + ' | ' + (await FP.packs.plan(p)).library.entries.map(x => x.how).join(',');
    // F36: a publisher who is not an admin can't write items into structures (users included).
    const pin = '482913';
    const id = await FP.users.create({ name: 'Pat Pub', roles: ['publisher'], tempPin: '918273' });
    await FP.users.changePin(id, '918273', '735194');
    await FP.users.signOut('test'); await FP.users.signIn(id, '735194');
    const items = { fp: 'pack', v: 1, definitions: [], items: { users: [{ id: 'U-evil', values: { name: 'Evil', roles: ['admin'], active: true } }] } };
    out.items = await FP.packs.install(FP.packs.read(JSON.stringify(items))).then(() => 'TOOK', e => e.message);
    FP.current.clearCache();
    out.evil = (await FP.users.list(true)).some(u => u.id === 'U-evil');
    // F43: with no FP.users the library refuses changes (fails closed).
    const keep = FP.users; FP.users = undefined;
    out.noUsers = await FP.media.library.setTag('zzz', {}).then(() => 'TOOK', e => e.message);
    FP.users = keep;
    return out;
  }, [a.text, a.small, a.big]);
  console.log('B', JSON.stringify(b));
  ok(b.r.library && b.r.library.entries === 3 && b.r.library.files === 2, 'install library result ' + JSON.stringify(b.r.library));
  ok(b.r.library && b.r.library.notCarried.join() === 'Big drawing', 'not carried: ' + JSON.stringify(b.r.library));
  ok(b.entry && b.entry.file && b.entry.active && b.entry.name === 'Line 1 start-up', 'entry made with its file: ' + JSON.stringify(b.entry));
  ok(b.bigEntry && !b.bigEntry.file, 'big entry made without a file');
  ok(b.tags.includes('kind'), 'tag name made');
  ok(b.media && b.media.includes(a.small) && b.problems.length === 0, 'form media ids kept, no problems: ' + JSON.stringify([b.media, b.problems]));
  ok(/^same \| same,same,same$/.test(b.again), 'install again changes nothing: ' + b.again);
  ok(/only an admin/.test(b.items) && !b.evil, 'F36 items need an admin: ' + b.items + ' evil=' + b.evil);
  ok(/Only a publisher/.test(b.noUsers), 'F43 ' + b.noUsers);
  await B.b.close();

  // A folder that already has an entry with the same name (another id): the form is pointed at it.
  const C = await start({ at: '2026-11-19T08:00:00-06:00' });
  C.p.on('dialog', d => d.accept().catch(() => {}));
  const c = await C.p.evaluate(async ([text, small]) => {
    const L = FP.media.library;
    const mine = await L.add(new File(['mine'], 'mine.txt', { type: 'text/plain' }), { name: 'Line 1 start-up', tags: { kind: 'setup sheet' } });
    const p = FP.packs.read(text);
    const plan = await FP.packs.plan(p);
    const r = await FP.packs.install(p);
    const d = FP.defs.get('form', 'zz-startup');
    return { mine: mine.id, hows: plan.library.entries.map(x => x.how).join(','), media: d.def.media.filter(m => m.entry).map(m => m.entry), r: r.library, ids: L.cached().map(e => e.id) };
  }, [a.text, a.small]);
  console.log('C', JSON.stringify(c));
  ok(c.media.includes(c.mine) && !c.media.includes(a.small), 'F5 remap: form points at the local entry ' + JSON.stringify(c.media));
  ok(/remapped/.test(c.hows), 'plan says remapped: ' + c.hows);
  await C.b.close();

  // F41: on a page that has not read the library, a check of a named entry doesn't silently pass.
  const D = await start({ seed: 'dummies/snap15.json', at: '2026-11-18T13:00:00-06:00', noSignIn: true });
  // The library can't be read on this page (a test-only switch on the loaded flag), as before the first load finishes.
  await D.p.route('**/fp-media.js', r => r.fulfill({ contentType: 'text/javascript', body: require('fs').readFileSync(require('./dummies/base.js').ROOT + '/fp-media.js', 'utf8').replace('libCache.loaded = true;', 'libCache.loaded = !window.__noLib;') }));
  await D.p.addInitScript(() => { window.__noLib = true; });
  await D.p.goto('file:///home/claude/kernel/launcher.html'); await D.w(2500);
  const d = await D.p.evaluate(() => ({ loaded: FP.media.library.loaded(), problems: FP.media.check({ media: [{ entry: 'M-nope' }] }) }));
  console.log('D', JSON.stringify(d));
  ok(!d.loaded && d.problems.length === 1, 'F41 unloaded library: ' + JSON.stringify(d));
  await D.b.close();

  const all = fails.concat(A.errs, B.errs, C.errs, D.errs);
  console.log('errs      :', JSON.stringify(all));
  process.exit(all.length ? 1 : 0);
})();
