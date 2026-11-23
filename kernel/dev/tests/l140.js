// F16: the form map counts reads through a form's sources (kind item/items). A structure read only through another
// form's source is not "Nothing reads X", and usedBy('structure') lists that form.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const r = await p.evaluate(async () => {
    const out = {};
    const pub = (kind, id, def) => { const cur = FP.defs.get(kind, id); return FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, def), { basedOn: cur ? cur.version : null, note: 'l140' }); };
    await pub('structure', 'zz-lines', { label: 'Lines', kind: 'list', roles: { active: 'active' }, itemId: { label: 'Line', made: 'entered' }, containers: { active: {} } });
    await pub('form', 'zz-writer', { title: 'Writer', sources: [{ name: 'ws', kind: 'item', structure: 'zz-lines', id: { field: 'lid' }, values: { active: 'write' } }], fields: [{ name: 'lid', label: 'Line', control: 'text' }, { name: 'a', label: 'Active', control: 'text', writes: 'ws.active' }] });
    const writerMap = () => FP.map.form('zz-writer');
    out.before = writerMap().problems.filter(x => /Nothing reads/.test(x.text)).length;
    await pub('form', 'zz-reader', { title: 'Reader', sources: [{ name: 'ls', kind: 'items', structure: 'zz-lines', values: { active: 'read' } }], fields: [{ name: 'x', label: 'X', control: 'text' }] });
    await pub('form', 'zz-one', { title: 'One', sources: [{ name: 'l1', kind: 'item', structure: 'zz-lines', id: { fixed: 'L1' }, values: { active: 'read' } }], fields: [{ name: 'x', label: 'X', control: 'text' }] });
    out.nothingReads = writerMap().problems.filter(x => /Nothing reads/.test(x.text)).length;
    out.usedBy = FP.map.usedBy('structure', 'zz-lines').map(u => u.form + ':' + u.how).sort().join(' | ');
    out.usedByContainer = FP.map.usedBy('structure', 'zz-lines', 'active').map(u => u.form).sort().join(',');
    return out;
  });
  say('r', JSON.stringify(r));
  const bad = r.nothingReads !== 0 || !/zz-reader/.test(r.usedBy) || !/zz-one/.test(r.usedBy) || r.before !== 1;
  say('errs', errs);
  await b.close();
  if (bad || (errs && errs.length)) { console.log('FAILED'); process.exit(1); }
})();
