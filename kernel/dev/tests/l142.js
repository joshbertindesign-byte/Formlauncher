// F44: repeat misses and the climb. Two misses of the same check (same series) while an alert is open add to that one
// alert (misses 2), they do not open a second. A miss recorded twice from a stale view (a second terminal that had not
// seen the first one's write) counts once. The climb is idempotent (running it again changes nothing). Acknowledge
// stops the climb; Excuse closes the alert; the same check done again closes it.
const start = require('./dummies/base.js');
(async () => {
  const A = await start({ seed: 'pilot2/snapQC.json', at: '2026-11-19T09:40:00-06:00', dropKv: ['openSessions'] });
  const { p, w, say } = A;
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(3000);
  if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh').catch(() => {}); await w(300); await p.keyboard.type('482913'); await w(2000); }
  const r = await p.evaluate(async () => {
    const out = {}; const bad = [];
    const ok = (c, m) => { if (!c) bad.push(m); };
    try {
      const pub = (kind, id, def) => { const cur = FP.defs.get(kind, id); return FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, def), { basedOn: cur ? cur.version : null, note: 'l142' }); };
      await pub('form', 'zz-walk', { title: 'Walk', sources: [], fields: [{ name: 'a', label: 'A', control: 'text' }] });
      const cs = await FP.centers.list();
      const qt = cs.find(c => c.name === 'Quality techs');
      const c = await FP.centers.create({ name: 'Walkers', members: { departments: ['Quality'] }, duties: [{ name: 'walk', forms: ['zz-walk'], every: 60, grace: 15, per: 'terminal' }],
        ladder: [{ after: 30, tell: { centers: [qt.id] }, ack: true }, { after: 120, tell: { role: 'admin' }, ack: true }] });
      const centerId = c.id || (await FP.centers.list()).find(x => x.name === 'Walkers').id;
      const tid = FP.identity.terminalId;
      const hm = t => new Date(t).toTimeString().slice(0, 5);
      const slots = () => FP.due.slots({ terminalId: tid, place: { group: null, forms: ['zz-walk'] } });
      const mine = async () => (await FP.alerts.list(true)).filter(a => a.center === centerId);
      const tick = async () => { FP.current.clearCache(); const l = await slots(); const n = await FP.due.recordMisses(l, { terminalId: tid }); FP.current.clearCache(); const ch = await FP.alerts.climb(l); return { l, n, ch }; };
      const entries = async id => (await FP.current.load(FP.alerts.STRUCTURE, { fresh: true })).items.get(id).entryCount;

      out.start = `${hm(Date.now())} slots ${(await slots()).map(x => hm(x.start) + ' ' + x.state).join(', ')}`;
      // 1. first miss opens an alert
      await FP.testClock.jump(100 * 60000); await tick();             // 11:20, the 10:00 slot is missed (the 09:00 one came before the duty began)
      let al = await mine();
      out.first = `${al.length} alert, misses ${al[0] && al[0].misses}`;
      ok(al.length === 1 && al[0].misses === 1, 'first miss: one alert, misses 1: ' + out.first);
      // 2. a second miss of the same check adds to it
      await FP.testClock.jump(60 * 60000); await tick();               // 12:20, the 11:00 slot too
      al = await mine();
      out.second = `${al.length} alert, misses ${al[0] && al[0].misses} · ${al[0] && FP.alerts.words(al[0])}`;
      ok(al.length === 1 && al[0].misses === 2, 'second miss adds to the open alert: ' + out.second);
      // 3. a miss recorded again from a stale view (another terminal) is not counted twice
      await FP.testClock.jump(60 * 60000); FP.current.clearCache();   // 13:20, the 12:00 slot
      const l = await slots();
      const stale = () => l.map(x => Object.assign({}, x));
      await FP.due.recordMisses(stale(), { terminalId: 'T01' });
      await FP.due.recordMisses(stale(), { terminalId: 'T02' });
      FP.current.clearCache(); al = await mine();
      out.stale = `${al.length} alert, misses ${al[0].misses}`;
      ok(al.length === 1 && al[0].misses === 3, 'a miss seen by two terminals counts once: ' + out.stale);
      // 4. the climb: two terminals running it, and again, change nothing more than one climb
      await FP.alerts.climb(l); FP.current.clearCache();
      const lvl = (await mine())[0].level, told = (await mine())[0].told.length, e1 = await entries(al[0].id);
      await Promise.all([FP.alerts.climb(l), FP.alerts.climb(l)]); FP.current.clearCache();
      al = await mine();
      const e2 = await entries(al[0].id);
      out.climb = `level ${lvl} (${told} told), after two more climbs at once: level ${al[0].level} (${al[0].told.length} told) · entries ${e1} → ${e2}`;
      ok(lvl === 2 && al[0].level === 2 && al[0].told.length === 2, 'climb is idempotent: ' + out.climb);
      // 5. Acknowledge stops the climb
      await FP.alerts.ack(al[0].id, 'line was down');
      await FP.testClock.jump(5 * 3600000); await tick();             // 17:20
      al = await mine();
      out.acked = `${al.length} alert, level ${al[0].level}, acknowledged ${!!al[0].ackAt}, open ${!al[0].closedAt}`;
      ok(al.length === 1 && al[0].level === 2 && al[0].ackAt && !al[0].closedAt, 'acknowledged: stops climbing, stays open: ' + out.acked);
      // 6. the same check done again closes it
      FP.current.clearCache();
      await FP.entry.record({ entry: 'submissions.save', item: { structure: 'submissions', id: 'SUB-l142-a' }, form: { id: 'zz-walk', version: 1 }, values: { form: 'zz-walk' }, autoRefs: {} });
      FP.current.clearCache();
      await FP.alerts.climb(await slots()); FP.current.clearCache();
      al = await mine();
      out.again = `${FP.alerts.words(al[0])}`;
      ok(al[0].closedAt && /done again/.test(al[0].closedHow), 'done again closes it: ' + out.again);
      // 7. a new miss opens a new alert; Excuse closes it
      await FP.testClock.jump(3 * 3600000); await tick();             // 20:20
      al = (await mine()).filter(a => !a.closedAt);
      ok(al.length === 1, 'a new miss after the alert was put right opens a new one: ' + al.length);
      const missed = (await slots()).find(x => x.state === 'missed' && x.recorded);
      await FP.due.excuse(missed, 'line down');
      al = await mine();
      out.excused = `${al.filter(a => !a.closedAt).length} open of ${al.length} · ${al.map(a => FP.alerts.words(a)).join(' | ')}`;
      ok(al.every(a => a.closedAt) && al.length === 2, 'excuse closes it: ' + out.excused);
    } catch (e) { bad.push('ERROR ' + e.message + ' ' + String(e.stack).split('\n').slice(1, 3).join(' ')); }
    out.bad = bad;
    return out;
  });
  Object.entries(r).forEach(([k, v]) => say(k, v));
  say('errs', JSON.stringify(A.errs));
  await A.b.close();
  if (r.bad.length || (A.errs && A.errs.length)) { console.log('FAILED'); process.exit(1); }
})();
