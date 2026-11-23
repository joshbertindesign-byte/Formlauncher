// 0.38: drafts. Half-done work is kept in the data folder, problems and all, and opens as it was left.
const start = require('./dummies/base.js');
(async () => {
  const T = await start({ seed: 'dummies/snap8.json' });
  let { b, p, w, errs, add, say, rows } = T;
  let row = async k => { const on = await p.$eval(`.ffm-r[data-key="${k}"]`, r => r.classList.contains('on')).catch(() => false); if (!on || k[0] === '+') await p.click(`.ffm-r[data-key="${k}"]`); await w(350); };
  const lib = () => p.$$eval('.fpe-item', l => l.filter(x => /draft/.test(x.textContent)).map(x => x.textContent).join(' | ') || '(no drafts)');
  const toasts = () => p.$$eval('.fpe-toast, .fp-toast', l => l.map(x => x.textContent).join(' / ')).catch(() => '');
  // 1. a new structure, half done, with a problem
  await add('A structure', 'half-done');
  await p.click('.ffe-kinds button[data-kind="records"]'); await w(500);
  await row('+v'); await p.fill('.ffm-props input', 'qty'); await p.click('.ffm-props button:has-text("Add a value forms save to")'); await w(400);
  await row('+st'); await p.fill('.ffm-props input >> nth=0', 'Short'); await p.fill('.ffm-props input >> nth=1', 'qty < '); await w(2500);
  say('state', await p.$eval('.fpe-draftstate', x => x.textContent));
  say('publish', await p.$eval('button.primary', x => x.disabled ? 'disabled' : 'enabled'));
  // 2. a published function, its formula broken, then pulled away
  await p.evaluate(() => FP.editor.openDef('function', 'TempCheck')); await w(1500);
  say('left', await toasts());
  await p.click('.ffm-r[data-key="fx"]'); await w(600);
  await p.$eval('.ffm-props .fpe-fx-in', i => { i.value = i.value + ' +'; i.dispatchEvent(new Event('input', { bubbles: true })); }); await w(2500);
  say('fn state', await p.$eval('.fpe-draftstate', x => x.textContent));
  say('library', await lib());
  // 3. closed and opened again (the data folder is what's kept)
  await T.snapshot('l43snap.json'); await b.close();
  const T2 = await start({ seed: 'l43snap.json' });
  ({ b, p, errs, w } = T2); const rows2 = T2.rows;
  say('after reopen', await lib());
  await p.click('.fpe-item:has-text("half-done")'); await w(1500);
  say('bar', await p.$eval('.fpe-draftbar', x => x.innerText.replace(/\n/g, ' ')).catch(() => 'no bar'));
  say('rows', (await rows2()).replace(/\n\s*/g, ' | '));
  await p.evaluate(() => FP.editor.openDef('function', 'TempCheck')); await w(1500);
  say('fn bar', await p.$eval('.fpe-draftbar', x => x.innerText.replace(/\n/g, ' ')).catch(() => 'no bar'));
  await p.click('.ffm-r[data-key="fx"]').catch(() => {}); await w(600);
  say('fn formula', await p.$eval('.ffm-props .fpe-fx-in', i => (/\+\s*$/.test(i.value) ? 'broken formula back' : 'lost: ' + i.value)).catch(() => 'no formula'));
  say('fn probs', await p.$$eval('.err', l => l.map(x => x.textContent).filter(Boolean).slice(0, 2).join(' / ')));
  // 4. throw it away: back to the published version
  await p.click('button:has-text("Throw away the draft")'); await w(1800);
  say('thrown', (await lib()) + ' | ' + await p.$eval('.fpe-draftbar', () => 'bar still').catch(() => 'no bar'));
  // 5. finish the half-done one and publish: the draft goes
  await p.click('.fpe-item:has-text("half-done")'); await w(1500);
  await row('st:0'); await p.fill('.ffm-props input >> nth=1', 'qty < 5'); await w(1200);
  await p.fill('input[placeholder^="What changed"]', 'finished'); await p.click('button.primary'); await w(2000);
  say('published', await p.$eval('.fpe-head', x => x.innerText.replace(/\n/g, ' ')));
  say('drafts left', await lib());
  say('files', JSON.stringify(await p.evaluate(async () => (await FP.defs.drafts.list()).map(d => d.kind + ':' + d.id))));
  await p.screenshot({ path: 'l43.png' });
  say('errors', errs);
  await b.close();
})();
