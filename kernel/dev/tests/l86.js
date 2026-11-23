// 0.55 The trace tree, a generic visual: a chain (a lot made from a lot made from a lot, looping back), a branch that
// can't be worked out, the depth limit, and the checks that refuse a tree with no branch, a branch under nothing, or
// one named top.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  await w(1500);
  const r = await p.evaluate(async () => {
    const pub = (kind, id, def) => { const cur = FP.defs.get(kind, id); return FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, kind === 'form' ? { sources: [] } : {}, def), { basedOn: cur ? cur.version : null, note: 'tree' }); };
    await pub('structure', 'zz-lots', { label: 'Lots', kind: 'list', itemId: { made: 'entered' }, containers: { parent: {}, resin: {} } });
    await pub('function', 'LotById', { label: 'A lot', kind: 'lookup', output: 'record', inputs: [{ name: 'id', type: 'text' }], reads: { structure: 'zz-lots', from: 'items', match: { $id: 'id' }, return: '*', summary: 'latest', window: 'all' } });
    for (const [id, parent, resin] of [['L1', 'L2', 'PVC-A'], ['L2', 'L3', 'PVC-B'], ['L3', 'L1', 'PVC-C']]) await FP.entry.record({ entry: 'zz-lots.make', item: { structure: 'zz-lots', id }, form: { id: 'test', version: 1 }, values: { parent, resin } });
    const form = depth => ({ title: 'Lot tree',
      sources: [{ name: 'lot', kind: 'item', structure: 'zz-lots', id: { field: 'lotId' }, values: { parent: 'read', resin: 'read' } }],
      fields: [{ name: 'lotId', control: 'text', label: 'Lot' },
        { name: 'tree', control: 'tree', label: 'Made from', formula: 'IF(ISBLANK(lot.resin), LIST(), lot)', topLabel: 'Lot', title: '{$id}', show: 'resin {resin}', depth, select: true,
          levels: [{ name: 'from', label: 'Made from', under: 'top, from', formula: 'LotById(item.parent)', title: '{$id}', show: 'resin {resin}', open: true },
            { name: 'bad', label: 'Broken branch', formula: 'LotById(1 / 0)' }] },
        { name: 'picked', control: 'value', label: 'Picked', formula: 'IF(ISBLANK(tree.selected), "none", tree.selected.$id & " " & tree.selected.resin)' }],
      buttons: [] });
    const out = {};
    const refuse = async (what, f) => pub('form', 'zz-tree-bad', f).then(() => `${what}: TOOK`, e => `${what}: ${e.message.replace(/^.*?(Field tree[^;]*).*$/, '$1')}`);
    const base = form(10);
    const t = base.fields[1];
    out.refused = [
      await refuse('no branch', Object.assign({}, base, { fields: [base.fields[0], Object.assign({}, t, { levels: [] })] })),
      await refuse('under nothing', Object.assign({}, base, { fields: [base.fields[0], Object.assign({}, t, { levels: [{ name: 'a', under: 'nope', formula: 'item' }] })] })),
      await refuse('named top', Object.assign({}, base, { fields: [base.fields[0], Object.assign({}, t, { levels: [{ name: 'top', formula: 'item' }] })] })),
    ].join(' | ');
    await pub('form', 'zz-tree', base);
    await pub('form', 'zz-tree-short', form(3));
    return out;
  });
  say('refused', r.refused);
  // The editor: the tree field's settings, with its branches.
  await p.locator('.fpe-mrow:has(span:text-is("Lot tree"))').first().click({ timeout: 5000 }).catch(e => say('row', e.message.slice(0, 60))); await w(2500);
  await p.click('.ffm-r[data-key="f:tree"]').catch(e => say('row', e.message.slice(0, 80))); await w(1200);
  const props = await p.$eval('.ffm-props', x => x.innerText.replace(/\n+/g, ' / ')).catch(e => 'FAIL ' + e.message.slice(0, 80));
  await (await p.$('.ffm-props')).screenshot({ path: 'l86-editor.png' });
  say('editor', ['Trace tree', 'Branches', 'Hangs under', 'What it holds', 'Top label', 'Levels deep at most'].map(k => `${k} ${props.includes(k) ? 'shown' : 'MISSING'}`).join(' · '));
  const open = async (id, lot) => {
    await p.evaluate(async id => { document.body.innerHTML = '<div id="bench"></div>'; window.__inst = await FP.forms.open(document.getElementById('bench'), id, { draft: false }); }, id);
    await w(1200);
    await p.fill('[data-name="lotId"] input', lot); await w(2500);
  };
  const tree = () => p.$eval('[data-name="tree"]', x => x.innerText.replace(/\n+/g, ' / ')).catch(e => 'FAIL ' + e.message.slice(0, 60));
  await open('zz-tree', 'L1');
  say('chain', await tree());
  await p.click('[data-name="tree"] .fpv-tree > li > ul > li .bd'); await w(1500);
  say('picked', await p.$eval('[data-name="picked"]', x => x.innerText.replace(/\n+/g, ' / ')));
  await open('zz-tree-short', 'L1');
  say('depth 3', await tree());
  await open('zz-tree', 'NOPE');
  say('none', await tree());
  say('errs', JSON.stringify(errs).slice(0, 400));
  await b.close();
})();
