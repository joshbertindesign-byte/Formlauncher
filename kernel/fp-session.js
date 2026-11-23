/* Form Platform kernel: the sign-in record (step 5; sessions removed in 0.36)
 * Load after fp-entry.js.
 *
 * Who is signed in on this terminal is kept open here, and every entry written while someone is signed
 * in references them automatically:
 *   refs.user = { id, auto: true, source: 'open', date, userId, name, roles }
 * Signing in and out are entries in the built-in sign-ins structure (sign-ins.start, sign-ins.end).
 * fp-users.js defines the one type (user) and links it to every structure.
 *
 * Sessions as a platform feature (shift, run and lot types that saves recorded, with fallback time
 * tables and required runs) are gone as of 0.36. A run is now an ordinary item of a Runs structure that
 * forms find with "Found by a rule"; a shift is worked out from when a save happened (HOUR, or a function
 * made from an old shift time table, see Admin > Clean-up). Entries saved before keep their session
 * references; nothing writes new ones. Open sessions of types that no longer exist are forgotten on
 * this terminal without writing anything.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.entry) throw new Error('Load fp-entry.js before fp-session.js');

  const KEY = 'openSessions';
  const LOCK = 'fp-session';
  const types = new Map();
  const defaultLinks = {}; // the types every structure records (the signed-in user)
  let lockDepth = 0; // > 0 while this page holds the lock

  function withLock(fn) {
    return FP.lock(LOCK, async () => {
      lockDepth++;
      try { return await fn(); } finally { lockDepth--; }
    });
  }

  async function load() { return (await FP.kv.get(KEY)) || {}; }
  async function save(map) { await FP.kv.set(KEY, map); }

  function closesAt(t, values, openedAt) {
    const opened = Date.parse(openedAt);
    const limits = [opened + (t.maxHours || 24) * 3600000];
    const c = t.closes;
    if (c && c.at && !isNaN(Date.parse(values[c.at]))) limits.push(Date.parse(values[c.at]) + (c.graceMinutes || 0) * 60000);
    if (c && c.afterHours) limits.push(opened + c.afterHours * 3600000);
    return new Date(Math.min.apply(null, limits)).toISOString();
  }

  function snapshot(t, values) {
    const s = {};
    (t.stamp || []).forEach(f => { s[f] = values[f] != null ? values[f] : null; });
    return s;
  }

  const autoRef = c => Object.assign({ id: c.id, auto: true, source: 'open', date: c.date }, c.stamp);

  const expired = (c, at) => at.getTime() > Date.parse(c.closesAt);
  const list = (map, name) => Object.values(map[name] || {});

  /* Refs for an entry about a session itself: every OTHER open session. */
  function openRefs(map, exceptName) {
    const refs = {};
    for (const [name, byId] of Object.entries(map)) {
      if (name === exceptName) continue;
      const open = Object.values(byId);
      if (!open.length) continue;
      const t = types.get(name);
      refs[name] = t && t.open === 'many' ? open.map(autoRef) : autoRef(open[0]);
    }
    return refs;
  }

  function sessionEntry(t, c, action, values, at, userId, map) {
    return FP.entry.record({
      entry: `${t.structure}.${action}`, item: { structure: t.structure, id: c.id },
      form: { id: t.formId || null, version: null }, values,
      autoRefs: Object.assign(openRefs(map, t.name), { [t.name]: autoRef(c) }), at, userId,
    });
  }

  /* Close one open record. Caller holds the lock. */
  async function closeOne(map, name, id, at, reason, userId) {
    const t = types.get(name);
    const c = map[name] && map[name][id];
    if (!c) return null;
    if (t) await sessionEntry(t, c, 'end', { endAt: at.toISOString(), endReason: reason }, at, userId, map);
    delete map[name][id];
    if (!Object.keys(map[name]).length) delete map[name];
    return c;
  }

  async function closeExpired(map, at, userId) {
    // Types that no longer exist (shift, run, lot from before 0.36): forgotten here, nothing written.
    Object.keys(map).forEach(name => { if (!types.has(name)) delete map[name]; });
    for (const name of Object.keys(map)) {
      for (const c of list(map, name)) {
        if (map[name] && map[name][c.id] && expired(c, at)) await closeOne(map, name, c.id, new Date(c.closesAt), 'expired', userId);
      }
    }
  }

  FP.session = {
    defineType(def) {
      if (!def || !def.name) throw new Error('A sign-in type needs a name.');
      const t = Object.assign({ open: 'one', maxHours: 24 }, def);
      t.structure = t.structure || t.name + 's';
      types.set(t.name, t);
      return t;
    },
    types: () => Array.from(types.values()),
    type: name => types.get(name) || null,
    /* A type every structure records (the signed-in user). */
    linkDefault(type, mode) { defaultLinks[type] = mode; },
    linksFor: () => Object.assign({}, defaultLinks),

    /* Open sessions on this device: { type: [session, ...] }. Expired ones are
     * closed here (unless this page is already inside a session change). */
    async current(at) {
      at = at || new Date();
      let map = await load();
      const anyExpired = Object.keys(map).some(n => !types.has(n) || list(map, n).some(c => expired(c, at)));
      if (anyExpired && lockDepth === 0) {
        await withLock(async () => { const m = await load(); await closeExpired(m, at); await save(m); });
        map = await load();
      }
      const out = {};
      for (const name of Object.keys(map)) {
        if (!types.has(name)) continue;
        const open = list(map, name).filter(c => !expired(c, at) && at.getTime() >= Date.parse(c.openedAt));
        if (open.length) out[name] = open;
      }
      return out;
    },

    /* Automatic references for an entry written now: whoever is signed in. */
    async refsFor(structure, at) {
      at = at || new Date();
      if (!Object.keys(defaultLinks).length) return {};
      const open = await FP.session.current(at);
      const refs = {};
      for (const name of Object.keys(defaultLinks)) {
        const t = types.get(name);
        const here = open[name] || [];
        if (here.length) refs[name] = t && t.open === 'many' ? here.map(autoRef) : autoRef(here[0]);
      }
      return refs;
    },

    /* Open a session: writes {structure}.start about a new item. For a type
     * that allows one, the open one is replaced. opts: { at, userId, id } */
    async open(name, values, opts) {
      const t = types.get(name);
      if (!t) throw new Error(`No session type named ${name}.`);
      opts = opts || {};
      const at = opts.at || new Date();
      values = Object.assign({ startAt: at.toISOString() }, values || {});
      return withLock(async () => {
        const map = await load();
        await closeExpired(map, at, opts.userId);
        if (t.open !== 'many') for (const c of list(map, name)) await closeOne(map, name, c.id, at, 'replaced', opts.userId);
        const id = opts.id || await FP.entry.newId(at);
        const c = {
          type: name, id, date: FP.util.localDate(at), openedAt: at.toISOString(),
          values, stamp: snapshot(t, values), closesAt: closesAt(t, values, at.toISOString()),
        };
        await sessionEntry(t, c, 'start', values, at, opts.userId, map);
        (map[name] = map[name] || {})[id] = c;
        await save(map);
        return c;
      });
    },

    /* Change an open session (e.g. expected hours). opts: { id, at, userId }; id defaults to the only one open. */
    async update(name, values, opts) {
      const t = types.get(name);
      if (!t) throw new Error(`No session type named ${name}.`);
      opts = opts || {};
      return withLock(async () => {
        const map = await load();
        const c = opts.id ? map[name] && map[name][opts.id] : list(map, name)[0];
        if (!c) throw new Error(`No ${t.label || name} is open.`);
        c.values = Object.assign({}, c.values, values);
        c.stamp = snapshot(t, c.values);
        c.closesAt = closesAt(t, c.values, c.openedAt);
        await sessionEntry(t, c, 'update', values, opts.at || new Date(), opts.userId, map);
        await save(map);
        return c;
      });
    },

    /* Close it. opts: { id, at, reason, userId }. */
    async close(name, opts) {
      opts = opts || {};
      return withLock(async () => {
        const map = await load();
        const c = opts.id ? map[name] && map[name][opts.id] : list(map, name)[0];
        if (!c) return null;
        const done = await closeOne(map, name, c.id, opts.at || new Date(), opts.reason || 'ended', opts.userId);
        await save(map);
        return done;
      });
    },

    /* Test only: forget open sessions on this device without writing end entries.
     * keep: session types to leave open (e.g. ['user'] keeps the sign-in). */
    async clearLocal(keep) {
      return withLock(async () => {
        const map = await load();
        Object.keys(map).forEach(name => { if (!(keep || []).includes(name)) delete map[name]; });
        await save(map);
      });
    },
  };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-session'] = '0.65.0';
})();
