/* Form Platform: sources (kernel 0.28)
 * Load after fp-media.js, before fp-forms.js.
 *
 * A source is a named connection from a form to data, declared once at the top of the form. It never
 * says read or write: it says which item or items. The form's controls choose the direction: entry
 * fields save to an item source (check.measuredOD); display fields and visuals read any source
 * (check.measuredOD, openRacks, spec.max).
 *
 *   { name: 'check', kind: 'item', structure: 'od-checks', id: { generate: true } }
 *        one item: id { field: 'rackId' } (entered, scanned or picked in that field),
 *        { fixed: 'A1' }, { generate: true } (new each save, by the structure's ID rule), or
 *        { where: 'AND(status = "Running", line = form.line)' } (the latest item that matches: the run on now), or
 *        { open: { line: 'line' } } (0.60: the open one whose line is the form's line field: the run on this line)
 *        fill: true (0.60): fields saving to it start at the item's values (FP.kinds.form)
 *   { name: 'openRacks', kind: 'items', structure: 'racks', filter: 'AND(status <> "Shipped", line = form.line)' }
 *        open: true (0.60): only the open ones, by the structure's kind (a list's in use; runs not ended…)
 *        many items, read only; the filter sees each item's values and facts (status, lastAction, lastForm…)
 *        and the form's own values under form.
 *   { name: 'spec', kind: 'value', formula: 'CurrentSpec(profile, "lineal")' }
 *        a lookup's result or any formula, read only
 *
 * A source can use the form's fields and the sources above it.
 *
 * FP.sources.normalize(def) turns sources into what the save path already understands (writes to
 * structure.container, and items: which item of each structure), so a form with sources and a form
 * written before sources save the same way. FP.sources.fromLegacy(def) does the opposite for the
 * editor: each structure a form saves to becomes an item source.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.fn || !FP.current) throw new Error('Load fp-lookup.js before fp-sources.js');

  const KINDS = ['item', 'items', 'value'];
  const USES = ['read', 'write', 'both'];
  const writable = (src, c) => !src.values || src.values[c] === 'write' || src.values[c] === 'both';
  const BUILT_IN = ['users', 'sites', 'submissions', 'acknowledgments', 'media-library'];   // forms read them; only their own screens change them
  const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
  const SLUG_RE = /^[a-z][a-z0-9-]{0,39}$/;
  const RESERVED = new Set(['form', 'true', 'false', 'waiting']);
  const clone = x => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const target = w => { const i = String(w || '').indexOf('.'); return i > 0 ? { structure: w.slice(0, i), container: w.slice(i + 1) } : null; };
  const publicValues = (structure, values) => FP.current.publicValues(structure, values);
  /* An item as sources and lists see it: its values, its ID and its facts. */
  function shapeItem(structure, it) {
    return Object.assign({ id: it.id }, publicValues(structure, it.values || {}), {
      $id: it.id, $status: it.status == null ? null : it.status, $at: it.lastAt || null, $firstAt: it.firstAt || null,
      $action: it.lastAction || null, $form: it.lastForm || null, $site: it.site || null, $entryCount: it.entryCount == null ? null : it.entryCount,
      $by: it.lastUserId || null, $terminal: it.lastTerminalId || null,
      // Open by its kind (0.60): a run until it ends, an order until done or cancelled, a list's item while in use.
      $open: FP.kinds ? FP.kinds.isOpen(structure, it) : null,
    });
  }
  /* The facts a filter can name bare, besides the item's values. */
  const factsOf = it => ({ open: it.$open, status: it.$status, lastAction: it.$action, lastForm: it.$form, firstAt: it.$firstAt, lastAt: it.$at, entryCount: it.$entryCount, site: it.$site });
  /* A structure's declared values, blank: a filter can name one an item hasn't been given yet (ISBLANK(endAt)). */
  const declaredBlank = structure => { const d = FP.structures.get(structure) || {}; const o = {}; Object.keys(d.containers || {}).concat(Object.keys(d.calculated || {})).forEach(k => { o[k] = null; }); return o; };

  const list = def => (Array.isArray(def && def.sources) ? def.sources.filter(Boolean) : []);
  const byName = def => new Map(list(def).map(s => [s.name, s]));

  /* ---------- Checking ---------- */
  function check(def) {
    const p = [];
    if (def.sources == null) return p;
    if (!Array.isArray(def.sources)) return ['sources must be a list'];
    // A sub-form also sees the master form's names (and each, index); a master form sees its sub-forms by name.
    const fieldNames = new Set((def.fields || []).map(f => f && f.name).filter(Boolean)
      .concat(Array.isArray(def.__outer) ? def.__outer : [], (Array.isArray(def.subforms) ? def.subforms : []).map(x => x && x.name).filter(Boolean)));
    const buttonNames = new Set((def.buttons || []).map(b => b && b.name).filter(Boolean));
    const seen = new Set();
    const formulaOk = (where, f) => {
      const s = FP.fn.syntax(String(f || ''));
      if (s.error) p.push(`${where}: ${s.error}`);
      else s.calls.forEach(n => { if (!FP.fn.builtins().includes(n.toUpperCase()) && !FP.fn.get(n)) p.push(`${where}: no function named ${n}`); });
    };
    def.sources.forEach((s, i) => {
      const where = `Source ${s && s.name ? s.name : i + 1}`;
      if (!s || typeof s !== 'object') { p.push(`${where}: must be { name, kind, … }`); return; }
      if (!NAME_RE.test(s.name || '') || RESERVED.has(String(s.name).toLowerCase())) { p.push(`${where}: needs a name (letters, digits, _; starting with a letter; not form)`); return; }
      if (seen.has(s.name)) p.push(`${where}: the name is used twice`);
      if ((def.fields || []).some(f => f && f.name === s.name)) p.push(`${where}: a field has the same name; rename one`);
      if (buttonNames.has(s.name)) p.push(`${where}: a button has the same name; rename one`);
      seen.add(s.name);
      if (!KINDS.includes(s.kind)) { p.push(`${where}: kind must be ${KINDS.join(', ')}`); return; }
      const known = { item: ['name', 'kind', 'structure', 'id', 'label', 'values', 'carry', 'fill'], items: ['name', 'kind', 'structure', 'filter', 'label', 'values', 'open'], value: ['name', 'kind', 'formula', 'label'] }[s.kind];
      Object.keys(s).filter(k => !known.includes(k)).forEach(k => p.push(`${where}: ${k} is not a setting of a ${s.kind} source`));
      if (s.kind === 'item' || s.kind === 'items') {
        if (!SLUG_RE.test(s.structure || '')) p.push(`${where}: needs a structure`);
      }
      if (s.kind === 'item') {
        const id = s.id || {};
        const ways = ['field', 'fixed', 'generate', 'where', 'open'].filter(k => id[k] != null && id[k] !== false);
        if (ways.length !== 1) p.push(`${where}: which item? Choose the field its ID is entered in, a fixed ID, a new one each save, or the open one`);
        // The open one (0.60): { open: { its value: a field of the form } }, every pair matching; {} for the latest open one.
        if (id.open != null) {
          if (typeof id.open !== 'object' || Array.isArray(id.open)) p.push(`${where}: the open one is { its value: the form's field }`);
          else Object.entries(id.open).forEach(([k, v]) => {
            if (!/^[A-Za-z_$][A-Za-z0-9_]*$/.test(k)) p.push(`${where}: the open one whose ${k}: not a value name`);
            if (!fieldNames.has(v)) p.push(`${where}: the open one whose ${k} is ${v}, which is not a field of this form`);
          });
        }
        if (id.field != null && !fieldNames.has(id.field)) p.push(`${where}: id field ${id.field} is not a field of this form`);
        if (id.fixed != null && (typeof id.fixed !== 'string' || !id.fixed.trim())) p.push(`${where}: id fixed must be an item ID`);
        Object.keys(id).filter(k => !['field', 'fixed', 'generate', 'prefix', 'where', 'open'].includes(k)).forEach(k => p.push(`${where}: id ${k} is not a setting`));
        if (id.where != null) { if (typeof id.where !== 'string' || !id.where.trim()) p.push(`${where}: say which item: the one where … (a rule)`); else formulaOk(`${where} (the one where)`, id.where); }
      }
      if (s.kind === 'items' && s.filter != null) formulaOk(`${where} filter`, s.filter);
      if (s.kind === 'items' && s.open != null && typeof s.open !== 'boolean') p.push(`${where}: Only open ones is yes or no`);
      if (s.values != null) {
        if (typeof s.values !== 'object' || Array.isArray(s.values)) p.push(`${where}: values is { name: "read" | "write" | "both" }`);
        else Object.entries(s.values).forEach(([k, v]) => { if (!/^[A-Za-z_$][A-Za-z0-9_]*$/.test(k) || !USES.includes(v)) p.push(`${where}: value ${k} must be read, write or both`); });
      }
      if (s.kind === 'value') { if (!s.formula) p.push(`${where}: needs a formula`); else formulaOk(`${where} formula`, s.formula); }
      // Carry (0.50): values copied from this item onto the record a save makes, e.g. the run's shift and line onto each rack.
      carriesOf(s).forEach((c, k) => {
        const cw = `${where}, carry ${k + 1}`;
        if (!c || typeof c !== 'object') { p.push(`${cw}: is { to, values }`); return; }
        if (!NAME_RE.test(c.to || '')) p.push(`${cw}: say which source's item the values go onto (to)`);
        if (!c.values || typeof c.values !== 'object' || !Object.keys(c.values).length) p.push(`${cw}: say which values it carries`);
        if (c.when != null) formulaOk(`${cw} (when)`, c.when);
        Object.keys(c).filter(x => !['to', 'values', 'when'].includes(x)).forEach(x => p.push(`${cw}: ${x} is not a setting`));
      });
    });
    // Carried values land on a one-item source whose values are ticked write.
    list(def).forEach(s => carriesOf(s).forEach(c => {
      if (!c || !c.to) return;
      const t = byName(def).get(c.to);
      if (!t || t.kind !== 'item') { p.push(`Source ${s.name}: carries to ${c.to}, which is not a one-item source of this form`); return; }
      pairsOf(s, c).forEach(([to]) => { if (!writable(t, to)) p.push(`Source ${s.name}: carries ${to} to ${c.to}, but ${to} isn't ticked write on ${c.to}`); });
    }));
    // Saving: to one-item sources (any number, the same structure twice included), or the same value to every item of a list.
    const src = byName(def);
    (def.fields || []).forEach(f => [f && f.writes, f && f.snapshot].forEach(w => {
      const t = target(w);
      if (!t) return;
      const s = src.get(t.structure);
      if (s && s.kind === 'value') p.push(`Field ${f.name}: ${s.name} is a worked-out value; a field saves to an item, or to every item of a list`);
      if (s && s.kind === 'items' && w === f.snapshot) p.push(`Field ${f.name}: a copy is kept on one item; ${s.name} is a list (save to every item of it with an entry field)`);
      if (s && s.kind !== 'value' && !writable(s, t.container)) {
        const near = Object.keys(s.values || {}).find(k => k !== t.container && k.toLowerCase() === t.container.toLowerCase());
        p.push(near ? `${f.label || f.name} saves to ${s.name}.${t.container}, but ${s.name} has no value ${t.container}. Did you mean ${near}?` : `${f.label || f.name} saves to ${s.name}.${t.container}, but ${t.container} isn't ticked write on ${s.name}`);
      }
      if (s && s.kind !== 'value' && BUILT_IN.includes(s.structure)) p.push(`Field ${f.name}: ${s.structure} is built into the kernel; forms read it, but only its own screens change it`);
    }));
    // A table with a row per item of a list: the list must be a source of this form, its changed values ticked write.
    (def.fields || []).forEach(f => {
      if (!f || !f.rowsFrom) return;
      const s = src.get(f.rowsFrom);
      const label = f.label || f.name;
      if (!s) { p.push(`${label}: its rows come from ${f.rowsFrom}, which is not a source of this form`); return; }
      if (s.kind !== 'items') { p.push(`${label}: its rows come from ${f.rowsFrom}, which isn't a list (pick all items, or all items where…)`); return; }
      if (f.writes) p.push(`${label}: a table of a list's items saves each row to its own item, so it can't also save to ${f.writes}`);
      (f.columns || []).filter(c => c && c.edit).forEach(c => {
        if (BUILT_IN.includes(s.structure)) p.push(`${label}: ${s.structure} is built into the kernel; its values can be shown but not changed`);
        else if (!writable(s, c.name)) p.push(`${label}: ${c.label || c.name} can be changed, but ${c.name} isn't ticked write on ${s.name}`);
      });
    });
    // Every name a formula reads is a field or a source of this form (a list of buttons' caption and tone also see item).
    const sourceNames = new Set(def.sources.filter(x => x && x.name).map(x => x.name));
    const nameOk = (where, formula, extra) => {
      if (def.__legacy || formula == null || formula === '') return;
      const s = FP.fn.syntax(String(formula));
      if (s.error) return;
      s.refs.forEach(n => {
        if (fieldNames.has(n) || sourceNames.has(n) || (extra && extra.includes(n))) return;
        const near = Array.from(fieldNames).concat(Array.from(sourceNames)).find(x => x.toLowerCase() === n.toLowerCase());
        p.push(`${where}: ${n} isn't a field or source of this form${near ? ` (did you mean ${near}?)` : ''}`);
      });
    };
    (def.fields || []).forEach(f => {
      if (!f || !f.name) return;
      const where = `Field ${f.name}`;
      if (f.control !== 'table') nameOk(where, f.formula);
      nameOk(`${where} (when)`, f.when);
      nameOk(`${where} options`, f.optionsFrom);
      nameOk(`${where} each option says`, f.optionLabel, ['item']);
      nameOk(`${where} starting value`, f.defaultFrom);
      nameOk(`${where} must be true`, f.rule);
      ['warn', 'limits'].forEach(k => ['min', 'max'].forEach(e => { const x = f[k] && f[k][e]; if (typeof x === 'string') nameOk(`${where} ${k} ${e}`, x); }));
      if (f.control === 'buttons') { nameOk(`${where} caption`, f.caption, ['item']); nameOk(`${where} colour`, f.tone, ['item']); }
      // Saving to a name that isn't a source goes nowhere.
      [['saves to', f.writes], ['keeps a copy in', f.snapshot]].forEach(([verb, w]) => {
        const t = target(w);
        if (t && !def.__legacy && !src.has(t.structure)) p.push(`${where}: ${verb} ${w}, but there's no source called ${t.structure}`);
      });
    });
    (Array.isArray(def.buttons) ? def.buttons : []).forEach(b => {
      if (!b || !b.name) return;
      nameOk(`Button ${b.name} (when)`, b.when);
      Object.entries(b.prefill && typeof b.prefill === 'object' ? b.prefill : {}).forEach(([k, f]) => nameOk(`Button ${b.name} prefill ${k}`, f));
    });
    (Array.isArray(def.acknowledge) ? def.acknowledge : []).forEach(a => {
      if (!a || !a.name) return;
      nameOk(`Read before starting ${a.name}`, a.formula);
      nameOk(`Read before starting ${a.name} (when)`, a.when);
    });
    def.sources.forEach(x => { if (x && x.kind === 'value' && x.name) nameOk(`Source ${x.name} formula`, x.formula); });
    // In a filter or a "the one where", names are the item's values; form.name must be a field.
    if (!def.__legacy) def.sources.forEach(x => {
      if (!x || !x.name) return;
      [x.filter, x.id && x.id.where].forEach(fx => {
        if (!fx) return;
        // form.name: a field, or a source listed above this one (worked out first).
        const above = new Set(def.sources.slice(0, def.sources.indexOf(x)).filter(y => y && y.name).map(y => y.name));
        (String(fx).match(/\bform\.([A-Za-z_][A-Za-z0-9_]*)/g) || []).forEach(m => { const n = m.slice(5); if (!fieldNames.has(n) && !above.has(n)) p.push(`Source ${x.name}: form.${n} isn't a field of this form, or a source above it`); });
      });
    });
    // Two fields saving to the same container in one save would keep only one of them.
    const norm = normalize(def);
    const dest = new Map();
    (norm.fields || []).forEach(f => {
      if (!f || !f.writes) return;
      if (!dest.has(f.writes)) dest.set(f.writes, []);
      dest.get(f.writes).push(f);
    });
    dest.forEach((fs, w) => {
      if (fs.length > 1 && !fs.every(f => f.when)) p.push(`${fs.map(f => f.label || f.name).join(' and ')} ${fs.length > 2 ? 'all' : 'both'} save to ${w}: one save keeps only one of them. Give each a "shown when" so only one is ever shown, or save them to different containers`);
    });
    return p;
  }
  /* Same check for a form that has no sources: the duplicate-container rule. */
  function checkLegacy(def) {
    return Array.isArray(def.sources) ? [] : check(Object.assign({}, def, { sources: [], __legacy: true }));
  }

  /* ---------- Into what the save path understands ---------- */
  /* The key each item source saves under: its structure, or structure~source for a second (third…) item of the
   * same structure in one form (from rack and to rack). The save turns a key back into its structure. */
  function itemKeys(def) {
    const keys = new Map(), taken = new Set();
    list(def).filter(s => s.kind === 'item' && s.structure).forEach(s => {
      const k = taken.has(s.structure) ? `${s.structure}~${s.name}` : s.structure;
      taken.add(s.structure);
      keys.set(s.name, k);
    });
    return keys;
  }
  const realStructure = k => String(k == null ? '' : k).split('~')[0];
  /* A source's carries (0.50): carry: { to, values: [names] | { name: formula }, when } or a list of them. A bare name
   * is that value of the source (shift → runRec.shift); "= run" (or anything that isn't a bare name) is a formula;
   * blank is the value of the same name. */
  const carriesOf = s => (s && s.carry ? (Array.isArray(s.carry) ? s.carry : [s.carry]) : []);
  const BARE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
  const pairsOf = (s, c) => (Array.isArray(c.values) ? c.values.map(v => [String(v), String(v)]) : Object.entries(c.values || {}).map(([k, v]) => [k, String(v)]))
    .map(([to, from]) => [to, from === '' ? `${s.name}.${to}` : /^=/.test(from) ? from.slice(1).trim() : BARE.test(from) ? `${s.name}.${from}` : from]);
  /* Each carried value as a field the form works out and keeps a copy of on save, off the form. */
  function carryFields(def) {
    const out = [];
    list(def).forEach(s => carriesOf(s).forEach((c, k) => {
      if (!c || !c.to) return;
      pairsOf(s, c).forEach(([to, formula]) => out.push(Object.assign({ name: `carry_${s.name}_${k}_${to}`.slice(0, 40), control: 'value', label: to, formula, snapshot: `${c.to}.${to}`, carried: true }, c.when ? { when: c.when } : {})));
    }));
    return out;
  }

  /* The open one, in words: it is open and its line is the form's line. */
  const openText = o => ['it is open'].concat(Object.entries(o || {}).map(([k, v]) => `its ${k} is the form's ${v}`)).join(' and ');

  function normalize(def) {
    if (!def || !Array.isArray(def.sources) || !def.sources.length) return def;
    const d = clone(def);
    const carried = carryFields(d);
    if (carried.length) d.fields = (d.fields || []).concat(carried);
    const src = byName(d);
    const keys = itemKeys(d);
    // A field saving to a list source saves the same value to every item of the list: kept by source name, listed in lists.
    const toStructure = w => {
      const t = target(w); const s = t && src.get(t.structure);
      if (s && s.kind === 'item') return `${keys.get(s.name)}.${t.container}`;
      if (s && s.kind === 'items' && s.structure) { d.lists = Object.assign({}, d.lists || {}, { [s.name]: s.structure }); return w; }
      return w;
    };
    d.items = Object.assign({}, d.items || {});
    const used = new Set();
    (d.fields || []).forEach(f => {
      if (!f) return;
      ['writes', 'snapshot'].forEach(k => {
        if (!f[k]) return;
        const t = target(f[k]);
        const s = t && src.get(t.structure);
        if (s && s.kind === 'item') used.add(s.name);
        f[k] = toStructure(f[k]);
      });
    });
    (d.buttons || []).forEach(b => { if (b && b.link && src.get(b.link) && src.get(b.link).kind === 'item') { used.add(b.link); b.link = keys.get(b.link); } });
    list(d).filter(s => s.kind === 'item' && used.has(s.name)).forEach(s => {
      const id = s.id || {};
      d.items[keys.get(s.name)] = id.field ? { field: id.field } : id.fixed ? { fixed: id.fixed } : id.where ? { where: id.where, source: s.name }
        : id.open ? { where: openText(id.open), source: s.name } : Object.assign({ generate: true }, id.prefix ? { prefix: id.prefix } : {});
    });
    if (!Object.keys(d.items).length) delete d.items;
    return d;
  }

  /* One of a structure's items: od-checks → od-check, deliveries → delivery. */
  const singular = st => String(st).replace(/(^|[-_ ])([a-z]{1,2})ies$/i, '$1$2ie').replace(/([a-z]{3,})ies$/i, '$1y').replace(/(ss)$/, '$1').replace(/([^s])s$/, '$1');
  /* A name for a source from its structure: od-checks → odChecks; unique among taken. */
  function nameFor(structure, taken) {
    let n = String(structure).split('-').map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('');
    if (!NAME_RE.test(n)) n = 'src' + n.replace(/[^A-Za-z0-9_]/g, '');
    let out = n, i = 2;
    while (taken.has(out)) out = n + i++;
    return out;
  }
  /* A form written before sources, in sources terms: each structure it saves to becomes an item source. */
  function fromLegacy(def) {
    if (!def || Array.isArray(def.sources)) return def;
    const d = clone(def);
    const taken = new Set((d.fields || []).map(f => f && f.name).concat((d.buttons || []).map(b => b && b.name)).filter(Boolean));
    const structures = [];
    const add = st => { if (st && !structures.includes(st)) structures.push(st); };
    Object.keys(d.items || {}).forEach(add);
    (d.fields || []).forEach(f => [f && f.writes, f && f.snapshot].forEach(w => { const t = target(w); if (t) add(t.structure); }));
    const names = {};
    d.sources = structures.map(st => {
      const name = nameFor(singular(st), taken); taken.add(name); names[st] = name;   // one item: odCheck, delivery
      const cfg = (d.items || {})[st] || { generate: true };
      return { name, kind: 'item', structure: st, id: cfg.field ? { field: cfg.field } : cfg.fixed ? { fixed: cfg.fixed } : Object.assign({ generate: true }, cfg.prefix ? { prefix: cfg.prefix } : {}) };
    });
    (d.fields || []).forEach(f => ['writes', 'snapshot'].forEach(k => { const t = f && target(f[k]); if (t && names[t.structure]) f[k] = `${names[t.structure]}.${t.container}`; }));
    inferValues(d);
    (d.buttons || []).forEach(b => { if (b && b.link && names[b.link]) b.link = names[b.link]; });
    delete d.items;
    if (!d.sources.length) delete d.sources;
    return d;
  }

  /* Fill in, for sources that don't say, which of their values the form reads and writes: from the
   * fields that save to them, the tables built on them, and the formulas that name source.value. */
  function inferValues(def) {
    const src = byName(def);
    const marks = new Map();
    const mark = (name, c, use) => {
      const s = src.get(name);
      if (!s || s.kind === 'value' || s.values || !c || c[0] === '$') return;
      if (!marks.has(name)) marks.set(name, {});
      const m = marks.get(name);
      m[c] = !m[c] || m[c] === use ? use : 'both';
    };
    (def.fields || []).forEach(f => {
      if (!f) return;
      [f.writes, f.snapshot].forEach(w => { const t = target(w); if (t) mark(t.structure, t.container, 'write'); });
      if (f.rowsFrom) (f.columns || []).forEach(c => c && mark(f.rowsFrom, c.name, c.edit ? 'both' : 'read'));
    });
    const formulas = [];
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(k => { const v = o[k]; if (typeof v === 'string' && ['formula', 'when', 'optionsFrom', 'optionLabel', 'defaultFrom', 'rule'].includes(k)) formulas.push(v); else if (v && typeof v === 'object') walk(v); });
    })({ fields: def.fields, buttons: def.buttons, layout: def.layout, acknowledge: def.acknowledge, sources: list(def).filter(s => s.kind === 'value') });
    formulas.forEach(f => (FP.fn.scan ? FP.fn.scan(f) : []).forEach(t => {
      if (t.type !== 'name' || t.text.indexOf('.') < 0) return;
      const [root, c] = t.text.split('.');
      mark(root, c, 'read');
    }));
    list(def).forEach(s => { if ((s.kind === 'item' || s.kind === 'items') && !s.values) s.values = marks.get(s.name) || {}; });
    return def;
  }

  /* ---------- Working out what each source holds ---------- */
  /* Returns { name: value } for the form's sources, in order. inputs: the form's values.
   * opts.generated(structure): the ID this record has been given, if it has one yet. */
  async function evaluate(def, inputs, ctx, opts) {
    opts = opts || {};
    const out = {};
    const vals = Object.assign({}, inputs);
    const asOf = ctx && ctx.asOf ? { asOf: ctx.asOf } : {};
    const keys = itemKeys(def);
    for (const s of list(def)) {
      let v;
      try {
        if (s.kind === 'value') v = await FP.fn.evaluateAsync(s.formula, vals, ctx || {});
        else if (s.kind === 'item' && (s.id || {}).where) {
          // The latest item that matches the rule: the run on now, the open order for this line.
          const data = await FP.current.load(s.structure, asOf);
          const prepared = await FP.lookup.prepare(s.id.where, ctx || {});
          const hits = Array.from(data.items.values()).map(it => shapeItem(s.structure, it))
            .filter(it => FP.fn.evaluate(s.id.where, Object.assign({ form: vals }, declaredBlank(s.structure), factsOf(it), it), prepared) === true)
            .sort((a, b) => String(b.$at).localeCompare(String(a.$at)));
          v = hits.length ? hits[0] : FP.fn.NODATA;
        } else if (s.kind === 'item' && (s.id || {}).open) {
          // The open one (0.60): the latest open item whose values match the form's fields (the run on this line).
          const data = await FP.current.load(s.structure, asOf);
          const pairs = Object.entries(s.id.open);
          const want = pairs.map(([k, f]) => [k, vals[f] && typeof vals[f] === 'object' && vals[f].$id != null ? vals[f].$id : vals[f]]);
          if (want.some(([, x]) => x == null || x === '')) v = FP.fn.NODATA;
          else {
            const hits = Array.from(data.items.values()).filter(it => !FP.kinds || FP.kinds.isOpen(s.structure, it)).map(it => shapeItem(s.structure, it))
              .filter(it => want.every(([k, x]) => String(k === '$id' ? it.$id : it[k]) === String(x)))
              .sort((a, b) => String(b.$at).localeCompare(String(a.$at)));
            v = hits.length ? hits[0] : FP.fn.NODATA;
          }
        } else if (s.kind === 'item') {
          let id = (s.id || {}).field ? vals[s.id.field] : (s.id || {}).fixed ? s.id.fixed : (opts.generated ? opts.generated(keys.get(s.name) || s.structure) : null);
          // An item itself (each, in a sub-form going through a list) stands for its ID.
          if (id && typeof id === 'object' && !Array.isArray(id) && id.$id != null) id = id.$id;
          if (id == null || id === '' || (typeof id === 'object')) v = FP.fn.NODATA;
          else {
            const it = await FP.current.item(s.structure, String(id), asOf);
            v = it ? shapeItem(s.structure, it) : FP.fn.NODATA;
          }
        } else {
          const data = await FP.current.load(s.structure, asOf);
          let raw = Array.from(data.items.values());
          if (s.open && FP.kinds) raw = raw.filter(it => FP.kinds.isOpen(s.structure, it));   // only the open ones (0.60)
          let items = raw.map(it => shapeItem(s.structure, it));
          if (s.filter) {
            const prepared = await FP.lookup.prepare(s.filter, ctx || {});
            items = items.filter(it => FP.fn.evaluate(s.filter, Object.assign({ form: vals }, declaredBlank(s.structure), factsOf(it), it), prepared) === true);
          }
          v = items.sort((a, b) => String(b.$at).localeCompare(String(a.$at)));
        }
      } catch (e) { v = { __fp: 'error', message: e.message }; }
      out[s.name] = v;
      vals[s.name] = v;
    }
    return out;
  }

  /* What a form's sources read, for the map and for site coverage: [{ source, kind, structure }]. */
  const reads = def => list(def).filter(s => s.kind !== 'value').map(s => ({ source: s.name, kind: s.kind, structure: s.structure, filter: s.filter || null, id: s.id || null, open: !!s.open }));

  /* A form written the older ways, brought up to date (0.48): sources in place of the items map, and each save
   * button naming its saves in place of the form-level action. Returns { def, changes } (changes: what was done). */
  function upgrade(def) {
    if (!def || typeof def !== 'object') return { def, changes: [] };
    let d = clone(def);
    const changes = [];
    if (!Array.isArray(d.sources)) {
      const c = fromLegacy(d);
      d.fields = c.fields;
      if (c.buttons) d.buttons = c.buttons;
      d.sources = c.sources || [];
      delete d.items;
      inferValues(d);
      changes.push('sources in place of the items map');
    }
    if (typeof d.action === 'string' && d.action) {
      if (d.action !== 'save') {
        if (!Array.isArray(d.buttons)) d.buttons = [{ name: 'save', label: d.saveLabel || 'Save', action: 'save' }];
        d.buttons.forEach(b => { if (b && b.action === 'save' && !b.saveAs) b.saveAs = d.action; });
      }
      delete d.action;
      changes.push('each save button names its saves');
    }
    (d.subforms || []).forEach(sf => {
      if (sf && !Array.isArray(sf.sources) && (sf.items || (sf.fields || []).some(f => f && (f.writes || f.snapshot)))) {
        const c = fromLegacy(sf);
        sf.fields = c.fields; if (c.sources) sf.sources = c.sources; delete sf.items;
      }
    });
    return { def: d, changes };
  }

  FP.sources = { KINDS, USES, singular, BUILT_IN, inferValues, writable, check, checkLegacy, normalize, fromLegacy, upgrade, carryFields, evaluate, reads, nameFor, publicValues, shapeItem, itemKeys, realStructure };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-sources'] = '0.66.0';
})();
