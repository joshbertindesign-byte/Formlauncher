// F6 drafts and held sub-form records keep photos and drawings; F32 drafts are per form and per person (an old
// per-form draft goes to the first person to open it); F31 print() puts the record ID in the margin; F29 the item
// picker: Enter on an empty search picks nothing, and the list is read again.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const bad = [];
  const expect = (what, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); say(what, ok ? 'ok ' + JSON.stringify(got) : 'WRONG ' + JSON.stringify(got) + ' wanted ' + JSON.stringify(want)); if (!ok) bad.push(what); };
  const def = {
    title: 'Draft test', sites: ['all'], print: true,
    sources: [{ name: 'chk', kind: 'item', structure: 'die-setups', id: { field: 'dno' }, values: { notes: 'write' } }],
    fields: [
      { name: 'dno', label: 'Die', control: 'text' },
      { name: 'notes', label: 'Notes', control: 'text', writes: 'chk.notes' },
      { name: 'sign', label: 'Signature', control: 'draw' },
      { name: 'pics', label: 'Photos', control: 'file', accept: 'image/*' },
    ],
    buttons: [{ name: 'save', label: 'Save', action: 'save' }, { name: 'sigBtn', label: 'Sign', action: 'subform', subform: 'sig' }],
    subforms: [{ name: 'sig', label: 'Sign off', fields: [{ name: 'who', label: 'Signature', control: 'draw' }, { name: 'pic', label: 'Photo', control: 'file', accept: 'image/*' }] }],
  };
  await p.evaluate(d => { window.__d = d; window.__open = async (draft) => { window.__i && window.__i.destroy && window.__i.destroy(); document.body.innerHTML = '<div id="h" style="padding:20px;max-width:900px"></div>'; window.__i = await FP.forms.open(document.getElementById('h'), 'draft-test', { def: window.__d, draft, printPreview: true }); }; }, def);
  const open = async () => { await p.evaluate(() => window.__open(true)); await w(1000); };
  const sketch = async sel => { const c = await p.$(sel + ' canvas'); const bb = await c.boundingBox(); await p.mouse.move(bb.x + 20, bb.y + 20); await p.mouse.down(); await p.mouse.move(bb.x + 120, bb.y + 60, { steps: 8 }); await p.mouse.up(); await w(300); };
  const pic = { name: 'pic.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]) };
  say('check', JSON.stringify(await p.evaluate(() => FP.forms.check(window.__d))));
  await open();
  await p.fill('[data-name="dno"] input', 'D-777'); await p.fill('[data-name="notes"] input', 'half done'); await sketch('[data-name="sign"]');
  await p.setInputFiles('[data-name="pics"] input[type=file]', pic); await w(800);
  const user = await p.evaluate(() => FP.users.now() && FP.users.now().id);
  const keys = await p.evaluate(() => window.__kvDump().map(x => x[0]).filter(k => /^formDraft/.test(k)));
  say('draft keys', JSON.stringify(keys));
  expect('F32 draft is per person', keys, [`formDraft:draft-test:${user}`]);
  // F6: reopen the form: the drawing and the photo come back
  await open();
  const back = await p.evaluate(() => { const v = window.__i.values(); return { dno: v.dno, sign: typeof v.sign === 'string' ? v.sign.slice(0, 11) : v.sign, pics: Array.isArray(v.pics) ? v.pics : v.pics }; });
  say('restored', JSON.stringify(back));
  expect('F6 the drawing is back', back.sign, 'drawn');   // the form's value for a drawing is 'drawn' to formulas; the draft must hold the picture
  const raw = await p.evaluate(() => window.__kvDump().filter(x => /^formDraft/.test(x[0])).map(x => ({ sign: String(x[1].values.sign).slice(0, 14), pics: Array.isArray(x[1].values.pics) ? x[1].values.pics.map(f => f && f.name) : x[1].values.pics }))[0]);
  expect('F6 the draft holds the real values', raw, { sign: 'data:image/png', pics: ['pic.jpg'] });
  expect('F6 the photo is back', await p.$$eval('[data-name="pics"] img, [data-name="pics"] .fpc-thumb, [data-name="pics"] [class*=thumb]', l => l.length > 0), true);
  // F32: another person does not get it; the old per-form key goes to the first who opens it
  const other = await p.evaluate(async () => { const real = FP.users.now; FP.users.now = () => ({ id: 'someone-else', name: 'Someone' }); await window.__open(true); const v = window.__i.values().notes; FP.users.now = real; return v; });
  await w(300);
  expect('F32 the next person starts empty', other == null, true);
  await p.evaluate(() => FP.kv.set('formDraft:draft-test', { at: new Date().toISOString(), values: { notes: 'old key' } }).then(async () => { const real = FP.users.now; FP.users.now = () => ({ id: 'third', name: 'Third' }); await window.__open(true); window.__first = window.__i.values().notes; await window.__open(true); window.__second = window.__i.values().notes; FP.users.now = real; }));
  expect('F32 an old draft goes to one person, once', await p.evaluate(() => [window.__first, window.__second == null]), ['old key', true]);
  // F31: the margin names the record
  await p.evaluate(() => window.__open(false)); await w(800);
  await p.fill('[data-name="dno"] input', 'D-888'); await w(500);
  const margin = await p.evaluate(async () => { const r = await window.__i.print('record', {}); const st = Array.from(document.head.querySelectorAll('style')).map(x => x.textContent).filter(t => /@page/.test(t)).pop() || ''; r.done(); const m = /@top-right\{content:([^;]*);/.exec(st); return m ? m[1] : st.slice(0, 200); });
  say('margin', margin);
  expect('F31 the record ID is in the margin', /D-888/.test(margin), true);
  // F6 (held sub-form): the run keeps its drawing and photo when opened again
  await p.evaluate(() => window.__open(false)); await w(800);
  await p.evaluate(() => { window.__i.openSubform('sig').catch(() => {}); }); await w(1200);
  await sketch('.fpf-sheet [data-name="who"]');
  await p.setInputFiles('.fpf-sheet [data-name="pic"] input[type=file]', pic); await w(500);
  await p.click('.fpf-sheet .fpf-save'); await w(1000);
  expect('sub-form run closed', await p.$$eval('.fpf-sheet', l => l.length), 0);
  await p.evaluate(() => { window.__i.openSubform('sig').catch(() => {}); }); await w(1500);
  const ink = await p.$eval('.fpf-sheet [data-name="who"] canvas', c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; });
  expect('F6 a held run keeps its drawing', ink, true);
  expect('F6 a held run keeps its photo', await p.$$eval('.fpf-sheet [data-name="pic"] img, .fpf-sheet [data-name="pic"] [class*=thumb]', l => l.length > 0), true);
  await p.evaluate(() => document.querySelectorAll('.fpf-sheet').forEach(x => x.remove()));
  // F29: the item picker
  const pk = await p.evaluate(async () => {
    const st = 'die-setups';
    const def = { title: 'Pick test', sites: ['all'], fields: [{ name: 'd', label: 'Die', control: 'pick', structure: st, closedToo: true }] };
    document.body.innerHTML = '<div id="h"></div>';
    window.__pk = await FP.forms.open(document.getElementById('h'), 'pick-test', { def, draft: false });
    return (await FP.current.load(st)).items.size;
  });
  say('items', pk);
  await p.focus('[data-name="d"] input'); await w(600);
  await p.keyboard.press('Enter'); await w(500);
  expect('F29 Enter on an empty search picks nothing', await p.evaluate(() => window.__pk.values().d == null), true);
  await p.evaluate(async () => { await FP.entry.record({ entry: 'die-setups.save', item: { structure: 'die-setups', id: 'ZZ-NEW-1' }, form: { id: 't', version: 1 }, values: { notes: 'fresh' } }); await FP.outbox.flush(); FP.current.clearCache(); });
  await p.evaluate(() => document.activeElement.blur()); await p.focus('[data-name="d"] input'); await w(800);
  expect('F29 a new item shows without reopening', await p.$$eval('[data-name="d"] .fpc-list button', l => l.some(x => /ZZ-NEW-1/.test(x.textContent))), true);
  say('errs', JSON.stringify(errs));
  await b.close();
  if (bad.length || errs.length) { console.log('FAILED:', bad.join(', ')); process.exit(1); }
})();
