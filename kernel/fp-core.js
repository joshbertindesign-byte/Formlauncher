/* Form Platform kernel: core (steps 1–7)
 * Namespace, a small IndexedDB key-value store, data-folder access,
 * and JSON Lines append/read.
 *
 * Classic script on purpose: Edge and Chrome block ES modules
 * (<script type="module">) on pages opened from file://.
 */
(function () {
  'use strict';

  const FP = (window.FP = window.FP || {});
  FP.version = '0.62.0';

  /* ---------- Locks ----------
   * Web Locks serialize across every tab on the device. Where they are missing,
   * fall back to an in-page queue so at least this page never races itself.
   */
  const localChains = new Map();
  FP.lock = function (name, fn) {
    if (navigator.locks && navigator.locks.request) return navigator.locks.request(name, fn);
    const prev = localChains.get(name) || Promise.resolve();
    const run = prev.then(() => fn(), () => fn());
    localChains.set(name, run.catch(() => {}));
    return run;
  };
  FP.lock.crossTab = !!(navigator.locks && navigator.locks.request);

  /* ---------- IndexedDB on this device ----------
   * kv:     small settings (data-folder handle, terminal ID, open contexts).
   * outbox: events saved on this device but not yet written to the data folder.
   * Both survive reloads and browser restarts.
   */
  const DB_NAME = 'fp-kernel';
  const DB_VERSION = 2;
  /* A simulated terminal (0.52.1): launch.html?terminal=T02 runs this page as terminal T02, for trying several
   * terminals from one computer. It has its own terminal ID, site, sign-ins and settings (kept under its own keys)
   * and its own outbox (its own local database), so it writes its own files like a real terminal. The startup gate
   * allows it only on a data folder marked as a test folder. */
  const SIM = (() => {
    try {
      if (window.FP_PAGE && window.FP_PAGE !== 'launcher') return null;
      const v = new URLSearchParams(location.search).get('terminal');
      return v && /^[A-Za-z0-9][A-Za-z0-9-]{0,15}$/.test(v) && !/^editor/i.test(v) ? v.toUpperCase() : null;
    } catch (_) { return null; }
  })();
  FP.simulated = SIM;

  function openDb(name) {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(name || DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { autoIncrement: true });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Close other tabs of this app once to finish updating local storage, then reload.'));
    });
  }

  /* Run fn(objectStore) in one transaction; resolves with fn's result once the
   * transaction commits (a request's .result, or a plain value). */
  async function withStore(store, mode, fn) {
    const db = await openDb(SIM && store === 'outbox' ? `${DB_NAME}~${SIM}` : DB_NAME);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const out = fn(tx.objectStore(store));
      tx.oncomplete = () => { db.close(); resolve(out instanceof IDBRequest ? out.result : out); };
      tx.onerror = () => { db.close(); reject(tx.error); };
      tx.onabort = () => { db.close(); reject(tx.error || new Error('Local storage transaction aborted')); };
    });
  }

  FP.kv = {
    get: key => withStore('kv', 'readonly', s => s.get(key)),
    set: (key, value) => withStore('kv', 'readwrite', s => s.put(value, key)),
    del: key => withStore('kv', 'readwrite', s => s.delete(key)),
  };
  // A simulated terminal keeps its own keys; the data folder is the computer's.
  if (SIM) {
    const base = FP.kv, own = key => (key === 'dataFolder' ? key : `sim:${SIM}:${key}`);
    FP.kv = { get: key => base.get(own(key)), set: (key, v) => base.set(own(key), v), del: key => base.del(own(key)) };
  }

  /* Raw outbox storage; the writer in fp-event.js decides when to flush. */
  FP.outboxStore = {
    /* Adds all items in one transaction: all are saved or none are. */
    addMany: items => withStore('outbox', 'readwrite', s => { items.forEach(i => s.add(i)); return items.length; }),
    /* [{ key, value }] in the order they were added. */
    all: () => withStore('outbox', 'readonly', s => {
      const rows = [];
      s.openCursor().onsuccess = e => { const c = e.target.result; if (c) { rows.push({ key: c.key, value: c.value }); c.continue(); } };
      return rows;
    }),
    remove: keys => withStore('outbox', 'readwrite', s => { keys.forEach(k => s.delete(k)); return keys.length; }),
    count: () => withStore('outbox', 'readonly', s => s.count()),
  };

  /* ---------- Data folder access ----------
   * The user picks the data folder once (a OneDrive-synced folder today,
   * possibly a mapped drive later). The handle is stored in IndexedDB.
   * connect() and reauthorize() must be called from a click or tap.
   */
  FP.folder = {
    supported: typeof window.showDirectoryPicker === 'function',
    handle: null,

    async connect() {
      const h = await window.showDirectoryPicker({ id: 'fp-data', mode: 'readwrite' });
      await FP.kv.set('dataFolder', h);
      FP.folder.handle = h;
      return h;
    },

    /* Returns 'none' | 'granted' | 'prompt' | 'denied' without prompting. */
    async restore() {
      const h = await FP.kv.get('dataFolder');
      if (!h) return 'none';
      FP.folder.handle = h;
      return h.queryPermission({ mode: 'readwrite' });
    },

    async reauthorize() {
      if (!FP.folder.handle) throw new Error('No data folder connected yet.');
      return FP.folder.handle.requestPermission({ mode: 'readwrite' });
    },

    async forget() {
      await FP.kv.del('dataFolder');
      FP.folder.handle = null;
    },

    /* A copy of the data for trying things out: a file of this name at the top of the folder (0.44.5). */
    TEST_MARK: 'THIS IS A TEST FOLDER.txt',
    async isTest() {
      if (!FP.folder.handle) return false;
      try { await FP.folder.handle.getFileHandle(FP.folder.TEST_MARK); return true; } catch (_) { return false; }
    },

    /* Walk (and optionally create) subfolders, e.g. ['data', 'qc-line', '2026-11-10']. */
    async dir(parts, create) {
      if (!FP.folder.handle) throw new Error('No data folder connected.');
      let d = FP.folder.handle;
      for (const part of parts) d = await d.getDirectoryHandle(part, { create: !!create });
      return d;
    },
  };

  /* ---------- JSON Lines files ----------
   * One record per line. Appends never rewrite earlier lines in place,
   * and a half-written last line (crash, sync mid-upload) is skipped on read.
   */
  /* Serialize writes to one file across every tab and launcher on this device.
   * Two pages writing the same file at once would otherwise each copy the
   * file, append, and commit, and the second commit would drop the first line.
   * (Across devices, unique terminal IDs already guarantee one writer per file.)
   */
  function withFileLock(parts, fileName, fn) {
    return FP.lock('fp-file:' + parts.concat(fileName).join('/'), fn);
  }

  /* A synced folder (OneDrive) touches files after they are written: a File read from disk goes stale
   * ("state cached in an interface object… changed since it was read") and a write can find the file busy.
   * Those are passing states, so a read or write is tried again from the start, up to 8 times over about 12 s (0.53.2). */
  const PASSING = new Set(['InvalidStateError', 'NotReadableError', 'NoModificationAllowedError']);
  /* What the folder has cost this page: operations, and the time spent waiting on them (summed; reads at once overlap). */
  const io = { reads: 0, writes: 0, lists: 0, retries: 0, readMs: 0, writeMs: 0, listMs: 0 };
  async function again(fn) {
    for (let i = 0; ; i++) {
      try { return await fn(); }
      catch (err) {
        if (!err || !PASSING.has(err.name) || i >= 7) throw err;
        io.retries++;
        await new Promise(r => setTimeout(r, Math.min(3000, 100 * (i + 1) * (i + 1)) * (0.75 + Math.random() / 2)));
      }
    }
  }

  async function commit(fh, keepExisting, writeFn) {
    // Writes go to a temporary swap file; the real file only changes on close().
    const t0 = performance.now();
    io.writes++;
    try {
      const w = await fh.createWritable({ keepExistingData: keepExisting });
      try {
        await writeFn(w);
        await w.close();
      } catch (err) {
        try { await w.abort(); } catch (_) { /* already closed */ }
        throw err;
      }
    } finally { io.writeMs += performance.now() - t0; }
  }

  /* Appends that arrive while a file is busy are batched into the next commit,
   * so a burst costs one or two file copies instead of one per record. */
  const queues = new Map();

  /* Chained lines (0.49): a line can carry prev, the hash of the line before it in its file ("start" for the
   * first), so a line changed or taken out afterwards shows: the next line's prev no longer matches. */
  async function chainHash(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf).slice(0, 16), b => b.toString(16).padStart(2, '0')).join('');
  }
  async function lastLineOf(file) {
    const size = file.size;
    if (!size) return null;
    const tail = await file.slice(Math.max(0, size - 262144)).text();
    const lines = tail.split('\n').filter(l => l.trim());
    return lines.length ? lines[lines.length - 1] : null;
  }
  /* Check a file's chain: { lines, chained, broken: [line numbers whose prev doesn't match the line before] }. */
  async function verifyChain(text) {
    const lines = String(text || '').split('\n').filter(l => l.trim());
    const out = { lines: lines.length, chained: 0, broken: [] };
    let before = null;
    for (let i = 0; i < lines.length; i++) {
      let o = null;
      try { o = JSON.parse(lines[i]); } catch (_) { o = null; }
      if (o && typeof o.prev === 'string') {
        out.chained++;
        const want = before == null ? 'start' : await chainHash(before);
        if (o.prev !== want) out.broken.push(i + 1);
      }
      before = lines[i];
    }
    return out;
  }

  async function flush(key, q) {
    q.running = true;
    try {
      while (q.items.length) {
        const batch = q.items.splice(0);
        try {
          await withFileLock(q.parts, q.fileName, () => again(async () => {
            const d = await FP.folder.dir(q.parts, true);
            const fh = await d.getFileHandle(q.fileName, { create: true });
            const file = await fh.getFile();
            const size = file.size;
            // Chained lines take the hash of the line before them, worked out under the lock.
            let last = batch.some(b => b.chain) ? await lastLineOf(file) : null;
            const text = [];
            for (const b of batch) {
              const line = b.chain ? JSON.stringify(Object.assign({}, b.obj, { prev: last == null ? 'start' : await chainHash(last) })) : b.line;
              text.push(line + '\n');
              last = line;
            }
            await commit(fh, true, async w => {
              await w.seek(size);
              await w.write(text.join(''));
            });
          }));
          batch.forEach(b => b.resolve());
        } catch (err) {
          batch.forEach(b => b.reject(err));
        }
      }
    } finally {
      q.running = false;
      queues.delete(key);
    }
  }

  /* Small DOM helpers every page uses (0.50): one copy here instead of one per module. */
  FP.dom = {
    el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; },
  };

  FP.files = {
    again,
    io,
    chainHash,
    verifyChain,
    // opts.chain (0.49): the line carries prev, the hash of the line before it in the file.
    appendLine(parts, fileName, obj, opts) {
      const key = parts.concat(fileName).join('/');
      let q = queues.get(key);
      if (!q) { q = { parts: parts.slice(), fileName, items: [], running: false }; queues.set(key, q); }
      const chain = !!(opts && opts.chain);
      return new Promise((resolve, reject) => {
        q.items.push({ line: chain ? null : JSON.stringify(obj), obj: chain ? obj : null, chain, resolve, reject });
        if (!q.running) flush(key, q);
      });
    },

    /* Replace a whole JSON file (registry entries, definitions, checkpoints).
     * compact: no indentation, for big machine-read files like checkpoints. */
    async writeJson(parts, fileName, obj, compact) {
      return withFileLock(parts, fileName, async () => {
        const d = await FP.folder.dir(parts, true);
        const fh = await d.getFileHandle(fileName, { create: true });
        await again(() => commit(fh, false, w => w.write(compact ? JSON.stringify(obj) : JSON.stringify(obj, null, 2))));
      });
    },

    /* Replace a whole text file (a launcher page, a copied runtime file). */
    async writeText(parts, fileName, text) {
      return withFileLock(parts, fileName, async () => {
        const d = await FP.folder.dir(parts, true);
        const fh = await d.getFileHandle(fileName, { create: true });
        await again(() => commit(fh, false, w => w.write(text)));
      });
    },

    /* Read a whole text file. Missing = null. */
    async readText(parts, fileName) {
      try {
        const d = await FP.folder.dir(parts, false);
        const fh = await d.getFileHandle(fileName);
        return await again(async () => (await fh.getFile()).text());
      } catch (err) {
        if (err && err.name === 'NotFoundError') return null;
        throw err;
      }
    },

    /* Read a whole JSON file. Missing or unreadable = null. */
    async readJson(parts, fileName) {
      try {
        const d = await FP.folder.dir(parts, false);
        const fh = await d.getFileHandle(fileName);
        return JSON.parse(await again(async () => (await fh.getFile()).text()));
      } catch (err) {
        if (err && (err.name === 'NotFoundError' || err instanceof SyntaxError)) return null;
        throw err;
      }
    },

    /* Returns { records, bad } — bad = lines that failed to parse. Missing file = empty. */
    async readLines(parts, fileName) {
      let fh;
      try {
        const d = await FP.folder.dir(parts, false);
        fh = await d.getFileHandle(fileName);
      } catch (err) {
        if (err && err.name === 'NotFoundError') return { records: [], bad: 0 };
        throw err;
      }
      const text = await again(async () => (await fh.getFile()).text());
      const records = [];
      let bad = 0;
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try { records.push(JSON.parse(line)); } catch (_) { bad++; }
      }
      return { records, bad };
    },

    /* Delete a file; missing = false. */
    async remove(parts, fileName) {
      try {
        const d = await FP.folder.dir(parts, false);
        await d.removeEntry(fileName);
        return true;
      } catch (err) {
        if (err && err.name === 'NotFoundError') return false;
        throw err;
      }
    },

    /* File names in a folder; missing folder = empty list. */
    async list(parts) {
      let d;
      try { d = await FP.folder.dir(parts, false); }
      catch (err) {
        if (err && err.name === 'NotFoundError') return [];
        throw err;
      }
      const names = [];
      for await (const [name, h] of d.entries()) if (h.kind === 'file') names.push(name);
      return names.sort();
    },

    /* Subfolder names; missing folder = empty list. */
    async listDirs(parts) {
      let d;
      try { d = await FP.folder.dir(parts, false); }
      catch (err) {
        if (err && err.name === 'NotFoundError') return [];
        throw err;
      }
      const names = [];
      for await (const [name, h] of d.entries()) if (h.kind === 'directory') names.push(name);
      return names.sort();
    },

    /* A file's size in bytes without reading it; missing file = null. */
    async size(parts, fileName) {
      try {
        const d = await FP.folder.dir(parts, false);
        const fh = await d.getFileHandle(fileName);
        return (await again(() => fh.getFile())).size;
      } catch (err) {
        if (err && err.name === 'NotFoundError') return null;
        throw err;
      }
    },

    /* Write a new binary file (a photo, a PDF). Refuses to replace an existing
     * file: stored media is never overwritten. */
    async writeBlob(parts, fileName, blob) {
      return withFileLock(parts, fileName, async () => {
        const d = await FP.folder.dir(parts, true);
        let exists = true;
        try { await d.getFileHandle(fileName); } catch (err) { if (err && err.name === 'NotFoundError') exists = false; else throw err; }
        if (exists) throw new Error(`${parts.concat(fileName).join('/')} already exists; stored files are never replaced.`);
        const fh = await d.getFileHandle(fileName, { create: true });
        await again(() => commit(fh, false, w => w.write(blob)));
      });
    },

    /* Write JSON compressed with the browser's built-in gzip (no library) as
     * `${baseName}.gz`; where gzip isn't available, plain compact JSON as baseName.
     * Returns the name written. For big files written once (closed months). */
    async writeJsonGz(parts, baseName, obj) {
      if (typeof CompressionStream !== 'function') { await FP.files.writeJson(parts, baseName, obj, true); return baseName; }
      const blob = await new Response(new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
      const name = baseName + '.gz';
      await withFileLock(parts, name, async () => {
        const d = await FP.folder.dir(parts, true);
        const fh = await d.getFileHandle(name, { create: true });
        await again(() => commit(fh, false, w => w.write(blob)));
      });
      return name;
    },

    /* Read JSON written by writeJson or writeJsonGz (.gz names are unzipped); missing or damaged = null. */
    async readJsonAny(parts, fileName) {
      if (!fileName.endsWith('.gz')) return FP.files.readJson(parts, fileName);
      // The File is fetched again on each try: a stale one fails mid-stream, and that isn't a damaged file.
      return again(async () => {
        const f = await FP.files.readFile(parts, fileName);
        if (!f) return null;
        try { return JSON.parse(await new Response(f.stream().pipeThrough(new DecompressionStream('gzip'))).text()); }
        catch (err) { if (err && PASSING.has(err.name)) throw err; return null; }
      });
    },

    /* A file as a File object (size and type without reading it all); missing = null. */
    async readFile(parts, fileName) {
      try {
        const d = await FP.folder.dir(parts, false);
        return await (await d.getFileHandle(fileName)).getFile();
      } catch (err) {
        if (err && err.name === 'NotFoundError') return null;
        throw err;
      }
    },

    /* A whole file as text; missing file = null. */
    async readText(parts, fileName) {
      try {
        const d = await FP.folder.dir(parts, false);
        const fh = await d.getFileHandle(fileName);
        return await again(async () => (await fh.getFile()).text());
      } catch (err) {
        if (err && err.name === 'NotFoundError') return null;
        throw err;
      }
    },
  };
  [['readText', 'reads'], ['readJson', 'reads'], ['readLines', 'reads'], ['readFile', 'reads'], ['size', 'reads'], ['list', 'lists'], ['listDirs', 'lists']].forEach(([k, kind]) => {
    const f = FP.files[k], ms = kind === 'reads' ? 'readMs' : 'listMs';
    FP.files[k] = async function (...a) { const t0 = performance.now(); io[kind]++; try { return await f.apply(this, a); } finally { io[ms] += performance.now() - t0; } };
  });

  /* ---------- Small helpers ---------- */
  FP.util = {
    localDate(d = new Date()) {
      const p = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    },
    env() {
      return {
        url: location.protocol,
        secureContext: window.isSecureContext,
        folderAccess: FP.folder.supported,
        userAgent: navigator.userAgent,
      };
    },
  };

  /* ---------- The test clock (0.62) ----------
   * On a test folder only: _test/clock.json { offsetMs } puts this page's clock ahead by that much, the same in every
   * tab and on every terminal using the folder, so a rehearsal jumps ahead instead of waiting (a miss, a level of the
   * ladder). Everything that reads the time (saves, due checks, NOW() in formulas) sees the test time; timers still run
   * in real time. A folder that isn't a test folder never reads the file, and the clock is the computer's. */
  const RealDate = Date;
  let offset = 0, checked = null, isTestNow = false;
  class TestDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + offset); }
    static now() { return RealDate.now() + offset; }
  }
  const CLOCK = ['_test'];
  function applyOffset(ms) {
    const was = offset;
    offset = Number.isFinite(ms) ? ms : 0;
    if (offset && window.Date !== TestDate) window.Date = TestDate;
    if (was !== offset) { try { window.dispatchEvent(new CustomEvent('fp-testclock', { detail: { offsetMs: offset, was } })); } catch (_) { /* no events */ } }
  }
  FP.testClock = {
    used: false,
    offset: () => offset,
    realNow: () => RealDate.now(),
    /* Read the folder's test clock (on a test folder). */
    async load() {
      if (!FP.folder.handle) return offset;
      if (checked !== FP.folder.handle) { checked = FP.folder.handle; isTestNow = await FP.folder.isTest().catch(() => false); }
      if (!isTestNow) { FP.testClock.used = false; applyOffset(0); return 0; }
      const j = await FP.files.readJson(CLOCK, 'clock.json').catch(() => null);
      FP.testClock.used = !!j;
      applyOffset(j && Number.isFinite(j.offsetMs) ? j.offsetMs : 0);
      return offset;
    },
    /* Set it (test folders only): ms ahead of the real time; 0 back to the real time. */
    async set(ms, by) {
      if (!(await FP.folder.isTest())) throw new Error('The test clock is only for a test folder (Admin › Test folder).');
      ms = Math.max(0, Math.round(ms || 0));
      await FP.files.writeJson(CLOCK, 'clock.json', { offsetMs: ms, setAt: new RealDate().toISOString(), by: by || null });
      FP.testClock.used = true; checked = null;
      applyOffset(ms);
      return ms;
    },
    jump: ms => FP.testClock.set(offset + ms),
    /* The offset in words: +2 h 15 min. */
    text(ms) { ms = ms == null ? offset : ms; const m = Math.round(ms / 60000); const h = Math.floor(m / 60); return m ? `+${h ? `${h} h` : ''}${h && m % 60 ? ' ' : ''}${m % 60 ? `${m % 60} min` : ''}` : 'real time'; },
  };
  // Every few seconds, so a jump made in one tab (or on another terminal) reaches this one.
  setInterval(() => { FP.testClock.load().catch(() => {}); }, 4000);

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-core'] = '0.62.0';
})();
