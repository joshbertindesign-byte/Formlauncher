/* Form Platform kernel: kinds of structures (0.59)
 * Load after fp-current.js.
 *
 * Every structure people publish is one kind, and the kind brings what that kind of data always needs, so it is
 * never set up by hand:
 *
 *   list       reference items that change rarely (profiles, lines, customers): IDs typed in; Active or Retired
 *   orders     planned work with a target (needs): Open until done or cancelled
 *   runs       something that starts and ends (runs, shifts): Running until it ends
 *   inventory  things with identity, a quantity and a place (racks, lots): In stock, On hold, Gone
 *   cases      something that needs handling (downtime, NCRs): Open, Acknowledged, Closed
 *   records    one-off data points (checks, logs): a new item each save
 *
 * A kind names roles, and the structure says which of its values plays each one:
 *   { kind: 'runs', roles: { ended: 'endAt' } }
 * so the pilot's runs keep their own names. From the kind and its roles come the status (the kind's own first,
 * then any the structure adds while the item is open, then the kind's default), the open rule, and what the ID is.
 * FP.kinds.expand(def) gives the definition the rest of the kernel works with; FP.kinds.check(def) what is wrong.
 *
 * 0.60: what targets a kind (open items, picking from a structure, filling in from an item, the kind's questions,
 * what a terminal is for and HERE), below.
 *
 * Structures published before 0.59 have no kind: they still load and work as they were, but are published again
 * only once a kind is picked. The kernel's own structures (users, sites, approvals…) have none.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.structures) throw new Error('Load fp-current.js before fp-kinds.js');

  /* Each role: what it means, whether it is needed, and what kind of value it should be. */
  const KINDS = {
    list: {
      label: 'List', plural: 'Lists', help: 'Reference items that change rarely: profiles, parts, customers, lines. Their IDs are typed in, and pickers offer the ones still in use.',
      example: 'Profiles', id: 'entered', statusFixed: true,
      roles: [{ name: 'active', label: 'Still in use', help: 'yes or no; no retires the item (it stays, but pickers leave it out)', type: 'yes/no', ask: { control: 'toggle', label: 'Still in use', yes: 'Active', no: 'Retired', default: true } }],
      status: r => (r.active ? [{ value: 'Retired', when: `${r.active} = FALSE` }] : []), last: 'Active', open: null,
    },
    orders: {
      label: 'Orders', help: 'Planned work with a target: needs, work orders. Open until what was wanted is done, or it is cancelled.',
      example: 'Needs',
      roles: [
        { name: 'wanted', label: 'How many are wanted', required: true, type: 'number', ask: { control: 'number', label: 'How many are wanted', limits: { min: 1 } } },
        { name: 'done', label: 'How many are done', required: true, type: 'number', rules: ['sum', 'count'], help: 'a value forms add to (adds them up, or counts them)', ask: { control: 'number', label: 'How many this makes', default: 1, limits: { min: 0 } } },
        { name: 'cancelled', label: 'Cancelled', type: 'yes/no', ask: { control: 'toggle', label: 'Cancel it', yes: 'Cancel it', no: 'Keep it' } },
        { name: 'due', label: 'Due', type: 'date', ask: { control: 'date', label: 'Due' } },
      ],
      status: r => [].concat(r.cancelled ? [{ value: 'Cancelled', when: `${r.cancelled} = TRUE` }] : [], [{ value: 'Done', when: `COALESCE(${r.done}, 0) >= ${r.wanted}` }]),
      last: 'Open', open: () => 'AND(status <> "Done", status <> "Cancelled")',
    },
    runs: {
      label: 'Runs', help: 'Something that starts and ends: production runs, shifts, jobs. Running until it ends; "the open run" finds the one on now.',
      example: 'Runs',
      roles: [
        { name: 'ended', label: 'When it ended', required: true, type: 'date', help: 'blank while it is running', ask: { control: 'datetime', label: 'Ended', now: true } },
        { name: 'started', label: 'When it started', type: 'date', help: 'leave out to use when it was first saved', ask: { control: 'datetime', label: 'Started', now: true } },
      ],
      status: r => [{ value: 'Ended', when: `NOT(ISBLANK(${r.ended}))` }], last: 'Running', open: () => 'status <> "Ended"',
    },
    inventory: {
      label: 'Inventory', help: 'Things with identity, a quantity and a place: racks, lots, partial racks. In stock until gone; can be put on hold.',
      example: 'Racks',
      roles: [
        { name: 'quantity', label: 'How many', type: 'number', ask: { control: 'number', label: 'How many', limits: { min: 0 } } },
        { name: 'place', label: 'Where it is', type: 'text', ask: { control: 'text', label: 'Where it is' } },
        { name: 'madeFrom', label: 'What it was made from', type: 'text', help: 'the run or lot it came from, for tracing', ask: { control: 'text', label: 'Made from' } },
        { name: 'hold', label: 'On hold', type: 'yes/no', ask: { control: 'toggle', label: 'On hold', yes: 'On hold', no: 'Free to use' } },
        { name: 'gone', label: 'When it was shipped or used', type: 'date', help: 'blank while it is still here; leave out if it never goes', ask: { control: 'datetime', label: 'Shipped or used', now: true } },
      ],
      status: r => [].concat(r.gone ? [{ value: 'Gone', when: `NOT(ISBLANK(${r.gone}))` }] : [], r.hold ? [{ value: 'On hold', when: `${r.hold} = TRUE` }] : []),
      last: 'In stock', open: r => (r.gone ? 'status <> "Gone"' : null),
    },
    cases: {
      label: 'Cases', help: 'Something that happened and needs handling: downtime, nonconformances, complaints, maintenance requests. Open until closed.',
      example: 'Downtime',
      roles: [
        { name: 'closed', label: 'When it was closed', required: true, type: 'date', ask: { control: 'datetime', label: 'Closed', now: true } },
        { name: 'acknowledged', label: 'When it was acknowledged', type: 'date', ask: { control: 'datetime', label: 'Acknowledged', now: true } },
        { name: 'owner', label: 'Who handles it', type: 'text', ask: { control: 'person', label: 'Who handles it' } },
        { name: 'due', label: 'Due', type: 'date', ask: { control: 'date', label: 'Due' } },
      ],
      status: r => [].concat([{ value: 'Closed', when: `NOT(ISBLANK(${r.closed}))` }], r.acknowledged ? [{ value: 'Acknowledged', when: `NOT(ISBLANK(${r.acknowledged}))` }] : []),
      last: 'Open', open: () => 'status <> "Closed"',
    },
    records: {
      label: 'Records', help: 'One-off data points: checks, readings, logs. Each save is a new item; they never open or close.',
      example: 'OD checks', id: 'new', statusFree: true,
      roles: [],
      status: () => [], last: null, open: null,
    },
  };
  const NAMES = Object.keys(KINDS);

  const rolesOf = def => (def && def.roles && typeof def.roles === 'object' && !Array.isArray(def.roles) ? def.roles : {});
  const isCatchAll = r => r && String(r.when || '').trim().toUpperCase() === 'TRUE';
  /* The status words a kind gives itself. */
  const builtWords = (k, roles) => (KINDS[k] ? KINDS[k].status(roles).map(r => r.value).concat(KINDS[k].last ? [KINDS[k].last] : []) : []);

  /* The definition the kernel works with: the kind's status, open rule and ID rule, from its roles. */
  function expand(def) {
    if (!def || !def.kind || !KINDS[def.kind] || def.kindExpanded) return def;
    const K = KINDS[def.kind];
    const roles = rolesOf(def);
    const d = Object.assign({}, def, { kindExpanded: true, extraStatus: Array.isArray(def.status) ? def.status : [] });
    if (K.statusFree) d.status = d.extraStatus.slice();
    else d.status = K.status(roles).concat(d.extraStatus.filter(r => r && !isCatchAll(r)), K.last ? [{ value: K.last, when: 'TRUE' }] : []);
    const open = K.open ? K.open(roles) : null;
    if (open) d.open = open; else delete d.open;
    if (K.id) d.itemId = Object.assign({}, def.itemId || {}, { made: K.id });
    return d;
  }

  /* What is wrong with a structure's kind and roles: [problem]. A structure with no kind can't be published. */
  function check(def) {
    const p = [];
    if (!def || !def.kind) { p.push(`Pick what kind of structure this is: ${NAMES.map(k => KINDS[k].label).join(', ')}`); return p; }
    const K = KINDS[def.kind];
    if (!K) { p.push(`kind must be one of ${NAMES.join(', ')}`); return p; }
    const many = K.plural || K.label;
    const roles = rolesOf(def);
    if (def.roles != null && (typeof def.roles !== 'object' || Array.isArray(def.roles))) p.push('roles is { role: the value that plays it }');
    const known = new Set(K.roles.map(r => r.name));
    Object.keys(roles).filter(n => !known.has(n)).forEach(n => p.push(`${many} have no role ${n}`));
    const containers = def.containers || {};
    K.roles.forEach(r => {
      const v = roles[r.name];
      if (!v) { if (r.required) p.push(`Say which value is ${r.label.toLowerCase()} (a ${K.label.replace(/s$/, '').toLowerCase()} needs it)`); return; }
      if (!Object.prototype.hasOwnProperty.call(containers, v)) { p.push(`${r.label}: ${v} is not a value of this structure`); return; }
      if (r.rules && !r.rules.includes((containers[v] || {}).rule)) p.push(`${r.label}: ${v} must add up or count what forms save (its rule is ${(containers[v] || {}).rule || 'latest'})`);
    });
    if (def.open != null) p.push(`${many} ${K.open ? 'are open by their kind' : 'never open or close'}: take the open rule out`);
    if (K.id && def.itemId && def.itemId.made && def.itemId.made !== K.id) p.push(K.id === 'new' ? 'Records make a new ID each save' : 'A list\'s IDs are typed in (entered)');
    if (!K.statusFree) {
      const words = builtWords(def.kind, roles);
      (Array.isArray(def.status) ? def.status : []).forEach((r, i) => {
        if (!r) return;
        if (isCatchAll(r)) p.push(`Status rule ${i + 1}: the last status is the kind's own (${K.last}); a rule that is always true isn't needed`);
        if (words.includes(r.value)) p.push(`Status ${r.value} is one ${many} give themselves; call it something else`);
      });
      if (K.statusFixed && (def.status || []).length) p.push(`${many} have their own status (${words.join(' or ')}); take the status rules out`);
    }
    return p;
  }


  /* ---------- Targeting by kind (0.60) ----------
   * Open: an item of a kind that opens and closes until it closes (a run until it ends, an order until it is done or
   * cancelled, a case until it is closed, inventory until it is gone); a list's items while they are in use; records
   * and inventory that never goes are always open. */
  const defOf = id => (FP.structures.has(id) ? FP.structures.get(id) : null);
  function isOpen(structure, it) {
    const d = defOf(structure);
    if (!d || !it) return true;
    if (d.kind === 'list') return it.status !== 'Retired';
    if (d.open) return !!it.open;
    return true;
  }
  /* Kinds whose items open and close: what due item by item and "the open one" go through. */
  const opensAndCloses = id => { const d = defOf(id); return !!(d && d.kind && d.open); };

  /* A literal for a formula: a starting value written as a fallback (a quote is doubled, as the formula text reads it). */
  const lit = v => (typeof v === 'number' ? String(v) : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE')
    : Array.isArray(v) ? `LIST(${v.map(lit).join(', ')})` : `"${String(v).replace(/"/g, '""')}"`);
  const isEntry = c => { const d = FP.forms && FP.forms.describe ? FP.forms.describe(c) : null; return !!(d && d.category === 'entry'); };
  const hasWork = d => d && ((d.fields || []).some(f => f && f.pick) || (Array.isArray(d.sources) ? d.sources : []).some(s => s && s.kind === 'item' && s.fill));
  /* A form's fields and sources as the runtime works with them:
   *   a choice or chips with pick: 'lines' offers the structure's open items (a list's in use, by ID; others newest
   *     first), narrowed by pickWhere (a rule over the item, form.name for the form's fields);
   *   an item source with fill: true starts each field saving to it at the item's value (the starting value given
   *     on the field when the item has none), and follows the item until someone changes the field. */
  function one(d) {
    const fields = Array.isArray(d.fields) ? d.fields : [];
    if (fields.some(f => f && f.pick) && !Array.isArray(d.sources)) d.sources = [];
    fields.forEach(f => {
      if (!f || !f.pick) return;
      const st = f.pick, where = f.pickWhere;
      delete f.pick; delete f.pickWhere;
      if (f.optionsFrom || (Array.isArray(f.options) && f.options.length)) return;   // checkForm says so
      const name = `pick_${f.name}`;
      d.sources.push(Object.assign({ name, kind: 'items', structure: st, open: true }, where ? { filter: where } : {}));
      const sd = defOf(st);
      f.optionsFrom = sd && sd.kind === 'list' ? `SORT(${name}, item.$id)` : name;
    });
    const fills = new Set((Array.isArray(d.sources) ? d.sources : []).filter(s => s && s.kind === 'item' && s.fill).map(s => s.name));
    if (fills.size) fields.forEach(f => {
      if (!f || f.defaultFrom || typeof f.writes !== 'string' || !isEntry(f.control)) return;
      const i = f.writes.indexOf('.');
      if (i < 1 || !fills.has(f.writes.slice(0, i))) return;
      f.defaultFrom = f.default === undefined || f.default === null ? f.writes : `COALESCE(${f.writes}, ${lit(f.default)})`;
      delete f.default;
    });
  }
  function form(def) {
    if (!def || typeof def !== 'object') return def;
    const subs = Array.isArray(def.subforms) ? def.subforms : [];
    if (!hasWork(def) && !subs.some(hasWork)) return def;
    const d = JSON.parse(JSON.stringify(def));
    one(d);
    (d.subforms || []).forEach(sf => { if (sf && typeof sf === 'object') one(sf); });
    return d;
  }
  /* What is wrong with a form's picks and "open" settings, before they are worked out. */
  function checkForm(def) {
    const p = [];
    const label = st => { const d = defOf(st); return (d && d.label) || st; };
    const part = (d, where) => {
      (Array.isArray(d.fields) ? d.fields : []).forEach(f => {
        if (!f || (f.pick == null && f.pickWhere == null)) return;
        const w = `${where}${f.label || f.name}`;
        if (f.pick == null) { p.push(`${w}: Only those where goes with Pick from`); return; }
        if (!['choice', 'chips'].includes(f.control)) p.push(`${w}: only a choice or chips picks from a structure`);
        if (typeof f.pick !== 'string' || !defOf(f.pick)) p.push(`${w}: picks from ${f.pick}, which isn't a published structure`);
        else if (!defOf(f.pick).kind) p.push(`${w}: ${label(f.pick)} has no kind yet; give it one to pick from it`);
        if (f.optionsFrom || (Array.isArray(f.options) && f.options.length)) p.push(`${w}: it picks from ${f.pick}, so take its options (or options from a formula) out`);
        if (f.pickWhere != null && (typeof f.pickWhere !== 'string' || !f.pickWhere.trim())) p.push(`${w}: Only those where is a rule over the item`);
      });
      (Array.isArray(d.sources) ? d.sources : []).forEach(s => {
        if (!s || !s.structure) return;
        const w = `Source ${s.name || '?'}`;
        const sd = defOf(s.structure);
        const usesOpen = (s.kind === 'items' && s.open) || (s.kind === 'item' && s.id && s.id.open != null);
        if (usesOpen && sd && sd.kind === 'records') p.push(`${w}: ${label(s.structure)} are records, which never open or close; take Only open ones out`);
        if (usesOpen && sd && !sd.kind && !sd.open) p.push(`${w}: ${label(s.structure)} has no kind, so nothing says which are open; give it one`);
        if (s.fill != null && (s.kind !== 'item' || typeof s.fill !== 'boolean')) p.push(`${w}: Fill in the form from it goes with one item, yes or no`);
      });
    };
    part(def, '');
    (Array.isArray(def.subforms) ? def.subforms : []).forEach(sf => sf && part(sf, `${sf.label || sf.name}: `));
    return p;
  }
  /* The questions a kind brings, for the form editor: one per role the structure plays, saving to its value.
   * [{ role, value, field: { control, label, … } }] */
  function questions(structure) {
    const d = defOf(structure);
    const K = d && d.kind ? KINDS[d.kind] : null;
    if (!K) return [];
    const roles = rolesOf(d);
    return K.roles.filter(r => r.ask && roles[r.name]).map(r => {
      const a = r.ask;
      const field = { control: a.control, label: a.label };
      ['yes', 'no', 'limits'].forEach(k => { if (a[k] != null) field[k] = JSON.parse(JSON.stringify(a[k])); });
      if (a.now) field.defaultFrom = 'NOW()';
      else if (a.default !== undefined) field.default = a.default;
      return { role: r.name, roleLabel: r.label, value: roles[r.name], field };
    });
  }

  /* ---------- What a terminal is for, and HERE (0.60) ----------
   * A terminal group, or a terminal on its own, says which items of a list it is for: { list: 'lines', items: [...] }.
   * HERE() in a formula is the one it is working on now (the only one, or the one picked on the launcher when it is
   * for several); HERE("all") every one it is for. Blank in the editor and on terminals that say nothing. */
  const here = { list: null, items: [], current: null };
  function setHere(forSetting, pickedNow) {
    const f = forSetting && typeof forSetting === 'object' ? forSetting : null;
    here.list = f && f.list ? f.list : null;
    here.items = f && Array.isArray(f.items) ? f.items.filter(x => typeof x === 'string' && x) : [];
    const before = here.current;
    here.current = here.items.length === 1 ? here.items[0] : here.items.includes(pickedNow) ? pickedNow : null;
    if (before !== here.current) { try { window.dispatchEvent(new CustomEvent('fp-here', { detail: Object.assign({}, here) })); } catch (_) { /* no events */ } }
    return Object.assign({}, here);
  }
  function checkFor(f) {
    if (f == null) return [];
    const p = [];
    if (typeof f !== 'object' || Array.isArray(f)) return ['What it is for is { list, items }'];
    const d = defOf(f.list);
    if (!d) p.push(`It is for items of ${f.list}, which isn't a published structure`);
    else if (d.kind !== 'list') p.push(`It is for items of ${d.label || f.list}, which isn't a list`);
    if (!Array.isArray(f.items) || !f.items.length || f.items.some(x => typeof x !== 'string' || !x.trim())) p.push('Say which of its items it is for');
    return p;
  }

  FP.kinds = {
    NAMES,
    get: k => KINDS[k] || null,
    list: () => NAMES.map(k => Object.assign({ name: k }, KINDS[k])),
    expand,
    check,
    builtWords,
    /* The kind's status rules as they apply, for the editor: [{ value, when, built }]. */
    statusRules(def) { const d = expand(def); return (d.status || []).map(r => Object.assign({ built: !!def.kind && !KINDS[def.kind].statusFree && !(def.status || []).includes(r) }, r)); },
    /* Structures of these kinds: for pickers (list, inventory), "the open one" (runs, orders, cases, inventory). */
    of: kinds => FP.structures.list().filter(s => s.kind && kinds.includes(s.kind)).map(s => s.id),
    isOpen, opensAndCloses, form, checkForm, questions, checkFor,
    /* Lists (kind list), for pickers of what a terminal is for. */
    lists: () => FP.structures.list().filter(s => s.kind === 'list').map(s => s.id),
    here: () => Object.assign({}, here, { items: here.items.slice() }),
    setHere,
  };

  (window.FP.modules = window.FP.modules || {})['fp-kinds'] = '0.63.0';
})();
