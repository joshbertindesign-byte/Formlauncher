// 0.52 Packs carry where the forms go: sites, terminal groups and terminals in none with their settings; people only
// into a test folder, with the pack's PIN. Installing again changes nothing; a changed group is brought up to the pack.
const start = require('./dummies/base.js');
(async () => {
  const A = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  await A.w(1200);
  const made = await A.p.evaluate(async () => {
    // The seed's structures are from before kinds (0.59): given theirs, so the pack can be installed elsewhere.
    for (const [id, k] of [['dies', 'list'], ['die-setups', 'records']]) { const d = FP.defs.get('structure', id); if (d && !d.def.kind) await FP.defs.publish('structure', id, Object.assign({}, d.def, { kind: k }), { basedOn: d.version, note: 'kind' }); }
    const g = (await FP.groups.list())[0];
    await FP.groups.update(g.id, { homeForm: 'die-setup', view: 'kiosk', signIn: 'supervisors' });
    await FP.groups.setTerminal('T05', { name: 'QC bench', forms: ['die-register'], view: 'admin', keyboard: 'never' });
    if (FP.outbox) await FP.outbox.flush();
    const full = await FP.packs.make({ name: 'Presses', structures: ['dies'], setup: true, people: true, pin: '111222' });
    const noPin = await FP.packs.make({ name: 'x', setup: true, people: true });
    const plain = await FP.packs.make({ name: 'y' });
    return { full, people: full.setup.people.map(p => `${p.name}:${p.roles.join('/')}:${p.pin}`), noPinPeople: noPin.setup.people.length, plainSetup: plain.setup === undefined };
  });
  A.say('made', JSON.stringify({ sites: made.full.setup.sites, groups: made.full.setup.groups, terminals: made.full.setup.terminals, people: made.people, noPinPeople: made.noPinPeople, plainSetup: made.plainSetup }));
  // The Packs screen offers it.
  await A.p.evaluate(async () => { document.body.innerHTML = '<div id="adm"></div>'; await FP.editor.admin(document.getElementById('adm'), { section: 'packs' }); });
  await A.w(1200);
  await A.p.click('.ffm-r:has-text("Make a pack…")'); await A.w(600);
  A.say('make ui', await A.p.$eval('#adm', x => { const t = x.innerText.replace(/\n+/g, ' / '); const i = t.search(/Where the forms go · installed/i); return i < 0 ? t.slice(0, 300) : t.slice(i, i + 260); }));
  await A.b.close();

  // A fresh folder, not a test folder: everything but the people.
  const B = await start({ at: '2026-11-19T08:00:00-06:00' });
  B.p.on('dialog', d => d.accept().catch(() => {}));
  const text = JSON.stringify(made.full);
  const b1 = await B.p.evaluate(async text => {
    const p = FP.packs.read(text);
    const plan = await FP.packs.plan(p);
    const how = ['sites', 'groups', 'terminals', 'people'].map(k => `${k}: ${plan.setup[k].map(x => x.how).join(',')}`).join(' · ');
    const r = await FP.packs.install(p);
    const ft5 = await FP.groups.forTerminal('T05'), ft1 = await FP.groups.forTerminal('T01');
    return { how, r, T01: { group: ft1.group && ft1.group.name, forms: ft1.forms, home: ft1.homeForm, view: ft1.view, signIn: ft1.signIn }, T05: { forms: ft5.forms, view: ft5.view, keyboard: ft5.keyboard, name: ft5.name },
      users: (await FP.users.list()).map(u => u.name), dies: (await FP.current.load('dies', { fresh: true })).items.size };
  }, text);
  B.say('real folder', JSON.stringify(b1));
  // Someone changes the group here; the pack brings it back, keeping a form it doesn't name.
  const b2 = await B.p.evaluate(async text => {
    const g = (await FP.groups.list())[0];
    await FP.groups.update(g.id, { view: 'admin', forms: g.forms.concat('die-setup') });
    if (FP.outbox) await FP.outbox.flush(); FP.current.clearCache();
    const p = FP.packs.read(text);
    const plan = await FP.packs.plan(p);
    const how = plan.setup.groups.map(x => `${x.how} ${(x.diff || []).join(',')}`).join(' | ');
    await FP.packs.install(p);
    const after = (await FP.groups.list())[0];
    const again = await FP.packs.plan(p);
    return { how, after: { view: after.view, forms: after.forms }, again: ['sites', 'groups', 'terminals', 'people'].map(k => `${k}: ${again.setup[k].map(x => x.how).join(',')}`).join(' · ') };
  }, text);
  B.say('changed', JSON.stringify(b2));
  // Marked as a test folder: the people go in, with the pack's PIN.
  const b3 = await B.p.evaluate(async text => {
    await FP.folder.handle.getFileHandle('THIS IS A TEST FOLDER.txt', { create: true });
    const p = FP.packs.read(text);
    const plan = await FP.packs.plan(p);
    const r = await FP.packs.install(p);
    const lee = (await FP.users.list()).find(u => u.name === 'Lee Carter');
    const ok = await FP.users.verify(lee.id, '111222').then(x => `PIN works${x.mustChange ? ', must change' : ''}`, e => e.message);
    return { people: plan.setup.people.map(x => `${x.x.name}:${x.how}`).join(', '), r: r.setup, lee: ok };
  }, text);
  B.say('test folder', JSON.stringify(b3));
  // Only an admin installs a setup.
  const b4 = await B.p.evaluate(async text => {
    const dana = (await FP.users.list()).find(u => u.name === 'Dana Ruiz');
    await FP.users.signOut('test'); await FP.users.signIn(dana.id, '111222');
    return FP.packs.install(FP.packs.read(text)).then(() => 'took it?!', e => e.message);
  }, text);
  B.say('as a user', b4);
  B.say('errs', JSON.stringify(B.errs));
  await B.b.close();
})();
