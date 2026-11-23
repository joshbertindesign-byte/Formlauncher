// Install the pilot pack on a fresh data folder through FP.packs.install; snapshot it.
const start = require('./base.js');
const fs = require('fs');
(async () => {
  const t = await start({ at: '2026-11-18T12:00:00-06:00' });
  const pack = fs.readFileSync(t.SP + 'pilot/production-pilot.json', 'utf8');
  const r = await t.p.evaluate(async text => {
    const p = FP.packs.read(text);
    const plan = await FP.packs.plan(p);
    try { const res = await FP.packs.install(p); return { ok: res, plan: plan.defs.map(d => d.how).join(',') }; }
    catch (e) { return { err: e.message }; }
  }, pack);
  console.log(JSON.stringify(r, null, 1).slice(0, 6000));
  const rep = await t.p.evaluate(() => { const r = FP.defs.report(); return r ? JSON.stringify(r).slice(0, 3000) : null; });
  console.log('report', rep);
  if (r.ok) await t.snapshot(t.SP + 'dummies/snapPilot.json');
  console.log('errors', t.errs); await t.b.close();
})();
