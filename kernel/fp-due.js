/* Form Platform: due schedules (0.54)
 * Load after fp-defs.js, before fp-launcher.js.
 *
 * A form can say when it is due: def.due, a list of schedules. Nothing here knows what the form is for.
 *   {
 *     name: 'hourly',                  a word, unique on the form
 *     every: 60,                       minutes (5 to 10,080): one is due in each period, counted from midnight;
 *                                      with forEach, counted from the item's first save
 *     at: ['06:00', '14:00'],          or set times of day; each is due between its time and window minutes after
 *     days: ['mon', 'tue', …],         with at: the days (all when left out)
 *     window: 60,                      with at: minutes to do it in (default 60)
 *     forEach: 'runs',                 optional: one series for each item of this structure, from its first save
 *                                      while the While formula is true of it; done by a save of the form on the item
 *     while: 'status <> "Ended"',      with forEach: a formula over the item (its values, status, firstAt, lastAt,
 *                                      lastAction, entryCount); left out, the structure's own Still open rule.
 *                                      (forEachOpen, 0.54, is read as forEach with no While.)
 *     per: 'group',                    without forEach: once per terminal group (a terminal in none: itself),
 *                                      'terminal' or 'site'
 *     grace: 15,                       minutes it can still be done, late, after its period ends
 *     owner: { signedIn: true }        responsible: whoever is signed in where it is due, when it is missed
 *         or { role, department },     or everyone with at least that role and/or in that department
 *     critical: true,                  emailed when late, and a failure email to a second list when missed
 *     notify: { missed: {…}, failure: {…} }   who hears: { roles: [], departments: [], people: [user IDs] }
 *   }
 *
 * A period (a slot) is upcoming, due, late (in its grace), missed, done, done late, or excused. Every launcher
 * terminal watches the schedules of its own forms once a minute: a slot that passes its grace undone is recorded
 * as missed in the built-in structure dues (one item per slot, so two terminals noticing it make one record).
 * A supervisor can excuse a miss with a reason. Emails (missed, critical, failure) are written as automation jobs
 * once the Send flow is set up (0.55); until then misses show on the launcher and in Admin › Due. */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.defs || !FP.current || !FP.entry || !FP.users) throw new Error('Load fp-defs.js before fp-due.js');

  const STRUCTURE = 'dues';
  // One item per slot that was missed: its missed entry, and an excuse if one is given. Two weeks stay in view.
  FP.structures.define({ id: STRUCTURE, version: 1, containers: {}, live: { days: 14 } });

  const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const NAME_RE = /^[a-z][a-zA-Z0-9]{0,29}$/;
  const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const PER = ['group', 'terminal', 'site'];
  const MIN = 60000;
  const LOOKBACK_H = 24;
  const ROLES = () => FP.users.ROLES;

  // The structure a schedule goes item by item through: forEach, or 0.54's forEachOpen.
  const eachOf = s => (s && (s.forEach != null ? s.forEach : s.forEachOpen != null ? s.forEachOpen : null));

  /* ---------- Checking a form's schedules ---------- */
  function checkWho(w, where, p) {
    if (w == null) return;
    if (typeof w !== 'object' || Array.isArray(w)) { p.push(`${where}: who to tell is { roles, departments, people }`); return; }
    Object.keys(w).forEach(k => { if (!['roles', 'departments', 'people'].includes(k)) p.push(`${where}: unknown setting ${k}`); });
    ['roles', 'departments', 'people'].forEach(k => { if (w[k] != null && !(Array.isArray(w[k]) && w[k].every(x => typeof x === 'string' && x.trim()))) p.push(`${where}: ${k} is a list of names`); });
    (w.roles || []).forEach(r => { if (!ROLES().includes(r)) p.push(`${where}: no role named ${r} (${ROLES().join(', ')})`); });
  }
  // When something is due: shared by a form's own schedules (0.54) and a responsibility center's duties (0.56).
  function checkTiming(s, w, p, names) {
      if (!NAME_RE.test(s.name || '')) p.push(`${w}: a name is one word starting with a small letter, e.g. hourly`);
      else if (names.has(s.name)) p.push(`${w}: two are named ${s.name}`);
      names.add(s.name);
      if (s.label != null && typeof s.label !== 'string') p.push(`${w}: label must be text`);
      const hasEvery = s.every != null, hasAt = s.at != null;
      if (hasEvery === hasAt) p.push(`${w}: say how often: every so many minutes, or at set times`);
      if (hasEvery && !(Number.isInteger(s.every) && s.every >= 5 && s.every <= 10080)) p.push(`${w}: every is whole minutes, 5 to 10,080 (a week)`);
      if (hasAt) {
        if (!Array.isArray(s.at) || !s.at.length || !s.at.every(t => TIME_RE.test(t))) p.push(`${w}: at is a list of times like 06:00`);
        if (eachOf(s) != null) p.push(`${w}: set times can't go item by item; use every`);
      }
      if (s.days != null && !(Array.isArray(s.days) && s.days.length && s.days.every(d => DAYS.includes(d)))) p.push(`${w}: days is a list of ${DAYS.join(', ')}`);
      if (s.days != null && !hasAt) p.push(`${w}: days go with set times`);
      if (s.window != null && !(Number.isInteger(s.window) && s.window >= 5 && s.window <= 720)) p.push(`${w}: window is whole minutes, 5 to 720`);
      if (s.grace != null && !(Number.isInteger(s.grace) && s.grace >= 0 && s.grace <= 720)) p.push(`${w}: grace is whole minutes, 0 to 720`);
      if (s.per != null && !PER.includes(s.per)) p.push(`${w}: per is ${PER.join(', ')}`);
      const each = eachOf(s);
      if (s.forEach != null && s.forEachOpen != null) p.push(`${w}: forEach and forEachOpen say the same thing; keep forEach`);
      if (each != null) {
        if (typeof each !== 'string' || !FP.structures.has(each)) p.push(`${w}: no structure named ${each}`);
        // Item by item (0.60) goes through a kind whose items open and close: orders, runs, cases, inventory that goes.
        else if (FP.structures.get(each).kind && !FP.structures.get(each).open) {
          const sd = FP.structures.get(each); const K = FP.kinds && FP.kinds.get(sd.kind);
          p.push(`${w}: item by item goes through items that open and close; ${sd.label || each} ${K ? `are ${K.plural || K.label}, which` : ''} never close (pick Orders, Runs, Cases, or Inventory that is shipped or used)`.replace('  ', ' '));
        }
        else if (s.while == null && !FP.structures.get(each).open) p.push(`${w}: say while which of its items it is due (a While formula, e.g. status <> "Ended"), or give ${each} a Still open rule`);
        if (s.per != null) p.push(`${w}: per goes with schedules that aren't item by item`);
      }
      if (s.while != null) {
        if (each == null) p.push(`${w}: While goes with For each item of`);
        else if (typeof s.while !== 'string' || !s.while.trim()) p.push(`${w}: While is a formula`);
        else { const bad = FP.fn.syntax(s.while).error; if (bad) p.push(`${w}: While: ${bad}`); }
      }
      if (s.critical != null && typeof s.critical !== 'boolean') p.push(`${w}: critical is yes or no`);
  }
  function check(def) {
    const p = [];
    if (def.due == null) return p;
    if (!Array.isArray(def.due)) return ['due must be a list of schedules'];
    const names = new Set();
    def.due.forEach((s, i) => {
      const w = `Due ${s && s.name ? s.name : i + 1}`;
      if (!s || typeof s !== 'object' || Array.isArray(s)) { p.push(`${w}: a schedule is a set of settings`); return; }
      const known = ['name', 'label', 'every', 'at', 'days', 'window', 'forEach', 'forEachOpen', 'while', 'per', 'grace', 'owner', 'critical', 'notify'];
      Object.keys(s).forEach(k => { if (!known.includes(k)) p.push(`${w}: unknown setting ${k}`); });
      checkTiming(s, w, p, names);
      const o = s.owner;
      if (o == null) p.push(`${w}: say who is responsible`);
      else if (typeof o !== 'object' || Array.isArray(o)) p.push(`${w}: owner is { signedIn: true } or { role, department }`);
      else {
        Object.keys(o).forEach(k => { if (!['signedIn', 'role', 'department'].includes(k)) p.push(`${w}: owner: unknown setting ${k}`); });
        if (o.signedIn === true && (o.role != null || o.department != null)) p.push(`${w}: responsible is whoever is signed in, or people by role or department, not both`);
        if (o.signedIn !== true && o.role == null && o.department == null) p.push(`${w}: responsible: whoever is signed in, or a role and/or a department`);
        if (o.role != null && !ROLES().includes(o.role)) p.push(`${w}: no role named ${o.role}`);
        if (o.department != null && !(typeof o.department === 'string' && o.department.trim())) p.push(`${w}: department is a name`);
      }
      if (s.notify != null) {
        if (typeof s.notify !== 'object' || Array.isArray(s.notify)) p.push(`${w}: notify is { missed, failure }`);
        else {
          Object.keys(s.notify).forEach(k => { if (!['missed', 'failure'].includes(k)) p.push(`${w}: notify: unknown setting ${k}`); });
          checkWho(s.notify.missed, `${w}: told when missed`, p);
          checkWho(s.notify.failure, `${w}: told of a failure`, p);
          if (s.notify.failure && !s.critical) p.push(`${w}: a failure list goes with a critical schedule`);
        }
      }
    });
    return p;
  }

  /* ---------- Plain words ---------- */
  const hm = d => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const mins = ms => Math.max(1, Math.round(ms / MIN));
  const dur = m => (m >= 120 && m % 60 === 0 ? `${m / 60} hours` : m === 60 ? 'hour' : m > 60 && m % 60 === 0 ? `${m / 60} hours` : `${m} minutes`);
  const labelOf = id => { const st = FP.structures.has(id) ? FP.structures.get(id) : null; return (st && st.label) || id; };
  function describe(s) {
    if (!s) return '';
    const when = s.every != null
      ? `every ${dur(s.every)}${eachOf(s) ? ` for each ${labelOf(eachOf(s))} item, from its first save, while ${s.while ? s.while.trim() : 'its Still open rule is true'}` : ''}`
      : `at ${s.at.join(', ')}${s.days && s.days.length < 7 ? ` on ${s.days.join(', ')}` : ''}`;
    const per = eachOf(s) ? '' : `, once per ${s.per === 'terminal' ? 'terminal' : s.per === 'site' ? 'site' : 'terminal group'}`;
    const who = !s.owner ? '' : s.owner.signedIn ? '; whoever is signed in is responsible'
      : `; ${[s.owner.department, s.owner.role ? (s.owner.role === 'user' ? 'everyone' : FP.users.ROLE_LABEL[s.owner.role].toLowerCase() + 's and up') : null].filter(Boolean).join(' ')} ${s.owner.department && !s.owner.role ? 'department ' : ''}responsible`;
    return `Due ${when}${per}${who}${s.critical ? '; critical' : ''}.`;
  }

  /* ---------- Responsibility centers (0.56) ----------
   * Who owns duties: kept like terminal groups, as items of the built-in structure centers (changing them takes a
   * publisher; every change is an entry, so its history stays).
   *   { name, active,
   *     members: { people: [user IDs], role: 'supervisor' (and up), departments: ['Quality'],
   *                signedInAt: [{ kind: 'site' | 'group' | 'terminal', id }] },   any mix; a person can be in several
   *     duties: [{ name, label, forms: [form IDs, any of them does it], every | at + days + window, forEach + while,
   *                grace, critical, per,
   *                attach: { kind: 'form' | 'site' | 'group' | 'terminal', ids },   where it applies: wherever the forms
   *                                                                                  run, or only at these
   *                exclude: [{ kind: 'group' | 'terminal' | 'person', id, from, to }] }] }   from/to: dates, optional
   * People who are away (FP.users.setAway) are left out of every center for those days. */
  const CENTERS = 'centers';
  FP.structures.define({ id: CENTERS, version: 1, containers: {} });
  const ATTACH = ['form', 'site', 'group', 'terminal'];
  const EXCLUDE = ['group', 'terminal', 'person'];
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const dayOf = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const strs = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) : []);
  // An exclusion counts on a day between its from and to (both included), or always when it has neither.
  const excludedOn = (x, t) => { const d = dayOf(t); return (!x.from || d >= x.from) && (!x.to || d <= x.to); };

  function checkCenter(v) {
    const p = [];
    if (!v || typeof v !== 'object') return ['A responsibility center is a set of settings'];
    if (!v.name || !String(v.name).trim()) p.push('Give the responsibility center a name, e.g. Quality techs');
    const m = v.members || {};
    if (typeof m !== 'object' || Array.isArray(m)) p.push('Members are people, a role, departments, or whoever is signed in somewhere');
    else {
      if (m.role != null && !ROLES().includes(m.role)) p.push(`Members: no role named ${m.role}`);
      (m.signedInAt || []).forEach(x => { if (!x || !['site', 'group', 'terminal'].includes(x.kind) || !x.id) p.push('Members: signed in at a site, a terminal group or a terminal'); });
      if (!strs(m.people).length && !m.role && !strs(m.departments).length && !(m.signedInAt || []).length) p.push('Say who is in it: people, a role, a department, or whoever is signed in at some terminals');
    }
    // The ladder (0.62): who is told, and when, while a missed duty isn't acknowledged or put right.
    if (v.ladder != null) {
      if (!Array.isArray(v.ladder)) p.push('The ladder is a list of levels');
      else {
        let prev = -1;
        v.ladder.forEach((l, i) => {
          const w = `Ladder level ${i + 1}`;
          if (!l || typeof l !== 'object') { p.push(`${w}: a level is a set of settings`); return; }
          Object.keys(l).forEach(k => { if (!['after', 'tell', 'ack'].includes(k)) p.push(`${w}: unknown setting ${k}`); });
          if (!(Number.isInteger(l.after) && l.after >= 0 && l.after <= 10080)) p.push(`${w}: after is whole minutes since it was missed, 0 to 10080 (a week)`);
          else if (l.after < prev) p.push(`${w}: comes before the level above it; put the levels in order`);
          else prev = l.after;
          const t = l.tell || {};
          if (typeof t !== 'object' || Array.isArray(t)) p.push(`${w}: tell is { centers, role, departments, people }`);
          else {
            Object.keys(t).forEach(k => { if (!['centers', 'role', 'departments', 'people'].includes(k)) p.push(`${w}: tell: unknown setting ${k}`); });
            if (t.role != null && !ROLES().includes(t.role)) p.push(`${w}: no role named ${t.role}`);
            if (!strs(t.centers).length && !t.role && !strs(t.departments).length && !strs(t.people).length) p.push(`${w}: say who is told: a responsibility center, a role, a department or people`);
          }
          if (l.ack != null && typeof l.ack !== 'boolean') p.push(`${w}: needs acknowledging is yes or no`);
        });
      }
    }
    const names = new Set();
    (Array.isArray(v.duties) ? v.duties : []).forEach((d, i) => {
      const w = `Duty ${d && d.name ? d.name : i + 1}`;
      if (!d || typeof d !== 'object') { p.push(`${w}: a duty is a set of settings`); return; }
      const known = ['name', 'label', 'forms', 'every', 'at', 'days', 'window', 'forEach', 'while', 'grace', 'critical', 'per', 'attach', 'exclude', 'confirm', 'climbs'];
      Object.keys(d).forEach(k => { if (!known.includes(k)) p.push(`${w}: unknown setting ${k}`); });
      checkTiming(d, w, p, names);
      const forms = strs(d.forms);
      if (!forms.length) p.push(`${w}: say which forms do it`);
      forms.forEach(f => { const doc = FP.defs.get('form', f); if (!doc || doc.retired) p.push(`${w}: no form named ${f}`); });
      if (d.per != null && !PER.includes(d.per)) p.push(`${w}: once per ${PER.join(', ')}`);
      if (d.per != null && d.forEach) p.push(`${w}: item by item is once per item`);
      // Looking it over counts (0.60): a check of a form whose data needs nothing new is done by Checked, nothing new.
      if (d.confirm != null && typeof d.confirm !== 'boolean') p.push(`${w}: Checked, nothing new is yes or no`);
      if (d.climbs != null && typeof d.climbs !== 'boolean') p.push(`${w}: a miss climbs the ladder: yes or no`);
      const a = d.attach;
      if (a != null) {
        if (!ATTACH.includes(a.kind)) p.push(`${w}: it applies to a form, a site, a terminal group or a terminal`);
        else if (a.kind !== 'form' && !strs(a.ids).length) p.push(`${w}: say which ${a.kind === 'group' ? 'terminal groups' : a.kind + 's'}`);
      }
      (d.exclude || []).forEach(x => {
        if (!x || !EXCLUDE.includes(x.kind) || !x.id) p.push(`${w}: leave out a terminal group, a terminal or a person`);
        else if ((x.from && !DATE_RE.test(x.from)) || (x.to && !DATE_RE.test(x.to))) p.push(`${w}: left out from and to are dates`);
        else if (x.from && x.to && x.to < x.from) p.push(`${w}: left out to comes after from`);
      });
    });
    return p;
  }
  const shapeCenter = it => {
    const v = it.values || {}, m = v.members || {};
    // dutiesAt (0.62): when its duties last changed; a change of name, members or ladder doesn't start them again.
    return { id: it.id, name: v.name || it.id, active: v.active !== false, changedAt: it.lastAt || null, dutiesAt: v.dutiesAt || it.firstAt || null,
      members: { people: strs(m.people), role: m.role || null, departments: strs(m.departments), signedInAt: Array.isArray(m.signedInAt) ? m.signedInAt.filter(x => x && x.kind && x.id) : [] },
      duties: Array.isArray(v.duties) ? v.duties.filter(d => d && typeof d === 'object') : [],
      ladder: Array.isArray(v.ladder) ? v.ladder.filter(l => l && typeof l === 'object').map(l => ({ after: l.after || 0, tell: { centers: strs((l.tell || {}).centers), role: (l.tell || {}).role || null, departments: strs((l.tell || {}).departments), people: strs((l.tell || {}).people) }, ack: !!l.ack })) : [] };
  };
  async function allCenters() {
    const r = await FP.current.load(CENTERS).catch(() => null);
    if (!r) return [];
    return Array.from(r.items.values()).map(shapeCenter).filter(c => c.active).sort((a, b) => a.name.localeCompare(b.name));
  }
  const recC = (action, id, values) => FP.entry.record({ entry: `${CENTERS}.${action}`, item: Object.assign({ structure: CENTERS }, id ? { id } : {}), form: { id: 'centers', version: 1 }, values });
  async function mustPublisher() { if (!(await FP.users.can('publisher'))) throw new Error('Only a publisher or an admin can change responsibility centers.'); }
  const clean = v => {
    const out = {};
    if (v.name != null) out.name = String(v.name).trim();
    if (v.members != null) out.members = { people: strs(v.members.people), role: v.members.role || null, departments: strs(v.members.departments), signedInAt: (v.members.signedInAt || []).filter(x => x && x.kind && x.id) };
    if (v.duties != null) out.duties = JSON.parse(JSON.stringify(v.duties));
    if (v.ladder != null) out.ladder = JSON.parse(JSON.stringify(v.ladder));
    return out;
  };

  /* Is this person in the center at this terminal, today? (the people, the role and departments, or signed in here) */
  function isMember(c, u, ctx, at) {
    if (!c || !u) return false;
    if (FP.users.isAway && FP.users.isAway(u, at)) return false;
    const m = c.members;
    if (m.people.includes(u.id)) return true;
    const rank = r => ROLES().indexOf(r);
    const byRole = m.role ? rank(FP.users.topRole(u.roles)) >= rank(m.role) : null;
    const byDept = m.departments.length ? m.departments.some(d => d.toLowerCase() === String(u.department || '').trim().toLowerCase()) : null;
    if ((byRole != null || byDept != null) && byRole !== false && byDept !== false) return true;
    if (ctx) return m.signedInAt.some(x => (x.kind === 'site' && x.id === ctx.site) || (x.kind === 'group' && ctx.group && x.id === ctx.group.id) || (x.kind === 'terminal' && x.id === ctx.terminalId));
    return false;
  }
  // Everyone in it today (named, by role or department; not those who are only in it by signing in somewhere).
  async function membersOf(c, at) {
    const users = await FP.users.list().catch(() => []);
    return users.filter(u => u.active && isMember(c, u, null, at));
  }
  // Left out of a duty: a person, by the duty's own exclusions (on the day), or away.
  const personLeftOut = (d, u, at) => !u || (FP.users.isAway && FP.users.isAway(u, at)) || (d.exclude || []).some(x => x.kind === 'person' && x.id === u.id && excludedOn(x, at));
  /* Where a duty applies: which of its forms this terminal runs, if it applies here at all. */
  function dutyHere(d, ctx, at) {
    const forms = strs(d.forms).filter(f => (ctx.forms || []).includes(f));
    if (!forms.length) return null;
    const a = d.attach || { kind: 'form' };
    const ids = strs(a.ids);
    const on = a.kind === 'form' || (a.kind === 'site' && ids.includes(ctx.site)) || (a.kind === 'group' && ctx.group && ids.includes(ctx.group.id)) || (a.kind === 'terminal' && ids.includes(ctx.terminalId));
    if (!on) return null;
    const out = (d.exclude || []).some(x => excludedOn(x, at) && ((x.kind === 'terminal' && x.id === ctx.terminalId) || (x.kind === 'group' && ctx.group && x.id === ctx.group.id)));
    return out ? null : forms;
  }

  FP.centers = {
    STRUCTURE: CENTERS, ATTACH, EXCLUDE,
    list: allCenters,
    async get(id) { return (await allCenters()).find(c => c.id === id) || null; },
    check: checkCenter,
    isMember, membersOf, dutyHere,
    async create(values) {
      await mustPublisher();
      const v = Object.assign({ members: {}, duties: [] }, clean(values || {}));
      const p = checkCenter(v);
      if (p.length) throw new Error(p.join('; '));
      const e = await recC('create', null, Object.assign(v, { active: true, dutiesAt: new Date().toISOString() }));
      FP.current.clearCache();
      return e.item.id;
    },
    async update(id, changes) {
      await mustPublisher();
      const c = await FP.centers.get(id);
      if (!c) throw new Error('That responsibility center is gone.');
      const v = clean(changes || {});
      const p = checkCenter(Object.assign({ name: c.name, members: c.members, duties: c.duties, ladder: c.ladder }, v));
      if (p.length) throw new Error(p.join('; '));
      if (v.duties && JSON.stringify(v.duties) !== JSON.stringify(c.duties)) v.dutiesAt = new Date().toISOString();
      await recC('update', id, v);
      FP.current.clearCache();
    },
    async remove(id) {
      await mustPublisher();
      await recC('remove', id, { active: false });
      FP.current.clearCache();
    },
  };

  /* ---------- Slots ---------- */
  const graceOf = s => (s.grace != null ? s.grace : s.every != null ? Math.min(15, Math.floor(s.every / 4)) : 15);
  function midnight(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  // The periods of a schedule that touch [from, to]: { start, end } in ms.
  function periods(s, from, to, anchor) {
    const out = [];
    if (s.every != null) {
      const len = s.every * MIN;
      if (anchor != null) {
        let k = Math.max(0, Math.floor((from - anchor) / len));
        for (let t = anchor + k * len; t <= to && out.length < 2000; t += len, k++) out.push({ start: t, end: t + len });
        return out;
      }
      for (let day = midnight(from - len); day <= to; day = midnight(day + 26 * 3600000)) {
        const next = midnight(day + 26 * 3600000);
        for (let t = day; t < next && t <= to && out.length < 2000; t += len) if (t + len >= from) out.push({ start: t, end: Math.min(t + len, next) });
      }
      return out;
    }
    const win = (s.window || 60) * MIN;
    for (let day = midnight(from - win); day <= to; day = midnight(day + 26 * 3600000)) {
      const d = new Date(day);
      if (s.days && !s.days.includes(DAYS[d.getDay()])) continue;
      s.at.forEach(t => {
        const [h, m] = t.split(':').map(Number);
        const x = new Date(day); x.setHours(h, m, 0, 0);
        if (x.getTime() + win >= from && x.getTime() <= to) out.push({ start: x.getTime(), end: x.getTime() + win });
      });
    }
    return out.sort((a, b) => a.start - b.start);
  }

  // A short, stable slot ID: the same on every terminal that works it out.
  function hash8(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('00000000' + h.toString(16)).slice(-8);
  }
  const stamp = t => { const d = new Date(t); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`; };
  const slotId = (formId, name, scopeKey, start) => `D-${hash8(`${formId}|${name}|${scopeKey}`)}-${stamp(start)}`;

  /* The structures a form saves to: completion is a save of the form in one of them. */
  function writesTo(def) {
    const out = new Set(['submissions']);
    (def.sources || []).forEach(x => { if (x && (x.kind === 'item' || x.kind === 'items') && x.structure) out.add(String(x.structure).split('~')[0]); });
    Object.values(def.lists || {}).forEach(st => { if (typeof st === 'string') out.add(st); });
    Object.keys(def.items || {}).forEach(st => out.add(st));
    return Array.from(out).filter(st => FP.structures.has(st));
  }
  const refIds = refs => {
    const out = new Set();
    Object.values(refs || {}).forEach(r => (Array.isArray(r) ? r : [r]).forEach(x => { if (x && x.id != null) out.add(String(x.id)); else if (typeof x === 'string') out.add(x); }));
    return out;
  };

  async function savesOf(formId, def) {
    const rows = [];
    for (const st of writesTo(def)) {
      const r = await FP.current.load(st).catch(() => null);
      if (r) r.rows.forEach(x => { if (x.form && x.form.id === formId) rows.push(x); });
    }
    return rows.sort((a, b) => String(a.writtenAt).localeCompare(String(b.writtenAt)));
  }

  // A While formula over an item: the names its structure's rules use (its values, status, firstAt, lastAt, …).
  function whileOf(formula, it) {
    const facts = Object.assign({}, it.values || {}, { status: it.status, lastAction: it.lastAction, lastForm: it.lastForm, firstAt: it.firstAt, lastAt: it.lastAt, entryCount: it.entryCount });
    try { return FP.fn.evaluate(formula, facts) === true; } catch (_) { return false; }
  }

  /* Who is in a role/department pool. */
  function inPool(u, owner) {
    if (!u) return false;
    const rank = r => ROLES().indexOf(r);
    if (owner.role && rank(FP.users.topRole(u.roles)) < rank(owner.role)) return false;
    if (owner.department && String(u.department || '').trim().toLowerCase() !== owner.department.trim().toLowerCase()) return false;
    return true;
  }
  const ownerText = o => (!o ? '' : o.signedIn ? 'whoever is signed in'
    : [o.department, o.role ? (o.role === 'user' ? 'everyone' : FP.users.ROLE_LABEL[o.role].toLowerCase() + 's') : null].filter(Boolean).join(' ') || 'everyone');

  /* Every slot this terminal owes, from LOOKBACK_H hours back to the next one coming: the duties of responsibility
   * centers that apply here (0.56), and schedules still kept on forms (0.54). opts: { now, terminalId, site, place }. */
  async function slots(opts) {
    opts = opts || {};
    const now = (opts.now || new Date()).getTime();
    const tid = opts.terminalId || FP.identity.terminalId;
    // Another terminal's slots (the editor, Admin): its site is the one it last checked in with.
    const site = opts.site || (tid === FP.identity.terminalId ? FP.identity.site : ((await FP.identity.lookup(tid).catch(() => null)) || {}).site || FP.identity.site);
    const place = opts.place || await FP.groups.forTerminal(tid).catch(() => ({ group: null, forms: [] }));
    const group = place.group;
    const forms = opts.forms || place.forms || [];
    const ctx = { terminalId: tid, site, group, forms };
    const recorded = await FP.current.load(STRUCTURE).catch(() => null);
    // What is owed here: { key (stable, for slot IDs), s (the timing), forms, title, center, since }
    const owed = [];
    for (const c of opts.centers || await allCenters()) {
      for (const d of c.duties) {
        const fs = dutyHere(d, ctx, now);
        if (!fs) continue;
        const t = []; const names = new Set(); checkTiming(d, '', t, names);
        if (t.length) continue;
        owed.push({ key: `C:${c.id}`, s: d, forms: fs, center: c, since: Date.parse(c.dutiesAt || '') || 0,
          owner: { center: c.id }, ownerText: c.name, defaultPer: c.members.signedInAt.length ? 'group' : 'site' });
      }
    }
    for (const formId of forms) {
      const doc = FP.defs.get('form', formId);
      if (!doc || doc.retired || !doc.def || !Array.isArray(doc.def.due) || !doc.def.due.length) continue;
      if (check(doc.def).length) continue;
      doc.def.due.forEach(sc => owed.push({ key: formId, s: sc, forms: [formId], center: null, since: Date.parse(doc.publishedAt) || 0,
        owner: sc.owner, ownerText: ownerText(sc.owner), defaultPer: sc.owner && !sc.owner.signedIn ? 'site' : 'group' }));
    }
    const savesCache = new Map();
    const savesFor = async fs => {
      const all = [];
      for (const f of fs) {
        if (!savesCache.has(f)) { const doc = FP.defs.get('form', f); savesCache.set(f, doc && doc.def ? await savesOf(f, doc.def) : []); }
        all.push(...savesCache.get(f));
      }
      return all.sort((a, b) => String(a.writtenAt).localeCompare(String(b.writtenAt)));
    };
    const out = [];
    for (const o of owed) {
      const s = o.s;
      const since = Math.max(now - LOOKBACK_H * 3600000, o.since);
      const saves = await savesFor(o.forms);
      const grace = graceOf(s) * MIN;
      const series = [];
      const each = eachOf(s);
      if (each) {
        const r = await FP.current.load(each).catch(() => null);
        if (!r) continue;
        r.items.forEach(it => {
          if (!it.firstAt) return;
          const first = Date.parse(it.firstAt);
          // Still due: the While formula over the item, or the structure's Still open rule. Once not, it stopped at its last save.
          const active = s.while ? whileOf(s.while, it) : !!it.open;
          const closedAt = active ? null : Date.parse(it.lastAt);
          if (closedAt != null && closedAt < since) return;
          series.push({ key: `${each}/${it.id}`, label: it.id, anchor: first, closedAt, item: { structure: each, id: it.id },
            done: x => (x.item.structure === each && String(x.item.id) === String(it.id)) || refIds(x.refs).has(String(it.id)) });
        });
      } else {
        const per = s.per || o.defaultPer;
        if (per === 'site') series.push({ key: `site:${site}`, label: site, done: x => x.site === site });
        else if (per === 'terminal' || !group) series.push({ key: `term:${tid}`, label: tid, done: x => x.terminalId === tid });
        else series.push({ key: `group:${group.id}`, label: group.name, done: x => group.terminals.includes(x.terminalId) });
      }
      for (const z of series) {
        const claimed = new Set();   // a save counts for one slot only: the earliest one it can still meet (F18)
        for (const pd of periods(s, Math.max(since, z.anchor || 0), now + (s.every ? s.every * MIN : 8 * 864e5), z.anchor)) {
          if (pd.start < since && pd.end + grace < now) continue;
          if (z.anchor != null && pd.start < z.anchor) continue;
          if (z.closedAt != null && pd.end > z.closedAt) continue;     // the item closed before this period ended
          if (pd.start > now) { out.push(slotOf(o, z, pd, grace, 'upcoming', null, recorded)); break; }
          const save = saves.find(x => { const t = Date.parse(x.writtenAt); return !claimed.has(x) && t >= pd.start && t < pd.end + grace && z.done(x); });
          if (save) claimed.add(save);
          let state;
          if (save) state = Date.parse(save.writtenAt) >= pd.end ? 'done late' : 'done';
          else if (now < pd.end) state = 'due';
          else if (now < pd.end + grace) state = 'late';
          else state = 'missed';
          out.push(slotOf(o, z, pd, grace, state, save, recorded));
        }
      }
    }
    const order = { missed: 0, late: 1, due: 2, upcoming: 3, 'done late': 4, done: 5, excused: 6 };
    return out.sort((a, b) => order[a.state] - order[b.state] || a.end - b.end);
  }
  function slotOf(o, z, pd, grace, state, save, recorded) {
    const s = o.s;
    const id = slotId(o.key, s.name, z.key, pd.start);
    const rec = recorded && recorded.items.get(id);
    const excused = rec && rec.values && rec.values.excusedReason;
    if (state === 'missed' && excused) state = 'excused';
    const formId = o.forms[0];
    const doc = FP.defs.get('form', formId);
    return {
      id, formId, forms: o.forms, title: (doc && doc.def && doc.def.title) || formId, schedule: s.name, label: s.label || '', start: pd.start, end: pd.end, lateUntil: pd.end + grace,
      series: `${o.key}|${s.name}|${z.key}`,   // the same check for the same thing: a later one done puts a miss right (0.62)
      state, doneAt: save ? save.writtenAt : null, doneBy: save ? save.userId : null, scope: z.key, scopeLabel: z.label, item: z.item || null,
      owner: o.owner, ownerText: o.ownerText, center: o.center ? { id: o.center.id, name: o.center.name } : null, duty: o.center ? s : null,
      critical: !!s.critical, recorded: !!rec, excused: excused || null,
      excusedBy: rec && rec.values ? rec.values.excusedBy || null : null,
    };
  }

  /* A slot in a few words, for a badge or a card. */
  function words(x, now) {
    now = (now || new Date()).getTime();
    switch (x.state) {
      case 'upcoming': return `Next at ${hm(new Date(x.start))}`;
      case 'due': return `Due by ${hm(new Date(x.end))}`;
      case 'late': return `Late ${mins(now - x.end)} min: do it by ${hm(new Date(x.lateUntil))}`;
      case 'missed': return `Missed: due by ${hm(new Date(x.end))}`;
      case 'excused': return `Excused: ${x.excused}`;
      case 'done late': return `Done late at ${hm(new Date(x.doneAt))}`;
      default: return `Done at ${hm(new Date(x.doneAt))}`;
    }
  }

  /* ---------- Checked, nothing new (0.60) ----------
   * A duty set to confirm is done by looking the form over: the launcher shows "Checked, nothing new" over the open
   * form, and this records a save of the form with nothing in it but that it was checked (and the item, for a duty
   * that goes item by item), which counts like any other save of the form. */
  async function checkOff(x, note) {
    if (!x || !(x.duty && x.duty.confirm)) throw new Error('This duty is done by saving the form.');
    const doc = FP.defs.get('form', x.formId);
    const refs = x.item ? { [x.item.structure]: { structure: x.item.structure, id: String(x.item.id) } } : {};
    await FP.entry.record({ entry: 'submissions.save', item: { structure: 'submissions', id: 'SUB-' + await FP.entry.newId() },
      form: { id: x.formId, version: doc ? doc.version : null }, refs,
      values: Object.assign({ form: x.formId, checked: true, duty: x.schedule || '', center: x.center ? x.center.id : '' }, note ? { note: String(note).slice(0, 500) } : {}) });
    if (FP.outbox && FP.outbox.flush) await FP.outbox.flush().catch(() => {});
    FP.current.clearCache();
  }

  /* ---------- Recording misses ---------- */
  // Who answers for a slot: the person signed in, when they are in its center (and not left out or away); else the
  // center (or, for a form's own schedule, whoever is signed in, or its role or department).
  let usersNow = null;
  async function responsibleFor(x, signed, idOnly) {
    if (x.center) {
      const c = await FP.centers.get(x.center.id).catch(() => null);
      if (signed && c) {
        usersNow = usersNow || await FP.users.list().catch(() => []);
        const u = usersNow.find(y => y.id === signed.id) || signed;
        const ctx = { terminalId: FP.identity.terminalId, site: FP.identity.site, group: (await FP.groups.forTerminal(FP.identity.terminalId).catch(() => ({}))).group };
        if (isMember(c, u, ctx, Date.now()) && !personLeftOut(x.duty || {}, u, Date.now())) return idOnly ? u.id : `${u.name} (${c.name})`;
      }
      return idOnly ? null : (c ? c.name : x.ownerText);
    }
    if (x.owner && x.owner.signedIn) return idOnly ? (signed ? signed.id : null) : (signed ? signed.name : 'nobody signed in');
    return idOnly ? null : x.ownerText;
  }
  async function recordMisses(list, opts) {
    const fresh = list.filter(x => x.state === 'missed' && !x.recorded);
    if (!fresh.length) return 0;
    // opts.terminalId: noticed for that terminal (a rehearsal, 0.62), with nobody of this page answering for it.
    const here = (opts && opts.terminalId) || FP.identity.terminalId;
    const u = opts && opts.terminalId ? null : await FP.users.current().catch(() => null);
    // One alert at a time for the same check of the same thing (0.62): a miss while it is open adds to it.
    const openBySeries = new Map((await allAlerts(true)).filter(a => !a.closedAt && a.series).map(a => [a.series, a]));
    for (const x of fresh) {
      await FP.entry.record({
        entry: `${STRUCTURE}.missed`, item: { structure: STRUCTURE, id: x.id }, form: { id: x.formId, version: (FP.defs.get('form', x.formId) || {}).version || null },
        values: {
          form: x.formId, title: x.title, schedule: x.schedule, scope: x.scope, where: x.scopeLabel, item: x.item ? `${x.item.structure} ${x.item.id}` : '',
          from: new Date(x.start).toISOString(), dueBy: new Date(x.end).toISOString(), lateUntil: new Date(x.lateUntil).toISOString(),
          responsible: await responsibleFor(x, u), responsibleId: (await responsibleFor(x, u, true)) || '', critical: x.critical,
          center: x.center ? x.center.id : '', centerName: x.center ? x.center.name : '',
          noticedBy: here, series: x.series || '',
        },
        userId: u ? u.id : undefined,
      });
      x.recorded = true;
      // A miss of a center with a ladder opens an alert that climbs it (0.62), unless the duty says it doesn't climb.
      if (x.center && !(x.duty && x.duty.climbs === false)) {
        const c = await FP.centers.get(x.center.id).catch(() => null);
        const same = x.series && openBySeries.get(x.series);
        if (c && c.ladder.length && same) {
          // Each miss is counted once, by its ID: a terminal that had not yet seen another's write must not count it again (F44).
          const counted = Array.isArray(same.missIds) && same.missIds.length ? same.missIds : [same.id];
          if (!counted.includes(x.id)) {
            same.missIds = counted.concat(x.id);
            same.misses = same.missIds.length;
            await recA('again', same.id, { misses: same.misses, missIds: same.missIds, lastMissedAt: new Date(x.end).toISOString() }, u ? u.id : undefined);
          }
        } else if (c && c.ladder.length) await recA('open', x.id, { misses: 1, center: c.id, centerName: c.name, title: x.title + (x.label ? ` · ${x.label}` : ''), form: x.formId,
          item: x.item ? `${x.item.id}` : '', where: x.scopeLabel, terminal: here, series: x.series || '', since: new Date(x.lateUntil).toISOString(),
          dueBy: new Date(x.end).toISOString(), critical: !!x.critical, responsible: await responsibleFor(x, u), level: 0, told: [] }, u ? u.id : undefined);
        if (c && c.ladder.length && !same && x.series) openBySeries.set(x.series, { id: x.id, series: x.series, misses: 1, missIds: [x.id] });
      }
    }
    return fresh.length;
  }

  /* ---------- Alerts: a miss climbing its center's ladder (0.62) ----------
   * alerts items, by the miss's ID: { center, title, form, item, where, terminal, series, since (when it was missed),
   * level (reached), told: [{ level, at, to, people, ids, passed, ack }], ackBy, ackAt, ackNote, closedAt, closedHow }.
   * Running terminals work it out once a minute: each level whose time has come is recorded with who was told (people
   * away are left out; a level with nobody there passes straight on). Acknowledging stops the climb; the alert stays
   * open until the miss is excused, or the same check is done again on time. */
  const ALERTS = 'alerts';
  FP.structures.define({ id: ALERTS, version: 1, containers: {} });
  const recA = (action, id, values, userId) => FP.entry.record({ entry: `${ALERTS}.${action}`, item: { structure: ALERTS, id }, form: { id: 'alerts', version: 1 }, values, userId });
  const shapeAlert = it => {
    const v = it.values || {};
    return { id: it.id, center: v.center || '', centerName: v.centerName || '', title: v.title || '', form: v.form || '', item: v.item || '', where: v.where || '', terminal: v.terminal || '',
      series: v.series || '', since: v.since || it.firstAt, dueBy: v.dueBy || null, misses: v.misses || 1, missIds: Array.isArray(v.missIds) ? v.missIds : [], lastMissedAt: v.lastMissedAt || v.dueBy || null, critical: !!v.critical, responsible: v.responsible || '', level: v.level || 0, told: Array.isArray(v.told) ? v.told : [],
      kind: v.kind || '', ackBy: v.ackBy || null, ackById: v.ackById || null, ackAt: v.ackAt || null, ackNote: v.ackNote || '', closedAt: v.closedAt || null, closedHow: v.closedHow || null, openedAt: it.firstAt };
  };
  async function allAlerts(fresh) {
    const r = await FP.current.load(ALERTS, fresh ? { fresh: true } : {}).catch(() => null);
    return r ? Array.from(r.items.values()).map(shapeAlert).sort((a, b) => String(b.since).localeCompare(String(a.since))) : [];
  }
  const sameDept = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  /* Who a level tells, on a day: its centers' members, a role and up, departments, people; never someone away. */
  async function whoIsTold(tell, at) {
    const users = (await FP.users.list().catch(() => [])).filter(u => u.active && !(FP.users.isAway && FP.users.isAway(u, at)));
    const centers = (tell.centers || []).length ? (await allCenters()).filter(c => tell.centers.includes(c.id)) : [];
    const rank = r => ROLES().indexOf(r);
    return users.filter(u => (tell.people || []).includes(u.id) || (tell.role && rank(FP.users.topRole(u.roles)) >= rank(tell.role))
      || (tell.departments || []).some(d => sameDept(d, u.department)) || centers.some(c => isMember(c, u, null, at)));
  }
  async function tellText(tell) {
    const centers = (tell.centers || []).length ? (await allCenters()).filter(c => tell.centers.includes(c.id)).map(c => c.name) : [];
    return centers.concat(tell.role ? [`${FP.users.ROLE_LABEL[tell.role].toLowerCase()}s and up`] : [], tell.departments || [], (tell.people || []).length ? [`${tell.people.length} by name`] : []).join(', ') || 'nobody';
  }
  /* Work out every open alert: put right, or a level reached. slotsNow: this terminal's slots (for put right). */
  async function climb(slotsNow) {
    const now = Date.now();
    let changed = 0;
    for (const a of (await allAlerts(true)).filter(x => !x.closedAt)) {
      // Put right: the same check, for the same thing, done for a later period.
      const back = a.series && (slotsNow || []).find(x => x.series === a.series && x.start >= Date.parse(a.dueBy || a.since) && (x.state === 'done' || x.state === 'done late'));
      if (back) { await recA('close', a.id, { closedAt: back.doneAt || new Date(now).toISOString(), closedHow: 'done again' }); changed++; continue; }
      if (a.ackAt) continue;
      const c = await FP.centers.get(a.center).catch(() => null);
      if (!c || !c.ladder.length) continue;
      const since = Date.parse(a.since);
      const told = [];
      for (let i = 0; i < c.ladder.length; i++) {
        const L = c.ladder[i];
        const prev = told[told.length - 1];
        const fire = prev && prev.passed ? Date.parse(prev.at) : since + L.after * MIN;   // nobody there: straight on
        if (fire > now) break;
        const people = await whoIsTold(L.tell, fire);
        told.push({ level: i + 1, at: new Date(fire).toISOString(), to: await tellText(L.tell), people: people.map(u => u.name), ids: people.map(u => u.id), passed: people.length ? null : 'everyone away', ack: !!L.ack });
      }
      if (told.length > a.level) { await recA('climb', a.id, { level: told.length, told }); changed++; }
    }
    if (changed) FP.current.clearCache();
    return changed;
  }
  /* The open alerts this person was told of, or that are at this terminal (where it was missed). */
  async function alertsFor(user, ctx) {
    const list = (await allAlerts(false)).filter(a => !a.closedAt);
    // A notice for admins (a terminal's clock, 0.71) is shown to every admin, not only the ones who were there when it was raised.
    const isAdmin = user && FP.users.topRole(user.roles) === 'admin';
    return list.filter(a => (user && a.told.some(t => (t.ids || []).includes(user.id))) || (isAdmin && a.kind === 'clock') || (ctx && ctx.terminalId && a.terminal === ctx.terminalId));
  }
  /* A notice for admins that belongs to no duty and no responsibility center (0.71: a terminal's clock far from the host's). It is
   * an alert like the others (kept on the record, told, acknowledged, closed), with no ladder: every admin is told at once and it
   * shows to every admin. One open at a time per series; asking again while one is open does nothing. Returns the alert's ID. */
  async function openNotice(o) {
    const series = String(o.series || '');
    if (!series) throw new Error('A notice needs a series.');
    const open = (await allAlerts(true)).find(a => a.series === series && !a.closedAt);
    if (open) return open.id;
    const now = new Date();
    const people = await whoIsTold({ role: 'admin' }, now.getTime());
    const id = await FP.entry.newId(now).catch(() => 'N-' + now.getTime());
    await recA('open', id, { kind: o.kind || 'notice', misses: 1, center: '', centerName: 'Admins', title: String(o.title || ''), form: '', item: '', where: String(o.where || ''), terminal: '',
      series, since: now.toISOString(), dueBy: null, critical: false, responsible: '', level: 1,
      told: [{ level: 1, at: now.toISOString(), to: 'admins', people: people.map(u => u.name), ids: people.map(u => u.id), passed: null, ack: false }] });
    FP.current.clearCache();
    return id;
  }
  /* Close the open notice of a series (the problem is gone). True if one was open. */
  async function closeNotice(series, how) {
    const open = (await allAlerts(true)).find(a => a.series === series && !a.closedAt);
    if (!open) return false;
    // After the alert's own opening, so a clock that moved between the two can't put the close before the open.
    await FP.entry.record({ entry: `${ALERTS}.close`, item: { structure: ALERTS, id: open.id }, form: { id: 'alerts', version: 1 }, values: { closedAt: new Date().toISOString(), closedHow: how || 'put right' }, after: open.openedAt });
    FP.current.clearCache();
    return true;
  }
  /* Acknowledge: someone told (or a supervisor) stops the climb, with a note. The alert stays until put right. */
  async function ack(id, note) {
    const u = await FP.users.current();
    if (!u) throw new Error('Sign in to acknowledge.');
    const a = (await allAlerts(true)).find(x => x.id === id);
    if (!a) throw new Error('That alert is gone.');
    if (a.closedAt) throw new Error('It was already put right.');
    if (a.ackAt) throw new Error(`${a.ackBy} acknowledged it already.`);
    const told = a.told.some(t => (t.ids || []).includes(u.id));
    if (!told && !(await FP.users.can('supervisor'))) throw new Error('Only someone who was told, or a supervisor, can acknowledge it.');
    await recA('ack', id, { ackBy: u.name, ackById: u.id, ackAt: new Date().toISOString(), ackNote: String(note || '').trim().slice(0, 500), ackLevel: a.level }, u.id);
    FP.current.clearCache();
  }
  /* An alert in a few words: where it has got to. */
  function alertWords(a) {
    const n = a.misses > 1 ? `Missed ${a.misses} in a row · ` : '';
    if (a.closedAt) return `Put right (${a.closedHow || 'closed'})`;
    return n + alertState(a);
  }
  function alertState(a) {
    if (a.ackAt) return `Acknowledged by ${a.ackBy}${a.ackNote ? `: ${a.ackNote}` : ''}`;
    const t = a.told[a.told.length - 1];
    return t ? `Level ${t.level}: ${t.passed ? `${t.to}: everyone away, passed on` : `told ${t.to}${t.people.length ? ` (${t.people.join(', ')})` : ''}`}` : 'Missed: shown at the line';
  }

  /* A supervisor excuses a miss (the line was down, there was nothing to check): kept on the record, never removed. */
  async function excuse(x, reason) {
    if (!(await FP.users.can('supervisor'))) throw new Error('Only a supervisor can excuse a missed check.');
    reason = String(reason || '').trim();
    if (!reason) throw new Error('Say why it is excused, e.g. line down.');
    if (!x.recorded) await recordMisses([Object.assign({}, x, { state: 'missed', recorded: false })]);
    const u = await FP.users.current();
    await FP.entry.record({ entry: `${STRUCTURE}.excused`, item: { structure: STRUCTURE, id: x.id }, form: { id: x.formId, version: null },
      values: { excusedReason: reason, excusedBy: u.name }, userId: u.id });
    // Its alert, if it climbs a ladder, is put right (0.62).
    const al = (await allAlerts(true)).find(a => !a.closedAt && (a.id === x.id || (x.series && a.series === x.series)));
    if (al) await recA('close', al.id, { closedAt: new Date().toISOString(), closedHow: `excused by ${u.name}: ${reason}` }, u.id);
    FP.current.clearCache && FP.current.clearCache();
  }

  /* Recorded misses (Admin › Due): the dues items of the last days, newest first. */
  async function misses(days) {
    const r = await FP.current.load(STRUCTURE, { since: new Date(Date.now() - (days || 7) * 864e5) }).catch(() => null);
    if (!r) return [];
    return Array.from(r.items.values()).map(it => Object.assign({ id: it.id, at: it.firstAt }, it.values))
      .filter(x => x.form).sort((a, b) => String(b.dueBy).localeCompare(String(a.dueBy)));
  }

  /* ---------- Watching (launchers) ----------
   * Once a minute: work out this terminal's slots, record new misses, and tell the page (event fp-due). */
  let watching = null, poke = null;
  function watch(getPlace, opts) {
    opts = opts || {};
    if (watching) clearInterval(watching);
    let busy = false;
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const place = getPlace ? await getPlace() : undefined;
        const list = await slots({ place, forms: place && place.forms });
        const n = await recordMisses(list).catch(() => 0);
        const climbed = await climb(list).catch(() => 0);
        FP.due.last = { at: new Date().toISOString(), list, climbed };
        window.dispatchEvent(new CustomEvent('fp-due', { detail: { list, recorded: n } }));
      } catch (_) { /* folder unreachable: next minute */ }
      busy = false;
    };
    tick();
    watching = setInterval(tick, opts.everyMs || 60000);
    poke = tick;   // worked out again at once (a test clock that jumped, 0.62)
    return () => { clearInterval(watching); watching = null; poke = null; };
  }

  FP.due = { STRUCTURE, DAYS, PER, check, checkTiming, describe, slots, words, recordMisses, excuse, misses, watch, last: null, writesTo, graceOf, checkOff,
    poke: () => (poke ? poke() : null) };
  /* What a terminal notices once a minute, worked out here for it (a rehearsal, 0.62): its slots, new misses, the climb. */
  async function noticeFor(terminalId) {
    const place = await FP.groups.forTerminal(terminalId);
    const list = await slots({ terminalId, place, forms: place.forms });
    const recorded = await recordMisses(list, { terminalId });
    FP.current.clearCache();
    const climbed = await climb(list);
    return { list, recorded, climbed };
  }
  FP.alerts = { openNotice, closeNotice, noticeFor, STRUCTURE: ALERTS, list: allAlerts, forUser: alertsFor, climb, ack, words: alertWords, whoIsTold, tellText };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-due'] = '0.71.0';
})();
