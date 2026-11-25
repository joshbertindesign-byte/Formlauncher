// In-page fake data folder + memory kv, so the page can run headless.
const { chromium } = require('playwright');
const FAKE = `
(() => {
  /* window.__flaky = 0.2: like a OneDrive folder, a fifth of reads find the file changed since getFile, and a fifth of writes find it busy. */
  window.__staleHits = 0;
  const flip = () => window.__flaky && Math.random() < window.__flaky && ++window.__staleHits;
  const gone = () => Object.assign(new Error('An operation that depends on state cached in an interface object was made but the state had changed since it was read from disk.'), { name: 'InvalidStateError' });
  const busy = () => Object.assign(new Error('The file is busy.'), { name: 'NoModificationAllowedError' });
  const stale = f => { const t = f.text.bind(f), sl = f.slice.bind(f), st = f.stream.bind(f);
    f.text = () => flip() ? Promise.reject(gone()) : t();
    f.slice = (...a) => { const part = sl(...a), pt = part.text.bind(part); part.text = () => flip() ? Promise.reject(gone()) : pt(); return part; };
    f.stream = () => { if (flip()) throw gone(); return st(); };
    return f; };
  /* window.__latency = 120: every read, write and folder listing waits about that long, like a synced folder over a slow disk. */
  const slow = f => window.__latency ? new Promise(r => setTimeout(r, window.__latency * (f || 1) * (0.5 + Math.random()))) : null;
  /* Files under _clock/ are stamped by the HOST's clock (the universal clock, 0.71): the page's underlying real clock (the one under the universal and
   * test offsets) plus window.__hostClockOffsetMs (a number, or a function returning one). Default 0, so the host agrees with this page. Other files: unchanged. */
  const hostNow = () => { const h = window.__hostClockOffsetMs; return (window.FP && window.FP.pageClock ? window.FP.pageClock.realNow() : Date.now()) + (typeof h === 'function' ? h() : (h || 0)); };
  const mkFile = (name, host) => { const stamp = () => host ? hostNow() : Date.now(); let data = new Blob([]), mtime = stamp(); return { kind: 'file', name,
    getFile: async () => { await slow(); const f = new File([data], name, { lastModified: mtime }); return window.__flaky ? stale(f) : f; },
    createWritable: async (o) => { await slow(); let buf = o && o.keepExistingData ? data : new Blob([]), pos = 0;
      return { seek: async p => { pos = p; }, write: async s => { const part = s instanceof Blob ? s : new Blob([s]); buf = new Blob([buf.slice(0, pos), part]); pos = buf.size; },
        close: async () => { if (flip()) throw busy(); data = buf; mtime = stamp(); }, abort: async () => {} }; } }; };
  /* d.dead = true: the folder was moved or renamed, so this stored handle no longer reaches anything (window.__newDir makes another folder). */
  const nf = () => Object.assign(new Error('nf'), { name: 'NotFoundError' });
  const mkDir = (name) => { const kids = new Map(); const d = { kind: 'directory', name, dead: false, prompt: false,
    queryPermission: async () => d.prompt ? 'prompt' : 'granted', requestPermission: async () => { if (d.dead) throw nf(); return 'granted'; },
    getDirectoryHandle: async (n, o) => { if (d.dead) throw nf(); await slow(0.2); if (!kids.has(n)) { if (!(o && o.create)) throw Object.assign(new Error('nf'), { name: 'NotFoundError' }); kids.set(n, mkDir(n)); } return kids.get(n); },
    getFileHandle: async (n, o) => { if (d.dead) throw nf(); if (!kids.has(n)) { if (!(o && o.create)) throw Object.assign(new Error('nf'), { name: 'NotFoundError' }); kids.set(n, mkFile(n, name === '_clock')); } return kids.get(n); },
    removeEntry: async n => { kids.delete(n); },
    entries: async function* () { if (d.dead) throw nf(); await slow(); for (const e of kids) yield e; } }; return d; };
  window.__root = mkDir('Fake data');
  window.__newDir = mkDir;
  window.__pick = null;   // the folder the picker hands out next; null = the root
  window.showDirectoryPicker = async () => window.__pick || window.__root;
  const mem = new Map();
  window.__memkv = { get: async k => mem.get(k), set: async (k, v) => { mem.set(k, v); }, del: async k => { mem.delete(k); } };
})();`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push('pageerror: ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 3).join('\n'))); p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
  await p.addInitScript(FAKE);
  const fs = require('fs'); await p.route('**/fp-core.js', async route => { const body = fs.readFileSync(require('path').resolve(__dirname, '../..') + '/fp-core.js', 'utf8').replace('FP.kv = {', 'FP.kv = window.__memkv || {'); await route.fulfill({ body, contentType: 'text/javascript' }); });
  await p.goto('file://' + require('path').resolve(__dirname, '../..') + '/kernel-test.html');
  await p.click('text=Choose data folder'); await p.waitForTimeout(300);
  await p.fill('.fp-gate-card input', 'T09'); await p.click('text=Save terminal ID'); await require('./site-step.js')(p); await p.waitForTimeout(500);
  console.log('gate still up:', await p.$('.fp-gate') !== null);
  console.log('log:', JSON.stringify((await p.textContent('#log')).slice(0, 300)));
  console.log('errors:', errs);
  await p.click('#write'); await p.waitForTimeout(300);
  await p.click('#sBegin'); await p.waitForTimeout(300);
  await p.click('#rBegin'); await p.waitForTimeout(300);
  await p.click('#rec'); await p.waitForTimeout(500);
  console.log('ctx:', await p.textContent('#ctx'));
  console.log('log lines:', (await p.textContent('#log')).split('\n').filter(l => l.startsWith('[')).slice(0, 8));
  console.log('errors:', errs);
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
