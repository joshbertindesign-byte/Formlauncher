// 0.40: sub-forms in the form editor.
const start = require('./dummies/base.js');
(async () => {
  const T = await start({ seed: 'dummies/snap14.json' });
  const { b, p, w, errs, say, rows, props } = T;
  p.on('dialog', d => d.accept().catch(() => {}));
  const row = async k => { await p.click(`.ffm-r[data-key="${k}"]`); await w(500); };
  const lab = (label) => p.locator('.ffm-props .ffe-set, .ffm-props label', { hasText: new RegExp('^\\s*' + label) }).first();
  await p.click('.fpe-item:has-text("Die setup check")'); await w(1800);
  await row('+sf'); await w(600);
  say('rows', '\n  ' + (await rows()).split('\n').filter(l => /sf:|b:/.test(l)).join('\n'));
  say('props', (await props()).slice(0, 600));
  await lab('Label').locator('input').fill('Wall sample'); await w(400);
  await lab('How many times').locator('select').selectOption('n'); await w(600);
  await p.locator('.ffm-props input[type=number]').fill('3'); await w(400);
  await p.screenshot({ path: 'l56-props.png' });
  // into the sub-form
  await p.click('.ffm-props button:has-text("Edit its fields and sources")'); await w(1500);
  say('sub rows', '\n  ' + await rows());
  await row('+f'); await p.click('.ffm-props button:text-matches("^Number")'); await w(600);
  const k = await p.$$eval('.ffm-r.on', l => l.map(r => r.dataset.key)[0]);
  await p.locator('.ffm-props label', { hasText: /^\s*Label/ }).first().locator('input').fill('Wall (in)'); await p.keyboard.press('Tab'); await w(600);
  say('sub rows 2', '\n  ' + await rows());
  await p.screenshot({ path: 'l56-sub.png' });
  await p.click('.ffm-r[data-key="form"] button:has-text("Back to")'); await w(1500);
  // a field on the master to receive, and send back
  await row('+f'); await p.click('.ffm-props button:text-matches("^Number")'); await w(600);
  await p.locator('.ffm-props label', { hasText: /^\s*Label/ }).first().locator('input').fill('Average wall'); await p.keyboard.press('Tab'); await w(600);
  await row('sf:wallSample'); await w(400);
  await p.click('.ffm-props button:has-text("+ Send a value back")'); await w(600);
  say('back props', (await props()).replace(/.*Sends back/, 'Sends back').slice(0, 300));
  const r = p.locator('.ffm-props .ffe-maprow').last();
  await r.locator('select >> nth=0').selectOption('averageWall'); await w(400);
  await p.locator('.ffm-props .ffe-maprow').last().locator('select >> nth=2').selectOption('avg'); await w(600);
  say('back props 2', (await props()).replace(/.*Sends back/, 'Sends back').slice(0, 300));
  say('marks', '\n  ' + (await rows()).split('\n').filter(l => /sf:|form|b:/.test(l)).join('\n'));
  await p.screenshot({ path: 'l56-master.png' });
  await p.fill('input[placeholder^="What changed"]', 'Wall samples');
  await p.click('.fpe-foot button:has-text("Publish"), button.primary:has-text("Publish")'); await w(2500);
  const pub = await p.evaluate(() => { const d = FP.defs.get('form', 'die-setup'); return { v: d.version, subs: JSON.stringify(d.def.subforms), btns: JSON.stringify(d.def.buttons) }; });
  say('published', JSON.stringify(pub));
  // run it
  await p.evaluate(async () => { document.body.innerHTML = '<div id="h"></div>'; window.__i = await FP.forms.open(document.getElementById('h'), 'die-setup'); });
  await w(800);
  say('run buttons', JSON.stringify(await p.evaluate(() => __i.buttons().map(x => x.label + (x.enabled ? '' : ' (off)')))));
  await p.locator('#h').getByRole('button', { name: /^Wall sample/ }).click(); await w(1000);
  for (const v of ['0.1', '0.2', '0.3']) { await p.fill('.fpf-sheet [data-name="wallIn"] input', v); await p.keyboard.press('Tab'); await w(300); await p.locator('.fpf-sheet').getByRole('button', { name: 'Done', exact: true }).click(); await w(900); }
  say('avg', await p.evaluate(() => __i.values().averageWall));
  say('errors', errs);
  await b.close();
})();
