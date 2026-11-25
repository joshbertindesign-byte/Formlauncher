// 0.71 The universal clock in Admin: the Clock card (Admin > Speed): the on/off switch (admins only), this PC against the host, and a table of the
// terminals' last measurements with the ones more than a minute off flagged; a terminal whose own clock is more than a minute off raises one alert for
// admins (once per episode, shown to every admin) and it closes itself when the clock is right; a person who is not an admin cannot switch it off.
const start = require('./dummies/base.js');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const A = await start({ seed: 'dummies/snap15b.json', at: '2026-11-24T09:00:00-06:00' });
  const { p, w, errs } = A;
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(2500);
  const text = sel => p.$eval(sel, x => x.innerText.replace(/\s+/g, ' ')).catch(() => null);
  const host = ms => p.evaluate(m => { window.__hostClockOffsetMs = m; }, ms);
  const refresh = () => p.evaluate(() => FP.clock.refresh());
  const near = (a, b, tol) => Math.abs(a - b) <= (tol || 250);
  const openSpeed = async () => { await p.evaluate(async () => { const h = document.createElement('div'); h.id = 'adm'; document.body.innerHTML = ''; document.body.appendChild(h); await FP.editor.admin(h, { section: 'speed' }); }); await w(1200); };
  // A clock that moves back puts a sign-in made a moment ago "in the future" for a while (sessions read as of now): sign in again where the test needs an admin.
  const signJosh = () => p.evaluate(async () => { await FP.users.signOut().catch(() => {}); await FP.users.signIn((await FP.users.list()).find(u => u.name === 'Josh').id, '482913'); });
  const clockAlerts = () => p.evaluate(async () => (await FP.alerts.list(true)).filter(a => a.kind === 'clock'));

  // People first (while the clock is as it started): another admin, and a plain user.
  await p.evaluate(async () => { await FP.users.create({ name: 'Ann Admin', roles: ['admin'], tempPin: '918273' }); await FP.users.create({ name: 'Pat Operator', roles: ['user'], tempPin: '918273' }); });
  // The card, with nothing off.
  await p.click('.fpe-adminbtn:not(.fpe-helpbtn)'); await w(1500);
  await p.locator('.fpa-tabs button:text-is("Speed")').click(); await w(1500);
  let t = await text('.fpa-clock');
  expect('the Clock card is in Admin > Speed', t && /Clock: every terminal follows the host/.test(t), t);
  expect('it says on', /\bOn\b/.test(t) && /Turn it off for this folder/.test(t), t);
  expect('this PC is right', /This PC .*right \(within 2 s\)/.test(t), t);
  expect('it lists this terminal (its own result)', (await p.$$('.fpa-clock tr[data-terminal]')).length === 1, t);
  expect('nothing is flagged', (await p.$$('.fpa-clock tr[data-off]')).length === 0, t);
  const hsw = await p.$eval('.fpa-clock-switch', x => x.getBoundingClientRect().height);
  expect('the switch is a 48 px target', hsw >= 47.5, hsw);
  expect('no alert yet', (await clockAlerts()).length === 0, await clockAlerts());

  // Terminals that wrote results: one far off, one a little, one right.
  await p.evaluate(async () => {
    const at = new Date().toISOString();
    await FP.files.writeJson(['_clock'], 'T05.json', { terminalId: 'T05', ownVsHostMs: 240000, offsetMs: -240000, measuredAt: at });
    await FP.files.writeJson(['_clock'], 'T06.json', { terminalId: 'T06', ownVsHostMs: -45000, offsetMs: 45000, measuredAt: at });
    await FP.files.writeJson(['_clock'], 'T07.json', { terminalId: 'T07', ownVsHostMs: 0, offsetMs: 0, measuredAt: at });
    await FP.files.writeJson(['_clock'], 'T07.probe.json', { n: 1 });
    await FP.files.writeJson(['_clock'], 'T08.json', { junk: true });
  });
  await openSpeed();
  const rows = await p.$$eval('.fpa-clock tr[data-terminal]', l => l.map(x => ({ id: x.dataset.terminal, off: x.dataset.off === '1', t: x.innerText.replace(/\s+/g, ' ') })));
  expect('four terminals: probes and junk are not rows', rows.length === 4 && rows.every(r => !/probe/.test(r.id)), rows);
  expect('the far-off one is first and flagged', rows[0] && rows[0].id === 'T05' && rows[0].off && /4 min fast/.test(rows[0].t) && /more than a minute off/.test(rows[0].t), rows[0]);
  expect('45 s is shown but not flagged', rows.some(r => r.id === 'T06' && !r.off && /45 s slow/.test(r.t) && !/more than a minute/.test(r.t)), rows);
  expect('a terminal that is right is not flagged', rows.some(r => r.id === 'T07' && !r.off && /right/.test(r.t)), rows);
  await p.screenshot({ path: './out/l192-clock.png' });

  // The switch, as an admin.
  await p.click('.fpa-clock-switch'); await w(1500);
  let st = await p.evaluate(async () => ({ s: FP.clock.state(), f: await FP.files.readJson(['_clock'], 'settings.json') }));
  expect('the switch turns it off, in the folder', !st.s.enabled && st.f && st.f.enabled === false, st);
  t = await text('.fpa-clock');
  expect('and the card says off, with a way back', /\bOff\b/.test(t) && /Turn it on for this folder/.test(t) && /not measured: the universal clock is off/.test(t), t);
  await p.click('.fpa-clock-switch'); await w(1500);
  st = await p.evaluate(async () => ({ s: FP.clock.state(), f: await FP.files.readJson(['_clock'], 'settings.json') }));
  expect('and on again', st.s.enabled && st.f.enabled === true, st);

  // The alert: this PC's own clock 4 min fast (the host is 4 min behind). Once per episode.
  await host(-240000);
  let s = await refresh();
  let al = await clockAlerts();
  const id = await p.evaluate(() => FP.identity.terminalId);
  expect('own clock 4 min fast raises one alert', al.length === 1 && !al[0].closedAt && al[0].series === `clock:${id}`, al);
  expect('it says what is wrong', /own clock is 4 min fast; host time is being used$/.test(al[0] && al[0].title), al[0]);
  const josh = await p.evaluate(async () => (await FP.users.list()).find(u => u.name === 'Josh').id);
  expect('it tells admins (Josh)', al[0] && al[0].told.length === 1 && al[0].told[0].ids.includes(josh) && al[0].told[0].to === 'admins', al[0]);
  expect('it has no center and no duty', al[0] && al[0].center === '' && !al[0].form, al[0]);
  await refresh(); await refresh();
  al = await clockAlerts();
  expect('later measurements in the same episode raise no more', al.length === 1, al);
  const mine = await p.evaluate(async j => { const u = (await FP.users.list()).find(x => x.id === j); return (await FP.alerts.forUser(u, { terminalId: 'ZZ' })).filter(a => a.kind === 'clock').length; }, josh);
  expect('an admin is shown it', mine === 1, mine);
  // Every admin.
  const late = await p.evaluate(async () => { const u = (await FP.users.list()).find(x => x.name === 'Ann Admin'); return (await FP.alerts.forUser(u, { terminalId: 'ZZ' })).filter(a => a.kind === 'clock').length; });
  expect('and another admin', late === 1, late);
  const plainSees = await p.evaluate(async () => { const u = (await FP.users.list()).find(x => x.name === 'Pat Operator'); return (await FP.alerts.forUser(u, { terminalId: 'ZZ' })).length; });
  expect('a plain user is not shown it', plainSees === 0, plainSees);
  expect('the note is on entries meanwhile', await p.evaluate(async () => { const e = await FP.entry.build({ entry: 'alerts.probe', item: { structure: 'alerts', id: 'X' }, values: {} }); return !!(e.clockWarn && e.clockWarn.ownVsHostMs > 200000); }), 'no note');
  // Acknowledging does not close it: the clock does.
  await signJosh();
  await p.evaluate(async () => { await FP.alerts.ack((await FP.alerts.list(true)).find(a => a.kind === 'clock').id, 'IT is on it'); });
  al = await clockAlerts();
  expect('acknowledged, still open', al.length === 1 && al[0].ackAt && !al[0].closedAt, al);
  // The clock is right again: it closes itself.
  await host(0); s = await refresh();
  al = await clockAlerts();
  expect('back within a minute: the alert closes itself', al.length === 1 && al[0].closedAt && /back within a minute/.test(al[0].closedHow || '') && !(await p.evaluate(() => FP.clock.state().off)), al);
  await refresh();
  expect('and stays closed', (await clockAlerts()).filter(a => !a.closedAt).length === 0, await clockAlerts());
  // A new episode: a new alert. 61 s counts, 59 s does not.
  await host(-59000); await refresh();
  expect('59 s off raises nothing', (await clockAlerts()).filter(a => !a.closedAt).length === 0, await clockAlerts());
  await host(-61000); await refresh();
  al = await clockAlerts();
  expect('61 s off is a new episode and a new alert', al.length === 2 && al.filter(a => !a.closedAt).length === 1, al);
  await host(0); await refresh();
  // Turned off: the episode is over.
  await host(-240000); await refresh();
  expect('open again', (await clockAlerts()).filter(a => !a.closedAt).length === 1, await clockAlerts());
  await signJosh();
  await p.evaluate(async () => { await FP.clock.setEnabled(false); });
  expect('switching it off closes the alert (host time is no longer used)', (await clockAlerts()).filter(a => !a.closedAt).length === 0, await clockAlerts());
  await p.evaluate(async () => { await FP.clock.setEnabled(true); });
  await host(0); await refresh();
  await A.snapshot('out/l192snap.json'); await A.b.close();

  // A plain user: the setting cannot be changed, the Admin page is refused, and the clock goes on as it was.
  const { b, p: u, w: w2, errs: e3 } = await start({ seed: 'out/l192snap.json', at: '2026-11-24T10:00:00-06:00' });
  u.on('dialog', d => d.accept().catch(() => {}));
  await w2(2500);
  await u.evaluate(async () => { const id = (await FP.users.list()).find(x => x.name === 'Pat Operator').id; await FP.users.changePin(id, '918273', '735194'); await FP.users.signOut(); await FP.users.signIn(id, '735194'); });
  const r = await u.evaluate(async () => { try { await FP.clock.setEnabled(false); return null; } catch (e) { return e.message; } });
  expect('a plain user cannot switch it off', /Only an admin/.test(r || ''), r);
  const after = await u.evaluate(async () => ({ s: FP.clock.state(), f: await FP.files.readJson(['_clock'], 'settings.json') }));
  expect('and it is still on', after.s.enabled && after.f && after.f.enabled === true, after);
  const page = await u.evaluate(async () => { const h = document.createElement('div'); document.body.appendChild(h); await FP.editor.admin(h, { section: 'speed' }); return h.innerText; });
  expect('the admin page is refused, with no clock card', /This page is for admins/.test(page) && !/Turn it off/.test(page), page);
  e3.forEach(x => bad.push('plain user: ' + x));
  await b.close();
  errs.forEach(x => bad.push('page: ' + x));
  console.log('errs      :', JSON.stringify(bad));
  if (bad.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
