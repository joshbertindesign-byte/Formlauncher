/* Form Platform kernel: definition files and the loader (step 9)
 * Load after every other kernel file (it treats whatever they defined in code as built-in).
 *
 * Everything people author is a definition: functions, structures (with their
 * session links), session types, forms, saved fields and groups. Each publish
 * writes a new file and never changes an old one:
 *
 *   library/{kind}/{id}/{version}-{terminal}.json     e.g. library/structure/racks/0003-T01.json
 *
 *   { fp: 'definition', v: 1, kind, id, version, basedOn, publishedAt, publishedBy: { userId, name },
 *     terminalId, note, retired, def: { ... } }
 *
 * The highest version is current. Two terminals publishing the same version at
 * once leave two files; the later publish wins and the clash is reported.
 * A publish also stamps library/_changes/{terminal}.json, which every terminal
 * checks every 30 seconds, so a new or changed definition reaches every
 * terminal without anyone restarting anything.
 *
 * Loading applies session types, then functions, then structures, then forms,
 * saved fields and groups. A definition with a problem is left out and
 * reported, the same way on every terminal, so every screen agrees.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.fn || !FP.structures || !FP.session) throw new Error('Load fp-defs.js after the other kernel files');

  const ROOT = ['library'];
  const CHANGES = ROOT.concat('_changes');
  // Collections and media rules are gone (0.42): media is plain files a form lists (fp-media.js).
  // Saved fields and groups are gone (0.48): nothing used them since forms hold their own fields; their old files are ignored.
  // Session types are read only so Admin > Clean-up can retire them and take sessions out of structures.
  const KINDS = ['session-type', 'function', 'structure', 'form'];
  const LABELS = { 'session-type': 'session type', function: 'function', structure: 'structure', form: 'form' };
  const SLUG_RE = /^[a-z][a-z0-9-]{0,39}$/;
  const FN_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
  const FILE_RE = /^(\d{4,})-([A-Z0-9][A-Z0-9-]{0,15})\.json$/;
  const SOURCES = ['$firstAt', '$lastAt', '$asOf', '$entryCount', '$lastAction'];

  // Defined in kernel code before this file ran: built in, can't be published over. Built-ins are used at every site.
  const BUILT_IN = {
    structure: new Set(FP.structures.list().map(s => s.id).concat(['sites', 'terminal-groups', 'terminal-settings', 'approvals', 'dues', 'centers'])),
    'session-type': new Set(FP.session.types().map(t => t.name)),
  };

  const idOk = (kind, id) => (kind === 'function' ? FN_RE : SLUG_RE).test(id || '');
  const fileName = (version, terminal) => `${String(version).padStart(4, '0')}-${terminal}.json`;
  const nameOf = (kind, id) => `${LABELS[kind]} ${id}`;

  /* ---------- State ---------- */
  let current = new Map();          // 'kind/id' -> doc (current version, retired ones included)
  let applied = new Map(KINDS.map(k => [k, new Set()]));   // ids this loader put in place
  let lastReport = null;
  let stats = {};
  const docKey = (kind, id) => kind + '/' + id;

  /* ---------- Reading ---------- */
  async function readFolder(kind, id) {
    const parts = ROOT.concat(kind, id);
    const names = await FP.files.list(parts);
    const files = [];
    const strays = [];
    for (const n of names) {
      const m = FILE_RE.exec(n);
      if (m) files.push({ name: n, version: Number(m[1]), terminal: m[2] });
      else strays.push(n);
    }
    return { parts, files, strays };
  }

  /* One version's doc: the later one if two terminals published it at once. */
  async function readVersion(kind, id, version, problems, folder) {
    const { parts, files } = folder || await readFolder(kind, id);
    const docs = [];
    for (const f of files.filter(x => x.version === version)) {
      const doc = await FP.files.readJson(parts, f.name);
      const p = docProblem(doc, kind, id, f);
      if (p) { if (problems) problems.push({ kind, id, version: f.version, message: `${f.name}: ${p}` }); }
      else docs.push(doc);
    }
    if (!docs.length) return null;
    docs.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
    if (docs.length > 1 && problems) {
      problems.push({ kind, id, version, message: `Version ${version} was published twice at once (${docs.map(d => d.terminalId).join(', ')}); using the later one from ${docs[docs.length - 1].terminalId}. Check it says what you want.` });
    }
    return docs[docs.length - 1];
  }

  /* The current version: the highest that isn't a trial. Trial versions are only used by launchers pinned to them. */
  async function readCurrent(kind, id, problems) {
    const folder = await readFolder(kind, id);
    folder.strays.forEach(n => problems.push({ kind, id, message: `Ignored ${n} in library/${kind}/${id}: not a definition file name (a sync conflict copy?)` }));
    const versions = Array.from(new Set(folder.files.map(f => f.version))).sort((a, b) => b - a);
    for (const v of versions) {
      const doc = await readVersion(kind, id, v, problems, folder);
      if (doc && !doc.trial) return doc;
    }
    return null;
  }

  function docProblem(doc, kind, id, f) {
    if (!doc || doc.fp !== 'definition') return 'unreadable or not a definition';
    if (doc.kind !== kind || doc.id !== id) return `says it is ${doc.kind} ${doc.id}, but sits in ${kind}/${id}`;
    if (doc.version !== f.version || doc.terminalId !== f.terminal) return 'its version or terminal does not match its file name (a sync conflict copy, or a renamed file?)';
    if (!doc.def || typeof doc.def !== 'object') return 'has no definition';
    if (typeof doc.publishedAt !== 'string') return 'has no publish time';
    return null;
  }

  async function readAll(problems) {
    const docs = new Map();
    for (const kind of KINDS) {
      for (const id of await FP.files.listDirs(ROOT.concat(kind))) {
        if (!idOk(kind, id)) { problems.push({ kind, id, message: `Ignored folder library/${kind}/${id}: not a valid ${LABELS[kind]} name` }); continue; }
        const doc = await readCurrent(kind, id, problems);
        if (doc) docs.set(docKey(kind, id), doc);
      }
    }
    return docs;
  }

  /* ---------- Sites ----------
   * Every definition says which sites it is for: sites: ["all"] or a list of
   * site codes. A terminal only loads the definitions for its own site. A
   * definition can only use definitions that cover all of its sites (a form
   * for ABI and DAL can't write to a structure that is only used at ABI). */
  const SITE_RE = /^[A-Z0-9][A-Z0-9-]{0,15}$/;
  const sitesOf = def => (def && Array.isArray(def.sites) && def.sites.length ? def.sites : ['all']);
  const here = () => FP.identity.site;
  function coversSite(def, site) {
    const s = sitesOf(def);
    return !site || s.includes('all') || s.includes(site);
  }
  function coversAll(outer, inner) { // does inner cover every site outer is for?
    const o = sitesOf(outer), i = sitesOf(inner);
    if (i.includes('all')) return true;
    if (o.includes('all')) return false;
    return o.every(x => i.includes(x));
  }
  const siteText = def => (sitesOf(def).includes('all') ? 'all sites' : sitesOf(def).join(', '));

  function checkSites(def, known) {
    const p = [];
    if (def.sites == null) { p.push('sites is missing: say ["all"] or the site codes this is for, e.g. ["ABI"]'); return p; }
    if (!Array.isArray(def.sites) || !def.sites.length) { p.push('sites must be a list, e.g. ["all"] or ["ABI", "DAL"]'); return p; }
    if (def.sites.includes('all') && def.sites.length > 1) p.push('sites: "all" already covers every site; list it alone');
    def.sites.filter(x => x !== 'all').forEach(x => {
      if (!SITE_RE.test(x)) p.push(`sites: ${x} is not a site code`);
      else if (known && !known.has(x)) p.push(`sites: there is no site ${x}`);
    });
    return p;
  }

  /* The other definitions a definition uses: [{ kind, id }]. */
  function usesOf(kind, def) {
    const out = [];
    const add = (k, id) => { if (id) out.push({ kind: k, id }); };
    const builtins = new Set(FP.fn.builtins());
    const calls = f => { const s = FP.fn.syntax(String(f || '')); (s.calls || []).forEach(n => { if (!builtins.has(n.toUpperCase())) add('function', n); }); };
    const structOf = w => { const i = String(w || '').indexOf('.'); return i > 0 ? w.slice(0, i) : null; };
    if (!def || typeof def !== 'object') return out;
    if (kind === 'form') {
      const raw = def;
      // Sub-forms use what their own sources and fields use, and their title and repeat formulas.
      (Array.isArray(raw.subforms) ? raw.subforms : []).forEach(sf => {
        if (!sf || typeof sf !== 'object') return;
        usesOf('form', { sources: sf.sources, fields: sf.fields, layout: sf.layout, items: sf.items }).forEach(u => out.push(u));
        [sf.title, sf.repeat && typeof sf.repeat.count === 'string' ? sf.repeat.count : null, sf.repeat && sf.repeat.list].forEach(x => x && calls(x));
      });
      (Array.isArray(raw.due) ? raw.due : []).forEach(x => { if (x && typeof x === 'object') { const e = x.forEach != null ? x.forEach : x.forEachOpen; if (typeof e === 'string') add('structure', e); } });   // due schedules go item by item through a structure
      // Sources name the structures they read and write; their formulas are formulas like any other.
      (Array.isArray(def.sources) ? def.sources : []).forEach(src => { if (!src) return; add('structure', src.structure); if (src.filter) calls(src.filter); if (src.formula) calls(src.formula); });
      if (FP.sources) def = FP.sources.normalize(def);
      Object.keys(def.items || {}).forEach(s => add('structure', s));
      (def.fields || []).forEach(f => {
        if (!f) return;
        add('structure', structOf(f.writes)); add('structure', structOf(f.snapshot));
        if (f.control === 'pick') add('structure', f.structure);
        if (f.pick) add('structure', f.pick);   // a choice or chips picking from a structure (0.60)
        if (f.pickWhere) calls(f.pickWhere);
        if (f.control === 'buttons' && f.form) add('form', f.form);
        if (f.control === 'buttons') (Array.isArray(f.actions) ? f.actions : []).forEach(a => a && add('form', a.form));
        [f.formula, f.when, f.optionsFrom].forEach(x => x && calls(x));
        if (FP.forms && FP.forms.formulasOf) FP.forms.formulasOf({ fields: [f] }).forEach(calls); // any other formula setting
      });
      (def.buttons || []).forEach(b => {
        if (!b) return;
        if (b.action === 'open') add('form', b.form);
        if (b.link) add('structure', b.link);
        if (b.when) calls(b.when);
        Object.values(b.prefill || {}).forEach(f => calls(f));
      });
      (function walk(rows) {
        (Array.isArray(rows) ? rows : []).forEach(r => {
          if (!r || Array.isArray(r) || typeof r !== 'object') return;
          if (r.when) calls(r.when);
          walk(r.rows);
          (r.tabs || r.steps || r.panels || []).forEach(t => { if (t && t.when) calls(t.when); walk(t && t.rows); });
        });
      })(def.layout);
    } else if (kind === 'function') {
      if (def.formula) calls(def.formula);
      if (def.reads) add('structure', def.reads.structure);
    } else if (kind === 'structure') {
      Object.values(def.calculated || {}).forEach(c => c && add('function', c.fn));
      (def.status || []).forEach(r => r && calls(r.when));
      if (def.open) calls(def.open);
    } else if (def.formula) calls(def.formula);
    return out;
  }

  /* Uses that don't cover this definition's sites. find(kind, id) gives the used definition's doc, if it is in the library. */
  function siteGaps(kind, def, find) {
    const p = [];
    const seen = new Set();
    usesOf(kind, def).forEach(u => {
      const key = u.kind + '/' + u.id.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const dep = find(u.kind, u.id);
      if (dep && !dep.retired && !coversAll(def, dep.def)) p.push(`uses ${nameOf(u.kind, dep.id)}, which is for ${siteText(dep.def)}, not ${siteText(def)}`);
    });
    return p;
  }
  const findIn = docs => (k, id) => docs.get(docKey(k, id)) || Array.from(docs.values()).find(d => d.kind === k && d.id.toLowerCase() === id.toLowerCase()) || null;

  /* ---------- Checking ---------- */


  function checkFormula(where, formula, p) {
    const s = FP.fn.syntax(String(formula || ''));
    if (s.error) { p.push(`${where}: ${s.error}`); return; }
    const builtins = new Set(FP.fn.builtins());
    s.calls.forEach(n => { if (!builtins.has(n.toUpperCase()) && !FP.fn.get(n)) p.push(`${where}: no function named ${n}`); });
  }

  /* The names a form's fields save to: [{ structure, container, field }]. */
  function savesOf(def) {
    const out = [];
    if (FP.sources) def = FP.sources.normalize(def);
    const at = w => { const i = String(w || '').indexOf('.'); return i > 0 ? { structure: w.slice(0, i), container: w.slice(i + 1) } : null; };
    ((def && def.fields) || []).forEach(f => {
      if (!f) return;
      // A second item of a structure saves under structure~source, and a list source by its own name: both are that structure.
      [f.writes, f.snapshot].forEach(w => { const t = at(w); if (t) { t.structure = def.lists && def.lists[t.structure] ? def.lists[t.structure] : t.structure.split('~')[0]; out.push(Object.assign(t, { field: f.label || f.name })); } });
    });
    return out;
  }
  /* How each form gives items of a structure their IDs: [{ form, title, mode: 'entered'|'new', field, fieldLabel }].
   * A form that saves to a structure enters the ID when items.<structure>.field names one of its fields; otherwise it makes a new one each save. */
  function idModesIn(formId, def, structure) {
    if (FP.sources) def = FP.sources.normalize(def);
    const key = Object.keys((def && def.items) || {}).find(k => k.split('~')[0] === structure);
    const touches = !!key || savesOf(def).some(t => t.structure === structure);
    if (!touches) return null;
    const cfg = (key && def.items[key]) || {};
    const f = cfg.field ? ((def.fields || []).find(x => x && x.name === cfg.field) || { name: cfg.field }) : null;
    // Saved only to the items of a list (every running run): it adds to items that already exist (0.43).
    const viaList = !key && def.lists && ((def.fields || []).some(x => x && [x.writes, x.snapshot].some(w => { const i = String(w || '').indexOf('.'); return i > 0 && def.lists[w.slice(0, i)] === structure; })));
    if (viaList) return { form: formId, title: (def && def.title) || formId, mode: 'found', field: null, fieldLabel: 'the items of a list it reads' };
    // Found by a rule: it adds to an item that already exists, whatever the structure's ID rule.
    if (cfg.where) return { form: formId, title: (def && def.title) || formId, mode: 'found', field: null, fieldLabel: `the one where ${cfg.where}` };
    return { form: formId, title: (def && def.title) || formId, mode: cfg.field || cfg.fixed ? 'entered' : 'new', field: f ? f.name : null, fieldLabel: f ? (f.label || f.name) : cfg.fixed ? `the fixed ID ${cfg.fixed}` : null };
  }
  /* The names saves to a structure are given by published forms: each save button's own name, else the form's, else save. */
  function saveNames(structure, exceptForm) {
    const out = new Set();
    current.forEach(d => {
      if (d.kind !== 'form' || d.retired || d.id === exceptForm || !idModesIn(d.id, d.def, structure)) return;
      const saves = (d.def.buttons || []).filter(b => b && b.action === 'save');
      if (!saves.length) out.add(d.def.action || 'save');
      saves.forEach(b => out.add(b.saveAs || d.def.action || 'save'));
    });
    return Array.from(out).sort();
  }
  function idModes(structure) {
    const out = [];
    current.forEach(d => { if (d.kind === 'form' && !d.retired) { const m = idModesIn(d.id, d.def, structure); if (m) out.push(m); } });
    return out;
  }
  const ID_MADE = { entered: 'entered on the form', new: 'made new each save' };

  /* A value name a structure works out itself, so nothing may save to it: its calculated values, and status when it has status rules. */
  function workedOut(d, name) {
    if (!d) return null;
    if (d.calculated && Object.prototype.hasOwnProperty.call(d.calculated, name)) return 'a calculated value';
    if (name === 'status' && (d.status || []).length) return 'the status';
    return null;
  }

  function checkStructure(id, d) {
    const p = [];
    if (BUILT_IN.structure.has(id)) p.push(`${id} is built into the kernel`);
    if (d.itemId != null) {
      const t = d.itemId;
      if (!t || typeof t !== 'object' || Array.isArray(t)) p.push('itemId must be { label, made, prefix }');
      else {
        Object.keys(t).filter(k => !['label', 'made', 'prefix', 'once'].includes(k)).forEach(k => p.push(`itemId: unknown setting ${k}`));
        if (t.once != null && (t.once !== true || t.made !== 'entered')) p.push('itemId once (each ID is saved new only once) is yes, for IDs entered on the form');
        if (t.label != null && (typeof t.label !== 'string' || !t.label.trim() || t.label.length > 40)) p.push('itemId label must be text, at most 40 long');
        if (t.made != null && !Object.keys(ID_MADE).includes(t.made)) p.push('itemId made must be entered or new');
        if (t.prefix != null && (t.made !== 'new' || !/^[A-Z][A-Z0-9]{0,7}$/.test(t.prefix))) p.push(t.made !== 'new' ? 'itemId prefix only applies when IDs are made new each save' : 'itemId prefix: capital letters and digits, starting with a letter, at most 8');
      }
    }
    Object.entries(d.containers || {}).forEach(([name, c]) => {
      if (!c || typeof c !== 'object') { p.push(`Container ${name}: needs settings`); return; }
      if (c.rule != null && !FP.summary.rules.includes(c.rule)) p.push(`Container ${name}: rule must be one of ${FP.summary.rules.join(', ')}`);
    });
    Object.entries(d.calculated || {}).forEach(([name, c]) => {
      const f = c && FP.fn.get(c.fn);
      if (!f) { p.push(c && c.fn ? `Calculated ${name}: no function named ${c.fn}` : `Calculated ${name}: choose the function that works it out`); return; }
      const want = new Set(f.inputs.map(i => i.name));
      Object.entries(c.inputs || {}).forEach(([inp, src]) => {
        if (!want.has(inp)) p.push(`Calculated ${name}: ${f.name} has no input ${inp}`);
        if (typeof src === 'string' && src.startsWith('$') && !SOURCES.includes(src)) p.push(`Calculated ${name}: unknown source ${src}`);
      });
      f.inputs.filter(i => i.required !== false && !(i.name in (c.inputs || {}))).forEach(i => p.push(`Calculated ${name}: input ${i.name} is not filled`));
    });
    // One name, one value: a calculated value can't share a container's name, and status is reserved when there are status rules.
    Object.keys(d.calculated || {}).forEach(name => { if (Object.prototype.hasOwnProperty.call(d.containers || {}, name)) p.push(`${name} is both a container and a calculated value; rename one`); });
    if ((d.status || []).length && ['containers', 'calculated'].some(k => Object.prototype.hasOwnProperty.call(d[k] || {}, 'status'))) p.push('status is the name of the item\'s status; call that value something else');
    if (d.live != null && !(d.live && Number.isInteger(d.live.days) && d.live.days >= 1 && d.live.days <= 3650)) p.push('live must be { days: a whole number from 1 to 3650 }');
    if (d.open != null) {
      if (typeof d.open !== 'string' || !d.open.trim()) p.push('open must be a formula, e.g. status <> "Shipped"');
      else checkFormula('Open rule', d.open, p);
    }
    (d.status || []).forEach((r, i) => {
      if (!r || typeof r.value !== 'string') p.push(`Status rule ${i + 1}: needs a value`);
      else checkFormula(`Status ${r.value}`, r.when, p);
    });
    return p;
  }

  function checkOther(kind, id, d) {
    if (kind === 'form' && FP.forms) return FP.forms.check(d);
    const p = [];
    if (d.title != null && typeof d.title !== 'string') p.push('title must be text');
    return p;
  }

  /* ---------- Applying ---------- */
  function applyAll(docs, problems) {
    // Only this site's definitions are loaded; a definition using one that isn't for all its sites is not loaded.
    const find = findIn(docs);
    const live = kind => Array.from(docs.values()).filter(d => d.kind === kind && !d.retired && coversSite(d.def, here())).filter(d => {
      const gaps = siteGaps(kind, d.def, find);
      if (gaps.length) problems.push({ kind: d.kind, id: d.id, version: d.version, message: `Not loaded: ${gaps.join('; ')}` });
      return !gaps.length;
    });
    const fail = (doc, msgs) => problems.push({ kind: doc.kind, id: doc.id, version: doc.version, message: `Not loaded: ${msgs.join('; ')}` });
    const next = new Map(KINDS.map(k => [k, new Set()]));

    // Take away what this loader put in place before; built-ins are never touched.
    applied.get('structure').forEach(id => FP.structures.remove(id));
    applied.get('function').forEach(name => FP.fn.remove(name));
    // Session types are gone (0.36): old ones stay in the library, not loaded, until they are retired.

    // Retired functions and structures stay defined (0.65): forms already using a retired function keep evaluating,
    // and a retired structure's entries keep reading with its own rules. They are hidden from lists and pickers.
    const retiredOf = kind => Array.from(docs.values()).filter(d => d.kind === kind && d.retired && coversSite(d.def, here()));

    // Functions: keep trying until nothing more loads (a function needs the ones it calls).
    let pending = live('function').concat(retiredOf('function'));
    const lastError = new Map();
    let progress = true;
    while (pending.length && progress) {
      progress = false;
      pending = pending.filter(doc => {
        try { FP.fn.define(Object.assign({}, doc.def, { name: doc.id, version: doc.version }, doc.retired ? { retired: true } : {})); next.get('function').add(doc.id); progress = true; return false; }
        catch (e) { lastError.set(doc.id, e.problems || [e.message]); return true; }
      });
    }
    pending.filter(doc => !doc.retired).forEach(doc => fail(doc, lastError.get(doc.id)));

    // Structures (sessions an older one still names are ignored: nothing records them now).
    live('structure').forEach(doc => {
      const p = checkStructure(doc.id, doc.def);
      if (p.length) { fail(doc, p); return; }
      // A kind (0.59) brings its status, open rule and ID rule; a structure from before kinds loads as it was.
      FP.structures.define(Object.assign({}, FP.kinds ? FP.kinds.expand(doc.def) : doc.def, { id: doc.id, version: doc.version }));
      next.get('structure').add(doc.id);
    });

    retiredOf('structure').forEach(doc => {
      if (checkStructure(doc.id, doc.def).length) return;
      FP.structures.defineRetired(Object.assign({}, FP.kinds ? FP.kinds.expand(doc.def) : doc.def, { id: doc.id, version: doc.version }));
      next.get('structure').add(doc.id);
    });

    // Forms: checked and kept for the form runtime.
    ['form'].forEach(kind => live(kind).forEach(doc => {
      const p = checkOther(kind, doc.id, doc.def);
      if (p.length) fail(doc, p); else next.get(kind).add(doc.id);
    }));

    applied = next;
  }

  /* ---------- Load times: which structures are slow ----------
   * Every terminal saves its recent load times to _stats/{terminal}.json. A
   * structure is slow when, on any terminal in the last week, loading it takes
   * longer than slowMs or it holds more than slowEntries entries. */
  async function readStats() {
    const by = {};
    const weekAgo = Date.now() - 7 * 864e5;
    let names = [];
    try { names = await FP.files.list(['_stats']); } catch (_) { return by; }
    for (const n of names) {
      const st = await FP.files.readJson(['_stats'], n).catch(() => null);
      if (!st || !st.structures) continue;
      for (const [s, x] of Object.entries(st.structures)) {
        if (!x || Date.parse(x.at) < weekAgo) continue;
        // The slowest load and the biggest entry count are judged separately: they are often on different terminals (F39).
        const prev = by[s];
        if (!prev) { by[s] = Object.assign({ terminal: st.terminalId }, x, { entriesAt: x.entries || 0, entriesTerminal: st.terminalId }); continue; }
        if (x.loadMs > prev.loadMs) Object.assign(prev, x, { terminal: st.terminalId });
        if ((x.entries || 0) > prev.entriesAt) Object.assign(prev, { entriesAt: x.entries, entriesTerminal: st.terminalId });
      }
    }
    return by;
  }

  function perfOf(id, stats) {
    const x = stats[id];
    if (!x) return { status: 'unknown', message: 'No load times reported yet.' };
    const most = Math.max(x.entries || 0, x.entriesAt || 0);
    const slow = x.loadMs > FP.defs.slowMs || most > FP.defs.slowEntries;
    const def = FP.structures.get(id);
    const took = x.loadMs >= 1000 ? `${(x.loadMs / 1000).toFixed(1)} s` : `${x.loadMs} ms`;
    const bigger = x.entriesAt > x.entries;   // another terminal holds more entries than the slowest one
    const what = `loading takes ${took} on ${x.terminal} (${x.items.toLocaleString()} items from ${x.entries.toLocaleString()} entries)${bigger ? `; ${x.entriesTerminal} reads ${x.entriesAt.toLocaleString()} entries` : ''}`;
    if (!slow) return Object.assign({ status: 'ok', message: `OK: ${what}.` }, x);
    const advice = BUILT_IN.structure.has(id)
      ? '. This structure is built into the kernel, so it has no definition to change: report it.'
      : def.live
        ? `, even with its ${def.live.days}-day live window. Shorten the window${def.open ? ' or narrow the open rule' : ' or add an open rule'}.`
        : '. Set a live window in its definition, and an open rule so items still open stay in view.';
    return Object.assign({ status: 'slow', message: `Slow: ${what}${advice}` }, x);
  }

  /* ---------- Loading ---------- */
  let running = null;
  let again = false;

  /* patch (0.53.2): the definition this page just published. The library is the one already read with that one
   * changed, instead of reading every definition again (seconds on a synced folder with a big library). If another
   * terminal published meanwhile, the change stamps show it and the whole library is read once more. */
  let folderProblems = [];
  async function loadOnce(patch) {
    const problems = [];
    let docs;
    let source = 'folder';
    const quick = !!(patch && current && current.size && lastReport && lastReport.source === 'folder' && lastReport.signature != null);
    try {
      if (quick) {
        docs = new Map(current);
        if (!patch.trial) docs.set(docKey(patch.kind, patch.id), patch);
        folderProblems = folderProblems.filter(x => !(x.kind === patch.kind && x.id === patch.id));
      } else {
        const fp = [];
        docs = await readAll(fp);
        folderProblems = fp;
      }
      problems.push(...folderProblems);
      await FP.kv.set('defsCache', { at: new Date().toISOString(), docs: Array.from(docs.values()) });
    } catch (e) {
      const cached = await FP.kv.get('defsCache');
      if (!cached) throw e;
      docs = new Map(cached.docs.map(d => [docKey(d.kind, d.id), d]));
      source = 'cache';
      problems.unshift({ kind: null, id: null, message: `The library folder could not be read (${e.message}); using this terminal's saved copy from ${new Date(cached.at).toLocaleString()}.` });
    }
    // Set first: checks look things up by name while everything is applied.
    current = docs;
    applyAll(docs, problems);
    const counts = {};
    KINDS.forEach(k => { counts[k] = Array.from(applied.get(k)).filter(id => { const d = docs.get(docKey(k, id)); return d && !d.retired; }).length; });
    if (!quick) stats = await readStats().catch(() => ({}));
    const warnings = [];
    docs.forEach(d => {
      if (!d.retired && d.def && d.def.sites == null) warnings.push({ kind: d.kind, id: d.id, message: "doesn't say which sites it is for, so it is used at all sites. Publish it again with sites set." });
    });
    Object.keys(stats).forEach(id => {
      const pf = perfOf(id, stats);
      if (pf.status === 'slow') warnings.push({ kind: 'structure', id, builtIn: BUILT_IN.structure.has(id), message: pf.message });
    });
    const before = lastReport && lastReport.signature;
    const signature = await changeSignature().catch(() => null);
    if (quick && signature !== withStamp(before, `${patch.terminalId}.json`, patch.publishedAt)) again = true;
    lastReport = { at: new Date().toISOString(), source, counts, problems, warnings, signature, quick };
    window.dispatchEvent(new CustomEvent('fp-defs', { detail: lastReport }));
    return lastReport;
  }

  // The change stamps as they would read with one more stamp written: name@at, in name order.
  function withStamp(sig, name, at) {
    if (sig == null) return null;
    return sig.split('|').filter(x => x && !x.startsWith(name + '@')).concat(`${name}@${at}`).sort().join('|');
  }

  /* One load at a time; a request during a load runs once more afterwards (a whole read). */
  function load(patch) {
    if (running) { again = true; return running; }
    running = (async () => {
      try {
        let r, p = patch && patch.fp === 'definition' ? patch : null;
        do { again = false; r = await loadOnce(p); p = null; } while (again);
        return r;
      } finally { running = null; }
    })();
    return running;
  }

  /* ---------- Watching for changes ---------- */
  async function changeSignature() {
    const parts = [];
    for (const n of await FP.files.list(CHANGES)) {
      const s = await FP.files.readJson(CHANGES, n);
      parts.push(n + '@' + (s ? s.at : '?'));
    }
    return parts.join('|');
  }

  const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('fp-defs') : null;
  if (channel) channel.onmessage = () => load().catch(() => {});

  let watchTimer = null;
  function watch(opts) {
    opts = opts || {};
    const every = opts.intervalMs || 30000;
    const full = opts.fullReloadMs || 600000;
    let lastFull = Date.now();
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const sig = await changeSignature();
        if ((lastReport && sig !== lastReport.signature) || Date.now() - lastFull > full) {
          lastFull = Date.now();
          await load();
          // A stamp can arrive before the definition file it announces (sync order); look again shortly.
          if (await missingAnnounced()) setTimeout(() => load().catch(() => {}), 15000);
        }
      } catch (_) { /* folder unreachable: try next time */ }
      busy = false;
    };
    if (watchTimer) clearInterval(watchTimer);
    watchTimer = setInterval(tick, every);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    return () => { clearInterval(watchTimer); watchTimer = null; };
  }

  async function missingAnnounced() {
    for (const n of await FP.files.list(CHANGES)) {
      const s = await FP.files.readJson(CHANGES, n);
      if (!s || !s.kind) continue;
      const d = current.get(docKey(s.kind, s.id));
      if (!d || d.version < s.version) return true;
    }
    return false;
  }

  /* ---------- Who depends on what ---------- */
  const dname = (kind, d) => (d && d.def && (kind === 'form' ? d.def.title : d.def.label)) || (d && d.id) || '';
  const kindWord = (kind, d) => (kind === 'function' && d && d.def && d.def.kind === 'lookup' ? 'lookup' : LABELS[kind] || kind);
  const ikey = (kind, id) => kind + '/' + String(id).split('~')[0].toLowerCase();

  /* Who uses what, read once from every active definition: ikey -> [{ kind, id }]. */
  function usageIndex() {
    const idx = new Map();
    current.forEach(d => {
      if (d.retired || !['form', 'function', 'structure'].includes(d.kind)) return;
      const seen = new Set();
      usesOf(d.kind, d.def).forEach(u => {
        const k = ikey(u.kind, u.id);
        if (seen.has(k) || (u.kind === d.kind && u.id.toLowerCase() === d.id.toLowerCase())) return;
        seen.add(k);
        if (!idx.has(k)) idx.set(k, []);
        idx.get(k).push({ kind: d.kind, id: d.id });
      });
    });
    return idx;
  }

  /* The active definitions that use one: [{ kind, id }]. `ignore` is a Set of 'kind/id' left out (a group being retired together). */
  function dependentsOf(kind, id, idx, ignore, docsOnly) {
    const out = new Map();
    const add = (k, i) => { const key = k + '/' + String(i).toLowerCase(); if (!out.has(key)) out.set(key, { kind: k, id: i }); };
    const ix = idx || usageIndex();
    (ix.get(ikey(kind, id)) || []).forEach(u => add(u.kind, u.id));
    // Defined in code or loaded from elsewhere (not in the library): what the loaded functions and structures say.
    if (kind === 'function' && !docsOnly) {
      FP.fn.list().forEach(f => { if (f.formula && FP.fn.syntax(f.formula).calls.some(c => c.toLowerCase() === id.toLowerCase())) add('function', f.name); });
      FP.structures.list().forEach(st => {
        if (Object.values(st.calculated || {}).some(c => c.fn === id)) add('structure', st.id);
        else if ((st.status || []).some(r => FP.fn.syntax(String(r.when || '')).calls.some(c => c.toLowerCase() === id.toLowerCase()))) add('structure', st.id);
      });
    }
    if (kind === 'structure' && !docsOnly) FP.fn.list().forEach(f => { if (f.reads && f.reads.structure === id) add('function', f.name); });
    const self = (kind + '/' + id).toLowerCase();
    return Array.from(out.values()).filter(d => (d.kind + '/' + d.id).toLowerCase() !== self && !(ignore && ignore.has((d.kind + '/' + d.id).toLowerCase())));
  }
  function dependents(kind, id) { return dependentsOf(kind, id).map(d => `${d.kind} ${d.id}`); }

  // A structure that is published, retired ones included (retired ones are refused by retiredUses, with their name).
  const knownStructure = st => FP.structures.has(st) || (FP.structures.isRetired && FP.structures.isRetired(st));

  /* Retired definitions a definition would use: refused at publish, naming each. Forms opening retired forms are named by formLinks. */
  function retiredUses(kind, id, def) {
    const p = [];
    const find = findIn(current);
    const seen = new Set();
    usesOf(kind, def).forEach(u => {
      if (u.kind === 'form') return;
      const d = find(u.kind, String(u.id).split('~')[0]);
      if (!d || !d.retired || seen.has(d.kind + '/' + d.id)) return;
      seen.add(d.kind + '/' + d.id);
      p.push(`${kindWord(d.kind, d)} ${d.id} is retired: take it out of this ${LABELS[kind]}, or ask an admin to reinstate it`);
    });
    return p;
  }

  /* Would this definition load, and would anything that depends on it still load? */
  function trial(kind, id, def) {
    const p = [];
    if (kind === 'session-type') {
      p.push(`Session types are gone (0.36), so ${id} can't be published. Retire it instead (Admin > Clean-up retires every one). A run is now an item of a Runs structure that forms find with "Found by a rule"; a shift is worked out from when a save happened.`);
    } else if (kind === 'structure') {
      // Every structure published from 0.59 has a kind; its rules are checked as the kind makes them.
      if (FP.kinds) p.push(...FP.kinds.check(def));
      p.push(...checkStructure(id, FP.kinds ? FP.kinds.expand(def) : def));
      if (def.sessions && typeof def.sessions === 'object' && Object.keys(def.sessions).length) p.push(`Sessions are gone (0.36): take them out of this structure (Take the sessions out, on its first row). ${def.sessions.shift ? 'For the shift, add a calculated value instead (Admin > Clean-up can make it from the old time table). ' : ''}Entries saved before keep their references.`);
      // Forms must give its items IDs the way it says.
      const made = def.itemId && def.itemId.made;
      if (made) idModes(id).filter(m => m.mode !== made && m.mode !== 'found').forEach(m => p.push(`form ${m.form} ${m.mode === 'entered' ? `enters the ID in ${m.fieldLabel}` : 'makes a new ID each save'}, but this structure's IDs are ${ID_MADE[made]}; change the form first, or choose ${m.mode === 'entered' ? 'entered' : 'new each save'}`));
      // Forms already saving to a name this structure would now work out itself.
      current.forEach(d => {
        if (d.kind !== 'form' || d.retired) return;
        savesOf(d.def).filter(t => t.structure === id).forEach(t => {
          const w = workedOut(def, t.container);
          if (w) p.push(`form ${d.id} (${t.field}) saves to ${t.container}, which would be ${w}; what it saves would be hidden. Rename the value, or change the form first`);
        });
      });
    } else if (kind === 'function') {
      // A lookup reads a structure that is published (0.53: one reading a structure that wasn't was published).
      if (def && def.reads && def.reads.structure && !knownStructure(def.reads.structure)) p.push(`It reads structure ${def.reads.structure}, which isn't published`);
      const prior = FP.fn.get(id);
      try {
        FP.fn.define(Object.assign({}, def, { name: id }));
        FP.fn.list().filter(f => f.name !== id && f.formula && FP.fn.syntax(f.formula).calls.some(c => c.toLowerCase() === id.toLowerCase())).forEach(f => {
          const m = FP.fn.check(f);
          if (m.length) p.push(`function ${f.name} would break: ${m.join(', ')}`);
        });
        FP.structures.list().forEach(s => {
          if (!Object.values(s.calculated || {}).some(c => c.fn === id)) return;
          const m = checkStructure(s.id, s);
          if (m.length) p.push(`structure ${s.id} would break: ${m.join(', ')}`);
        });
      } catch (e) {
        p.push(...(e.problems || [e.message]));
      } finally {
        if (prior) FP.fn.define(prior); else FP.fn.remove(id);
      }
    } else {
      p.push(...checkOther(kind, id, def));
      if (kind === 'form') (Array.isArray(def.acknowledge) ? def.acknowledge : []).forEach((a, i) => {
        if (a && a.every === 'shift') p.push(`Read before starting ${a.name || i + 1}: every shift is gone with sessions; choose every so many hours (hours 12 for a 12-hour shift) or every day`);
      });
      // Older ways of writing a form are not published any more (0.48): the editor and Admin > Clean-up convert them.
      if (kind === 'form') {
        if (!Array.isArray(def.sources)) p.push('This form is written the older way, before sources: open it in the editor (it converts it) or use Admin > Clean-up > Older forms');
        if (def.action) p.push('Name of its saves is an older setting: each save button names its saves now (the editor moves it there)');
        (Array.isArray(def.buttons) ? def.buttons : []).forEach(b => { if (b && (b.action === 'open' || b.action === 'apply')) p.push(`Button ${b.name || '?'}: ${b.action === 'open' ? 'Open another form' : 'Apply'} buttons are gone (0.48): make what it opens a sub-form of this one`); });
      }
      if (kind === 'form') {
        const touched = new Set(Object.keys(def.items || {}).concat(savesOf(def).map(t => t.structure)));
        touched.forEach(st => {
          const sd = current.get(docKey('structure', st));
          const made = sd && !sd.retired && sd.def.itemId && sd.def.itemId.made;
          const m = idModesIn(id, def, st);
          if (made && m && m.mode !== made && m.mode !== 'found') p.push(made === 'entered'
            ? `${st} IDs are entered on the form: say which field holds the ID of the ${st} item it saves to`
            : `${st} IDs are made new each save: this form can't enter or fix one; its ${st} item must be new each save`);
        });
      }
      if (kind === 'form') savesOf(def).forEach(t => {
        const s = current.get(docKey('structure', t.structure));
        const w = s && !s.retired ? workedOut(s.def, t.container) : null;
        if (w) p.push(`${t.field} saves to ${t.structure}.${t.container}, which is ${w} of ${t.structure} and can't be saved to`);
        // What it saves to exists (0.53: a form saving to a structure, or a value, that wasn't there was published).
        else if (!knownStructure(t.structure)) p.push(`${t.field} saves to ${t.structure}, which isn't a published structure`);
        // A value is a container, or one a container is taken from (surfaceFails from surfaceBad).
        else if (s && !s.retired && !Object.prototype.hasOwnProperty.call(s.def.containers || {}, t.container) && !Object.values(s.def.containers || {}).some(c => c && c.from === t.container)) p.push(`${t.field} saves to ${t.container}, which ${t.structure} doesn't have: add it to the structure first`);
      });
      if (kind === 'form') (Array.isArray(def.sources) ? def.sources : []).forEach(x => {
        if (x && (x.kind === 'item' || x.kind === 'items') && x.structure && !knownStructure(String(x.structure).split('~')[0])) p.push(`Source ${x.name || '?'} reads ${x.structure}, which isn't a published structure`);
      });
    }
    return p;
  }

  /* A form's open buttons: the forms must exist, and no form may open itself through others. */
  function formLinks(id, def) {
    const p = [];
    // Forms a form opens: its open buttons, and the forms its "buttons from a list" fields (and their cards' buttons) open (F21).
    const opens = d => {
      const out = ((d && d.buttons) || []).filter(b => b && b.action === 'open' && b.form).map(b => b.form);
      const fieldsOf = x => (Array.isArray(x && x.fields) ? x.fields : []).concat(...(Array.isArray(x && x.subforms) ? x.subforms : []).map(sf => (Array.isArray(sf && sf.fields) ? sf.fields : [])));
      fieldsOf(d).forEach(f => {
        if (!f || f.control !== 'buttons') return;
        if (typeof f.form === 'string' && f.form) out.push(f.form);
        (Array.isArray(f.actions) ? f.actions : []).forEach(a => { if (a && typeof a.form === 'string' && a.form) out.push(a.form); });
      });
      return out;
    };
    opens(def).forEach(f => { const t = current.get(docKey('form', f)); if (f !== id && !(t && !t.retired)) p.push(`a button opens form ${f}, which is ${t && t.retired ? 'retired: take it out, or ask an admin to reinstate it' : 'not published'}`); });
    const path = [id];
    const seen = new Set();
    (function walk(fid, d) {
      for (const next of opens(d)) {
        if (next === id) { p.push(`forms would open each other in a loop: ${path.concat(id).join(' → ')}`); return true; }
        if (seen.has(next)) continue;
        seen.add(next);
        const nd = current.get(docKey('form', next));
        if (!nd || nd.retired) continue;
        path.push(next);
        if (walk(next, nd.def)) return true;
        path.pop();
      }
      return false;
    })(id, def);
    return p;
  }

  /* Everything publish would refuse about a definition, without publishing it. */
  async function check(kind, id, def) {
    // A form that shows library entries is checked against the library, so read it first (F41).
    if (kind === 'form' && FP.media && FP.media.library && !FP.media.library.loaded() && def && Array.isArray(def.media) && def.media.some(m => m && m.entry)) await FP.media.library.load().catch(() => null);
    const known = FP.sites ? new Set((await FP.sites.list()).map(s => s.id)) : null;
    const p = checkSites(def, known).concat(trial(kind, id, def));
    // Its sites must be covered by what it uses, and must still cover what uses it.
    const find = (k, i) => current.get(docKey(k, i)) || Array.from(current.values()).find(d => d.kind === k && d.id.toLowerCase() === i.toLowerCase()) || null;
    p.push(...siteGaps(kind, def, find));
    if (kind === 'form') p.push(...formLinks(id, def));
    if (def && typeof def === 'object') p.push(...retiredUses(kind, id, def));
    current.forEach(d => {
      if (d.retired || (d.kind === kind && d.id === id)) return;
      if (usesOf(d.kind, d.def).some(u => u.kind === kind && u.id.toLowerCase() === id.toLowerCase()) && !coversAll(d.def, def)) {
        p.push(`${nameOf(d.kind, d.id)} uses it at ${siteText(d.def)}; ${siteText(def)} would leave it out`);
      }
    });
    return p;
  }

  /* ---------- Publishing ---------- */
  const publishRole = () => FP.defs.publishRole;

  async function publish(kind, id, def, opts) {
    opts = opts || {};
    if (!KINDS.includes(kind)) throw new Error(`Kind must be one of ${KINDS.join(', ')}.`);
    if (!idOk(kind, id)) throw new Error(kind === 'function'
      ? 'A function name uses letters, digits and _, starts with a letter, and is at most 40 long.'
      : 'A name uses lowercase letters, digits and -, starts with a letter, and is at most 40 long.');
    if (BUILT_IN[kind] && BUILT_IN[kind].has(id)) throw new Error(`${nameOf(kind, id)} is built into the kernel and can't be published over.`);
    if (!opts.retire && (!def || typeof def !== 'object' || Array.isArray(def))) throw new Error('The definition must be an object.');
    let user = null;
    if (FP.users) {
      user = await FP.users.current();
      const a = /^[aeiou]/.test(publishRole()) ? 'an' : 'a';
      // Say which: nobody signed in (a sign-in lasts 12 hours, or someone signed out in another window) or someone without the role.
      if (!user) throw new Error(`Nobody is signed in on this terminal now (a sign-in ends after 12 hours, or when someone signs out or in elsewhere on it). Sign in as ${a} ${publishRole()}, then publish.`);
      if (!(await FP.users.can(publishRole()))) throw new Error(`${user.name} is signed in on this terminal now, and only ${a} ${publishRole()} can publish definitions. Sign in as ${a} ${publishRole()}, then publish.`);
    }

    // Windows folder names ignore case: CurrentSpec and currentspec would share a folder.
    const twin = (await FP.files.listDirs(ROOT.concat(kind))).find(n => n !== id && n.toLowerCase() === id.toLowerCase());
    if (twin) {
      const td = current.get(docKey(kind, twin));
      throw new Error(`${nameOf(kind, twin)} already ${td && td.retired ? 'exists (retired; an id is never reused: ask an admin to reinstate it, or choose another)' : 'exists'}; names can't differ only by capital letters.`);
    }

    const problems = [];
    const existing = await readCurrent(kind, id, problems);
    const top = existing ? existing.version : 0;
    // Version numbers count trials too, so a trial and the next real version never share a number.
    const highest = Math.max(top, ...(await readFolder(kind, id)).files.map(f => f.version));
    if (opts.trial && kind !== 'form') throw new Error('Only forms can be published as a trial.');
    const basedOn = opts.basedOn == null ? null : opts.basedOn;
    // A retired definition keeps its id and storage folder for good: a new definition can't take them, and only an admin brings it back.
    if (existing && existing.retired && !opts.retire && !opts.reinstate) {
      if (basedOn == null) throw new Error(`${nameOf(kind, id)} is retired, and a retired id is never reused. Ask an admin to reinstate it, or choose another id.`);
      if (FP.users && !(await FP.users.can('admin'))) throw new Error(`${nameOf(kind, id)} is retired: only an admin can reinstate it (Reinstate), then it can be changed.`);
    }
    if (!opts.force) {
      if (existing && basedOn == null) throw new Error(`${nameOf(kind, id)} already exists (version ${top}). Open it and publish your change from there.`);
      if (existing && basedOn !== top) {
        const who = existing.publishedBy ? existing.publishedBy.name : existing.terminalId;
        throw new Error(`${nameOf(kind, id)} changed since you opened it: version ${top} by ${who} at ${new Date(existing.publishedAt).toLocaleString()}. Reload it and make your change again.`);
      }
    }

    let together = [];
    if (opts.retire) {
      if (!existing || existing.retired) throw new Error(`${nameOf(kind, id)} is not published, so there is nothing to retire.`);
      if (opts.supersededBy != null && kind !== 'form') throw new Error('Only a form can be superseded by another form.');
      const ignore = opts._set || null;
      const set = new Set([(kind + '/' + id).toLowerCase()]);
      (Array.isArray(opts.together) ? opts.together : []).forEach(t => t && set.add((t.kind + '/' + t.id).toLowerCase()));
      // The ones retired in the same call: each must be published, active and still wanted only by the set.
      const idx = usageIndex();
      const listed = [];
      (Array.isArray(opts.together) ? opts.together : []).forEach(t => {
        if (!t || !KINDS.includes(t.kind) || typeof t.id !== 'string') throw new Error('together lists definitions as { kind, id }.');
        if (t.kind === kind && t.id === id) return;
        if (listed.some(x => x.kind === t.kind && x.id === t.id)) return;
        const d = current.get(docKey(t.kind, t.id));
        if (!d || d.retired) throw new Error(`${nameOf(t.kind, t.id)} is not published, or already retired, so it can't be retired together with ${nameOf(kind, id)}. Nothing was retired.`);
        listed.push({ kind: t.kind, id: t.id, doc: d });
      });
      if (!opts.force) {
        const probs = [];
        [{ kind, id }].concat(listed).forEach(t => {
          const deps = dependentsOf(t.kind, t.id, idx, ignore || set);
          if (deps.length) probs.push(retireRefusal(t.kind, t.id, deps));
        });
        if (probs.length) throw new Error(probs.join(' ') + (listed.length ? ' Nothing was retired.' : ''));
      }
      if (opts.supersededBy != null) {
        if (kind !== 'form') throw new Error('Only a form can be superseded by another form.');
        const t = findIn(current)('form', String(opts.supersededBy));
        if (!t) throw new Error(`Form ${opts.supersededBy} is not published, so it can't replace form ${id}.`);
        if (t.id === id) throw new Error(`Form ${id} can't be replaced by itself.`);
        if (t.retired) throw new Error(`Form ${t.id} is retired, so it can't replace form ${id}. Choose a form that is in use.`);
        if (set.has(('form/' + t.id).toLowerCase())) throw new Error(`Form ${t.id} is being retired too, so it can't replace form ${id}.`);
        const chain = new Set([t.id]);
        for (let c = t; c && c.supersededBy; c = current.get(docKey('form', c.supersededBy))) {
          if (c.supersededBy === id) throw new Error(`Form ${id} replaced by form ${t.id} would make a loop (${t.id} is replaced by ${id}).`);
          if (chain.has(c.supersededBy)) break;
          chain.add(c.supersededBy);
        }
      }
      together = listed;
    } else if (!opts.skipCheck) {
      const p = await check(kind, id, def);
      if (p.length) { const e = new Error(p.join('; ')); e.problems = p; throw e; }
    }

    // A form records the versions of what it uses, so a launcher pinned to it can say what changed since.
    const uses = {};
    if (kind === 'form' && !opts.retire) usesOf(kind, def).forEach(u => { const d = current.get(docKey(u.kind, u.id)); if (d) uses[docKey(u.kind, d.id)] = d.version; });
    const doc = {
      fp: 'definition', v: 1, kind, id, version: highest + 1, basedOn: existing ? top : null,
      trial: !!opts.trial, uses: kind === 'form' ? uses : undefined,
      publishedAt: new Date().toISOString(),
      publishedBy: user ? { userId: user.id, name: user.name } : null,
      terminalId: FP.identity.terminalId, note: opts.note || '', retired: !!opts.retire,
      supersededBy: opts.retire && opts.supersededBy != null ? findIn(current)('form', String(opts.supersededBy)).id : undefined,
      def: opts.retire && existing ? existing.def : def,
    };
    await FP.files.writeJson(ROOT.concat(kind, id), fileName(doc.version, doc.terminalId), doc);
    await FP.files.writeJson(CHANGES, `${doc.terminalId}.json`, { at: doc.publishedAt, kind, id, version: doc.version });
    let report = await load(doc);
    if (channel) channel.postMessage({ kind, id, version: doc.version });
    // Retired together: all or nothing. Everything was checked first; if a write still fails, the ones done are put back.
    const done = [];
    try {
      for (const t of together) {
        const cur = current.get(docKey(t.kind, t.id));
        const r = await publish(t.kind, t.id, null, { retire: true, basedOn: cur.version, note: opts.note, _set: new Set([(kind + '/' + id).toLowerCase()].concat(together.map(x => (x.kind + '/' + x.id).toLowerCase()))), force: opts.force });
        done.push({ kind: t.kind, id: t.id, before: t.doc });
        report = r.report;
      }
    } catch (e) {
      for (const d of done.map(x => x).concat([{ kind, id, before: existing }])) {
        try { const cur = current.get(docKey(d.kind, d.id)); await publish(d.kind, d.id, d.before.def, { reinstate: true, skipCheck: true, basedOn: cur.version, note: 'Put back: retiring together failed' }); } catch (_) { /* best effort */ }
      }
      throw new Error(`${e.message} Nothing was retired.`);
    }
    return { doc, report, together: done.map(d => current.get(docKey(d.kind, d.id))) };
  }

  async function history(kind, id) {
    const { parts, files } = await readFolder(kind, id);
    const out = [];
    for (const f of files) {
      const doc = await FP.files.readJson(parts, f.name);
      if (doc) out.push(Object.assign({ file: f.name }, doc));
    }
    return out.sort((a, b) => b.version - a.version || b.publishedAt.localeCompare(a.publishedAt));
  }

  /* ---------- Drafts: work not published yet, problems and all ----------
   * drafts/<kind>/<id>.json in the data folder, one per definition, so a half-done edit survives closing the
   * editor and can be picked up on any terminal: { fp: 'draft', kind, id, def,
   * basedOn (the version it started from, null for a new one), note, savedAt, savedBy }.
   * Nothing loads or runs a draft; publishing it removes it. */
  const DRAFTS = ['drafts'];
  const draftFile = id => `${id}.json`;
  const drafts = {
    async list() {
      const out = [];
      for (const kind of KINDS) {
        let names = [];
        try { names = await FP.files.list(DRAFTS.concat(kind)); } catch (_) { continue; }
        for (const n of names) {
          if (!/\.json$/i.test(n)) continue;
          const d = await FP.files.readJson(DRAFTS.concat(kind), n).catch(() => null);
          if (d && d.fp === 'draft' && d.kind === kind && d.id) out.push(d);
        }
      }
      return out;
    },
    async get(kind, id) {
      return FP.files.readJson(DRAFTS.concat(kind), draftFile(id)).catch(() => null);
    },
    async save(kind, id, o) {
      if (!KINDS.includes(kind)) throw new Error(`No kind ${kind}.`);
      const user = FP.users ? await FP.users.current() : null;
      if (FP.users && !user) throw new Error('Sign in to keep a draft.');
      const d = { fp: 'draft', v: 1, kind, id, def: o.def, basedOn: o.basedOn == null ? null : o.basedOn,
        note: o.note || '', savedAt: new Date().toISOString(), savedBy: user ? { userId: user.id, name: user.name } : null, terminal: FP.identity ? FP.identity.terminalId : null };
      await FP.files.writeJson(DRAFTS.concat(kind), draftFile(id), d);
      return d;
    },
    async remove(kind, id) {
      try { await FP.files.remove(DRAFTS.concat(kind), draftFile(id)); } catch (_) { /* already gone */ }
    },
  };


  /* ---------- Retiring: the report, the refusal, the way out (0.65) ---------- */
  function fixFor(kind, id, dep) {
    const dd = current.get(docKey(dep.kind, dep.id));
    const dn = dd ? dname(dep.kind, dd) : dep.id;
    const me = current.get(docKey(kind, id));
    if (dep.kind === 'function' && kind === 'structure') return `Retire ${kindWord(dep.kind, dd)} ${dn} first, or point it at another structure`;
    return `Retire ${kindWord(dep.kind, dd)} ${dn} first, or take the ${dname(kind, me)} ${kindWord(kind, me)} out of it`;
  }
  function retireRefusal(kind, id, deps) {
    return `${nameOf(kind, id)} is still used by ${deps.map(d => `${d.kind} ${d.id}`).join(', ')}. ${deps.map(d => fixFor(kind, id, d) + '.').join(' ')}`;
  }

  function retireReport(kind, id) {
    const d = current.get(docKey(kind, id));
    if (!d) throw new Error(`${nameOf(kind, id)} is not published.`);
    const out = { kind, id, name: dname(kind, d), canRetire: true, blockers: [], onlyUsedBy: [] };
    if (d.retired) { out.canRetire = false; out.reason = `${nameOf(kind, id)} is already retired.`; return out; }
    if (BUILT_IN[kind] && BUILT_IN[kind].has(id)) { out.canRetire = false; out.reason = `${nameOf(kind, id)} is built into the kernel.`; return out; }
    const idx = usageIndex();
    out.blockers = dependentsOf(kind, id, idx).map(x => {
      const dd = current.get(docKey(x.kind, x.id));
      return { kind: x.kind, id: x.id, name: dd ? dname(x.kind, dd) : x.id, fix: fixFor(kind, id, x) };
    });
    out.canRetire = !out.blockers.length;
    // What only this one uses: structures, functions, lookups and forms nothing else active uses.
    const self = (kind + '/' + id).toLowerCase();
    const seen = new Set();
    usesOf(kind, d.def).forEach(u => {
      const t = findIn(current)(u.kind, String(u.id).split('~')[0]);
      if (!t || t.retired || (t.kind + '/' + t.id).toLowerCase() === self || seen.has(t.kind + '/' + t.id)) return;
      if (BUILT_IN[t.kind] && BUILT_IN[t.kind].has(t.id)) return;
      seen.add(t.kind + '/' + t.id);
      const deps = dependentsOf(t.kind, t.id, idx);
      if (deps.length && deps.every(x => (x.kind + '/' + x.id).toLowerCase() === self)) out.onlyUsedBy.push({ kind: t.kind, id: t.id, name: dname(t.kind, t) });
    });
    out.onlyUsedBy.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
    return out;
  }

  /* Admin only: a new active version of a retired definition, carrying the last active version's definition. */
  async function reinstate(kind, id, opts) {
    if (FP.users) {
      const user = await FP.users.current();
      if (!user) throw new Error('Nobody is signed in on this terminal now. Sign in as an admin, then reinstate.');
      if (!(await FP.users.can('admin'))) throw new Error(`${user.name} is signed in on this terminal now, and only an admin can reinstate a retired definition. Sign in as an admin, then reinstate.`);
    }
    const cur = current.get(docKey(kind, id));
    if (!cur) throw new Error(`${nameOf(kind, id)} is not published.`);
    if (!cur.retired) throw new Error(`${nameOf(kind, id)} is not retired, so there is nothing to reinstate.`);
    const last = (await history(kind, id)).find(h => !h.retired && !h.trial && h.def);
    return publish(kind, id, (last || cur).def, Object.assign({ note: `Reinstated${last ? ` (version ${last.version})` : ''}`, basedOn: cur.version }, opts, { reinstate: true, retire: false }));
  }

  /* Display names: the same label or title as another definition of the kind, retired ones too (a warning, not a refusal). */
  function nameClash(kind, text) {
    const t = String(text == null ? '' : text).trim().toLowerCase();
    if (!t) return [];
    return Array.from(current.values()).filter(d => d.kind === kind && dname(kind, d).trim().toLowerCase() === t)
      .map(d => ({ kind, id: d.id, name: dname(kind, d), retired: !!d.retired }));
  }

  const live = kind => FP.defs.list(kind).filter(d => !d.retired);

  /* The final active form a retired one is replaced by (the chain followed, loop-safe), or null. */
  function supersededBy(formId) {
    const seen = new Set([formId]);
    let d = current.get(docKey('form', formId));
    while (d && d.retired && d.supersededBy) {
      if (seen.has(d.supersededBy)) return null;
      seen.add(d.supersededBy);
      d = current.get(docKey('form', d.supersededBy));
      if (d && !d.retired) return d.id;
    }
    return null;
  }

  /* A form's lineage, oldest first through newest: [{ id, title, retired, version, supersededBy }]. */
  function lineage(formId) {
    const start = current.get(docKey('form', formId));
    if (!start) return [];
    const forms = Array.from(current.values()).filter(d => d.kind === 'form');
    const row = d => ({ id: d.id, title: (d.def && d.def.title) || d.id, retired: !!d.retired, version: d.version, supersededBy: d.supersededBy || null });
    const seen = new Set([formId]);
    // Back: every form that was replaced by it, or by one that was (oldest retirement first).
    const before = [];
    for (let queue = [start]; queue.length;) {
      const cur = queue.shift();
      forms.filter(f => f.supersededBy === cur.id && !seen.has(f.id)).forEach(f => { seen.add(f.id); before.push(f); queue.push(f); });
    }
    before.sort((a, b) => String(a.publishedAt).localeCompare(String(b.publishedAt)));
    const chain = before.concat([start]);
    for (let cur = start; cur.supersededBy;) {   // forward: what replaced it
      const next = current.get(docKey('form', cur.supersededBy));
      if (!next || seen.has(next.id)) break;
      seen.add(next.id); chain.push(next); cur = next;
    }
    return chain.map(row);
  }

  /* Active definitions nothing active uses (candidates to retire). Async: terminals and groups are read from the data folder. */
  async function unused() {
    const out = [];
    const idx = usageIndex();
    const placed = new Set();
    let known = false;
    try {
      if (FP.groups) {
        for (const g of await FP.groups.list()) { (g.forms || []).forEach(f => placed.add(f)); if (g.homeForm) placed.add(g.homeForm); }
        for (const t of (await FP.groups.terminals()).values()) { (t.forms || []).forEach(f => placed.add(f)); if (t.homeForm) placed.add(t.homeForm); }
        known = true;
      }
    } catch (_) { known = false; }
    const none = (kind, id) => !dependentsOf(kind, id, idx, null, true).length;
    current.forEach(d => {
      if (d.retired || (BUILT_IN[d.kind] && BUILT_IN[d.kind].has(d.id))) return;
      const name = dname(d.kind, d);
      if (d.kind === 'form') {
        if (known && !placed.has(d.id) && none('form', d.id) && !(d.def && (d.def.launchable || d.def.home))) out.push({ kind: 'form', id: d.id, name, why: 'On no terminal or group, and no form opens it.' });
      } else if (d.kind === 'structure') {
        if (none('structure', d.id)) out.push({ kind: 'structure', id: d.id, name, why: 'No form saves to or reads it, and no function or lookup reads it.' });
      } else if (d.kind === 'function') {
        if (none('function', d.id)) out.push({ kind: 'function', id: d.id, name, why: `No form, function or structure uses this ${kindWord('function', d)}.` });
      }
    });
    return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  /* Duplicate as new form: the same definition under a new id. Structures and functions it uses are shared by default,
   * or copied under a new id ('copy'). { id, copied: [{ kind, id, from }] }. */
  const refTo = (v, from, to) => {
    if (typeof v !== 'string') return v;
    const m = /^([^.~]+)(~[^.]*)?(\..*)?$/.exec(v);
    return m && m[1] === from ? to + (m[2] || '') + (m[3] || '') : v;
  };
  function renameStructure(def, from, to) {
    const one = d => {
      if (!d || typeof d !== 'object') return d;
      const o = Object.assign({}, d);
      if (Array.isArray(o.sources)) o.sources = o.sources.map(x => (x && typeof x === 'object' && x.structure ? Object.assign({}, x, { structure: refTo(x.structure, from, to) }) : x));
      if (o.items && typeof o.items === 'object') o.items = Object.fromEntries(Object.entries(o.items).map(([k, v]) => [refTo(k, from, to), v]));
      if (o.lists && typeof o.lists === 'object') o.lists = Object.fromEntries(Object.entries(o.lists).map(([k, v]) => [k, v === from ? to : v]));
      if (Array.isArray(o.fields)) o.fields = o.fields.map(f => {
        if (!f || typeof f !== 'object') return f;
        const n = Object.assign({}, f);
        ['writes', 'snapshot'].forEach(k => { if (n[k] != null) n[k] = refTo(n[k], from, to); });
        if (n.structure === from) n.structure = to;
        if (n.pick === from) n.pick = to;
        return n;
      });
      if (Array.isArray(o.buttons)) o.buttons = o.buttons.map(b => (b && b.link === from ? Object.assign({}, b, { link: to }) : b));
      if (Array.isArray(o.due)) o.due = o.due.map(x => (x && x.forEach === from ? Object.assign({}, x, { forEach: to }) : x));
      if (Array.isArray(o.subforms)) o.subforms = o.subforms.map(one);
      return o;
    };
    return one(def);
  }
  function renameFunction(node, from, to) {
    const re = new RegExp('(^|[^A-Za-z0-9_.])' + from + '(?=\\()', 'gi');
    const walk = (v, key) => {
      if (typeof v === 'string') return key === 'fn' && v.toLowerCase() === from.toLowerCase() ? to : v.replace(re, (m, pre) => pre + to);
      if (Array.isArray(v)) return v.map(x => walk(x));
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x, k)]));
      return v;
    };
    return walk(node);
  }

  async function duplicateForm(id, newId, opts) {
    opts = opts || {};
    const src = current.get(docKey('form', id));
    if (!src) throw new Error(`Form ${id} is not published, so it can't be duplicated.`);
    if (!idOk('form', newId)) throw new Error('A name uses lowercase letters, digits and -, starts with a letter, and is at most 40 long.');
    const taken = async (kind, name) => current.has(docKey(kind, name)) || (await FP.files.listDirs(ROOT.concat(kind))).some(n => n.toLowerCase() === name.toLowerCase()) || !!(BUILT_IN[kind] && BUILT_IN[kind].has(name));
    if (await taken('form', newId)) throw new Error(`Form ${newId} already exists${current.get(docKey('form', newId)) && current.get(docKey('form', newId)).retired ? ' (retired: an id is never reused)' : ''}. Choose another id.`);
    if (FP.users) {
      const user = await FP.users.current();
      if (!user) throw new Error('Nobody is signed in on this terminal now. Sign in as a publisher, then duplicate.');
      if (!(await FP.users.can(publishRole()))) throw new Error(`${user.name} is signed in on this terminal now, and only a ${publishRole()} can publish definitions. Sign in as a ${publishRole()}, then duplicate.`);
    }
    const used = usesOf('form', src.def);
    const want = [];
    for (const [kind, map] of [['structure', opts.structures], ['function', opts.functions]]) {
      Object.entries(map || {}).forEach(([k, how]) => {
        if (how !== 'share' && how !== 'copy') throw new Error(`${nameOf(kind, k)}: say share or copy.`);
        if (how === 'share') return;
        const t = findIn(current)(kind, k);
        if (!t || !used.some(u => u.kind === kind && String(u.id).split('~')[0].toLowerCase() === t.id.toLowerCase())) throw new Error(`Form ${id} doesn't use ${nameOf(kind, k)}, so there is nothing to copy.`);
        if (t.retired) throw new Error(`${nameOf(kind, t.id)} is retired, so it can't be copied.`);
        if (BUILT_IN[kind] && BUILT_IN[kind].has(t.id)) throw new Error(`${nameOf(kind, t.id)} is built into the kernel and can't be copied.`);
        if (!want.some(w => w.kind === kind && w.from === t.id)) want.push({ kind, from: t.id, doc: t });
      });
    }
    const made = new Set();
    for (const w of want) {
      const sep = w.kind === 'function' ? '_' : '-';
      let n = 1, cand;
      do { const tail = sep + 'copy' + (n > 1 ? sep + n : ''); cand = w.from.slice(0, 40 - tail.length) + tail; n++; } while (made.has(cand.toLowerCase()) || await taken(w.kind, cand));
      made.add(cand.toLowerCase());
      w.to = cand;
    }
    let def = JSON.parse(JSON.stringify(src.def));
    def.title = opts.title != null ? String(opts.title) : `${src.def.title || id} (copy)`;
    delete def.home;
    // Publish the copies (one that needs another copy waits for it), then the form pointing at them.
    const published = [];
    const undo = async () => { for (const p of published.reverse()) { try { await publish(p.kind, p.id, null, { retire: true, force: true, basedOn: current.get(docKey(p.kind, p.id)).version, note: 'Put away: the copy of a form failed' }); } catch (_) { /* best effort */ } } };
    try {
      let pending = want.slice();
      let progress = true;
      const errs = new Map();
      while (pending.length && progress) {
        progress = false;
        for (const w of pending.slice()) {
          let d = JSON.parse(JSON.stringify(w.doc.def));
          d.label = `${w.doc.def.label || w.from} (copy)`;
          want.filter(o => o.kind === 'structure').forEach(o => { d = renameStructure(d, o.from, o.to); });
          if (d.reads && d.reads.structure) d.reads = Object.assign({}, d.reads, { structure: want.reduce((st, o) => (o.kind === 'structure' && st === o.from ? o.to : st), d.reads.structure) });
          want.filter(o => o.kind === 'function').forEach(o => { d = renameFunction(d, o.from, o.to); });
          try { await publish(w.kind, w.to, d, { note: `Copy of ${w.kind} ${w.from}` }); published.push({ kind: w.kind, id: w.to }); pending = pending.filter(x => x !== w); progress = true; }
          catch (e) { errs.set(w, e.message); }
        }
      }
      if (pending.length) throw new Error(`Could not copy ${pending.map(w => nameOf(w.kind, w.from)).join(', ')}: ${errs.get(pending[0])}`);
      want.filter(o => o.kind === 'structure').forEach(o => { def = renameStructure(def, o.from, o.to); });
      want.filter(o => o.kind === 'function').forEach(o => { def = renameFunction(def, o.from, o.to); });
      await publish('form', newId, def, { note: `Copy of form ${id}` });
    } catch (e) {
      await undo();
      throw e;
    }
    return { id: newId, copied: want.map(w => ({ kind: w.kind, id: w.to, from: w.from })) };
  }

  FP.defs = {
    KINDS, LABELS,
    drafts,
    publishRole: 'publisher',
    slowMs: 1500,
    slowEntries: 60000,
    perf: id => perfOf(id, stats),
    load,
    watch,
    publish,
    /* Retire: a new version that stops it loading; the history stays. Refused while other definitions use it unless force. */
    retire: (kind, id, opts) => { const c = current.get(docKey(kind, id)); return publish(kind, id, null, Object.assign({}, opts, { retire: true, basedOn: opts && opts.basedOn != null ? opts.basedOn : (c ? c.version : null) })); },
    retireReport, reinstate, nameClash, live, supersededBy, lineage, unused, duplicateForm,
    /* Bring back an older version by publishing a copy of it as the newest. */
    async restore(kind, id, version, opts) {
      const old = (await history(kind, id)).find(d => d.version === version);
      if (!old) throw new Error(`${nameOf(kind, id)} has no version ${version}.`);
      const cur = current.get(docKey(kind, id));
      return publish(kind, id, old.def, Object.assign({ note: `Restored version ${version}`, basedOn: cur ? cur.version : null }, opts));
    },
    history,
    /* One version of a definition (a trial included), or null. */
    version: (kind, id, v) => readVersion(kind, id, Number(v), null),
    /* Make a trial version the current one: publishes a copy of it as the newest. */
    async promote(kind, id, version, opts) {
      const old = await readVersion(kind, id, Number(version), null);
      if (!old) throw new Error(`${nameOf(kind, id)} has no version ${version}.`);
      const cur = current.get(docKey(kind, id));
      return publish(kind, id, old.def, Object.assign({ note: `Promoted trial version ${version}`, basedOn: cur ? cur.version : null }, opts));
    },
    dependents,
    get: (kind, id) => current.get(docKey(kind, id)) || null,
    list: kind => Array.from(current.values()).filter(d => !kind || d.kind === kind)
      .map(d => Object.assign({ loaded: !d.retired && applied.get(d.kind).has(d.id), gone: d.kind === 'session-type', here: coversSite(d.def, here()), sites: sitesOf(d.def) }, d, d.kind === 'structure' ? { perf: perfOf(d.id, stats) } : {}))
      .sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)),
    isBuiltIn: (kind, id) => !!(BUILT_IN[kind] && BUILT_IN[kind].has(id)),
    /* Is this definition used at a site (this terminal's by default)? Built-ins and kernel-only ones are used everywhere. */
    usedHere(kind, id, site) {
      if (BUILT_IN[kind] && BUILT_IN[kind].has(id)) return true;
      const d = current.get(docKey(kind, id));
      if (!d || d.retired) return true;
      return coversSite(d.def, site || here());
    },
    sitesOf: def => sitesOf(def).slice(),
    /* How each published form gives a structure's items their IDs. */
    idModes, saveNames,
    check,
    usesOf,
    report: () => lastReport,
  };

  // Retired functions stay defined (forms using them keep evaluating) but are not in the library's list: pickers and the help skip them.
  if (!FP.fn.listAll) { const all = FP.fn.list; FP.fn.listAll = all; FP.fn.list = () => all().filter(f => !f.retired); }

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-defs'] = '0.69.0';
})();
