// 0.65 Retiring definitions (backend), part 2: a retired structure takes no new entries but still reads (as-of too);
// ids are never reused and a clashing name is reported; a retired function still evaluates in a form that uses it;
// publish refuses anything that uses a retired definition. Fails on a non-empty errs list.
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
    const idle = ms => new Promise(r => setTimeout(r, ms));
    const S = (label, extra) => Object.assign({ label, kind: 'records', containers: { a: {}, n: { rule: 'sum' } } }, extra);
    const F = (title, st, more) => ({ title, sources: [{ name: 'r', kind: 'item', structure: st, id: { generate: true }, values: { a: 'write', n: 'write' } }], fields: [{ name: 'a', control: 'text', writes: 'r.a', required: true }, { name: 'n', control: 'number', writes: 'r.n' }].concat(more || []) });
    const settle = async inst => { let last = '', same = 0; for (let i = 0; i < 100; i++) { await idle(50); const v = JSON.stringify(inst.values()); if (v === last) { if ((same += 50) >= 300) return; } else { same = 0; last = v; } } };
    const open = async (id, host) => { host = host || document.body.appendChild(document.createElement('div')); return { inst: await FP.forms.open(host, id, { draft: false }), host }; };

    // ---- A retired structure: no new entries, old ones still read, as of any time.
    await pub('structure', 'zz-led', S('Zz ledger'));
    await pub('form', 'zz-led-in', F('Zz ledger in', 'zz-led'));
    const e1 = await FP.entry.record({ entry: 'zz-led.add', item: { structure: 'zz-led' }, form: { id: 'zz-led-in', version: 1 }, values: { a: 'x', n: 2 } });
    await idle(1200);
    const mid = new Date();
    await idle(1200);
    await FP.entry.record({ entry: 'zz-led.add', item: { structure: 'zz-led', id: e1.item.id }, form: { id: 'zz-led-in', version: 1 }, values: { n: 3 } });
    await FP.outbox.flush(); FP.current.clearCache();
    const before = await FP.current.load('zz-led', { fresh: true });
    out.before = Array.from(before.items.values()).map(i => i.values.n);
    // A form already open when its structure is retired (forced) is refused clearly when it saves.
    const o = await open('zz-led-in');
    o.inst.set('a', 'late'); o.inst.set('n', 7); await settle(o.inst);
    await FP.defs.retire('structure', 'zz-led', { force: true });
    out.flags = { has: FP.structures.has('zz-led'), isRetired: FP.structures.isRetired('zz-led'), rule: FP.structures.get('zz-led').containers.n.rule, retiredFlag: FP.structures.get('zz-led').retired === true, listed: FP.structures.list().some(s => s.id === 'zz-led') };
    out.saveOpen = { result: (await o.inst.save()) === null ? 'null' : 'saved', text: o.host.innerText };
    out.record = await err(FP.entry.record({ entry: 'zz-led.add', item: { structure: 'zz-led' }, form: { id: 'zz-led-in', version: 1 }, values: { a: 'no' } }));
    out.build = await err(FP.entry.build({ entry: 'zz-led.add', item: { structure: 'zz-led' }, values: {} }));
    out.open = await err(open('zz-led-in').then(x => x.inst.destroy && x.inst.destroy()));
    FP.current.clearCache();
    const after = await FP.current.load('zz-led', { fresh: true });
    out.after = Array.from(after.items.values()).map(i => i.values.n);
    const old = await FP.current.load('zz-led', { fresh: true, asOf: mid });
    out.asOf = Array.from(old.items.values()).map(i => i.values.n);
    out.nothingNew = after.entries ? after.entries.length : null;
    out.hist = (await FP.defs.history('structure', 'zz-led')).map(h => `${h.version}${h.retired ? 'r' : ''}`);
    // Reinstating lets entries in again.
    await FP.defs.reinstate('structure', 'zz-led');
    out.reinstated = await err(FP.entry.record({ entry: 'zz-led.add', item: { structure: 'zz-led', id: e1.item.id }, form: { id: 'zz-led-in', version: 1 }, values: { n: 1 } }));
    await FP.outbox.flush(); FP.current.clearCache();
    out.afterReinstate = Array.from((await FP.current.load('zz-led', { fresh: true })).items.values()).map(i => i.values.n);

    // ---- Ids are never reused; a name that clashes is reported, not refused.
    await pub('structure', 'zz-gone', S('Zz gone things'));
    await FP.defs.retire('structure', 'zz-gone');
    out.reuse = await err(pub('structure', 'zz-gone', S('Something else')));
    await pub('function', 'ZzGoneFn', { label: 'Gone fn', output: 'number', inputs: [], formula: '1' });
    await FP.defs.retire('function', 'ZzGoneFn');
    out.reuseFn = await err(pub('function', 'zzgonefn', { label: 'Other', output: 'number', inputs: [], formula: '2' }));
    out.clashBefore = FP.defs.nameClash('structure', ' zz GONE things ');
    out.newSameName = await err(pub('structure', 'zz-gone-2', S('Zz gone things')));
    out.clashAfter = FP.defs.nameClash('structure', 'Zz gone things').map(x => `${x.id}:${x.retired}`).sort();
    out.clashNone = FP.defs.nameClash('structure', 'No such name');
    out.clashForm = FP.defs.nameClash('form', 'Zz ledger in').map(x => x.id);

    // ---- A retired function still evaluates in a form that uses it; it is hidden from the lists.
    await pub('function', 'ZzDbl', { label: 'Double', output: 'number', inputs: [{ name: 'x', type: 'number', required: false }], formula: 'COALESCE(x, 0) * 2' });
    await pub('structure', 'zz-ref', S('Zz ref'));
    const look = await err(pub('function', 'ZzRefAll', { label: 'All refs', kind: 'lookup', output: 'list', inputs: [], reads: { structure: 'zz-ref', from: 'items', return: '*', summary: 'list', window: 'all' } }));
    out.lookPub = look;
    await pub('form', 'zz-fn-form', { title: 'Zz fn form', sources: [], fields: [{ name: 'n', control: 'number', label: 'N' }, { name: 'd', control: 'value', label: 'D', formula: 'ZzDbl(n)' }, { name: 'c', control: 'value', label: 'C', formula: 'COUNT(ZzRefAll())' }] });
    const o1 = await open('zz-fn-form'); o1.inst.set('n', 4); await settle(o1.inst); out.fnBefore = [o1.inst.values().d, o1.inst.values().c]; o1.inst.destroy();
    await FP.defs.retire('function', 'ZzDbl', { force: true });
    await FP.defs.retire('function', 'ZzRefAll', { force: true });
    const o2 = await open('zz-fn-form'); o2.inst.set('n', 5); await settle(o2.inst); out.fnAfter = [o2.inst.values().d, o2.inst.values().c]; o2.inst.destroy();
    out.fnHidden = { get: !!FP.fn.get('ZzDbl'), listed: FP.fn.list().some(f => f.name === 'ZzDbl'), all: FP.fn.listAll().some(f => f.name === 'ZzDbl'), live: FP.defs.live('function').some(d => d.id === 'ZzDbl'), loaded: FP.defs.list('function').find(d => d.id === 'ZzDbl').loaded };

    // ---- Publish refuses what uses a retired definition, naming it.
    await pub('form', 'zz-target', F('Zz target', 'zz-ref'));
    await FP.defs.retire('form', 'zz-target');
    const opener = { title: 'Zz opener', sources: [], fields: [{ name: 'go', control: 'buttons', label: 'Go', formula: 'SORT(x, "y")', caption: '"Open"', form: 'zz-target' }] };
    out.pubOpensRetired = await err(pub('form', 'zz-op1', opener));
    out.pubUsesFn = await err(pub('form', 'zz-op2', { title: 'Uses fn', sources: [], fields: [{ name: 'n', control: 'number' }, { name: 'd', control: 'value', formula: 'ZzDbl(n)' }] }));
    out.pubSaves = await err(pub('form', 'zz-op3', F('Saves', 'zz-gone')));
    out.pubReads = await err(pub('form', 'zz-op4', { title: 'Reads', sources: [{ name: 'it', kind: 'items', structure: 'zz-gone' }], fields: [{ name: 'k', control: 'value', formula: 'COUNT(it)' }] }));
    out.pubLookup = await err(pub('function', 'ZzLook2', { label: 'Look 2', kind: 'lookup', output: 'list', inputs: [], reads: { structure: 'zz-gone', from: 'items', return: '*', summary: 'list', window: 'all' } }));
    out.pubCalc = await err(pub('structure', 'zz-calc', S('Calc', { calculated: { dbl: { fn: 'ZzDbl', inputs: { x: 'n' } } } })));
    out.pubFnCalls = await err(pub('function', 'ZzCaller', { label: 'Caller', output: 'number', inputs: [], formula: 'ZzDbl(2)' }));
    out.fine = await err(pub('form', 'zz-op5', F('Fine', 'zz-ref')));
    return out;
  }).catch(e => ({ thrown: e.message }));
  A.say('result', JSON.stringify(r, null, 1).slice(0, 7000));
  if (r.thrown) bad.push('thrown: ' + r.thrown);
  else {
    expect('entries before', r.before.join() === '5', r.before);
    expect('retired structure: not in has/list, flagged, keeps its rules', !r.flags.has && r.flags.isRetired && r.flags.rule === 'sum' && r.flags.retiredFlag && !r.flags.listed, r.flags);
    expect('a form open at the time is refused on save, plainly', r.saveOpen.result === 'null' && /Not saved: Zz ledger is retired: it takes no new entries/.test(r.saveOpen.text), r.saveOpen);
    expect('a record into it is refused', /Zz ledger is retired: it takes no new entries/.test(r.record), r.record);
    expect('building an entry for it is refused', /retired: it takes no new entries/.test(r.build), r.build);
    expect('opening a form that saves to it is refused clearly', /retired/.test(r.open) && r.open !== 'TOOK', r.open);
    expect('old entries still read, with their rules', r.after.join() === '5', r.after);
    expect('as-of reads still work', r.asOf.join() === '2', r.asOf);
    expect('history keeps the retired version', r.hist.join() === '2r,1', r.hist);
    expect('reinstated: entries go in again', r.reinstated === 'TOOK' && r.afterReinstate.join() === '6', { r: r.reinstated, a: r.afterReinstate });
    expect('a retired structure id is not reused', /retired/.test(r.reuse) && /never reused/.test(r.reuse) && /reinstate/i.test(r.reuse), r.reuse);
    expect('a retired function id is not reused (capitals ignored)', /retired/.test(r.reuseFn), r.reuseFn);
    expect('a name that clashes is reported', r.clashBefore.length === 1 && r.clashBefore[0].id === 'zz-gone' && r.clashBefore[0].retired === true, r.clashBefore);
    expect('the same display name is allowed under a new id, then both are reported', r.newSameName === 'TOOK' && r.clashAfter.join() === 'zz-gone-2:false,zz-gone:true', { n: r.newSameName, c: r.clashAfter });
    expect('no clash, and clashes of forms', r.clashNone.length === 0 && r.clashForm.join() === 'zz-led-in', { n: r.clashNone, f: r.clashForm });
    expect('lookup published', r.lookPub === 'TOOK', r.lookPub);
    expect('a form works out its functions and lookups', r.fnBefore[0] === 8 && r.fnBefore[1] === 0, r.fnBefore);
    expect('the same after both are retired', r.fnAfter[0] === 10 && r.fnAfter[1] === 0, r.fnAfter);
    expect('a retired function is hidden but still defined', r.fnHidden.get && !r.fnHidden.listed && r.fnHidden.all && !r.fnHidden.live && r.fnHidden.loaded === false, r.fnHidden);
    expect('publish refuses opening a retired form', /form zz-target, which is retired/.test(r.pubOpensRetired), r.pubOpensRetired);
    expect('publish refuses using a retired function', /function ZzDbl is retired/.test(r.pubUsesFn), r.pubUsesFn);
    expect('publish refuses saving to a retired structure', /structure zz-gone is retired/.test(r.pubSaves), r.pubSaves);
    expect('publish refuses reading a retired structure', /structure zz-gone is retired/.test(r.pubReads), r.pubReads);
    expect('publish refuses a lookup of a retired structure', /structure zz-gone is retired/.test(r.pubLookup), r.pubLookup);
    expect('publish refuses a structure calculating with a retired function', /function ZzDbl is retired/.test(r.pubCalc), r.pubCalc);
    expect('publish refuses a function calling a retired function', /function ZzDbl is retired/.test(r.pubFnCalls), r.pubFnCalls);
    expect('a form on live definitions still publishes', r.fine === 'TOOK', r.fine);
  }
  A.say('errs', JSON.stringify(bad.concat(A.errs)));
  await A.b.close();
  if (bad.length || A.errs.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
