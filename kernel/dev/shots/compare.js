// Compare two sets of screenshots: node dev/shots/compare.js <baselineDir> <newDir> [maxPercent]
// For each PNG in the baseline, counts the pixels that differ (any colour channel by more than 12 of 255) and fails above maxPercent
// of the screen (default 0.3). A red-highlighted image of the changes is written to <newDir>/diff-<name>.png. Uses the browser's own
// canvas, so it needs no libraries.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const [baseDir, newDir, maxArg] = [path.resolve(process.argv[2] || ''), path.resolve(process.argv[3] || ''), process.argv[4]];
const MAX = maxArg != null ? Number(maxArg) : 0.3;
if (!process.argv[3]) { console.error('usage: compare.js <baselineDir> <newDir> [maxPercent]'); process.exit(2); }
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  let bad = 0;
  const names = fs.readdirSync(baseDir).filter(f => f.endsWith('.png') && !f.startsWith('diff-')).sort();
  for (const n of names) {
    const a = path.join(baseDir, n), c = path.join(newDir, n);
    if (!fs.existsSync(c)) { console.log(`MISSING  ${n}`); bad++; continue; }
    const r = await p.evaluate(async ([A, C]) => {
      const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
      const [ia, ic] = await Promise.all([load(A), load(C)]);
      if (ia.width !== ic.width || ia.height !== ic.height) return { size: `${ia.width}x${ia.height} vs ${ic.width}x${ic.height}` };
      const data = i => { const cv = document.createElement('canvas'); cv.width = i.width; cv.height = i.height; const x = cv.getContext('2d'); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height); };
      const da = data(ia), dc = data(ic), out = new ImageData(ia.width, ia.height);
      let diff = 0;
      for (let k = 0; k < da.data.length; k += 4) {
        const d = Math.max(Math.abs(da.data[k] - dc.data[k]), Math.abs(da.data[k + 1] - dc.data[k + 1]), Math.abs(da.data[k + 2] - dc.data[k + 2]));
        if (d > 12) { diff++; out.data[k] = 255; out.data[k + 1] = 0; out.data[k + 2] = 0; out.data[k + 3] = 255; }
        else { out.data[k] = out.data[k + 1] = out.data[k + 2] = 255 - Math.round((255 - (da.data[k] + da.data[k + 1] + da.data[k + 2]) / 3) * 0.25); out.data[k + 3] = 255; }
      }
      const cv = document.createElement('canvas'); cv.width = ia.width; cv.height = ia.height; cv.getContext('2d').putImageData(out, 0, 0);
      return { pct: 100 * diff / (da.data.length / 4), diff, png: diff ? cv.toDataURL('image/png') : null };
    }, ['data:image/png;base64,' + fs.readFileSync(a).toString('base64'), 'data:image/png;base64,' + fs.readFileSync(c).toString('base64')]);
    if (r.size) { console.log(`SIZE     ${n.padEnd(26)} ${r.size}`); bad++; continue; }
    const ok = r.pct <= MAX;
    if (r.png) fs.writeFileSync(path.join(newDir, `diff-${n}`), Buffer.from(r.png.split(',')[1], 'base64'));
    console.log(`${ok ? 'same    ' : 'CHANGED '} ${n.padEnd(26)} ${r.pct.toFixed(3)}% (${r.diff} px)`);
    if (!ok) bad++;
  }
  await b.close();
  console.log(bad ? `${bad} screen(s) changed beyond ${MAX}%` : `all ${names.length} screens match the baseline (within ${MAX}%)`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
