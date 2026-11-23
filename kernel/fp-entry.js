/* Form Platform kernel: entries and the entry writer (steps 3–5)
 * Load after fp-config.js, fp-core.js and fp-identity.js; fp-session.js after this.
 *
 * Everything recorded is an entry written to one item of one structure:
 *   { entry: 'rack.disposition', item: { structure: 'racks', id: 'R12345' }, values: {...} }
 * Entries are never edited or deleted. A correction is a new entry naming the
 * entry it replaces. Current values are folded from entries (step 6).
 *
 * Every save is a submission: its entries share a submissionId, enter the
 * device's outbox in one step, and the last one carries commit: true. Entries
 * whose submission has no commit are ignored by readers.
 *
 * Files: data/{structure}/{local date the line is written}/{this device's terminalId}.jsonl
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.files || !FP.identity) throw new Error('Load fp-core.js and fp-identity.js before fp-entry.js');

  FP.ENTRY_VERSION = 6; // 6: entries carry the site
  const pad = (n, w) => String(n).padStart(w || 2, '0');

  const STRUCTURE_RE = /^[a-z][a-z0-9-]{0,39}$/;   // structure IDs name folders: never change them
  const ENTRY_RE = /^([a-z][a-z0-9-]{0,39})\.([a-zA-Z][a-zA-Z0-9-]{0,39})$/;
  const SOURCES = ['open', 'fallback'];

  /* ---------- IDs ----------
   * T05-20261111-093612-0042: terminal, local date and time, then a per-device
   * counter that never repeats (shared by every tab through a lock).
   */
  async function nextSeq() {
    return FP.lock('fp-seq', async () => {
      const n = ((await FP.kv.get('seq')) || 0) + 1;
      await FP.kv.set('seq', n);
      return n;
    });
  }

  async function newId(d) {
    d = d || new Date();
    const term = FP.identity.terminalId;
    if (!term) throw new Error('No terminal ID: run the startup gate first.');
    const seq = await nextSeq();
    const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    return `${term}-${date}-${time}-${pad(seq, 4)}`;
  }

  const validId = id => typeof id === 'string' && id.length > 0 && id.length <= 64 && !/[\r\n]/.test(id);

  /* A reference is an item ID, { structure, id }, an automatic reference from a
   * session ({ id, auto: true, source, date, ... }), or a list of those (several
   * lots open at once). Returns a problem string or null. */
  function refProblem(role, r) {
    if (r == null) return null;
    if (Array.isArray(r)) { for (const x of r) { const p = refProblem(role, x); if (p) return p; } return null; }
    if (typeof r === 'string') return validId(r) ? null : `ref ${role}: bad item ID`;
    if (typeof r !== 'object') return `ref ${role}: use an item ID or { structure, id }`;
    if (r.auto) {
      if (!SOURCES.includes(r.source)) return `ref ${role}: bad source`;
      if (r.source === 'open' && !validId(r.id)) return `ref ${role}: open session missing id`;
      if (!r.date) return `ref ${role}: missing date`;
      return null;
    }
    if (r.structure != null && !STRUCTURE_RE.test(r.structure)) return `ref ${role}: bad structure`;
    return validId(r.id) ? null : `ref ${role}: bad item ID`;
  }

  FP.entry = {
    newId,

    /* Build an entry without saving it.
     * spec: { entry: 'rack.disposition', item: { structure, id? }, refs, form: { id, version },
     *         values, corrects, submissionId, commit, userId, at, autoRefs, after }
     * after: the newest entry time the writer has seen for this item (a form
     * passes the loaded item's lastAt). The new entry is never stamped earlier,
     * so a terminal whose clock runs slow can't put its change before one it
     * was looking at. When that moves the time, clockAt keeps the clock's own reading.
     * item.id omitted = a new item whose ID is this entry's ID.
     * autoRefs omitted = the sessions linked to this structure are filled in
     * (and a required one that isn't open throws, with a message for the user). */
    async build(spec) {
      // Every entry belongs to a site, and only to structures used at that site.
      // The editor has no site of its own: what it saves takes the site it is told (a form opened under a site), or none.
      if (FP.sites && !(spec.site || FP.identity.site) && !FP.identity.editor) throw new Error('This terminal has no site yet. Restart the app to choose one.');
      const structureOf = spec.item && spec.item.structure;
      if (structureOf && FP.defs && FP.defs.usedHere && !FP.defs.usedHere('structure', structureOf, spec.site)) {
        throw new Error(`${structureOf} is not used at site ${spec.site || FP.identity.site}.`);
      }
      const clock = spec.at || new Date();
      const after = spec.after ? Date.parse(spec.after) : NaN;
      const at = !isNaN(after) && clock.getTime() <= after ? new Date(after + 1) : clock;
      if (at !== clock && after - clock.getTime() > 60000 && !(FP.testClock && FP.testClock.used)) {
        window.dispatchEvent(new CustomEvent('fp-clock', { detail: { behindMs: after - clock.getTime(), item: spec.item } }));
      }
      const entryId = await newId(at);
      const structure = spec.item && spec.item.structure;
      const item = { structure, id: (spec.item && spec.item.id) || entryId };
      const autoRefs = spec.autoRefs || (FP.session ? await FP.session.refsFor(structure, at, String(spec.entry).split('.')[1], spec.item && spec.item.id) : {});
      const refs = Object.assign({}, autoRefs, spec.refs || {});
      // The signed-in user's ID comes from the User session's reference (its stamped userId).
      const userRef = refs.user && !Array.isArray(refs.user) && refs.user.auto ? (refs.user.userId || null) : null;
      const form = spec.form || {};
      return {
        v: FP.ENTRY_VERSION,
        entryId,
        entry: spec.entry,
        item,
        refs,
        form: Object.assign({ id: form.id || null, version: form.version != null ? form.version : null }, form.sub ? { sub: form.sub } : {}),
        writtenAt: at.toISOString(),
        terminalId: FP.identity.terminalId,
        site: spec.site || FP.identity.site || undefined,
        userId: spec.userId || userRef || null,
        corrects: spec.corrects || null,
        // Saved from a form that needs a supervisor's approval: who approved it, and when (0.41).
        approvedBy: spec.approvedBy || undefined,
        submissionId: spec.submissionId || null,
        commit: spec.commit ? true : undefined,
        commitIn: spec.commitIn || undefined,
        clockAt: at !== clock ? clock.toISOString() : undefined,
        // Values a form worked out (snapshots), with the formula and function versions used.
        derived: spec.derived && Object.keys(spec.derived).length ? spec.derived : undefined,
        values: spec.values || {},
      };
    },

    /* List of problems; empty list = valid. Used by the writer and the reader. */
    validate(e) {
      if (!e || typeof e !== 'object') return ['not an object'];
      const errors = [];
      ['v', 'entryId', 'entry', 'item', 'refs', 'writtenAt', 'terminalId', 'values']
        .forEach(k => { if (e[k] == null) errors.push(`missing ${k}`); });
      const m = typeof e.entry === 'string' && e.entry.match(ENTRY_RE);
      if (e.entry != null && !m) errors.push(`bad entry name ${e.entry} (use structure.action)`);
      if (e.item) {
        if (!STRUCTURE_RE.test(e.item.structure || '')) errors.push(`bad structure ${e.item.structure}`);
        if (!validId(e.item.id)) errors.push('bad item ID');
        if (m && e.item.structure && m[1] !== e.item.structure) errors.push(`entry ${e.entry} does not match structure ${e.item.structure}`);
      }
      if (e.writtenAt && isNaN(Date.parse(e.writtenAt))) errors.push('bad writtenAt');
      if (e.values && typeof e.values !== 'object') errors.push('values must be an object');
      if (e.commit && !e.submissionId) errors.push('commit without submissionId');
      if (e.site != null && !/^[A-Z0-9][A-Z0-9-]{0,15}$/.test(e.site)) errors.push('bad site');
      if (e.commitIn != null && (!e.submissionId || !STRUCTURE_RE.test(e.commitIn))) errors.push('bad commitIn');
      if (e.refs && typeof e.refs === 'object') {
        for (const [role, r] of Object.entries(e.refs)) { const p = refProblem(role, r); if (p) errors.push(p); }
      }
      return errors;
    },

    /* Where an entry's line goes when written at `on` (default now): its
     * structure's folder, that day, and THIS device's file, so there is one
     * writer per file even if the terminal was renamed while entries waited. */
    location(e, on) {
      const root = (FP.config && FP.config.dataRoot) || ['data'];
      return {
        parts: root.concat(e.item.structure, FP.util.localDate(on || new Date())),
        fileName: FP.identity.terminalId + '.jsonl',
      };
    },

    /* One save: every entry added inside fn shares a submissionId and enters the
     * outbox together; the LAST one added carries commit: true.
     *   await FP.entry.submit(async add => {
     *     await add({ entry: 'rack.create', item: { structure: 'racks', id: 'R1-P' }, ... });
     *     await add({ entry: 'rack.disposition', item: { structure: 'racks', id: 'R1' }, ... });
     *   });
     * Resolves once the entries are safe on this device. */
    async submit(fn) {
      const at = new Date();
      const submissionId = 'S-' + await newId(at);
      const entries = [];
      await fn(async spec => {
        const e = await FP.entry.build(Object.assign({}, spec, { submissionId, at: spec.at || at }));
        entries.push(e);
        return e;
      });
      if (!entries.length) throw new Error('A save needs at least one entry.');
      const last = entries[entries.length - 1];
      last.commit = true;
      // Entries in other structures say where the commit lives, so a reader of
      // one structure can check a save that spans several.
      if (entries.length > 1) entries.forEach(e => { e.commitIn = last.item.structure; });
      await enqueue(entries);
      await FP.outbox.flush();
      return { submissionId, entries };
    },

    /* A save made but not written (0.41): the same entries submit() would write, built now (IDs, references,
     * who and where), kept by the caller, e.g. waiting for a supervisor's approval. release() writes them. */
    async prepare(fn) {
      const at = new Date();
      const submissionId = 'S-' + await newId(at);
      const entries = [];
      await fn(async spec => {
        const e = await FP.entry.build(Object.assign({}, spec, { submissionId, at: spec.at || at }));
        entries.push(e);
        return e;
      });
      if (!entries.length) throw new Error('A save needs at least one entry.');
      const last = entries[entries.length - 1];
      last.commit = true;
      if (entries.length > 1) entries.forEach(e => { e.commitIn = last.item.structure; });
      return { submissionId, entries };
    },
    /* Write prepared entries, as they were made, with who approved them. */
    async release(entries, approvedBy) {
      const out = entries.map(e => Object.assign({}, e, approvedBy ? { approvedBy } : {}));
      out.forEach(e => { const p = FP.entry.validate(e); if (p.length) throw new Error(`A waiting record can't be saved: ${p.join('; ')}`); });
      await enqueue(out);
      await FP.outbox.flush();
      return out;
    },

    /* A save of one entry. */
    async record(spec) {
      const { entries } = await FP.entry.submit(add => add(spec));
      return entries[0];
    },

    /* Append an already-built entry on its own (used by sessions and tests). */
    async append(e) {
      await enqueue([e]);
      await FP.outbox.flush();
      return e;
    },

    /* A correction: a new entry of the same kind on the same item, naming the
     * entry it replaces. values = the corrected containers; a reason is required. */
    async correct(original, values, reason, opts) {
      if (!reason) throw new Error('A correction needs a reason.');
      opts = opts || {};
      const keepManual = {};
      for (const [role, r] of Object.entries(original.refs || {})) {
        if (!(r && !Array.isArray(r) && r.auto)) keepManual[role] = r;
      }
      // Keep the original's context (its shift, run, lot), but the sign-in is
      // whoever is correcting now: a correction is their action, not the author's.
      const carried = Object.fromEntries(Object.entries(original.refs || {}).filter(([role, r]) => role !== 'user' && r && (Array.isArray(r) || r.auto)));
      if (FP.session) {
        const open = await FP.session.current(opts.at);
        const u = open.user && open.user[0];
        if (u) carried.user = Object.assign({ id: u.id, auto: true, source: 'open', date: u.date }, u.stamp);
      }
      return FP.entry.record({
        entry: original.entry, item: original.item, refs: keepManual,
        autoRefs: carried,
        form: original.form, values: Object.assign({}, values, { reason }),
        corrects: original.entryId, userId: opts.userId, at: opts.at, site: original.site || undefined,
        after: opts.after && opts.after > original.writtenAt ? opts.after : original.writtenAt,
      });
    },
  };

  /* ---------- Waiting for a supervisor's approval (0.41) ----------
   * A form set to need a supervisor's approval doesn't save what a user fills in. The save is made (IDs,
   * who, where, when) and kept in approvals/<id>.json, not written to any structure. A supervisor approves
   * it (the entries are written as they were made, with approvedBy) or doesn't (nothing is written); either
   * way the decision is kept in the built-in approvals structure and the file is removed. */
  const APPROVALS = ['approvals'];
  FP.approvals = {
    STRUCTURE: 'approvals',
    FOLDER: APPROVALS,
    async hold({ form, title, summary, entries, submissionId, site }) {
      const u = FP.users ? await FP.users.current() : null;
      const doc = {
        fp: 'approval', v: 1, id: submissionId, form, title: title || (form && form.id) || '', summary: summary || '',
        site: site || (entries[0] && entries[0].site) || FP.identity.site || null, terminalId: FP.identity.terminalId,
        userId: u ? u.id : null, userName: u ? u.name : '', at: new Date().toISOString(), entries,
      };
      try { await FP.files.writeJson(APPROVALS, submissionId + '.json', doc); }
      catch (e) { throw new Error(`It couldn't be sent for approval: ${e.message || e}. Try again when the data folder is back.`); }
      return doc;
    },
    /* What waits, oldest first; at a site (and anything with no site) when one is given. */
    async list(site) {
      const names = (await FP.files.list(APPROVALS).catch(() => [])).filter(n => /\.json$/i.test(n));
      const out = [];
      for (const n of names) {
        const d = await FP.files.readJson(APPROVALS, n).catch(() => null);
        if (d && d.fp === 'approval' && d.id && Array.isArray(d.entries) && (!site || !d.site || d.site === site)) out.push(d);
      }
      return out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    },
    /* Approve (write it) or not (drop it). The file is taken first, so two supervisors can't both write it. */
    async decide(id, approve, note) {
      if (!FP.users || !(await FP.users.can('supervisor'))) throw new Error('Only a supervisor can approve.');
      return FP.lock('fp-approval', async () => {
        const doc = await FP.files.readJson(APPROVALS, id + '.json').catch(() => null);
        if (!doc) throw new Error('Someone else has already decided this one.');
        const u = await FP.users.current();
        const by = { userId: u.id, name: u.name, at: new Date().toISOString() };
        if (!(await FP.files.remove(APPROVALS, id + '.json'))) throw new Error('Someone else has already decided this one.');
        try { if (approve) await FP.entry.release(doc.entries, by); }
        catch (e) { await FP.files.writeJson(APPROVALS, id + '.json', doc).catch(() => {}); throw e; }
        await FP.entry.record({
          entry: `approvals.${approve ? 'approve' : 'reject'}`, item: { structure: 'approvals', id }, form: { id: 'approvals', version: 1 },
          values: { decision: approve ? 'approved' : 'not approved', form: (doc.form && doc.form.id) || '', title: doc.title || '', summary: doc.summary || '', from: doc.userName || '', fromTerminal: doc.terminalId || '', heldAt: doc.at, note: note || '' },
          site: doc.site || undefined,
        });
        if (FP.current && FP.current.clearCache) FP.current.clearCache();
        return doc;
      });
    },
  };

  /* ---------- Outbox ---------- */
  async function enqueue(entries) {
    for (const e of entries) {
      const problems = FP.entry.validate(e);
      if (problems.length) throw new Error('Invalid entry: ' + problems.join(', '));
    }
    await FP.outboxStore.addMany(entries);
    publish();
  }

  const status = { pending: 0, state: 'idle', lastError: null, lastWrite: null };
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('fp-outbox') : null;
  let simulateOffline = false;

  async function publish(fromOtherTab) {
    try { status.pending = await FP.outboxStore.count(); } catch (_) { /* keep last count */ }
    window.dispatchEvent(new CustomEvent('fp-outbox', { detail: Object.assign({}, status) }));
    if (channel && !fromOtherTab) channel.postMessage('changed');
  }
  if (channel) channel.onmessage = () => publish(true);

  /* Why the folder can't be written right now, or null. */
  async function blocked() {
    if (simulateOffline) return 'offline (simulated)';
    if (!FP.folder.handle) return 'no data folder connected';
    if (!FP.identity.terminalId) return 'no terminal ID';
    try {
      const p = await FP.folder.handle.queryPermission({ mode: 'readwrite' });
      if (p !== 'granted') return 'needs permission: tap Reconnect';
    } catch (_) { return 'data folder unavailable'; }
    return null;
  }

  FP.outbox = {
    status: () => Object.assign({}, status),

    /* Write everything waiting. Safe to call any time, from any tab. */
    async flush() {
      const why = await blocked();
      if (why) {
        status.state = 'waiting';
        status.lastError = why;
        await publish();
        return Object.assign({}, status);
      }
      return FP.lock('fp-outbox', async () => {
        const rows = await FP.outboxStore.all();
        if (!rows.length) { status.state = 'idle'; status.lastError = null; await publish(); return Object.assign({}, status); }
        status.state = 'writing';
        await publish();

        const now = new Date();
        const done = [];
        let failure = null;
        // Commit markers go last, after every other waiting entry has landed.
        const firstPass = rows.filter(r => !r.value.commit);
        const secondPass = rows.filter(r => r.value.commit);
        // A submission whose own entries failed is not committed (readers ignore it until it is); other
        // submissions still commit (F7).
        const failedSubs = new Set();
        for (const pass of [firstPass, secondPass]) {
          const rowsNow = pass === secondPass ? pass.filter(r => !r.value.submissionId || !failedSubs.has(r.value.submissionId)) : pass;
          const results = await Promise.allSettled(rowsNow.map(r => {
            const { parts, fileName } = FP.entry.location(r.value, now);
            return FP.files.appendLine(parts, fileName, r.value, { chain: true }).then(() => r.key);   // chained (0.49)
          }));
          results.forEach((res, i) => {
            if (res.status === 'fulfilled') done.push(res.value);
            else {
              failure = failure || res.reason;
              if (pass === firstPass && rowsNow[i].value.submissionId) failedSubs.add(rowsNow[i].value.submissionId);
            }
          });
        }
        if (done.length) { await FP.outboxStore.remove(done); status.lastWrite = new Date().toISOString(); }
        status.state = failure ? 'waiting' : 'idle';
        status.lastError = failure ? String(failure && failure.message || failure) : null;
        await publish();
        return Object.assign({}, status);
      });
    },

    /* Test only: pretend the data folder is unreachable. */
    simulateOffline(on) { simulateOffline = !!on; return FP.outbox.flush(); },
  };

  /* Retry on a timer, when the network returns, and when the page is shown again. */
  setInterval(() => { FP.outbox.flush().catch(() => {}); }, 30000);
  window.addEventListener('online', () => FP.outbox.flush().catch(() => {}));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) FP.outbox.flush().catch(() => {}); });

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-entry'] = '0.62.0';
})();
