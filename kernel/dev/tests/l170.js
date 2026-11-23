// 0.65 Retiring definitions (backend): the report, retire with supersededBy and together, the roles, reinstate,
// live(), supersededBy() and lineage(). Fails on a non-empty errs list.
const start = require('./dummies/base.js');
(async () => {
  const A = await start({ at: '2026-11-19T08:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const r = await A.p.evaluate(async () => {
    const out = {};
    const pub = (kind, id, def, o) => FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, def), o);
    const err = p => p.then(() => 'TOOK', e => e.message);
    const S = (label, extra) => Object.assign({ label, kind: 'records', containers: { a: {} } }, extra);
    const F = (title, st, extra) => Object.assign({ title, sources: [{ name: 'r', kind: 'item', structure: st, id: { generate: true }, values: { a: 'write' } }], fields: [{ name: 'a', control: 'text', writes: 'r.a', required: true }] }, extra);
    const withFields = (title, st, more) => F(title, st, { fields: [{ name: 'a', control: 'text', writes: 'r.a', required: true }].concat(more) });
    const value = (name, formula) => ({ name, control: 'value', label: name, formula });
    const opens = (title, st, target, more) => withFields(title, st, [{ name: 'go', control: 'buttons', label: 'Go', formula: 'SORT(r, "x")', caption: '"Open"', form: target }].concat(more || []));
    const cur = (kind, id) => FP.defs.get(kind, id);
    const state = (kind, id) => { const d = cur(kind, id); return d ? (d.retired ? 'retired' : 'active') : 'none'; };
    const fn = (name, label) => pub('function', name, { label, output: 'number', inputs: [{ name: 'x', type: 'number', required: false }], formula: 'COALESCE(x, 0) * 2' });

    await pub('structure', 'zz-st', S('Zz things'));
    await pub('structure', 'zz-st2', S('Zz other things'));
    await fn('ZzTwice', 'Twice'); await fn('ZzOnly', 'Only the opener');
    await pub('form', 'zz-a', F('Zz A', 'zz-st'));
    await pub('form', 'zz-b', withFields('Zz B', 'zz-st', [value('d', 'ZzTwice(1)')]));
    await pub('form', 'zz-c', F('Zz C', 'zz-st2'));
    await pub('form', 'zz-opener', opens('Zz Opener', 'zz-st', 'zz-a', [value('d', 'ZzTwice(1)'), value('e', 'ZzOnly(1)')]));

    // 1. The report.
    const ra = FP.defs.retireReport('form', 'zz-a');
    out.ra = { canRetire: ra.canRetire, name: ra.name, blockers: ra.blockers };
    const rs = FP.defs.retireReport('structure', 'zz-st');
    out.rs = { canRetire: rs.canRetire, blockers: rs.blockers.map(b => `${b.kind} ${b.id} ${b.name}`).sort(), only: rs.onlyUsedBy };
    const ro = FP.defs.retireReport('form', 'zz-opener');
    out.ro = { canRetire: ro.canRetire, blockers: ro.blockers, only: ro.onlyUsedBy.map(x => `${x.kind} ${x.id} ${x.name}`) };
    const rf = FP.defs.retireReport('function', 'ZzTwice');
    out.rf = { canRetire: rf.canRetire, blockers: rf.blockers.map(b => b.id).sort() };
    out.missing = await err(Promise.resolve().then(() => FP.defs.retireReport('form', 'zz-nope')));

    // Signing in as other people.
    const josh = (await FP.users.list(true)).find(u => u.name === 'Josh').id;
    const mk = async (name, roles) => { const id = await FP.users.create({ name, roles, tempPin: '918273' }); await FP.users.changePin(id, '918273', '735194'); return id; };
    const pat = await mk('Pat Publisher', ['publisher']), sue = await mk('Sue Supervisor', ['supervisor']);
    const as = async (id, pin) => { await FP.users.signOut('test'); await FP.users.signIn(id, pin || '735194'); };

    // 2. Retire is refused while something uses it, naming each and the fix.
    out.refusedForm = await err(FP.defs.retire('form', 'zz-a'));
    out.refusedStruct = await err(FP.defs.retire('structure', 'zz-st'));

    // 3. Roles: a supervisor can't retire; a publisher can; a publisher can't reinstate; an admin can.
    await as(sue);
    out.supRetire = await err(FP.defs.retire('form', 'zz-c'));
    out.supState = state('form', 'zz-c');
    await as(pat);
    out.selfSup = await err(FP.defs.retire('form', 'zz-opener', { supersededBy: 'zz-opener' }));
    out.ghostSup = await err(FP.defs.retire('form', 'zz-opener', { supersededBy: 'zz-ghost' }));
    out.structSup = await err(FP.defs.retire('structure', 'zz-st2', { supersededBy: 'zz-b' }));
    await FP.defs.retire('form', 'zz-c');
    out.retiredSup = await err(FP.defs.retire('form', 'zz-opener', { supersededBy: 'zz-c' }));
    out.stillOpener = state('form', 'zz-opener');
    const ret = await FP.defs.retire('form', 'zz-opener', { supersededBy: 'zz-b' });
    out.openerDoc = { retired: ret.doc.retired, sup: ret.doc.supersededBy, state: state('form', 'zz-opener') };
    out.afterOpener = FP.defs.retireReport('form', 'zz-a').canRetire;
    out.retiredSup2 = await err(FP.defs.retire('form', 'zz-a', { supersededBy: 'zz-opener' }));
    await FP.defs.retire('form', 'zz-a', { supersededBy: 'zz-b' });
    out.loopSup = await err(FP.defs.retire('form', 'zz-b', { supersededBy: 'zz-a' }));
    out.chain = { opener: FP.defs.supersededBy('zz-opener'), a: FP.defs.supersededBy('zz-a'), b: FP.defs.supersededBy('zz-b'), nope: FP.defs.supersededBy('zz-nope'),
      lineage: FP.defs.lineage('zz-b').map(x => `${x.id}${x.retired ? '(r)' : ''}>${x.supersededBy || ''}`), none: FP.defs.lineage('zz-nope') };
    // A chain onward: zz-b is retired for a newer zz-b2; the older ones now point at zz-b2.
    await pub('form', 'zz-b2', withFields('Zz B2', 'zz-st', [value('d', 'ZzTwice(1)')]));
    await FP.defs.retire('form', 'zz-b', { supersededBy: 'zz-b2' });
    out.chain2 = { opener: FP.defs.supersededBy('zz-opener'), a: FP.defs.supersededBy('zz-a'), lineage: FP.defs.lineage('zz-opener').map(x => x.id) };
    // A loop written straight into the folder (two terminals retiring at once could): the functions stop, they don't hang.
    await pub('form', 'zz-l1', F('Zz L1', 'zz-st2')); await pub('form', 'zz-l2', F('Zz L2', 'zz-st2'));
    for (const [id, other] of [['zz-l1', 'zz-l2'], ['zz-l2', 'zz-l1']]) {
      const d = FP.defs.get('form', id);
      await FP.files.writeJson(['library', 'form', id], `${String(d.version + 1).padStart(4, '0')}-${d.terminalId}.json`, Object.assign({}, d, { version: d.version + 1, retired: true, supersededBy: other, publishedAt: new Date().toISOString() }));
    }
    await FP.defs.load();
    out.loop = { l1: FP.defs.supersededBy('zz-l1'), l2: FP.defs.supersededBy('zz-l2'), lineage: FP.defs.lineage('zz-l1').map(x => x.id) };

    // Reinstate: not as a publisher; as an admin; not when it isn't retired.
    out.patReinstate = await err(FP.defs.reinstate('form', 'zz-opener'));
    out.patPublishOver = await err(FP.defs.publish('form', 'zz-opener', Object.assign({ sites: ['all'] }, FP.defs.get('form', 'zz-opener').def), { basedOn: FP.defs.get('form', 'zz-opener').version }));
    await as(josh, '482913');
    out.notRetired = await err(FP.defs.reinstate('form', 'zz-b2'));
    out.notThere = await err(FP.defs.reinstate('form', 'zz-nowhere'));
    out.openerBlocked = await err(FP.defs.reinstate('form', 'zz-opener'));
    await FP.defs.reinstate('form', 'zz-a');
    out.openerDepends = await err(FP.defs.reinstate('form', 'zz-opener'));
    const back = out.openerDepends === 'TOOK' ? { doc: FP.defs.get('form', 'zz-opener') } : { doc: {} };
    out.reinstated = { state: state('form', 'zz-opener'), sup: back.doc.supersededBy || null, def: JSON.stringify(back.doc.def) === JSON.stringify(ret.doc.def), hist: (await FP.defs.history('form', 'zz-opener')).map(h => `${h.version}${h.retired ? 'r' : ''}`) };
    out.restored = await FP.defs.restore('form', 'zz-opener', 1).then(x => x.doc.version, e => e.message);
    out.v1 = !!(await FP.defs.version('form', 'zz-opener', 1));

    // Reinstating something whose dependency is retired is refused, naming it.
    await pub('structure', 'zz-rs', S('Zz rs'));
    await pub('form', 'zz-r', F('Zz R', 'zz-rs'));
    await FP.defs.retire('form', 'zz-r');
    await FP.defs.retire('structure', 'zz-rs');
    out.reinstateDep = await err(FP.defs.reinstate('form', 'zz-r'));
    await FP.defs.reinstate('structure', 'zz-rs');
    await FP.defs.reinstate('form', 'zz-r');
    out.reinstateOk = [state('structure', 'zz-rs'), state('form', 'zz-r')];

    // 4. Together: all or nothing.
    await pub('structure', 'zz-s1', S('Zz s1')); await pub('structure', 'zz-s2', S('Zz s2'));
    await pub('form', 'zz-t1', F('Zz T1', 'zz-s1', { sources: [{ name: 'r', kind: 'item', structure: 'zz-s1', id: { generate: true }, values: { a: 'write' } }, { name: 'q', kind: 'item', structure: 'zz-s2', id: { generate: true }, values: { a: 'write' } }], fields: [{ name: 'a', control: 'text', writes: 'r.a', required: true }, { name: 'b', control: 'text', writes: 'q.a' }] }));
    await pub('form', 'zz-t2', F('Zz T2', 'zz-s2'));
    out.rep = FP.defs.retireReport('form', 'zz-t1').onlyUsedBy.map(x => x.id);
    out.togetherBad = await err(FP.defs.retire('form', 'zz-t1', { together: [{ kind: 'structure', id: 'zz-s1' }, { kind: 'structure', id: 'zz-s2' }] }));
    out.afterBad = [state('form', 'zz-t1'), state('structure', 'zz-s1'), state('structure', 'zz-s2')];
    out.togetherGhost = await err(FP.defs.retire('form', 'zz-t1', { together: [{ kind: 'structure', id: 'zz-s1' }, { kind: 'structure', id: 'zz-ghost' }] }));
    out.afterGhost = [state('form', 'zz-t1'), state('structure', 'zz-s1')];
    const tg = await FP.defs.retire('form', 'zz-t1', { together: [{ kind: 'structure', id: 'zz-s1' }] });
    out.afterGood = [state('form', 'zz-t1'), state('structure', 'zz-s1'), state('structure', 'zz-s2')];
    out.togetherN = tg.together.length;

    // 6. live(): only the active ones; list() keeps them all.
    out.live = FP.defs.live('form').map(d => d.id).sort();
    out.list = FP.defs.list('form').filter(d => d.retired).map(d => d.id).sort();
    out.liveStruct = FP.defs.live('structure').map(d => d.id).sort();
    out.liveFn = FP.defs.live('function').map(d => d.id).sort();
    return out;
  }).catch(e => ({ thrown: e.message }));
  A.say('result', JSON.stringify(r, null, 1).slice(0, 7000));
  if (r.thrown) bad.push('thrown: ' + r.thrown);
  else {
    expect('report on a form names the form that opens it', !r.ra.canRetire && r.ra.blockers.length === 1 && r.ra.blockers[0].id === 'zz-opener' && r.ra.blockers[0].name === 'Zz Opener' && /Retire form Zz Opener first, or take the Zz A form out of it/.test(r.ra.blockers[0].fix), r.ra);
    expect('report on a structure names its forms', !r.rs.canRetire && r.rs.blockers.join('|') === 'form zz-a Zz A|form zz-b Zz B|form zz-opener Zz Opener' && r.rs.only.length === 0, r.rs);
    expect('report on a form: can retire, and what only it uses', r.ro.canRetire && r.ro.blockers.length === 0 && r.ro.only.join('|') === 'form zz-a Zz A|function ZzOnly Only the opener', r.ro);
    expect('report on a shared function: both forms block it', !r.rf.canRetire && r.rf.blockers.join() === 'zz-b,zz-opener', r.rf);
    expect('report on a form that is not there', /not published/.test(r.missing), r.missing);
    expect('refusal names the dependent and the fix', /zz-opener/.test(r.refusedForm) && /Retire form Zz Opener first/.test(r.refusedForm), r.refusedForm);
    expect('refusal names every dependent of a structure', ['zz-a', 'zz-b', 'zz-opener'].every(x => r.refusedStruct.includes(`form ${x}`)) && /Retire form Zz B first/.test(r.refusedStruct), r.refusedStruct);
    expect('a supervisor can not retire', /only a publisher/.test(r.supRetire) && r.supState === 'active', r);
    expect('supersededBy itself refused', /itself/.test(r.selfSup), r.selfSup);
    expect('supersededBy an unpublished form refused', /not published/.test(r.ghostSup), r.ghostSup);
    expect('only a form is superseded by a form', /Only a form/.test(r.structSup), r.structSup);
    expect('supersededBy a retired form refused', /retired/.test(r.retiredSup) && r.stillOpener === 'active', { m: r.retiredSup, s: r.stillOpener });
    expect('retired with a replacement', r.openerDoc.retired && r.openerDoc.sup === 'zz-b' && r.openerDoc.state === 'retired', r.openerDoc);
    expect('retiring the opener frees the form it opened', r.afterOpener === true, r.afterOpener);
    expect('replaced by a retired form refused', /retired/.test(r.retiredSup2), r.retiredSup2);
    expect('a form can not be replaced by one it replaced (a retired one)', /retired/.test(r.loopSup), r.loopSup);
    expect('supersededBy follows to the active form', r.chain.opener === 'zz-b' && r.chain.a === 'zz-b' && r.chain.b === null && r.chain.nope === null, r.chain);
    expect('lineage oldest first', r.chain.lineage.join() === 'zz-opener(r)>zz-b,zz-a(r)>zz-b,zz-b>', r.chain.lineage);
    expect('lineage of nothing', Array.isArray(r.chain.none) && r.chain.none.length === 0, r.chain.none);
    expect('a chain onward ends at the newest', r.chain2.opener === 'zz-b2' && r.chain2.a === 'zz-b2' && r.chain2.lineage[r.chain2.lineage.length - 1] === 'zz-b2' && r.chain2.lineage.includes('zz-b'), r.chain2);
    expect('a loop in the folder does not hang or answer', r.loop.l1 === null && r.loop.l2 === null && r.loop.lineage.length === 2, r.loop);
    expect('a publisher can not reinstate', /only an admin/.test(r.patReinstate), r.patReinstate);
    expect('a publisher can not publish over a retired form', /only an admin/.test(r.patPublishOver), r.patPublishOver);
    expect('reinstate of one that is not retired', /not retired/.test(r.notRetired), r.notRetired);
    expect('reinstate of one that is not there', /not published/.test(r.notThere), r.notThere);
    expect('admin reinstates: active again, same definition, history kept', r.openerDepends === 'TOOK' && r.reinstated.state === 'active' && r.reinstated.def && r.reinstated.sup === null && /r/.test(r.reinstated.hist.join()) && r.reinstated.hist.length === 3, r);
    expect('reinstating the opener while the form it opens is retired is refused, naming it', /form zz-a, which is retired/.test(r.openerBlocked), r.openerBlocked);
    expect('restore and as-of versions still work', typeof r.restored === 'number' && r.v1, { restored: r.restored, v1: r.v1 });
    expect('reinstate with a retired dependency refused, naming it', /structure zz-rs is retired/.test(r.reinstateDep), r.reinstateDep);
    expect('reinstate in the right order works', r.reinstateOk.join() === 'active,active', r.reinstateOk);
    expect('report: what the form alone uses', r.rep.join() === 'zz-s1', r.rep);
    expect('together refused when one is still used elsewhere, and nothing is retired', /zz-t2/.test(r.togetherBad) && r.afterBad.join() === 'active,active,active', { m: r.togetherBad, s: r.afterBad });
    expect('together with a definition that is not there: nothing retired', /Nothing was retired/.test(r.togetherGhost) && r.afterGhost.join() === 'active,active', { m: r.togetherGhost, s: r.afterGhost });
    expect('together retires the set', r.afterGood.join() === 'retired,retired,active' && r.togetherN === 1, r.afterGood);
    expect('live() leaves retired ones out; list() keeps them', !r.live.includes('zz-c') && !r.live.includes('zz-b') && r.live.includes('zz-a') && r.live.includes('zz-b2') && r.list.includes('zz-c') && r.list.includes('zz-t1'), { live: r.live, list: r.list });
    expect('live structures and functions', !r.liveStruct.includes('zz-s1') && r.liveStruct.includes('zz-s2') && r.liveFn.includes('ZzTwice'), { s: r.liveStruct, f: r.liveFn });
  }
  A.say('errs', JSON.stringify(bad.concat(A.errs)));
  await A.b.close();
  if (bad.length || A.errs.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
