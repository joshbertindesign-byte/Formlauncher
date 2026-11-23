/* Form Platform kernel: current values and checkpoints (step 6)
 * Load after fp-entry.js and fp-formula.js.
 *
 * Current values are the one shared answer to "what is this item's state now":
 * every entry of an item, in writtenAt order, folded by each container's summary
 * rule. Every launcher works them out the same way, so every screen agrees.
 *
 *   FP.structures.define({
 *     id: 'deliveries', version: 1,
 *     containers: {
 *       receivedQty: { rule: 'sum' },             // each check-in adds
 *       lots: { from: 'lot', rule: 'list' },      // fed by a differently named value
 *     },                                          // anything not listed: latest
 *     calculated: {
 *       daysOpen: { fn: 'DaysBetween', inputs: { start: '$firstAt', end: '$asOf' } },
 *     },
 *     status: [                                   // first rule whose formula is true
 *       { value: 'Received', when: 'receivedQty >= expectedQty' },
 *       { value: 'Partially received', when: 'receivedQty > 0' },
 *       { value: 'Expected', when: 'TRUE' },
 *     ],
 *   });
 *   const { items, health } = await FP.current.load('deliveries', { asOf });
 *
 * Reading rules: a repeated entryId (a retry) is ignored; entries of a save
 * whose commit hasn't landed are ignored; a correction replaces the values of
 * the entry it names before folding, so sums never count twice; two terminals
 * setting the same container of one item within 10 minutes is flagged.
 *
 * Checkpoints only make loading faster, one per month per structure. Any
 * terminal writes them. The month so far is rewritten while it is open; once
 * a month's last day is two days past it is written once, compressed, with its
 * item IDs, and never changed. Readers take the best one per month and read any
 * day file newer, missing from its list, or grown since (a size check).
 *
 * Live window (optional, per structure definition): live: { days: 60 } loads
 * only the months from 60 days back, plus items still open by the structure's
 * open rule (open: 'status <> "Closed"'), carried forward month to month, plus
 * the history of any older item touched in the window. Startup then stays the
 * same however long the history grows. Each terminal records its load times in
 * _stats/{terminal}.json so the library can flag structures that load slowly.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.entry || !FP.fn) throw new Error('Load fp-entry.js and fp-formula.js before fp-current.js');

  const CHECKPOINT_VERSION = 2;
  const CLASH_MINUTES = 10;
  const DAY_RE = /^\d{4}-\d\d-\d\d$/;
  const roots = () => [((FP.config && FP.config.dataRoot) || ['data']), ['archive']];

  /* ---------- Structure definitions (step 9 loads these from published files) ---------- */
  const defs = new Map();
  FP.structures = {
    define(def) {
      if (!def || !def.id) throw new Error('A structure needs an id.');
      const d = Object.assign({ version: 1, containers: {}, calculated: {}, status: [] }, def);
      defs.set(d.id, d);
      cache.delete(d.id);
      return d;
    },
    get: id => defs.get(id) || { id, version: 0, containers: {}, calculated: {}, status: [] },
    has: id => defs.has(id),
    list: () => Array.from(defs.values()),
    remove(id) { cache.delete(id); return defs.delete(id); },
  };

  /* ---------- Reading files ---------- */
  function parseLines(text) {
    const lines = text.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines.map(line => { try { return JSON.parse(line); } catch (_) { return undefined; } });
  }

  /* Day folders of a structure, oldest first (data and archive). */
  async function listDays(structure) {
    const days = new Set();
    for (const root of roots()) for (const d of await FP.files.listDirs(root.concat(structure))) if (DAY_RE.test(d)) days.add(d);
    return Array.from(days).sort();
  }

  /* The daily files in the given days: [{ key: 'YYYY-MM-DD/T05.jsonl', day, parts, name }]. */
  async function listFiles(structure, days) {
    const out = new Map();
    for (const root of roots()) {
      const base = root.concat(structure);
      for (const day of days) {
        for (const name of await FP.files.list(base.concat(day))) {
          if (!name.endsWith('.jsonl')) continue;
          const key = `${day}/${name}`;
          if (!out.has(key)) out.set(key, { key, day, parts: base.concat(day), name });
        }
      }
    }
    return Array.from(out.values()).sort((a, b) => a.key.localeCompare(b.key));
  }

  /* ---------- Months ---------- */
  const monthOf = day => day.slice(0, 7);
  const nextMonth = m => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const prevMonth = m => { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo - 2, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  const lastDayOf = m => { const [y, mo] = m.split('-').map(Number); return FP.util.localDate(new Date(y, mo, 0)); };
  const monthEnd = m => { const [y, mo] = m.split('-').map(Number); return new Date(y, mo, 1, 0, 0, 0, -1); };
  const uniq = a => Array.from(new Set(a));

  /* ---------- Checkpoints ----------
   * checkpoints/{structure}/{yyyy-mm}/{terminal}.json      the month so far (rewritten while the month is open)
   * checkpoints/{structure}/{yyyy-mm}/{terminal}.json.gz   a closed month: written once, compressed, never changed
   * checkpoints/{structure}/{yyyy-mm}/{terminal}.ids.json.gz    the item IDs that month touched
   * checkpoints/{structure}/{yyyy-mm}/{terminal}.carry.json.gz  every entry of items still open at the month's end
   * A month is closed once its last day is two days past. */
  const cpParts = (structure, month) => ['checkpoints', structure].concat(month ? [month] : []);
  const CP_RE = /^([A-Z0-9][A-Z0-9-]{0,15})\.json(\.gz)?$/;
  const IDS_RE = /^([A-Z0-9][A-Z0-9-]{0,15})\.ids\.json(\.gz)?$/;
  const CARRY_RE = /^([A-Z0-9][A-Z0-9-]{0,15})\.carry\.json(\.gz)?$/;

  function fingerprint(ids) {
    let h = 0x811c9dc5;
    for (const id of ids.slice().sort()) {
      for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
      h ^= 10; h = Math.imul(h, 0x01000193) >>> 0;
    }
    return ('00000000' + h.toString(16)).slice(-8);
  }

  // Closed months never change, so the last few read are kept for the session.
  const closedCache = new Map();
  const keepClosed = (k, c) => {
    closedCache.delete(k);
    closedCache.set(k, c);
    while (closedCache.size > 4) closedCache.delete(closedCache.keys().next().value);
  };

  /* The best checkpoint of one month: a closed one if any, else the newest. */
  async function readMonth(structure, month, health) {
    const ck = structure + '/' + month;
    if (closedCache.has(ck)) return closedCache.get(ck);
    const names = (await FP.files.list(cpParts(structure, month))).filter(n => CP_RE.test(n))
      .sort((a, b) => (b.endsWith('.gz') - a.endsWith('.gz')) || a.localeCompare(b));
    const found = [];
    for (const name of names) {
      const cp = await FP.files.readJsonAny(cpParts(structure, month), name);
      if (!cp || cp.v !== CHECKPOINT_VERSION || cp.structure !== structure || cp.month !== month || !DAY_RE.test(cp.coveredThrough || '') || !Array.isArray(cp.entries)) {
        health.push(`Checkpoint ${month}/${name} is unreadable or incomplete; skipped`);
        continue;
      }
      if (fingerprint(cp.entries.map(e => e.entryId)) !== cp.fingerprint) { health.push(`Checkpoint ${month}/${name} does not match its fingerprint; skipped`); continue; }
      const c = Object.assign({ file: `${month}/${name}` }, cp);
      if (c.closed) { keepClosed(ck, c); return c; }
      found.push(c);
    }
    found.sort((a, b) => b.coveredThrough.localeCompare(a.coveredThrough) || String(b.writtenAt).localeCompare(String(a.writtenAt)));
    for (let i = 1; i < found.length; i++) {
      if (found[i - 1].coveredThrough === found[i].coveredThrough && found[i - 1].fingerprint !== found[i].fingerprint) {
        health.push(`Checkpoints ${found[i - 1].file} and ${found[i].file} cover the same days but differ`);
      }
    }
    return found[0] || null;
  }

  const idsCache = new Map();
  /* The item IDs a closed month touched (from its ids file, or its checkpoint). */
  async function readIds(structure, month, health) {
    const ck = structure + '/' + month;
    if (idsCache.has(ck)) return idsCache.get(ck);
    let ids = null;
    for (const name of (await FP.files.list(cpParts(structure, month))).filter(n => IDS_RE.test(n))) {
      const f = await FP.files.readJsonAny(cpParts(structure, month), name);
      if (f && Array.isArray(f.ids)) { ids = new Set(f.ids); break; }
    }
    if (!ids) {
      const cp = await readMonth(structure, month, health);
      ids = cp ? new Set(cp.entries.map(e => e.item.id)) : null;
    }
    if (ids) idsCache.set(ck, ids);
    return ids;
  }

  const carryKey = def => `${def.version}|${def.open || ''}`;
  /* Entries of items open at the end of `month`, if written under the current definition. */
  async function readCarry(structure, month) {
    const def = FP.structures.get(structure);
    for (const name of (await FP.files.list(cpParts(structure, month))).filter(n => CARRY_RE.test(n))) {
      const c = await FP.files.readJsonAny(cpParts(structure, month), name);
      if (c && c.key === carryKey(def) && Array.isArray(c.entries) && fingerprint(c.entries.map(e => e.entryId)) === c.fingerprint) return c;
    }
    return null;
  }

  /* ---------- Loading raw entries ----------
   * since (a 'YYYY-MM-DD' day, or null for everything): with a live window, load
   * the months from since's month on, plus the entries carried forward from the
   * month before (items still open), plus the history of any item touched in the
   * window that existed before it. Without a carry for that month, read everything. */
  async function loadEntries(structure, since) {
    const health = [];
    const byId = new Map();
    let unreadable = 0, invalid = 0;
    let tooNew = 0;
    const add = e => {
      if (!e || typeof e !== 'object') { unreadable++; return false; }
      if (typeof e.v === 'number' && e.v > FP.ENTRY_VERSION) { tooNew = Math.max(tooNew, e.v); return false; }
      if (FP.entry.validate(e).length) { invalid++; return false; }
      if (e.item.structure !== structure) { invalid++; return false; }
      if (!byId.has(e.entryId)) byId.set(e.entryId, e); // a retry repeats an entry: keep one
      return true;
    };
    const days = await listDays(structure);
    const allMonths = uniq(days.map(monthOf));
    let fromMonth = since ? monthOf(since) : null;
    const carried = new Set();
    let carryFrom = null;
    const def = FP.structures.get(structure);
    if (fromMonth && allMonths.some(m => m < fromMonth) && !def.open) {
      // No open rule (0.53.2): nothing stays in view past the window, so there is nothing to carry; the window's months are enough.
    } else if (fromMonth && allMonths.some(m => m < fromMonth)) {
      const carry = await readCarry(structure, prevMonth(fromMonth));
      if (carry) { carry.entries.forEach(e => { if (add(e)) carried.add(e.item.id); }); carryFrom = prevMonth(fromMonth); }
      else {
        health.push(`Live window: nothing carried forward from ${prevMonth(fromMonth)} yet, so the full history was read. The next checkpoint fixes this.`);
        fromMonth = null;
      }
    } else fromMonth = null;

    const months = allMonths.filter(m => !fromMonth || m >= fromMonth);
    const touched = new Set();
    const addWindow = e => { if (add(e)) touched.add(e.item.id); };
    let read = 0;
    const used = [];
    for (const month of months) {
      const cp = await readMonth(structure, month, health);
      if (cp) { cp.entries.forEach(addWindow); used.push(cp.file); }
      for (const f of await listFiles(structure, days.filter(d => monthOf(d) === month))) {
        const covered = cp && f.day <= cp.coveredThrough ? cp.files[f.key] : null;
        if (covered) {
          // Covered by the checkpoint: only read it if it has grown since (a slow sync or a late write).
          const size = await FP.files.size(f.parts, f.name);
          if (size === covered.size) continue;
          const text = await FP.files.readText(f.parts, f.name);
          (text == null ? [] : parseLines(text)).slice(covered.lines).forEach(addWindow);
          read++;
          continue;
        }
        const text = await FP.files.readText(f.parts, f.name);
        (text == null ? [] : parseLines(text)).forEach(addWindow);
        read++;
        // Each line names the one before it (0.49): a line changed or taken out since it was saved shows here.
        if (text && FP.files.verifyChain) {
          const ch = await FP.files.verifyChain(text);
          if (ch.broken.length) health.push(`${f.key}: line${ch.broken.length === 1 ? '' : 's'} ${ch.broken.slice(0, 5).join(', ')}${ch.broken.length > 5 ? '…' : ''} ${ch.broken.length === 1 ? "doesn't" : "don't"} follow the line before: the file was changed or a line taken out after saving`);
        }
      }
    }
    // Items touched in the window that existed before it and weren't carried: bring their history.
    if (fromMonth) {
      const want = new Set(Array.from(touched).filter(id => !carried.has(id)));
      if (want.size) await addHistory(structure, want, allMonths.filter(m => m < fromMonth), add, health);
    }
    if (unreadable) health.push(`${unreadable} unreadable line${unreadable === 1 ? '' : 's'} skipped (half-written or damaged)`);
    if (invalid) health.push(`${invalid} invalid entr${invalid === 1 ? 'y' : 'ies'} skipped`);
    if (tooNew) {
      // Entries saved by a newer release: reading on would give wrong values, so stop and let this terminal update.
      window.dispatchEvent(new CustomEvent('fp-update-needed', { detail: { structure, entryVersion: tooNew } }));
      throw new Error(`Some ${structure} entries were saved by a newer version of the platform (entry format ${tooNew}; this terminal reads up to ${FP.ENTRY_VERSION}). This terminal needs the update: it moves to it by itself once the update has synced here.`);
    }
    return { entries: Array.from(byId.values()), filesRead: read, checkpoints: used, months: months.length, carryFrom, since: fromMonth ? since : null, health };
  }

  /* Add every entry, in the given (closed) months, of the given items. */
  async function addHistory(structure, ids, months, add, health) {
    for (const month of months) {
      const touchedThen = await readIds(structure, month, health);
      if (touchedThen && !Array.from(ids).some(id => touchedThen.has(id))) continue;
      const cp = await readMonth(structure, month, health);
      if (cp && cp.closed) { cp.entries.forEach(e => { if (ids.has(e.item.id)) add(e); }); continue; }
      // No closed checkpoint for that month: read its files.
      const days = (await listDays(structure)).filter(d => monthOf(d) === month);
      for (const f of await listFiles(structure, days)) {
        const text = await FP.files.readText(f.parts, f.name);
        (text == null ? [] : parseLines(text)).forEach(e => { if (e && e.item && ids.has(e.item.id)) add(e); });
      }
    }
  }

  /* ---------- Submissions: which saves are complete ---------- */
  const committedCache = new Map();
  async function committedIds(structure) {
    const hit = committedCache.get(structure);
    if (hit && Date.now() - hit.at < 15000) return hit.ids;
    const { entries } = await loadEntriesCached(structure, false, sinceFor(structure, new Date(), {}));
    const ids = new Set(entries.filter(e => e.commit).map(e => e.submissionId));
    committedCache.set(structure, { at: Date.now(), ids });
    return ids;
  }

  async function committedFilter(structure, entries, health, asOf) {
    const local = new Set(entries.filter(e => e.commit).map(e => e.submissionId));
    const elsewhere = {};
    for (const e of entries) {
      if (!e.submissionId || local.has(e.submissionId) || !e.commitIn || e.commitIn === structure) continue;
      (elsewhere[e.commitIn] = elsewhere[e.commitIn] || new Set()).add(e.submissionId);
    }
    for (const other of Object.keys(elsewhere)) {
      const ids = await committedIds(other);
      elsewhere[other].forEach(id => { if (ids.has(id)) local.add(id); });
    }
    const dayAgo = asOf.getTime() - 864e5;
    let stale = 0;
    const kept = entries.filter(e => {
      if (!e.submissionId || local.has(e.submissionId)) return true;
      if (Date.parse(e.writtenAt) < dayAgo) stale++;
      return false;
    });
    if (stale) health.push(`${stale} entr${stale === 1 ? 'y' : 'ies'} from saves that never finished (over a day old); ignored`);
    return kept;
  }

  /* Entries stamped well ahead of this terminal's clock mean two clocks disagree:
   * either the writer's runs fast or this one runs slow. Report it, per terminal. */
  const AHEAD_MS = 60000;
  function clockHealth(entries, now, health) {
    const ahead = {};
    for (const e of entries) {
      const d = Date.parse(e.writtenAt) - now.getTime();
      if (d > AHEAD_MS && e.terminalId !== (FP.identity && FP.identity.terminalId)) ahead[e.terminalId] = Math.max(ahead[e.terminalId] || 0, d);
    }
    const list = Object.entries(ahead);
    if (!list.length || (FP.testClock && FP.testClock.used)) return;   // a rehearsal's test clock (0.62)
    health.push(`Clock check: ${list.map(([t, d]) => `${t} is at least ${Math.max(1, Math.floor(d / 60000))} min ahead`).join(', ')} of this terminal's clock. One of the clocks is wrong; times from these terminals will look out of order until it is fixed.`);
    FP.current.clockWarnings = list.map(([terminal, aheadMs]) => ({ terminal, aheadMs }));
    window.dispatchEvent(new CustomEvent('fp-clock', { detail: { ahead: FP.current.clockWarnings } }));
  }

  /* ---------- Folding ---------- */
  const actionOf = e => e.entry.slice(e.entry.indexOf('.') + 1);
  const byTime = (a, b) => a.writtenAt.localeCompare(b.writtenAt) || a.entryId.localeCompare(b.entryId);

  function sourceValue(src, item, asOf) {
    if (src && typeof src === 'object' && 'const' in src) return src.const;
    switch (src) {
      case '$firstAt': return item.firstAt;
      case '$lastAt': return item.lastAt;
      case '$asOf': return asOf.toISOString();
      case '$entryCount': return item.entryCount;
      case '$lastAction': return item.lastAction;
      case '$lastForm': return item.lastForm;
      default: return item.values[src] === undefined ? null : item.values[src];
    }
  }

  /* cutoff: the latest entry time included (default asOf). A live view passes
   * Infinity: everything saved is shown, even if a fast clock stamped it ahead. */
  function fold(structure, entries, asOf, health, cutoff) {
    const def = FP.structures.get(structure);
    const limit = cutoff == null ? asOf.getTime() : cutoff;
    const visible = entries.filter(e => Date.parse(e.writtenAt) <= limit).sort(byTime);

    // Corrections replace the values of the entry they name (in order), then drop out.
    const effective = new Map(visible.map(e => [e.entryId, Object.assign({}, e.values)]));
    const corrections = visible.filter(e => e.corrects);
    for (const c of corrections) {
      const target = effective.get(c.corrects);
      if (!target) { health.push(`Correction ${c.entryId} names an entry that wasn't found`); continue; }
      const v = Object.assign({}, c.values);
      delete v.reason;
      Object.assign(target, v);
    }
    const counted = visible.filter(e => !e.corrects);

    const items = new Map();
    for (const e of counted) {
      let it = items.get(e.item.id);
      if (!it) {
        it = { id: e.item.id, structure, rows: [], firstAt: e.writtenAt, firstRefs: e.refs, refs: {}, corrected: 0, site: e.site || null, sites: new Set() };
        items.set(e.item.id, it);
      }
      it.rows.push(e);
      if (e.site) it.sites.add(e.site);
      it.lastAt = e.writtenAt;
      it.lastUserId = e.userId || null;
      it.lastTerminalId = e.terminalId || null;
      it.lastAction = actionOf(e);
      it.lastForm = (e.form && e.form.id) || null;
      Object.entries(e.refs || {}).forEach(([role, r]) => { if (r != null) it.refs[role] = r; });
    }
    for (const c of corrections) {
      const target = visible.find(e => e.entryId === c.corrects);
      if (target && items.has(target.item.id)) items.get(target.item.id).corrected++;
    }

    const out = new Map();
    for (const it of items.values()) {
      const values = {};
      const declared = def.containers || {};
      const names = new Set(Object.keys(declared));
      it.rows.forEach(e => Object.keys(effective.get(e.entryId)).forEach(k => {
        if (!Object.values(declared).some(c => c.from === k)) names.add(k);
      }));
      const clashes = [];
      for (const name of names) {
        const spec = declared[name] || {};
        const field = spec.from || name;
        const rows = it.rows
          .filter(e => Object.prototype.hasOwnProperty.call(effective.get(e.entryId), field))
          .map(e => ({ value: effective.get(e.entryId)[field], at: e.writtenAt, terminal: e.terminalId }));
        const v = FP.summary.apply(spec.rule || 'latest', rows);
        if (!FP.fn.isNoData(v)) values[name] = v;
        if ((spec.rule || 'latest') === 'latest') {
          for (let i = 1; i < rows.length; i++) {
            const a = rows[i - 1], b = rows[i];
            if (a.terminal !== b.terminal && JSON.stringify(a.value) !== JSON.stringify(b.value)
              && Date.parse(b.at) - Date.parse(a.at) < CLASH_MINUTES * 6e4) {
              clashes.push({ container: name, values: [a.value, b.value], terminals: [a.terminal, b.terminal], at: b.at });
            }
          }
        }
      }
      const state = {
        id: it.id, structure, values, firstAt: it.firstAt, lastAt: it.lastAt, lastUserId: it.lastUserId, lastTerminalId: it.lastTerminalId, entryCount: it.rows.length,
        lastAction: it.lastAction, lastForm: it.lastForm, firstRefs: it.firstRefs, refs: it.refs, corrected: it.corrected, clashes, status: null,
        site: it.site, sites: Array.from(it.sites),
      };
      for (const [name, calc] of Object.entries(def.calculated || {})) {
        const args = {};
        Object.entries(calc.inputs || {}).forEach(([inp, src]) => { args[inp] = sourceValue(src, state, asOf); });
        state.values[name] = FP.fn.call(calc.fn, args, { asOf });
      }
      // Every declared value is a name the rules can use, blank until something is saved to it (ISBLANK(endedAt)).
      const declaredBlank = {};
      Object.keys(def.containers || {}).concat(Object.keys(def.calculated || {})).forEach(k => { declaredBlank[k] = null; });
      const facts = Object.assign(declaredBlank, state.values, { lastAction: state.lastAction, lastForm: state.lastForm, firstAt: state.firstAt, lastAt: state.lastAt, entryCount: state.entryCount });
      for (const rule of def.status || []) {
        const ok = FP.fn.evaluate(rule.when, facts, { asOf });
        if (ok === true) { state.status = rule.value; break; }
      }
      // The open rule decides which items stay in view after the live window passes them.
      if (def.open) state.open = FP.fn.evaluate(def.open, Object.assign(facts, { status: state.status }), { asOf }) === true;
      if (clashes.length) health.push(`${it.id}: ${clashes.map(c => `${c.container} set differently on ${c.terminals.join(' and ')}`).join('; ')}`);
      out.set(it.id, state);
    }
    // Rows: every counted entry with its corrected values, for lookups that read entries.
    // Each with the form that saved it, what it first held, and its corrections (for viewing and correcting records).
    const fixes = new Map();
    corrections.forEach(c => { if (!fixes.has(c.corrects)) fixes.set(c.corrects, []); fixes.get(c.corrects).push({ entryId: c.entryId, at: c.writtenAt, reason: (c.values || {}).reason || '', userId: c.userId, terminalId: c.terminalId, values: c.values }); });
    const rows = counted.map(e => ({
      entryId: e.entryId, entry: e.entry, action: actionOf(e), item: e.item, refs: e.refs || {},
      values: effective.get(e.entryId), writtenAt: e.writtenAt, terminalId: e.terminalId, site: e.site || null, userId: e.userId,
      form: e.form || null, saved: e.values || {}, corrections: fixes.get(e.entryId) || [],
    }));
    return { items: out, rows };
  }

  /* Raw entries per structure, re-read at most every 15 seconds; folding for
   * different as-of times reuses them. */
  const rawCache = new Map();
  async function loadEntriesCached(structure, fresh, since) {
    const k = structure + '|' + (since || '');
    const hit = rawCache.get(k);
    if (!fresh && hit && Date.now() - hit.at < 15000) return hit.raw;
    const raw = await loadEntries(structure, since || null);
    rawCache.set(k, { at: Date.now(), raw });
    return raw;
  }

  /* Where loading starts: the structure's live window (days back from asOf), or
   * further back if asked (opts.since, a Date), or everything (opts.history). */
  function sinceFor(structure, asOf, opts) {
    if (opts.history) return null;
    const def = FP.structures.get(structure);
    let t = def.live && def.live.days > 0 ? asOf.getTime() - def.live.days * 864e5 : null;
    if (t == null) return null;
    if (opts.since) t = Math.min(t, new Date(opts.since).getTime());
    return FP.util.localDate(new Date(t));
  }

  /* ---------- Load times (for the library's slow warning) ---------- */
  const perf = new Map(); // structure -> { runs: [ms...], entries, items, filesRead, live, at }
  let statsSavedAt = 0;
  const reported = new Set();
  function notePerf(structure, ms, result) {
    const p = perf.get(structure) || { runs: [] };
    p.runs = p.runs.concat(Math.round(ms)).slice(-5);
    Object.assign(p, { entries: result.entries, items: result.items.size, filesRead: result.filesRead, since: result.since, at: new Date().toISOString() });
    perf.set(structure, p);
    // Save this terminal's figures for the library: on a structure's first load, then every 30 minutes.
    if (!reported.has(structure) || Date.now() - statsSavedAt > 30 * 60000) { reported.add(structure); saveStats().catch(() => {}); }
  }
  const median = a => { const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
  // Forms (0.49): how long each took from opening to ready, so Admin can show the slow ones on each terminal.
  const formPerf = new Map();
  function noteForm(formId, ms) {
    const p = formPerf.get(formId) || { runs: [] };
    p.runs = p.runs.concat(Math.round(ms)).slice(-5);
    p.at = new Date().toISOString();
    formPerf.set(formId, p);
    if (p.runs.length === 1 || Date.now() - statsSavedAt > 30 * 60000) saveStats().catch(() => {});
  }
  async function saveStats() {
    if (!FP.identity || !FP.identity.terminalId) return;
    statsSavedAt = Date.now();
    const structures = {};
    perf.forEach((p, s) => { structures[s] = { loadMs: median(p.runs), runs: p.runs.length, entries: p.entries, items: p.items, filesRead: p.filesRead, windowed: !!p.since, at: p.at }; });
    const forms = {};
    formPerf.forEach((p, f) => { forms[f] = { readyMs: median(p.runs), worstMs: Math.max(...p.runs), runs: p.runs.length, at: p.at }; });
    const screen = typeof window !== 'undefined' ? `${window.screen.width}×${window.screen.height}` : null;
    await FP.files.writeJson(['_stats'], FP.identity.terminalId + '.json', { terminalId: FP.identity.terminalId, at: new Date().toISOString(), cores: navigator.hardwareConcurrency || null, screen, structures, forms }, true);
  }

  /* Write one month's checkpoint from its day files (every entry, finished or
   * not: a save's commit may land later). A closed month is compressed and gets
   * an IDs file. */
  async function writeMonth(structure, month, days, through, closed, now) {
    const entries = [];
    const files = {};
    const seen = new Set();
    for (const f of await listFiles(structure, days.filter(d => d <= through))) {
      const text = await FP.files.readText(f.parts, f.name);
      const lines = text == null ? [] : parseLines(text);
      files[f.key] = { lines: lines.length, size: text == null ? 0 : new Blob([text]).size };
      lines.forEach(e => { if (e && e.entryId && e.item && e.item.structure === structure && !seen.has(e.entryId)) { seen.add(e.entryId); entries.push(e); } });
    }
    const me = FP.identity.terminalId;
    const cp = {
      v: CHECKPOINT_VERSION, structure, month, closed, runtime: FP.version, writtenAt: now.toISOString(), terminalId: me,
      coveredThrough: through, files, fingerprint: fingerprint(entries.map(e => e.entryId)), entries,
    };
    if (closed) {
      const name = await FP.files.writeJsonGz(cpParts(structure, month), `${me}.json`, cp);
      await FP.files.writeJsonGz(cpParts(structure, month), `${me}.ids.json`, { v: CHECKPOINT_VERSION, structure, month, ids: uniq(entries.map(e => e.item.id)) });
      const c = Object.assign({ file: `${month}/${name}` }, cp);
      keepClosed(structure + '/' + month, c);
      return c;
    }
    await FP.files.writeJson(cpParts(structure, month), `${me}.json`, cp, true);
    return Object.assign({ file: `${month}/${me}.json` }, cp);
  }

  /* ---------- Public API ---------- */
  const cache = new Map();

  /* Values no form may ever read, whatever a lookup or source asks for (a user's PIN hash). */
  const HIDDEN = { users: ['pin'] };
  function publicValues(structure, values) {
    const hide = HIDDEN[structure];
    if (!hide || !values) return values;
    const out = Object.assign({}, values);
    hide.forEach(k => { delete out[k]; });
    return out;
  }

  /* IDs saved new more than once (0.49, a structure whose itemId says once): two terminals that saw the same rack
   * before either had synced the other's save. Each such item: its saves, by terminal and time. */
  function savedTwice(structure, entries, health) {
    const def = FP.structures.get(structure);
    if (!(def.itemId && def.itemId.once)) return [];
    const by = new Map();
    entries.forEach(e => { if (e.corrects) return; const l = by.get(e.item.id) || []; l.push(e); by.set(e.item.id, l); });
    const out = [];
    by.forEach((list, id) => {
      list.sort((a, b) => String(a.writtenAt).localeCompare(String(b.writtenAt)));
      const first = list[0].entry;
      const subs = new Map();
      list.filter(e => e.entry === first).forEach(e => { const k = e.submissionId || e.entryId; if (!subs.has(k)) subs.set(k, e); });
      if (subs.size > 1) out.push({ id, saves: Array.from(subs.values()).map(e => ({ entryId: e.entryId, terminalId: e.terminalId, at: e.writtenAt, userId: e.userId })) });
    });
    if (out.length) health.push(`Saved new more than once: ${out.slice(0, 5).map(x => `${x.id} (${x.saves.map(s => `${s.terminalId} ${new Date(s.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`).join(', ')})`).join('; ')}${out.length > 5 ? ` and ${out.length - 5} more` : ''}: check which is right and correct the other`);
    return out;
  }

  /* Every day file of a structure checked line by line (0.49, Admin > Records): { files, lines, chained, broken: [{ key, lines }] }. */
  async function verifyFiles(structure) {
    const out = { files: 0, lines: 0, chained: 0, broken: [] };
    for (const f of await listFiles(structure, await listDays(structure))) {
      const text = await FP.files.readText(f.parts, f.name);
      if (text == null) continue;
      const ch = await FP.files.verifyChain(text);
      out.files++; out.lines += ch.lines; out.chained += ch.chained;
      if (ch.broken.length) out.broken.push({ key: f.key, lines: ch.broken });
    }
    return out;
  }

  FP.current = {
    verifyFiles,
    noteForm,
    publicValues,
    /* Load and fold a structure. opts: { asOf, fresh, since (a Date: load at
     * least back to it), history (true: everything, ignoring the live window) }.
     * Results are cached for 15 seconds for the current time; an as-of in the
     * past is never cached. With a live window, items appear if they have
     * entries in the window or are still open by the structure's open rule. */
    async load(structure, opts) {
      opts = opts || {};
      const asOf = opts.asOf || new Date();
      const live = !opts.asOf;
      const plain = live && !opts.since && !opts.history;
      const hit = cache.get(structure);
      if (plain && !opts.fresh && hit && Date.now() - hit.at < 15000) return hit.result;
      const t0 = performance.now();
      const since = sinceFor(structure, asOf, opts);
      const raw = await loadEntriesCached(structure, opts.fresh, since);
      const health = raw.health.slice();
      const kept = await committedFilter(structure, raw.entries, health, asOf);
      const { items, rows } = fold(structure, kept, asOf, health, live ? Infinity : undefined);
      if (live) clockHealth(kept, asOf, health);
      const twice = savedTwice(structure, kept, health);
      const result = { structure, asOf, items, rows, health, twice, entries: kept.length, filesRead: raw.filesRead,
        since: raw.since, carryFrom: raw.carryFrom, months: raw.months,
        checkpoint: raw.checkpoints.length ? { file: raw.checkpoints[raw.checkpoints.length - 1], files: raw.checkpoints } : null, _raw: raw };
      if (plain) { cache.set(structure, { at: Date.now(), result }); notePerf(structure, performance.now() - t0, result); }
      return result;
    },

    /* This terminal's recent load times: { structure: { runs, entries, items, ... } }. */
    perf: () => Object.fromEntries(Array.from(perf, ([s, p]) => [s, Object.assign({ loadMs: median(p.runs) }, p)])),
    saveStats,

    /* One item. With a live window, an item outside it is looked up in the
     * older months (slower, only when asked). */
    async item(structure, id, opts) {
      opts = opts || {};
      const r = await FP.current.load(structure, opts);
      if (r.items.has(id) || !r.since) return r.items.get(id) || null;
      const health = [];
      const extra = [];
      const months = uniq((await listDays(structure)).map(monthOf)).filter(m => m < monthOf(r.since));
      await addHistory(structure, new Set([id]), months, e => { extra.push(e); return true; }, health);
      if (!extra.length) return null;
      const asOf = opts.asOf || new Date();
      const mine = r._raw.entries.filter(e => e.item.id === id).concat(extra);
      const kept = await committedFilter(structure, mine, health, asOf);
      return fold(structure, kept, asOf, health, opts.asOf ? undefined : Infinity).items.get(id) || null;
    },

    /* Checkpoint every month that needs one: each closed month once (compressed,
     * with its item IDs and, for a structure with an open rule, what carries
     * forward), and the month so far when the newest is over maxAgeHours old.
     * Returns what it did. */
    async checkpoint(structure, opts) {
      opts = opts || {};
      return FP.lock('fp-checkpoint:' + structure, async () => {
        const now = opts.now || new Date();
        const through = new Date(now);
        through.setDate(through.getDate() - 2);
        const coveredThrough = FP.util.localDate(through);
        const def = FP.structures.get(structure);
        const health = [];
        const me = FP.identity.terminalId;
        const days = (await listDays(structure)).filter(d => d <= coveredThrough);
        let months = uniq(days.map(monthOf));
        // What is open carries forward through months with no entries too (0.53.2), so a live window that starts
        // after a quiet spell still has a carry to start from, instead of reading the whole history.
        if (def.live && def.open && months.length) {
          const last = monthOf(coveredThrough);
          months = [];
          for (let m = monthOf(days[0]); m <= last; m = nextMonth(m)) months.push(m);
        }
        const done = { closed: [], carried: [], current: null };
        let carryEntries = [];
        for (const month of months) {
          const closed = lastDayOf(month) <= coveredThrough;
          let cp = await readMonth(structure, month, health);
          if (closed && !(cp && cp.closed)) {
            cp = await writeMonth(structure, month, days.filter(d => monthOf(d) === month), lastDayOf(month), true, now);
            done.closed.push(month);
          } else if (!closed) {
            const maxAge = (opts.maxAgeHours != null ? opts.maxAgeHours : 12) * 36e5;
            if (opts.force || !cp || cp.coveredThrough < coveredThrough || now - Date.parse(cp.writtenAt) >= maxAge) {
              await writeMonth(structure, month, days.filter(d => monthOf(d) === month), coveredThrough, false, now);
              done.current = month;
            }
            continue;
          }
          // What stays open at the end of this closed month (only with a live window and an open rule).
          if (!(def.live && def.open)) continue;
          const have = await readCarry(structure, month);
          if (have) { carryEntries = have.entries; continue; }
          const byId = new Map(carryEntries.map(e => [e.entryId, e]));
          const inCarry = new Set(carryEntries.map(e => e.item.id));
          cp.entries.forEach(e => byId.set(e.entryId, e));
          const older = new Set(cp.entries.map(e => e.item.id).filter(id => !inCarry.has(id)));
          if (older.size) await addHistory(structure, older, months.filter(m => m < month), e => { if (!byId.has(e.entryId)) byId.set(e.entryId, e); return true; }, health);
          const end = monthEnd(month);
          const pool = await committedFilter(structure, Array.from(byId.values()), health, end);
          const open = new Set(Array.from(fold(structure, pool, end, health).items.values()).filter(it => it.open).map(it => it.id));
          carryEntries = pool.filter(e => open.has(e.item.id));
          await FP.files.writeJsonGz(cpParts(structure, month), `${me}.carry.json`, {
            v: CHECKPOINT_VERSION, structure, month, key: carryKey(def), writtenAt: now.toISOString(), terminalId: me,
            openItems: open.size, fingerprint: fingerprint(carryEntries.map(e => e.entryId)), entries: carryEntries,
          });
          done.carried.push(`${month}: ${open.size} open`);
        }
        cache.delete(structure);
        Array.from(rawCache.keys()).forEach(k => { if (k.startsWith(structure + '|')) rawCache.delete(k); });
        const parts = [];
        if (done.closed.length) parts.push(`closed ${done.closed.join(', ')}`);
        if (done.carried.length) parts.push(`carried forward ${done.carried.join('; ')}`);
        if (done.current) parts.push(`${done.current} through ${coveredThrough}`);
        return { written: parts.length > 0, coveredThrough, summary: parts.join('; ') || 'every month is current', reason: parts.length ? '' : 'every month is current' };
      });
    },

    /* Launchers call this once after startup with the structures they use. A
     * minute or two later, when nobody is mid-save, it writes this terminal's
     * checkpoint for any structure whose newest one is over 12 hours old.
     * A terminal whose registry entry says checkpoints: false only reads them. */
    autoCheckpoint(structures, opts) {
      opts = opts || {};
      setTimeout(async () => {
        try {
          const me = await FP.identity.lookup(FP.identity.terminalId);
          if (me && me.checkpoints === false) return;
          for (const s of structures) {
            try { await FP.current.checkpoint(s); } catch (e) { console.warn('Checkpoint for ' + s + ' failed:', e); }
          }
        } catch (e) { console.warn('Checkpoint housekeeping failed:', e); }
      }, opts.delayMs != null ? opts.delayMs : 90000);
    },

    /* Fold entries already in memory (no files): for tests and previews. */
    foldEntries(structure, entries, asOf) {
      const health = [];
      const { items, rows } = fold(structure, entries, asOf || new Date(), health);
      return { structure, asOf: asOf || new Date(), items, rows, health };
    },

    clearCache() { cache.clear(); committedCache.clear(); rawCache.clear(); closedCache.clear(); idsCache.clear(); },
  };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-current'] = '0.62.0';
})();
