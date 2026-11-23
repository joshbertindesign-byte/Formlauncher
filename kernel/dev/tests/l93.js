// 0.62 Escalation ladders and the responsibility rehearsal. A center's ladder: levels after so many minutes, telling
// centers, roles, departments or people; a miss opens an alert that climbs it (people away left out; a level with
// nobody passes on), Acknowledge stops the climb, Excuse or the same check done again puts it right. The test clock
// (test folders) jumps ahead for every tab; the rehearsal notices for a terminal; quick sign-in; the launcher's alerts.
const start = require('./dummies/base.js');
const pilot = require('./dummies/pt.js');
const SP = './out/';
(async () => {
  const A = await start({ seed: 'pilot2/snapQC.json', at: '2026-11-19T09:40:00-06:00', dropKv: ['openSessions'] });
  const { p, w, say } = A;
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(3000);
  if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh').catch(() => {}); await w(300); await p.keyboard.type('482913'); await w(2000); }
  const r = await p.evaluate(async () => {
    const out = {};
    try {
    const hm = t => new Date(t).toTimeString().slice(0, 5);
    const cs = await FP.centers.list();
    const lo = cs.find(c => c.name === 'Line operators'), ss = cs.find(c => c.name === 'Shift supervisors'), qt = cs.find(c => c.name === 'Quality techs');
    const refuse = async l => FP.centers.update(lo.id, { ladder: l }).then(() => 'TOOK', e => e.message.replace(/^.*?Ladder/, 'Ladder').slice(0, 90));
    out.refused = [await refuse([{ after: -5, tell: { centers: [ss.id] } }]), await refuse([{ after: 30, tell: {} }]), await refuse([{ after: 60, tell: { role: 'supervisor' } }, { after: 30, tell: { role: 'admin' } }])].join(' | ');
    await FP.centers.update(lo.id, { ladder: [{ after: 30, tell: { centers: [ss.id] }, ack: true }, { after: 120, tell: { centers: [qt.id] }, ack: true }] });
    out.ladder = (await FP.centers.get(lo.id)).ladder.map(l => `${l.after} min → ${l.tell.centers.length} center${l.ack ? ' (ack)' : ''}`).join(', ');
    out.test = `test folder ${await FP.folder.isTest()} · clock ${FP.testClock.text()}`;
    // The line: the hourly checks owed now, at T01.
    const at = async () => { const x = await FP.alerts.noticeFor('T01'); return x; };
    let n = await at();
    const runs = n.list.filter(x => x.center && x.center.name === 'Line operators' && ['due', 'late'].includes(x.state));
    out.owed = runs.map(x => `${x.item.id.replace(/^\d+-\d+ /, '')} ${hm(x.start)} ${x.state}`).join(', ');
    const target = runs[0];
    // Jump to just after it is missed: the miss is recorded and an alert opens (shown at the line, no level yet).
    await FP.testClock.jump(target.lateUntil - Date.now() + 60000);
    n = await at();
    const alerts = async () => (await FP.alerts.list(true)).filter(a => a.center === lo.id);
    let a = (await alerts()).find(x => x.id === target.id);
    out.dbg = `now ${hm(Date.now())} Date patched ${Date.name} target ${target.id} lateUntil ${hm(target.lateUntil)} · after: ${n.list.filter(x => x.series === target.series).map(x => `${hm(x.start)} ${x.state} rec:${x.recorded}`).join(', ')}`;
    out.missed = `${FP.testClock.text()} · ${n.recorded} miss(es) recorded · alert ${a ? `${a.title} · ${a.item.replace(/^\d+-\d+ /, '')} · ${FP.alerts.words(a)} · at ${a.terminal}` : 'NONE'}`;
    // 30 minutes on: the shift supervisors.
    await FP.testClock.jump(30 * 60000); await at();
    a = (await alerts()).find(x => x.id === target.id);
    out.level1 = `${FP.testClock.text()} · ${FP.alerts.words(a)}`;
    // Someone away is left out: Kevin away today.
    const users = await FP.users.list();
    const kevin = users.find(u => u.name === 'Kevin Hart');
    await FP.users.setAway(kevin.id, new Date().toISOString().slice(0, 10), null, 'vacation');
    out.away = `Quality techs told now: ${(await FP.alerts.whoIsTold({ centers: [qt.id] }, Date.now())).map(u => u.name).join(', ') || 'nobody (passes on)'}`;
    await FP.users.setAway(kevin.id, null);
    // Two hours: Quality techs.
    await FP.testClock.jump(90 * 60000); await at();
    a = (await alerts()).find(x => x.id === target.id);
    out.level2 = `${FP.testClock.text()} · ${FP.alerts.words(a)} · history ${a.told.map(t => `L${t.level} ${hm(t.at)} ${t.to}`).join('; ')}`;
    out.forKevin = (await FP.alerts.forUser(kevin, { terminalId: 'T02' })).map(x => x.item.replace(/^\d+-\d+ /, '')).join(', ');
    out.forTom = (await FP.alerts.forUser(users.find(u => u.name === 'Tom Reed'), { terminalId: 'T02' })).length + ' (not told, not at the line)';
    out.atLine = (await FP.alerts.forUser(null, { terminalId: 'T01' })).length + ' at T01';
    // Acknowledged: it stops climbing.
    await FP.alerts.ack(a.id, 'Line 1 was down for a die change');
    out.again = await FP.alerts.ack(a.id, 'twice').then(() => 'TOOK', e => e.message);
    await FP.testClock.jump(180 * 60000); await at();
    a = (await alerts()).find(x => x.id === target.id);
    out.acked = `${FP.alerts.words(a)} · still level ${a.level} · open ${!a.closedAt}`;
    // Excused: put right.
    const slot = { id: a.id, formId: a.form, recorded: true };
    await FP.due.excuse(slot, 'line down');
    a = (await alerts()).find(x => x.id === target.id);
    out.excused = FP.alerts.words(a);
    // Rehearsal sign-in: refused until the rehearsal allows it.
    out.quickOff = await FP.users.rehearsalSignIn(kevin.id).then(() => 'TOOK', e => e.message);
    } catch (e) { out.ERROR = e.message + ' ' + String(e.stack).split('\n').slice(1, 3).join(' '); }
    return out;
  });
  Object.entries(r).forEach(([k, v]) => say(k, v));
  // The rehearsal, in Admin › Test folder.
  await p.click('text=⚙ Admin'); await w(1500);
  await p.click('.fpa-tabs button:has-text("Test folder"), button:has-text("Test folder")'); await w(4000);
  say('rehearsal', (await p.$eval('.fpa-reh', x => x.innerText.replace(/\n+/g, ' / ')).catch(e => 'MISSING ' + e.message.slice(0, 50))).slice(0, 700));
  await p.screenshot({ path: SP + 'l93-rehearsal.png', fullPage: true });
  await p.click('.fpa-reh input[type=checkbox]'); await w(1500);
  say('quick', await p.evaluate(async () => JSON.stringify(await FP.files.readJson(['_test'], 'rehearsal.json'))));
  say('open as', await p.$$eval('.fpa-reh-vps button', l => l.map(x => x.textContent).join(' | ')));
  const before = await p.$eval('.fpa-reh-clock', x => x.textContent);
  await p.click('.fpa-reh button:has-text("+1 hour")'); await w(2500);
  say('jumped', `${before} → ${await p.$eval('.fpa-reh-clock', x => x.textContent)}`);
  say('editor chip', await p.evaluate(() => FP.testClock.text()));
  await A.snapshot(SP + 'l93-snap.json');
  await A.b.close();

  // A level's person at a desk terminal: the alert at the top of their home page (a new alert climbs for them).
  const t = await pilot({ seed: SP + 'l93-snap.json' });
  await t.signIn('Kevin Hart', '975310');
  await t.p.evaluate(async () => {
    // A new miss, two hours on: the second level (Quality techs) has been told.
    await FP.testClock.load();
    const x = await FP.alerts.noticeFor('T01');
    return x.recorded;
  });
  await t.p.evaluate(() => FP.launcher.home()); await t.w(2500);
  say('clock chip', await t.text('#testclock'));
  say('kevin home', (await t.text('#alerts')).slice(0, 400));
  await t.p.screenshot({ path: SP + 'l93-alerts.png' });
  const hasAck = await t.p.$('#alerts .fpl-acard:not(.acked) button:has-text("Acknowledge")');
  if (hasAck) {
    await t.p.fill('#alerts .fpl-acard:not(.acked) input', 'checking now');
    await t.p.click('#alerts .fpl-acard:not(.acked) button:has-text("Acknowledge")'); await t.w(2000);
    say('acked', `${await t.text('#notice')} · ${(await t.text('#alerts')).slice(0, 200)}`);
  } else say('acked', 'no alert to acknowledge');
  say('errs', JSON.stringify(A.errs.concat(t.errs)).slice(0, 400));
  await t.b.close();
})();
