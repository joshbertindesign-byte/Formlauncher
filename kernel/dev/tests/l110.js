// F8/F9 Read first: an optional item (required: false, text or media) never locks or blocks; a required one holds the
// fields, the footer Save, set and sub-form buttons, and a sub-form run opened over the form.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const bad = [];
  const expect = (what, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); say(what, ok ? 'ok ' + JSON.stringify(got) : 'WRONG ' + JSON.stringify(got) + ' wanted ' + JSON.stringify(want)); if (!ok) bad.push(what); };
  await p.evaluate(() => {
    const mk = (ack) => ({ title: 'Ack test', sites: ['all'], sources: [{ name: 'chk', kind: 'item', structure: 'die-setups', id: { generate: true }, values: { notes: 'write' } }],
      acknowledge: [Object.assign({ name: 'a1', label: 'Rules', show: 'text', text: 'Short rules', statement: 'I read it', every: 'record' }, ack)],
      fields: [{ name: 'notes', label: 'Notes', control: 'text', writes: 'chk.notes', required: true }],
      buttons: [{ name: 'save', label: 'Save', action: 'save' }, { name: 'fill', label: 'Fill', action: 'set', sets: { notes: 'filled' } }, { name: 'go', label: 'Quick', action: 'subform', subform: 'quick' }],
      layout: [['notes 12'], ['fill 6', 'go 6']],
      subforms: [{ name: 'quick', label: 'Quick', saves: 'own', sources: [{ name: 'q', kind: 'item', structure: 'die-setups', id: { generate: true }, values: { notes: 'write' } }],
        fields: [{ name: 'n', label: 'N', control: 'text', required: true, writes: 'q.notes' }] }] });
    window.__mk = mk;
  });
  const open = async ack => {
    await p.evaluate(async ack => { window.__i && window.__i.destroy && window.__i.destroy(); document.body.innerHTML = '<div id="h" style="padding:20px;max-width:900px"></div>'; const def = window.__mk(ack); window.__probs = FP.forms.check(def); window.__i = await FP.forms.open(document.getElementById('h'), 'ack-test', { def, draft: false }); }, ack);
    await w(1200);
  };
  const state = () => p.evaluate(() => ({ btn: Object.fromEntries(window.__i.buttons().map(x => [x.name, x.enabled])), notesInert: document.querySelector('[data-name="notes"]').inert }));
  // F8: optional text item
  await open({ required: false });
  say('check', JSON.stringify(await p.evaluate(() => window.__probs)));
  await p.fill('[data-name="notes"] input', 'abc'); await p.keyboard.press('Tab'); await w(500);
  let s = await state();
  expect('optional: fields open', s.notesInert, false);
  expect('optional: save enabled', s.btn.save, true);
  expect('optional: set and subform enabled', [s.btn.fill, s.btn.go], [true, true]);
  // F9: required item
  await open({});
  s = await state();
  expect('required: fields locked', s.notesInert, true);
  expect('required: nothing enabled', s.btn, { save: false, fill: false, go: false });
  await p.evaluate(() => { Promise.resolve(window.__i.press('go')).catch(() => {}); }); await w(600);
  expect('required: pressing the sub-form button opens nothing', await p.$$eval('.fpf-sheet', l => l.length), 0);
  await p.evaluate(() => { document.querySelectorAll('.fpf-sheet').forEach(x => x.remove()); });
  await p.evaluate(() => { window.__i.openSubform('quick').catch(() => {}); }); await w(1200);
  const run = await p.evaluate(() => { const sh = document.querySelector('.fpf-sheet'); if (!sh) return null; return Array.from(sh.querySelectorAll('.fpf-save')).map(x => [x.textContent.trim(), x.disabled, x.title]); });
  say('sub-form run', JSON.stringify(run));
  expect('required: a sub-form run is locked too', !!run && run.length > 0 && run.every(x => x[1] === true), true);
  await p.evaluate(() => { document.querySelectorAll('.fpf-sheet').forEach(x => x.remove()); });
  // confirming opens everything
  await p.click('.fpf-ack button.ok'); await w(1200);
  await p.fill('[data-name="notes"] input', 'abc'); await p.keyboard.press('Tab'); await w(500);
  s = await state();
  expect('confirmed: all enabled', s.btn, { save: true, fill: true, go: true });
  say('errs', JSON.stringify(errs));
  await b.close();
  if (bad.length || errs.length) { console.log('FAILED:', bad.join(', ')); process.exit(1); }
})();
