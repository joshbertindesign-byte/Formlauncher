// F12 hasRole/can is false for a role name it doesn't know; F13 a person demoted or retired elsewhere loses the role on
// this terminal (the sign-in's own copy of the roles isn't trusted); F33 only one sign-in screen at a time;
// F34 FP.sites.rename of a site that doesn't exist is refused. Fails on a non-empty errs list.
const start = require('./dummies/base.js');
(async () => {
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  const A = await start({ seed: 'dummies/snap15.json', at: '2026-11-18T13:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  await A.w(1500);
  const r = await A.p.evaluate(async () => {
    const out = {};
    // F12
    out.unknownRole = [await FP.users.can('nonsense'), await FP.users.can('admin'), await FP.users.can('')];
    out.requireUnknown = await FP.users.can('Admin');
    // F34
    out.renameUnknown = await FP.sites.rename('NOPE', 'Nowhere').then(() => 'TOOK', e => e.message);
    out.siteCreated = (await FP.sites.list()).some(s => s.id === 'NOPE');
    await FP.sites.create('ZZ1', 'Zed one'); await FP.outbox.flush();
    await new Promise(r => setTimeout(r, 400));   // a later time than the create (the entry with the later time wins)
    await FP.sites.rename('zz1', 'Zed two');
    await FP.outbox.flush(); FP.current.clearCache();
    out.renamed = (await FP.sites.list()).find(s => s.id === 'ZZ1').name === 'Zed two';
    // F13: Kim signs in as an admin; "another terminal" demotes her, then another retires Lee.
    const mk = async (name, roles) => { const id = await FP.users.create({ name, roles, tempPin: '918273' }); await FP.users.changePin(id, '918273', '735194'); return id; };
    const kim = await mk('Kim Admin', ['admin']);
    await FP.users.signOut('test'); await FP.users.signIn(kim, '735194');
    out.before = [await FP.users.can('admin'), await FP.users.can('supervisor')];
    const rec = (action, id, values) => FP.entry.record({ entry: `users.${action}`, item: { structure: 'users', id }, form: { id: 'users', version: 1 }, values });
    await rec('setRoles', kim, { roles: ['supervisor'] });
    await FP.outbox.flush(); FP.current.clearCache();
    out.afterDemote = [await FP.users.can('admin'), await FP.users.can('supervisor'), await FP.users.can('publisher')];
    await rec('retire', kim, { active: false });
    await FP.outbox.flush(); FP.current.clearCache();
    out.afterRetire = [(await FP.users.current()) === null, await FP.users.can('user')];
    return out;
  });
  console.log(JSON.stringify(r));
  ok(r.unknownRole[0] === false && r.unknownRole[1] === true && r.unknownRole[2] === false, 'F12 ' + JSON.stringify(r.unknownRole));
  ok(r.requireUnknown === false, 'F12 role names are exact');
  ok(/no site/i.test(r.renameUnknown) && !r.siteCreated, 'F34 ' + r.renameUnknown + ' created=' + r.siteCreated);
  ok(r.renamed, 'F34 rename of a real site works');
  ok(r.before[0] && r.before[1], 'F13 admin before');
  ok(r.afterDemote[0] === false && r.afterDemote[1] === true && r.afterDemote[2] === false, 'F13 demoted person keeps the old role: ' + JSON.stringify(r.afterDemote));
  ok(r.afterRetire[0] && r.afterRetire[1] === false, 'F13 retired person still signed in: ' + JSON.stringify(r.afterRetire));

  // F33: asked twice, one sign-in screen; one sign-in answers both.
  await A.p.evaluate(() => { window.__g = [FP.users.gate({}), FP.users.gate({})]; });
  await A.w(800);
  const n = await A.p.$$eval('.fp-u', l => l.length);
  ok(n === 1, 'F33 sign-in screens open: ' + n);
  await A.p.click('.fp-u-card >> text=Josh'); await A.w(300); await A.p.keyboard.type('482913'); await A.w(2000);
  const who = await A.p.evaluate(async () => (await Promise.all(window.__g)).map(u => u && u.name));
  ok(who.join() === 'Josh,Josh', 'F33 both asks answered: ' + who.join());
  ok((await A.p.$$eval('.fp-u', l => l.length)) === 0, 'F33 screen closed');
  console.log('F33', n, who.join());
  await A.b.close();
  const all = fails.concat(A.errs);
  console.log('errs      :', JSON.stringify(all));
  process.exit(all.length ? 1 : 0);
})();
