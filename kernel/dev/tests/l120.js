// Definitions library: History > Restore publishes a new version of an old one (F1); the publish loop check follows forms
// opened from "buttons from a list" fields (F21); readStats judges entry count and load time per terminal (F39).
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const r = await p.evaluate(async () => {
    const out = {};
    const pub = (kind, id, def, o) => { const cur = FP.defs.get(kind, id); return FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, def), Object.assign({ basedOn: cur ? cur.version : null, note: 'l120' }, o)); };
    // F1: publish v1, v2, restore v1: v3 is current and holds v1's content.
    const f = t => ({ title: t, sources: [], fields: [{ name: 'x', control: 'text' }] });
    await pub('form', 'zz-restore', f('First'));
    await pub('form', 'zz-restore', f('Second'));
    const res = await FP.defs.restore('form', 'zz-restore', 1).then(() => 'ok', e => 'FAILED: ' + e.message);
    const cur = FP.defs.get('form', 'zz-restore');
    out.restore = `${res} · current v${cur && cur.version} "${cur && cur.def.title}"`;
    // F21: A opens B from a buttons field; B opens A from a button: refused as a loop.
    const btns = form => ({ name: 'pick', control: 'buttons', formula: 'RANGE(1, 3)', form });
    await pub('form', 'zz-loop-a', f('A'));
    await pub('form', 'zz-loop-b', { title: 'B', sources: [],  fields: [{ name: 'x', control: 'text' }, { name: 'pick', control: 'buttons', formula: 'RANGE(1, 3)', form: 'zz-loop-a' }] }).catch(e => { out.bPub = e.message.slice(0, 120); });
    const look = (id, fields, re) => FP.defs.check('form', id, { sites: ['all'], title: 'A', sources: [], fields }).then(l => l.filter(x => re.test(x)).join(' | ') || 'NOTHING');
    out.loopA = await look('zz-loop-a', [{ name: 'x', control: 'text' }, btns('zz-loop-b')], /loop|not published/);
    out.cardLoop = await look('zz-loop-a', [{ name: 'x', control: 'text' }, { name: 'pick', control: 'buttons', formula: 'RANGE(1, 3)', actions: [{ label: 'Go', form: 'zz-loop-b' }] }], /loop|not published/);
    out.missing = await look('zz-loop-a', [{ name: 'x', control: 'text' }, btns('zz-nowhere')], /not published/);
    // F39: terminal T91 loads fast but holds many entries; T92 loads slowly with few. Each is judged on its own figure.
    await pub('structure', 'zz-stat', { label: 'Stat', kind: 'list', itemId: { label: 'Id', made: 'entered' }, containers: { a: {} } });
    const now = new Date().toISOString();
    const row = (loadMs, entries) => ({ structures: { 'zz-stat': { at: now, loadMs, entries, items: 10 } } });
    await FP.files.writeJson(['_stats'], 'T91.json', Object.assign({ terminalId: 'T91', at: now }, row(300, 200000)), true);
    await FP.files.writeJson(['_stats'], 'T92.json', Object.assign({ terminalId: 'T92', at: now }, row(1000, 5)), true);
    await FP.defs.load();
    out.manyFast = FP.defs.perf('zz-stat').status + ' · ' + FP.defs.perf('zz-stat').message;
    await FP.files.writeJson(['_stats'], 'T92.json', Object.assign({ terminalId: 'T92', at: now }, row(9000, 5)), true);
    await FP.defs.load();
    out.slowFew = FP.defs.perf('zz-stat').status + ' · ' + FP.defs.perf('zz-stat').message;
    // fp-kinds lit(): a starting value holding a double quote keeps it (it used to become a single quote).
    const kf = FP.kinds.form({ title: 'k', sites: ['all'], sources: [{ name: 'it', kind: 'item', structure: 'zz-stat', fill: true }], fields: [{ name: 'a', control: 'text', writes: 'it.a', default: 'say "hi"' }] });
    out.lit = kf.fields[0].defaultFrom + ' => ' + FP.fn.evaluate(kf.fields[0].defaultFrom, { it: { a: null } });
    return out;
  });
  Object.entries(r).forEach(([k, v]) => say(k, v));
  const bad = [];
  if (!/^ok · current v3 "First"$/.test(r.restore)) bad.push('restore: ' + r.restore);
  if (!/loop/.test(r.loopA)) bad.push('buttons-field loop not caught: ' + r.loopA);
  if (!/loop/.test(r.cardLoop)) bad.push('card-button loop not caught: ' + r.cardLoop);
  if (!/not published/.test(r.missing)) bad.push('buttons-field form missing not caught: ' + r.missing);
  if (!/^slow/.test(r.manyFast)) bad.push('many entries on a fast terminal not flagged: ' + r.manyFast);
  if (!/^slow/.test(r.slowFew)) bad.push('slow load on a small terminal not flagged: ' + r.slowFew);
  if (!/=> say "hi"$/.test(r.lit)) bad.push('starting value quotes: ' + r.lit);
  say('errs', JSON.stringify(errs.concat(bad)));
  await b.close();
  if (bad.length) process.exit(1);
})();
