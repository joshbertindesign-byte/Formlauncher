/* fp-clock.js: the universal clock (0.71). The host's clock is the one every terminal follows.
 *
 * A terminal writes a small probe file into the shared folder (_clock/<terminal>.probe.json) and reads the file's
 * last-modified time back. On a shared Windows folder that time is set by the host, so (host time) minus (this PC's time
 * at the middle of the write) is this PC's offset. The page's clock is then moved by the offset (fp-core.js, the same
 * mechanism the test clock uses), so entries, due times, alerts and displays all read host time.
 *
 *   FP.clock.measure()         one measurement (median of three probes): { ok, offsetMs, rtMs, hostAt, measuredAt } or { ok: false, reason }
 *   FP.clock.refresh()         measure, apply, record this terminal's result, raise or close the admin alert
 *   FP.clock.state()           { enabled, offsetMs, ownVsHostMs, measuredAt, stale, appliedMs, ... }
 *   FP.clock.setEnabled(bool)  the folder's setting (admins only), kept in _clock/settings.json { enabled }
 *   FP.clock.warnNote()        { ownVsHostMs, appliedMs } while this PC's clock is more than a minute off, else null (entries carry it)
 *   FP.clock.terminals()       what every terminal last measured (_clock/<terminal>.json), for Admin
 *
 * Own vs host: ownVsHostMs is this PC's clock minus the host's (positive = this PC is fast). The offset applied is the opposite.
 * Limits: timestamps from a share can be a second or two coarse, so an offset within two seconds counts as none. A terminal
 * far from the host only gets a warning (recorded with its entries, and an alert for admins); saving is never blocked. A
 * test folder that is using the test clock keeps the test clock: nothing is applied there. */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.files || !FP.folder || !FP.pageClock) throw new Error('Load fp-core.js before fp-clock.js');

  const DIR = ['_clock'];
  const SETTINGS = 'settings.json';
  const GRAIN_MS = 2000;        // the share's granularity: an offset this small is none
  const MAX_RT_MS = 2000;       // a probe that took longer is thrown away
  const PROBES = 3;
  const WARN_MS = 60000;        // more than a minute from the host: a note on entries, and an alert
  const EVERY_MS = 5 * 60000;
  const MIN_GAP_MS = 20000;     // coming to the front measures again, but not more often than this

  const realNow = () => FP.pageClock.realNow();
  const st = { enabled: true, offsetMs: 0, ownVsHostMs: 0, measuredAt: null, stale: false, reason: null, rtMs: null, hostAt: null, measured: false };
  let busy = null, started = false, lastTry = 0, nonce = 0;

  const median = list => {
    const a = list.slice().sort((x, y) => x - y), n = a.length;
    return n % 2 ? a[(n - 1) / 2] : Math.round((a[n / 2 - 1] + a[n / 2]) / 2);
  };
  const terminalId = () => (FP.identity && FP.identity.terminalId) || null;

  /* One probe: write the file, read it back. Null when it failed or took too long. */
  async function probe(name) {
    try {
      const dir = await FP.folder.dir(DIR, true);
      const fh = await dir.getFileHandle(name, { create: true });
      const body = JSON.stringify({ terminalId: terminalId(), n: ++nonce, at: new Date(realNow()).toISOString() });
      const t0 = realNow();
      const w = await fh.createWritable();
      try { await w.write(body); await w.close(); } catch (e) { try { await w.abort(); } catch (_) { /* closed */ } throw e; }
      const t1 = realNow();
      const rt = t1 - t0;
      const f = await fh.getFile();
      const host = f.lastModified;
      if (!Number.isFinite(host) || rt > MAX_RT_MS) return null;
      return { offsetMs: host - (t0 + t1) / 2, rtMs: rt, host };
    } catch (_) { return null; }
  }

  /* Measure this PC against the host. Never throws. Does not change the page clock: refresh() does that. */
  async function measure() {
    try {
      const id = terminalId();
      if (!FP.folder.handle || !id) return { ok: false, reason: 'No data folder or terminal ID yet.' };
      const got = [];
      for (let i = 0; i < PROBES; i++) { const s = await probe(`${id}.probe.json`); if (s) got.push(s); }
      if (!got.length) return { ok: false, reason: 'The probe file could not be written and read back in time (the data folder is slow or unreachable).' };
      let off = median(got.map(s => s.offsetMs));
      if (Math.abs(off) <= GRAIN_MS) off = 0;
      return { ok: true, offsetMs: Math.round(off), rtMs: Math.round(median(got.map(s => s.rtMs))), hostAt: new Date(got[got.length - 1].host).toISOString(), measuredAt: new Date(realNow()).toISOString(), probes: got.length };
    } catch (e) { return { ok: false, reason: String((e && e.message) || e) }; }
  }

  /* The folder's setting; a missing or unreadable file means on. Keeps what it knew when the folder cannot be read. */
  async function loadSettings() {
    try {
      const j = await FP.files.readJson(DIR, SETTINGS);
      st.enabled = !(j && j.enabled === false);
    } catch (_) { /* keep what was known */ }
    return st.enabled;
  }

  /* Move the page clock, but only between entries: never while one is being made or saved. A change of two seconds or less
   * is not made (the share's granularity), so the clock does not shift for noise. */
  async function applyOffset(ms) {
    const target = FP.testClock && FP.testClock.used ? 0 : ms;
    for (let i = 0; i < 200 && FP.entry && FP.entry.inFlight && FP.entry.inFlight() > 0; i++) await new Promise(r => setTimeout(r, 25));
    const now = FP.pageClock.universal();
    if (target !== 0 && Math.abs(target - now) <= GRAIN_MS) return now;
    return FP.pageClock.setUniversal(target);
  }

  const labelOf = id => (FP.identity && FP.identity.label ? FP.identity.label(id) : id);
  const mins = ms => Math.max(1, Math.round(Math.abs(ms) / 60000));
  const off = () => st.enabled && st.measured && !(FP.testClock && FP.testClock.used) && Math.abs(st.ownVsHostMs) > WARN_MS;

  /* The admin alert: raised once for a terminal and episode, closed when its clock is back within a minute. */
  let alertWasOff = null;   // null until this page has looked once (an episode from an earlier run may still be open)
  async function syncAlert() {
    const id = terminalId();
    if (!id || !FP.alerts || !FP.alerts.openNotice) return;
    const now = off();
    if (now === alertWasOff) return;
    try {
      const series = `clock:${id}`;
      if (now) {
        const fast = st.ownVsHostMs > 0;
        await FP.alerts.openNotice({ kind: 'clock', series, where: labelOf(id), title: `${labelOf(id)}'s own clock is ${mins(st.ownVsHostMs)} min ${fast ? 'fast' : 'slow'}; host time is being used` });
      } else await FP.alerts.closeNotice(series, st.enabled ? 'clock is back within a minute' : 'the universal clock was turned off');
      alertWasOff = now;
    } catch (_) { /* the alert is best effort; the next measurement tries again */ }
  }

  /* Tell every terminal's table (Admin) what this one found. */
  async function record() {
    const id = terminalId();
    if (!id) return;
    try { await FP.files.writeJson(DIR, `${id}.json`, { terminalId: id, ownVsHostMs: st.ownVsHostMs, offsetMs: st.offsetMs, measuredAt: st.measuredAt }); } catch (_) { /* best effort */ }
  }

  function announce() { try { window.dispatchEvent(new CustomEvent('fp-clockstate', { detail: state() })); } catch (_) { /* no events */ } }

  async function run() {
    lastTry = realNow();
    await loadSettings();
    if (!st.enabled) {
      st.offsetMs = 0; st.ownVsHostMs = 0; st.stale = false; st.reason = 'off';
      await applyOffset(0);
      await syncAlert();
      announce();
      return state();
    }
    // A test folder's own clock decides first (its marker and clock.json are read here, not later).
    if (FP.testClock) await FP.testClock.load().catch(() => {});
    const r = await measure();
    if (r.ok) {
      st.offsetMs = r.offsetMs; st.ownVsHostMs = -r.offsetMs; st.measuredAt = r.measuredAt; st.hostAt = r.hostAt; st.rtMs = r.rtMs;
      st.stale = false; st.reason = null; st.measured = true;
      await applyOffset(r.offsetMs);
      await record();
      await syncAlert();
    } else {
      // Keep the last good offset, and say so.
      st.stale = true; st.reason = r.reason;
    }
    announce();
    return state();
  }
  /* Measure now (one at a time: a call while one runs gets that one's result). */
  function refresh() {
    if (!busy) busy = run().catch(e => { st.stale = true; st.reason = String((e && e.message) || e); return state(); }).finally(() => { busy = null; });
    return busy;
  }

  function state() {
    return { enabled: st.enabled, offsetMs: st.offsetMs, ownVsHostMs: st.ownVsHostMs, measuredAt: st.measuredAt, stale: st.stale, reason: st.reason, rtMs: st.rtMs, hostAt: st.hostAt,
      appliedMs: FP.pageClock.universal(), measured: st.measured, off: off() };
  }

  /* The folder's setting, for admins. */
  async function setEnabled(on) {
    if (!FP.users || !(await FP.users.can('admin'))) throw new Error('Only an admin can switch the universal clock on or off.');
    await FP.files.writeJson(DIR, SETTINGS, { enabled: !!on });
    st.enabled = !!on;
    await refresh();
    return st.enabled;
  }

  /* What every terminal last measured, newest problems first: [{ terminalId, ownVsHostMs, offsetMs, measuredAt, off }]. */
  async function terminals() {
    const names = (await FP.files.list(DIR).catch(() => [])).filter(n => /\.json$/.test(n) && n !== SETTINGS && !/\.probe\.json$/.test(n));
    const out = [];
    for (const n of names) {
      const j = await FP.files.readJson(DIR, n).catch(() => null);
      if (j && j.terminalId && Number.isFinite(j.ownVsHostMs)) out.push({ terminalId: j.terminalId, ownVsHostMs: j.ownVsHostMs, offsetMs: j.offsetMs || 0, measuredAt: j.measuredAt || null, off: Math.abs(j.ownVsHostMs) > WARN_MS });
    }
    return out.sort((a, b) => (b.off - a.off) || String(a.terminalId).localeCompare(String(b.terminalId), undefined, { numeric: true }));
  }

  /* The note an entry carries while this PC's clock is more than a minute from the host's. */
  function warnNote() { return off() ? { ownVsHostMs: st.ownVsHostMs, appliedMs: FP.pageClock.universal() } : null; }

  /* Start-up (called when the folder is ready and the terminal ID is known), then every five minutes and when the window comes back to the front. */
  function start() {
    if (started) return refresh();
    started = true;
    setInterval(() => { refresh(); }, EVERY_MS);
    const again = () => { if (document.visibilityState !== 'hidden' && realNow() - lastTry > MIN_GAP_MS) refresh(); };
    document.addEventListener('visibilitychange', again);
    window.addEventListener('focus', again);
    return refresh();
  }

  FP.clock = { measure, refresh, state, setEnabled, terminals, warnNote, start, WARN_MS, GRAIN_MS, MAX_RT_MS, DIR, SETTINGS };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-clock'] = '0.71.0';
})();
