// 0.50 Structure: values carried from a source onto the record; the editor takes the form's plain
// settings from one list; one layout walker; one element helper.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1200);
  // D1: a setup form carries the die's press and description onto each setup, with no field for either.
  const d1 = await p.evaluate(async () => {
    const def = {
      title: 'Setup with carry', sites: ['all'],
      sources: [
        { name: 'die', kind: 'item', structure: 'dies', id: { field: 'dieNo' }, values: { press: 'read', description: 'read' },
          carry: { to: 'setup', values: { press: 'press', notes: 'die.description & " (carried)"' } } },
        { name: 'setup', kind: 'item', structure: 'die-setups', id: { generate: true, prefix: 'DS' }, values: { die: 'write', press: 'write', ovenTemp: 'write', notes: 'write' } },
      ],
      fields: [{ name: 'dieNo', control: 'text', label: 'Die', required: true, uppercase: true },
        { name: 'dieCopy', control: 'value', formula: 'dieNo', snapshot: 'setup.die' },
        { name: 'ovenTemp', control: 'number', label: 'Oven', writes: 'setup.ovenTemp', required: true }],
      buttons: [{ name: 'save', label: 'Save', action: 'save' }],
    };
    const problems = FP.forms.check(def);
    const bad = FP.forms.check(Object.assign({}, def, { sources: [Object.assign({}, def.sources[0], { carry: { to: 'nope', values: ['press'] } }), def.sources[1]] }));
    const notWrite = FP.forms.check(Object.assign({}, def, { sources: [Object.assign({}, def.sources[0], { carry: { to: 'setup', values: ['lowTemp'] } }), def.sources[1]] }));
    const host = document.createElement('div'); document.body.appendChild(host);
    const f = await FP.forms.open(host, 'carry-t', { def, draft: false });
    await new Promise(r => setTimeout(r, 800));
    f.set ? f.set('dieNo', 'D-1047') : null;
    const inp = host.querySelector('[data-name="dieNo"] input'); inp.value = 'D-1047'; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.dispatchEvent(new Event('change', { bubbles: true }));
    const ov = host.querySelector('[data-name="ovenTemp"] input'); ov.value = '905'; ov.dispatchEvent(new Event('input', { bubbles: true })); ov.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise(r => setTimeout(r, 1200));
    await f.press('save'); await FP.outbox.flush(); FP.current.clearCache();
    const r = await FP.current.load('die-setups', { fresh: true });
    const last = Array.from(r.items.values()).sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)))[0];
    return { problems, bad: bad.filter(x => /carr/i.test(x)), notWrite: notWrite.filter(x => /carr/i.test(x)), cells: host.querySelectorAll('.fpf-cell:not([hidden])').length, saved: last && { die: last.values.die, press: last.values.press, notes: last.values.notes, oven: last.values.ovenTemp } };
  });
  say('carry', JSON.stringify(d1));
  // T5: the form's plain settings come from one list.
  say('plain', JSON.stringify(await p.evaluate(() => FP.forms.plainFormSettings())));
  // D3 and D8: one layout walker; one element helper.
  say('layout', JSON.stringify(await p.evaluate(() => ({
    cells: FP.layout.cells([['a 6', 'b 6'], { section: 'S', rows: [['c']] }, { panels: [{ rows: [['d 4']] }, { rows: [{ tabs: [{ tab: 'T', rows: [['e']] }] }] }] }]),
    el: FP.dom.el('b', 'x', 'hi').outerHTML,
  }))));
  say('errs', JSON.stringify(errs));
  await b.close();
})();
