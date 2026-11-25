// 0.67 Retiring terminals, identity layer: retire keeps the registry file and marks it { at, by, note }; the ID is refused
// (assign and conflict, a plain message), check-in keeps the mark, reinstate clears it, only an admin can, never the terminal
// you are on; forget stays in the API; all() still lists retired terminals (callers filter).
const start = require('./dummies/base.js');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const { b, p, w, errs } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-24T09:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const r = await p.evaluate(async () => {
    const out = {};
    const I = FP.identity;
    const say = async f => { try { return { ok: await f() }; } catch (e) { return { err: e.message }; } };
    const names = async () => (await I.all()).map(t => t.terminalId).sort().join(',');
    // Two more terminals on the list, written the way a check-in writes them (as other devices).
    for (const id of ['T02', 'T05']) await FP.files.writeJson(['_terminals'], id + '.json', { terminalId: id, site: 'HOU', deviceKey: 'other-' + id, lastSeen: '2026-11-20T08:00:00.000Z', kernel: FP.version });
    out.before = await names();
    out.api = ['retire', 'reinstate', 'isRetired', 'forget'].map(k => typeof I[k]).join(',');
    out.notThere = (await say(() => I.retire('T99'))).err;
    out.mine = (await say(() => I.retire(I.terminalId))).err;   // the editor is not a terminal: its own ID is EDITOR-xxxx, so only a real match is refused
    // Retire T05: the file stays, with who, when and why.
    const e = (await say(() => I.retire('T05', 'replaced by T07'))).ok;
    out.mark = JSON.stringify({ at: !!e.retired.at && Date.parse(e.retired.at) > 0, by: e.retired.by, note: e.retired.note });
    const file = await I.lookup('T05');
    out.kept = `${await names()} · site ${file.site} · key ${file.deviceKey} · seen ${file.lastSeen} · retired ${I.isRetired(file)} · T02 retired ${I.isRetired(await I.lookup('T02'))}`;
    out.date = I.retiredOn(file);
    out.again = (await say(() => I.retire('T05', 'again'))).ok.retired.note;   // already retired: the first mark stands
    // Its ID is refused: conflict and assign, in plain words, not just a warning.
    out.conflict = (await say(() => I.conflict('T05'))).err;
    out.assign = (await say(() => I.assign('T05'))).err;
    out.assignLower = (await say(() => I.assign(' t05 '))).err;
    out.stillMine = I.terminalId;
    out.otherFine = JSON.stringify((await say(() => I.conflict('T02'))).ok && 'T02 in use by another device');
    // Check-in keeps the mark on the same device's entry.
    const mineBefore = I.terminalId, keyBefore = I.deviceKey, siteBefore = I.site;
    I.terminalId = 'T05'; I.site = 'HOU'; I.editor = false; I.deviceKey = 'other-T05';
    await I.checkIn();
    const afterCheckIn = await I.lookup('T05');
    out.checkIn = `retired ${I.isRetired(afterCheckIn)} · note ${afterCheckIn.retired && afterCheckIn.retired.note} · seen moved ${afterCheckIn.lastSeen !== '2026-11-20T08:00:00.000Z'}`;
    I.terminalId = mineBefore; I.site = siteBefore; I.editor = true; I.deviceKey = keyBefore;
    // forget is still there for repairs: it removes the file.
    out.forgetT02 = (await say(() => I.forget('T02'))).err || (await names());
    // Reinstate clears the mark, and keeps the rest.
    const back = (await say(() => I.reinstate('T05'))).ok;
    out.reinstated = `${I.isRetired(await I.lookup('T05'))} · site ${back.site} · key ${back.deviceKey}`;
    out.reinstateAgain = JSON.stringify(I.isRetired((await say(() => I.reinstate('T05'))).ok));
    out.reinstateNone = (await say(() => I.reinstate('T99'))).err;
    out.conflictAfter = JSON.stringify((await say(() => I.conflict('T05'))).ok && 'in use by another device');
    // A non-admin cannot retire or reinstate.
    const mk = async (name, roles) => { const id = await FP.users.create({ name, roles, tempPin: '918273' }); await FP.users.changePin(id, '918273', '735194'); return id; };
    const kim = await mk('Kim Publisher', ['publisher']);
    await I.retire('T05', 'x');
    await FP.users.signOut('test'); await FP.users.signIn(kim, '735194');
    out.nonAdminRetire = (await say(() => I.retire('T05', 'no'))).err;
    out.nonAdminReinstate = (await say(() => I.reinstate('T05'))).err;
    out.nonAdminForget = (await say(() => I.forget('T05'))).err;
    out.stays = JSON.stringify(I.isRetired(await I.lookup('T05')));
    return out;
  });
  const E = (what, got, want) => expect(what, want instanceof RegExp ? want.test(got) : got === want, got);
  E('listed before', r.before, 'T01,T02,T05');
  E('api', r.api, 'function,function,function,function');
  E('no such terminal', r.notThere, /no terminal T99/);
  E('retire refuses the terminal you are on', r.mine, /terminal you are on/);
  E('mark', r.mark, '{"at":true,"by":"Josh","note":"replaced by T07"}');
  E('file kept', r.kept, 'T01,T02,T05 · site HOU · key other-T05 · seen 2026-11-20T08:00:00.000Z · retired true · T02 retired false');
  E('date', r.date, '24 Nov 2026');
  E('retire twice keeps the first mark', r.again, 'replaced by T07');
  E('conflict refuses', r.conflict, 'T05 was retired on 24 Nov 2026; pick another ID.');
  E('assign refuses', r.assign, 'T05 was retired on 24 Nov 2026; pick another ID.');
  E('assign refuses any spelling', r.assignLower, 'T05 was retired on 24 Nov 2026; pick another ID.');
  expect('assign changed nothing (still the editor\'s own random ID)', /^EDITOR-[A-Z0-9]+$/.test(r.stillMine), r.stillMine);
  E('another ID is as before', r.otherFine, '"T02 in use by another device"');
  E('check-in keeps the mark', r.checkIn, 'retired true · note replaced by T07 · seen moved true');
  E('forget still works', r.forgetT02, 'T01,T05');
  E('reinstated', r.reinstated, 'false · site HOU · key other-T05');
  E('reinstate when not retired is a no-op', r.reinstateAgain, 'false');
  E('reinstate none', r.reinstateNone, /no terminal T99/);
  E('conflict after reinstate', r.conflictAfter, '"in use by another device"');
  E('non-admin retire', r.nonAdminRetire, 'Only an admin can retire a terminal.');
  E('non-admin reinstate', r.nonAdminReinstate, 'Only an admin can reinstate a terminal.');
  E('non-admin forget', r.nonAdminForget, 'Only an admin can remove a terminal.');
  E('still retired', r.stays, 'true');
  expect('page errors', !errs.length, errs);
  console.log(JSON.stringify(r, null, 1));
  console.log('errs      :', JSON.stringify(bad.concat(errs)));
  await b.close();
  if (bad.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
