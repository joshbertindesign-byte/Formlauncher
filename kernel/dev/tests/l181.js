// 0.67 Retiring sites: setActive(id, false) is refused while an active (not retired) terminal or an active group is at the site,
// naming each with what to do; allowed once they are retired or broken up; reinstate works as before; a non-admin cannot.
const start = require('./dummies/base.js');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const { b, p, w, errs } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-24T09:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const r = await p.evaluate(async () => {
    const out = {};
    const say = async f => { try { return { ok: await f() }; } catch (e) { return { err: e.message }; } };
    const active = async id => (await FP.sites.list()).find(s => s.id === id).active;
    await FP.sites.create('ELP', 'El Paso');
    for (const id of ['T05', 'T06']) await FP.files.writeJson(['_terminals'], id + '.json', { terminalId: id, site: 'ELP', deviceKey: 'other-' + id, lastSeen: '2026-11-20T08:00:00.000Z', kernel: FP.version });
    const gid = await FP.groups.create({ name: 'Packing line', site: 'ELP', terminals: ['T06'], forms: [] });
    // An active terminal and an active group: refused, each named with what to do.
    out.refused = (await say(() => FP.sites.setActive('ELP', false))).err;
    out.stillOn = await active('ELP');
    // Retiring one terminal is not enough while the other and the group are there.
    await FP.identity.retire('T05', 'gone');
    out.afterOne = (await say(() => FP.sites.setActive('ELP', false))).err;
    // A retired terminal is not in the way; the group still is.
    await FP.groups.update(gid, { terminals: [] });
    await FP.identity.retire('T06', 'gone');
    out.groupOnly = (await say(() => FP.sites.setActive('ELP', false))).err;
    await FP.groups.remove(gid);
    out.allowed = (await say(() => FP.sites.setActive('ELP', false))).err || 'retired';
    out.nowOn = await active('ELP');
    const row = (await FP.sites.list()).find(s => s.id === 'ELP');
    out.when = `${!!row.retiredAt} · ${row.retiredBy ? 'by someone' : 'by nobody'}`;
    out.noNew = (await say(() => FP.sites.assign('ELP'))).err;
    // The site of the retired terminals is still on their files, and entries keep naming it.
    out.files = (await FP.identity.lookup('T05')).site + (await FP.identity.lookup('T06')).site;
    // Reinstate works as today, and a terminal that was retired stays retired.
    out.reinstated = (await say(() => FP.sites.setActive('ELP', true))).err || (await active('ELP'));
    out.termStays = FP.identity.isRetired(await FP.identity.lookup('T05'));
    // A site with a live terminal (T01 at HOU) is refused too.
    out.hou = (await say(() => FP.sites.setActive('HOU', false))).err;
    // A site with nothing at it, never used by a terminal, retires at once.
    await FP.sites.create('DAL', 'Dallas');
    out.empty = (await say(() => FP.sites.setActive('DAL', false))).err || 'retired';
    // A non-admin cannot.
    const id = await FP.users.create({ name: 'Kim Publisher', roles: ['publisher'], tempPin: '918273' }); await FP.users.changePin(id, '918273', '735194');
    await FP.users.signOut('test'); await FP.users.signIn(id, '735194');
    out.nonAdmin = (await say(() => FP.sites.setActive('DAL', true))).err;
    return out;
  });
  const E = (what, got, want) => expect(what, want instanceof RegExp ? want.test(got) : got === want, got);
  E('refused', r.refused, /^ELP can't be retired while these are still at it: terminal T05: retire it first.*; terminal T06: retire it first.*; group Packing line: break it up first.*\.$/);
  E('site still on', r.stillOn, true);
  E('one terminal retired, the rest named', r.afterOne, /^ELP can't be retired while these are still at it: terminal T06: .*group Packing line: /);
  expect('retired T05 not named', !/T05/.test(r.afterOne || ''), r.afterOne);
  E('only the group is named', r.groupOnly, /^ELP can't be retired while these are still at it: group Packing line: break it up first/);
  expect('no terminal named then', !/terminal T0/.test(r.groupOnly || ''), r.groupOnly);
  E('allowed', r.allowed, 'retired');
  E('now off', r.nowOn, false);
  E('who and when are kept', r.when, 'true · by someone');
  E('takes no new terminals', r.noNew, /no active site ELP/);
  E('files keep the site', r.files, 'ELPELP');
  E('reinstated', r.reinstated, true);
  E('terminal stays retired', r.termStays, true);
  E('HOU refused', r.hou, /^HOU can't be retired while these are still at it: .*terminal T01: retire it first/);
  E('empty site retires', r.empty, 'retired');
  E('non-admin', r.nonAdmin, 'Only an admin can change sites.');
  expect('page errors', !errs.length, errs);
  console.log(JSON.stringify(r, null, 1));
  console.log('errs      :', JSON.stringify(bad.concat(errs)));
  await b.close();
  if (bad.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
