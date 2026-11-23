// 0.53.3 The editor's pane never goes blank: a form then a terminal clicked quickly on a slow folder; a pane that fails
// says so with Try again; one that waits on the folder says so after 8 s; a form opened then left at once.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'pilot2/snapQC.json', at: '2026-11-19T13:00:00-06:00' });
  await w(3000);
  if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh').catch(() => {}); await w(300); await p.keyboard.type('482913'); await w(2000); }
  const pane = () => p.evaluate(() => { const r = document.querySelector('.fpe-panel'); return r ? r.innerText.replace(/\n+/g, ' / ').slice(0, 60) : 'no pane'; });
  const click = async (t, chip) => { await p.locator(chip ? `.fpe-tchip:has-text("${t}")` : `.fpe-mrow:has(span:text-is("${t}"))`).first().click({ timeout: 5000 }).catch(e => say('no row', t + ' ' + e.message.split('\n')[0])); };
  await p.evaluate(() => { window.__latency = 150; });
  // 1. A form, then the terminal before the form has finished opening; and the other way round.
  for (const gap of [0, 120, 400]) {
    await click('Start shift'); await w(gap); await click('T01', true); await w(100);
    const soon = await pane(); await w(4000);
    say(`form, T01 +${gap}`, `${soon.startsWith('Opening') || soon.includes('T01') ? 'opening at once' : 'FAIL not opening: ' + soon} → ${(await pane()).includes('terminal / T01') ? 'T01' : 'FAIL: ' + await pane()}`);
    await click('T01', true); await w(gap); await click('Hourly check'); await w(4000);
    say(`T01, form +${gap}`, (await pane()).startsWith('Hourly check') ? 'the form' : 'FAIL: ' + await pane());
  }
  await p.evaluate(() => { window.__latency = 0; });
  // 2. A pane that fails: the message and Try again.
  await p.evaluate(() => { window.__fsTerm = FP.folder.isTest; FP.folder.isTest = async () => { throw new Error('the folder went away'); }; });
  await click('Start shift'); await w(1200); await click('T01', true); await w(1500);
  say('broken', (await pane()).includes("Couldn't open it") ? 'says so, with Try again' : 'FAIL: ' + await pane());
  await p.evaluate(() => { FP.folder.isTest = window.__fsTerm; });
  await p.click('.fpe-panel button:has-text("Try again")').catch(e => say('no try again', e.message)); await w(1500);
  say('try again', (await pane()).includes('terminal / T01') ? 'T01' : 'FAIL: ' + await pane());
  // 3. A pane that waits on the folder: Opening…, then Still opening after 8 s.
  await p.evaluate(() => { FP.folder.isTest = () => new Promise(() => {}); });
  await click('Start shift'); await w(1200); await click('T01', true); await w(1000);
  say('waiting', await pane());
  await w(8000);
  say('8 s', (await pane()).startsWith('Still opening') ? 'still opening, with Try again' : 'FAIL: ' + await pane());
  await p.evaluate(() => { FP.folder.isTest = window.__fsTerm; });
  await click('Lines'); await w(2000);
  say('then a form', (await pane()).slice(0, 30));
  say('errs', JSON.stringify(errs).slice(0, 600));
  await b.close();
})();
