// 0.71 The universal clock, measuring: a probe file written into _clock/ and read back, the file's last-modified time taken as the host's.
// An offset within +-2 s counts as none (the share's granularity); a host clock 90 s ahead gives an offset of +90 s (this PC is 90 s slow);
// the median of three probes ignores one wild one; a probe that takes over 2 s is thrown away; a failed write keeps the last good offset
// and says so; measure() never throws. The fake folder stamps _clock/ files from window.__hostClockOffsetMs (default 0: the host agrees).
const start = require('./dummies/base.js');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const A = await start({ seed: 'dummies/snap15b.json', at: '2026-11-24T09:00:00-06:00' });
  const { p, w, errs } = A;
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(2500);
  const host = ms => p.evaluate(m => { window.__hostClockOffsetMs = m; }, ms);
  const measure = () => p.evaluate(() => FP.clock.measure());
  const near = (a, b, tol) => Math.abs(a - b) <= (tol || 150);

  // At start-up, with a host that agrees: measured, nothing to apply, nothing noted.
  let s = await p.evaluate(() => FP.clock.state());
  expect('start-up measured this PC', s.measured && s.enabled && s.measuredAt && !s.stale, s);
  expect('and it agrees with the host', s.offsetMs === 0 && s.ownVsHostMs === 0 && s.appliedMs === 0, s);
  const probe = await p.evaluate(async () => { const f = await FP.files.readFile(['_clock'], FP.identity.terminalId + '.probe.json'); return f ? JSON.parse(await f.text()) : null; });
  expect('the probe file is in _clock/', probe && probe.terminalId, probe);
  const mine = await p.evaluate(async () => FP.files.readJson(['_clock'], FP.identity.terminalId + '.json'));
  expect('and the terminal wrote its result', mine && mine.ownVsHostMs === 0 && mine.offsetMs === 0 && mine.measuredAt, mine);

  // Within +-2 s is none.
  for (const ms of [0, 1500, -1500, 2000, -2000, 700]) {
    await host(ms);
    const r = await measure();
    expect(`a host ${ms} ms away is no offset`, r.ok && r.offsetMs === 0, r);
  }
  // Beyond it, the offset is host minus this PC.
  await host(2600);
  let r = await measure();
  expect('2.6 s is an offset', r.ok && near(r.offsetMs, 2600), r);
  await host(90000);
  r = await measure();
  expect('a host clock 90 s ahead gives +90 s', r.ok && near(r.offsetMs, 90000), r);
  expect('with the result shape', typeof r.rtMs === 'number' && r.rtMs < 2000 && !isNaN(Date.parse(r.hostAt)) && !isNaN(Date.parse(r.measuredAt)) && r.probes === 3, r);
  await host(-300000);
  r = await measure();
  expect('a host clock 5 min behind gives -5 min', r.ok && near(r.offsetMs, -300000), r);

  // Own vs host (refresh records the state): own minus host, so a host 90 s ahead means this PC is 90 s slow.
  await host(90000);
  s = await p.evaluate(() => FP.clock.refresh());
  expect('own-vs-host is -90 s when the host is 90 s ahead', near(s.ownVsHostMs, -90000) && near(s.offsetMs, 90000) && !s.stale && s.off, s);

  // The median of three: one wild probe is ignored.
  await p.evaluate(() => { let n = 0; window.__hostClockOffsetMs = () => [90000, 5000000, 90000][n++ % 3]; });
  r = await measure();
  expect('median of 3 ignores one outlier', r.ok && near(r.offsetMs, 90000), r);
  await p.evaluate(() => { let n = 0; window.__hostClockOffsetMs = () => [5000000, 90000, 90000][n++ % 3]; });
  r = await measure();
  expect('whichever probe it is', r.ok && near(r.offsetMs, 90000), r);

  // A failed write keeps the last offset, and says so.
  await host(90000);
  await p.evaluate(() => FP.clock.refresh());
  const before = await p.evaluate(() => FP.clock.state());
  await p.evaluate(() => { window.__flaky = 1; });
  r = await measure();
  expect('a failed write is not ok, with a reason', r.ok === false && /probe|slow|unreachable/i.test(r.reason || ''), r);
  s = await p.evaluate(() => FP.clock.refresh());
  await p.evaluate(() => { window.__flaky = 0; });
  expect('refresh keeps the last good offset and says it is stale', s.stale === true && s.offsetMs === before.offsetMs && s.appliedMs === before.appliedMs && near(s.offsetMs, 90000) && s.measuredAt === before.measuredAt && s.reason, s);
  s = await p.evaluate(() => FP.clock.refresh());
  expect('the next good measurement clears it', s.stale === false && near(s.offsetMs, 90000), s);

  // Never throws: no folder, a folder that throws, a broken terminal ID.
  const odd = await p.evaluate(async () => {
    const out = {};
    const dir = FP.folder.dir, handle = FP.folder.handle, id = FP.identity.terminalId;
    try { FP.folder.dir = async () => { throw new Error('the share is gone'); }; out.dirThrows = await FP.clock.measure(); } catch (e) { out.dirThrows = 'THREW ' + e.message; }
    FP.folder.dir = dir;
    try { FP.folder.handle = null; out.noFolder = await FP.clock.measure(); } catch (e) { out.noFolder = 'THREW ' + e.message; }
    FP.folder.handle = handle;
    try { FP.identity.terminalId = null; out.noId = await FP.clock.measure(); } catch (e) { out.noId = 'THREW ' + e.message; }
    FP.identity.terminalId = id;
    try { FP.folder.dir = async () => ({ getFileHandle: async () => { throw 'a plain string'; } }); out.odd = await FP.clock.measure(); } catch (e) { out.odd = 'THREW ' + e; }
    FP.folder.dir = dir;
    return out;
  });
  for (const k of Object.keys(odd)) expect(`measure() resolves ok:false for ${k}`, odd[k] && odd[k].ok === false && typeof odd[k].reason === 'string', odd[k]);

  // A probe that takes over 2 s is thrown away.
  await host(0);
  await p.evaluate(() => { window.__latency = 4500; });
  r = await measure();
  await p.evaluate(() => { window.__latency = 0; });
  expect('probes slower than 2 s are discarded', r.ok === false, r);

  // The terminals' own result files and the probe files do not mix.
  const names = await p.evaluate(() => FP.files.list(['_clock']));
  expect('_clock holds the probe and the result', names.some(n => /\.probe\.json$/.test(n)) && names.some(n => /^EDITOR-.*\.json$/.test(n) && !/probe/.test(n)), names);
  const terms = await p.evaluate(() => FP.clock.terminals());
  expect('terminals() reads results, not probes', terms.length === 1 && terms[0].terminalId.startsWith('EDITOR-'), terms);

  await A.b.close();
  errs.forEach(x => bad.push('page: ' + x));
  console.log('errs      :', JSON.stringify(bad));
  if (bad.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
