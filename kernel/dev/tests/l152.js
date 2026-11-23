// 0.63.1 The Test pack on the terminals (found on a live folder): after installing it, T01 (line terminals) and T02 (QC office) must offer the forms their
// groups list, to an admin and to a supervisor, whichever site the terminal is on. (Reported: only "Line instructions" was offered,
// because the launcher looked for a group at the terminal's own site, and the pack's groups are on its own site.)
const start = require('./dummies/base.js');
const fs = require('fs'), path = require('path');
const PACK = fs.readFileSync(path.join(__dirname, '../packs/test-pack/test-pack.json'), 'utf8');
(async () => {
  const A = await start({ at: '2026-11-19T08:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  await A.p.evaluate(async text => {
    // A real folder has its own site, made when its first terminal was set up; the pack brings the site TST.
    await FP.sites.create('HOU', 'Houston');
    await FP.folder.handle.getFileHandle('THIS IS A TEST FOLDER.txt', { create: true });
    await FP.packs.install(FP.packs.read(text));
    if (FP.outbox) await FP.outbox.flush();
  }, PACK);
  await A.snapshot('out/l152snap.json'); await A.b.close();
  const bad = [];
  const want = { T01: ['changeover', 'end-shift', 'hourly', 'line-board', 'line-instructions', 'rack', 'start-shift'], T02: ['change-need', 'line-instructions', 'lines', 'needs', 'needs-board', 'production-report', 'profiles', 'trace-rack'] };
  // The terminals on the pack's own site (TST) and on a site made before the pack (HOU), as an admin and as a supervisor.
  for (const [term, who, pin, site] of [['T01', 'Josh', '482913', 'TST'], ['T01', 'Josh', '482913', 'HOU'], ['T01', 'Sam Supervisor', '135790', 'HOU'], ['T02', 'Josh', '482913', 'HOU']]) {
    const { b, p, w, errs, say } = await start({ seed: 'out/l152snap.json', at: '2026-11-19T08:30:00-06:00', noSignIn: true, dropKv: ['openSessions'] });
    p.on('dialog', d => d.accept().catch(() => {}));
    await p.goto('file:///home/claude/kernel/launcher.html'); await w(3000);
    // A launcher's first start on a computer: its terminal ID and its site.
    if (await p.$('text=Save terminal ID')) { await p.fill('.fp-gate-card input', term); await p.click('text=Save terminal ID'); await require('./site-step.js')(p, site, 'Site'); await w(2500); }
    await w(1500);
    if (await p.$('.fp-u-card')) { await p.click(`.fp-u-card >> text=${who}`).catch(() => {}); await w(300); await p.keyboard.type(pin); await w(3000); }
    await w(6000);   // the admin view's list and the home form fill in after the page opens
    const seen = await p.evaluate(async () => {
      const tiles = Array.from(document.querySelectorAll('.fpl-tile')).map(x => x.dataset.form);
      const side = Array.from(document.querySelectorAll('#side button')).map(x => x.dataset.form).filter(Boolean);
      const title = (document.querySelector('#title') || {}).textContent || '';
      const place = await FP.groups.forTerminal(FP.identity.terminalId);
      return { tiles, side, title, terminal: FP.identity.terminalId, group: place.group && place.group.name, assigned: place.forms, home: place.homeForm, view: place.view };
    });
    say(`${term} as ${who}`, JSON.stringify(seen));
    const offered = Array.from(new Set(seen.tiles.concat(seen.side).concat(seen.home ? [seen.home] : []))).sort();
    const missing = want[term].filter(f => !offered.includes(f));
    if (missing.length) bad.push(`${term} as ${who}: not offered: ${missing.join(', ')}`);
    await b.close(); errs.forEach(e => bad.push(e));
  }
  console.log('errs      :', JSON.stringify(bad));
  if (bad.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
