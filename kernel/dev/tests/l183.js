// 0.68 Change the data folder: the start-up gate offers a different folder when the stored one is gone (Tap Start card, a failed Start,
// and the "not there any more" card) and carries on into it; the terminal ID and site survive; Admin has a Data folder card that changes
// it (then reloads); the launcher has Change data folder for a supervisor or higher, not for a plain user.
// (fake3.js: d.prompt = the browser would ask again; d.dead = the folder was moved or renamed; window.__newDir makes another; window.__pick is what the picker hands out.)
const start = require('./dummies/base.js');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const A = await start({ seed: 'dummies/snap15b.json', at: '2026-11-24T09:00:00-06:00' });
  const { p, w } = A;
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  // A plain user, and this device's terminal ID and site (the editor has none of its own).
  await p.evaluate(async () => {
    await FP.kv.set('terminalId', 'T01'); await FP.kv.set('siteId', 'HOU');
    const id = await FP.users.create({ name: 'Pat Operator', roles: ['user'], tempPin: '918273' }); await FP.users.changePin(id, '918273', '735194');
  });
  // A copy of the data folder under another name, as if it had been moved and renamed (made in the page before the old one goes).
  const copyTo = q => q.evaluate(async () => {
    const copy = async (from, to) => { for await (const [n, h] of from.entries()) { if (h.kind === 'file') { const x = await (await to.getFileHandle(n, { create: true })).createWritable(); await x.write(await (await h.getFile()).text()); await x.close(); } else await copy(h, await to.getDirectoryHandle(n, { create: true })); } };
    const moved = window.__newDir('Moved data'); await copy(window.__root, moved); window.__pick = moved;
  });

  // Admin > Test folder: the Data folder card with the current name; Choose a different folder changes it and reloads.
  await p.click('.fpe-adminbtn:not(.fpe-helpbtn)'); await w(1500);
  await p.locator('button:text-is("Test folder")').first().click(); await w(2000);
  const card = await p.$eval('.fpa-datafolder', x => x.innerText.replace(/\s+/g, ' ')).catch(() => null);
  expect('admin card names the folder', card && /Data folder/.test(card) && /Fake data/.test(card) && /terminal ID, site and sign-ins/.test(card), card);
  const btnH = await p.$eval('#fpa-change-folder', x => x.getBoundingClientRect().height).catch(() => 0);
  expect('admin button is a 48 px target', btnH >= 47.5, String(btnH));
  await A.snapshot('out/l183snap.json');
  await copyTo(p);
  // What the page held when change() finished, kept across the reload in window.name.
  await p.evaluate(() => { const c = FP.folder.change; FP.folder.change = async () => { const n = await c(); window.name = JSON.stringify({ n, kv: (await FP.kv.get('dataFolder')).name, t: await FP.kv.get('terminalId'), s: await FP.kv.get('siteId'), cache: await FP.kv.get('defsCache') || null }); return n; }; });
  const reloaded = p.waitForEvent('load', { timeout: 15000 }).then(() => true, () => false);
  await p.click('#fpa-change-folder');
  expect('the page reloads after the change', await reloaded, 'no reload');
  const st = JSON.parse(await p.evaluate(() => window.name || '{}'));
  expect('admin change: new folder stored, ID and site kept, offline copy dropped', st.n === 'Moved data' && st.kv === 'Moved data' && st.t === 'T01' && st.s === 'HOU' && !st.cache, st);
  await A.b.close();

  // The launcher: who sees Change data folder, and the gate with a gone folder.
  const visit = async (what, user, check) => {
    const { b, p: q, w: w2, errs } = await start({ seed: 'out/l183snap.json', at: '2026-11-24T10:00:00-06:00', noSignIn: true, dropKv: ['openSessions'] });
    q.on('dialog', d => d.accept().catch(() => {}));
    await q.goto('file:///home/claude/kernel/launcher.html'); await w2(4000);
    if (await q.$('.fp-u-card')) { await q.click(`.fp-u-card >> text=${user.name}`).catch(() => {}); await w2(300); await q.keyboard.type(user.pin); await w2(3500); }
    try { await check(q, w2); } catch (e) { bad.push(`${what}: ${e.message}`); }
    errs.forEach(e => bad.push(`${what}: ${e}`));
    await b.close();
  };
  const vis = q => q.$eval('#change-folder', x => !x.hidden && x.offsetParent !== null).catch(() => false);
  const gateText = q => q.$eval('.fp-gate-card', x => x.innerText.replace(/\s+/g, ' ')).catch(() => '');

  await visit('supervisor or higher', { name: 'Josh', pin: '482913' }, async q => {
    expect('admin sees Change data folder', await vis(q), 'hidden');
    await copyTo(q);
    await q.evaluate(() => { const c = FP.folder.change; FP.folder.change = async () => { const n = await c(); window.name = JSON.stringify({ n, t: await FP.kv.get('terminalId'), s: await FP.kv.get('siteId') }); return n; }; });
    const re = q.waitForEvent('load', { timeout: 15000 }).then(() => true, () => false);
    await q.click('#change-folder');
    expect('launcher reloads after the change', await re, 'no reload');
    const s2 = JSON.parse(await q.evaluate(() => window.name || '{}'));
    expect('launcher change keeps ID and site', s2.n === 'Moved data' && s2.t === 'T01' && s2.s === 'HOU', s2);
  });
  await visit('plain user', { name: 'Pat Operator', pin: '735194' }, async q => {
    const who = await q.$eval('.fpl-bar', x => x.innerText.replace(/\s+/g, ' ')).catch(() => '');
    expect('signed in as the plain user', /Pat Operator/.test(who), who);
    expect('plain user does not see Change data folder', !(await vis(q)), 'visible');
  });

  // (a) The browser asks again (Tap Start) for a folder that is gone: Start says so plainly; Choose a different data folder carries on.
  await visit('gate: Tap Start card', { name: 'Josh', pin: '482913' }, async (q, w2) => {
    await copyTo(q);
    await q.evaluate(() => { window.__root.prompt = true; window.__root.dead = true; FP.startup.run({ title: 'Launcher' }).then(r => { window.__gateDone = r; }); });
    await w2(1500);
    let t = await gateText(q);
    expect('Tap Start card', /Tap Start to connect to the data folder on T01/.test(t) && /Choose a different data folder/.test(t), t);
    await q.click('.fp-gate-card button:text-is("Start")'); await w2(600);
    t = await gateText(q);
    expect('failed Start says it plainly', /The data folder was not found\. It may have moved or been renamed\./.test(t) && /Choose a different data folder/.test(t), t);
    await q.click('.fp-gate-card button:has-text("Choose a different data folder")'); await w2(3500);
    const done = await q.evaluate(() => ({ done: window.__gateDone || null, gate: !!document.querySelector('.fp-gate') }));
    expect('gate continues into the new folder', done.done && done.done.folder === 'Moved data' && done.done.terminalId === 'T01' && done.done.site === 'HOU' && !done.gate, done);
  });
  // (c) The browser still says allowed, but the folder is not there: the card; Try again; then Choose the data folder again.
  await visit('gate: gone folder', { name: 'Josh', pin: '482913' }, async (q, w2) => {
    await copyTo(q);
    const c0 = await q.evaluate(async () => { const c = await FP.folder.check(); window.__root.dead = true; return [c, await FP.folder.check()]; });
    expect('check(): ok, then gone with the name', c0[0].ok === true && c0[0].name === 'Fake data' && c0[1].ok === false && c0[1].reason === 'gone' && c0[1].name === 'Fake data', c0);
    await q.evaluate(() => { FP.startup.run({ title: 'Launcher' }).then(r => { window.__gateDone = r; }); });
    await w2(1500);
    let t = await gateText(q);
    expect('gone card', /The data folder is not there any more/.test(t) && /Fake data/.test(t) && /Choose the data folder again/.test(t) && /Try again/.test(t), t);
    await q.click('.fp-gate-card button:text-is("Try again")'); await w2(1200);
    expect('Try again still shows the card while it is gone', /not there any more/.test(await gateText(q)), await gateText(q));
    await q.screenshot({ path: './out/l183-gone.png' });
    await q.click('.fp-gate-card button:has-text("Choose the data folder again")'); await w2(3500);
    const done = await q.evaluate(() => ({ done: window.__gateDone || null, gate: !!document.querySelector('.fp-gate') }));
    expect('continues into the new folder', done.done && done.done.folder === 'Moved data' && done.done.terminalId === 'T01' && !done.gate, done);
    expect('check() is ok on the new folder', (await q.evaluate(() => FP.folder.check())).ok === true, 'not ok');
  });
  console.log('errs      :', JSON.stringify(bad));
  if (bad.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
