// Makes dummies/snap15b.json, the starting point of l60, l64-l66, l70-l83 and others (its original was made by hand and lost).
//
// What the tests need of it (worked out from them, see docs/SNAP15B.md): snap15 (the end of l59: the chain's structures and forms,
// the users Josh, Dana Ruiz, Lee Carter and Sam Ortiz, site Houston, terminal T01) with
//   - terminal T01 IN the group "Production presses" (l59 takes it out and its step to put it back no longer works), and
//   - the form die-register needing a supervisor's approval (l60: a user's new die is held until a supervisor approves it), and
//   - that group's forms being only "Add or change a die" (die-register): l60 expects a plain user to be refused Die setup check
//     (die-setup) on T01, and a supervisor to be able to open it.
// It is then saved with a clean sign-in state, like the other seeds.
const start = require('./base.js');
(async () => {
  const A = await start({ seed: 'dummies/snap15.json' });   // runs on the same shifted clock as the seeds, so its changes are stamped after theirs
  A.p.on('dialog', d => d.accept().catch(() => {}));
  await A.w(1500);
  const r = await A.p.evaluate(async () => {
    const g = (await FP.groups.list()).find(x => x.name === 'Production presses');
    await FP.groups.update(g.id, { terminals: ['T01'], forms: ['die-register'] });
    // l60: what a plain user saves on Add or change a die is held until a supervisor approves it.
    const df = FP.defs.get('form', 'die-register');
    if (!df.def.approval) await FP.defs.publish('form', 'die-register', Object.assign({}, df.def, { approval: true }), { basedOn: df.version, note: 'Needs a supervisor\'s approval' });
    if (FP.outbox) await FP.outbox.flush();
    FP.current.clearCache && FP.current.clearCache();
    const ft = await FP.groups.forTerminal('T01');
    return { group: ft.group && ft.group.name, forms: ft.forms, home: ft.homeForm, view: ft.view };
  });
  A.say('T01 now', JSON.stringify(r));
  if (r.group !== 'Production presses' || r.forms.join() !== 'die-register') { console.error('seed not as intended'); process.exit(1); }
  await A.snapshot(__dirname + '/snap15b.json');
  await A.b.close();
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
