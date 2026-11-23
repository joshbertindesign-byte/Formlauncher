// 0.63 Updating a folder that runs 0.60.0: the committed 0.60.0 release zip is installed, then this kernel's zip over it
// (what an admin does in Admin > Updates). The switch moves to the new release, the old one is kept to fall back on, the
// entry format is unchanged so nothing already saved needs converting, and the pages still load.
const start = require('./dummies/base.js');
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const OLD = path.join(ROOT, '../Forms b/runtime/0.60.0/kernel-0.60.0.zip');
(async () => {
  if (!fs.existsSync(OLD)) { console.log('skipped: the 0.60.0 release zip is not in this checkout'); console.log('errs      : []'); return; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-l151-'));
  const NEW = cp.execFileSync('python3', [path.join(ROOT, 'dev/tools/release.py'), ROOT, tmp], { encoding: 'utf8' }).trim().split('\n').pop();
  const verOf = z => /kernel-(\d+\.\d+\.\d+)\.zip/.exec(path.basename(z))[1];
  const A = await start({ at: '2026-11-19T08:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  const bad = [];
  const put = async zip => A.p.evaluate(async ([b64, name]) => {
    await FP.files.writeText(['updates'], name, new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))]));
    const r = await FP.updates.install(name);
    const t = await FP.files.readText(['runtime'], 'releases.js');
    const cfg = JSON.parse(/window\.FP_RELEASES = (\{[\s\S]*\});/.exec(t)[1]);
    return { r, current: cfg.current, kept: cfg.kept, dirs: await FP.files.listDirs(['runtime']), left: await FP.files.list(['updates']) };
  }, [fs.readFileSync(zip).toString('base64'), path.basename(zip)]);
  const a = await put(OLD);
  A.say('0.60.0 installed', JSON.stringify({ current: a.current, kept: a.kept }));
  const b = await put(NEW);
  A.say('then new     ', JSON.stringify({ current: b.current, kept: b.kept, dirs: b.dirs, from: b.r.from, updatesLeft: b.left }));
  if (a.current !== '0.60.0') bad.push('first install is not 0.60.0');
  if (b.current !== verOf(NEW) || b.r.from !== '0.60.0') bad.push('the switch did not move to the new release');
  if (!b.kept.includes('0.60.0') || !b.dirs.includes('0.60.0')) bad.push('0.60.0 is not kept to fall back on');
  if (b.left.length) bad.push('the zip was left in updates/');
  // The entry format is the same, so entries written by 0.60.0 read as they are.
  const entry = z => JSON.parse(cp.execFileSync('python3', ['-c', 'import zipfile,sys;print(zipfile.ZipFile(sys.argv[1]).read("release.json").decode())', z], { encoding: 'utf8' })).data.entry;
  A.say('entry format', `0.60.0: ${entry(OLD)} · new: ${entry(NEW)}`);
  if (entry(OLD) !== entry(NEW)) bad.push('the entry format changed: saved data would need converting');
  A.say('errs', JSON.stringify(bad.concat(A.errs)));
  await A.b.close();
  if (bad.length || A.errs.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
