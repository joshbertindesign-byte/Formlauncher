// 0.49 Records you can defend: each line names the line before it (a changed line shows), an ID saved new twice
// shows, supervisors correct from Records in the launcher, and Admin > Speed shows each terminal's times.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say, snapshot } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1200);
  // A2: three saves chain; changing the middle one breaks the chain at the next line.
  const a2 = await p.evaluate(async () => {
    const day = FP.util.localDate();
    for (const [id, press] of [['D-2001', 'Press 1'], ['D-2002', 'Press 2'], ['D-2003', 'Press 3']])
      await FP.entry.record({ entry: 'dies.save', item: { structure: 'dies', id }, form: { id: 'die-register', version: 1 }, values: { press, description: 'test', lowTemp: 800, highTemp: 900 } });
    await FP.outbox.flush();
    const parts = ['data', 'dies', day], name = FP.identity.terminalId + '.jsonl';
    const text = await FP.files.readText(parts, name);
    const before = await FP.files.verifyChain(text);
    const lines = text.split('\n').filter(Boolean);
    const prevs = lines.map(l => JSON.parse(l).prev);
    const i = lines.findIndex(l => l.includes('D-2002'));
    lines[i] = lines[i].replace('Press 2', 'Press 9');
    await FP.files.writeText(parts, name, lines.join('\n') + '\n');
    const after = await FP.files.verifyChain(await FP.files.readText(parts, name));
    FP.current.clearCache();
    const load = await FP.current.load('dies', { fresh: true });
    const all = await FP.current.verifyFiles('dies');
    return { before, prevs: prevs.map(x => x === 'start' ? 'start' : x ? x.length + ' hex' : 'none'), after, health: load.health.filter(h => /follow the line/.test(h)), files: { files: all.files, broken: all.broken } };
  });
  say('chain', JSON.stringify(a2));
  // R3: a structure whose IDs are saved new once: the same ID saved by two terminals shows.
  const r3 = await p.evaluate(async () => {
    const d = FP.defs.get('structure', 'dies');
    const def = JSON.parse(JSON.stringify(d.def)); def.itemId = Object.assign({}, def.itemId, { once: true }); def.kind = def.kind || 'list';
    await FP.defs.publish('structure', 'dies', def, { basedOn: d.version });
    await FP.entry.record({ entry: 'dies.save', item: { structure: 'dies', id: 'D-3001' }, form: { id: 'die-register', version: 1 }, values: { press: 'Press 1' } });
    // The same die from another terminal, a minute later (its file synced in afterwards).
    const at = new Date(Date.now() + 60000).toISOString();
    await FP.files.appendLine(['data', 'dies', FP.util.localDate()], 'T07.jsonl', { v: FP.ENTRY_VERSION, entryId: 'T07-X-1', entry: 'dies.save', item: { structure: 'dies', id: 'D-3001' }, refs: {}, form: { id: 'die-register', version: 1 }, writtenAt: at, terminalId: 'T07', userId: null, corrects: null, submissionId: 'S-T07-X-1', commit: true, values: { press: 'Press 2' } });
    await FP.outbox.flush();
    FP.current.clearCache();
    const r = await FP.current.load('dies', { fresh: true });
    return { twice: r.twice.map(x => `${x.id}: ${x.saves.map(s => s.terminalId).join(' + ')}`), health: r.health.filter(h => /more than once/.test(h)).map(h => h.slice(0, 60)), check: FP.defs.list('structure').length };
  });
  say('twice', JSON.stringify(r3));
  // R2 and A4 in a new page, from what is saved now (each page starts from its seed).
  await snapshot('l74snap.json');
  const T = await start({ seed: 'l74snap.json', at: '2026-11-18T13:00:00-06:00', noSignIn: true });
  T.p.on('dialog', d => d.accept().catch(() => {}));
  await T.p.goto('file:///home/claude/kernel/launcher.html?form=die-register'); await T.w(3500);
  if (await T.p.$('.fp-u-card')) { await T.p.click('.fp-u-card >> text=Josh'); await T.w(300); await T.p.keyboard.type('482913'); await T.w(3000); }
  await T.p.evaluate(() => FP.current.saveStats());
  say('stats', JSON.stringify(await T.p.evaluate(async () => { const st = await FP.files.readJson(['_stats'], FP.identity.terminalId + '.json'); return Object.entries(st.forms || {}).map(([k, v]) => `${k}: ${v.readyMs >= 0 ? 'timed' : '?'}`); })));
  // A4: a supervisor corrects a record from the launcher's Records.
  await T.p.click('#home'); await T.w(2000);
  await T.p.click('button:has-text("Records: find and correct")'); await T.w(2500);
  await T.p.selectOption('.fpl-row select', 'dies'); await T.w(2500);
  await T.p.fill('.fpl-row input', 'D-2001'); await T.w(500);
  await T.p.click('.fpl-rlist button >> nth=0'); await T.w(1200);
  await T.p.click('button:has-text("Correct…")'); await T.w(600);
  await T.p.fill('.fpl-fix label:has-text("description") input, .fpl-fix label:has-text("Description") input', 'corrected text');
  await T.p.click('button:has-text("Save the correction")'); await T.w(800);
  say('no reason', await T.p.$eval('.fpl-fix .fpl-sub', x => x.textContent).catch(() => '?'));
  await T.p.fill('.fpl-fix label:has-text("Why") input', 'typo on the die sheet');
  await T.p.click('button:has-text("Save the correction")'); await T.w(3000);
  say('corrected', JSON.stringify(await T.p.evaluate(async () => { FP.current.clearCache(); const r = await FP.current.load('dies', { fresh: true }); const it = r.items.get('D-2001'); return { description: it.values.description, notice: (document.querySelector('.fpl-notice') || {}).textContent || '' }; })));
  await T.snapshot('l74snap2.json');
  await T.b.close();
  // Admin > Speed and Records health, in the editor.
  const E = await start({ seed: 'l74snap2.json', at: '2026-11-18T13:00:00-06:00' });
  await E.w(1200);
  await E.p.click('.fpe-adminbtn:not(.fpe-helpbtn)'); await E.w(1500);
  await E.p.click('.fpa-tabs button:has-text("Speed")'); await E.w(1500);
  say('speed', (await E.p.$eval('.fpe', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '?')).match(/Add or change a die: ready in [^/]+/) + '');
  await E.p.click('.fpa-tabs button:has-text("Records")'); await E.w(2000);
  await E.p.selectOption('.fpa-tools select', 'dies').catch(() => {}); await E.w(2500);
  say('health', (await E.p.$eval('.fpe', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '?')).slice(0, 700));
  say('errs2', JSON.stringify(E.errs));
  await E.b.close();
  say('errs', JSON.stringify(errs));
  await b.close();
})();
