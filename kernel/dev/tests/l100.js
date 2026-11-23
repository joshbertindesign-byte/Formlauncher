// Storage and core fixes: F7 one failing submission does not stop others committing; F15 fresh reads see a just-committed
// multi-structure save; F2 checkpoints are written automatically and the checkpoints:false opt-out survives check-in;
// F39 a correction of a correction reaches the root entry, and a chained line over 256 KB keeps the hash chain.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const r = await p.evaluate(async () => {
    const out = {};
    const pub = (id, def) => FP.defs.publish('structure', id, Object.assign({ sites: ['all'], kind: 'list', itemId: { label: 'Id', made: 'entered' }, containers: { v: {} } }, def), { basedOn: null, note: 'l100' });
    for (const id of ['zz-a', 'zz-b', 'zz-bad']) await pub(id, {});
    const F = { id: 't', version: 1 };
    const rec = (st, id, values, extra) => FP.entry.record(Object.assign({ entry: st + '.save', item: { structure: st, id }, form: F, values }, extra || {}));
    const held = async () => (await FP.outboxStore.all()).length;

    // F7: a submission with an entry that always fails does not stop another submission committing.
    const orig = FP.files.appendLine;
    FP.files.appendLine = (parts, name, obj, o) => (obj.item && obj.item.structure === 'zz-bad') ? Promise.reject(new Error('disk says no')) : orig(parts, name, obj, o);
    await FP.entry.submit(async add => { await add({ entry: 'zz-bad.save', item: { structure: 'zz-bad', id: 'B1' }, form: F, values: { v: 1 } }); await add({ entry: 'zz-a.save', item: { structure: 'zz-a', id: 'BA' }, form: F, values: { v: 1 } }); });
    await FP.entry.submit(async add => { await add({ entry: 'zz-a.save', item: { structure: 'zz-a', id: 'GOOD' }, form: F, values: { v: 2 } }); });
    FP.current.clearCache();
    const ra = await FP.current.load('zz-a', { fresh: true });
    out.f7 = { good: ra.items.has('GOOD'), badHidden: !ra.items.has('BA'), left: await held() };
    FP.files.appendLine = orig;
    await FP.outbox.flush(); FP.current.clearCache();
    out.f7after = { left: await held(), bad: (await FP.current.load('zz-a', { fresh: true })).items.has('BA') };

    // F15: a fresh read after a multi-structure save sees it, although committedIds was cached before the commit landed.
    FP.files.appendLine = (parts, name, obj, o) => obj.commit ? Promise.reject(new Error('busy')) : orig(parts, name, obj, o);
    await FP.entry.submit(async add => { await add({ entry: 'zz-a.save', item: { structure: 'zz-a', id: 'X1' }, form: F, values: { v: 1 } }); await add({ entry: 'zz-b.save', item: { structure: 'zz-b', id: 'X2' }, form: F, values: { v: 1 } }); });
    FP.files.appendLine = orig;
    const before = (await FP.current.load('zz-a', { fresh: true })).items.has('X1');
    await FP.outbox.flush();
    out.f15 = { before, after: (await FP.current.load('zz-a', { fresh: true })).items.has('X1') };

    // F39: correction of a correction.
    const e1 = await rec('zz-b', 'C1', { v: 'one' });
    await FP.outbox.flush();
    const c1 = await rec('zz-b', 'C1', { v: 'two', reason: 'r1' }, { corrects: e1.entryId, after: e1.writtenAt });
    const c2 = await rec('zz-b', 'C1', { v: 'three', reason: 'r2' }, { corrects: c1.entryId, after: c1.writtenAt });
    await FP.outbox.flush(); FP.current.clearCache();
    const rb = await FP.current.load('zz-b', { fresh: true });
    out.f39corr = { v: rb.items.get('C1').values.v, health: rb.health.join('|'), corrected: rb.items.get('C1').corrected, c2: !!c2 };

    // F39: a last line longer than the read window keeps the chain.
    await FP.files.appendLine(['zz'], 'long.jsonl', { n: 1, big: 'x'.repeat(300000) }, { chain: true });
    await FP.files.appendLine(['zz'], 'long.jsonl', { n: 2 }, { chain: true });
    await FP.files.appendLine(['zz'], 'long.jsonl', { n: 3 }, { chain: true });
    out.chain = await FP.files.verifyChain(await FP.files.readText(['zz'], 'long.jsonl'));

    return out;
  });
  Object.entries(r).forEach(([k, v]) => say(k, JSON.stringify(v)));
  const bad = [];
  if (!(r.f7.good && r.f7.badHidden && r.f7.left >= 2)) bad.push('F7 ' + JSON.stringify(r.f7));
  if (!(r.f7after.left === 0 && r.f7after.bad)) bad.push('F7 after');
  if (!r.f15.after) bad.push('F15 ' + JSON.stringify(r.f15));
  if (r.f39corr.v !== 'three' || r.f39corr.corrected !== 2) bad.push('F39 correction ' + JSON.stringify(r.f39corr));
  if (r.chain.broken.length || r.chain.chained !== 3) bad.push('F39 chain ' + JSON.stringify(r.chain));
  // F2, in the launcher (the editor never checkpoints): check-in keeps the opt-out; an entry from two months ago
  // is checkpointed a minute and a half after a load.
  await p.goto('file:///home/claude/kernel/launcher.html'); await w(3000);
  if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh'); await w(300); await p.keyboard.type('482913'); await w(2000); }
  const optOut = await p.evaluate(async () => {
    const at = new Date('2026-09-10T10:00:00-05:00');
    const old = await FP.entry.build({ entry: 'zz-b.save', item: { structure: 'zz-b', id: 'OLD' }, form: { id: 't', version: 1 }, values: { v: 1 }, at });
    await FP.files.appendLine(['data', 'zz-b', '2026-09-10'], FP.identity.terminalId + '.jsonl', old, { chain: true });
    const id = FP.identity.terminalId, reg = await FP.identity.lookup(id);
    await FP.files.writeJson(['_terminals'], id + '.json', Object.assign({}, reg, { checkpoints: false }));
    await FP.identity.checkIn();
    const kept = (await FP.identity.lookup(id)).checkpoints;
    delete reg.checkpoints;
    await FP.files.writeJson(['_terminals'], id + '.json', reg);
    FP.current.clearCache();
    await FP.current.load('zz-b', { fresh: true });
    return kept;
  });
  say('optOut kept by check-in', optOut);
  if (optOut !== false) bad.push('F2 optOut ' + optOut);
  const cps = () => p.evaluate(async () => { try { return (await FP.files.listDirs(['checkpoints', 'zz-b'])).length; } catch (_) { return 0; } });
  say('checkpoint dirs before', await cps());
  await p.clock.fastForward(100000); await w(3000);
  const n = await cps();
  say('checkpoint dirs after', n);
  if (!n) bad.push('F2 no checkpoints written');
  say('bad', JSON.stringify(bad));
  say('errs', JSON.stringify(errs).slice(0, 400));
  await b.close();
  if (bad.length) process.exit(1);
})();
