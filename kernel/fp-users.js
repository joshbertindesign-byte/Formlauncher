/* Form Platform kernel: users, PIN sign-in and roles (step 8)
 * Load after fp-session.js and fp-current.js.
 *
 * Users is an ordinary structure ('users'). Creating a user, setting or
 * resetting a PIN, changing roles and retiring are all entries, so every change
 * has a history. Signing in opens a User session (items in 'sign-ins'); every
 * entry written meanwhile references it, and entry.userId is the user's ID.
 *
 * PINs: six digits, never stored as typed. The browser's built-in cryptography
 * (PBKDF2-SHA256, random salt, many rounds) turns each into a deliberately slow
 * hash; only the hash is saved. The data folder is readable by anyone with
 * access, so PINs give accountability (who did what), not strong security.
 *
 * Roles (0.41): user, supervisor, publisher, admin; each can do what the ones before it can.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.session || !FP.current) throw new Error('Load fp-session.js and fp-current.js before fp-users.js');

  const STRUCTURE = 'users';
  /* Roles (0.41), each including the ones before it:
   *   user        fills in the forms of the terminal they are at
   *   supervisor  any form at the site; approvals; looks after documents
   *   publisher   makes and publishes definitions; groups and terminals
   *   admin       everything: people, sites, updates, clean-up
   * Roles from before 0.41 read as: operator -> user, qc -> supervisor. */
  const ROLES = ['user', 'supervisor', 'publisher', 'admin'];
  const ROLE_LABEL = { user: 'User', supervisor: 'Supervisor', publisher: 'Publisher', admin: 'Admin' };
  const OLD_ROLE = { operator: 'user', qc: 'supervisor' };
  const rank = r => ROLES.indexOf(OLD_ROLE[r] || r);
  const normRoles = list => { const out = (Array.isArray(list) ? list : []).map(r => OLD_ROLE[r] || r).filter(r => ROLES.includes(r)); return out.length ? Array.from(new Set(out)) : []; };
  // A person's role: the highest they hold.
  const topRole = roles => normRoles(roles).sort((a, b) => rank(b) - rank(a))[0] || 'user';
  const ITERATIONS = 300000;
  const MAX_FAILS = 5;
  const LOCK_SECONDS = 60;
  const PIN_RE = /^\d{6}$/;

  FP.structures.define({ id: STRUCTURE, version: 1, containers: {} });
  FP.session.defineType({ name: 'user', label: 'sign-in', structure: 'sign-ins', stamp: ['userId', 'name', 'roles'], closes: { afterHours: 12 } });
  FP.session.linkDefault('user', 'optional');

  /* ---------- PIN hashing ---------- */
  const b64 = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function hashPin(pin, saltB64, iterations) {
    if (!(window.crypto && crypto.subtle)) throw new Error('This browser cannot hash PINs here (no secure context). Open the app from Edge or Chrome.');
    const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    const iter = iterations || ITERATIONS;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, key, 256);
    return { alg: 'PBKDF2-SHA256', iter, salt: b64(salt), hash: b64(bits) };
  }

  function pinProblem(pin) {
    if (!PIN_RE.test(pin || '')) return 'A PIN is exactly 6 digits.';
    if (/^(\d)\1{5}$/.test(pin)) return 'Pick a PIN that isn\'t one digit repeated.';
    if ('0123456789'.includes(pin) || '9876543210'.includes(pin)) return 'Pick a PIN that isn\'t a straight run of digits.';
    return null;
  }

  /* ---------- Reading users ---------- */
  function shapeUser(it) {
    const v = it.values;
    return {
      id: it.id, name: v.name || '(no name)', department: v.department || '',
      roles: normRoles(v.roles), active: v.active !== false,
      mustChange: !!v.mustChange, pin: v.pin || null,
      // Away (0.56, vacation mode): from and to are dates (YYYY-MM-DD, both days included), or empty.
      awayFrom: DATE_RE.test(v.awayFrom || '') ? v.awayFrom : null, awayTo: DATE_RE.test(v.awayTo || '') ? v.awayTo : null, awayNote: v.awayNote && v.awayNote !== 'none' ? v.awayNote : '',
    };
  }
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const dayOf = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  /* Away at a moment (default now): between from and to, both days included. Away people are left out of
   * responsibility centers: not responsible for a duty, and not told at any level of a ladder. */
  function isAway(u, at) {
    if (!u || !u.awayFrom) return false;
    const d = dayOf(at || new Date());
    return d >= u.awayFrom && (!u.awayTo || d <= u.awayTo);
  }

  /* All users (active and retired), newest data; falls back to this device's
   * cached copy if the data folder can't be read, so sign-in works offline. */
  async function allUsers(fresh) {
    try {
      const r = await FP.current.load(STRUCTURE, fresh ? { fresh: true } : {});
      const users = Array.from(r.items.values()).map(shapeUser).sort((a, b) => a.name.localeCompare(b.name));
      await FP.kv.set('usersCache', { at: new Date().toISOString(), users });
      return users;
    } catch (e) {
      const cached = await FP.kv.get('usersCache');
      if (cached) return cached.users;
      throw e;
    }
  }

  /* ---------- Lockout ---------- */
  async function lockState() { return (await FP.kv.get('pinLock')) || { fails: 0, until: 0 }; }
  async function lockedFor() { const s = await lockState(); return Math.max(0, Math.ceil((s.until - Date.now()) / 1000)); }
  async function recordFail() {
    const s = await lockState();
    s.fails += 1;
    const locked = s.fails >= MAX_FAILS;
    if (locked) { s.until = Date.now() + LOCK_SECONDS * 1000; s.fails = 0; }
    await FP.kv.set('pinLock', s);
    return locked;
  }
  async function clearFails() { await FP.kv.set('pinLock', { fails: 0, until: 0 }); }

  /* The person's lock (0.45): wrong PINs are recorded with the person in the data folder, so five wrong PINs in a
   * quarter of an hour lock that person for 5 minutes on every terminal, not just the one being tried. The records
   * are also the log of failed sign-ins. A right PIN clears the count. */
  const FAILS = 'pin-fails';
  const PERSON_WINDOW_MS = 15 * 60000, PERSON_LOCK_MS = 5 * 60000;
  FP.structures.define({ id: FAILS, version: 1, containers: { fails: { from: 'failedAt', rule: 'list' } } });
  const recordPin = (action, user, values) => FP.entry.record({ entry: `${FAILS}.${action}`, item: { structure: FAILS, id: user.id }, form: { id: 'sign-in', version: 1 }, values }).catch(() => null);
  async function personLockedFor(user) {
    const it = await FP.current.item(FAILS, user.id, { fresh: true }).catch(() => null);
    if (!it) return 0;
    const now = Date.now();
    const cleared = Date.parse(it.values.clearedAt || '') || 0;
    const recent = (it.values.fails || []).map(t => Date.parse(t)).filter(t => t > cleared && now - t < PERSON_WINDOW_MS).sort((a, b) => a - b);
    if (recent.length < MAX_FAILS) return 0;
    return Math.max(0, Math.ceil((recent[recent.length - 1] + PERSON_LOCK_MS - now) / 1000));
  }

  async function checkPin(user, pin) {
    const wait = await lockedFor();
    if (wait) throw new Error(`Too many wrong PINs on this terminal. Try again in ${wait} seconds.`);
    const pwait = await personLockedFor(user);
    if (pwait) throw new Error(`Too many wrong PINs for ${user.name}. Try again in ${Math.ceil(pwait / 60)} minute${pwait > 60 ? 's' : ''}, or ask an admin to set a new PIN.`);
    if (!user.pin) throw new Error(`${user.name} has no PIN yet. Ask an admin to set a temporary one.`);
    const h = await hashPin(pin, user.pin.salt, user.pin.iter);
    if (h.hash !== user.pin.hash) {
      await recordPin('fail', user, { failedAt: new Date().toISOString(), terminal: FP.identity.terminalId || null });
      if (await recordFail()) throw new Error(`That PIN is not right. Too many wrong PINs: wait ${LOCK_SECONDS} seconds.`);
      throw new Error('That PIN is not right.');
    }
    await clearFails();
    const it = await FP.current.item(FAILS, user.id).catch(() => null);
    if (it && (it.values.fails || []).length) await recordPin('clear', user, { clearedAt: new Date().toISOString() });
    return true;
  }

  /* ---------- Signed-in user ---------- */
  let signedIn = null, signinGate = null;

  async function currentUser() {
    const open = await FP.session.current();
    const s = open.user && open.user[0];
    signedIn = s ? { id: s.stamp.userId, name: s.stamp.name, roles: normRoles(s.stamp.roles), since: s.openedAt, sessionId: s.id } : null;
    // The roles stored with the sign-in can be out of date: an admin may have demoted or retired this person since
    // (perhaps on another terminal). Use what the users list says now (it is cached for a short while, so a change made
    // elsewhere shows within about half a minute), and end the sign-in of someone retired.
    if (signedIn) {
      try {
        const r = await FP.current.load(STRUCTURE);
        const it = r.items.get(signedIn.id);
        if (it) {
          const u = shapeUser(it);
          if (!u.active) { await FP.session.close('user', { reason: 'retired' }); signedIn = null; return null; }
          if (u.roles.length) signedIn.roles = u.roles;
        }
      } catch (e) { /* the list can't be read now: keep what the sign-in says */ }
    }
    return signedIn;
  }

  // Ranked: a publisher can do what a supervisor can, and so on. Old role names still work in calls.
  const hasRole = (u, role) => !!u && rank(role) >= 0 && normRoles(u.roles).some(r => rank(r) >= rank(role));   // an unknown role name is never held

  async function requireRole(role) {
    const u = await currentUser();
    if (!hasRole(u, role)) throw new Error(`Only a${/^[aeiou]/.test(role) ? 'n' : ''} ${role} can do that.`);
    return u;
  }

  /* by: who made the change when nobody is signed in (choosing your own PIN, the first admin). */
  const record = (action, id, values, by) => FP.entry.record({
    entry: `${STRUCTURE}.${action}`, item: { structure: STRUCTURE, id }, form: { id: 'users', version: 1 }, values,
    userId: by || undefined,
  });

  FP.users = {
    ROLES, ROLE_LABEL, topRole, normRoles,
    pinProblem,
    hashPin,
    list: fresh => allUsers(fresh),
    current: currentUser,
    /* The person signed in as last seen (no waiting), for formulas: USER(). */
    now: () => signedIn,
    can: async role => hasRole(await currentUser(), role),

    /* Admin: create a user with a temporary PIN they must change at first sign-in.
     * With no users at all, the first one can be created without signing in (bootstrap). */
    async create({ name, department, roles, tempPin }) {
      const users = await allUsers(true);
      if (users.length) await requireRole('admin');
      if (!name || !name.trim()) throw new Error('Enter a name.');
      roles = normRoles(roles);
      const bad = (roles || []).filter(r => !ROLES.includes(r));
      if (bad.length) throw new Error(`Unknown role ${bad.join(', ')}.`);
      if (!PIN_RE.test(tempPin || '')) throw new Error('The temporary PIN is exactly 6 digits.');
      const id = 'U-' + await FP.entry.newId();
      await record('create', id, {
        name: name.trim(), department: (department || '').trim(), roles: roles && roles.length ? roles : ['user'],
        active: true, pin: await hashPin(tempPin), mustChange: users.length > 0,
      }, users.length ? null : id);
      FP.current.clearCache();
      return id;
    },

    /* Admin: give a user a new temporary PIN (they must change it at next sign-in). */
    async resetPin(userId, tempPin) {
      await requireRole('admin');
      if (!PIN_RE.test(tempPin || '')) throw new Error('The temporary PIN is exactly 6 digits.');
      await record('resetPin', userId, { pin: await hashPin(tempPin), mustChange: true });
      FP.current.clearCache();
    },

    /* Admin: a person's name or department. */
    async rename(userId, { name, department }) {
      await requireRole('admin');
      const values = {};
      if (name != null) { if (!String(name).trim()) throw new Error('Give them a name.'); values.name = String(name).trim(); }
      if (department != null) values.department = String(department).trim();
      await record('rename', userId, values);
      FP.current.clearCache();
    },

    /* Away from one day to another (vacation mode, 0.56): set by the person themselves when signed in, or a supervisor.
     * from null clears it. to empty: away until cleared. */
    async setAway(userId, from, to, note) {
      const me = await currentUser();
      if (!(me && me.id === userId) && !(await FP.users.can('supervisor'))) throw new Error('Only the person, or a supervisor, can say when someone is away.');
      // A blank value doesn't replace an earlier one, so "not away" is written as none.
      if (from == null || from === '') { await record('away', userId, { awayFrom: 'none', awayTo: 'none', awayNote: 'none' }); FP.current.clearCache(); return; }
      if (!DATE_RE.test(from) || (to && !DATE_RE.test(to))) throw new Error('Away from and to are dates.');
      if (to && to < from) throw new Error('Away to comes after away from.');
      await record('away', userId, { awayFrom: from, awayTo: to || 'none', awayNote: String(note || '').trim() || 'none' });
      FP.current.clearCache();
    },
    isAway,
    async setRoles(userId, roles) {
      await requireRole('admin');
      roles = normRoles(roles);
      if (!roles.length) throw new Error('Give them a role.');
      const bad = roles.filter(r => !ROLES.includes(r));
      if (bad.length) throw new Error(`Unknown role ${bad.join(', ')}.`);
      await record('setRoles', userId, { roles });
      FP.current.clearCache();
    },

    async setActive(userId, active) {
      const me = await requireRole('admin');
      if (!active && me.id === userId) throw new Error('You can\'t retire yourself while signed in.');
      await record(active ? 'reinstate' : 'retire', userId, { active: !!active });
      FP.current.clearCache();
    },

    /* Check a PIN and sign in. Returns { user, mustChange }; when mustChange is
     * true the caller collects a new PIN and calls changePin before signing in. */
    async verify(userId, pin) {
      const users = await allUsers();
      const user = users.find(u => u.id === userId);
      if (!user || !user.active) throw new Error('That user is not active.');
      await checkPin(user, pin);
      return { user, mustChange: user.mustChange };
    },

    async changePin(userId, oldPin, newPin) {
      const { user } = await FP.users.verify(userId, oldPin);
      const p = pinProblem(newPin);
      if (p) throw new Error(p);
      if (newPin === oldPin) throw new Error('Pick a PIN different from the old one.');
      await record('setPin', user.id, { pin: await hashPin(newPin), mustChange: false }, user.id);
      FP.current.clearCache();
    },

    async signIn(userId, pin) {
      const { user, mustChange } = await FP.users.verify(userId, pin);
      if (mustChange) throw new Error('This PIN must be changed first.');
      await FP.session.open('user', { userId: user.id, name: user.name, roles: user.roles });
      return currentUser();
    },

    /* A rehearsal (0.62): on a test folder whose rehearsal allows it (_test/rehearsal.json { quickSignIn: true }), sign
     * someone in without their PIN, to see a terminal as they would. Never on a real folder. */
    async rehearsalSignIn(userId) {
      if (!(await FP.folder.isTest())) throw new Error('Signing in without a PIN is only for a rehearsal on a test folder.');
      const r = await FP.files.readJson(['_test'], 'rehearsal.json').catch(() => null);
      if (!(r && r.quickSignIn)) throw new Error('The rehearsal is over: sign in with your PIN.');
      const user = (await FP.users.list()).find(u => u.id === userId && u.active);
      if (!user) throw new Error('That person is not on the list.');
      const cur = await currentUser();
      if (cur && cur.id === user.id) return cur;
      if (cur) await FP.users.signOut('rehearsal');
      await FP.session.open('user', { userId: user.id, name: user.name, roles: user.roles });
      return currentUser();
    },

    async signOut(reason) {
      const u = await currentUser();
      if (!u) return null;
      await FP.session.close('user', { reason: reason || 'signed-out' });
      signedIn = null;
      return u;
    },

    /* A supervisor (or other role) confirms with their own PIN without anyone
     * signing out. Resolves with { userId, name, role, at } or null if cancelled. */
    approve(role, reason) {
      return gateUI({ mode: 'approve', role, reason });
    },

    /* Full-screen sign-in: first-admin setup, pick your name, PIN, change PIN.
     * Resolves with the signed-in user. */
    async gate(opts) {
      const u = await currentUser();
      // Someone signed in who may not sign in here (0.50.1: a terminal for supervisors only): they are signed out.
      if (u && opts && opts.role && !hasRole(u, opts.role)) await FP.users.signOut('not-here');
      else if (u) return u;
      // Only one sign-in screen at a time: an idle sign-out and the watcher can both ask for it.
      if (!signinGate) signinGate = gateUI(Object.assign({ mode: 'signin' }, opts || {})).finally(() => { signinGate = null; });
      return signinGate;
    },

    /* Sign out after `minutes` without a tap or key press, then call onSignedOut. */
    /* Who is signed in can change behind a page's back: the sign-in ends after 12 hours, or someone signs
     * out or in from another window on this terminal. Checks every 15 seconds and when the window comes
     * back to the front; calls onChange(user or null, before) whenever it differs from what the page showed. */
    watchSignIn(onChange) {
      let shown = signedIn ? signedIn.id : null, busy = false;
      const check = async () => {
        if (busy) return; busy = true;
        try {
          const u = await currentUser();
          const id = u ? u.id : null;
          if (id !== shown) { const before = shown; shown = id; await onChange(u, before); shown = signedIn ? signedIn.id : null; }
        } finally { busy = false; }
      };
      const timer = setInterval(check, 15000);
      const front = () => { if (document.visibilityState !== 'hidden') check(); };
      window.addEventListener('focus', front); document.addEventListener('visibilitychange', front);
      return () => { clearInterval(timer); window.removeEventListener('focus', front); document.removeEventListener('visibilitychange', front); };
    },
    /* minutes: a number, or a function giving it (the terminal's setting can change while the page is open). */
    watchIdle(minutes, onSignedOut) {
      let last = Date.now();
      const touch = () => { last = Date.now(); };
      ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, touch, { passive: true }));
      const timer = setInterval(async () => {
        const m = typeof minutes === 'function' ? minutes() : minutes;
        if (Date.now() - last < (m || 15) * 60000) return;
        last = Date.now();
        const u = await currentUser();
        if (u) { await FP.users.signOut('idle'); if (onSignedOut) onSignedOut(u); }
      }, 15000);
      return () => clearInterval(timer);
    },
  };

  /* ---------- Sign-in screen ---------- */
  const CSS = `
    .fp-u{position:fixed;inset:0;z-index:9998;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(15,20,25,.6);font:16px/1.45 var(--font-sans,system-ui,"Segoe UI",sans-serif)}
    .fp-u-card{width:100%;max-width:420px;max-height:calc(100vh - 32px);overflow:auto;background:var(--s-n-100);color:var(--t-n-12);border-radius:14px;padding:22px;box-shadow:0 10px 40px rgba(0,0,0,.25)}
    .fp-u-card h1{font-size:20px;margin:0 0 6px}.fp-u-card p{margin:0 0 14px;color:var(--t-n-42)}
    .fp-u-card input{font:inherit;width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid var(--l-n-83);border-radius:10px;margin:0 0 10px}
    .fp-u-list{display:flex;flex-direction:column;gap:6px;max-height:280px;overflow:auto;margin-bottom:10px}
    .fp-u-list button,.fp-u-keys button,.fp-u-act{font:inherit;min-height:48px;border-radius:10px;border:1px solid var(--l-n-88);background:var(--s-n-100);cursor:pointer;text-align:left;padding:10px 14px}
    .fp-u-list button small{display:block;color:var(--t-n-42);font-size:13px}
    .fp-u-dots{display:flex;gap:10px;justify-content:center;margin:6px 0 14px}.fp-u-dots span{width:14px;height:14px;border-radius:50%;border:2px solid var(--l-blue-42)}
    .fp-u-dots span.on{background:var(--s-blue-42)}
    .fp-u-keys{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.fp-u-keys button{text-align:center;font-size:20px;font-weight:600}
    .fp-u-act{width:100%;text-align:center;font-weight:600;margin-top:10px}.fp-u-act.primary{background:var(--s-blue-42);border-color:var(--l-blue-42);color:var(--t-n-100)}
    .fp-u.solid{background:var(--s-n-95)}
    .fp-u-msg{min-height:1.4em;margin-top:10px;font-size:14px}.fp-u-msg.bad{color:var(--t-red-40)}`;

  function el(tag, props, kids) {
    const n = document.createElement(tag);
    Object.assign(n, props || {});
    (kids || []).forEach(k => n.appendChild(k));
    return n;
  }

  function gateUI(opts) {
    if (!document.getElementById('fp-users-css')) document.head.appendChild(el('style', { id: 'fp-users-css', textContent: CSS }));
    const wrap = el('div', { className: opts.mode === 'approve' ? 'fp-u' : 'fp-u solid' }); // sign-in hides the page; approval shows it
    const card = el('div', { className: 'fp-u-card' });
    wrap.appendChild(card);
    document.body.appendChild(wrap);

    return new Promise(resolve => {
      const done = v => { wrap.remove(); resolve(v); };
      const msgEl = el('div', { className: 'fp-u-msg' });
      const say = (t, bad) => { msgEl.textContent = t || ''; msgEl.className = 'fp-u-msg' + (bad ? ' bad' : ''); };
      const screen = (title, text, kids) => { card.replaceChildren(el('h1', { textContent: title }), el('p', { textContent: text }), ...kids, msgEl); say(''); };
      const act = (label, fn, primary) => {
        const b = el('button', { type: 'button', className: 'fp-u-act' + (primary ? ' primary' : ''), textContent: label });
        b.onclick = async () => { b.disabled = true; try { await fn(); } catch (e) { say(e.message || String(e), true); } b.disabled = false; };
        return b;
      };

      /* A 6-digit PIN pad; calls onDone(pin) when six digits are in. */
      function pinPad(onDone) {
        let pin = '';
        const dots = el('div', { className: 'fp-u-dots' }, Array.from({ length: 6 }, () => el('span')));
        const paint = () => Array.from(dots.children).forEach((d, i) => { d.className = i < pin.length ? 'on' : ''; });
        const press = async k => {
          if (k === 'del') pin = pin.slice(0, -1);
          else if (pin.length < 6) pin += k;
          paint();
          if (pin.length === 6) { const p = pin; pin = ''; setTimeout(paint, 150); await onDone(p); }
        };
        const keys = el('div', { className: 'fp-u-keys' });
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].forEach(k => {
          if (k === 'ok') { keys.appendChild(el('span')); return; }
          const b = el('button', { type: 'button', textContent: k === 'del' ? '⌫' : k });
          b.setAttribute('aria-label', k === 'del' ? 'Delete' : k);
          b.onclick = () => press(k).catch(e => say(e.message, true));
          keys.appendChild(b);
        });
        const onKey = e => {
          if (!document.body.contains(keys)) { document.removeEventListener('keydown', onKey); return; }
          if (/^\d$/.test(e.key)) press(e.key).catch(err => say(err.message, true));
          else if (e.key === 'Backspace') press('del');
        };
        document.addEventListener('keydown', onKey);
        return [dots, keys];
      }

      function choosePinTwice(title, text, onPin) {
        let first = null;
        const ask = () => screen(title, first ? 'Enter the same PIN again.' : text, pinPad(async p => {
          if (!first) { const prob = pinProblem(p); if (prob) { say(prob, true); return; } first = p; ask(); return; }
          if (p !== first) { first = null; ask(); say('The two PINs did not match. Start again.', true); return; }
          await onPin(first);
        }));
        ask();
      }

      async function pickUser(filterRole, onPicked) {
        const users = (await allUsers()).filter(u => u.active && (!filterRole || hasRole(u, filterRole)));
        const search = el('input', { placeholder: 'Type to find your name', autocomplete: 'off' });
        const list = el('div', { className: 'fp-u-list' });
        const names = {};
        users.forEach(u => { names[u.name] = (names[u.name] || 0) + 1; });
        const paint = () => {
          const q = search.value.trim().toLowerCase();
          list.replaceChildren(...users.filter(u => !q || u.name.toLowerCase().includes(q)).map(u => {
            const b = el('button', { type: 'button' }, [document.createTextNode(u.name),
              el('small', { textContent: [names[u.name] > 1 && u.department ? u.department : '', ROLE_LABEL[topRole(u.roles)]].filter(Boolean).join(' · ') })]);
            b.onclick = () => onPicked(u);
            return b;
          }));
          if (!list.children.length) list.appendChild(el('p', { textContent: 'No matching names.' }));
        };
        search.oninput = paint;
        const extra = opts.mode === 'approve' ? [act('Cancel', async () => done(null))] : [];
        screen(opts.mode === 'approve' ? `${opts.role[0].toUpperCase() + opts.role.slice(1)} approval` : (opts.title || 'Sign in'),
          opts.mode === 'approve' ? (opts.reason || `A ${opts.role} confirms with their own PIN.`) : opts.role ? `A ${opts.role} signs in here and stays responsible for what is saved. Find your name, then enter your PIN.` : 'Find your name, then enter your PIN.',
          [search, list, ...extra]);
        paint();
        search.focus();
      }

      function enterPin(user) {
        screen(user.name, opts.mode === 'approve' ? 'Enter your PIN to approve.' : 'Enter your PIN.', [
          ...pinPad(async pin => {
            if (opts.mode === 'approve') {
              const { mustChange } = await FP.users.verify(user.id, pin);
              if (!hasRole(user, opts.role)) throw new Error(`${user.name} is not a ${opts.role}.`);
              // A temporary PIN is known to the admin who set it, so it can't approve anything.
              if (mustChange) throw new Error(`${user.name} still has a temporary PIN. Sign in once to choose your own, then approve.`);
              done({ userId: user.id, name: user.name, role: opts.role, at: new Date().toISOString() });
              return;
            }
            const { mustChange } = await FP.users.verify(user.id, pin);
            if (opts.role && !hasRole(user, opts.role)) throw new Error(`Only a ${opts.role} or above signs in here: the people doing the work tap their name on each form.`);
            if (mustChange) {
              choosePinTwice('Choose your own PIN', 'Your PIN was set by an admin. Choose a new 6-digit PIN only you know.', async newPin => {
                await FP.users.changePin(user.id, pin, newPin);
                done(await FP.users.signIn(user.id, newPin));
              });
              return;
            }
            done(await FP.users.signIn(user.id, pin));
          }),
          act('Back', async () => start()),
        ]);
      }

      async function firstAdmin() {
        const name = el('input', { placeholder: 'Your name', autocomplete: 'off' });
        screen('Set up the first admin', 'There are no users yet. The first person becomes an admin and can add everyone else.', [
          name,
          act('Continue', async () => {
            if (!name.value.trim()) throw new Error('Enter your name.');
            const n = name.value.trim();
            choosePinTwice('Choose your PIN', 'Choose a 6-digit PIN only you know.', async pin => {
              const id = await FP.users.create({ name: n, roles: ['admin'], tempPin: pin });
              done(await FP.users.signIn(id, pin));
            });
          }, true),
        ]);
        name.focus();
      }

      async function start() {
        try {
          if (opts.mode !== 'approve' && !(await allUsers(true)).length) { await firstAdmin(); return; }
          // A terminal where only supervisors sign in (0.50.1) lists only them.
          await pickUser(opts.mode === 'approve' ? opts.role : (opts.role || null), enterPin);
        } catch (e) {
          screen('Sign-in unavailable', String(e.message || e), [act('Try again', async () => start(), true)]);
        }
      }
      start();
    });
  }

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-users'] = '0.65.0';
})();
