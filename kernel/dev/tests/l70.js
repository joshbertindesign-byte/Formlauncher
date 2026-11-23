// 0.44: a save button's then: next (clears), close (home screen), stay (saved record stays; a change starts a new one).
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  // The editor: a save button's After saving.
  await p.evaluate(async () => {
    const d = JSON.parse(JSON.stringify(FP.defs.get('form', 'die-register').def));
    d.buttons = [{ name: 'saveNext', label: 'Save, next', action: 'save' }];
    await FP.defs.publish('form', 'die-register', d, { note: 'buttons', basedOn: FP.defs.get('form', 'die-register').version });
    await FP.defs.load();
  });
  await p.evaluate(() => FP.editor.openDef('form', 'die-register')); await w(2500);
  await p.click('.ffe3-tab[data-tab="form"]').catch(() => {}); await w(500);
  const bkey = await p.$$eval('.ffm-r', rs => (rs.find(r => /^b:/.test(r.dataset.key || '')) || {}).dataset.key);
  await p.click(`.ffm-r[data-key="${bkey}"] .body`).catch(() => p.click(`.ffm-r[data-key="${bkey}"]`)); await w(800);
  const sel = await p.$('.ffm-props label.ffe-set:has-text("After saving") select');
  say('editor', bkey + ' · ' + (sel ? await sel.$$eval('option', os => os.map(o => o.textContent.split(' (')[0]).join(' | ')) : 'no After saving'));
  if (sel) { await sel.selectOption('close'); await w(500); say('hint', await p.$eval('.ffm-props label.ffe-set:has-text("After saving") .fpe-hint', x => x.textContent)); }
  await p.goto('file:///home/claude/kernel/launcher.html'); await w(3000);
  if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh'); await w(300); await p.keyboard.type('482913'); await w(2000); }
  // Three save buttons on the die form.
  const r = await p.evaluate(async () => {
    const d = JSON.parse(JSON.stringify(FP.defs.get('form', 'die-register').def));
    d.buttons = [
      { name: 'saveNext', label: 'Save, next', action: 'save' },
      { name: 'saveClose', label: 'Save and close', action: 'save', then: 'close' },
      { name: 'saveStay', label: 'Save and stay', action: 'save', then: 'stay' },
    ];
    const bad = FP.forms.check(Object.assign({}, d, { buttons: [{ name: 'x', label: 'X', action: 'save', then: 'home' }] }));
    await FP.defs.publish('form', 'die-register', d, { note: 'then', basedOn: FP.defs.get('form', 'die-register').version });
    await FP.defs.load();
    return { bad: bad.filter(x => /then/.test(x)) };
  });
  say('defs', JSON.stringify(r));
  const fill = async (no, press) => {
    await p.fill('[data-name="dieNo"] input', no); await p.fill('[data-name="description"] input', 'test ' + no);
    await p.click(`[data-name="press"] button:has-text("${press}")`);
    await p.fill('[data-name="lowTemp"] input', '870'); await p.fill('[data-name="highTemp"] input', '920'); await w(400);
  };
  const dies = () => p.evaluate(async () => { FP.current.clearCache(); return Array.from((await FP.current.load('dies', { fresh: true })).items.keys()).filter(k => /^D-3/.test(k)).sort(); });
  const onScreen = () => p.evaluate(() => ({ form: !!document.querySelector('#form .fpf'), home: !!document.querySelector('.fpl-tile'), dieNo: (document.querySelector('[data-name="dieNo"] input') || {}).value }));
  // next
  await p.click('.fpl-tile[data-form="die-register"]'); await w(1500);
  await fill('D-3001', 'Press 1');
  await p.click('#form button:has-text("Save, next")'); await w(2000);
  say('next', JSON.stringify(Object.assign(await onScreen(), { dies: await dies() })));
  // close
  await fill('D-3002', 'Press 2');
  await p.click('#form button:has-text("Save and close")'); await w(2500);
  say('close', JSON.stringify(Object.assign(await onScreen(), { dies: await dies() })));
  // stay
  await p.click('.fpl-tile[data-form="die-register"]'); await w(1500);
  await fill('D-3003', 'Press 1');
  await p.click('#form button:has-text("Save and stay")'); await w(2000);
  say('stay', JSON.stringify(Object.assign(await onScreen(), { dies: await dies(), why: await p.$eval('.fpf-why', x => x.textContent), disabled: await p.$eval('#form button:has-text("Save and stay")', x => x.disabled) })));
  await p.screenshot({ path: 'l70-stay.png' });
  // a change starts a new record
  await p.fill('[data-name="dieNo"] input', 'D-3004'); await w(600);
  say('changed', JSON.stringify({ why: await p.$eval('.fpf-why', x => x.textContent), disabled: await p.$eval('#form button:has-text("Save and stay")', x => x.disabled) }));
  await p.click('#form button:has-text("Save and stay")'); await w(2000);
  say('stay2', JSON.stringify(await dies()));
  // home without a "leave?" question (nothing unsaved)
  await p.click('#home'); await w(1500);
  say('home', JSON.stringify(await onScreen()));
  say('errs', JSON.stringify(errs));
  await b.close();
})();
