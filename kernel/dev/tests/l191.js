// 0.71 The universal clock, applying: the page clock follows the host (new Date, Date.now); a test folder using the test clock keeps it (the universal
// clock is never applied there); a folder with the setting off applies nothing; an entry carries clockWarn only while this PC's clock is more than a
// minute from the host's, and nothing else about it changes; the order safeguard (never before the previous entry for the item) stays; and the page
// clock is moved only between entries, never in the middle of a save.
const start = require('./dummies/base.js');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const A = await start({ seed: 'dummies/snap15b.json', at: '2026-11-24T09:00:00-06:00' });
  const { p, w, errs } = A;
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(2500);
  const host = ms => p.evaluate(m => { window.__hostClockOffsetMs = m; }, ms);
  const refresh = () => p.evaluate(() => FP.clock.refresh());
  const ahead = () => p.evaluate(() => Date.now() - FP.pageClock.realNow());     // how far the page's clock is from this PC's real one
  const near = (a, b, tol) => Math.abs(a - b) <= (tol || 250);
  await p.evaluate(async () => { await FP.defs.publish('structure', 'zz-clk', { sites: ['all'], label: 'Zz clock', kind: 'records', containers: { a: {} } }); });
  const build = (extra) => p.evaluate(async x => { const e = await FP.entry.build(Object.assign({ entry: 'zz-clk.add', item: { structure: 'zz-clk' }, values: { a: 'x' } }, x || {})); return JSON.parse(JSON.stringify(e)); }, extra);

  // With a host that agrees, nothing moves and entries carry nothing new.
  expect('at the start the page clock is the PC clock', near(await ahead(), 0, 50), await ahead());
  let e = await build();
  expect('an entry from a terminal that agrees has no clockWarn', !('clockWarn' in e), e);

  // The page follows the host.
  await host(90000); let s = await refresh();
  expect('state: 90 s behind, applied', near(s.ownVsHostMs, -90000) && near(s.appliedMs, 90000) && s.enabled && !s.stale, s);
  expect('new Date() and Date.now() now read host time', near(await ahead(), 90000), await ahead());
  expect('a date made by new Date() agrees', near(await p.evaluate(() => new Date().getTime() - FP.pageClock.realNow()), 90000), 'x');
  await host(-300000); s = await refresh();
  expect('and follows it backwards', near(await ahead(), -300000) && near(s.appliedMs, -300000), [await ahead(), s]);
  await host(0); s = await refresh();
  expect('and back to none', near(await ahead(), 0, 50) && s.appliedMs === 0 && s.ownVsHostMs === 0, [await ahead(), s]);

  // A change of 2 s or less is not made (the share's granularity), so noise does not move the clock.
  await host(30000); await refresh();
  await host(31500); s = await refresh();
  expect('30 s then 31.5 s: the clock stays where it was', near(s.appliedMs, 30000, 400) && near(await ahead(), 30000, 400), s);
  await host(0); await refresh();

  // The note on entries: more than a minute only.
  await host(59000); await refresh();
  e = await build();
  expect('59 s off: no note', !('clockWarn' in e), e);
  await host(-61000); await refresh();
  e = await build();
  expect('61 s off: the note', e.clockWarn && near(e.clockWarn.ownVsHostMs, 61000) && near(e.clockWarn.appliedMs, -61000), e.clockWarn);
  await host(240000); await refresh();
  e = await build();
  expect('4 min off: own vs host is -4 min and 4 min applied', e.clockWarn && near(e.clockWarn.ownVsHostMs, -240000) && near(e.clockWarn.appliedMs, 240000), e.clockWarn);
  expect('the entry is otherwise as ever', e.entry === 'zz-clk.add' && e.values.a === 'x' && !('clockAt' in e) && /^\d{4}-/.test(e.writtenAt) && e.terminalId, e);
  expect('its time is host time', near(Date.parse(e.writtenAt) - (await p.evaluate(() => FP.pageClock.realNow())), 240000, 2500), e.writtenAt);
  // Saved, it is in the history and the record views get it.
  const saved = await p.evaluate(async () => { const x = await FP.entry.record({ entry: 'zz-clk.add', item: { structure: 'zz-clk' }, values: { a: 'noted' } }); FP.current.clearCache(); const r = await FP.current.load('zz-clk', { fresh: true, history: true }); return { id: x.entryId, row: r.rows.find(q => q.entryId === x.entryId), raw: x.clockWarn }; });
  expect('saved with the note', saved.raw && saved.row && saved.row.clockWarn && near(saved.row.clockWarn.ownVsHostMs, -240000), saved);
  const line = await p.evaluate(async row => { const part = await FP.forms.recordPart(row, {}); return part.innerText.replace(/\s+/g, ' '); }, saved.row);
  expect('the record says it quietly', /This terminal's clock was 4 min off; host time was used\./.test(line), line);
  await host(0); await refresh();
  e = await build();
  expect('back within a minute: no note again', !('clockWarn' in e), e);
  const plain = await p.evaluate(async () => { const x = await FP.entry.record({ entry: 'zz-clk.add', item: { structure: 'zz-clk' }, values: { a: 'plain' } }); FP.current.clearCache(); const r = await FP.current.load('zz-clk', { fresh: true, history: true }); return r.rows.find(q => q.entryId === x.entryId); });
  expect('and a row without the note has no clockWarn key', plain && !('clockWarn' in plain), plain);

  // The order safeguard stays: an entry is never stamped before the previous one for the item, and the clock's own reading is kept.
  await host(0); await refresh();
  const first = await p.evaluate(async () => { const x = await FP.entry.record({ entry: 'zz-clk.add', item: { structure: 'zz-clk', id: 'ORDER-1' }, values: { a: '1' } }); return x.writtenAt; });
  await host(-300000); await refresh();
  const second = await p.evaluate(async f => { const x = await FP.entry.record({ entry: 'zz-clk.add', item: { structure: 'zz-clk', id: 'ORDER-1' }, values: { a: '2' }, after: f }); return JSON.parse(JSON.stringify(x)); }, first);
  expect('after the clock moved 5 min back the next entry still comes after', Date.parse(second.writtenAt) === Date.parse(first) + 1 && second.clockAt && second.clockWarn, [first, second]);
  await host(0); await refresh();

  // The page clock moves only between entries: a refresh in the middle of a save waits for it.
  await host(120000);
  const mid = await p.evaluate(async () => {
    const out = {};
    const saving = FP.entry.submit(async add => {
      await add({ entry: 'zz-clk.add', item: { structure: 'zz-clk' }, values: { a: 'mid' } });
      await new Promise(r => setTimeout(r, 800));
      out.duringSave = FP.pageClock.universal();
      out.inFlight = FP.entry.inFlight();
    });
    await new Promise(r => setTimeout(r, 100));
    const moving = FP.clock.refresh();
    await saving;
    out.afterSave = FP.pageClock.universal();
    await moving;
    out.afterRefresh = FP.pageClock.universal();
    return out;
  });
  expect('the clock did not move during the save', mid.duringSave === 0 && mid.inFlight >= 1, mid);
  expect('it moved once the save was done', near(mid.afterRefresh, 120000), mid);
  await host(0); await refresh();

  // The setting: off applies nothing (and writes nothing new), on again applies.
  await host(90000); await refresh();
  expect('on by default, and applied', near(await ahead(), 90000), await ahead());
  const off = await p.evaluate(async () => { await FP.clock.setEnabled(false); return { s: FP.clock.state(), file: await FP.files.readJson(['_clock'], 'settings.json') }; });
  expect('off: the setting is kept in the folder', off.file && off.file.enabled === false, off);
  expect('off: nothing applied, back to the PC clock', !off.s.enabled && off.s.appliedMs === 0 && near(await ahead(), 0, 50), off);
  e = await build();
  expect('off: no clockWarn', !('clockWarn' in e), e);
  s = await refresh();
  expect('off: a refresh applies nothing', s.appliedMs === 0 && !s.enabled && near(await ahead(), 0, 50), s);
  await p.evaluate(async () => { await FP.clock.setEnabled(true); });
  expect('on again: applied', near(await ahead(), 90000), await ahead());
  await host(0); await refresh();

  // A test folder using the test clock keeps it: the universal clock is not applied there.
  await p.evaluate(async () => { await FP.files.writeText([], FP.folder.TEST_MARK, 'a test folder'); });
  await host(90000); await refresh();
  expect('a test folder without a test clock follows the host', near(await ahead(), 90000), await ahead());
  const t = await p.evaluate(async () => { await FP.testClock.set(3600000); return { applied: FP.pageClock.universal(), offset: FP.testClock.offset(), used: FP.testClock.used }; });
  expect('setting the test clock takes the universal offset off', t.applied === 0 && t.offset === 3600000 && t.used, t);
  s = await refresh();
  expect('measured still (for the table) but not applied', near(s.ownVsHostMs, -90000) && s.appliedMs === 0, s);
  expect('the page clock is the test clock alone', near(await ahead(), 3600000), await ahead());
  e = await build();
  expect('no clockWarn while the test clock is in use', !('clockWarn' in e), e);
  await p.evaluate(async () => { await FP.testClock.set(0); });
  s = await refresh();
  expect('a test clock set to 0 is still the test clock', s.appliedMs === 0 && near(await ahead(), 0, 50), [s, await ahead()]);
  await p.evaluate(async () => { await FP.files.remove(['_test'], 'clock.json'); await FP.testClock.load(); });
  s = await refresh();
  expect('without a test clock file the host is followed again', near(s.appliedMs, 90000) && near(await ahead(), 90000), [s, await ahead()]);
  await host(0); await refresh();

  await A.b.close();
  errs.forEach(x => bad.push('page: ' + x));
  console.log('errs      :', JSON.stringify(bad));
  if (bad.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
