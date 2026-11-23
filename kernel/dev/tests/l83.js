// 0.53.2 A folder that syncs (OneDrive): files go stale after getFile and are sometimes busy for a write.
// Reads and writes try again; the year write carries on after a stop; a gap before the live window is carried over.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('console', m => { if (m.text().startsWith('STRESS ')) console.log(m.text().slice(7)); });
  await w(1200);
  await p.evaluate(() => FP.files.writeText([], FP.folder.TEST_MARK, 'test'));

  // 1. Straight at the files, with a quarter of reads stale and a quarter of writes busy.
  const direct = await p.evaluate(async () => {
    window.__flaky = 0.25; window.__staleHits = 0;
    const out = {};
    const files = ['A', 'B', 'C'];
    await Promise.all(Array.from({ length: 240 }, (_, i) => FP.files.appendLine(['zz-flaky', '2026-11-18'], files[i % 3] + '.jsonl', { i }, { chain: true })));
    out.lines = [];
    for (const f of files) {
      const text = await FP.files.readText(['zz-flaky', '2026-11-18'], f + '.jsonl');
      const ch = await FP.files.verifyChain(text);
      out.lines.push(`${f} ${ch.lines} lines, ${ch.broken.length} broken`);
    }
    let ok = 0;
    for (let i = 0; i < 40; i++) { await FP.files.writeJson(['zz-flaky'], 'j.json', { i }); const r = await FP.files.readJson(['zz-flaky'], 'j.json'); if (r && r.i === i) ok++; }
    out.json = `${ok} of 40 written and read back`;
    const name = await FP.files.writeJsonGz(['zz-flaky'], 'big.json', { n: 12345 });
    let gz = 0; for (let i = 0; i < 20; i++) { const r = await FP.files.readJsonAny(['zz-flaky'], name); if (r && r.n === 12345) gz++; }
    out.gz = `${gz} of 20 compressed reads`;
    const lr = await FP.files.readLines(['zz-flaky', '2026-11-18'], 'A.jsonl');
    out.readLines = `${lr.records.length} records, ${lr.bad} bad`;
    out.stale = window.__staleHits; out.io = FP.files.io;
    return out;
  });
  say('appends', direct.lines.join(' · '));
  say('json', direct.json); say('gz', direct.gz); say('readLines', direct.readLines);
  say('stale', `${direct.stale} stale or busy, ${direct.io.retries} tried again`);

  // 2. The stress tests that failed on OneDrive, on the flaky folder.
  const run = async (suites, only, extra) => p.evaluate(async ([suites, only, extra]) => {
    window.__bench = window.__bench || document.body.appendChild(document.createElement('div'));
    const log = [];
    await FP.stress.run(Object.assign({ suites, only, bench: window.__bench, onDone: (t, r) => log.push(`${t.suite}/${t.id} ${/^Stopped after/.test(r.detail) ? 'stopped as asked' : r.result}: ${String(r.detail).slice(0, 700)} [${r.io}]`) }, extra || {}));
    return log;
  }, [suites, only, extra || null]);
  for (const l of await run(['orphans', 'definitions'], ['orphans/missing-item', 'definitions/broken'])) say('flaky', l);

  // 3. A short year (150 days from 2026-06-21), stopped after 40 days (to the end of July), then carried on with 0 more:
  //    the data ends in July, so the live window (from September) has an empty August before it.
  await p.evaluate(() => { window.__flaky = 0.1; });
  for (const l of await run(['volume'], ['volume/write'], { days: 150, stopAfter: 25 })) say('write 1', l);
  for (const l of await run(['volume'], ['volume/write'], { days: 150, stopAfter: 15 })) say('write 2', l);
  const lines = await p.evaluate(async () => { const v = await FP.current.verifyFiles('zz-stress-runs'), r = await FP.current.verifyFiles('zz-stress-racks'); return `runs ${v.files} files ${v.lines} lines ${v.broken.length} broken · racks ${r.files} files ${r.lines} lines ${r.broken.length} broken`; });
  say('40 days', `${lines} (should be 40 × 306 = 12240 and 40 × 72 = 2880, none broken)`);
  await p.evaluate(() => { window.__flaky = 0; });
  for (const l of await run(['volume'], ['volume/load', 'volume/checkpoints'], { days: 40 })) say('volume', l);
  // 4. Publishing changes the library in place; another terminal's stamp meanwhile makes it read everything.
  const pubs = await p.evaluate(async () => {
    const io = () => FP.files.io.reads + FP.files.io.lists;
    const pub = (id, n) => { const cur = FP.defs.get('form', id); return FP.defs.publish('form', id, { title: 'Quick ' + n, sites: ['all'], sources: [], fields: [{ name: 'a', control: 'number', label: 'A' }] }, { basedOn: cur ? cur.version : null }); };
    await FP.defs.load();
    let a = io(); await FP.defs.load(); const full = io() - a;
    a = io(); await pub('zz-quick', 1); const one = io() - a;
    const r1 = FP.defs.report();
    // Another terminal publishes (its file and its change stamp) just before this one does.
    const other = { fp: 'definition', v: 1, kind: 'form', id: 'zz-other', version: 1, basedOn: null, trial: false, uses: {}, publishedAt: new Date().toISOString(), publishedBy: null, terminalId: 'T77', note: '', retired: false, def: { title: 'Other', sites: ['all'], sources: [], fields: [{ name: 'b', control: 'number', label: 'B' }] } };
    await FP.files.writeJson(['library', 'form', 'zz-other'], '0001-T77.json', other);
    await FP.files.writeJson(['library', '_changes'], 'T77.json', { at: other.publishedAt, kind: 'form', id: 'zz-other', version: 1 });
    await pub('zz-quick', 2);
    const r2 = FP.defs.report();
    return `a whole library read: ${full} reads and lists; a publish: ${one} (quick ${r1.quick}); after another terminal's: zz-other ${FP.defs.get('form', 'zz-other') ? 'seen' : 'not seen'} (quick ${r2.quick}), zz-quick v${FP.defs.get('form', 'zz-quick').version}`;
  });
  say('publish', pubs);
  say('errs', JSON.stringify(errs).slice(0, 600));
  await b.close();
})();
