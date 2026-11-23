// Build the end-user package: the folder that goes on SharePoint, made by the platform's own installer.
//
//   node dev/tools/build-package.js <out dir>
//
// 1. release.py makes kernel-<version>.zip from this kernel/ folder (and refuses code that could run from data).
// 2. A headless browser opens the editor on an empty in-memory data folder, signs in as a test admin, puts the zip
//    in updates/ and runs the real FP.updates.install on it: exactly what an admin does in Admin > Updates.
// 3. What the installer wrote (launch.html and runtime/) is saved to <out dir>/<version>/, with no data in it and no
//    person's name in releases.js, plus <out dir>/kernel-<version>.zip and <out dir>/FormPlatform-<version>.zip.
// 4. The saved launch.html is opened from disk (file://) to check the loader finds and runs the release.
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '../..');
const start = require(path.join(ROOT, 'dev/tests/dummies/base.js'));

(async () => {
  const outDir = path.resolve(process.argv[2] || path.join(ROOT, '..', 'dist'));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-package-'));
  const zipPath = cp.execFileSync('python3', [path.join(ROOT, 'dev/tools/release.py'), ROOT, tmp], { encoding: 'utf8' }).trim().split('\n').pop();
  const zipName = path.basename(zipPath);
  const version = /kernel-(\d+\.\d+\.\d+)\.zip/.exec(zipName)[1];
  console.log('release', zipName);

  const T = await start();   // empty in-memory data folder, a test terminal and an admin signed in
  const { p, b, errs } = T;
  const b64 = fs.readFileSync(zipPath).toString('base64');
  const done = await p.evaluate(async ([data, name]) => {
    const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
    await FP.files.writeText(['updates'], name, new Blob([bytes]));
    return FP.updates.install(name);
  }, [b64, zipName]);
  console.log('installed', JSON.stringify(done));

  // Read back what the installer wrote: launch.html at the top and everything under runtime/, as bytes.
  const files = await p.evaluate(async () => {
    const out = {};
    const enc = buf => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
    const walk = async (dir, prefix) => { for await (const [n, h] of dir.entries()) { if (h.kind === 'file') out[prefix + n] = enc(await (await h.getFile()).arrayBuffer()); else await walk(h, prefix + n + '/'); } };
    const root = window.__root;
    out['launch.html'] = enc(await (await (await root.getFileHandle('launch.html')).getFile()).arrayBuffer());
    await walk(await root.getDirectoryHandle('runtime'), 'runtime/');
    return out;
  });
  await b.close();
  if (errs.length) console.log('page errors during install:', errs);

  const pkg = path.join(outDir, version);
  fs.rmSync(pkg, { recursive: true, force: true });
  for (const [rel, data] of Object.entries(files)) {
    const dest = path.join(pkg, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(data, 'base64'));
  }
  // Nobody's name in the switch file: it records who installed, and this was installed by a build script.
  const rel = path.join(pkg, 'runtime/releases.js');
  const cfg = JSON.parse(/window\.FP_RELEASES = (\{[\s\S]*\});/.exec(fs.readFileSync(rel, 'utf8'))[1]);
  cfg.by = null; cfg.from = null;
  fs.writeFileSync(rel, "/* Which release of the platform runs, written by the installer. Don't edit: use Updates in the editor. */\nwindow.FP_RELEASES = " + JSON.stringify(cfg) + ";\n");
  fs.copyFileSync(path.join(ROOT, 'dev/tools/PACKAGE-README.txt'), path.join(pkg, 'READ ME FIRST.txt'));
  fs.copyFileSync(zipPath, path.join(outDir, zipName));

  // The same folder as one zip, for a first install (folders and files in the order a person would expect).
  const folderZip = path.join(outDir, `FormPlatform-${version}.zip`);
  fs.rmSync(folderZip, { force: true });
  cp.execFileSync('python3', ['-c', `
import sys, os, zipfile
src, dst = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
    for base, dirs, names in os.walk(src):
        dirs.sort()
        for n in sorted(names):
            full = os.path.join(base, n)
            info = zipfile.ZipInfo.from_file(full, os.path.join('FormPlatform-' + os.path.basename(src), os.path.relpath(full, src)))
            info.date_time = (2026, 1, 1, 0, 0, 0)
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, open(full, 'rb').read())
`, pkg, folderZip]);

  // Open the saved launch.html straight from disk: the loader must find the release and run it.
  const { chromium } = require('playwright');
  const b2 = await chromium.launch(); const p2 = await b2.newPage();
  const page = []; p2.on('pageerror', e => page.push(e.message));
  await p2.goto('file://' + path.join(pkg, 'launch.html')); await p2.waitForTimeout(2500);
  const check = await p2.evaluate(() => ({ version: window.FP && FP.version, boot: window.FP_BOOT && FP.version && window.FP_BOOT.version, banner: (document.getElementById('fp-problems') || {}).textContent || null, text: document.body.innerText.slice(0, 120) }));
  await b2.close();
  console.log('opened from disk:', JSON.stringify(check));
  if (check.banner || check.version !== version || page.length) { console.error('PACKAGE CHECK FAILED', check, page); process.exit(1); }
  const n = Object.keys(files).length;
  console.log(`OK: ${path.relative(process.cwd(), pkg)} (${n} files), ${zipName}, FormPlatform-${version}.zip`);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
