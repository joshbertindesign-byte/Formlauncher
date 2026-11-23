// F18: a save counts for one due slot only. Slots overlap by the grace period, so a save just after one slot's end
// used to count for it ("done late") and for the next ("done"). It now belongs to the earliest slot still unmet.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15.json', at: '2026-11-19T10:20:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const r = await p.evaluate(async () => {
    const out = {};
    try {
      const pub = (kind, id, def) => { const cur = FP.defs.get(kind, id); return FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, def), { basedOn: cur ? cur.version : null, note: 'l141' }); };
      await pub('form', 'zz-due', { title: 'Hourly walk', sources: [], fields: [{ name: 'a', label: 'A', control: 'text' }], due: [{ name: 'walk', every: 60, grace: 30, per: 'terminal', owner: { role: 'user' } }] });
      const tid = FP.identity.terminalId;
      const now = new Date('2026-11-19T13:20:00-06:00');
      const save = async (iso, n) => FP.entry.record({ entry: 'submissions.save', item: { structure: 'submissions', id: 'SUB-' + n }, form: { id: 'zz-due', version: 1 }, values: { form: 'zz-due' }, at: new Date(iso), autoRefs: {} });
      const view = async () => {
        FP.current.clearCache();
        const l = (await FP.due.slots({ now, terminalId: tid, forms: ['zz-due'] })).filter(x => x.start >= new Date('2026-11-19T10:30:00-06:00').getTime() && x.start <= now.getTime());
        return l.sort((a, b) => a.start - b.start).map(x => `${new Date(x.start).toTimeString().slice(0, 2)}h ${x.state}`).join(', ');
      };
      out.none = await view();
      await save('2026-11-19T12:10:00-06:00', 1);
      out.oneSave = await view();          // 11h done late (claims it); 12h is not also done
      await save('2026-11-19T11:30:00-06:00', 2);
      out.twoSaves = await view();         // 11h done (11:30); 12h done (12:10)
    } catch (e) { out.ERROR = e.message; }
    return out;
  });
  Object.entries(r).forEach(([k, v]) => say(k, v));
  const bad = r.ERROR || !/11h done late, 12h late/.test(r.oneSave || '') || !/11h done, 12h done/.test(r.twoSaves || '');
  say('errs', errs);
  await b.close();
  if (bad || (errs && errs.length)) { console.log('FAILED'); process.exit(1); }
})();
