// Pilot, step 1: on a fresh data folder marked as a test folder, install the pack: definitions, profiles and lines,
// the Abilene site, the line terminals' and the QC office's groups with their settings, and the people (0.52).
const start = require('../dummies/base.js');
const fs = require('fs');
(async () => {
  const t = await start({ at: '2026-11-18T12:00:00-06:00' });
  const pack = fs.readFileSync(__dirname + '/production-pilot.json', 'utf8');
  const r = await t.p.evaluate(async text => {
    await FP.folder.handle.getFileHandle('THIS IS A TEST FOLDER.txt', { create: true });   // as a person would, in File Explorer
    const p = FP.packs.read(text);
    const plan = await FP.packs.plan(p);
    const setup = ['sites', 'groups', 'terminals', 'people', 'centers'].map(k => `${k}: ${plan.setup[k].map(x => x.how).join(',') || '-'}`).join(' · ');
    try { const res = await FP.packs.install(p); return { ok: res, plan: { defs: plan.defs.length, setup, test: plan.setup.test } }; }
    catch (e) { return { err: e.message }; }
  }, pack);
  console.log('install', JSON.stringify(r));
  const s = await t.p.evaluate(async () => ({
    people: (await FP.users.list()).map(u => `${u.name} (${u.roles.join(',')})`).join(', '),
    centers: (await FP.centers.list()).map(c => `${c.name}: ${c.duties.map(d => FP.due.describe(d)).join(' ') || 'no duties'} [${c.members.signedInAt.map(x => x.kind + ' ' + x.id).join(', ')}]`).join(' | '),
    groups: (await FP.groups.list()).map(g => `${g.name}: ${g.terminals.join(',') || 'no terminal'} · ${g.forms.length} forms · home ${g.homeForm} · ${g.view} · sign-in ${g.signIn} · ${g.signedInFor} min`),
    sites: (await FP.sites.list()).map(x => `${x.id} ${x.name}`).join(', '),
  }));
  console.log('setup', JSON.stringify(s, null, 1));
  // Installing it again changes nothing.
  const again = await t.p.evaluate(async text => { const plan = await FP.packs.plan(FP.packs.read(text)); return ['sites', 'groups', 'terminals', 'people', 'centers'].map(k => `${k}: ${plan.setup[k].map(x => x.how).join(',')}`).join(' · ') + ` · defs ${plan.defs.map(d => d.how).filter(h => h !== 'same').length} to change`; }, pack);
  console.log('again', again);
  if (r.ok) await t.snapshot(__dirname + '/snapQ.json');
  console.log('errors', JSON.stringify(t.errs)); await t.b.close();
})();
