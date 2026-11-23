// 0.59 Kinds of structures. Every structure published has a kind (list, orders, runs, inventory, cases, records) and
// says which of its values plays each of the kind's roles; the kind brings the status, the open rule and the ID rule.
// Refused without a kind or a role it needs; statuses worked out from the kind; the editor's kind picker and roles.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  await w(1500);
  const r = await p.evaluate(async () => {
    const pub = (id, def) => { const cur = FP.defs.get('structure', id); return FP.defs.publish('structure', id, Object.assign({ sites: ['all'] }, def), { basedOn: cur ? cur.version : null, note: 'kinds' }); };
    const refuse = async (what, def) => pub('zz-bad', def).then(() => `${what}: TOOK`, e => `${what}: ${e.message.replace(/^.*?can't be published[^:]*:\s*/i, '').slice(0, 110)}`);
    const out = {};
    out.kinds = FP.kinds.list().map(k => k.label).join(', ');
    out.refused = [
      await refuse('no kind', { label: 'X', containers: { a: {} } }),
      await refuse('unknown kind', { label: 'X', kind: 'general', containers: { a: {} } }),
      await refuse('runs, no ended', { label: 'X', kind: 'runs', containers: { a: {} } }),
      await refuse('role not a value', { label: 'X', kind: 'runs', roles: { ended: 'nope' }, containers: { a: {} } }),
      await refuse('done not added up', { label: 'X', kind: 'orders', roles: { wanted: 'qty', done: 'made' }, containers: { qty: {}, made: {} } }),
      await refuse('own open rule', { label: 'X', kind: 'runs', roles: { ended: 'endAt' }, containers: { endAt: {} }, open: 'TRUE' }),
      await refuse('list made new', { label: 'X', kind: 'list', itemId: { made: 'new' }, containers: { a: {} } }),
      await refuse('status the kind gives', { label: 'X', kind: 'runs', roles: { ended: 'endAt' }, containers: { endAt: {} }, status: [{ value: 'Running', when: 'TRUE' }] }),
      await refuse('list with status', { label: 'X', kind: 'list', containers: { active: {} }, status: [{ value: 'Big', when: 'TRUE' }] }),
    ];
    // One of each, with items saved, and what the kind makes of them.
    await pub('zz-list', { label: 'Colours', kind: 'list', roles: { active: 'active' }, itemId: { made: 'entered' }, containers: { active: {} } });
    await pub('zz-orders', { label: 'Needs', kind: 'orders', roles: { wanted: 'qty', done: 'made', cancelled: 'cancelled' }, containers: { qty: {}, made: { rule: 'sum' }, cancelled: {} } });
    await pub('zz-runs', { label: 'Runs', kind: 'runs', roles: { ended: 'endAt' }, itemId: { made: 'entered' }, containers: { endAt: {}, shiftEnd: {} }, status: [{ value: 'Shift over', when: 'shiftEnd < NOW()' }] });
    await pub('zz-inv', { label: 'Racks', kind: 'inventory', roles: { quantity: 'pieces', hold: 'hold', gone: 'shippedAt' }, itemId: { made: 'entered' }, containers: { pieces: {}, hold: {}, shippedAt: {} } });
    await pub('zz-cases', { label: 'Downtime', kind: 'cases', roles: { closed: 'closedAt', acknowledged: 'ackAt' }, containers: { closedAt: {}, ackAt: {}, reason: {} } });
    await pub('zz-recs', { label: 'OD checks', kind: 'records', containers: { od: {} }, status: [{ value: 'Out', when: 'od > 2' }, { value: 'In', when: 'TRUE' }] });
    const rec = (s, id, values) => FP.entry.record({ entry: `${s}.save`, item: Object.assign({ structure: s }, id ? { id } : {}), form: { id: 'test', version: 1 }, values });
    await rec('zz-list', 'RED', { active: true }); await rec('zz-list', 'TAN', { active: false });
    await rec('zz-orders', 'N1', { qty: 3 }); await rec('zz-orders', 'N1', { made: 2 }); await rec('zz-orders', 'N2', { qty: 2 }); await rec('zz-orders', 'N2', { made: 1 }); await rec('zz-orders', 'N2', { made: 1 }); await rec('zz-orders', 'N3', { qty: 5, cancelled: true });
    await rec('zz-runs', 'R1', { shiftEnd: '2026-11-18T18:00:00-06:00' }); await rec('zz-runs', 'R2', { shiftEnd: '2026-11-18T06:00:00-06:00' }); await rec('zz-runs', 'R3', { endAt: '2026-11-18T10:00:00-06:00' });
    await rec('zz-inv', 'K1', { pieces: 40 }); await rec('zz-inv', 'K2', { pieces: 40, hold: true }); await rec('zz-inv', 'K3', { pieces: 40, shippedAt: '2026-11-18T09:00:00-06:00' });
    await rec('zz-cases', null, { reason: 'die' }); await rec('zz-cases', null, { reason: 'power', ackAt: '2026-11-18T08:00:00-06:00' }); await rec('zz-cases', null, { reason: 'jam', closedAt: '2026-11-18T09:00:00-06:00' });
    await rec('zz-recs', null, { od: 1.9 }); await rec('zz-recs', null, { od: 2.1 });
    await FP.outbox.flush(); FP.current.clearCache();
    out.items = {};
    for (const s of ['zz-list', 'zz-orders', 'zz-runs', 'zz-inv', 'zz-cases', 'zz-recs']) {
      const res = await FP.current.load(s, { fresh: true });
      out.items[s] = Array.from(res.items.values()).map(it => `${it.id.length > 8 ? '#' + it.id.slice(-2) : it.id} ${it.status}${it.open ? ' (open)' : ''}`).join(', ');
    }
    out.recIds = Array.from((await FP.current.load('zz-recs', { fresh: true })).items.keys()).length + ' items (a new one each save)';
    out.def = JSON.stringify(FP.structures.get('zz-runs').status.map(x => x.value)) + ' · open ' + FP.structures.get('zz-runs').open;
    out.older = `a structure from before kinds (dies) still loads: ${FP.structures.has('dies')}, kind ${FP.structures.get('dies').kind || 'none'}`;
    return out;
  });
  say('kinds', r.kinds);
  r.refused.forEach((x, i) => say('refused ' + i, x));
  Object.entries(r.items).forEach(([k, v]) => say(k, v));
  say('records', r.recIds);
  say('runs def', r.def);
  say('older', r.older);
  // The editor: a new structure starts with the kinds; Runs guesses its roles; the kind's status shows.
  await p.evaluate(async () => { await FP.defs.drafts.save('structure', 'zz-new', { def: { label: 'Shifts', containers: { endAt: {}, startAt: {}, crew: {} }, sites: ['all'] } }); });
  await p.evaluate(() => FP.editor.openDef('structure', 'zz-new')); await w(2500);
  say('picker', await p.$$eval('.ffe-kinds button', l => l.map(x => x.dataset.kind).join(' ')).catch(() => 'FAIL no picker'));
  await p.click('.ffe-kinds button[data-kind="runs"]'); await w(1200);
  say('rows', await p.$$eval('.ffm-r', l => l.map(r => r.dataset.key + '=' + r.querySelector('.t').textContent + (r.querySelector('.d') ? ' (' + r.querySelector('.d').textContent + ')' : '')).filter(x => /^(role|stb|st)/.test(x)).join(' | ')));
  await p.click('.ffm-r[data-key="top"]'); await w(600);
  say('kind setting', await p.$eval('.ffe-kind select', s => s.value).catch(() => 'none'));
  await p.selectOption('.ffe-kind select', 'list'); await w(1000);
  await p.click('.ffm-r[data-key="id"]'); await w(600);
  say('list id', await p.$eval('.ffm-props select', s => `${s.value} ${s.disabled ? '(set by the kind)' : 'changeable'}`));
  say('errs', JSON.stringify(errs).slice(0, 400));
  await b.close();
})();
