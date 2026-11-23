// 0.65 Retiring definitions (backend), part 3: unused() on the Test pack with an orphan form, structure and function added,
// and duplicateForm (share and copy). Fails on a non-empty errs list.
const start = require('./dummies/base.js');
const fs = require('fs'), path = require('path');
const PACK = fs.readFileSync(path.join(__dirname, '../packs/test-pack/test-pack.json'), 'utf8');
(async () => {
  const A = await start({ at: '2026-11-19T08:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const r = await A.p.evaluate(async text => {
    const out = {};
    const pub = (kind, id, def, o) => FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, def), o);
    const err = p => p.then(() => 'TOOK', e => e.message);
    const S = (label, extra) => Object.assign({ label, kind: 'records', containers: { a: {}, n: { rule: 'sum' } } }, extra);
    const F = (title, st, more) => ({ title, sources: [{ name: 'r', kind: 'item', structure: st, id: { generate: true }, values: { a: 'write', n: 'write' } }], fields: [{ name: 'a', control: 'text', writes: 'r.a', required: true }, { name: 'n', control: 'number', writes: 'r.n' }].concat(more || []) });

    await FP.sites.create('HOU', 'Houston').catch(() => {});
    await FP.packs.install(FP.packs.read(text));
    if (FP.outbox) await FP.outbox.flush();
    FP.current.clearCache();
    const key = x => `${x.kind}/${x.id}`;

    // ---- unused(): the pack, then with orphans.
    const t0 = performance.now();
    const base = await FP.defs.unused();
    out.ms = Math.round(performance.now() - t0);
    out.baseShape = base.every(x => x.kind && x.id && x.name && x.why);
    out.baseKeys = base.map(key);
    const groups = await FP.groups.list();
    const placed = Array.from(new Set(groups.flatMap(g => g.forms)));
    out.placedWronglyListed = base.filter(x => x.kind === 'form' && placed.includes(x.id)).map(x => x.id);
    await pub('structure', 'zz-lone', S('Zz lone'));
    await pub('structure', 'zz-orph-st', S('Zz orphan structure'));
    await pub('form', 'zz-orphan', F('Zz orphan form', 'zz-orph-st'));
    await pub('function', 'ZzLonely', { label: 'Lonely', output: 'number', inputs: [], formula: '1' });
    await pub('function', 'ZzUsed', { label: 'Used', output: 'number', inputs: [{ name: 'x', type: 'number', required: false }], formula: 'x' });
    await pub('form', 'zz-user', F('Zz user', 'zz-orph-st', [{ name: 'u', control: 'value', label: 'U', formula: 'ZzUsed(n)' }]));
    await FP.groups.create({ name: 'Zz group', site: 'HOU', terminals: ['T09'], forms: ['zz-user'] });
    FP.current.clearCache();
    const u1 = await FP.defs.unused();
    out.u1 = u1.map(key).filter(k => /zz-|Zz/.test(k)).sort();
    out.u1why = u1.filter(x => /zz-|Zz/.test(x.id)).map(x => x.why);
    out.u1pack = u1.map(key).filter(k => !/zz-|Zz/.test(k)).sort().join() === base.map(key).sort().join();
    // A retired definition is not offered; once the orphan form is retired its structure is unused too.
    await FP.defs.retire('form', 'zz-orphan');
    const u2 = await FP.defs.unused();
    out.u2 = u2.map(key).filter(k => /zz-|Zz/.test(k)).sort();
    // A form another opens is not unused; built-ins are never listed.
    out.noBuiltIn = !u2.some(x => FP.defs.isBuiltIn(x.kind, x.id));

    // ---- duplicateForm
    await pub('structure', 'zz-ds', S('Zz dup struct'));
    await pub('function', 'ZzDd', { label: 'Dup fn', output: 'number', inputs: [{ name: 'x', type: 'number', required: false }], formula: 'COALESCE(x, 0) * 2' });
    await pub('function', 'ZzDd2', { label: 'Dup fn two', output: 'number', inputs: [{ name: 'x', type: 'number', required: false }], formula: 'ZzDd(x) + 1' });
    await pub('form', 'zz-d1', F('Zz dup', 'zz-ds', [{ name: 'd', control: 'value', label: 'D', formula: 'ZzDd2(n) + ZzDd(n)' }]));
    const josh = (await FP.users.list(true)).find(u => u.name === 'Josh').id;
    const sue = await FP.users.create({ name: 'Sue Supervisor', roles: ['supervisor'], tempPin: '918273' });
    await FP.users.changePin(sue, '918273', '735194');
    await FP.users.signOut('test'); await FP.users.signIn(sue, '735194');
    out.supDup = await err(FP.defs.duplicateForm('zz-d1', 'zz-d-sup'));
    await FP.users.signOut('test'); await FP.users.signIn(josh, '482913');
    const same = await FP.defs.duplicateForm('zz-d1', 'zz-d-share');
    const sd = FP.defs.get('form', 'zz-d-share');
    out.share = { r: same, title: sd.def.title, struct: sd.def.sources[0].structure, formula: sd.def.fields[2].formula, onTerminal: (await FP.groups.list()).some(g => g.forms.includes('zz-d-share')), unusedHas: (await FP.defs.unused()).some(x => x.id === 'zz-d-share') };
    out.titled = await FP.defs.duplicateForm('zz-d1', 'zz-d-titled', { title: 'Mine' }).then(() => FP.defs.get('form', 'zz-d-titled').def.title, e => e.message);
    const c1 = await FP.defs.duplicateForm('zz-d1', 'zz-d-copy', { structures: { 'zz-ds': 'copy' }, functions: { ZzDd: 'copy', ZzDd2: 'copy' } });
    const cd = FP.defs.get('form', 'zz-d-copy');
    out.copy = { r: c1, struct: cd.def.sources[0].structure, formula: cd.def.fields[2].formula, sLabel: FP.defs.get('structure', c1.copied.find(x => x.kind === 'structure').id).def.label, containers: Object.keys(FP.defs.get('structure', 'zz-ds-copy').def.containers),
      f2: FP.defs.get('function', 'ZzDd2_copy') && FP.defs.get('function', 'ZzDd2_copy').def.formula, loaded: !!FP.fn.get('ZzDd2_copy') };
    const o = document.body.appendChild(document.createElement('div'));
    const inst = await FP.forms.open(o, 'zz-d-copy', { draft: false });
    inst.set('n', 3); await new Promise(r => setTimeout(r, 600));
    out.copyWorks = inst.values().d; inst.destroy();
    const c2 = await FP.defs.duplicateForm('zz-d1', 'zz-d-copy2', { structures: { 'zz-ds': 'copy' } });
    out.copy2 = c2;
    out.original = { struct: FP.defs.get('form', 'zz-d1').def.sources[0].structure, version: FP.defs.get('form', 'zz-d1').version };
    out.exists = await err(FP.defs.duplicateForm('zz-d1', 'zz-d-copy'));
    await FP.defs.retire('form', 'zz-d-titled');
    out.retiredId = await err(FP.defs.duplicateForm('zz-d1', 'zz-d-titled'));
    out.badId = await err(FP.defs.duplicateForm('zz-d1', 'Bad Id'));
    out.noForm = await err(FP.defs.duplicateForm('zz-nope', 'zz-whatever'));
    out.badHow = await err(FP.defs.duplicateForm('zz-d1', 'zz-d-x', { structures: { 'zz-ds': 'move' } }));
    out.notUsed = await err(FP.defs.duplicateForm('zz-d1', 'zz-d-y', { structures: { 'zz-lone': 'copy' } }));
    out.noneLeft = FP.defs.list().filter(d => /^zz-d-(x|y|sup)$/.test(d.id)).length;
    return out;
  }, PACK).catch(e => ({ thrown: e.message }));
  A.say('result', JSON.stringify(r, null, 1).slice(0, 6000));
  if (r.thrown) bad.push('thrown: ' + r.thrown);
  else {
    expect('unused() rows have kind, id, name, why', r.baseShape, r.baseKeys);
    expect('a form on a terminal group is not listed', r.placedWronglyListed.length === 0, r.placedWronglyListed);
    expect('fast enough', r.ms < 3000, r.ms);
    expect('orphans listed: the form, the structure, the function (and not what is used)', r.u1.join() === 'form/zz-orphan,function/ZzLonely,structure/zz-lone', r.u1);
    expect('the reasons are plain', r.u1why.every(w => /^(On no terminal|No form)/.test(w)), r.u1why);
    expect('the pack\'s own list is unchanged by the additions', r.u1pack, r.u1pack);
    expect('retiring the orphan form leaves its structure unused, and it is gone from the list', r.u2.join() === 'function/ZzLonely,structure/zz-lone', r.u2);
    expect('built-ins never listed', r.noBuiltIn, r.noBuiltIn);
    expect('a supervisor can not duplicate', /only a publisher/.test(r.supDup), r.supDup);
    expect('share is the default: same structure and functions', r.share.r.id === 'zz-d-share' && r.share.r.copied.length === 0 && r.share.title === 'Zz dup (copy)' && r.share.struct === 'zz-ds' && r.share.formula === 'ZzDd2(n) + ZzDd(n)', r.share);
    expect('the copy is on no terminal', !r.share.onTerminal && r.share.unusedHas, r.share);
    expect('a title can be given', r.titled === 'Mine', r.titled);
    expect('copy: structure and functions under new ids, form points at them', r.copy.r.copied.map(x => `${x.kind}:${x.from}>${x.id}`).sort().join() === 'function:ZzDd2>ZzDd2_copy,function:ZzDd>ZzDd_copy,structure:zz-ds>zz-ds-copy' && r.copy.struct === 'zz-ds-copy' && r.copy.formula === 'ZzDd2_copy(n) + ZzDd_copy(n)', r.copy);
    expect('the copied function calls the copied one', r.copy.f2 === 'ZzDd_copy(x) + 1' && r.copy.loaded, r.copy);
    expect('the copied structure keeps its containers and says copy', r.copy.sLabel === 'Zz dup struct (copy)' && r.copy.containers.join() === 'a,n', r.copy);
    expect('the copy works', r.copyWorks === 13, r.copyWorks);
    expect('a second copy takes the next free id', r.copy2.copied.length === 1 && r.copy2.copied[0].id === 'zz-ds-copy-2', r.copy2);
    expect('the original is untouched', r.original.struct === 'zz-ds' && r.original.version === 1, r.original);
    expect('an existing id is refused', /already exists/.test(r.exists), r.exists);
    expect('a retired id is refused', /retired/.test(r.retiredId), r.retiredId);
    expect('a bad id is refused', /lowercase/.test(r.badId), r.badId);
    expect('a missing form is refused', /not published/.test(r.noForm), r.noForm);
    expect('share or copy only', /share or copy/.test(r.badHow), r.badHow);
    expect('copying what the form does not use is refused', /doesn't use/.test(r.notUsed), r.notUsed);
    expect('refused duplicates leave nothing behind', r.noneLeft === 0, r.noneLeft);
  }
  A.say('errs', JSON.stringify(bad.concat(A.errs)));
  await A.b.close();
  if (bad.length || A.errs.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
