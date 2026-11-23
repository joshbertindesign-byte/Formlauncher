// 0.40: a sub-form once for each item of a list; one changed on another terminal meanwhile says so.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap14.json' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.evaluate(async () => {
    const M = { title: 'Close dies', sites: ['all'],
      sources: [{ name: 'allDies', kind: 'items', structure: 'dies', values: { description: 'read' } }],
      fields: [{ name: 'who', label: 'Who', control: 'text' }, { name: 'notesAll', label: 'All notes', control: 'text' }, { name: 'n', label: 'How many', control: 'number' }],
      buttons: [{ name: 'save', label: 'Save', action: 'save' }, { name: 'go', label: 'Go through the dies', action: 'subform', subform: 'each1' }],
      subforms: [{ name: 'each1', label: 'Die', title: '"Die " & each.$id', repeat: { list: 'allDies' }, saves: 'own', required: true,
        sources: [{ name: 'd', kind: 'item', structure: 'dies', id: { field: 'each' }, values: { description: 'both' } }],
        fields: [{ name: 'dieId', label: 'Die', control: 'value', formula: 'each.$id' }, { name: 'desc', label: 'Description', control: 'text', required: true, writes: 'd.description' }],
        back: [{ to: 'notesAll', from: 'desc', how: 'join' }, { to: 'n', from: 'desc', how: 'count' }] }] };
    window.__probs = FP.forms.check(M);
    document.body.innerHTML = '<div id="h" style="padding:20px;max-width:900px"></div>';
    window.__i = await FP.forms.open(document.getElementById('h'), 'close-dies', { def: M });
  });
  say('check', JSON.stringify(await p.evaluate(() => __probs)));
  say('save blocked', await p.$eval('#h .fpf-why', x => x.textContent));
  await p.locator('#h').getByRole('button', { name: /^Go through/ }).click(); await w(1200);
  say('run 1', await p.$eval('.fpf-sheet', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 160)));
  // While run 1 is open, T02 changes D-1052
  await p.evaluate(async () => { const t = FP.identity.terminalId; FP.identity.terminalId = 'T02'; await FP.entry.record({ entry: 'dies.save', item: { structure: 'dies', id: 'D-1047' }, form: { id: 'other', version: 1 }, values: { description: 'Closed by T02' } }); FP.identity.terminalId = t; FP.current.clearCache(); });
  await p.fill('.fpf-sheet [data-name="desc"] input', 'Checked A'); await p.keyboard.press('Tab'); await w(300);
  await p.locator('.fpf-sheet').getByRole('button', { name: 'Save', exact: true }).click(); await w(1800);
  say('run 2', await p.$eval('.fpf-sheet', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 260)));
  say('item', JSON.stringify(await p.evaluate(async () => { const it = await FP.current.item('dies', 'D-1047'); return { at: it.lastAt, t: it.lastTerminalId, by: it.lastUserId }; })));
  await p.screenshot({ path: 'l57-notice.png' });
  await p.locator('.fpf-sheet').getByRole('button', { name: 'Skip it', exact: true }).click(); await w(1500);
  say('after', JSON.stringify(await p.evaluate(() => ({ sheets: document.querySelectorAll('.fpf-sheet').length, runs: __i.runs(), notes: __i.values().notesAll, n: __i.values().n }))));
  say('why', await p.$eval('#h .fpf-why', x => x.textContent));
  say('state', await p.$$eval('#h .fpf-substate', l => l.map(x => x.textContent).join('|')));
  say('errors', errs);
  await b.close();
})();
