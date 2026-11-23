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
        [f.formula, f.when, f.optionsFrom].forEach(x => x && calls(x));
        if (FP.forms && FP.forms.formulasOf) FP.forms.formulasOf({ fields: [f] }).forEach(calls); // any other formula setting
      });
      (def.buttons || []).forEach(b => {
        if (!b) return;
        if (b.action === 'open') add('form', b.form);
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

    // Functions: keep trying until nothing more loads (a function needs the ones it calls).
    let pending = live('function');
    const lastError = new Map();
    let progress = true;
    while (pending.length && progress) {
      progress = false;
      pending = pending.filter(doc => {
        try { FP.fn.define(Object.assign({}, doc.def, { name: doc.id, version: doc.version })); next.get('function').add(doc.id); progress = true; return false; }
        catch (e) { lastError.set(doc.id, e.problems || [e.message]); return true; }
      });
    }
    pending.forEach(doc => fail(doc, lastError.get(doc.id)));

    // Structures (sessions an older one still names are ignored: nothing records them now).
    live('structure').forEach(doc => {
      const p = checkStructure(doc.id, doc.def);
      if (p.length) { fail(doc, p); return; }
      // A kind (0.59) brings its status, open rule and ID rule; a structure from before kinds loads as it was.
      FP.structures.define(Object.assign({}, FP.kinds ? FP.kinds.expand(doc.def) : doc.def, { id: doc.id, version: doc.version }));
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
        const prev = by[s];
        if (!prev || x.loadMs > prev.loadMs) by[s] = Object.assign({ terminal: st.terminalId }, x);
      }
    }
    return by;
  }

  function perfOf(id, stats) {
    const x = stats[id];
    if (!x) return { status: 'unknown', message: 'No load times reported yet.' };
    const slow = x.loadMs > FP.defs.slowMs || x.entries > FP.defs.slowEntries;
    const def = FP.structures.get(id);
    const took = x.loadMs >= 1000 ? `${(x.loadMs / 1000).toFixed(1)} s` : `${x.loadMs} ms`;
    const what = `loading takes ${took} on ${x.terminal} (${x.items.toLocaleString()} items from ${x.entries.toLocaleString()} entries)`;
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
    KINDS.forEach(k => { counts[k] = applied.get(k).size; });
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
  function dependents(kind, id) {
    const out = [];
    if (kind === 'function') {
      FP.fn.list().forEach(f => { if (f.formula && FP.fn.syntax(f.formula).calls.some(c => c.toLowerCase() === id.toLowerCase())) out.push(`function ${f.name}`); });
      FP.structures.list().forEach(s => {
        if (Object.values(s.calculated || {}).some(c => c.fn === id)) out.push(`structure ${s.id}`);
        else if ((s.status || []).some(r => FP.fn.syntax(String(r.when || '')).calls.some(c => c.toLowerCase() === id.toLowerCase()))) out.push(`structure ${s.id}`);
      });
    }
    if (kind === 'form') {
      current.forEach(d => { if (d.kind === 'form' && !d.retired && d.id !== id && usesOf('form', d.def).some(u => u.kind === 'form' && u.id === id)) out.push(`form ${d.id}`); });
    }
    // Forms that use a structure or function, and lookups that read a structure (0.53: these were retired from under them).
    if (kind === 'structure' || kind === 'function') {
      current.forEach(d => {
        if (d.kind !== 'form' || d.retired) return;
        if (usesOf('form', d.def).some(u => u.kind === kind && String(u.id).split('~')[0].toLowerCase() === id.toLowerCase())) out.push(`form ${d.id}`);
      });
    }
    if (kind === 'structure') FP.fn.list().forEach(f => { if (f.reads && f.reads.structure === id) out.push(`function ${f.name}`); });
    return Array.from(new Set(out));
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
      if (def && def.reads && def.reads.structure && !FP.structures.has(def.reads.structure)) p.push(`It reads structure ${def.reads.structure}, which isn't published`);
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
        else if (!FP.structures.has(t.structure)) p.push(`${t.field} saves to ${t.structure}, which isn't a published structure`);
        // A value is a container, or one a container is taken from (surfaceFails from surfaceBad).
        else if (s && !s.retired && !Object.prototype.hasOwnProperty.call(s.def.containers || {}, t.container) && !Object.values(s.def.containers || {}).some(c => c && c.from === t.container)) p.push(`${t.field} saves to ${t.container}, which ${t.structure} doesn't have: add it to the structure first`);
      });
      if (kind === 'form') (Array.isArray(def.sources) ? def.sources : []).forEach(x => {
        if (x && (x.kind === 'item' || x.kind === 'items') && x.structure && !FP.structures.has(String(x.structure).split('~')[0])) p.push(`Source ${x.name || '?'} reads ${x.structure}, which isn't a published structure`);
      });
    }
    return p;
  }

  /* A form's open buttons: the forms must exist, and no form may open itself through others. */
  function formLinks(id, def) {
    const p = [];
    const opens = d => ((d && d.buttons) || []).filter(b => b && b.action === 'open' && b.form).map(b => b.form);
    opens(def).forEach(f => { if (f !== id && !(current.get(docKey('form', f)) && !current.get(docKey('form', f)).retired)) p.push(`a button opens form ${f}, which is not published`); });
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
    const known = FP.sites ? new Set((await FP.sites.list()).map(s => s.id)) : null;
    const p = checkSites(def, known).concat(trial(kind, id, def));
    // Its sites must be covered by what it uses, and must still cover what uses it.
    const find = (k, i) => current.get(docKey(k, i)) || Array.from(current.values()).find(d => d.kind === k && d.id.toLowerCase() === i.toLowerCase()) || null;
    p.push(...siteGaps(kind, def, find));
    if (kind === 'form') p.push(...formLinks(id, def));
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
    if (twin) throw new Error(`${nameOf(kind, twin)} already exists; names can't differ only by capital letters.`);

    const problems = [];
    const existing = await readCurrent(kind, id, problems);
    const top = existing ? existing.version : 0;
    // Version numbers count trials too, so a trial and the next real version never share a number.
    const highest = Math.max(top, ...(await readFolder(kind, id)).files.map(f => f.version));
    if (opts.trial && kind !== 'form') throw new Error('Only forms can be published as a trial.');
    const basedOn = opts.basedOn == null ? null : opts.basedOn;
    if (!opts.force) {
      if (existing && basedOn == null) throw new Error(`${nameOf(kind, id)} already exists (version ${top}). Open it and publish your change from there.`);
      if (existing && basedOn !== top) {
        const who = existing.publishedBy ? existing.publishedBy.name : existing.terminalId;
        throw new Error(`${nameOf(kind, id)} changed since you opened it: version ${top} by ${who} at ${new Date(existing.publishedAt).toLocaleString()}. Reload it and make your change again.`);
      }
    }

    if (opts.retire) {
      if (!existing || existing.retired) throw new Error(`${nameOf(kind, id)} is not published, so there is nothing to retire.`);
      const deps = dependents(kind, id);
      if (deps.length && !opts.force) throw new Error(`${nameOf(kind, id)} is still used by ${deps.join(', ')}.`);
    } else {
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
      def: opts.retire && existing ? existing.def : def,
    };
    await FP.files.writeJson(ROOT.concat(kind, id), fileName(doc.version, doc.terminalId), doc);
    await FP.files.writeJson(CHANGES, `${doc.terminalId}.json`, { at: doc.publishedAt, kind, id, version: doc.version });
    const report = await load(doc);
    if (channel) channel.postMessage({ kind, id, version: doc.version });
    return { doc, report };
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
    retire: (kind, id, opts) => publish(kind, id, null, Object.assign({}, opts, { retire: true, basedOn: opts && opts.basedOn })),
    /* Bring back an older version by publishing a copy of it as the newest. */
    async restore(kind, id, version, opts) {
      const old = (await history(kind, id)).find(d => d.version === version);
      if (!old) throw new Error(`${nameOf(kind, id)} has no version ${version}.`);
      return publish(kind, id, old.def, Object.assign({ note: `Restored version ${version}` }, opts));
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
      .map(d => Object.assign({ loaded: applied.get(d.kind).has(d.id), gone: d.kind === 'session-type', here: coversSite(d.def, here()), sites: sitesOf(d.def) }, d, d.kind === 'structure' ? { perf: perfOf(d.id, stats) } : {}))
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

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-defs'] = '0.60.0';
})();
