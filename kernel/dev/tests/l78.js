// 0.51 Terminal display: each group or lone terminal picks its home form (or none) and its view, kiosk or admin;
// the form-level home setting is older, read until Clean-up moves it to the terminals.
const start = require('./dummies/base.js');
(async () => {
  const A = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  await A.w(1200);
  const setup = await A.p.evaluate(async () => {
    const g = (await FP.groups.list())[0];
    const base = { sites: ['all'], launchable: true, sources: [{ name: 'dies', kind: 'items', structure: 'dies', values: { press: 'read' } }],
      fields: [{ name: 'list', control: 'records', label: 'Dies', formula: 'dies', sort: '$id', ascending: true }] };
    await FP.defs.publish('form', 'home-board', Object.assign({ title: 'Die board' }, base));
    await FP.defs.publish('form', 'old-board', Object.assign({ title: 'Old board', home: true }, base));
    await FP.groups.update(g.id, { forms: g.forms.concat('home-board', 'old-board') });
    const bad = [];
    for (const c of [{ view: 'wide' }, { homeForm: 'no such/form' }]) bad.push(await FP.groups.update(g.id, c).then(() => 'took it?!', e => e.message));
    if (FP.outbox) await FP.outbox.flush();
    const ft = await FP.groups.forTerminal('T01');
    return { group: g.name, forms: ft.forms.length, homeForm: ft.homeForm, view: ft.view, bad };
  });
  A.say('setup', JSON.stringify(setup));
  // The editor shows the older setting only on a form that has it.
  A.say('plain', JSON.stringify({ editorOffers: await A.p.evaluate(() => FP.forms.formSettings().find(x => x.name === 'home').older) }));
  await A.snapshot('l78snap.json'); await A.b.close();

  const { b, p, w, errs, say } = await start({ seed: 'l78snap.json', at: '2026-11-18T13:05:00-06:00', noSignIn: true });
  p.on('dialog', d => d.accept().catch(() => {}));
  const signIn = async () => { if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh'); await w(300); await p.keyboard.type('482913'); await w(3000); } };
  await p.goto('file:///home/claude/kernel/launcher.html'); await w(3000); await signIn();
  const home = async () => ({
    boards: await p.$$eval('.fpl-board', l => l.map(x => x.dataset.form).join(',')),
    tiles: (await p.$$eval('.fpl-tile', l => l.map(x => x.dataset.form))).filter(x => /board/.test(x)).join(','),
    side: await p.isVisible('#side'), menu: await p.isVisible('#menu'),
  });
  say('legacy', JSON.stringify(await home()));
  const set = async c => { await p.evaluate(async c => { const g = (await FP.groups.list())[0]; await FP.groups.update(g.id, c); await FP.launcher.home(); }, c); await w(2000); };
  await set({ homeForm: 'home-board' });
  say('kiosk', JSON.stringify(await home()));
  await set({ view: 'admin' });
  say('admin', JSON.stringify(await home()));
  say('list', (await p.$$eval('#side button', l => l.map(x => x.textContent + (x.classList.contains('on') ? '*' : '')))).slice(0, 6).join(' | '));
  await p.click('#side button[data-form="old-board"]'); await w(2000);
  say('opened', `${await p.$eval('#title', x => x.textContent)} · list still there ${await p.isVisible('#side')} · on ${await p.$eval('#side button.on', x => x.textContent)} · home button ${await p.isVisible('#home')}`);
  await p.setViewportSize({ width: 800, height: 900 }); await w(600);
  say('narrow', `list ${await p.isVisible('#side')} · menu ${await p.isVisible('#menu')}`);
  await p.click('#menu'); await w(300);
  say('menu open', `list ${await p.isVisible('#side')}`);
  await p.click('#side button:has-text("Home")'); await w(2000);
  say('menu home', `list ${await p.isVisible('#side')} · boards ${await p.$$eval('.fpl-board', l => l.map(x => x.dataset.form).join(','))}`);
  await p.setViewportSize({ width: 1366, height: 860 }); await w(400);
  await set({ homeForm: 'none', view: 'kiosk' });
  say('none', JSON.stringify(await home()));
  say('errs', JSON.stringify(errs));
  await b.close();

  // Clean-up moves a form set to home onto the groups and terminals that show it, and takes it off the form.
  const C = await start({ seed: 'l78snap.json', at: '2026-11-18T13:10:00-06:00' });
  C.p.on('dialog', d => d.accept().catch(() => {}));
  await C.w(1200);
  await C.p.evaluate(async () => { document.body.innerHTML = '<div id="adm"></div>'; await FP.editor.admin(document.getElementById('adm'), { section: 'cleanup' }); });
  await C.w(1500);
  C.say('cleanup', await C.p.$eval('#adm', x => { const t = x.innerText; return [/Forms set to show on the home screen/i.test(t), (t.match(/becomes the home form of [^\n]*/) || ['?'])[0]].join(' · '); }));
  await C.p.click('.ffm-r:has-text("Old board")'); await C.w(600);
  await C.p.click('button:has-text("Move it to its terminals")'); await C.w(2500);
  C.say('moved', JSON.stringify(await C.p.evaluate(async () => { FP.current.clearCache(); const ft = await FP.groups.forTerminal('T01'); return { homeForm: ft.homeForm, onForm: !!FP.defs.get('form', 'old-board').def.home }; })));
  C.say('errs', JSON.stringify(C.errs));
  await C.b.close();
})();
