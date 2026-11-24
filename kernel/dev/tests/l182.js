// 0.67 Retiring terminals and sites, Admin and start-up: the terminal's card offers Retire this terminal (no "Take it off the list"),
// the terminal leaves its group and the pickers and sits on the collapsed Retired shelf with who and when and a Reinstate button;
// a retired site sits there too (Retire / Reinstate this site, refused while a terminal or group is at it); a retired terminal that is
// switched on shows one plain card and no forms, no sign-in, nothing written.
const start = require('./dummies/base.js');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const A = await start({ seed: 'dummies/snap15b.json', at: '2026-11-24T09:00:00-06:00' });
  const { p, w } = A;
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const text = sel => p.$eval(sel, x => x.innerText.replace(/\s+/g, ' ')).catch(() => null);
  const plantShelf = async () => { const r = await p.$$eval('.fpe-map .fpe-mrow', l => l.map(x => x.innerText.replace(/^\s*[▸▾]\s*/, '').replace(/\s+/g, ' ').trim())); return r.find(t => /^Retired · \d+/.test(t)) || null; };
  // Another terminal at the site, in no group, to see the picker and the shelf with more than one thing on it.
  await p.evaluate(async () => {
    await FP.files.writeJson(['_terminals'], 'T02.json', { terminalId: 'T02', site: 'HOU', deviceKey: 'other-T02', lastSeen: '2026-11-23T08:00:00.000Z', kernel: FP.version });
    await FP.sites.create('ELP', 'El Paso');
    await FP.editor.refreshMap();
  });
  await w(1000);
  expect('no shelf while nothing is retired', (await plantShelf()) === null, await plantShelf());

  // The terminal's card: Retire this terminal, never "Take it off the list".
  await p.evaluate(() => FP.editor.openPlace('terminal', 'T01')); await w(1500);
  expect('card has Retire', !!(await p.$('.fpa-place button:has-text("Retire this terminal")')), await text('.fpa-place'));
  expect('card has no Take it off the list', !(await p.$('.fpa-place button:has-text("Take it off the list")')), 'still there');
  await p.click('.fpa-place button:has-text("Retire this terminal")'); await w(2000);
  const card = await text('.fpa-place');
  expect('card says retired', /was retired on 24 Nov 2026 by Josh/.test(card) && /ID is never used again/.test(card), card);
  expect('card offers Reinstate, not Retire', !!(await p.$('.fpa-place button:has-text("Reinstate this terminal")')) && !(await p.$('.fpa-place button:has-text("Retire this terminal")')), card);
  const t1 = await p.evaluate(async () => ({ entry: await FP.identity.lookup('T01'), group: (await FP.groups.list()).map(g => g.terminals), settings: !!(await FP.groups.terminals()).get('T01') }));
  expect('file kept and marked', t1.entry && t1.entry.site === 'HOU' && t1.entry.retired && t1.entry.retired.by === 'Josh', t1);
  expect('left its group', t1.group.every(l => !l.includes('T01')), t1);
  expect('kept a copy of its forms', t1.settings, t1);

  // The map: T01 is off the live lists and on the collapsed shelf.
  let rows = await p.$$eval('.fpe-map .fpe-mrow', l => l.map(x => x.innerText.replace(/^\s*[▸▾]\s*/, '').replace(/\s+/g, ' ').trim()));
  expect('shelf shows 1', rows.includes('Retired · 1') || rows.some(t => /^Retired · 1\b/.test(t)), rows);
  expect('T01 is not in the live list', !rows.some(t => /^T01\b/.test(t)), rows);
  await p.click('.fpe-map .fpe-mrow:has-text("Retired · 1")'); await w(500);
  const shelf = await p.$$eval('.fpe-map .fpe-mshelf', l => l.map(x => x.innerText.replace(/^\s*[▸▾]\s*/, '').replace(/\s+/g, ' ').trim()));
  expect('shelf row has who, when and Reinstate', shelf.length === 1 && /T01/.test(shelf[0]) && /24 Nov 2026/.test(shelf[0]) && /by Josh/.test(shelf[0]) && /Reinstate/.test(shelf[0]), shelf);
  expect('shelf row is dimmed', !!(await p.$('.fpe-map .fpe-mpair .fpe-mrow.dim')), 'not dim');
  const rb = await p.$eval('.fpe-map .fpe-mreinstate', x => x.getBoundingClientRect().height);
  expect('Reinstate is a 48 px target', rb >= 47.5, String(rb));

  // The group editor's picker skips it.
  const gid = await p.evaluate(async () => (await FP.groups.list())[0].id);
  await p.evaluate(id => FP.editor.openPlace('group', id), gid); await w(1500);
  const opts = await p.$$eval('.fpa-place .fpp-chips select option', l => l.map(o => o.textContent));
  expect('picker skips the retired terminal', opts.some(o => /T02/.test(o)) && !opts.some(o => /T01/.test(o)), opts);
  await p.screenshot({ path: './out/l182-shelf.png' });

  // Reinstate from the shelf: back on the live list, the shelf is gone.
  await p.click('.fpe-map .fpe-mreinstate'); await w(2000);
  const back = await p.evaluate(async () => ({ entry: await FP.identity.lookup('T01'), retired: FP.identity.isRetired(await FP.identity.lookup('T01')) }));
  expect('reinstated from the shelf', back.retired === false && back.entry.site === 'HOU', back);
  expect('shelf gone at zero', (await plantShelf()) === null, await plantShelf());
  rows = await p.$$eval('.fpe-map .fpe-mrow', l => l.map(x => x.innerText.replace(/^\s*[▸▾]\s*/, '').replace(/\s+/g, ' ').trim()));
  expect('T01 is back on the map', rows.some(t => /^T01\b/.test(t)) || (await p.evaluate(() => /T01/.test(document.querySelector('.fpe-map').innerText))), rows);

  // Sites: Retire this site is refused with a terminal or group at it, then allowed; the shelf shows it; Reinstate this site.
  await p.evaluate(() => FP.editor.openPlace('site', 'HOU')); await w(1500);
  expect('site buttons are relabelled', !!(await p.$('.fpa-place button:has-text("Retire this site")')) && !(await p.$('.fpa-place button:has-text("Turn this site off")')), await text('.fpa-place'));
  expect('site card says what is at it', /Before retiring Houston: these are still at it/.test(await text('.fpa-place')) && /terminal T01/.test(await text('.fpa-place')) && /group Production presses/.test(await text('.fpa-place')), await text('.fpa-place'));
  await p.click('.fpa-place button:has-text("Retire this site")'); await w(1500);
  expect('refused in the toast', /HOU can't be retired while these are still at it/.test(await text('.fpe-msg')), await text('.fpe-msg'));
  expect('HOU still on', await p.evaluate(async () => (await FP.sites.list()).find(s => s.id === 'HOU').active), 'off');
  await p.evaluate(() => FP.editor.openPlace('site', 'ELP')); await w(1500);
  await p.click('.fpa-place button:has-text("Retire this site")'); await w(2000);
  const sc = await text('.fpa-place');
  expect('site card says retired, with Reinstate', /El Paso was retired on 24 Nov 2026 by Josh/.test(sc) && !!(await p.$('.fpa-place button:has-text("Reinstate this site")')), sc);
  expect('shelf counts the site', (await plantShelf()) === 'Retired · 1', await plantShelf());
  if (!(await p.$('.fpe-map .fpe-mshelf'))) { await p.click('.fpe-map .fpe-mrow:has-text("Retired · 1")'); await w(500); }
  const sh2 = await p.$$eval('.fpe-map .fpe-mshelf', l => l.map(x => x.innerText.replace(/^\s*[▸▾]\s*/, '').replace(/\s+/g, ' ').trim()));
  expect('site on the shelf with who and when', sh2.length === 1 && /El Paso/.test(sh2[0]) && /24 Nov 2026/.test(sh2[0]) && /by Josh/.test(sh2[0]) && /Reinstate/.test(sh2[0]), sh2);
  await p.click('.fpa-place button:has-text("Reinstate this site")'); await w(2000);
  expect('site reinstated', await p.evaluate(async () => (await FP.sites.list()).find(s => s.id === 'ELP').active), 'still off');
  expect('shelf gone again', (await plantShelf()) === null, await plantShelf());

  // Retire T01 again, then switch it on: a launcher on that device shows the card and nothing else.
  await p.evaluate(async () => { await FP.identity.retire('T01', 'swapped for a new PC'); await FP.kv.set('terminalId', 'T01'); await FP.kv.set('siteId', 'HOU'); });
  const before = await p.evaluate(async () => JSON.stringify(await FP.identity.lookup('T01')));
  await A.snapshot('out/l182snap.json'); await A.b.close();
  const { b, p: q, w: w2, errs } = await start({ seed: 'out/l182snap.json', at: '2026-11-24T10:00:00-06:00', noSignIn: true, dropKv: ['openSessions'] });
  q.on('dialog', d => d.accept().catch(() => {}));
  await q.goto('file:///home/claude/kernel/launcher.html'); await w2(5000);
  const seen = await q.evaluate(() => ({ card: (document.querySelector('.fp-gate-card') || {}).innerText || null, tiles: document.querySelectorAll('.fpl-tile, #side button, .fp-u-card').length, input: !!document.querySelector('.fp-gate-card input') }));
  expect('retired card', seen.card && /T01 is retired/.test(seen.card) && /This terminal was retired on 24 Nov 2026 and shows no forms\. An admin can reinstate it from Admin\./.test(seen.card), seen);
  expect('no forms, no sign-in, no inputs', seen.tiles === 0 && !seen.input, seen);
  expect('nothing written', (await q.evaluate(async () => JSON.stringify(await FP.identity.lookup('T01')))) === before, 'registry file changed');
  await q.screenshot({ path: './out/l182-card.png' });
  // An admin reinstates it; the card's Check again carries on to the launcher.
  await q.evaluate(async () => { const e = await FP.identity.lookup('T01'); delete e.retired; await FP.files.writeJson(['_terminals'], 'T01.json', e); });
  await q.click('.fp-gate-card button:has-text("Check again")'); await w2(4000);
  expect('after reinstating, the gate lets it in', !(await q.$('.fp-gate-card')) || !/retired/.test(await q.$eval('.fp-gate-card', x => x.innerText).catch(() => '')), await q.$eval('.fp-gate-card', x => x.innerText).catch(() => ''));
  errs.forEach(e => bad.push('launcher: ' + e));
  console.log('errs      :', JSON.stringify(bad));
  await b.close();
  if (bad.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
