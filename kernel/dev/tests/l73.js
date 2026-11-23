// 0.48 Clean-up: older forms brought up to date and no longer published the old ways; shortcuts in place of launcher
// files; one width per field; no saved fields or groups; the editor's Drag gone; the test page diagnostics only.
const start = require('./dummies/base.js');
const { ROOT } = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say, snapshot } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1200);
  // L1: a form written before sources, naming its saves on the form.
  const old = { title: 'Old die form', sites: ['all'], action: 'register', items: { dies: { field: 'dieNo' } },
    fields: [{ name: 'dieNo', control: 'text', label: 'Die no.', required: true }, { name: 'press', control: 'choice', options: ['Press 1', 'Press 2'], writes: 'dies.press' }] };
  const l1 = await p.evaluate(async old => {
    const refused = await FP.defs.publish('form', 'old-die', old).then(() => 'published?!', e => e.message.slice(0, 160));
    const u = FP.sources.upgrade(old);
    const ok = await FP.defs.publish('form', 'old-die', u.def).then(d => 'v' + d.version, e => 'refused: ' + e.message.slice(0, 200));
    const opener = { title: 'Opener', sites: ['all'], sources: [], fields: [{ name: 'x', control: 'text' }], buttons: [{ name: 'o', label: 'Open', action: 'open', form: 'die-register' }] };
    const opens = await FP.defs.publish('form', 'opener', opener).then(() => 'published?!', e => e.message.slice(0, 160));
    return { refused, changes: u.changes, sources: u.def.sources.map(s => `${s.name}:${s.structure}:${JSON.stringify(s.id)}`), saveAs: (u.def.buttons || []).map(b => b.saveAs), action: u.def.action || null, ok, opens };
  }, old);
  say('older', JSON.stringify(l1));
  // L5: saved fields and groups are not kinds any more.
  say('kinds', JSON.stringify(await p.evaluate(async () => [FP.defs.KINDS, await FP.defs.publish('field', 'f1', { title: 'x' }).then(() => 'published?!', e => e.message.slice(0, 80))])));
  // L3: one width per field; tablet: and phone: are no longer used (and no longer problems).
  say('widths', JSON.stringify(await p.evaluate(() => FP.forms.check({ title: 'W', sites: ['all'], fields: [{ name: 'a', control: 'text' }, { name: 'b', control: 'text' }], layout: [['a 6 tablet:12 phone:6', 'b pc:4']] }))));
  // M1: shortcuts.
  const m1 = await p.evaluate(async () => {
    const n = await FP.launchers.make('die-setup');
    const n2 = await FP.launchers.make('die-setup', { version: 1 });
    // An older launcher file, as 0.47 made them.
    await FP.files.writeText(['launchers'], 'die-register.html', '<!doctype html><script>window.FP_LAUNCH = {"form":"die-register","version":"latest","made":"2026-11-01T00:00:00.000Z","by":"Josh","runtime":"0.47.0","boot":1}; window.FP_PAGE = \'launcher\';</script>');
    const before = (await FP.launchers.list()).map(x => `${x.name}${x.file ? ' (file)' : ''}`);
    const conv = await FP.launchers.convertOld();
    const after = (await FP.launchers.list()).map(x => `${x.name}:${x.form}:${x.version}${x.file ? ' (file)' : ''}`);
    const stub = await FP.files.readText(['launchers'], 'die-register.html');
    return { made: [n, n2], before, conv, after, stub: /http-equiv="refresh" content="0; url=..\/launch.html\?launcher=die-register"/.test(stub), address: FP.launchers.addressOf(n) };
  });
  say('shortcuts', JSON.stringify(m1));
  // D4: the form editor offers Order and Try it.
  await p.click('.fpe-mrow:has-text("Add or change a die")'); await w(1500);
  say('modes', await p.$$eval('.ffa-mode button', l => l.map(x => x.textContent).join(',')));
  // A shortcut opens its one form, with no home button; an unknown one says so (a new page, from what is saved now).
  await snapshot('l73snap.json');
  const T = await start({ seed: 'l73snap.json', at: '2026-11-18T13:00:00-06:00', noSignIn: true });
  await T.p.goto('file:///home/claude/kernel/launcher.html?launcher=die-setup'); await T.w(3500);
  if (await T.p.$('.fp-u-card')) { await T.p.click('.fp-u-card >> text=Josh'); await T.w(300); await T.p.keyboard.type('482913'); await T.w(2500); }
  say('shortcut', `${await T.p.$eval('#title', x => x.textContent)} · home ${await T.p.isVisible('#home')} · fields ${await T.p.$$eval('.fpf-cell[data-name]', l => l.length)}`);
  await T.p.goto('file:///home/claude/kernel/launcher.html?launcher=nope'); await T.w(3000);
  say('unknown', (await T.p.$eval('.fpl-err', x => x.textContent).catch(() => 'no message')).slice(0, 80));
  await T.b.close();
  // D7: the test page is diagnostics only and loads without a problem banner.
  await p.goto('file://' + ROOT + '/kernel-test.html'); await w(2500);
  say('test page', `${await p.$$eval('section h2', l => l.map(x => x.textContent).join(' | '))} · banner ${!!(await p.$('#fp-problems'))}`);
  say('errs', JSON.stringify(errs));
  await b.close();
})();
