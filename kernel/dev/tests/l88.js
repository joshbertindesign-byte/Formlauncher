// 0.58 The form is the editor: three columns (the outline in Fields, Data and Form tabs; the form drawn as it shows,
// filled from a saved item; the settings of what is picked). Pick a field on the form, size it with its handle, drag it
// next to another or onto a row of its own, the outline and settings following; a section's settings; Try it; the
// site map folds while a form is open and comes back with ☰ Map.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'pilot2/snapQC.json', at: '2026-11-19T13:00:00-06:00', foldForms: true });
  await w(3000);
  if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh').catch(() => {}); await w(300); await p.keyboard.type('482913'); await w(2000); }
  await p.setViewportSize({ width: 1366, height: 768 });
  const vis = sel => p.$eval(sel, x => !!(x.offsetWidth || x.offsetHeight)).catch(() => false);
  say('map before', (await vis('.fpe-lib')) ? 'shown' : 'folded');
  await p.evaluate(() => FP.editor.openDef('form', 'hourly')); await w(4500);
  say('map with a form', (await vis('.fpe-lib')) ? 'FAIL still shown' : 'folded');
  say('columns', await p.evaluate(() => ['.ffe3-left', '.ffe3-mid', '.ffe3-insp'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return `${s.slice(6)} ${Math.round(r.width)}`; }).join(' · ')));
  say('tabs', await p.$$eval('.ffe3-tab', l => l.map(x => x.textContent).join(' | ')));
  say('show with', await p.$eval('.ffe3-with select', s => `${s.options.length - 1} items, showing ${s.selectedOptions[0].textContent}`).catch(() => 'none'));
  say('settings, nothing picked', await p.$eval('.ffe3-insp', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 120)));
  // Pick a field on the form: the settings and the outline follow.
  const cellOf = n => `.ffe-frame .fpf-cell[data-name="${n}"]`;
  await p.click(cellOf('lengthAct')); await w(1200);
  say('picked', await p.evaluate(() => `${document.querySelector('.ffe3-seltag').textContent} · outline ${(document.querySelector('.ffe3-left .ffm-r.on .t') || {}).textContent} · settings ${document.querySelector('.ffe3-ih b').textContent}`));
  const layoutOf = () => p.evaluate(async () => { const d = await FP.defs.drafts.get('form', 'hourly'); return d ? JSON.stringify(d.def.layout).replace(/"/g, '') : 'no draft'; });
  // Size it with its handle: drag to about a third of its row.
  const h = await p.$('.ffe3-handle'); const hb = await h.boundingBox();
  const row = await p.evaluate(n => { const c = document.querySelector(`.ffe-frame .fpf-cell[data-name="${n}"]`); const r = c.parentElement.getBoundingClientRect(); const cr = c.getBoundingClientRect(); return { left: cr.left, w: r.width }; }, 'lengthAct');
  await p.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await p.mouse.down();
  await p.mouse.move(row.left + row.w * 0.5, hb.y + 5, { steps: 6 }); await p.mouse.up(); await w(2500);
  say('sized', await p.evaluate(() => document.querySelector('.ffe3-seltag').textContent) + ' · ' + await p.$eval('.ffe3-place .ffo-seg button.on', x => x.textContent));
  // Drag Weight to just before Line speed.
  const from = await (await p.$(cellOf('weight'))).boundingBox(), to = await (await p.$(cellOf('speed'))).boundingBox();
  await p.mouse.move(from.x + 20, from.y + from.height / 2); await p.mouse.down();
  await p.mouse.move(to.x + 10, to.y + to.height / 2, { steps: 8 }); await w(300);
  say('drop line', await p.$eval('.ffe3-drop', x => (x.hidden ? 'hidden' : x.className)));
  await p.mouse.up(); await w(2500);
  say('order now', await p.evaluate(() => { const names = Array.from(document.querySelectorAll('.ffe-frame .fpf-cell[data-name]')).map(c => c.dataset.name); const i = names.indexOf('weight'), j = names.indexOf('speed'); return `weight ${i < j ? 'before' : 'after'} speed`; }));
  // Drag Note onto a row of its own above All pass.
  const n1 = await (await p.$(cellOf('checkNote'))).boundingBox(), ap = await (await p.$('.ffe-frame .fpf-cell[data-name="allPass"]')).boundingBox();
  await p.mouse.move(n1.x + 20, n1.y + n1.height / 2); await p.mouse.down();
  await p.mouse.move(ap.x + 30, ap.y + 2, { steps: 8 }); await w(300);
  say('drop line 2', await p.$eval('.ffe3-drop', x => (x.hidden ? 'hidden' : x.className)));
  await p.mouse.up(); await w(2500);
  say('layout', (await layoutOf()).slice(0, 400));
  // A section's (here, panels') settings from the outline.
  await p.click('.ffm-blk'); await w(900);
  say('block settings', await p.$eval('.ffe3-insp', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 120)));
  // Data and Form tabs.
  await p.click('.ffe3-tab[data-tab="data"]'); await w(800);
  say('data tab', await p.$$eval('.ffe3-left .ffm-r', l => l.slice(0, 4).map(r => r.dataset.key).join(', ')));
  await p.click('.ffm-r[data-key="s:runRec"]').catch(e => say('src', e.message.slice(0, 60))); await w(900);
  say('source settings', await p.$eval('.ffe3-insp', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 100)));
  await p.click('.ffe3-tab[data-tab="form"]'); await w(800);
  say('form tab', await p.$$eval('.ffe3-left .ffm-r', l => l.slice(0, 3).map(r => r.dataset.key).join(', ')));
  // Try it: the form works; tapping a field doesn't pick it.
  await p.click('.ffa-mode button:has-text("Try it")'); await w(2500);
  await p.click(cellOf('speed') + ' input').catch(() => {}); await p.keyboard.type('42'); await w(600);
  say('try it', await p.evaluate(n => `typed ${document.querySelector(`.ffe-frame .fpf-cell[data-name="${n}"] input`).value} · outline ${document.querySelector('.ffe3-sel').hidden ? 'hidden' : 'shown'}`, 'speed'));
  // ☰ Map brings the map back, and it stays for the next form.
  await p.click('.fpe-libtab'); await w(800);
  say('map after ☰', (await vis('.fpe-lib')) ? 'shown' : 'FAIL folded');
  await p.screenshot({ path: 'l88.png' });
  say('errs', JSON.stringify(errs).slice(0, 400));
  await b.close();
})();
