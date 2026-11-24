/* Form Platform kernel: sites (step 24)
 * Load after fp-current.js and before fp-users.js.
 *
 * Sites sit above every structure. 'sites' is a built-in structure, a flat
 * list (ABI = Abilene, for example). Each terminal is assigned one site, once,
 * at setup, so nobody picks a site when they sign in.
 *
 *   - Every entry is stamped with the site of the terminal that wrote it (entry.site).
 *   - Every definition (structure, form, function, saved field, group,
 *     session type) says which sites it is for: sites: ["all"] or a list.
 *     A terminal only uses the definitions for its own site, and can only write
 *     to structures used at its site. A form used at several sites writes into
 *     the same shared structures, so data can be compared or filtered by site.
 *   - Formulas read the terminal's site with SITE(); lookups can match '$site'.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.current || !FP.identity) throw new Error('Load fp-current.js before fp-sites.js');

  const STRUCTURE = 'sites';
  const SITE_RE = /^[A-Z0-9][A-Z0-9-]{0,15}$/;
  FP.structures.define({ id: STRUCTURE, version: 1, containers: {} });

  const normalize = id => String(id || '').trim().toUpperCase();

  async function list() {
    try {
      const r = await FP.current.load(STRUCTURE, { fresh: true });
      const sites = Array.from(r.items.values()).map(it => Object.assign({ id: it.id, name: it.values.name || it.id, active: it.values.active !== false }, it.values.active === false ? { retiredAt: it.lastAt || null, retiredBy: it.lastUserId || null } : {}))
        .sort((a, b) => a.name.localeCompare(b.name));
      await FP.kv.set('sitesCache', sites);
      return sites;
    } catch (e) {
      const cached = await FP.kv.get('sitesCache');
      if (cached) return cached;
      throw e;
    }
  }

  async function mustAdmin() {
    if (FP.users && !(await FP.users.can('admin'))) throw new Error('Only an admin can change sites.');
  }

  /* A site is retired only when nothing active is at it (0.67): each active terminal and group that is, named with what to do. */
  async function mustBeEmpty(id) {
    const terms = (await FP.identity.all()).filter(t => t && !t.unreadable && t.site === id && !FP.identity.isEditor(t.terminalId) && !FP.identity.isRetired(t));
    const groups = FP.groups ? (await FP.groups.list()).filter(g => g.site === id) : [];
    if (!terms.length && !groups.length) return;
    const lines = terms.map(t => `terminal ${t.terminalId}: retire it first (Admin > the terminal > Retire this terminal)`)
      .concat(groups.map(g => `group ${g.name}: break it up first (Admin > the group > Break up the group)`));
    throw new Error(`${id} can't be retired while these are still at it: ${lines.join('; ')}.`);
  }

  FP.sites = {
    STRUCTURE,
    valid: id => SITE_RE.test(normalize(id)),
    normalize,
    list,

    /* The site this terminal is at: { id, name } or null. */
    async current() {
      const id = FP.identity.site;
      if (!id) return null;
      const s = (await list().catch(() => [])).find(x => x.id === id);
      return s || { id, name: id };
    },

    /* Add a site. With no sites at all, the first one can be made during setup, before anyone signs in. */
    async create(id, name) {
      id = normalize(id);
      if (!SITE_RE.test(id)) throw new Error('A site code is 1–16 letters, digits or dashes, e.g. ABI.');
      if (!name || !String(name).trim()) throw new Error('Give the site a name, e.g. Abilene.');
      const sites = await list();
      if (sites.length) await mustAdmin();
      if (sites.some(s => s.id === id)) throw new Error(`Site ${id} already exists.`);
      await FP.entry.record({ entry: `${STRUCTURE}.create`, item: { structure: STRUCTURE, id }, form: { id: 'sites', version: 1 },
        values: { name: String(name).trim(), active: true }, site: FP.identity.site || id });
      FP.current.clearCache();
      return id;
    },

    async rename(id, name) {
      await mustAdmin();
      id = normalize(id);
      if (!(await list()).some(x => x.id === id)) throw new Error(`There is no site ${id}.`);
      if (!name || !String(name).trim()) throw new Error('Give the site a name, e.g. Abilene.');
      await FP.entry.record({ entry: `${STRUCTURE}.rename`, item: { structure: STRUCTURE, id }, form: { id: 'sites', version: 1 }, values: { name: String(name).trim() } });
      FP.current.clearCache();
    },

    /* Retire a site (setActive(id, false); it can't be picked for a terminal, and Used at pickers grey it) or reinstate it.
     * Refused while an active terminal or group is at it. Never deleted: entries and definitions keep naming it. */
    async setActive(id, active) {
      await mustAdmin();
      id = normalize(id);
      if (!(await list()).some(s => s.id === id)) throw new Error(`There is no site ${id}.`);
      if (!active && FP.identity.site === id) throw new Error(`This terminal is at ${id}: move it to another site before turning ${id} off.`);
      if (!active) await mustBeEmpty(id);
      await FP.entry.record({ entry: `${STRUCTURE}.${active ? 'reinstate' : 'retire'}`, item: { structure: STRUCTURE, id }, form: { id: 'sites', version: 1 }, values: { active: !!active } });
      FP.current.clearCache();
    },

    /* Put this terminal at a site. Changing a terminal's site later takes an admin. */
    async assign(id) {
      id = normalize(id);
      const sites = await list();
      if (!sites.some(s => s.id === id && s.active)) throw new Error(`There is no active site ${id}.`);
      if (FP.identity.site && FP.identity.site !== id) await mustAdmin();
      await FP.kv.set('siteId', id);
      FP.identity.site = id;
      await FP.identity.checkIn();
      if (FP.defs && FP.defs.load) await FP.defs.load().catch(() => {});
      return id;
    },

    /* Is a definition for this terminal's site? sites: ["all"] or a list. */
    covers(sites, siteId) {
      if (!Array.isArray(sites) || !sites.length) return true; // unset: treated as all sites
      return sites.includes('all') || sites.includes(siteId || FP.identity.site);
    },
  };

  /* ---------- Terminal groups and terminals (0.41) ----------
   * A group is terminals at one site that run the same forms (Production presses: T01–T05):
   *   terminal-groups items: { name, site, terminals: [IDs], forms: [form IDs, in home-screen order], active }
   * A terminal in no group has its own list (and a name for the map):
   *   terminal-settings items, by terminal ID: { name, forms }
   * A terminal is in one group at most. Changing them takes a publisher. */
  const GROUPS = 'terminal-groups';
  const TERMS = 'terminal-settings';
  FP.structures.define({ id: GROUPS, version: 1, containers: {} });
  FP.structures.define({ id: TERMS, version: 1, containers: {} });
  const arr = v => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x) : []);
  /* The on-screen keyboard on a terminal (0.43): auto (when a field is tapped with a finger), always, never. */
  const KEYBOARDS = ['auto', 'always', 'never'];
  /* How long someone stays signed in without a tap (0.46), in minutes: a group's setting, else the terminal's own,
   * else 15. Production lines with hourly checks want a little over an hour; a shift is up to 12 hours. */
  const SIGNED_IN_FOR = [15, 30, 70, 120, 240, 480, 720];
  const minutesOk = m => Number.isInteger(m) && m >= 5 && m <= 720;
  /* Who signs in at a terminal (0.50.1): anyone, or supervisors only, who stay responsible while the people doing the
   * work tap their name on each form (a Who did it field) without signing in. */
  const SIGN_IN = ['anyone', 'supervisors'];
  /* How a terminal shows its forms (0.51): kiosk (its forms as big buttons, its home form above them) or admin (its
   * forms listed down the left, the open form on the right; the home form there when none is open).
   * The home form is one of its forms, or none; unset, older forms set to home: true show as before. */
  const VIEWS = ['kiosk', 'admin'];
  const homeOk = v => v === 'none' || (typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(v));
  /* What it is for (0.60): items of a list, { list: 'lines', items: ['Line 1', 'Line 2'] }. HERE() in formulas. */
  const forOf = v => (v && typeof v === 'object' && !Array.isArray(v) && typeof v.list === 'string' && Array.isArray(v.items) && v.items.length
    ? { list: v.list, items: v.items.filter(x => typeof x === 'string' && x) } : null);
  function forChange(changes, values) {
    if (changes.for === undefined) return;
    // Nothing in particular: saved as an empty setting (a blank value would leave the one before in place).
    if (changes.for === null || (changes.for && Array.isArray(changes.for.items) && !changes.for.items.length)) { values.for = { list: '', items: [] }; return; }
    const p = FP.kinds ? FP.kinds.checkFor(changes.for) : [];
    if (p.length) throw new Error(p.join('; '));
    values.for = { list: changes.for.list, items: changes.for.items.slice() };
  }
  const display = v => ({ for: forOf(v.for), homeForm: homeOk(v.homeForm) ? v.homeForm : null, view: VIEWS.includes(v.view) ? v.view : null, fullscreen: typeof v.fullscreen === 'boolean' ? v.fullscreen : null });
  function displayChanges(changes, values) {
    if (changes.homeForm !== undefined) {
      const h = changes.homeForm === null || changes.homeForm === '' ? 'none' : changes.homeForm;
      if (!homeOk(h)) throw new Error('The home form is one of its forms, or none.');
      values.homeForm = h;
    }
    if (changes.view != null) { if (!VIEWS.includes(changes.view)) throw new Error('The view is kiosk or admin.'); values.view = changes.view; }
    // Full screen on the first tap (0.69): true or false; unset is false.
    if (changes.fullscreen != null) { if (typeof changes.fullscreen !== 'boolean') throw new Error('Full screen is on or off.'); values.fullscreen = changes.fullscreen; }
  }
  async function mustPublisher() {
    if (FP.users && !(await FP.users.can('publisher'))) throw new Error('Only a publisher or an admin can change groups and terminals.');
  }
  async function allGroups() {
    const r = await FP.current.load(GROUPS, { fresh: true });
    return Array.from(r.items.values())
      .map(it => Object.assign({ id: it.id, name: it.values.name || it.id, site: it.values.site || null, terminals: arr(it.values.terminals), forms: arr(it.values.forms), active: it.values.active !== false, signedInFor: minutesOk(it.values.signedInFor) ? it.values.signedInFor : null, signIn: SIGN_IN.includes(it.values.signIn) ? it.values.signIn : null }, display(it.values)))
      .filter(g => g.active)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async function allTerminalSettings() {
    const r = await FP.current.load(TERMS, { fresh: true });
    return new Map(Array.from(r.items.values()).map(it => [it.id, Object.assign({ id: it.id, name: it.values.name || '', forms: arr(it.values.forms), keyboard: KEYBOARDS.includes(it.values.keyboard) ? it.values.keyboard : 'auto', signedInFor: minutesOk(it.values.signedInFor) ? it.values.signedInFor : null, signIn: SIGN_IN.includes(it.values.signIn) ? it.values.signIn : null }, display(it.values))]));
  }
  const recG = (action, id, values, site) => FP.entry.record({ entry: `${GROUPS}.${action}`, item: Object.assign({ structure: GROUPS }, id ? { id } : {}), form: { id: 'groups', version: 1 }, values, site: site || undefined });
  async function siteOfTerminal(id) {
    const reg = await FP.identity.lookup(id).catch(() => null);
    return (reg && reg.site) || null;
  }
  // Take terminals out of every other group they are in.
  async function pull(terminals, exceptId) {
    for (const g of await allGroups()) {
      if (g.id === exceptId) continue;
      const left = g.terminals.filter(t => !terminals.includes(t));
      if (left.length !== g.terminals.length) await recG('update', g.id, { terminals: left }, g.site);
    }
  }
  FP.groups = {
    STRUCTURE: GROUPS, TERMINALS: TERMS, KEYBOARDS, SIGNED_IN_FOR, VIEWS,
    list: allGroups,
    async get(id) { return (await allGroups()).find(g => g.id === id) || null; },
    async create({ name, site, terminals, forms, homeForm, view, fullscreen, for: forSetting }) {
      await mustPublisher();
      if (!name || !String(name).trim()) throw new Error('Give the group a name, e.g. Production presses.');
      site = normalize(site);
      if (!(await list()).some(x => x.id === site && x.active)) throw new Error(`There is no active site ${site}.`);
      terminals = arr(terminals); forms = arr(forms);
      if (terminals.length) await pull(terminals, null);
      const values = { name: String(name).trim(), site, terminals, forms, active: true };
      displayChanges({ homeForm: homeForm === undefined ? undefined : homeForm, view, fullscreen }, values);
      forChange({ for: forSetting }, values);
      const e = await recG('create', null, values, site);
      FP.current.clearCache();
      return e.item.id;
    },
    /* changes: { name, terminals, forms, for, … }. Terminals added here leave any other group. */
    async update(id, changes) {
      await mustPublisher();
      const g = await FP.groups.get(id);
      if (!g) throw new Error('That group is gone.');
      const values = {};
      if (changes.name != null) { if (!String(changes.name).trim()) throw new Error('Give the group a name.'); values.name = String(changes.name).trim(); }
      if (changes.forms != null) values.forms = arr(changes.forms);
      if (changes.signedInFor != null) { if (!minutesOk(changes.signedInFor)) throw new Error('Signed in for is 5 to 720 minutes.'); values.signedInFor = changes.signedInFor; }
      if (changes.signIn != null) { if (!SIGN_IN.includes(changes.signIn)) throw new Error('Who signs in is anyone or supervisors.'); values.signIn = changes.signIn; }
      displayChanges(changes, values);
      forChange(changes, values);
      if (changes.terminals != null) {
        values.terminals = arr(changes.terminals);
        const added = values.terminals.filter(t => !g.terminals.includes(t));
        if (added.length) await pull(added, id);
        // A terminal taken out keeps a copy of the group's forms, so it isn't left with none.
        const removed = g.terminals.filter(t => !values.terminals.includes(t));
        const ts = await allTerminalSettings();
        for (const t of removed) await FP.groups.setTerminal(t, { forms: (ts.get(t) && ts.get(t).forms.length ? ts.get(t).forms : g.forms) }, true);
      }
      await recG('update', id, values, g.site);
      FP.current.clearCache();
    },
    /* Break the group up: each terminal keeps a copy of its forms (and what the group was for). */
    async remove(id) {
      await mustPublisher();
      const g = await FP.groups.get(id);
      if (!g) return;
      for (const t of g.terminals) await FP.groups.setTerminal(t, Object.assign({ forms: g.forms }, g.homeForm ? { homeForm: g.homeForm } : {}, g.view ? { view: g.view } : {}, typeof g.fullscreen === 'boolean' ? { fullscreen: g.fullscreen } : {}, g.for ? { for: g.for } : {}), true);
      await recG('remove', id, { active: false }, g.site);
      FP.current.clearCache();
    },
    terminals: allTerminalSettings,
    /* A terminal's own name and forms (its forms count when it is in no group). */
    async setTerminal(id, changes, already) {
      if (!already) await mustPublisher();
      id = FP.identity.normalize(id);
      const values = {};
      if (changes.name != null) values.name = String(changes.name).trim();
      if (changes.forms != null) values.forms = arr(changes.forms);
      if (changes.keyboard != null) { if (!KEYBOARDS.includes(changes.keyboard)) throw new Error('The keyboard is auto, always or never.'); values.keyboard = changes.keyboard; }
      if (changes.signedInFor != null) { if (!minutesOk(changes.signedInFor)) throw new Error('Signed in for is 5 to 720 minutes.'); values.signedInFor = changes.signedInFor; }
      if (changes.signIn != null) { if (!SIGN_IN.includes(changes.signIn)) throw new Error('Who signs in is anyone or supervisors.'); values.signIn = changes.signIn; }
      displayChanges(changes, values);
      forChange(changes, values);
      await FP.entry.record({ entry: `${TERMS}.set`, item: { structure: TERMS, id }, form: { id: 'groups', version: 1 }, values, site: (await siteOfTerminal(id)) || undefined });
      FP.current.clearCache();
    },
    /* Take a terminal out of its group: it keeps a copy of the group's forms. */
    async leave(termId) {
      const g = (await allGroups()).find(x => x.terminals.includes(termId));
      if (!g) return;
      await FP.groups.update(g.id, { terminals: g.terminals.filter(t => t !== termId) });
    },
    /* What a terminal runs: its group (or none), its forms in order, its name. */
    async forTerminal(termId) {
      const groups = await allGroups().catch(() => []);
      const ts = await allTerminalSettings().catch(() => new Map());
      const g = groups.find(x => x.terminals.includes(termId)) || null;
      const own = ts.get(termId) || { name: '', forms: [], keyboard: 'auto' };
      return { group: g, forms: g ? g.forms : own.forms, name: own.name || '', keyboard: own.keyboard || 'auto',
        signedInFor: (g && g.signedInFor) || own.signedInFor || 15,
        signIn: (g && g.signIn) || own.signIn || 'anyone',
        // The home form and the view: the group's when in one (0.51).
        homeForm: g ? g.homeForm : (own.homeForm || null), view: (g ? g.view : own.view) || 'kiosk', fullscreen: (g ? g.fullscreen : own.fullscreen) === true,
        // What it is for (0.60): the terminal's own setting, else its group's.
        for: own.for || (g && g.for) || null };
    },
  };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-sites'] = '0.68.0';
})();
