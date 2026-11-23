// 0.63 The Test pack (dev/packs/test-pack): made-up data with the functionality of the production pilot packs.
// Installs on a fresh folder (everything but the people, then the people once it is a test folder), installing again
// changes nothing, the library instructions arrive with their files, and nothing plant-specific is in the pack.
const start = require('./dummies/base.js');
const fs = require('fs'), path = require('path');
const PACK = path.join(__dirname, '../packs/test-pack/test-pack.json');
(async () => {
  const text = fs.readFileSync(PACK, 'utf8');
  const A = await start({ at: '2026-11-19T08:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };

  const r1 = await A.p.evaluate(async text => {
    const p = FP.packs.read(text);
    const plan = await FP.packs.plan(p);
    const r = await FP.packs.install(p);
    FP.current.clearCache();
    const profiles = await FP.current.load('profiles', { fresh: true }), lines = await FP.current.load('lines', { fresh: true });
    await FP.media.library.load({ fresh: true });
    const entries = FP.media.library.cached();
    const files = [];
    for (const e of entries) files.push(!!(await FP.media.stat(e.path)));
    const groups = await FP.groups.list();
    const t1 = await FP.groups.forTerminal('T01'), t2 = await FP.groups.forTerminal('T02');
    const forms = FP.defs.list('form').map(d => d.id), structures = FP.defs.list('structure').filter(d => !d.builtin).map(d => d.id);
    const fns = FP.defs.list('function').length;
    const problems = FP.defs.list('form').flatMap(d => FP.forms.check(d.def).map(m => `${d.id}: ${m}`));
    const pick = await FP.media.pick((FP.defs.get('form', 'line-instructions') || {}).def, { line: 'Line 1' }).then(l => l.map(m => m.title), e => ['ERR ' + e.message]);
    const setupHow = ['sites', 'groups', 'people', 'centers'].map(k => `${k}: ${(plan.setup[k] || []).map(x => x.how).join(',')}`);
    return { r, profiles: profiles.items.size, linesOn: Array.from(lines.items.values()).filter(i => i.values.active).length, lines: lines.items.size,
      entries: entries.map(e => `${e.id} ${e.name}`), files, groups: groups.map(g => `${g.name}@${g.site}`), t1: { forms: t1.forms.length, home: t1.homeForm, view: t1.view }, t2: { forms: t2.forms.length, home: t2.homeForm, view: t2.view },
      forms: forms.length, structures: structures.sort(), fns, problems, pick, setupHow, users: (await FP.users.list()).map(u => u.name) };
  }, text);
  A.say('installed', JSON.stringify(r1.r));
  A.say('counts', JSON.stringify({ forms: r1.forms, structures: r1.structures, fns: r1.fns, profiles: r1.profiles, lines: r1.lines, linesOn: r1.linesOn, groups: r1.groups }));
  A.say('terminals', JSON.stringify({ T01: r1.t1, T02: r1.t2 }));
  A.say('library', JSON.stringify({ entries: r1.entries, files: r1.files, pick: r1.pick }));
  expect('definitions published', r1.r.defs === 51, r1.r);
  expect('structures', ['lines', 'needs', 'partials', 'profiles', 'racks', 'runs', 'shifts'].every(s => r1.structures.includes(s)), r1.structures);
  expect('forms', r1.forms >= 14, r1.forms);
  expect('functions', r1.fns >= 30, r1.fns);
  expect('every form passes its checks', r1.problems.length === 0, r1.problems.slice(0, 4));
  expect('profiles', r1.profiles === 30, r1.profiles);
  expect('lines', r1.lines === 9 && r1.linesOn === 3, { lines: r1.lines, on: r1.linesOn });
  expect('library entries with files', r1.entries.length === 2 && r1.files.every(Boolean), r1);
  expect('instructions form shows both', r1.pick.length === 2, r1.pick);
  expect('line terminal: kiosk with the line board', r1.t1.home === 'line-board' && r1.t1.view === 'kiosk' && r1.t1.forms === 7, r1.t1);
  expect('office terminal: admin view with the needs board', r1.t2.home === 'needs-board' && r1.t2.view === 'admin' && r1.t2.forms === 8, r1.t2);
  expect('not a test folder: the people are left out', !r1.users.includes('Sam Supervisor'), r1.users);

  // Every form in the pack opens and draws something.
  const opened = await A.p.evaluate(async () => {
    const out = [];
    for (const d of FP.defs.list('form')) {
      document.body.innerHTML = '<div id="h" style="padding:20px;max-width:1000px"></div>';
      try {
        const inst = await FP.forms.open(document.getElementById('h'), d.id, { draft: false });
        await new Promise(r => setTimeout(r, 300));
        out.push({ id: d.id, ok: true, len: document.getElementById('h').innerText.trim().length });
        if (inst && inst.destroy) inst.destroy();
      } catch (e) { out.push({ id: d.id, ok: false, err: String(e && e.message || e).slice(0, 120) }); }
    }
    return out;
  });
  A.say('forms open', opened.map(o => `${o.id}${o.ok ? '' : ' ERR ' + o.err}`).join(', '));
  expect('every form opens and draws', opened.length >= 14 && opened.every(o => o.ok && o.len > 0), opened.filter(o => !o.ok || !o.len));

  // Installing again changes nothing.
  const r2 = await A.p.evaluate(async text => {
    const p = FP.packs.read(text);
    const plan = await FP.packs.plan(p);
    return { defs: plan.defs.map(x => x.how).filter((h, i, a) => a.indexOf(h) === i), items: plan.items.map(x => x.how || '').filter((h, i, a) => a.indexOf(h) === i), setup: ['sites', 'groups'].map(k => plan.setup[k].map(x => x.how).join(',')) };
  }, text);
  A.say('again', JSON.stringify(r2));
  expect('second install: all definitions already there', r2.defs.length === 1 && r2.defs[0] === 'same', r2.defs);

  // As a test folder the people go in, with the pack's PINs.
  const r3 = await A.p.evaluate(async text => {
    await FP.folder.handle.getFileHandle('THIS IS A TEST FOLDER.txt', { create: true });
    const r = await FP.packs.install(FP.packs.read(text));
    FP.current.clearCache();
    return { r: r.setup, users: (await FP.users.list()).map(u => `${u.name}:${(u.roles || []).join('/')}`) };
  }, text);
  A.say('test folder', JSON.stringify(r3));
  expect('six test people', ['Sam Supervisor', 'Quinn Quality', 'Olive Operator', 'Omar Operator', 'Pat Packer', 'Mo Manager'].every(n => r3.users.some(u => u.startsWith(n))), r3.users);

  // Nothing from the plant.
  const FORBID = /(^|[^A-Za-z])(ABI|ABILENE|CLAYTON|MI WINDOWS)([^A-Za-z]|$)/i;
  expect('no plant-specific words in the pack file', !FORBID.test(text), (text.match(FORBID) || [])[0]);

  A.say('errs', JSON.stringify(bad.concat(A.errs)));
  await A.b.close();
  if (bad.length || A.errs.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
