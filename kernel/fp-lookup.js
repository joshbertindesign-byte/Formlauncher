/* Form Platform kernel: lookups (step 7)
 * Load after fp-formula.js and fp-current.js.
 *
 * A lookup is a library function that reads a structure. It is set up by
 * picking, not by a formula:
 *
 *   FP.fn.define({
 *     name: 'CurrentSpec', kind: 'lookup', output: 'record',
 *     inputs: [{ name: 'profile', type: 'text' }, { name: 'measurement', type: 'text', required: false }],
 *     reads: {
 *       structure: 'spec-limits',
 *       from: 'items',                       // items: current values; entries: every entry
 *       match: { profile: 'profile', measurement: 'measurement' },   // container = input
 *       return: ['min', 'max'],              // one container (a value) or several (a record)
 *       summary: 'latest',                   // how many matches become one
 *     },
 *   });
 *
 * match keys: a container name, '$id' (the item ID), '$site' (the site it was
 * written at; pair it with SITE() for this terminal's site), 'ref:line' (a reference's
 * item ID) or 'ref:run.profile' (a value an open session stamped). The right
 * side is an input name, or { const: value }. A blank optional input matches anything.
 * A container holding a list matches when the list contains the value; a list
 * holding "all" matches every value (a procedure tagged profile: ["all"]).
 *
 * Time: lookups read as of the form's as-of time. By default (window 'form', also what an unset window means) they
 * read the recent data the structure keeps loaded; no date filter is applied, because no form has a date-range
 * setting (ctx.window = { from, to } is accepted if a caller ever supplies one). reads.window can instead be
 * { days: 30 } (a fixed baseline ending at the as-of time), 'all' (the whole history), or
 * 'always-current' (today's data even when reviewing an old record).
 *
 * Lookups only read data that has been loaded. FP.fn.callAsync and
 * FP.fn.evaluateAsync load what a function or formula needs, then run it;
 * a lookup whose data isn't loaded shows Waiting, never a wrong answer.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.fn || !FP.current) throw new Error('Load fp-formula.js and fp-current.js before fp-lookup.js');

  const STRUCTURE_RE = /^[a-z][a-z0-9-]{0,39}$/;
  const FROM = ['items', 'entries'];
  const err = message => ({ __fp: 'error', message });
  const waitingFor = names => ({ __fp: 'waiting', missing: names });
  const key = (structure, asOf) => structure + '@' + asOf.toISOString();

  /* ---------- Checking a lookup definition ---------- */
  function check(def, inputTypes) {
    const problems = [];
    const r = def.reads;
    if (!r || typeof r !== 'object') return ['A lookup needs reads: { structure, match, return }'];
    if (!STRUCTURE_RE.test(r.structure || '')) problems.push(`Bad structure ${r.structure}`);
    if (!FROM.includes(r.from || 'items')) problems.push(`from must be ${FROM.join(' or ')}`);
    for (const [k, v] of Object.entries(r.match || {})) {
      if (v && typeof v === 'object' && 'const' in v) continue;
      if (typeof v !== 'string' || !inputTypes[v]) problems.push(`match ${k} uses ${v}, which is not one of this lookup's inputs`);
    }
    const ret = r.return;
    if (!(ret === '*' || (typeof ret === 'string' && ret) || (Array.isArray(ret) && ret.length))) problems.push('return needs a container, a list of containers, or *');
    if (r.summary && !FP.summary.rules.includes(r.summary)) problems.push(`summary must be ${FP.summary.rules.join(', ')}`);
    // sum, average, min and max work on one container's values; over * or several containers they were ignored (F4).
    if (['sum', 'average', 'min', 'max'].includes(r.summary) && !(typeof ret === 'string' && ret !== '*')) problems.push(`summary ${r.summary} needs one container to return, not * or several: use latest, first, count or list`);
    if ((r.from || 'items') === 'items' && r.summary && !['latest', 'first', 'count', 'list'].includes(r.summary)) problems.push('Over items, summary must be latest, first, count or list');
    const w = r.window;
    if (w != null && !['form', 'all', 'always-current'].includes(w) && !(w && typeof w === 'object' && w.days > 0)) problems.push(`window must be form, all, always-current or { days }`);
    const many = r.summary === 'list';
    const single = typeof ret === 'string' && ret !== '*';
    const expect = r.summary === 'count' ? 'number' : many ? 'list' : single ? 'any' : 'record';
    if (def.output && def.output !== 'any' && expect !== 'any' && def.output !== expect) problems.push(`This lookup gives ${expect}, but the output is declared ${def.output}`);
    return problems;
  }

  /* ---------- Matching ---------- */
  function refId(r) { return r == null ? null : typeof r === 'string' ? r : r.id; }

  function pick(target, k, isRow) {
    if (k === '$id') return [target.item ? target.item.id : target.id];
    if (k === '$site') return [target.site || null]; // the site an entry was written at (an item: where it was created)
    if (k.startsWith('ref:')) {
      const [role, field] = k.slice(4).split('.');
      const r = target.refs ? target.refs[role] : undefined;
      const list = Array.isArray(r) ? r : [r];
      return list.filter(x => x != null).map(x => (field ? (typeof x === 'object' ? x[field] : undefined) : refId(x)));
    }
    const v = target.values ? target.values[k] : undefined;
    if (!Array.isArray(v)) return [v];
    return v.some(x => typeof x === 'string' && x.toLowerCase() === 'all') ? [ANY] : v;
  }

  const ANY = { any: true }; // a list containing "all"
  const same = (a, b) => {
    if (a === ANY) return true;
    if (a == null || b == null) return false;
    // A number matches a number, or text that is one; an empty value is not 0 (F28).
    if (typeof a === 'number' || typeof b === 'number') return String(a).trim() !== '' && String(b).trim() !== '' && Number(a) === Number(b);
    return String(a).toLowerCase() === String(b).toLowerCase();
  };

  function matches(target, match, args, isRow) {
    for (const [k, v] of Object.entries(match || {})) {
      const want = v && typeof v === 'object' && 'const' in v ? v.const : args[v];
      if (want == null || want === '') continue; // blank optional input: match anything
      if (!pick(target, k, isRow).some(x => same(x, want))) return false;
    }
    return true;
  }

  /* A record: id and the containers asked for. Records in a list (summary: list) also carry facts
   * every record has, marked $ so they never clash with a container: $at (when it was written, or an
   * item's last change), $site, and for items $firstAt, $status and $action (last action); for
   * entries $action; items also $open (0.60: open by the structure's kind). Charts and tables use these. */
  function shape(target, ret, isRow, facts, structure) {
    const vals = FP.current.publicValues(structure, target.values || {});
    const hidden = c => !(c in FP.current.publicValues(structure, { [c]: 1 }));   // hidden values are never read
    if (typeof ret === 'string' && ret !== '*') return hidden(ret) ? FP.fn.NODATA : vals[ret] === undefined ? null : vals[ret];
    const id = isRow ? target.item.id : target.id;
    const meta = !facts ? {} : isRow
      ? { $at: target.writtenAt, $site: target.site || null, $action: target.action || null, $form: (target.form && target.form.id) || null, $entry: target.entryId || null }
      : { $at: target.lastAt, $firstAt: target.firstAt, $site: target.site || null, $status: target.status == null ? null : target.status, $action: target.lastAction || null, $form: target.lastForm || null,
        $open: FP.kinds ? FP.kinds.isOpen(structure, target) : null };   // open by its kind (0.60)
    // A whole item: id for older formulas and media, $id like a source's items, so item.$id works in both.
    if (ret === '*') return Object.assign({ id, $id: id }, vals, meta);
    const out = { id };   // only the values asked for: a name not among them stays an error
    ret.forEach(c => { if (!hidden(c)) out[c] = vals[c] === undefined ? null : vals[c]; });
    return Object.assign(out, meta);
  }

  function windowFor(r, ctx, asOf) {
    const w = r.window == null ? 'form' : r.window;
    if (w === 'all' || w === 'always-current') return null;
    if (w && typeof w === 'object' && w.days) return { from: new Date(asOf.getTime() - w.days * 864e5), to: asOf };
    return ctx.window ? { from: ctx.window.from ? new Date(ctx.window.from) : null, to: ctx.window.to ? new Date(ctx.window.to) : null } : null;
  }
  const inWindow = (iso, win) => {
    if (!win) return true;
    const t = Date.parse(iso);
    return (!win.from || t >= win.from.getTime()) && (!win.to || t <= win.to.getTime());
  };

  /* ---------- Running a lookup against loaded data ---------- */
  function run(f, args, ctx) {
    const r = f.reads;
    const current = r.window === 'always-current';
    const asOf = current ? (ctx.now || new Date()) : ctx.asOf;
    const data = ctx.data && (ctx.data[key(r.structure, asOf)] || (current && ctx.data[r.structure + '@now']));
    if (!data) return waitingFor([`data from ${r.structure}`]);
    const win = windowFor(r, ctx, asOf);
    const from = r.from || 'items';

    if (from === 'items') {
      let list = Array.from(data.items.values()).filter(it => matches(it, r.match, args, false) && inWindow(it.lastAt, win));
      list.sort((a, b) => a.lastAt.localeCompare(b.lastAt));
      const rule = r.summary || 'latest';
      if (rule === 'count') return list.length;
      if (rule === 'list') return list.map(it => shape(it, r.return, false, true, r.structure));
      if (!list.length) return FP.fn.NODATA;
      return shape(rule === 'first' ? list[0] : list[list.length - 1], r.return, false, false, r.structure);
    }

    const rows = data.rows.filter(row => (!r.action || row.action === r.action) && matches(row, r.match, args, true) && inWindow(row.writtenAt, win));
    const rule = r.summary || 'latest';
    if (rule === 'count' && (r.return === '*' || Array.isArray(r.return))) return rows.length;
    if (typeof r.return === 'string' && r.return !== '*') {
      if (!(r.return in FP.current.publicValues(r.structure, { [r.return]: 1 }))) return FP.fn.NODATA;   // hidden values are never read
      return FP.summary.apply(rule, rows.map(row => ({ value: row.values[r.return], at: row.writtenAt })));
    }
    if (rule === 'list') return rows.map(row => shape(row, r.return, true, true, r.structure));
    if (!rows.length) return FP.fn.NODATA;
    const sorted = rows.slice().sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));
    return shape(rule === 'first' ? sorted[0] : sorted[sorted.length - 1], r.return, true, false, r.structure);
  }

  FP.fn.setLookupHooks({ run, check });

  /* ---------- Loading what a function or formula needs ---------- */
  FP.lookup = {
    /* Load every structure the target reaches, as of ctx.asOf (or now).
     * Returns a ctx ready for FP.fn.call / FP.fn.evaluate. */
    async prepare(target, ctx) {
      ctx = Object.assign({}, ctx || {});
      const live = !ctx.asOf;
      ctx.asOf = ctx.asOf || new Date();
      ctx.now = ctx.now || new Date();
      ctx.data = Object.assign({}, ctx.data || {});
      for (const need of FP.fn.needs(target)) {
        const asOf = need.current ? ctx.now : ctx.asOf;
        const k = key(need.structure, asOf);
        if (ctx.data[k]) continue;
        // How far back this lookup reads, so a structure's live window can be widened for it.
        const reach = need.reach || [];
        const opts = live || need.current ? {} : { asOf };
        if (reach.includes('history')) opts.history = true;
        else {
          const backs = reach.map(r => (r && r.days ? asOf.getTime() - r.days * 864e5 : r === 'form' && ctx.window && ctx.window.from ? Date.parse(ctx.window.from) : null)).filter(t => t != null);
          if (backs.length) opts.since = new Date(Math.min.apply(null, backs));
        }
        // Live reads use the 15-second cache; past as-of times fold from cached raw entries.
        ctx.data[k] = await FP.current.load(need.structure, opts);
        if (live || need.current) ctx.data[k] = Object.assign({}, ctx.data[k], { asOf });
      }
      return ctx;
    },
  };

  /* Run a library function after loading what it needs. */
  FP.fn.callAsync = async (name, args, ctx) => FP.fn.call(name, args, await FP.lookup.prepare(name, ctx));
  /* Evaluate a formula after loading what it needs. */
  FP.fn.evaluateAsync = async (formula, inputs, ctx) => FP.fn.evaluate(formula, inputs, await FP.lookup.prepare(formula, ctx));

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-lookup'] = '0.68.0';
})();
