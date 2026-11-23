// 0.60 Targeting by kind: only the open items of a list source; the open one whose line is the form's line; $open on
// every item; a choice or chips picking from a structure (a list's in use, others' open ones); fill in the form from an
// item; the kind's own questions; due item by item only through kinds that open and close; what groups and terminals
// are for, and HERE(); the editor's map as Plant · Data · Forms · People.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  await w(1500);
  const r = await p.evaluate(async () => {
    const out = {};
    const pub = (kind, id, def) => { const cur = FP.defs.get(kind, id); return FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, def), { basedOn: cur ? cur.version : null, note: 'l90' }); };
    await pub('structure', 'zz-lines', { label: 'Lines', kind: 'list', roles: { active: 'active' }, itemId: { label: 'Line', made: 'entered' }, containers: { active: {}, notes: {} } });
    await pub('structure', 'zz-runs', { label: 'Runs', kind: 'runs', roles: { ended: 'endAt' }, itemId: { made: 'entered' }, containers: { line: {}, part: {}, endAt: {}, speed: {} } });
    await pub('structure', 'zz-recs', { label: 'Checks', kind: 'records', containers: { od: {} } });
    const rec = (s, id, values) => FP.entry.record({ entry: `${s}.save`, item: Object.assign({ structure: s }, id ? { id } : {}), form: { id: 'test', version: 1 }, values });
    await rec('zz-lines', 'L1', { active: true, notes: 'first' }); await rec('zz-lines', 'L2', { active: true }); await rec('zz-lines', 'L9', { active: false });
    await rec('zz-runs', 'R1', { line: 'L1', part: '805' }); await rec('zz-runs', 'R0', { line: 'L2', part: 'old', endAt: '2026-11-18T10:00:00-06:00' }); await rec('zz-runs', 'R2', { line: 'L2', part: 'V819' });
    await FP.outbox.flush(); FP.current.clearCache();

    // Sources: the open ones of a list, the open one whose line is the form's, and $open on each item.
    const src = { sources: [
      { name: 'running', kind: 'items', structure: 'zz-runs', open: true },
      { name: 'every', kind: 'items', structure: 'zz-runs' },
      { name: 'runOn', kind: 'item', structure: 'zz-runs', id: { open: { line: 'line' } } },
      { name: 'lines', kind: 'items', structure: 'zz-lines', open: true },
    ], fields: [{ name: 'line', control: 'text' }] };
    out.check = JSON.stringify(FP.sources.check(src));
    const v = await FP.sources.evaluate(src, { line: 'L2' }, {});
    out.open = `running ${v.running.map(x => x.$id).sort().join(',')} · every ${v.every.map(x => `${x.$id}${x.$open ? '' : ' (closed)'}`).sort().join(',')} · on L2 ${v.runOn.$id} · lines in use ${v.lines.map(x => x.$id).sort().join(',')}`;
    const v2 = await FP.sources.evaluate(src, { line: 'L9' }, {});
    out.none = `on L9: ${FP.fn.isNoData(v2.runOn) ? 'none open' : v2.runOn.$id}`;
    out.norm = JSON.stringify(FP.sources.normalize(Object.assign({}, src, { fields: [{ name: 'line', control: 'text' }, { name: 'sp', control: 'number', writes: 'runOn.speed' }] })).items);
    out.refusedSrc = FP.sources.check({ sources: [{ name: 'x', kind: 'item', structure: 'zz-runs', id: { open: { line: 'nope' } } }, { name: 'y', kind: 'items', structure: 'zz-runs', open: 'yes' }], fields: [{ name: 'a', control: 'text' }] }).join(' | ');

    // Picking from a structure, and filling in from an item: as written, then as the runtime works with it.
    const formDef = {
      title: 'Pick and fill', sites: ['all'],
      sources: [
        { name: 'lineItem', kind: 'item', structure: 'zz-lines', id: { field: 'line' }, fill: true, values: { active: 'both', notes: 'both' } },
        { name: 'runOn', kind: 'item', structure: 'zz-runs', id: { open: { line: 'line' } }, values: { part: 'read', speed: 'write', endAt: 'write' } },
      ],
      fields: [
        { name: 'line', control: 'choice', label: 'Line', pick: 'zz-lines', defaultFrom: 'HERE()', required: true },
        { name: 'run', control: 'choice', label: 'Run', pick: 'zz-runs', pickWhere: 'line = form.line' },
        { name: 'several', control: 'chips', label: 'Lines', pick: 'zz-lines' },
        { name: 'active', control: 'toggle', label: 'In use', default: true, writes: 'lineItem.active' },
        { name: 'notes', control: 'text', label: 'Notes', writes: 'lineItem.notes' },
        { name: 'part', control: 'value', label: 'Part', formula: 'runOn.part' },
        { name: 'speed', control: 'number', label: 'Speed', writes: 'runOn.speed' },
      ],
      layout: [['line 6', 'run 6'], ['several 12'], ['active 6', 'notes 6'], ['part 6', 'speed 6']],
    };
    const ex = FP.kinds.form(formDef);
    out.expanded = ex.fields.filter(f => ['line', 'run', 'several', 'active', 'notes'].includes(f.name)).map(f => `${f.name}: ${f.optionsFrom || f.defaultFrom}`).join(' | ');
    out.expandedSrc = ex.sources.filter(s => /^pick_/.test(s.name)).map(s => `${s.name} ${s.structure}${s.open ? ' open' : ''}${s.filter ? ' where ' + s.filter : ''}`).join(' | ');
    out.formCheck = JSON.stringify(FP.forms.check(formDef));
    out.badPicks = FP.forms.check(Object.assign({}, formDef, { sources: formDef.sources.concat([{ name: 'recs', kind: 'items', structure: 'zz-recs', open: true }]), fields: formDef.fields.concat([
      { name: 'b1', control: 'text', label: 'Typed', pick: 'zz-lines' },
      { name: 'b2', control: 'choice', label: 'Nowhere', pick: 'zz-nope' },
      { name: 'b3', control: 'choice', label: 'Both', pick: 'zz-lines', options: ['a'] },
    ]) })).filter(x => /Typed|Nowhere|Both|recs/.test(x)).join(' | ');
    out.questions = FP.kinds.questions('zz-runs').map(q => `${q.field.label} (${q.field.control}${q.field.defaultFrom ? ', ' + q.field.defaultFrom : ''}) → ${q.value}`).join(' | ');
    out.listQ = FP.kinds.questions('zz-lines').map(q => `${q.field.label} → ${q.value}`).join(' | ');

    // Due item by item: through a kind that opens and closes; a list never closes.
    out.dueList = FP.centers.check({ name: 'X', members: { role: 'user' }, duties: [{ name: 'd', forms: ['zz-nothing'], every: 60, forEach: 'zz-lines' }] }).filter(x => /item by item/.test(x)).join(' | ');
    out.dueRuns = FP.centers.check({ name: 'X', members: { role: 'user' }, duties: [{ name: 'd', forms: ['zz-nothing'], every: 60, forEach: 'zz-runs' }] }).filter(x => /item by item|While/.test(x)).join(' | ') || 'no problem with runs';

    // What a group is for; HERE().
    const site = FP.identity.site || (await FP.sites.list())[0].id;
    const gid = await FP.groups.create({ name: 'L90 lines', site, terminals: [], forms: [], for: { list: 'zz-lines', items: ['L1', 'L2'] } });
    out.group = JSON.stringify((await FP.groups.get(gid)).for);
    out.badFor = await FP.groups.update(gid, { for: { list: 'zz-runs', items: ['R1'] } }).then(() => 'TOOK', e => e.message);
    await FP.groups.update(gid, { for: null });
    out.cleared = String((await FP.groups.get(gid)).for);
    await FP.groups.setTerminal('T77', { for: { list: 'zz-lines', items: ['L2'] } });
    out.term = JSON.stringify((await FP.groups.forTerminal('T77')).for);
    FP.kinds.setHere({ list: 'zz-lines', items: ['L1', 'L2'] }, null);
    out.here0 = `${FP.fn.evaluate('HERE()', {})} · all ${JSON.stringify(FP.fn.evaluate('HERE("all")', {}))}`;
    FP.kinds.setHere({ list: 'zz-lines', items: ['L1', 'L2'] }, 'L2');
    out.here1 = FP.fn.evaluate('HERE()', {});
    await pub('form', 'zz-pick', formDef);
    return out;
  });
  Object.entries(r).forEach(([k, v]) => say(k, v));

  // The form running: options from the picks, filled in from the line, the open run on the line HERE says.
  await p.evaluate(async () => {
    const h = document.createElement('div'); h.id = 'l90host'; document.body.prepend(h);
    window.__f = await FP.forms.open(h, 'zz-pick', { draft: false });
  });
  await w(2500);
  const look = () => p.evaluate(() => {
    const sel = n => { const c = document.querySelector(`#l90host [data-field="${n}"]`) || null; return c; };
    const opts = n => Array.from(document.querySelectorAll(`#l90host .fpf-cell[data-name="${n}"] option, #l90host .fpf-cell[data-name="${n}"] .fpc-chips button`)).map(o => o.textContent).filter(t => t && t !== 'Choose…').join(',');
    const v = window.__f.values ? window.__f.values() : {};
    return { line: v.line, run: opts('run'), several: opts('several'), lineOpts: opts('line'), active: v.active, notes: v.notes, part: document.querySelector('#l90host .fpf-cell[data-name="part"]') ? document.querySelector('#l90host .fpf-cell[data-name="part"]').innerText.replace(/\n+/g, ' ') : '?' };
  });
  say('running', JSON.stringify(await look()));
  await p.evaluate(() => FP.kinds.setHere({ list: 'zz-lines', items: ['L1', 'L2'] }, 'L1')); await w(2000);
  say('here L1', JSON.stringify(await look()));
  await p.evaluate(() => { window.__f.destroy(); document.getElementById('l90host').remove(); FP.kinds.setHere(null); });

  // The map: Plant · Data · Forms · People; Data by kind, each structure with its forms and lookups.
  await p.evaluate(() => FP.editor.refreshMap()); await w(1500);
  say('headings', await p.$$eval('.fpe-maphead b', l => l.map(x => x.textContent).join(' · ')));
  say('data', await p.$$eval('.fpe-mrow', l => l.filter(x => x.querySelector('small.k') && /^(list|orders|runs|inventory|cases|records|no kind)$/.test(x.querySelector('small.k').textContent)).map(x => `${x.querySelector('span').textContent} [${x.querySelector('small.k').textContent}]`).join(' | ')));
  say('lines below rows', String(await p.$$eval('.fpe-msub', l => l.length)));
  const runsRow = p.locator('.fpe-item:has(span:text-is("Runs"))').first();
  await runsRow.locator('i.cv').click().catch(() => {}); await w(500);
  say('under Runs', await p.$$eval('.fpe-mrow.part', l => l.map(x => x.innerText.replace(/\n+/g, ' ')).filter(t => /Pick and fill/.test(t)).join(' | ') || 'none'));
  await p.screenshot({ path: './out/l90-map.png' });
  say('errs', JSON.stringify(errs).slice(0, 400));
  await b.close();
})();
