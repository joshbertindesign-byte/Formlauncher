// 0.60 at the launcher: the line terminals' group is for two lines, so the launcher asks which (HERE); a duty that
// looking the form over counts for shows Checked: nothing new over the open form, one per run, and tapping one does it.
const pilot = require('./dummies/pt.js');
(async () => {
  const t = await pilot({ seed: 'pilot2/snapQC.json', at: '2026-11-19T09:40:00-06:00' });
  const { p, w, say } = t;
  await t.signIn('Josh', '482913');
  const set = await p.evaluate(async () => {
    const g = (await FP.groups.list()).find(x => x.name === 'Line terminals');
    await FP.groups.update(g.id, { for: { list: 'lines', items: ['Line 1', 'Line 2'] } });
    const c = (await FP.centers.list()).find(x => x.name === 'Line operators');
    await FP.centers.update(c.id, { duties: c.duties.map(d => Object.assign({}, d, { confirm: true })) });
    return `for ${JSON.stringify((await FP.groups.forTerminal('T01')).for)} · duty ${JSON.stringify((await FP.centers.get(c.id)).duties.map(d => d.name + (d.confirm ? ' (looking it over counts)' : '')))}`;
  });
  say('set', set);
  await p.evaluate(() => FP.launcher.home()); await w(2500);
  say('asks', await t.text('#here'));
  say('HERE before', String(await p.evaluate(() => FP.fn.evaluate('HERE()', {}))));
  await p.click('#here button:text-is("Line 2")'); await w(800);
  say('HERE', `${await p.evaluate(() => FP.fn.evaluate('HERE()', {}))} · all ${JSON.stringify(await p.evaluate(() => FP.fn.evaluate('HERE("all")', {})))} · picked ${await p.$eval('#here button.on', x => x.textContent).catch(() => 'none')}`);
  await p.screenshot({ path: './out/l91-here.png' });
  // Kept on this terminal: home again, still Line 2.
  await p.evaluate(() => FP.launcher.home()); await w(2000);
  say('kept', await p.$eval('#here button.on', x => x.textContent).catch(() => 'none'));
  // The hourly check, due for each running run: Checked: nothing new.
  await p.evaluate(async () => { FP.current.clearCache(); const T = await FP.groups.forTerminal('T01'); const list = await FP.due.slots({ place: { group: T.group, forms: T.forms }, forms: T.forms }); window.dispatchEvent(new CustomEvent('fp-due', { detail: { list } })); }); await w(2500);
  await t.open('hourly'); await w(1500);
  say('bar', await t.text('#checkoff'));
  await p.screenshot({ path: './out/l91-check.png' });
  const first = await p.$eval('#checkoff button', b => ({ slot: b.dataset.slot, text: b.textContent })).catch(() => null);
  if (first) {
    await p.click('#checkoff button'); await w(2500);
    say('after', `${await t.text('#notice')} · bar ${await t.text('#checkoff')}`);
    const r = await p.evaluate(async id => {
      FP.current.clearCache();
      const subs = await FP.current.load('submissions', { fresh: true });
      const mine = Array.from(subs.items.values()).filter(it => it.values && it.values.checked === true);
      const T01 = await FP.groups.forTerminal('T01');
      const slot = (await FP.due.slots({ terminalId: 'T01', place: T01 })).find(x => x.id === id);
      return `${mine.length} checked save(s), form ${mine[0] && mine[0].values.form}, duty ${mine[0] && mine[0].values.duty} · slot now ${slot ? slot.state : 'gone'}`;
    }, first.slot);
    say('recorded', r);
  }
  // A duty that isn't set so: no bar.
  await p.evaluate(async () => { const c = (await FP.centers.list()).find(x => x.name === 'Line operators'); await FP.centers.update(c.id, { duties: c.duties.map(d => { const x = Object.assign({}, d); delete x.confirm; return x; }) }); });
  await p.evaluate(async () => { FP.current.clearCache(); const T = await FP.groups.forTerminal('T01'); const list = await FP.due.slots({ place: { group: T.group, forms: T.forms }, forms: T.forms }); window.dispatchEvent(new CustomEvent('fp-due', { detail: { list } })); }); await w(2000);
  await t.open('hourly'); await w(1500);
  say('without', (await p.$eval('#checkoff', x => x.hidden)) ? 'no bar' : 'BAR SHOWN');
  say('refused', await p.evaluate(() => FP.centers.check({ name: 'X', members: { role: 'user' }, duties: [{ name: 'd', forms: ['hourly'], every: 60, confirm: 'yes' }] }).filter(x => /nothing new/.test(x)).join(' | ')));
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
