/* Form Platform: form map (step 20)
 * Load after fp-defs.js. Used by the test page now and by the editor later.
 *
 * A map of how a form and the data connect, drawn from the published definitions
 * alone, so it is always current:
 *
 *   Reads      structures the form's lookups read, with how far back
 *   Functions  the functions its formulas call, and the lookups beneath them
 *   Form       every field (by section, tab or step), its buttons and reading list
 *   Saves to   each structure and container it writes, how the item is chosen,
 *              references stamped, files saved to the media folder,
 *              and what goes on the submission record
 *   Opens      forms it opens: linked or not, what is prefilled going down and
 *              applied coming back; and the forms that open it
 *
 * FP.map.form(id) gives the map as data; FP.map.usedBy(kind, id, container)
 * the other way round: every form that writes or reads a structure (or one
 * container of it), or uses a function. FP.map.render(host, id) draws it as an
 * outline: the form, then indented beneath it what it holds and the forms it opens.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.defs || !FP.forms) throw new Error('Load fp-defs.js before fp-map.js');

  // structure~source (a second item of a structure saved by one form) is that structure.
  const target = w => { const i = String(w || '').indexOf('.'); return i > 0 ? { structure: w.slice(0, i).split('~')[0], container: w.slice(i + 1) } : null; };
  const builtins = () => new Set(FP.fn.builtins());
  const catOf = control => { const d = FP.forms.describe(control); return d ? d.category : null; };
  const BUILT_IN_STRUCTURES = ['users', 'sites', 'submissions', 'acknowledgments', 'approvals', 'dues', 'centers'];

  function describeWindow(r) {
    const w = r.window == null ? 'form' : r.window;
    if (w === 'all') return 'all records';
    if (w === 'always-current') return 'today\'s data, even when reviewing an old record';
    if (w && typeof w === 'object' && w.days) return `the last ${w.days} day${w.days === 1 ? '' : 's'}`;
    return 'the form\'s period (all records when it has none)';
  }

  /* Where each field sits: 'Tab Checks', 'Step 2 Count', 'Section Notes', or the top of the form. */
  function locations(layout) {
    const out = new Map();
    (function walk(rows, where) {
      (Array.isArray(rows) ? rows : []).forEach(r => {
        if (Array.isArray(r)) { r.forEach(c => { const n = String(c).trim().split(/\s+/)[0]; if (!out.has(n)) out.set(n, where); }); return; }
        if (!r || typeof r !== 'object') return;
        if (Array.isArray(r.rows)) walk(r.rows, r.section ? `${where ? where + ' › ' : ''}${r.section}` : where);
        (r.tabs || []).forEach(t => walk(t.rows, `${where ? where + ' › ' : ''}Tab ${t.tab}`));
        (r.steps || []).forEach((t, i) => walk(t.rows, `${where ? where + ' › ' : ''}Step ${i + 1} ${t.step}`));
        (r.panels || []).forEach((t, i) => t && walk(t.rows, t.panel ? `${where ? where + ' › ' : ''}${t.panel}` : where));
      });
    })(layout, '');
    return out;
  }

  function scopeText(b) {
    if (b.action !== 'save') return null;
    const sc = b.scope == null ? 'form' : b.scope;
    if (sc === 'form') return 'saves the form';
    if (sc === 'tree') return 'saves the form and the linked records waiting with it';
    if (Array.isArray(sc)) return `saves ${sc.join(', ')}`;
    const k = ['section', 'tab', 'step'].find(x => typeof sc[x] === 'string');
    return `saves the ${k} ${sc[k]}`;
  }

  /* ---------- The map of one form, as data ---------- */
  function form(formId, doc) {
    doc = doc || FP.defs.get('form', formId);
    if (!doc) return null;
    const raw = FP.kinds ? FP.kinds.form(doc.def || {}) : (doc.def || {});   // picks become sources (0.60)
    // Sources name the items a form works with; the rest of the map sees them as the save path does.
    const def = FP.sources ? FP.sources.normalize(raw) : raw;
    const fields = Array.isArray(def.fields) ? def.fields.filter(f => f && f.name) : [];
    const byName = new Map(fields.map(f => [f.name, f]));
    const where = locations(def.layout || fields.map(f => [f.name]));
    const BI = builtins();
    const problems = [];
    const m = {
      id: formId, title: def.title || formId, version: doc.version, trial: !!doc.trial, retired: !!doc.retired,
      sites: FP.defs.sitesOf(def), launchable: !!def.launchable, print: !!def.print,
      fields: [], structures: [], media: [], submission: [], refs: [], functions: [], reads: [], opens: [], openedBy: [], buttons: [], reading: [], sources: [], problems,
    };
    const structures = new Map();
    const structureOf = id => {
      if (!structures.has(id)) {
        const sdoc = FP.defs.get('structure', id);
        const sdef = sdoc ? sdoc.def : (FP.structures.list().find(s => s.id === id) || null);
        const cfg = (def.items || {})[id];
        structures.set(id, {
          id, label: sdef && sdef.label || id, published: !!sdoc, builtIn: BUILT_IN_STRUCTURES.includes(id) || FP.defs.isBuiltIn('structure', id),
          item: (() => {
            const sid = (sdef && sdef.itemId) || {};
            const prefix = sid.prefix || (cfg && cfg.prefix);
            if (cfg && cfg.fixed) return `always ${sid.label || 'item'} ${cfg.fixed}`;
            if (cfg && cfg.where) return `the latest ${sid.label || 'item'} where ${cfg.where}`;
            return cfg && cfg.field ? `the ${sid.label || 'item ID'} comes from ${(byName.get(cfg.field) || {}).label || cfg.field}` : `a new ${sid.label || 'item'} each save${prefix ? `, IDs start ${prefix}-` : ''}`;
          })(),
          itemField: cfg && cfg.field || null,
          containers: [], 
          live: sdef && sdef.live ? `loads the last ${sdef.live.days} days` : null, open: sdef && sdef.open ? `open while ${sdef.open}` : null,
        });
      }
      return structures.get(id);
    };
    const container = (st, c, field, how) => {
      const s = structureOf(st);
      let row = s.containers.find(x => x.name === c);
      if (!row) { row = { name: c, fields: [] }; s.containers.push(row); }
      row.fields.push({ field, how });
      const sd = FP.defs.get('structure', st);
      const d = sd && !sd.retired ? sd.def : null;
      const worked = d && d.calculated && Object.prototype.hasOwnProperty.call(d.calculated, c) ? 'a calculated value' : d && c === 'status' && (d.status || []).length ? 'the status' : null;
      if (worked) problems.push({ level: 'error', text: `${field} saves to ${st}.${c}, which is ${worked} of ${st}: it can't be saved to` });
    };
    Object.keys(def.items || {}).forEach(st => structureOf(st.split('~')[0]));
    const readOf = st => {
      let rd = m.reads.find(x => x.structure === st);
      if (!rd) {
        const sdoc = FP.defs.get('structure', st);
        const sdef = sdoc ? sdoc.def : FP.structures.list().find(x => x.id === st);
        rd = { structure: st, label: (sdef && sdef.label) || st, defined: !!sdef, via: [] };
        m.reads.push(rd);
      }
      return rd;
    };

    // Functions: everything the form's formulas call, and what those call in turn.
    const fnMap = new Map();
    const noteCalls = (formula, from) => {
      const sx = FP.fn.syntax(String(formula || ''));
      if (sx.error) { problems.push({ level: 'error', text: `${from}: ${sx.error}` }); return []; }
      (sx.callArgs || []).forEach(c => {
        if (BI.has(c.name.toUpperCase())) return;
        const f = FP.fn.get(c.name);
        if (!f) { problems.push({ level: 'error', text: `${from} calls ${c.name}, which is not a published function` }); return; }
        const needed = (f.inputs || []).filter(i => i.required !== false).length;
        if (c.args < needed) problems.push({ level: 'error', text: `${from} gives ${f.name} ${c.args} input${c.args === 1 ? '' : 's'}; it needs ${needed} (${(f.inputs || []).map(i => i.name).join(', ')})` });
        addFn(f, from);
      });
      return sx.calls.filter(n => !BI.has(n.toUpperCase()));
    };
    function addFn(f, from) {
      let e = fnMap.get(f.name);
      if (!e) {
        e = { name: f.name, label: f.label || f.name, kind: f.kind === 'lookup' ? 'lookup' : 'formula', version: f.version, inputs: (f.inputs || []).map(i => i.name), output: f.output || 'any', calledBy: [], calls: [], reads: null };
        fnMap.set(f.name, e);
        if (f.kind === 'lookup' && f.reads) {
          const r = f.reads;
          e.reads = { structure: r.structure, from: r.from || 'items', window: describeWindow(r), match: Object.keys(r.match || {}), summary: r.summary || 'latest', action: r.action || null };
          let rd = m.reads.find(x => x.structure === r.structure);
          if (!rd) {
            const sdoc = FP.defs.get('structure', r.structure);
            const sdef = sdoc ? sdoc.def : FP.structures.list().find(s => s.id === r.structure);
            rd = { structure: r.structure, label: sdef && sdef.label || r.structure, defined: !!sdef, live: sdef && sdef.live ? `loads the last ${sdef.live.days} days` : null, via: [] };
            m.reads.push(rd);
            if (!sdef) problems.push({ level: 'error', text: `${f.name} reads ${r.structure}, which is not a published structure` });
          }
          rd.via.push({ fn: f.name, from: e.reads.from, window: e.reads.window, match: e.reads.match, summary: e.reads.summary });
        } else if (f.formula) {
          e.calls = noteCalls(f.formula, `function ${f.name}`);
        }
      }
      if (!e.calledBy.includes(from)) e.calledBy.push(from);
    }

    fields.forEach(f => {
      const cat = catOf(f.control) || 'unknown';
      const fm = { name: f.name, label: f.label || f.name, control: f.control, category: cat, required: !!f.required, when: f.when || null, keep: !!f.keep, where: where.get(f.name) || '', placed: where.has(f.name), calls: [] };
      FP.forms.formulasOf({ fields: [f] }).forEach(fx => { fm.calls.push(...noteCalls(fx, `Field ${f.label || f.name}`)); });
      if (f.when) fm.calls.push(...noteCalls(f.when, `Field ${f.label || f.name} (when)`));
      fm.calls = Array.from(new Set(fm.calls.map(n => (FP.fn.get(n) || { name: n }).name)));
      const w = target(f.writes), sn = target(f.snapshot);
      if (w && def.lists && def.lists[w.structure]) w.structure = def.lists[w.structure];   // the same value to every item of a list
      if (w) { fm.writes = w; container(w.structure, w.container, f.name, 'saves'); }
      if (sn) { fm.snapshot = sn; container(sn.structure, sn.container, f.name, 'saves its value'); }
      if (f.ref) { fm.ref = f.ref; m.refs.push({ role: f.ref, field: f.name }); }
      const itemOf = Object.entries(def.items || {}).find(([, c]) => c && c.field === f.name);
      if (itemOf) fm.itemFor = itemOf[0].split('~')[0];
      if (f.control === 'file' || f.control === 'draw') {
        const kind = FP.media ? FP.media.CAPTURE_DIRS[FP.media.captureKind(f)] : 'files';
        fm.media = { kind, tags: [] };
        m.media.push({ field: f.name, kind, tags: [] });
      }
      if (f.control === 'pick' && f.structure) { fm.picks = f.structure; let rd = m.reads.find(x => x.structure === f.structure); if (!rd) { rd = { structure: f.structure, label: f.structure, defined: !!FP.defs.get('structure', f.structure), via: [] }; m.reads.push(rd); } rd.via.push({ field: f.name, from: 'items', window: 'all records', match: [], summary: 'picked from' }); }
      if (f.rowsFrom) {
        // A table with a row per item of a list source: its changeable columns save to each row's item.
        const ls = (Array.isArray(raw.sources) ? raw.sources : []).find(x => x && x.name === f.rowsFrom);
        fm.rowsFrom = f.rowsFrom;
        if (ls && ls.structure) (f.columns || []).filter(c => c && c.edit).forEach(c => container(ls.structure, c.name, f.name, 'saves (a row per item)'));
      }
      if (cat === 'entry' && !w && !f.ref && !itemOf && !f.rowsFrom) { fm.loose = true; m.submission.push(f.name); }
      if (!fm.placed && def.layout && f.required) problems.push({ level: 'error', text: `Field ${fm.label} is required but not placed in the layout` });
      m.fields.push(fm);
    });
    m.functions = Array.from(fnMap.values());

    // Buttons, reading list, forms opened from here and forms that open this one.
    const buttons = Array.isArray(def.buttons) ? def.buttons : [{ name: 'save', label: def.saveLabel || 'Save', action: 'save', scope: 'form' }];
    buttons.forEach(b => {
      if (!b) return;
      m.buttons.push({ name: b.name, label: b.label || b.name, action: b.action, scope: scopeText(b), when: b.when || null, opens: b.action === 'open' ? b.form : null });
      if (b.when) noteCalls(b.when, `Button ${b.label || b.name} (when)`);
      Object.entries(b.prefill || {}).forEach(([k, fx]) => noteCalls(fx, `Button ${b.label || b.name} prefill ${k}`));
      if (b.action !== 'open') return;
      const cdoc = FP.defs.get('form', b.form);
      const o = { button: b.name, label: b.label || b.name, form: b.form, title: cdoc ? cdoc.def.title || b.form : b.form, missing: !cdoc || cdoc.retired, link: b.link || null,
        prefill: Object.entries(b.prefill || {}).map(([k, fx]) => `${k} ← ${fx}`), apply: Object.entries(b.apply || {}).map(([mine, theirs]) => `${mine} ← ${theirs}`),
        when: b.when || null, writes: [] };
      if (cdoc) {
        const cdef = FP.sources ? FP.sources.normalize(cdoc.def) : cdoc.def;
        const ck = Object.keys(cdef.items || {});
        (cdef.fields || []).forEach(cf => { const t = target(cf && (cf.writes || cf.snapshot)); if (t && !ck.includes(t.structure)) ck.push(t.structure); });
        o.writes = ck;
      }
      if (o.missing) problems.push({ level: 'error', text: `Button ${o.label} opens ${b.form}, which is not published` });
      m.opens.push(o);
    });
    // The form's sources: what each names, and what it reads.
    (Array.isArray(raw.sources) ? raw.sources : []).forEach(src => {
      if (!src || !src.name) return;
      const idText = src.kind !== 'item' ? null : (src.id || {}).field ? `the item named in ${(byName.get(src.id.field) || {}).label || src.id.field}` : (src.id || {}).fixed ? `item ${src.id.fixed}` : 'a new item each save';
      m.sources.push({ name: src.name, kind: src.kind, structure: src.structure || null, text: src.kind === 'item' ? `${idText} of ${src.structure}` : src.kind === 'items' ? `items of ${src.structure}${src.filter ? ` where ${src.filter}` : ''}` : `= ${src.formula}` });
      if (src.kind === 'items' || src.kind === 'item') {
        const rd = readOf(src.structure);
        rd.via.push({ source: src.name, from: 'items', window: src.kind === 'items' ? 'all items' : 'one item', match: [], summary: src.kind === 'items' ? 'list' : 'item', filter: src.filter || null });
        if (!rd.defined) problems.push({ level: 'error', text: `Source ${src.name} uses ${src.structure}, which is not a published structure` });
      }
      if (src.filter) noteCalls(src.filter, `Source ${src.name}`);
      if (src.formula) noteCalls(src.formula, `Source ${src.name}`);
    });
    (Array.isArray(def.acknowledge) ? def.acknowledge : []).forEach(a => {
      if (!a) return;
      const calls = [];
      Object.values(a.where || {}).forEach(fx => { if (typeof fx === 'string') calls.push(...noteCalls(fx, `Read before starting ${a.label || a.name}`)); });
      m.reading.push({ name: a.name, label: a.label || a.name, show: a.show, every: a.every || (a.show === 'media' ? 'revision' : 'day'), formula: Object.entries(a.where || {}).map(([k, v]) => `${k} = ${v}`).join(', ') || null, calls: calls.map(n => (FP.fn.get(n) || { name: n }).name) });
    });
    m.functions = Array.from(fnMap.values());
    FP.defs.list('form').filter(d => !d.retired && d.id !== formId).forEach(d => {
      (d.def.buttons || []).filter(b => b && b.action === 'open' && b.form === formId)
        .forEach(b => m.openedBy.push({ form: d.id, title: d.def.title || d.id, button: b.label || b.name, link: b.link || null }));
    });

    // Loops: this form reached again through the forms it opens.
    (function walk(fid, path) {
      const d = fid === formId ? doc : FP.defs.get('form', fid);
      ((d && d.def.buttons) || []).filter(b => b && b.action === 'open').forEach(b => {
        if (b.form === formId) problems.push({ level: 'error', text: `Forms open each other in a loop: ${path.concat(formId).join(' → ')}` });
        else if (!path.includes(b.form) && path.length < 8) walk(b.form, path.concat(b.form));
      });
    })(formId, [formId]);

    m.structures = Array.from(structures.values());
    // Structures written that nothing reads: only exports and reports would see them.
    const readSomewhere = readersOfStructures();
    m.structures.forEach(s => {
      if (!s.published && !s.builtIn) problems.push({ level: 'error', text: `Saves to ${s.id}, which is not a published structure: saving will be refused` });
      else if (!s.builtIn && !readSomewhere.has(s.id)) problems.push({ level: 'warn', text: `Nothing reads ${s.id}: no lookup, picker or other form uses it, so only exports and reports will see what this form saves there` });
    });
    if (m.submission.length) problems.push({ level: 'info', text: `${m.submission.join(', ')} save${m.submission.length === 1 ? 's' : ''} only on the submission record (no structure)` });
    return m;
  }

  /* Structures read anywhere: by a lookup, a picker, a media rule, or as the item of a form opened with a link. */
  function readersOfStructures() {
    const out = new Set();
    FP.fn.list().forEach(f => { if (f.kind === 'lookup' && f.reads) out.add(f.reads.structure); });
    FP.defs.list('form').filter(d => !d.retired).forEach(d => {
      (d.def.fields || []).forEach(f => { if (f && f.control === 'pick' && f.structure) out.add(f.structure); if (f && f.pick) out.add(f.pick); });
      (d.def.buttons || []).forEach(b => { if (b && b.link) out.add(b.link); });
    });
    return out;
  }

  /* Does a lookup read a container? A count reads none; return '*' reads all; else what it returns or matches. */
  function lookupTouches(reads, containerName) {
    if (!containerName || !reads) return true;
    if (Object.keys(reads.match || {}).includes(containerName)) return true;
    if (reads.summary === 'count' && (reads.return === '*' || Array.isArray(reads.return))) return false;
    return reads.return === '*' || [].concat(reads.return).includes(containerName);
  }

  /* ---------- The other way round ---------- */
  /* kind 'structure' (optionally one container) or 'function': [{ form, title, field, how }]. */
  function usedBy(kind, id, containerName) {
    const out = [];
    const forms = FP.defs.list('form').filter(d => !d.retired);
    if (kind === 'structure') {
      forms.forEach(d => {
        const m = form(d.id, d);
        if (!m) return;
        m.fields.forEach(f => {
          if (f.writes && f.writes.structure === id && (!containerName || f.writes.container === containerName)) out.push({ form: d.id, title: m.title, field: f.label, how: `saves to ${f.writes.container}` });
          if (f.snapshot && f.snapshot.structure === id && (!containerName || f.snapshot.container === containerName)) out.push({ form: d.id, title: m.title, field: f.label, how: `saves its value to ${f.snapshot.container}` });
          if (f.itemFor === id && !containerName) out.push({ form: d.id, title: m.title, field: f.label, how: 'gives the item ID' });
          if (f.picks === id && !containerName) out.push({ form: d.id, title: m.title, field: f.label, how: 'picks an item from it' });
        });
        m.reads.filter(r => r.structure === id).forEach(r => r.via.filter(v => v.fn).forEach(v => {
          const fn = FP.fn.get(v.fn);
          const reads = fn && fn.reads;
          const touches = lookupTouches(reads, containerName);
          if (touches) out.push({ form: d.id, title: m.title, field: m.fields.filter(f => f.calls.includes(v.fn) || m.functions.some(g => g.calls.includes(v.fn) && f.calls.includes(g.name))).map(f => f.label).join(', ') || '(a button or reading list)', how: `reads it through ${v.fn} (${v.window})` });
        }));
        m.opens.filter(o => o.link === id && !containerName).forEach(o => out.push({ form: d.id, title: m.title, field: o.label, how: `links ${o.title} records to its item` }));
      });
      FP.fn.list().filter(f => f.kind === 'lookup' && f.reads && f.reads.structure === id && lookupTouches(f.reads, containerName))
        .forEach(f => out.push({ form: null, title: `function ${f.name}`, field: '', how: `reads ${f.reads.from || 'items'}${containerName ? '' : ''}` }));
    } else if (kind === 'function') {
      const fn = FP.fn.get(id);
      const name = fn ? fn.name : id;
      forms.forEach(d => {
        const m = form(d.id, d);
        if (!m) return;
        const via = m.functions.find(g => g.name === name);
        if (!via) return;
        const direct = m.fields.filter(f => f.calls.includes(name)).map(f => f.label);
        const indirect = m.functions.filter(g => g.calls.includes(name)).map(g => g.name);
        out.push({ form: d.id, title: m.title, field: direct.join(', '), how: direct.length ? 'calls it' : `through ${indirect.join(', ')}` });
      });
      FP.fn.list().filter(f => f.formula && FP.fn.syntax(f.formula).calls.some(c => c.toLowerCase() === name.toLowerCase())).forEach(f => out.push({ form: null, title: `function ${f.name}`, field: '', how: 'calls it' }));
      FP.structures.list().filter(s => Object.values(s.calculated || {}).some(c => c.fn === name)).forEach(s => out.push({ form: null, title: `structure ${s.id}`, field: '', how: 'works out a calculated value with it' }));
    }
    return out;
  }

  /* ---------- Drawing: an outline, read top to bottom ----------
   * The form at the top; under it, slim coloured rows for what it reads, the fields (with where they
   * save), the structures it saves to, and its buttons. A button that opens another form has that form
   * indented beneath it, and so on down, so indentation shows the level. Tapping a form's row jumps to it
   * (opts.onOpen); ▸ opens it in place. Tapping a structure or function lists everything that uses it. */
  const MAP_CSS = `
  .fpm{--ink:#1b1f24;--muted:#5b6573;--line:#e3e7ec;font:14px/1.35 system-ui,"Segoe UI",sans-serif;color:var(--ink)}
  .fpm-bar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 10px}
  .fpm-bar span{color:var(--muted);font-size:12px;margin-right:4px}
  .fpm-bar button{font:inherit;font-size:12px;font-weight:600;min-height:30px;padding:2px 10px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--muted);cursor:pointer}
  .fpm-bar button.on{color:#fff;border-color:transparent}
  .fpm-list{display:flex;flex-direction:column;gap:3px}
  .fpm-r{position:relative;display:flex;align-items:center;gap:8px;min-height:30px;padding:3px 8px 3px 0;border-radius:7px;background:#fff;border:1px solid var(--line);overflow:hidden}
  .fpm-r::before{content:"";align-self:stretch;width:5px;flex:none;background:var(--c)}
  .fpm-r .k{flex:none;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#fff;background:var(--c);border-radius:5px;padding:2px 6px;min-width:56px;text-align:center}
  .fpm-r .t{flex:none;font-weight:600;white-space:nowrap;max-width:45%;overflow:hidden;text-overflow:ellipsis}
  .fpm-r .d{flex:1 1 auto;min-width:0;color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .fpm-r.go{cursor:pointer}.fpm-r.go:hover{background:#f3f7fd;border-color:#c7d7ef}
  .fpm-r.form{min-height:38px;background:#1b2633;border-color:#1b2633;color:#fff}
  .fpm-r.form .d{color:#c6d0dc}.fpm-r.form .k{background:#fff;color:#1b2633}
  .fpm-r.form.go:hover{background:#26364a}
  .fpm-r.bad{border-color:#f0b4b4;background:#fff6f5}
  .fpm-r .tog{flex:none;width:26px;height:26px;border:0;border-radius:6px;background:rgba(255,255,255,.14);color:inherit;font:inherit;cursor:pointer}
  .fpm-r .open{flex:none;font-size:12px;font-weight:700;opacity:.85}
  .fpm-ind{display:flex;gap:0;align-self:stretch;flex:none}
  .fpm-ind i{display:block;width:22px;border-right:2px solid #e3e7ec;margin-right:-2px}
  .fpm-empty{color:var(--muted);font-size:13px;padding:6px 0}
  .fpm-uses{margin-top:12px;border:1px solid var(--line);border-radius:10px;background:#fff;padding:10px 12px}
  .fpm-uses h4{margin:0 0 6px}
  .fpm-uses td{padding:4px 10px 4px 0;vertical-align:top}`;
  function injectCss() {
    if (document.getElementById('fp-map-css')) return;
    const s = document.createElement('style'); s.id = 'fp-map-css'; s.textContent = MAP_CSS; document.head.appendChild(s);
  }
  const el = (tag, cls, text) => FP.dom.el(tag, cls, text);   // one copy, in fp-core (0.50)
  /* The kinds of row, their colour and the word on their block. */
  const KINDS = {
    form: ['#1b2633', 'form'], from: ['#6b7280', 'from'], problem: ['#d03b3b', 'fix'], warn: ['#c98500', 'note'],
    ack: ['#c98500', 'read first'], read: ['#0f8b8d', 'reads'], fn: ['#7c3aed', 'calls'],
    field: ['#2a78d6', 'field'], shows: ['#64748b', 'shows'], save: ['#1f9d55', 'saves'], files: ['#0e9f6e', 'files'],
    button: ['#eb6834', 'button'], down: ['#b45309', 'passes'], back: ['#b45309', 'hands back'], source: ['#0e7490', 'source'],
  };
  const GROUPS = [['fields', 'Fields', '#2a78d6'], ['data', 'Data', '#1f9d55'], ['buttons', 'Buttons and forms', '#eb6834'], ['reading', 'Read first', '#c98500']];
  const GROUP_OF = { source: 'data', field: 'fields', shows: 'fields', read: 'data', fn: 'data', save: 'data', files: 'data', ack: 'reading', button: 'buttons', down: 'buttons', back: 'buttons' };

  /* Draw the map of a form into host.
   * opts.onOpen(formId): a form's row was tapped (default: draw that form's map here).
   * opts.onField(name), opts.onButton(name): a field or button row of the top form was tapped.
   * opts.doc: draw this (unpublished) version of the top form instead of the published one. */
  function render(host, formId, opts) {
    opts = opts || {};
    injectCss();
    const top = form(formId, opts.doc);
    host.replaceChildren();
    if (!top) { host.appendChild(el('div', 'fpm-empty', `No published form named ${formId}.`)); return null; }
    const root = el('div', 'fpm');
    host.appendChild(root);
    const shown = new Set(GROUPS.map(g => g[0]));
    const expanded = new Set(['']);   // path keys of forms opened in place; '' is the top form
    const bar = el('div', 'fpm-bar');
    const list = el('div', 'fpm-list');
    const usesBox = el('div');
    root.append(bar, list, usesBox);
    const go = id => (opts.onOpen ? opts.onOpen(id) : render(host, id, Object.assign({}, opts, { doc: null })));

    const showUses = (kind, id, container) => {
      const uses = usedBy(kind, id, container);
      const w = el('div', 'fpm-uses');
      w.appendChild(el('h4', null, `Everything that uses ${kind} ${id}${container ? '.' + container : ''} (${uses.length})`));
      const t = el('table');
      uses.forEach(u => { const tr = el('tr'); [u.title, u.field, u.how].forEach(v => tr.appendChild(el('td', null, v || ''))); if (u.form) { tr.style.cursor = 'pointer'; tr.onclick = () => go(u.form); } t.appendChild(tr); });
      if (!uses.length) w.appendChild(el('div', 'fpm-empty', 'Nothing uses it.'));
      w.appendChild(t);
      usesBox.replaceChildren(w);
      w.scrollIntoView({ block: 'nearest' });
    };

    function row(depth, kind, title, desc, onClick, extra) {
      const [c, word] = KINDS[kind];
      const r = el('div', 'fpm-r' + (kind === 'form' ? ' form' : '') + (onClick ? ' go' : '') + (extra && extra.bad ? ' bad' : ''));
      r.style.setProperty('--c', c);
      r.dataset.kind = kind;
      const ind = el('span', 'fpm-ind');
      for (let i = 0; i < depth; i++) ind.appendChild(el('i'));
      r.appendChild(ind);
      if (extra && extra.toggle) r.appendChild(extra.toggle);
      r.append(el('span', 'k', extra && extra.word || word), el('span', 't', title));
      if (desc) { const d = el('span', 'd', desc); d.title = desc; r.appendChild(d); }
      if (extra && extra.after) r.appendChild(extra.after);
      if (onClick) r.onclick = e => { if (e.target.closest('.tog')) return; onClick(); };
      return r;
    }
    const groupOn = kind => !GROUP_OF[kind] || shown.has(GROUP_OF[kind]);

    /* One form and, beneath it, what it reads, its fields, where it saves and its buttons; forms it opens indented. */
    function drawForm(m, depth, path, key, isTop) {
      const out = [];
      const add = (kind, ...a) => { if (groupOn(kind)) out.push(row(depth + 1, kind, ...a)); };
      const open = expanded.has(key);
      const tog = el('button', 'tog', open ? '▾' : '▸'); tog.type = 'button';
      tog.title = open ? 'Fold away' : 'Show what it holds here';
      tog.onclick = () => { if (open) expanded.delete(key); else expanded.add(key); paint(); };
      const facts = [`${m.id} v${m.version}${m.trial ? ' trial' : ''}`, m.sites.join(', '), m.launchable ? 'launchable' : null, m.print ? 'prints' : null, `${m.fields.length} field${m.fields.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ');
      out.push(row(depth, 'form', m.title, facts, isTop ? null : () => go(m.id), { toggle: isTop ? null : tog, after: isTop ? null : el('span', 'open', 'Go to ›') }));
      if (!open) return out;
      if (isTop) {
        m.problems.filter(p => p.level !== 'info').forEach(p => out.push(row(depth + 1, p.level === 'error' ? 'problem' : 'warn', p.level === 'error' ? 'Problem' : 'Note', p.text, null, { bad: p.level === 'error' })));
        m.openedBy.forEach(o => out.push(row(depth + 1, 'from', o.title, `opened by its ${o.button} button${o.link ? `, linked to its ${o.link} item` : ''}`, () => go(o.form))));
      }
      m.reading.forEach(a => add('ack', a.label, `${a.show === 'media' ? 'documents' : 'text'} to read and confirm, every ${a.every}${a.formula ? ` · ${a.formula}` : ''}`));
      m.sources.forEach(sr => add('source', sr.name, sr.text, sr.structure ? () => showUses('structure', sr.structure) : null));
      m.reads.forEach(r => add('read', r.label, `${r.structure} · ` + r.via.map(v => v.fn ? `through ${v.fn}, ${v.window}${v.match && v.match.length ? `, matching ${v.match.join(', ')}` : ''}` : v.source ? `as source ${v.source}${v.filter ? `, where ${v.filter}` : ''}` : `picked in ${v.field}`).join('; '), () => showUses('structure', r.structure), { bad: !r.defined }));
      m.functions.filter(f => f.kind !== 'lookup').forEach(f => add('fn', f.name, `${f.label !== f.name ? f.label + ' · ' : ''}${f.inputs.length ? `takes ${f.inputs.join(', ')}` : 'no inputs'} · gives ${f.output}`, () => showUses('function', f.name)));
      let lastWhere = null;
      m.fields.forEach(f => {
        const saves = [f.writes ? `saves to ${f.writes.structure}.${f.writes.container}` : null, f.snapshot ? `keeps its value in ${f.snapshot.structure}.${f.snapshot.container}` : null,
          f.itemFor ? `the ${f.itemFor} ID` : null, f.ref ? `reference ${f.ref}` : null, f.media ? `files: ${f.media.kind}` : null, f.loose ? 'on the submission record only' : null].filter(Boolean);
        const bits = [FP.forms.describe(f.control) ? FP.forms.describe(f.control).label.toLowerCase() : f.control, f.required ? 'required' : null, f.where && f.where !== lastWhere ? f.where : null,
          f.calls.length ? `uses ${f.calls.join(', ')}` : null, f.when ? `only when ${f.when}` : null].filter(Boolean).concat(saves);
        lastWhere = f.where;
        add(f.category === 'entry' ? 'field' : 'shows', f.label, bits.join(' · '), isTop && opts.onField ? () => opts.onField(f.name) : null, { bad: !f.placed && f.required });
      });
      m.structures.forEach(st => add('save', st.label, `${st.id} · ${st.containers.map(c => c.name).join(', ') || 'no values'} · ${st.item}`, () => showUses('structure', st.id), { bad: !st.published && !st.builtIn }));
      if (m.media.length) add('files', 'Media folder', m.media.map(x => `media/${x.kind} from ${(m.fields.find(f => f.name === x.field) || {}).label || x.field}`).join('; '));
      m.buttons.forEach(b => {
        const o = b.opens ? m.opens.find(x => x.button === b.name) : null;
        add('button', b.label, o ? `opens ${o.title}${o.link ? `, linked to this ${o.link} item` : ', not linked'}${o.when ? ` · shown when ${o.when}` : ''}` : `${b.scope || b.action}${b.when ? ` · shown when ${b.when}` : ''}`, isTop && opts.onButton ? () => opts.onButton(b.name) : null, { bad: o && o.missing });
        if (!o || !shown.has('buttons')) return;
        if (path.includes(o.form)) { out.push(row(depth + 2, 'problem', o.title, `opens a form already above it: ${path.concat(o.form).join(' → ')}`, null, { bad: true })); return; }
        o.prefill.forEach(t => out.push(row(depth + 2, 'down', t.split(' ← ')[0], `← ${t.split(' ← ').slice(1).join(' ← ')} (prefilled from here)`)));
        o.apply.forEach(t => out.push(row(depth + 2, 'back', t.split(' ← ')[0], `← its ${t.split(' ← ').slice(1).join(' ← ')} (applied back to this form)`)));
        const cm = o.missing ? null : form(o.form);
        if (cm && depth < 8) out.push(...drawForm(cm, depth + 2, path.concat(o.form), `${key}/${b.name}`, false));
        else if (!cm) out.push(row(depth + 2, 'problem', o.form, 'not a published form', null, { bad: true }));
      });
      return out;
    }

    function paint() {
      bar.replaceChildren(el('span', null, 'Show'));
      GROUPS.forEach(([g, label, color]) => {
        const b = el('button', shown.has(g) ? 'on' : '', label); b.type = 'button';
        if (shown.has(g)) b.style.background = color;
        b.onclick = () => { if (shown.has(g)) shown.delete(g); else shown.add(g); paint(); };
        bar.appendChild(b);
      });
      const all = el('button', null, expanded.size > 1 ? 'Fold all' : 'Open all'); all.type = 'button';
      all.onclick = () => {
        if (expanded.size > 1) { expanded.clear(); expanded.add(''); }
        else (function walk(m, key, path, depth) { m.opens.forEach(o => { if (o.missing || path.includes(o.form) || depth > 8) return; const k = `${key}/${o.button}`; expanded.add(k); const cm = form(o.form); if (cm) walk(cm, k, path.concat(o.form), depth + 1); }); })(top, '', [top.id], 0);
        paint();
      };
      bar.appendChild(all);
      list.replaceChildren(...drawForm(top, 0, [top.id], '', true));
    }
    paint();
    return { model: top, redraw: paint, destroy() { host.replaceChildren(); } };
  }

  FP.map = { form, usedBy, render };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-map'] = '0.60.0';
})();
