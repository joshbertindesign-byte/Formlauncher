/* Form Platform: the editor's Admin page (step 27).
 * Load after fp-form-editor.js. Admins only.
 *
 * Parts, each a list on the left whose rows open their settings in place (the same rows as the
 * editors' maps) with notes or the chosen record on the right:
 *   Launcher files  one per launchable form, latest or pinned to a version; files whose form is gone
 *   Updates         the release running, the kept ones to go back to, release zips waiting in updates/
 *   Records         saved records of a structure, newest first: view as on paper, print, correct with a reason
 *   Packs (0.43)    definitions and starting records in one file: install one made elsewhere, or make one
 *   Clean-up        what is left from sessions (removed in 0.36): structures, forms and session types
 *
 * People, sites, terminal groups and terminals (0.41) are on the editor's map; FP.editor.places.pane
 * paints the settings of the one clicked.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.editor || !FP.editor.mapView) throw new Error('Load fp-form-editor.js before fp-admin.js');
  const { el, btn, input, select, toast } = FP.editor.ui;
  const mapView = FP.editor.mapView;

  const CSS = `
  .fpa-reh{margin-top:22px;padding-top:14px;border-top:1px solid var(--l-n-88)}
  .fpa-reh-clock{font-weight:700;font-size:17px;margin:8px 0}
  .fpa-reh-state{display:flex;flex-direction:column;gap:6px}
  .fpa-reh-slot,.fpa-reh-alert{padding:8px 10px;border-radius:8px;border:1px solid var(--l-n-88);background:var(--s-n-100)}
  .fpa-reh-slot.late{border-color:var(--l-amber-86);background:var(--s-amber-97)}.fpa-reh-slot.due{border-color:var(--l-n-79);background:var(--s-blue-93)}
  .fpa-reh-alert{border-color:var(--l-red-78);background:var(--s-n-98);font-weight:600}.fpa-reh-alert.acked{background:var(--s-n-100);border-color:var(--l-n-88);font-weight:400}.fpa-reh-alert.done{background:var(--s-green-96);border-color:var(--l-green-84);font-weight:400}
  .fpa-reh-vps{display:flex;flex-direction:column;gap:6px}.fpa-reh-vps .fpa-row{flex-wrap:wrap;align-items:center}
  .fpa-reh-steps{margin:0;padding-left:20px;line-height:1.6}
  .fpa-lib-make{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;align-items:start;margin:10px 0}
  @media (max-width:900px){.fpa-lib-make{grid-template-columns:1fr}}
  .fpa-lib-prev{border:1px solid var(--l-n-88);border-radius:10px;background:var(--s-n-100);min-height:220px;display:flex;align-items:center;justify-content:center;overflow:hidden}
  .fpa-lib-prev img{max-width:100%;max-height:520px;display:block}
  .fpa-lib-prev iframe{width:100%;height:520px;border:0;background:var(--s-n-100)}
  .fpa-lib-prev .lead{padding:16px}
  .fpa-lib-bar{height:6px;border-radius:999px;background:var(--s-n-95);overflow:hidden;margin:6px 0 4px}.fpa-lib-bar i{display:block;height:100%;background:var(--s-blue-42)}
  .fpa-lib-tags{display:flex;flex-direction:column;gap:6px}.fpa-lib-tags .fpa-row{flex-wrap:nowrap}.fpa-lib-tags select{max-width:150px}.fpa-lib-tags input{flex:1 1 auto;min-width:0}
  .fpa-lib-warn{color:var(--t-amber-42);font-size:13px}.fpa-lib-warn:empty{display:none}
  .fpa-lib-err{color:var(--t-red-40);font-size:14px;min-height:0}.fpa-lib-err:empty{display:none}
  .fpa-lib-folders{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 8px}
  .fpa-lib-list{display:flex;flex-direction:column;gap:4px;margin-top:8px}
  .fpa-lib-row{display:grid;grid-template-columns:minmax(0,2fr) minmax(0,3fr) auto auto;gap:10px;align-items:center;text-align:left;font:inherit;padding:8px 10px;border:1px solid var(--l-n-88);border-radius:8px;background:var(--s-n-100);cursor:pointer}
  .fpa-lib-row:hover{border-color:var(--l-n-79);background:var(--s-n-100)}.fpa-lib-row .tags{color:var(--t-n-42);font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fpa-lib-row .v,.fpa-lib-row .u{font-size:12px;color:var(--t-n-42)}.fpa-lib-row .u.warn{color:var(--t-amber-42)}
  .fpa-lib-browse{display:flex;flex-direction:column;gap:4px;align-items:flex-start}
  .fpa-lib-tagnames{display:flex;flex-direction:column;gap:6px}
  .fpa-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin:0 0 12px}
  .fpa-head h2{margin:0;font-size:22px}
  .fpa-tabs{display:flex;flex-wrap:wrap;gap:4px}
  .fpa-tabs button{font:inherit;font-size:13px;font-weight:600;min-height:34px;padding:4px 12px;border:1px solid var(--l-n-83);border-radius:999px;background:var(--s-n-100);cursor:pointer}
  .fpa-tabs button.on{background:var(--s-blue-15);border-color:var(--l-blue-15);color:var(--t-n-100)}
  .fpa-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0 0 10px}
  .fpa-tools select,.fpa-tools input{min-height:38px}
  .fpa-roles{display:flex;flex-wrap:wrap;gap:4px 14px;margin:0 0 10px}
  .fpa-roles label{display:flex;align-items:center;gap:6px;font-size:14px}
  .fpa-roles input{width:18px;height:18px}
  .fpa-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin:0 0 10px}
  .fpa-row input{flex:1 1 140px;min-width:0}
  .fpa-card{border:1px solid var(--l-n-88);border-radius:10px;padding:8px 12px;margin:0 0 8px;background:var(--s-n-100)}.fpa-card .ffe-note{margin:4px 0 0}
  .fpa-table{border-collapse:collapse;width:100%;font-size:13px}.fpa-table td,.fpa-table th{padding:6px 8px;text-align:left;border-bottom:1px solid var(--l-n-95);vertical-align:top}.fpa-table th{font-size:12px;color:var(--t-n-42);background:var(--s-n-100)}.fpa-table input{min-width:140px}
  .fpa-warn{background:var(--s-amber-97);border:1px solid var(--l-amber-88);border-radius:8px;padding:8px 10px;font-size:13px;margin:0 0 10px}
  .fpa-warn ul{margin:4px 0 0;padding-left:18px}
  .fpa-paper{padding:12px;background:var(--s-n-95)}
  .fpa-paper .fpp{display:block!important;background:var(--s-n-100);color:var(--t-n-0);font:13px/1.4 var(--font-sans,system-ui,"Segoe UI",sans-serif);padding:18px 22px;border:1px solid var(--l-n-88);border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.06)}
  .fpa-actions{display:flex;flex-wrap:wrap;gap:6px;padding:10px 12px;border-bottom:1px solid var(--l-n-88)}
  .fpa-fix{padding:10px 12px}.fpa-fix:empty{display:none}
  .fpa-fix .ffe-set input,.fpa-fix .ffe-set select{width:100%}
  .fpa-was{font-size:12px;color:var(--t-n-42)}
  .fpa-side{padding:12px 14px;font-size:14px;line-height:1.5}
  .fpa-side h4{margin:12px 0 4px;font-size:14px}
  .fpa-side p{margin:0 0 8px;color:var(--t-n-29)}
  .fpa-side dl{margin:0}.fpa-side dt{font-weight:700;margin-top:6px}.fpa-side dd{margin:0 0 4px;color:var(--t-n-29)}
  .fpa-place{background:var(--s-n-100);border:1px solid var(--l-n-88);border-radius:12px;padding:14px 18px;display:flex;flex-direction:column;gap:14px;max-width:760px}
  .fpa-place .crumb{font-size:13px;color:var(--t-n-42)}
  .fpa-place h2{margin:2px 0 0;font-size:22px}
  .fpa-place .lead{margin:4px 0 0;color:var(--t-n-42);font-size:14px;line-height:1.5}
  .fpa-place .box{border:1px solid var(--l-n-88);border-radius:10px;padding:10px 12px;background:var(--s-n-100)}
  .fpa-place .ffe-set{display:flex;flex-direction:column;gap:4px;margin:0}.fpa-place .ffe-set>span{font-size:13px;font-weight:600;color:var(--t-n-29)}.fpa-place .ffe-set em{font-weight:400;color:var(--t-n-42);font-style:normal}
  .fpa-place .ffe-set input,.fpa-place .ffe-set select{width:100%;max-width:420px}.fpa-place .fpa-row input{flex:1 1 200px;max-width:420px}
  .fpa-place>button{align-self:flex-start;min-width:160px}
  .fpp-list{display:flex;flex-direction:column;gap:4px}
  .fpa-chip{display:inline-flex;align-items:center;gap:4px;padding:2px 4px 2px 10px;border:1px solid var(--l-n-83);border-radius:999px;background:var(--s-n-100);font-size:13px}
  .fpa-duty{border-left:4px solid var(--l-teal-45);padding-left:10px;margin:0 0 12px}
  .fpp-li{display:flex;align-items:center;gap:6px;padding:6px 8px;border:1px solid var(--l-n-88);border-left:4px solid var(--c,var(--l-blue-50));border-radius:8px;background:var(--s-n-100);font-size:14px}
  .fpp-li span{flex:1 1 auto}.fpp-li small{color:var(--t-n-42)}
  .fpp-li button{font:inherit;font-size:12px;min-width:30px;min-height:30px;border:1px solid var(--l-n-83);border-radius:6px;background:var(--s-n-100);cursor:pointer}
  .fpp-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .fpp-chip{display:inline-flex;align-items:center;gap:4px;font-size:13px;padding:3px 4px 3px 10px;border:1px solid var(--l-n-83);border-radius:999px;background:var(--s-n-100)}
  .fpa-for{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
  .fpa-forchip{font:inherit;font-size:14px;min-height:36px;padding:4px 14px;border-radius:999px;border:1px solid var(--l-n-83);background:var(--s-n-100);cursor:pointer}
  .fpa-forchip.on{background:var(--s-blue-42);border-color:var(--l-blue-42);color:var(--t-n-100)}
  .fpp-chip button{border:0;background:none;color:var(--t-n-42);font:inherit;font-size:13px;cursor:pointer;min-width:24px;min-height:24px}
  .fpa-place table{border-collapse:collapse;width:100%}.fpa-place td,.fpa-place th{padding:6px 8px;text-align:left;border-bottom:1px solid var(--l-n-95);font-size:13px}.fpa-place th{font-size:12px;color:var(--t-n-42);background:var(--s-n-100)}`;
  function injectCss() { if (document.getElementById('fp-admin-css')) return; const s = el('style'); s.id = 'fp-admin-css'; s.textContent = CSS; document.head.appendChild(s); }

  // People, sites and terminals are on the editor's map (0.41); their settings open from it (FP.editor.places).
  const SECTIONS = [['launchers', 'Launchers'], ['updates', 'Updates'], ['records', 'Records'], ['due', 'Responsibility'], ['speed', 'Speed'], ['packs', 'Packs'], ['cleanup', 'Clean-up'], ['test', 'Test folder'], ['stress', 'Stress test'], ['purge', 'Purge all data']];
  const NEVER = /^$never/;
  const set = (label, help, node) => { const w = el('div', 'ffe-set'); const h = el('span', null, label + ' '); if (help) h.appendChild(el('em', null, '· ' + help)); w.append(h, node); return w; };
  const ago = iso => {
    if (!iso) return 'never';
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 90) return 'just now';
    if (s < 5400) return `${Math.round(s / 60)} minutes ago`;
    if (s < 129600) return `${Math.round(s / 3600)} hours ago`;
    return `${Math.round(s / 86400)} days ago`;
  };
  const side = (...kids) => { const d = el('div', 'fpa-side'); kids.forEach(k => d.appendChild(typeof k === 'string' ? el('p', null, k) : k)); return d; };
  const header = (prev, text) => { const h = el('header'); h.appendChild(el('span', null, text)); prev.appendChild(h); };
  // Runs an admin action: a message when it worked, the reason when it didn't, then the part repaints.
  /* Stays signed in for (0.46): minutes without a tap before the next person must sign in. */
  function signedInSelect(value, onPick, ro) {
    const names = { 15: '15 minutes', 30: '30 minutes', 70: '70 minutes: a production line with hourly checks', 120: '2 hours', 240: '4 hours', 480: '8 hours', 720: '12 hours: a whole shift' };
    const s = select(FP.groups.SIGNED_IN_FOR.map(m => [String(m), names[m] || m + ' minutes']), String(value || 15));
    s.disabled = !!ro;
    s.onchange = () => onPick(Number(s.value));
    return s;
  }
  /* Who signs in (0.50.1): anyone, or supervisors only (a shared terminal: people tap their name on each form). */
  function signInSelect(value, onPick, ro) {
    const s = select([['anyone', 'Anyone: each person signs in with their PIN'], ['supervisors', 'Supervisors only: one stays responsible; people tap their name on each form']], value || 'anyone');
    s.disabled = !!ro;
    s.onchange = () => onPick(s.value);
    return s;
  }
  /* Simulated terminals (0.52.1): on a test folder, open the launcher in a new tab as a terminal. */
  const launcherFor = id => `${window.FP_BOOT && window.FP_BOOT.base ? window.FP_BOOT.base + '../launch.html' : 'launcher.html'}?terminal=${encodeURIComponent(id)}`;
  function simulateRow(ids, addTo) {
    const row = el('div', 'fpa-row');
    ids.forEach(id => row.appendChild(btn(`Open as ${id}`, 'small', () => window.open(launcherFor(id), '_blank'))));
    if (addTo) row.appendChild(btn('+ a new one…', 'small', async () => {
      const id = FP.identity.normalize(prompt('Terminal ID to simulate, e.g. T09:', '') || '');
      if (!id) return;
      if (!FP.identity.valid(id)) { toast('Use 1–16 letters, digits or dashes, e.g. T09.', true); return; }
      const ok = await act(() => addTo(id), null);
      if (ok !== null) window.open(launcherFor(id), '_blank');
    }));
    return set('Simulate', 'test folder only: opens the launcher in a new tab as that terminal, with its own sign-ins and files', row);
  }
  /* The home form and the view (0.51): which of its forms the terminal shows as its home page, and how. */
  function homeSelect(value, forms, onPick, ro) {
    const legacy = forms.filter(f => { const d = FP.defs.get('form', f); return !!(d && d.def && d.def.home); });
    const opts = (value == null ? [['', legacy.length ? `Not chosen: ${legacy.map(formTitle).join(', ')} (set to home on the form, before 0.51)` : 'Not chosen: no home form']] : [])
      .concat([['none', 'No home form: just its forms']], forms.map(f => [f, formTitle(f)]));
    if (value && value !== 'none' && !forms.includes(value)) opts.push([value, `${formTitle(value)} (not one of its forms: not shown)`]);
    const s = select(opts, value == null ? '' : value);
    s.disabled = !!ro;
    s.onchange = () => { if (s.value) onPick(s.value); };
    return s;
  }
  /* What a group or terminal is for (0.60): a list, then which of its items (in use). onPick(for or null). */
  function forPicker(value, onPick, ro, inherited) {
    const box = el('div', 'fpa-for');
    const lists = FP.kinds ? FP.kinds.lists() : [];
    const cur = value && value.list ? value : null;
    const ls = select([['', inherited ? `As its group: ${inherited.items.join(', ')}` : lists.length ? 'Nothing in particular' : 'No list yet (a structure of kind List: lines, presses…)']]
      .concat(lists.map(id => [id, (FP.structures.get(id).label || id)])), cur ? cur.list : '');
    ls.disabled = !!ro || !lists.length;
    const chips = el('div', 'fpp-chips');
    box.append(ls, chips);
    const paint = async list => {
      chips.replaceChildren();
      if (!list) return;
      const r = await FP.current.load(list).catch(() => null);
      const items = r ? Array.from(r.items.values()).filter(it => FP.kinds.isOpen(list, it)).map(it => it.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })) : [];
      const on = new Set(cur && cur.list === list ? cur.items : []);
      if (!items.length) chips.appendChild(el('span', 'lead', 'It has no items in use yet.'));
      items.concat(Array.from(on).filter(x => !items.includes(x))).forEach(x => {
        const b = btn(x, 'fpa-forchip' + (on.has(x) ? ' on' : ''), () => {
          if (ro) return;
          if (on.has(x)) on.delete(x); else on.add(x);
          onPick(on.size ? { list, items: items.filter(y => on.has(y)).concat(Array.from(on).filter(y => !items.includes(y))) } : null);
        });
        b.setAttribute('aria-pressed', String(on.has(x)));
        b.disabled = !!ro;
        chips.appendChild(b);
      });
    };
    ls.onchange = () => { if (!ls.value) { if (cur) onPick(null); chips.replaceChildren(); return; } paint(ls.value); };
    paint(cur ? cur.list : null);
    return box;
  }
  function viewSelect(value, onPick, ro) {
    const s = select([['kiosk', 'Kiosk: its forms as big buttons, the home form above them'], ['admin', 'Admin: its forms listed on the left, the open form on the right']], value || 'kiosk');
    s.disabled = !!ro;
    s.onchange = () => onPick(s.value);
    return s;
  }
  async function act(fn, ok, after) {
    try { const r = await fn(); if (ok) toast(typeof ok === 'function' ? ok(r) : ok); if (after) await after(r); return r; }
    catch (e) { toast(e.message, true); return null; }
  }
  const view = o => mapView({}, Object.assign({ stateKey: 'state', top: 'none', marked: NEVER, problemKey: () => 'none' }, o));
  /* ---------- Launcher files ---------- */
  async function launchersPart(again) {
    const all = await FP.launchers.list().catch(() => []);
    const shortcuts = all.filter(f => !f.file);
    const oldFiles = all.filter(f => f.file);
    const forms = FP.defs.list('form').filter(d => !d.retired && d.def && d.def.launchable).sort((x, y) => String(x.def.title || x.id).localeCompare(String(y.def.title || y.id)));
    const strays = shortcuts.filter(f => f.problem);
    const home = !!(await FP.files.readText([], 'launch.html').catch(() => null));
    const copy = text => { try { navigator.clipboard.writeText(text); toast('Copied: ' + text); } catch (e) { toast(text); } };
    return view({
      build(a, box) {
        a.head(box, 'The launcher', 'launch.html, at the top of the data folder: every terminal opens it');
        a.row(box, { key: 'home', depth: 1, color: home ? 'var(--d-blue-50)' : 'var(--d-red-54)', title: () => 'launch.html',
          sub: () => (home ? 'Its home screen shows the forms of the terminal it runs on, for whoever signs in' : 'not made yet: installing an update makes it'),
          tags: () => [a.tag(home ? 'ready' : 'no file', home ? 'var(--d-green-95)' : 'var(--d-red-92)')],
          props: p => { p.appendChild(btn(home ? 'Make it again' : 'Make it', 'small', () => act(() => FP.launchers.makeHome(), 'launch.html is made.', again))); } });
        a.head(box, 'Shortcuts', 'straight to one form: launch.html?launcher=NAME; the same rules on who can use it');
        forms.forEach(d => {
          const mine = shortcuts.filter(f => f.form === d.id);
          a.row(box, { key: 'f:' + d.id, depth: 1, color: mine.length ? 'var(--d-blue-50)' : 'var(--d-n-66)',
            title: () => d.def.title || d.id,
            sub: () => (mine.length ? mine.map(f => `${f.name} (${f.version === 'latest' || f.version == null ? 'always the latest' : `version ${f.version}`})`).join(' · ') : 'no shortcut'),
            tags: () => [a.tag(mine.length ? 'ready' : 'none', mine.length ? 'var(--d-green-95)' : 'var(--d-n-95)')],
            props: async p => {
              if (!mine.some(f => f.version === 'latest' || f.version == null)) p.appendChild(btn('Make a shortcut', 'small', () => act(() => FP.launchers.make(d.id), n => `Shortcut ${n} is made: ${FP.launchers.addressOf(n)}`, again)));
              const hist = await FP.defs.history('form', d.id).catch(() => []);
              const vs = Array.from(new Set((hist || []).filter(h => h && h.def && !h.retired).map(h => h.version))).sort((x, y) => y - x);
              if (vs.length > 1) {
                const vsel = select(vs.map(v => [String(v), `version ${v}`]), String(d.version));
                const r = el('div', 'fpa-row'); r.append(vsel, btn('Make a pinned shortcut', 'small', () => act(() => FP.launchers.make(d.id, { version: Number(vsel.value) }), n => `Shortcut ${n} is made: ${FP.launchers.addressOf(n)}`, again)));
                p.appendChild(set('Pinned to a version', 'a shortcut that keeps opening that version, e.g. while a new one is tried out', r));
              }
              mine.forEach(f => {
                const r = el('div', 'fpa-row');
                r.append(el('code', null, f.address), btn('Copy', 'small', () => copy(f.address)),
                  el('span', 'fpe-hint', `${f.made ? `made ${new Date(f.made).toLocaleDateString()}` : ''}${f.by ? ` by ${f.by}` : ''}`),
                  btn('Remove', 'small', () => { if (confirm(`Remove the shortcut ${f.name}? Windows shortcuts to it stop working.`)) act(() => FP.launchers.remove(f.name), `Shortcut ${f.name} is removed.`, again); }));
                p.appendChild(r);
              });
            } });
        });
        if (!forms.length) box.appendChild(el('p', 'ffe-note', 'No form is launchable yet. Turn on "Has its own launcher" in a form\'s settings.'));
        else a.addRow(box, '+all', '+ a shortcut for every launchable form that has none', 0, null, () => act(async () => { let n = 0; for (const d of forms) { if (!shortcuts.some(f => f.form === d.id && (f.version === 'latest' || f.version == null))) { await FP.launchers.make(d.id); n++; } } return n; }, n => `${n} shortcut${n === 1 ? '' : 's'} made.`, again));
        if (strays.length || oldFiles.length) {
          a.head(box, 'To tidy', 'shortcuts whose form is gone, and launcher files from before 0.48');
          strays.forEach(f => a.row(box, { key: 'x:' + f.name, depth: 1, color: 'var(--d-red-54)', title: () => f.name, sub: () => f.problem,
            props: p => {
              if (f.retired && f.supersededBy && f.repointable) {
                const t = (FP.defs.get('form', f.supersededBy).def || {}).title || f.supersededBy;
                p.appendChild(btn(`Point it at ${t}`, 'small', () => act(() => FP.launchers.repoint(f.name, f.supersededBy), `Shortcut ${f.name} points at ${t}.`, again)));
              }
              p.appendChild(btn('Remove the shortcut', 'small', () => act(() => FP.launchers.remove(f.name), `Shortcut ${f.name} is removed.`, again)));
            } }));
          oldFiles.forEach(f => a.row(box, { key: 'o:' + f.name, depth: 1, color: 'var(--d-amber-47)', title: () => `launchers/${f.name}`, sub: () => f.problem,
            props: p => p.appendChild(btn('Remove the file', 'small', () => { if (confirm(`Remove launchers/${f.name}? Windows shortcuts to the file stop working.`)) act(() => FP.launchers.remove(f.name), `launchers/${f.name} is removed.`, again); })) }));
        }
      },
      right(prev) {
        header(prev, 'About shortcuts');
        prev.appendChild(side('launch.html is the one launcher: pin it to every terminal\'s taskbar or Start. It knows which terminal it is on; whoever signs in sees that terminal\'s forms (supervisors and up: every form at the site, and what waits for their approval).', 'A shortcut opens one form full screen, with no home screen: make a Windows shortcut to launch.html and add ?launcher= and the shortcut\'s name to its address (Copy gives the whole address). The list of shortcuts is kept in the data folder (launchers/launchers.json); there are no other HTML files to keep up to date (0.48).',
          el('h4', null, 'Always the latest, or pinned'), 'A shortcut normally opens the form\'s latest version. A pinned one keeps opening one version: the way to try a new version on one line while the others carry on.',
          el('h4', null, 'Launcher files from before 0.48'), 'Installing a release puts each on the list and turns the file into one that goes on to its shortcut. Point the Windows shortcuts at the new address, then remove the old files here.'));
      },
    });
  }

  /* ---------- Updates ---------- */
  async function updatesPart(again) {
    const cfg = await FP.updates.installed().catch(() => null);
    const pending = await FP.updates.pending().catch(() => []);
    const kept = (cfg && cfg.kept) || [];
    return view({
      build(a, box) {
        a.head(box, 'Running', cfg && cfg.current ? null : 'files from before releases');
        if (cfg && cfg.current) a.row(box, { key: 'cur', depth: 1, color: 'var(--d-green-47)', cls: 'top', title: () => `Version ${cfg.current}`, sub: () => [cfg.installedAt ? `installed ${new Date(cfg.installedAt).toLocaleString()}` : null, cfg.by ? `by ${cfg.by}` : null, cfg.from ? `after ${cfg.from}` : null].filter(Boolean).join(' · '), act: () => {} });
        a.head(box, 'Waiting in updates', pending.length ? null : 'nothing');
        pending.forEach(z => a.row(box, { key: 'p:' + z.name, depth: 1, color: z.problems.length ? 'var(--d-red-54)' : z.newer ? 'var(--d-blue-42)' : 'var(--d-n-83)',
          title: () => z.version ? `Version ${z.version}` : z.name, sub: () => (z.problems.length ? z.problems.join('; ') : z.newer ? `${z.name} · ready to install` : `${z.name} · not newer than what runs`),
          props: p => {
            if (z.problems.length) p.appendChild(el('p', 'ffe-note', 'It can\'t be installed. Put a fresh copy of the release zip in updates.'));
            else if (z.newer) p.appendChild(btn(`Install ${z.version} now`, 'primary', e => { e.target.disabled = true; act(() => FP.updates.installShown(z.name), r => `Installed ${r.version}. ${r.launchers} launcher file${r.launchers === 1 ? '' : 's'} made again. Every terminal moves to it by itself.`, again).then(() => { e.target.disabled = false; if (FP.editor.checkUpdates) FP.editor.checkUpdates(); }); }));
            else p.appendChild(el('p', 'ffe-note', 'It isn\'t newer than the release that runs. To go back to an older release, use one kept below.'));
          } }));
        a.addRow(box, '+zip', '+ put a release zip in updates…', 1, null, () => {
          const fi = input('', { type: 'file', accept: '.zip' });
          fi.onchange = () => { const f = fi.files && fi.files[0]; if (f) act(() => FP.files.writeText(['updates'], f.name, f), `${f.name} is in updates.`, again); };
          fi.click();
        });
        a.head(box, 'Kept to go back to', kept.length > 1 ? null : 'none yet');
        kept.filter(v => !cfg || v !== cfg.current).forEach(v => a.row(box, { key: 'k:' + v, depth: 1, color: 'var(--d-n-66)', title: () => `Version ${v}`, sub: () => (FP.updates.cmp(v, cfg.current) < 0 ? 'older' : 'newer'),
          props: p => p.appendChild(btn(`Use ${v} again`, 'small', () => { if (confirm(`Make ${v} the release every terminal runs?`)) act(() => FP.updates.useRelease(v), `${v} runs now; terminals move to it by themselves.`, again); })) }));
      },
      right(prev) {
        header(prev, 'About updates');
        prev.appendChild(side('A new version of the platform comes as a release zip (kernel-0.65.0.zip). Put it in the data folder\'s updates folder (or use + put a release zip) and install it here. Installing checks every file, writes the release to runtime, and switches every page to it; each terminal reloads by itself once nothing unsaved is on its screen.',
          el('h4', null, 'Going back'), `The three newest releases are kept. Using an older one switches every terminal back the same way. This editor runs ${FP.version}.`));
      },
    });
  }

  /* ---------- Records ---------- */
  /* ---------- Speed (0.49): how long each terminal takes to open its forms and load its structures ----------
   * Each terminal writes its own figures to _stats/{terminal}.json as it works (the median of its last five). */
  const FORM_BUDGET_MS = 2000, LOAD_BUDGET_MS = 1500;
  async function speedPart() {
    const files = await FP.files.list(['_stats']).catch(() => []);
    const terms = [];
    for (const n of files.filter(x => x.endsWith('.json'))) { const st = await FP.files.readJson(['_stats'], n).catch(() => null); if (st && st.terminalId) terms.push(st); }
    terms.sort((a, b) => String(a.terminalId).localeCompare(String(b.terminalId)));
    const ms = n => (n >= 1000 ? `${(n / 1000).toFixed(1)} s` : `${n} ms`);
    return view({
      build(a, box) {
        if (!terms.length) { a.head(box, 'No figures yet', 'terminals write theirs as they open forms'); return; }
        terms.forEach(t => {
          const forms = Object.entries(t.forms || {}).sort((x, y) => y[1].readyMs - x[1].readyMs);
          const sts = Object.entries(t.structures || {}).sort((x, y) => y[1].loadMs - x[1].loadMs);
          const slow = forms.filter(([, f]) => f.readyMs > FORM_BUDGET_MS).length + sts.filter(([, x]) => x.loadMs > LOAD_BUDGET_MS).length;
          a.head(box, `${FP.identity.label ? FP.identity.label(t.terminalId) : t.terminalId}${slow ? ` · ${slow} slow` : ''}`, `${t.screen ? t.screen + ' · ' : ''}${t.cores ? t.cores + ' cores · ' : ''}figures from ${new Date(t.at).toLocaleString()}`);
          forms.forEach(([id, f]) => a.row(box, { key: `f:${t.terminalId}:${id}`, depth: 1, color: f.readyMs > FORM_BUDGET_MS ? 'var(--d-red-40)' : 'var(--d-green-47)', title: () => `${(FP.defs.get('form', id) || { def: {} }).def.title || id}: ready in ${ms(f.readyMs)}`,
            sub: () => `form · slowest of the last ${f.runs}: ${ms(f.worstMs)}`, act: () => {} }));
          sts.forEach(([id, x]) => a.row(box, { key: `s:${t.terminalId}:${id}`, depth: 1, color: x.loadMs > LOAD_BUDGET_MS ? 'var(--d-red-40)' : 'var(--d-teal-45)', title: () => `${id}: loads in ${ms(x.loadMs)}`,
            sub: () => `structure · ${x.entries} entries, ${x.items} items, ${x.filesRead} files read${x.windowed ? ' · live window' : ' · whole history'}`, act: () => {} }));
        });
      },
      right(prev) {
        header(prev, 'About these figures');
        prev.appendChild(side(`A form should be ready to use within ${FORM_BUDGET_MS / 1000} s of tapping it, and a structure load within ${LOAD_BUDGET_MS / 1000} s; slower ones are red.`,
          'Each terminal keeps the last five times for every form it opens and structure it loads, and writes their median here every half hour.',
          el('h4', null, 'When something is slow'), 'A structure that reads its whole history every time needs a live window (Structure › Loading). A form that reads many lookups over long windows loads them all before it is ready: shorten the windows.'));
      },
    });
  }

  async function recordsPart(again, st) {
    const structures = FP.defs.list('structure').filter(d => !d.retired).sort((x, y) => String(x.def.label || x.id).localeCompare(String(y.def.label || y.id)));
    st.structure = st.structure && structures.some(d => d.id === st.structure) ? st.structure : (structures[0] && structures[0].id) || null;
    const users = new Map((await FP.users.list().catch(() => [])).map(u => [u.id, u.name]));
    let rows = [];
    let data = null;
    if (st.structure) {
      data = await FP.current.load(st.structure, { fresh: true, history: true }).catch(() => null);
      rows = data ? data.rows.slice().sort((x, y) => String(y.writtenAt).localeCompare(String(x.writtenAt))) : [];
    }
    // Records health (0.49): what loading found, IDs saved new twice, and (on request) every file's chain checked.
    const health = data ? data.health.slice() : [];
    if (st.verified && st.verified.structure === st.structure) {
      const v = st.verified;
      health.unshift(v.broken.length ? `Files checked: ${v.broken.length} of ${v.files} changed after saving: ${v.broken.map(b => `${b.key} line ${b.lines.join(', ')}`).join('; ')}`
        : `Files checked ${new Date(v.at).toLocaleString()}: all ${v.files} files (${v.chained} of ${v.lines} lines chained) are as saved.`);
    }
    const formTitle = r => { const d = r.form && FP.defs.get('form', r.form.id); return d ? (d.def.title || d.id) : (r.form && r.form.id) || 'no form'; };
    const who = r => users.get(r.userId) || r.userId || '';
    const wrap = el('div');
    // Which structure, and a filter (item ID, form, person, terminal).
    const tools = el('div', 'fpa-tools');
    const ss = select(structures.map(d => [d.id, `${d.def.label || d.id} (${d.id})`]), st.structure || '');
    ss.onchange = () => { st.structure = ss.value; st.sel = null; again(); };
    const fi = input(st.filter || '', { placeholder: 'Find: ID, form, person, terminal', autocomplete: 'off' });
    fi.style.flex = '1 1 220px';
    let api = null;
    fi.oninput = () => { st.filter = fi.value; if (api) api.paint(); };
    tools.append(ss, fi);
    wrap.appendChild(tools);
    let paper = null, actions = null, fix = null;
    const shown = () => {
      const q = String(st.filter || '').trim().toLowerCase();
      return rows.filter(r => !q || [r.item.id, formTitle(r), who(r), FP.identity.label(r.terminalId), r.action].some(x => String(x || '').toLowerCase().includes(q)));
    };
    async function showRecord() {
      if (!paper) return;
      const r = rows.find(x => x.entryId === st.sel);
      actions.replaceChildren(); fix.replaceChildren(); paper.replaceChildren();
      if (!r) { paper.appendChild(el('p', 'ffe-note', rows.length ? 'Pick a record on the left to see it as it was saved.' : 'Nothing saved to this structure yet.')); return; }
      const fp = el('div', 'fpp');
      fp.appendChild(await FP.forms.recordPart(r, { who: who(r) }));
      paper.appendChild(fp);
      actions.append(btn('Print', 'small', () => FP.forms.printRecord(r, { who: who(r) }).catch(e => toast(e.message, true))), btn('Correct…', 'small', () => paintFix(r)));
    }
    // A correction: the changed values and a reason, saved as a new entry naming this one (the original is kept).
    function paintFix(r) {
      fix.replaceChildren();
      const doc = r.form && FP.defs.get('form', r.form.id);
      const def = doc ? (FP.sources ? FP.sources.normalize(doc.def) : doc.def) : { fields: [] };
      const labelOf = k => { const f = (def.fields || []).find(x => x && x.writes === `${r.item.structure}.${k}`); return f ? (f.label || f.name) : k; };
      const keys = Object.keys(r.values || {}).filter(k => k !== 'reason');
      const edits = {};
      fix.appendChild(el('div', 'fsm-label', `Correct ${r.item.id}`));
      keys.forEach(k => {
        const v = r.values[k];
        let node;
        if (v != null && typeof v === 'object') node = el('div', 'fpe-hint', 'a list or record: correct it by saving the form again');
        else if (typeof v === 'boolean') { node = select([['true', 'Yes'], ['false', 'No']], String(v)); node.onchange = () => { edits[k] = node.value === 'true'; }; }
        else { node = input(v == null ? '' : String(v), { type: typeof v === 'number' ? 'number' : 'text', autocomplete: 'off' }); node.oninput = () => { edits[k] = typeof v === 'number' ? (node.value === '' ? null : Number(node.value)) : node.value; }; }
        const w = set(labelOf(k), k !== labelOf(k) ? k : null, node);
        const first = (r.saved || {})[k];
        if (JSON.stringify(first) !== JSON.stringify(v)) w.appendChild(el('div', 'fpa-was', `first saved as ${first == null ? 'blank' : first}`));
        fix.appendChild(w);
      });
      const ri = input('', { placeholder: 'e.g. typo: 1.21 was entered as 12.1', autocomplete: 'off' });
      fix.appendChild(set('Reason', 'kept with the correction', ri));
      fix.appendChild(btn('Save the correction', 'primary', () => act(async () => {
        const changed = {};
        Object.entries(edits).forEach(([k, v]) => { if (JSON.stringify(v) !== JSON.stringify(r.values[k])) changed[k] = v; });
        if (!Object.keys(changed).length) throw new Error('Nothing is changed.');
        if (!ri.value.trim()) throw new Error('Say why it is corrected.');
        await FP.entry.correct(r, changed, ri.value.trim());
        await FP.outbox.flush();
        FP.current.clearCache();
      }, 'The correction is saved. The original stays in the record\'s history.', again)));
      fix.appendChild(btn('Cancel', 'small', () => fix.replaceChildren()));
    }
    const root = view({
      stateKey: 'records',
      build(a, box) {
        api = a;
        const list = shown();
        if (st.structure) {
          a.head(box, 'Health', health.length ? `${health.length} note${health.length === 1 ? '' : 's'}` : 'nothing found');
          health.forEach((h, i) => a.row(box, { key: 'h:' + i, depth: 1, color: /^Files checked [^:]*: all/.test(h) ? 'var(--d-green-47)' : 'var(--d-amber-47)', title: () => h.length > 90 ? h.slice(0, 88) + '…' : h, sub: () => (h.length > 90 ? h : ''),
            act: () => {} }));
          (data && data.twice || []).forEach(x => a.row(box, { key: 'tw:' + x.id, depth: 2, color: 'var(--d-red-40)', title: () => `${x.id}: saved new ${x.saves.length} times`,
            sub: () => x.saves.map(s => `${FP.identity.label(s.terminalId)} ${new Date(s.at).toLocaleString()}${users.get(s.userId) ? ' · ' + users.get(s.userId) : ''}`).join(' · '),
            act: () => { st.filter = x.id; a.paint(); } }));
          a.addRow(box, '+verify', '+ check every file of this structure, line by line', 0, null, () => act(async () => {
            const v = await FP.current.verifyFiles(st.structure);
            st.verified = Object.assign({ structure: st.structure, at: new Date().toISOString() }, v);
            return v;
          }, v => (v.broken.length ? `${v.broken.length} file${v.broken.length === 1 ? '' : 's'} changed after saving.` : `All ${v.files} files are as saved.`), again));
        }
        a.head(box, 'Saved', st.structure ? `${list.length} of ${rows.length}, newest first${list.length > 100 ? '; the first 100 shown' : ''}` : 'no structures yet');
        list.slice(0, 100).forEach(r => a.row(box, { key: 'r:' + r.entryId, depth: 1, color: r.corrections.length ? 'var(--d-amber-47)' : 'var(--d-blue-50)', cls: st.sel === r.entryId ? 'on' : '',
          title: () => r.item.id,
          sub: () => [formTitle(r), r.action, new Date(r.writtenAt).toLocaleString(), who(r), FP.identity.label(r.terminalId)].filter(Boolean).join(' · '),
          tags: () => (r.corrections.length ? [a.tag(`corrected${r.corrections.length > 1 ? ` ×${r.corrections.length}` : ''}`, 'var(--d-amber-96b)')] : []),
          act: () => { st.sel = r.entryId; a.paint(); showRecord(); } }));
      },
      right(prev) {
        header(prev, 'Record');
        actions = el('div', 'fpa-actions');
        fix = el('div', 'fpa-fix');
        paper = el('div', 'fpa-paper');
        prev.append(actions, fix, paper);
        showRecord();
      },
    });
    wrap.appendChild(root);
    return wrap;
  }

  /* ---------- Clean-up: what is left from sessions (removed in 0.36) ----------
   * Session types are retired; structures that still name sessions get a new version without them (and, for
   * a shift with a time table, a calculated value worked out from the save time by a function made from that
   * table); forms that ask to read something every shift ask every 12 hours instead. Saved entries keep their
   * old session references: nothing is rewritten. */
  const hoursOf = t => { const [h, m] = String(t).split(':').map(Number); return Math.round((h + (m || 0) / 60) * 10000) / 10000; };
  const quoteF = v => '"' + String(v).replace(/"/g, '""') + '"';   // a quote inside a formula's text is doubled
  // A formula giving the row of a time table a time falls in: IF(AND(HOUR(at) >= 6, HOUR(at) < 14), "1", …).
  function tableFormula(rows) {
    return rows.reduceRight((rest, r) => {
      const a = hoursOf(r.start), b = hoursOf(r.end);
      const cond = a < b ? `AND(HOUR(at) >= ${a}, HOUR(at) < ${b})` : `OR(HOUR(at) >= ${a}, HOUR(at) < ${b})`;
      return `IF(${cond}, ${quoteF(r.value)}, ${rest})`;
    }, '""');
  }
  const capital = s => s.replace(/(^|[-_])([a-z])/g, (_, __, c) => c.toUpperCase()).replace(/[^A-Za-z0-9]/g, '');
  function leftovers() {
    const types = FP.defs.list('session-type').filter(d => !d.retired);
    const structures = FP.defs.list('structure').filter(d => !d.retired && d.def && d.def.sessions && Object.keys(d.def.sessions).length);
    const forms = FP.defs.list('form').filter(d => !d.retired && Array.isArray(d.def && d.def.acknowledge) && d.def.acknowledge.some(a => a && a.every === 'shift'));
    // A time table on a type a structure used as a fallback becomes a function and a calculated value.
    const tableOf = name => { const t = FP.defs.get('session-type', name); const fb = t && t.def && t.def.fallback; return fb && fb.type === 'timeTable' && Array.isArray(fb.rows) && fb.rows.length ? fb.rows : null; };
    const plans = structures.map(d => {
      const calc = [];
      Object.entries(d.def.sessions).forEach(([name, raw]) => {
        const mode = raw && typeof raw === 'object' ? raw.mode : raw;
        const rows = mode === 'fallback' ? tableOf(name) : null;
        const taken = (d.def.containers && name in d.def.containers) || (d.def.calculated && name in d.def.calculated);
        if (rows && !taken) calc.push({ name, rows, fn: capital(name) + 'At', formula: tableFormula(rows) });
      });
      return { doc: d, calc };
    });
    return { types, structures, forms, plans };
  }
  async function ensureFunction(c) {
    let name = c.fn, k = 2;
    for (;;) {
      const d = FP.defs.get('function', name);
      if (!d || d.retired) break;
      if (d.def && d.def.formula === c.formula) return name;
      name = c.fn + k++;
    }
    await FP.defs.publish('function', name, { label: `${c.name.replace(/^./, x => x.toUpperCase())} at a time`, output: 'text', inputs: [{ name: 'at', type: 'date' }], formula: c.formula, sites: ['all'] },
      { note: `Made from the ${c.name} session type's time table (sessions were removed in 0.36)` });
    return name;
  }
  async function fixStructure(plan, withCalc) {
    const d = FP.defs.get('structure', plan.doc.id);
    const def = JSON.parse(JSON.stringify(d.def));
    delete def.sessions;
    if (withCalc) for (const c of plan.calc) {
      const fn = await ensureFunction(c);
      def.calculated = Object.assign({}, def.calculated || {}, { [c.name]: { fn, inputs: { at: '$firstAt' } } });
    }
    await FP.defs.publish('structure', d.id, def, { basedOn: d.version, note: 'Sessions taken out (0.36)' + (withCalc && plan.calc.length ? `; ${plan.calc.map(c => c.name).join(', ')} worked out from the save time` : '') });
  }
  async function fixForm(doc) {
    const d = FP.defs.get('form', doc.id);
    const def = JSON.parse(JSON.stringify(d.def));
    def.acknowledge.forEach(a => { if (a && a.every === 'shift') { a.every = 'hours'; a.hours = 12; } });
    await FP.defs.publish('form', d.id, def, { basedOn: d.version, note: 'Read every 12 hours instead of every shift (0.36)' });
  }
  const retireType = doc => FP.defs.retire('session-type', doc.id, { basedOn: FP.defs.get('session-type', doc.id).version, note: 'Sessions were removed in 0.36' });

  /* Records a sub-form saved on its own (0.40) that point at a master record that doesn't exist. */
  async function subOrphans() {
    const out = [];
    const seen = new Set();
    for (const d of FP.defs.list('form').filter(x => !x.retired && x.def && Array.isArray(x.def.subforms))) {
      for (const sf of d.def.subforms) {
        if (!sf || sf.saves !== 'own') continue;
        for (const src of (Array.isArray(sf.sources) ? sf.sources : [])) {
          if (!src || !src.structure || seen.has(`${d.id}|${sf.name}|${src.structure}`)) continue;
          seen.add(`${d.id}|${sf.name}|${src.structure}`);
          const data = await FP.current.load(src.structure).catch(() => null);
          if (!data) continue;
          for (const r of data.rows) {
            if (!r.form || r.form.id !== d.id || r.form.sub !== sf.name) continue;
            for (const [role, ref] of Object.entries(r.refs || {})) {
              if (typeof ref !== 'string' || !FP.structures.get(role)) continue;
              if (!(await FP.current.item(role, ref).catch(() => null))) out.push({ structure: src.structure, id: r.item.id, form: d.def.title || d.id, sub: sf.label || sf.name, role, ref, at: r.writtenAt, userId: r.userId });
            }
          }
        }
      }
    }
    return out;
  }

  /* ---------- Purge all data (0.44.5) ----------
   * Clears the data folder down to the people: every definition (forms, structures, functions, sub-forms
   * with them, older kinds), drafts, every saved record (structures' items, submissions, read-first
   * confirmations, approvals, sites, terminal groups and settings), what waits for approval, the terminal
   * list, launcher files, and the signatures, photos and files forms captured. Kept: users and their
   * sign-ins, the releases (runtime, updates, launch.html) and files you put in the media folder yourself. */
  const PURGE_KEEP_DATA = new Set(['users', 'sign-ins']);
  /* Purge works only on a folder marked as a test folder (0.45): a file with this name at its top, put there by
   * hand in File Explorer. A production folder never has it, so its records can't be purged from the app. */
  const TEST_MARK = FP.folder.TEST_MARK;
  const isTestFolder = () => FP.folder.isTest();
  const PURGE_DIRS = ['library', 'drafts', 'approvals', '_terminals', '_stats', 'launchers'];
  async function purgeAll() {
    if (!(await FP.users.can('admin'))) throw new Error('Only an admin can purge the data.');
    if (!(await isTestFolder())) throw new Error(`Purge is off: this isn't marked as a test folder. Records here are kept for audit. On a test copy, put a file named "${TEST_MARK}" at the top of the folder first.`);
    const st = FP.outbox.status();
    if (st.pending > 0) throw new Error(`${st.pending} record${st.pending === 1 ? ' is' : 's are'} still waiting to save on this computer. Let them save first (the dot in the bar), then purge.`);
    const root = FP.folder.handle;
    if (!root) throw new Error('No data folder connected.');
    const gone = { structures: 0, folders: 0, captured: 0 };
    const rm = async (dir, name) => { try { await dir.removeEntry(name, { recursive: true }); return true; } catch (e) { if (e && e.name === 'NotFoundError') return false; throw e; } };
    // Saved records: every structure's folder in data, but the people's.
    const data = await FP.folder.dir(['data'], false).catch(() => null);
    if (data) {
      const names = [];
      for await (const [name, h] of data.entries()) if (h.kind === 'directory' && !PURGE_KEEP_DATA.has(name)) names.push(name);
      for (const n of names) if (await rm(data, n)) gone.structures++;
    }
    // Definitions, drafts, approvals, the terminal list, launcher files.
    for (const n of PURGE_DIRS) if (await rm(root, n)) gone.folders++;
    // What forms captured; files put in media by hand stay.
    const media = await FP.folder.dir(['media'], false).catch(() => null);
    if (media) for (const n of Object.values(FP.media.CAPTURE_DIRS)) if (await rm(media, n)) gone.captured++;
    // Drafts must be gone: a folder OneDrive is still syncing can survive removeEntry, so take each one out too.
    for (const d of await FP.defs.drafts.list().catch(() => [])) await FP.defs.drafts.remove(d.kind, d.id);
    const left = await FP.defs.drafts.list().catch(() => []);
    if (left.length) throw new Error(`Purged, but ${left.length} draft${left.length === 1 ? '' : 's'} couldn't be deleted (${left.map(d => d.id).join(', ')}). Close the editor on other computers and purge again.`);
    // This computer's copies.
    for (const k of ['defsCache', 'sitesCache']) await FP.kv.del(k).catch(() => {});
    if (FP.current && FP.current.clearCache) FP.current.clearCache();
    await FP.defs.load().catch(() => {});
    window.dispatchEvent(new CustomEvent('fp-drafts'));   // the map's list of drafts
    if (FP.editor.refreshMap) await FP.editor.refreshMap().catch(() => {});
    return gone;
  }
  FP.editor.purgeAll = purgeAll;

  async function purgePart(again) {
    const testFolder = await isTestFolder();
    return view({
      build(a, box) {
        a.head(box, 'Purge all data', testFolder ? 'for clearing out test data; it can\'t be undone' : 'off: this folder isn\'t marked as a test folder');
        if (!testFolder) {
          a.row(box, { key: 'purge-off', depth: 1, color: 'var(--d-n-42)', title: () => 'Purge is off for this folder', sub: () => 'records here are kept for audit',
            props: p => p.appendChild(el('p', 'ffe-note', 'Purge clears every record, and nothing in a production folder may be deleted. To use it on a test copy of the folder, mark that copy as a test folder (Admin > Test folder), then come back here.')) });
          return;
        }
        a.row(box, { key: 'purge', depth: 1, color: 'var(--d-red-40)', title: () => 'Purge all data…', sub: () => 'everything but the people', tags: () => [a.tag('can\'t be undone', 'var(--d-red-92)')],
          props: p => {
            const w = el('div', 'fpa-warn');
            w.appendChild(el('b', null, 'This deletes from the data folder, for every terminal:'));
            const ul = el('ul');
            ['Every form, structure and function, older kinds and drafts', 'Every saved record: items of every structure, submissions, read-first confirmations, approval decisions', 'What waits for approval', 'Sites, terminal groups, terminal settings and the terminal list', 'Launcher files for single forms', 'Signatures, photos and files forms saved (media/signatures, photos, files)']
              .forEach(t => ul.appendChild(el('li', null, t)));
            w.appendChild(ul);
            w.appendChild(el('b', null, 'Kept:'));
            const ul2 = el('ul');
            ['Users, their roles and PINs, and their sign-ins', 'Releases: runtime, updates and launch.html', 'Files you put in the media folder yourself (setup sheets, procedures…)'].forEach(t => ul2.appendChild(el('li', null, t)));
            w.appendChild(ul2);
            p.appendChild(w);
            p.appendChild(el('p', 'ffe-note', 'Close the launchers on other computers first: one that still has records waiting to save writes them back afterwards. Each terminal is set up again (its ID and site) the next time its launcher opens.'));
            const ti = input('', { placeholder: 'type PURGE', autocomplete: 'off' });
            const go = btn('Purge all data', 'primary', () => {
              if (ti.value.trim() !== 'PURGE') { FP.editor.ui.toast('Type PURGE in the box first.', true); return; }
              if (!confirm('Purge all data? Every form, structure, record, site and terminal is deleted. Only the people are kept. This can\'t be undone.')) return;
              go.disabled = true;
              act(() => purgeAll(), g => `Purged: ${g.structures} structure${g.structures === 1 ? '' : 's'} of records, ${g.folders} folder${g.folders === 1 ? '' : 's'} of definitions and settings, ${g.captured} folder${g.captured === 1 ? '' : 's'} of captured files. The people are kept.`, again).then(() => { go.disabled = false; });
            });
            go.style.background = 'var(--d-red-40)'; go.style.borderColor = 'var(--d-red-40)';
            const r = el('div', 'fpa-row'); r.append(ti, go);
            p.appendChild(r);
          } });
      },
      right(prev) {
        header(prev, 'Purging');
        prev.appendChild(side('Purge clears the data folder down to the people, for a fresh start after testing. There is no undo and no copy is kept: if OneDrive keeps version history or a recycle bin for the folder, that is the only way back.'));
      },
    });
  }


  /* ---------- Packs (0.43): definitions and starting records in one file ----------
   * { fp: 'pack', v: 1, name, note, madeAt, kernel, definitions: [{ kind, id, def }], items: { structure: [{ id, values }] },
   *   setup (0.52): { sites: [{ id, name }], groups: [{ name, site, terminals, forms, homeForm, view, signIn, signedInFor }],
   *                   terminals: [{ id, site, name, forms, keyboard, homeForm, view, signIn, signedInFor }],
   *                   people: [{ name, department, roles, pin }] } }
   * The setup is where the forms go: sites, terminal groups and terminals in none, with their settings. Installing it
   * adds what isn't here and brings groups and terminals with the same name up to the pack's settings; nothing is
   * taken away (a group keeps forms and terminals the pack doesn't name). People go only into a folder marked as a
   * test folder, with the PIN the pack gives, so a pilot can be tried at once; in a real folder they are left out.
   * Installing publishes each definition (a new one, or a new version of one that is here and differs), in an order that
   * lets each find what it uses, then adds the items that aren't here yet, as entries saved by whoever installs it. */
  const PACK_KINDS = ['function', 'structure', 'form'];
  function readPack(text) {
    let p;
    try { p = JSON.parse(text); } catch (e) { throw new Error('This file isn\'t a pack: it isn\'t readable JSON.'); }
    if (!p || p.fp !== 'pack' || !Array.isArray(p.definitions)) throw new Error('This file isn\'t a pack (it has no definitions).');
    p.definitions = p.definitions.filter(d => d && PACK_KINDS.includes(d.kind) && d.id && d.def && typeof d.def === 'object');
    p.items = p.items && typeof p.items === 'object' ? p.items : {};
    // The media library entries, tag names and files the forms use (F5).
    const lib = p.library && typeof p.library === 'object' ? p.library : {};
    p.library = { entries: (Array.isArray(lib.entries) ? lib.entries : []).filter(x => x && typeof x === 'object' && typeof x.id === 'string'), tags: (Array.isArray(lib.tags) ? lib.tags : []).filter(x => x && typeof x.name === 'string') };
    const su = p.setup && typeof p.setup === 'object' ? p.setup : {};
    const list = x => (Array.isArray(x) ? x.filter(y => y && typeof y === 'object') : []);
    p.setup = { sites: list(su.sites).filter(x => x.id), groups: list(su.groups).filter(x => x.name && x.site), terminals: list(su.terminals).filter(x => x.id), people: list(su.people).filter(x => x.name), centers: list(su.centers).filter(x => x.name) };
    return p;
  }
  const hasSetup = p => !!(p.setup && (p.setup.sites.length || p.setup.groups.length || p.setup.terminals.length || p.setup.people.length || (p.setup.centers || []).length));
  const SETTINGS = ['homeForm', 'view', 'signIn', 'signedInFor', 'keyboard', 'for'];   // for (0.60): the list items it is for
  const pick = (o, keys) => Object.fromEntries(keys.filter(k => o[k] != null).map(k => [k, o[k]]));
  /* What installing the setup would do, one row each: new | changes | same | skipped (and why). */
  async function setupPlan(p) {
    const su = p.setup || { sites: [], groups: [], terminals: [], people: [], centers: [] };
    const out = { sites: [], groups: [], terminals: [], people: [], centers: [], test: await isTestFolder() };
    if (!hasSetup(p)) return out;
    const sites = await FP.sites.list().catch(() => []);
    const groups = await FP.groups.list().catch(() => []);
    const ts = await FP.groups.terminals().catch(() => new Map());
    const users = await FP.users.list(true).catch(() => []);
    su.sites.forEach(x => { const here = sites.find(y => y.id === FP.sites.normalize(x.id)); out.sites.push({ x, how: here ? 'same' : 'new' }); });
    su.groups.forEach(x => {
      const here = groups.find(g => g.site === FP.sites.normalize(x.site) && g.name.toLowerCase() === String(x.name).trim().toLowerCase());
      if (!here) { out.groups.push({ x, how: 'new' }); return; }
      const forms = (x.forms || []).concat(here.forms.filter(f => !(x.forms || []).includes(f)));
      const terms = here.terminals.concat((x.terminals || []).filter(t => !here.terminals.includes(t)));
      const want = Object.assign({ forms, terminals: terms }, pick(x, SETTINGS.filter(k => k !== 'keyboard')));
      const diff = Object.keys(want).filter(k => JSON.stringify(want[k]) !== JSON.stringify(here[k]));
      out.groups.push({ x, here, want, how: diff.length ? 'changes' : 'same', diff });
    });
    su.terminals.forEach(x => {
      const id = FP.identity.normalize(x.id);
      const here = ts.get(id);
      const inGroup = groups.find(g => g.terminals.includes(id));
      const forms = (x.forms || []).concat(here ? here.forms.filter(f => !(x.forms || []).includes(f)) : []);
      const want = Object.assign({ forms }, x.name ? { name: x.name } : {}, pick(x, SETTINGS));
      const diff = here ? Object.keys(want).filter(k => JSON.stringify(want[k]) !== JSON.stringify(here[k])) : Object.keys(want);
      out.terminals.push({ x, id, want, inGroup, how: !here ? 'new' : diff.length ? 'changes' : 'same', diff });
    });
    su.people.forEach(x => {
      const here = users.find(u => u.name.toLowerCase() === String(x.name).trim().toLowerCase());
      out.people.push({ x, how: here ? 'same' : !out.test ? 'skipped' : 'new' });
    });
    // Responsibility centers (0.56): one already here by name is left as it is.
    const centers = FP.centers ? await FP.centers.list().catch(() => []) : [];
    (su.centers || []).forEach(x => out.centers.push({ x, how: !FP.centers ? 'skipped' : centers.some(c => c.name.toLowerCase() === String(x.name).trim().toLowerCase()) ? 'same' : 'new' }));
    return out;
  }
  async function installSetup(plan) {
    if (!(await FP.users.can('admin'))) throw new Error('Only an admin can install a pack\'s sites, groups and terminals.');
    const n = { sites: 0, groups: 0, terminals: 0, people: 0, centers: 0 };
    for (const r of plan.sites.filter(r => r.how === 'new')) { await FP.sites.create(r.x.id, r.x.name || r.x.id); n.sites++; }
    for (const r of plan.groups) {
      if (r.how === 'new') {
        const id = await FP.groups.create({ name: r.x.name, site: r.x.site, terminals: r.x.terminals || [], forms: r.x.forms || [], homeForm: r.x.homeForm, view: r.x.view });
        const more = pick(r.x, ['signIn', 'signedInFor', 'for']);
        if (Object.keys(more).length) await FP.groups.update(id, more);
        n.groups++;
      } else if (r.how === 'changes') { await FP.groups.update(r.here.id, Object.fromEntries(r.diff.map(k => [k, r.want[k]]))); n.groups++; }
    }
    for (const r of plan.terminals.filter(r => r.how !== 'same')) { await FP.groups.setTerminal(r.id, r.how === 'new' ? r.want : Object.fromEntries(r.diff.map(k => [k, r.want[k]]))); n.terminals++; }
    // People: only in a test folder, each with the PIN the pack gives (or 6 digits picked here, to change at sign-in).
    if (plan.test) for (const r of plan.people.filter(r => r.how === 'new')) {
      const pin = /^\d{6}$/.test(String(r.x.pin || '')) ? String(r.x.pin) : null;
      const temp = pin === '918273' ? '918274' : '918273';
      const id = await FP.users.create({ name: r.x.name, department: r.x.department || '', roles: r.x.roles || ['user'], tempPin: pin ? temp : '918273' });
      if (pin) await FP.users.changePin(id, temp, pin);
      n.people++;
    }
    // Responsibility centers name groups and people by name in a pack; here they become their IDs.
    if ((plan.centers || []).some(r => r.how === 'new')) {
      FP.current.clearCache();
      const groups = await FP.groups.list().catch(() => []);
      const users = await FP.users.list(true).catch(() => []);
      const gid = x => { const g = groups.find(y => y.name.toLowerCase() === String(x).toLowerCase()) || groups.find(y => y.id === x); return g ? g.id : x; };
      const uid = x => { const u = users.find(y => y.name.toLowerCase() === String(x).toLowerCase()) || users.find(y => y.id === x); return u ? u.id : null; };
      const ref = r => (r.kind === 'group' ? Object.assign({}, r, { id: gid(r.id || r.name) }) : r.kind === 'person' ? Object.assign({}, r, { id: uid(r.id || r.name) }) : Object.assign({}, r, { id: r.id || r.name }));
      for (const r of plan.centers.filter(r => r.how === 'new')) {
        const m = r.x.members || {};
        const members = { people: (m.people || []).map(uid).filter(Boolean), role: m.role || null, departments: m.departments || [], signedInAt: (m.signedInAt || []).map(ref) };
        const duties = (r.x.duties || []).map(d => Object.assign({}, d, d.attach ? { attach: { kind: d.attach.kind, ids: (d.attach.ids || []).map(x => (d.attach.kind === 'group' ? gid(x) : x)) } } : {},
          { exclude: (d.exclude || []).map(ref).filter(x => x.id) }));
        await FP.centers.create({ name: r.x.name, members, duties });
        n.centers++;
      }
      // Ladders (0.62) name centers and people by name: set once every center is there.
      const cs = await FP.centers.list().catch(() => []);
      const cid = x => { const c = cs.find(y => y.name.toLowerCase() === String(x).toLowerCase()) || cs.find(y => y.id === x); return c ? c.id : null; };
      for (const r of plan.centers.filter(r => r.how === 'new' && Array.isArray(r.x.ladder) && r.x.ladder.length)) {
        const c = cs.find(y => y.name.toLowerCase() === String(r.x.name).toLowerCase());
        if (!c) continue;
        const ladder = r.x.ladder.map(l => Object.assign({ after: l.after || 0, tell: Object.assign({}, l.tell || {}, { centers: ((l.tell || {}).centers || []).map(cid).filter(Boolean), people: ((l.tell || {}).people || []).map(uid).filter(Boolean) }) }, l.ack ? { ack: true } : {}));
        ladder.forEach(l => { Object.keys(l.tell).forEach(k => { if (Array.isArray(l.tell[k]) && !l.tell[k].length) delete l.tell[k]; }); });
        await FP.centers.update(c.id, { ladder });
      }
    }
    return n;
  }
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  /* ---- The media library in a pack (F5) ----
   * library: { entries: [{ id, name, path, folder, tags, type, size, revision, note, file?: base64 }], tags: [{ name, list }] }
   * A form that shows a library entry needs the entry on the folder it is installed on. The pack carries each active entry its
   * forms use (named, or taken in by a tag rule), the tag names, and the file itself when it is small enough (2 MB each,
   * 12 MB in all); the rest are listed as "not carried", the entry is made without its file, and the file is added to
   * media/library/ by hand. Ids are kept; an entry with the same internal name already here is used instead and the forms
   * are pointed at it. */
  const LIB_FILE_MAX = 2 * 1024 * 1024, LIB_TOTAL_MAX = 12 * 1024 * 1024;
  const toB64 = async blob => { const b = new Uint8Array(await blob.arrayBuffer()); let t = ''; for (let i = 0; i < b.length; i += 0x8000) t += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(t); };
  const fromB64 = (t, type) => { const s2 = atob(t), b = new Uint8Array(s2.length); for (let i = 0; i < s2.length; i++) b[i] = s2.charCodeAt(i); return new Blob([b], { type: type || '' }); };
  const mediaLines = def => (def && Array.isArray(def.media) ? def.media : []).filter(m => m && typeof m === 'object');
  /* Point a form's media list at the entries here (when an entry went to a local one by name). */
  function remapDef(d, map) {
    if (!map.size || d.kind !== 'form' || !mediaLines(d.def).some(m => typeof m.entry === 'string' && map.has(m.entry))) return d;
    return Object.assign({}, d, { def: Object.assign({}, d.def, { media: d.def.media.map(m => (m && typeof m.entry === 'string' && map.has(m.entry) ? Object.assign({}, m, { entry: map.get(m.entry) }) : m)) }) });
  }
  /* What the pack's library would do: entry by entry new | same | remapped, and the id map for the forms. */
  async function libraryPlan(p) {
    const out = { entries: [], tags: [], map: new Map() };
    const lib = p.library || { entries: [], tags: [] };
    if (!FP.media || !FP.media.library || (!lib.entries.length && !lib.tags.length)) return out;
    await FP.media.library.load({ fresh: true }).catch(() => null);
    const here = FP.media.library.cached();
    for (const x of lib.entries) {
      const sameId = here.find(e => e.id === x.id);
      const named = sameId ? null : here.find(e => e.active && String(e.name).trim().toLowerCase() === String(x.name || '').trim().toLowerCase());
      if (named) out.map.set(x.id, named.id);
      out.entries.push({ x, how: sameId ? 'same' : named ? 'remapped' : 'new' });
    }
    const have = new Set(FP.media.library.tags().map(t => t.name));
    out.tags = lib.tags.map(t => ({ x: t, how: have.has(t.name) ? 'same' : 'new' }));
    return out;
  }
  async function installLibrary(p, plan) {
    const r = { entries: 0, tags: 0, files: 0, notCarried: [] };
    for (const t of plan.tags.filter(t => t.how === 'new')) { if (await FP.media.library.importTag(t.x.name, t.x.list)) r.tags++; }
    for (const e of plan.entries) {
      if (e.how === 'same' || e.how === 'remapped') continue;
      let blob = null;
      if (typeof e.x.file === 'string' && e.x.file) { try { blob = fromB64(e.x.file, e.x.type); } catch (_) { blob = null; } }
      const got = await FP.media.library.importEntry(e.x, blob);
      if (got.how === 'new') r.entries++;
      if (blob && got.file) r.files++;
      else if (!got.file) r.notCarried.push(e.x.name || e.x.id);
    }
    return r;
  }
  /* What installing would do: per definition new | changed | same; per structure how many items are new. */
  async function packPlan(p) {
    const defs = p.definitions.map(d => {
      const cur = FP.defs.get(d.kind, d.id);
      const builtIn = FP.defs.isBuiltIn(d.kind, d.id);
      return Object.assign({}, d, { cur, builtIn, how: builtIn ? 'built-in' : !cur || cur.retired ? 'new' : same(cur.def, d.def) ? 'same' : 'changed' });
    });
    const library = await libraryPlan(p);
    if (library.map.size) defs.forEach((d, i) => { const m = remapDef(d, library.map); if (m !== d) defs[i] = Object.assign(m, { how: !d.cur || d.cur.retired ? 'new' : same(d.cur.def, m.def) ? 'same' : 'changed' }); });
    const items = [];
    for (const [st, list] of Object.entries(p.items)) {
      if (!Array.isArray(list)) continue;
      const here = await FP.current.load(st, { fresh: true }).catch(() => null);
      const have = here ? here.items : new Map();
      const add = list.filter(x => x && x.id != null && !have.has(String(x.id)));
      items.push({ structure: st, all: list.length, add });
    }
    return { defs, items, library, setup: await setupPlan(p) };
  }
  async function installPack(p) {
    if (hasSetup(p) && !(await FP.users.can('admin'))) throw new Error('This pack sets up sites, groups and terminals: only an admin can install it.');
    // Items are written straight into structures (the built-in ones too: users, sites...), so they take an admin (F36).
    if (Object.values(p.items || {}).some(l => Array.isArray(l) && l.length) && !(await FP.users.can('admin'))) throw new Error('This pack adds items to structures: only an admin can install it.');
    const plan = await packPlan(p);
    // The media library entries, tag names and files the forms name go in first, so the forms can be published.
    const libDone = (plan.library.entries.length || plan.library.tags.length) ? await installLibrary(p, plan.library) : null;
    const todo = plan.defs.filter(d => d.how === 'new' || d.how === 'changed');
    // Functions, then structures, then forms; within that, whatever is refused for want of something else is tried again once that is in.
    const rank = { function: 0, structure: 1, form: 2 };
    let left = todo.slice().sort((a, b) => rank[a.kind] - rank[b.kind]);
    const done = [], failed = new Map();
    for (let pass = 0; left.length && pass < 6; pass++) {
      const next = [];
      for (const d of left) {
        try {
          const cur = FP.defs.get(d.kind, d.id);
          // A pack made before 0.48 may hold forms written the older way: brought up to date as they go in.
          if (d.kind === 'form' && FP.sources.upgrade) d.def = FP.sources.upgrade(d.def).def;
          await FP.defs.publish(d.kind, d.id, d.def, { basedOn: cur && !cur.retired ? cur.version : cur ? cur.version : null, note: `From the pack ${p.name || ''}`.trim() });
          done.push(d); failed.delete(d.kind + '/' + d.id);
        } catch (e) { failed.set(d.kind + '/' + d.id, e.message); next.push(d); }
      }
      if (next.length === left.length) break;
      left = next;
    }
    if (failed.size) throw new Error(`Installed ${done.length} of ${todo.length} definitions. Not installed: ${Array.from(failed.entries()).map(([k, m]) => `${k}: ${m}`).join(' · ')}`);
    // Items not here yet, as entries saved now.
    let added = 0;
    for (const it of plan.items) {
      if (!it.add.length) continue;
      if (!FP.structures.has(it.structure)) throw new Error(`The pack has items for ${it.structure}, which isn't a structure here.`);
      for (let i = 0; i < it.add.length; i += 200) {
        const chunk = it.add.slice(i, i + 200);
        await FP.entry.submit(async add => { for (const x of chunk) await add({ entry: `${it.structure}.import`, item: { structure: it.structure, id: String(x.id) }, values: Object.assign({}, x.values || {}) }); });
        added += chunk.length;
      }
    }
    FP.current.clearCache();
    // The setup last: groups and terminals name the forms just published.
    const setup = hasSetup(p) ? await installSetup(plan.setup) : null;
    if (FP.outbox) await FP.outbox.flush().catch(() => {});
    FP.current.clearCache();
    if (FP.editor.refreshMap) await FP.editor.refreshMap().catch(() => {});
    return { defs: done.length, same: plan.defs.filter(d => d.how === 'same').length, items: added, setup, library: libDone };
  }
  /* A pack of what is published here, with the items of the structures picked. */
  async function makePack(o) {
    const definitions = FP.defs.list().filter(d => PACK_KINDS.includes(d.kind) && !d.retired && !FP.defs.isBuiltIn(d.kind, d.id) && (!o.only || o.only.has(d.kind + '/' + d.id)))
      .map(d => ({ kind: d.kind, id: d.id, def: d.def }));
    const items = {};
    for (const st of o.structures || []) {
      const here = await FP.current.load(st, { fresh: true });
      items[st] = Array.from(here.items.values()).map(it => ({ id: it.id, values: FP.current.publicValues ? FP.current.publicValues(st, it.values) : it.values }));
      // Worked-out values aren't saved: the structure works them out again.
      const calc = Object.keys((FP.structures.get(st) || {}).calculated || {});
      items[st].forEach(x => calc.forEach(c => delete x.values[c]));
    }
    const pack = { fp: 'pack', v: 1, name: o.name || 'Pack', note: o.note || '', madeAt: new Date().toISOString(), kernel: FP.version, definitions, items };
    // The library entries the forms use, with their tag names and files (F5).
    if (FP.media && FP.media.library && definitions.some(d => d.kind === 'form' && mediaLines(d.def).some(m => m.entry || m.library))) {
      await FP.media.library.load({ fresh: true }).catch(() => null);
      const want = new Map();
      for (const d of definitions) if (d.kind === 'form') for (const m of mediaLines(d.def)) {
        if (typeof m.entry === 'string') { const e = FP.media.library.get(m.entry); if (e && e.active) want.set(e.id, e); }
        else if (m.library && typeof m.library === 'object') FP.media.library.cached().filter(e => e.active && FP.media.matches(e.tags, m.library)).forEach(e => want.set(e.id, e));
      }
      let total = 0;
      const entries = [];
      for (const e of want.values()) {
        const x = { id: e.id, name: e.name, path: e.path, folder: e.folder, tags: e.tags, type: e.type, size: e.size, revision: e.revision, note: e.note };
        const f = e.path ? await FP.media.file(e.path).catch(() => null) : null;
        if (f && f.size <= LIB_FILE_MAX && total + f.size <= LIB_TOTAL_MAX) { x.file = await toB64(f); total += f.size; }
        entries.push(x);
      }
      const names = new Set(entries.flatMap(e => Object.keys(e.tags || {})));
      for (const d of definitions) if (d.kind === 'form') for (const m of mediaLines(d.def)) if (m.library && typeof m.library === 'object') Object.keys(m.library).forEach(k => names.add(k));
      if (entries.length) pack.library = { entries, tags: FP.media.library.tags().filter(t => names.has(t.name)).map(t => ({ name: t.name, list: t.list || '' })) };
    }
    // Where the forms go (0.52): the sites, their groups and the terminals in none, with their settings.
    if (o.setup) {
      const sites = (await FP.sites.list()).filter(x => x.active);
      const groups = await FP.groups.list();
      const ts = await FP.groups.terminals();
      const reg = await FP.identity.all().catch(() => []);
      const grouped = new Set(groups.flatMap(g => g.terminals));
      pack.setup = {
        sites: sites.map(x => ({ id: x.id, name: x.name })),
        groups: groups.map(g => Object.assign({ name: g.name, site: g.site, terminals: o.terminals === false ? [] : g.terminals, forms: g.forms }, pick(g, ['homeForm', 'view', 'signIn', 'signedInFor', 'for']))),
        terminals: Array.from(ts.values()).filter(t => !grouped.has(t.id) && (t.forms.length || t.homeForm || t.view || t.for)).map(t => Object.assign({ id: t.id, site: ((reg.find(r => r.terminalId === t.id) || {}).site) || null, forms: t.forms }, t.name ? { name: t.name } : {}, pick(t, SETTINGS))),
        people: [],
      };
      // People, for a test folder only: name, department and role, with one PIN for all of them (no PIN of anyone's leaves here).
      if (o.people && /^\d{6}$/.test(String(o.pin || ''))) pack.setup.people = (await FP.users.list()).filter(u => u.active).map(u => ({ name: u.name, department: u.department || '', roles: u.roles, pin: String(o.pin) }));
      // Responsibility centers (0.56), with groups and people by name, so they mean the same in another folder.
      if (FP.centers) {
        const users = await FP.users.list().catch(() => []);
        const gname = id => (groups.find(g => g.id === id) || {}).name || id;
        const uname = id => (users.find(u => u.id === id) || {}).name || id;
        const named = r => (r.kind === 'group' ? Object.assign({}, r, { id: gname(r.id) }) : r.kind === 'person' ? Object.assign({}, r, { id: uname(r.id) }) : r);
        const allC = await FP.centers.list();
        const cname = id => (allC.find(c => c.id === id) || {}).name || id;
        pack.setup.centers = allC.map(c => ({ name: c.name,
          ladder: (c.ladder || []).map(l => Object.assign({ after: l.after, tell: Object.assign({}, l.tell, { centers: (l.tell.centers || []).map(cname), people: (l.tell.people || []).map(uname) }) }, l.ack ? { ack: true } : {})),
          members: { people: c.members.people.map(uname), role: c.members.role, departments: c.members.departments, signedInAt: c.members.signedInAt.map(named) },
          duties: c.duties.map(d => Object.assign({}, d, d.attach ? { attach: { kind: d.attach.kind, ids: (d.attach.ids || []).map(x => (d.attach.kind === 'group' ? gname(x) : x)) } } : {}, { exclude: (d.exclude || []).map(named) })) }));
      }
    }
    return pack;
  }
  FP.packs = { read: readPack, plan: packPlan, install: installPack, make: makePack, isTestFolder };

  async function packsPart(again, st) {
    const structures = FP.defs.list('structure').filter(d => !d.retired && !FP.defs.isBuiltIn('structure', d.id));
    let plan = null;
    if (st.pack) plan = await packPlan(st.pack).catch(e => ({ error: e.message }));
    return view({
      build(a, box) {
        a.head(box, 'Install a pack', 'definitions and starting records made elsewhere, in one file');
        a.row(box, { key: 'pick', depth: 1, color: 'var(--d-blue-50)', title: () => (st.pack ? `${st.pack.name || 'Pack'}` : 'Choose a pack file…'), sub: () => (st.pack ? `${st.pack.definitions.length} definitions · ${Object.values(st.pack.items).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0)} items${st.pack.note ? ' · ' + st.pack.note : ''}` : 'a .json file made with Make a pack'),
          props: p => {
            const i = input('', { type: 'file' }); i.accept = '.json,application/json';
            i.onchange = async () => { const f = i.files && i.files[0]; if (!f) return; try { st.pack = readPack(await f.text()); again(); } catch (e) { toast(e.message, true); } };
            p.appendChild(set('Pack file', 'made with Make a pack, here or in another data folder', i));
          } });
        if (plan && plan.error) box.appendChild(el('div', 'fpe-warn', plan.error));
        if (plan && !plan.error) {
          const tagOf = h => ({ new: ['new', 'var(--d-green-95)'], changed: ['replaces the one here', 'var(--d-amber-96)'], same: ['already here', 'var(--d-n-95)'], 'built-in': ['built in: skipped', 'var(--d-n-95)'] })[h];
          PACK_KINDS.forEach(k => plan.defs.filter(d => d.kind === k).forEach(d => a.row(box, { key: `d:${k}/${d.id}`, depth: 2, color: { function: 'var(--d-violet-43)', structure: 'var(--d-teal-45)', form: 'var(--d-blue-50)' }[k],
            title: () => (d.def.title || d.def.label || d.id), sub: () => `${FP.defs.LABELS[k]} ${d.id}${d.cur ? ` · here: version ${d.cur.version}` : ''}`, tags: () => [a.tag(...tagOf(d.how))] })));
          plan.items.forEach(it => a.row(box, { key: 'i:' + it.structure, depth: 2, color: 'var(--d-amber-47)', title: () => `${it.structure}: ${it.all} item${it.all === 1 ? '' : 's'}`,
            sub: () => (it.add.length ? `${it.add.length} new; ${it.all - it.add.length} already here (left as they are)` : 'all already here'), tags: () => [a.tag(it.add.length ? `${it.add.length} to add` : 'nothing to add', it.add.length ? 'var(--d-green-95)' : 'var(--d-n-95)')] }));
          // Where the forms go (0.52): sites, groups, terminals, and people for a test folder.
          const su = plan.setup;
          const sTag = r => a.tag(...({ new: ['new', 'var(--d-green-95)'], changes: ['brought up to the pack', 'var(--d-amber-96)'], same: ['already here', 'var(--d-n-95)'], skipped: ['left out: not a test folder', 'var(--d-n-95)'] })[r.how]);
          const setupRows = su.sites.length + su.groups.length + su.terminals.length + su.people.length + (su.centers || []).length;
          if (setupRows) {
            a.head(box, 'Where the forms go', su.test ? 'sites, terminal groups and terminals; people too, as this is a test folder' : 'sites, terminal groups and terminals; no people, as this isn\'t a test folder');
            su.sites.forEach(r => a.row(box, { key: 's:' + r.x.id, depth: 2, color: 'var(--d-teal-45)', title: () => r.x.name || r.x.id, sub: () => `site ${r.x.id}`, tags: () => [sTag(r)] }));
            su.groups.forEach(r => a.row(box, { key: 'g:' + r.x.site + ':' + r.x.name, depth: 2, color: 'var(--d-n-48)', title: () => r.x.name,
              sub: () => [`group at ${r.x.site}`, `${(r.x.forms || []).length} forms`, (r.x.terminals || []).length ? (r.x.terminals || []).join(', ') : 'no terminals', r.x.homeForm && r.x.homeForm !== 'none' ? `home ${r.x.homeForm}` : null, r.x.view ? `${r.x.view} view` : null, r.x.signIn === 'supervisors' ? 'supervisors sign in' : null, r.diff && r.diff.length ? `changes ${r.diff.join(', ')}` : null].filter(Boolean).join(' · '),
              tags: () => [sTag(r)] }));
            su.terminals.forEach(r => a.row(box, { key: 't:' + r.id, depth: 2, color: 'var(--d-n-36)', title: () => `${r.id}${r.x.name ? ' ' + r.x.name : ''}`,
              sub: () => [`terminal${r.x.site ? ' at ' + r.x.site : ''}`, `${(r.x.forms || []).length} forms`, r.inGroup ? `in ${r.inGroup.name} here: its group's forms count` : null, r.diff && r.how === 'changes' ? `changes ${r.diff.join(', ')}` : null].filter(Boolean).join(' · '), tags: () => [sTag(r)] }));
            su.people.forEach(r => a.row(box, { key: 'p:' + r.x.name, depth: 2, color: 'var(--d-violet-45)', title: () => r.x.name, sub: () => `${(r.x.roles || ['user']).join(', ')}${r.x.pin ? ' · with the pack\'s PIN' : ' · PIN 918273, changed at first sign-in'}`, tags: () => [sTag(r)] }));
            (su.centers || []).forEach(r => a.row(box, { key: 'c:' + r.x.name, depth: 2, color: 'var(--d-teal-45)', title: () => r.x.name, sub: () => `responsibility center · ${(r.x.duties || []).length} dut${(r.x.duties || []).length === 1 ? 'y' : 'ies'}`, tags: () => [sTag(r)] }));
          }
          const setupN = su.sites.filter(r => r.how === 'new').length + su.groups.filter(r => r.how !== 'same').length + su.terminals.filter(r => r.how !== 'same').length + su.people.filter(r => r.how === 'new').length + (su.centers || []).filter(r => r.how === 'new').length;
          const n = plan.defs.filter(d => d.how === 'new' || d.how === 'changed').length, m = plan.items.reduce((x, it) => x + it.add.length, 0);
          a.addRow(box, '+install', n + m + setupN ? `+ install: ${n} definition${n === 1 ? '' : 's'}, ${m} item${m === 1 ? '' : 's'}${setupN ? `, ${setupN} site, group, terminal or person change${setupN === 1 ? '' : 's'}` : ''}` : '+ nothing to install: it is all here', 0, null, () => {
            if (!(n + m + setupN)) return;
            if (!confirm(`Install ${st.pack.name || 'the pack'}? ${n} definition${n === 1 ? ' is' : 's are'} published (a changed one gets a new version; History can go back) and ${m} item${m === 1 ? ' is' : 's are'} added, saved by you.`)) return;
            act(() => installPack(st.pack), r => `Installed: ${r.defs} definition${r.defs === 1 ? '' : 's'} published, ${r.items} item${r.items === 1 ? '' : 's'} added${r.same ? `, ${r.same} already here` : ''}${r.setup ? `; ${r.setup.sites} site${r.setup.sites === 1 ? '' : 's'}, ${r.setup.groups} group${r.setup.groups === 1 ? '' : 's'}, ${r.setup.terminals} terminal${r.setup.terminals === 1 ? '' : 's'}${r.setup.people ? `, ${r.setup.people} ${r.setup.people === 1 ? 'person' : 'people'}` : ''}${r.setup.centers ? `, ${r.setup.centers} responsibility center${r.setup.centers === 1 ? '' : 's'}` : ''} set up` : ''}${r.library && (r.library.entries || r.library.tags) ? `; ${r.library.entries} media library entr${r.library.entries === 1 ? 'y' : 'ies'} added` : ''}.${r.library && r.library.notCarried.length ? ` Not carried (add the file to media/library by hand): ${r.library.notCarried.join(', ')}.` : ''}`, () => { st.pack = null; return again(); });
          });
        }
        a.head(box, 'Make a pack', 'every form, structure and function published here, and the items of the structures you tick');
        a.row(box, { key: 'make', depth: 1, color: 'var(--d-teal-45)', title: () => 'Make a pack…', sub: () => `${FP.defs.list().filter(d => PACK_KINDS.includes(d.kind) && !d.retired && !FP.defs.isBuiltIn(d.kind, d.id)).length} definitions`,
          props: p => {
            const name = input(st.name || '', { placeholder: 'e.g. Production pilot' });
            name.oninput = () => { st.name = name.value; };
            p.appendChild(set('Name', 'shown when someone installs it', name));
            st.with = st.with || new Set();
            const ticks = el('div', 'fpa-roles');
            structures.forEach(d => { const l = el('label'); const c = input('', { type: 'checkbox' }); c.checked = st.with.has(d.id); c.onchange = () => { if (c.checked) st.with.add(d.id); else st.with.delete(d.id); }; l.append(c, document.createTextNode(d.def.label || d.id)); ticks.appendChild(l); });
            p.appendChild(set('With the items of', 'starting records, like a profile list; records saved later are better left out', structures.length ? ticks : el('span', 'fpe-hint', 'No structures yet')));
            // Where the forms go (0.52).
            if (st.setup == null) st.setup = true;
            const sl = el('label', 'ffe-check'); const sc = input('', { type: 'checkbox' }); sc.checked = st.setup; sc.onchange = () => { st.setup = sc.checked; again(); };
            sl.append(sc, document.createTextNode('Sites, terminal groups and terminals, with their forms and settings'));
            const pl = el('label', 'ffe-check'); const pc = input('', { type: 'checkbox' }); pc.checked = !!st.people; pc.disabled = !st.setup; pc.onchange = () => { st.people = pc.checked; again(); };
            pl.append(pc, document.createTextNode('People, for a test folder: everyone gets the PIN below'));
            const pin = input(st.pin || '', { placeholder: '6 digits', inputMode: 'numeric', autocomplete: 'off' }); pin.maxLength = 6; pin.oninput = () => { st.pin = pin.value; };
            const sw = el('div'); sw.append(sl, pl); if (st.people) sw.appendChild(pin);
            p.appendChild(set('Where the forms go', 'installed on another folder, it sets up the same sites, groups and terminals; people only go into a test folder', sw));
            p.appendChild(btn('Download the pack', 'primary', () => act(async () => {
              if (st.people && !/^\d{6}$/.test(String(st.pin || ''))) throw new Error('Give the people a 6-digit PIN for the test folder.');
              const pack = await makePack({ name: st.name, structures: Array.from(st.with), setup: st.setup, people: st.people, pin: st.pin });
              const blob = new Blob([JSON.stringify(pack, null, 1)], { type: 'application/json' });
              const an = el('a'); an.href = URL.createObjectURL(blob); an.download = `${String(st.name || 'pack').replace(/[^A-Za-z0-9 _-]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'pack'}.json`;
              document.body.appendChild(an); an.click(); setTimeout(() => { URL.revokeObjectURL(an.href); an.remove(); }, 1000);
              return pack;
            }, pk => `Pack made: ${pk.definitions.length} definitions, ${Object.values(pk.items).reduce((x, l) => x + l.length, 0)} items.`)));
          } });
      },
      right(prev) {
        header(prev, 'Packs');
        prev.appendChild(side('A pack carries forms, structures and functions, and the items of the structures you choose, from one data folder to another: a pilot built on a test folder, installed on the real one.',
          el('h4', null, 'Installing'), 'Each definition is published here: a new one, or a new version of one that differs (History can go back). Items already here are left as they are; new ones are added as saved by you. Nothing is deleted.',
          el('h4', null, 'Where the forms go'), 'A pack can carry its sites, terminal groups and terminals in no group, with their forms, home form, view and who signs in. Installing adds what isn\'t here and brings a group or terminal of the same name up to the pack\'s settings; a group keeps forms and terminals the pack doesn\'t name. Installing them takes an admin.',
          el('h4', null, 'People'), 'Only into a folder marked as a test folder, each with the PIN the pack gives, so a pilot can be tried at once. In a real folder they are left out: people are added there one by one, each choosing their own PIN.',
          el('h4', null, 'Not in a pack'), 'Media files, records saved since, and anyone\'s own PIN.'));
      },
    });
  }

  async function cleanupPart(again) {
    const L = leftovers();
    L.rules = [];   // media rules are gone (0.42)
    L.orphans = await subOrphans().catch(() => []);
    // Forms written the older ways (0.48): before sources, with a form-level Name of its saves, or Open / Apply buttons.
    L.older = FP.defs.list('form').filter(d => !d.retired && d.def && (!Array.isArray(d.def.sources) || d.def.action));
    L.opens = FP.defs.list('form').filter(d => !d.retired && d.def && (d.def.buttons || []).some(b => b && (b.action === 'open' || b.action === 'apply')));
    // Forms set to home (before 0.51): the terminal or group picks its home form now.
    L.homes = FP.defs.list('form').filter(d => !d.retired && d.def && d.def.home);
    const hGroups = L.homes.length ? await FP.groups.list().catch(() => []) : [];
    const hTerms = L.homes.length ? await FP.groups.terminals().catch(() => new Map()) : new Map();
    const lone = id => !hGroups.some(g => g.terminals.includes(id));
    const homeTargets = d => hGroups.filter(g => g.forms.includes(d.id) && g.homeForm == null).map(g => ({ kind: 'group', id: g.id, name: g.name }))
      .concat(Array.from(hTerms.values()).filter(t => lone(t.id) && t.forms.includes(d.id) && t.homeForm == null).map(t => ({ kind: 'terminal', id: t.id, name: t.id + (t.name ? ' ' + t.name : '') })));
    const moveHome = async d => {
      const to = homeTargets(d);
      for (const x of to) {
        if (x.kind === 'group') await FP.groups.update(x.id, { homeForm: d.id });
        else await FP.groups.setTerminal(x.id, { homeForm: d.id });
        const g = hGroups.find(y => y.id === x.id); if (g) g.homeForm = d.id;
        const t = hTerms.get(x.id); if (t && x.kind === 'terminal') t.homeForm = d.id;
      }
      const def = JSON.parse(JSON.stringify(d.def)); delete def.home;
      await FP.defs.publish('form', d.id, def, { basedOn: d.version, note: `Home screen moved to ${to.length ? to.map(x => x.name).join(', ') : 'no terminal'} (0.51)` });
      return to.length;
    };
    // The Unused finder (0.66): definitions nothing active uses. A form a launcher shortcut names counts as in use.
    const named = new Set((await FP.launchers.list().catch(() => [])).map(f => f.form).filter(Boolean));
    const U = (await FP.defs.unused().catch(() => [])).filter(u => !(u.kind === 'form' && named.has(u.id)));
    const canRetire = !!(FP.users && await FP.users.can(FP.defs.publishRole).catch(() => false));
    const retireOne = async u => { await FP.defs.retire(u.kind, u.id, { note: 'Unused: retired from Admin > Clean-up' }); };
    const calcOn = new Map(L.plans.map(p => [p.doc.id, true]));
    const none = !L.types.length && !L.structures.length && !L.forms.length && !L.rules.length && !L.orphans.length && !L.older.length && !L.opens.length && !L.homes.length;
    return view({
      build(a, box) {
        if (none) { a.head(box, 'Nothing to clean up', 'nothing is left from sessions'); box.appendChild(el('p', 'ffe-note', 'No session types, no structures naming sessions, no forms reading something every shift, and no sub-form records left over.')); }
        a.head(box, 'Unused finder', 'definitions nothing active uses: forms on no terminal and no shortcut, structures no form writes to, functions nothing calls');
        if (!U.length) box.appendChild(el('p', 'ffe-note', 'Nothing unused.'));
        [['form', 'Forms'], ['structure', 'Structures'], ['function', 'Formulas']].forEach(([kind, label]) => {
          const rows = U.filter(u => u.kind === kind);
          if (!rows.length) return;
          a.head(box, label, `${rows.length} unused`);
          rows.forEach(u => a.row(box, { key: 'u:' + kind + ':' + u.id, depth: 1, color: 'var(--d-n-66)', title: () => u.name,
            sub: () => `${u.id} · ${u.why}`,
            props: p => {
              if (canRetire) p.appendChild(btn('Retire', 'small', () => act(() => retireOne(u), `${u.name} is retired.`, again)));
              else p.appendChild(el('p', 'ffe-note', 'Only a publisher can retire it.'));
            } }));
          if (canRetire && rows.length > 1) a.addRow(box, '+retire:' + kind, `+ retire all ${rows.length} shown`, 0, null, () => {
            if (!confirm(`Retire ${rows.length} ${label.toLowerCase()}? ${rows.map(u => u.name).join(', ')}. An admin can reinstate them.`)) return;
            act(async () => {
              let n = 0;
              for (const u of rows) { try { await retireOne(u); n++; } catch (e) { if (!n) throw e; throw new Error(`${n} retired, then ${u.name}: ${e.message}`); } }
              return n;
            }, n => `${n} retired.`, again);
          });
        });
        if (L.older.length) {
          a.head(box, 'Older forms', 'written before sources, or naming their saves on the form: each gets a new version that saves the same way');
          const upgradeOne = async d => {
            const u = FP.sources.upgrade(d.def);
            await FP.defs.publish('form', d.id, u.def, { basedOn: d.version, note: `Brought up to date (0.48): ${u.changes.join('; ')}` });
          };
          L.older.forEach(d => a.row(box, { key: 'o:' + d.id, depth: 1, color: 'var(--d-blue-50)', title: () => d.def.title || d.id,
            sub: () => [!Array.isArray(d.def.sources) ? 'before sources' : null, d.def.action ? `its saves are named ${d.def.action} on the form` : null].filter(Boolean).join(' · '),
            props: p => p.appendChild(btn('Bring it up to date', 'small', () => act(() => upgradeOne(d), `${d.def.title || d.id} is up to date.`, again))) }));
          if (L.older.length > 1) a.addRow(box, '+older', `+ bring all ${L.older.length} up to date`, 0, null, () => act(async () => { let n = 0; for (const d of L.older) { await upgradeOne(d); n++; } return n; }, n => `${n} form${n === 1 ? '' : 's'} brought up to date.`, again));
        }
        if (L.homes.length) {
          a.head(box, 'Forms set to show on the home screen', 'each terminal or group picks its home form now (0.51): this moves the setting there and takes it off the form');
          L.homes.forEach(d => a.row(box, { key: 'h:' + d.id, depth: 1, color: 'var(--d-blue-50)', title: () => d.def.title || d.id,
            sub: () => { const to = homeTargets(d); return to.length ? `becomes the home form of ${to.map(x => x.name).join(', ')}` : 'no terminal or group without a home form has it: just taken off the form'; },
            props: p => p.appendChild(btn('Move it to its terminals', 'small', () => act(() => moveHome(d), n => `${d.def.title || d.id}: the home form of ${n} group${n === 1 ? '' : 's'} or terminal${n === 1 ? '' : 's'} now.`, again))) }));
        }
        if (L.opens.length) {
          a.head(box, 'Open and Apply buttons', 'gone (0.48): these forms keep working, but can\'t be published again until each becomes a sub-form');
          L.opens.forEach(d => a.row(box, { key: 'b:' + d.id, depth: 1, color: 'var(--d-amber-47)', title: () => d.def.title || d.id,
            sub: () => (d.def.buttons || []).filter(b => b && (b.action === 'open' || b.action === 'apply')).map(b => `${b.label || b.name} (${b.action === 'open' ? `opens ${b.form}` : 'apply'})`).join(', '),
            props: p => p.appendChild(el('p', 'ffe-note', 'Open the form in the editor, add a sub-form for what the button opened (its fields, and where they save), and point the button at it. Apply buttons go: a sub-form hands its values back by itself.')) }));
        }
        if (L.orphans.length) {
          a.head(box, 'Sub-form records', 'saved on their own, pointing at a record that was never saved');
          const users = L.users || new Map();
          L.orphans.forEach((o, i) => a.row(box, { key: 'or:' + i, depth: 1, color: 'var(--d-red-40)', title: () => `${o.structure} ${o.id}`,
            sub: () => `from ${o.form} › ${o.sub} · points at ${o.ref} (${o.role}), not saved · ${new Date(o.at).toLocaleString()}${users.get(o.userId) ? ' · ' + users.get(o.userId) : ''}`,
            props: p => p.appendChild(el('p', 'ffe-note', `This record was saved from the sub-form ${o.sub} while ${o.form} was open, and ${o.form} was never saved (or not yet: it may still be open on a terminal). Find it in Records › ${o.structure} to correct it, or save the ${o.role} record it points at.`)) }));
        }
        if (L.plans.length) {
          a.head(box, 'Structures that still name sessions', 'each gets a new version without them');
          L.plans.forEach(pl => {
            const d = pl.doc;
            a.row(box, { key: 's:' + d.id, depth: 1, color: 'var(--d-teal-45)', title: () => (d.def.label || d.id),
              sub: () => `${d.id} · ${Object.entries(d.def.sessions).map(([t, raw]) => `${t} (${raw && typeof raw === 'object' ? raw.mode : raw})`).join(', ')}${pl.calc.length && calcOn.get(d.id) ? ` · ${pl.calc.map(c => c.name).join(', ')} becomes a calculated value` : ''}`,
              props: p => {
                if (pl.calc.length) {
                  const l = el('label', 'ffe-check'); const c = input('', { type: 'checkbox' }); c.checked = calcOn.get(d.id);
                  c.onchange = () => { calcOn.set(d.id, c.checked); a.soft(); };
                  l.append(c, document.createTextNode(`Keep ${pl.calc.map(x => x.name).join(' and ')} as a calculated value, worked out from when each item was first saved`));
                  p.appendChild(l);
                  pl.calc.forEach(x => p.appendChild(set(`${x.fn}(at)`, 'a function made from the old time table', el('code', 'fpe-hint', x.formula))));
                }
                p.appendChild(btn('Take the sessions out', 'small', () => act(() => fixStructure(pl, calcOn.get(d.id)), `${d.def.label || d.id} no longer names sessions.`, again)));
              } });
          });
        }
        if (L.forms.length) {
          a.head(box, 'Forms that ask to read something every shift', 'every 12 hours instead');
          L.forms.forEach(d => a.row(box, { key: 'f:' + d.id, depth: 1, color: 'var(--d-blue-50)', title: () => d.def.title || d.id,
            sub: () => d.def.acknowledge.filter(x => x && x.every === 'shift').map(x => x.label || x.name).join(', '),
            props: p => p.appendChild(btn('Read every 12 hours', 'small', () => act(() => fixForm(d), `${d.def.title || d.id} asks every 12 hours.`, again))) }));
        }
        if (L.types.length) {
          a.head(box, 'Session types', 'retired: nothing uses them now');
          L.types.forEach(d => a.row(box, { key: 't:' + d.id, depth: 1, color: 'var(--d-n-66)', title: () => d.id,
            sub: () => [d.def.label, d.def.fallback && Array.isArray(d.def.fallback.rows) ? `time table ${d.def.fallback.rows.map(r => `${r.value} ${r.start}–${r.end}`).join(', ')}` : null, d.def.within ? `within ${d.def.within}` : null].filter(Boolean).join(' · '),
            props: p => p.appendChild(btn('Retire it', 'small', () => act(() => retireType(d), `Session type ${d.id} is retired.`, again))) }));
        }
        if (L.structures.length + L.forms.length + L.types.length + L.rules.length) a.addRow(box, '+all', '+ clean up everything above', 0, null, () => {
          const n = L.structures.length + L.forms.length + L.types.length + L.rules.length;
          if (!confirm(`Clean up ${n} definition${n === 1 ? '' : 's'}? Each gets a new version (History can go back). Saved records are not changed.`)) return;
          act(async () => {
            for (const pl of L.plans) await fixStructure(pl, calcOn.get(pl.doc.id));
            for (const d of L.forms) await fixForm(d);
            for (const d of L.types) await retireType(d);
            return n;
          }, k => `${k} definition${k === 1 ? '' : 's'} cleaned up. Nothing is left from sessions.`, again);
        });
      },
      right(prev) {
        header(prev, 'What replaced sessions');
        const dl = el('dl');
        [['A run', 'An ordinary item of a Runs structure with a status (Running, Done). A form finds the run that is on with a source whose ID is "Found by a rule", e.g. the latest where AND(status = "Running", line = form.line); saving waits until one is running.'],
          ['A shift', 'Worked out from when a save happened: HOUR(at) in a formula, or a calculated value on the structure. Clean-up turns an old shift time table into a function (ShiftAt) and a calculated value shift, worked out from when each item was first saved.'],
          ['A lot', 'A value the form saves (a field, or a source of a Lots structure), like anything else.'],
          ['Read every shift', 'Every so many hours (hours 12 for a 12-hour shift), or every day.']]
          .forEach(([t, d]) => dl.append(el('dt', null, t), el('dd', null, d)));
        prev.appendChild(side(dl, el('h4', null, 'Saved records'), 'Nothing saved is changed. Entries saved while sessions were on keep their shift, run and lot references, and the Records part shows them as they were.'));
      },
    });
  }

  /* ---------- The page ---------- */
  async function admin(host, opts) {
    opts = opts || {};
    injectCss();
    host.replaceChildren();
    const page = el('div', 'fpe');
    host.appendChild(page);
    const head = el('div', 'fpa-head');
    head.appendChild(el('h2', null, 'Admin'));
    const tabs = el('div', 'fpa-tabs');
    head.appendChild(tabs);
    page.appendChild(head);
    const body = el('div');
    page.appendChild(body);
    const me = await FP.users.current();
    const isAdmin = await FP.users.can('admin');
    if (!isAdmin) {
      body.appendChild(el('div', 'fpe-note', `This page is for admins. You are signed in as ${me ? me.name : 'nobody'}.`));
      return { isDirty: () => false };
    }
    const shown = SECTIONS;
    let section = opts.section && shown.some(([k]) => k === opts.section) ? opts.section : null;
    if (!section) { try { section = localStorage.getItem('fpa-section'); } catch (_) { section = null; } }
    if (!shown.some(([k]) => k === section)) section = shown[0][0];
    const recState = {};
    const packState = {};
    const BUILD = { launchers: launchersPart, updates: updatesPart, records: again => recordsPart(again, recState), due: duePart, speed: speedPart, packs: again => packsPart(again, packState), cleanup: cleanupPart, purge: purgePart, stress: stressPart, test: testPart };
    let seq = 0;
    async function paint() {
      tabs.replaceChildren(...shown.map(([k, t]) => btn(t, k === section ? 'on' : '', () => { section = k; try { localStorage.setItem('fpa-section', k); } catch (_) { /* best effort */ } if (opts.onSection) opts.onSection(k); paint(); })));
      const my = ++seq;
      body.replaceChildren(el('p', 'ffe-note', 'Loading…'));
      try {
        const node = await BUILD[section](paint);
        if (my === seq) body.replaceChildren(node);
      } catch (e) { if (my === seq) body.replaceChildren(el('div', 'fpe-warn', e.message)); }
    }
    await paint();
    return { isDirty: () => false, section: () => section };
  }

  FP.editor.admin = admin;

  /* ---------- Due (0.54): every form's schedules, and the checks missed in the last two weeks ----------
   * A miss is kept for good; a supervisor can excuse it with a reason (it stays, marked excused). */
  async function duePart(again) {
    const box = el('div');
    // Responsibility centers (0.56): each one's duties; then forms that still keep their own schedules.
    const centers = FP.centers ? await FP.centers.list().catch(() => []) : [];
    box.appendChild(el('h3', null, 'Responsibility centers'));
    if (!centers.length) box.appendChild(el('p', 'ffe-note', 'None yet. On the map, People › Responsibility centers › + responsibility center (or + Add).'));
    centers.forEach(c => {
      const card = el('div', 'fpa-card');
      card.appendChild(el('b', null, c.name));
      if (!c.duties.length) card.appendChild(el('div', 'ffe-note', 'No duties.'));
      c.duties.forEach(d => card.appendChild(el('div', 'ffe-note', `${d.name}: ${FP.due.describe(d)} Done by ${(d.forms || []).map(formTitle).join(' or ')}.`)));
      box.appendChild(card);
    });
    const users = await FP.users.list().catch(() => []);
    const away = users.filter(u => u.active && u.awayFrom && (!u.awayTo || u.awayTo >= new Date().toISOString().slice(0, 10)));
    if (away.length) box.appendChild(el('p', 'ffe-note', `Away (left out of every center): ${away.map(u => `${u.name} ${u.awayFrom}${u.awayTo ? ' to ' + u.awayTo : ' on'}${u.awayNote ? ' (' + u.awayNote + ')' : ''}`).join(' · ')}`));
    const forms = FP.defs.list('form').filter(d => !d.retired && d.def && Array.isArray(d.def.due) && d.def.due.length);
    if (forms.length) box.appendChild(el('h3', null, 'Forms with their own schedules (0.54): move them into a center from the form\'s settings'));
    forms.forEach(d => {
      const card = el('div', 'fpa-card');
      card.appendChild(el('b', null, d.def.title || d.id));
      d.def.due.forEach(sc => card.appendChild(el('div', 'ffe-note', `${sc.name}: ${FP.due.describe(sc)}`)));
      box.appendChild(card);
    });
    const list = await FP.due.misses(14);
    box.appendChild(el('h3', null, `Missed in the last two weeks: ${list.length}`));
    if (!list.length) { box.appendChild(el('p', 'ffe-note', 'None.')); return box; }
    const t = el('table', 'fpa-table');
    const hr = el('tr'); ['Due by', 'Form', 'Where', 'Responsible', '', ''].forEach(x => hr.appendChild(el('th', null, x))); t.appendChild(hr);
    list.forEach(m => {
      const tr = el('tr');
      tr.dataset.slot = m.id;
      tr.append(el('td', null, new Date(m.dueBy).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })),
        el('td', null, `${m.title || m.form}${m.schedule ? ' · ' + m.schedule : ''}${m.centerName ? ' · ' + m.centerName : ''}`), el('td', null, m.item || m.where || ''),
        el('td', null, m.responsible || ''), el('td', null, m.critical ? 'critical' : ''));
      const act = el('td');
      if (m.excusedReason) act.textContent = `Excused by ${m.excusedBy || 'a supervisor'}: ${m.excusedReason}`;
      else {
        const why = input('', { placeholder: 'Why (e.g. line down)', autocomplete: 'off' });
        act.append(why, btn('Excuse', 'small', () => act(async () => { await FP.due.excuse({ id: m.id, formId: m.form, recorded: true }, why.value); }, 'Excused: it stays on record, marked excused.', again)));
      }
      tr.appendChild(act);
      t.appendChild(tr);
    });
    box.appendChild(t);
    return box;
  }

  /* ---------- Test folder (0.53): mark or unmark this data folder, from here instead of File Explorer ----------
   * A test folder may be purged, run the stress test, open simulated terminals and take a pack's people. Marking
   * one takes an admin typing the folder's name, so a real folder isn't marked by a slip; every launcher and the
   * editor then say TEST FOLDER in their top bar, so nobody takes it for the real one. */
  async function markTest() {
    const u = await FP.users.current();
    await FP.files.writeText([], TEST_MARK, `This data folder is a test folder.\r\nMarked by ${u ? u.name : 'an admin'} on ${new Date().toLocaleString()}, from the editor (Admin > Test folder).\r\nOn a test folder: Purge all data, the stress test, simulated terminals (launch.html?terminal=T02), and a pack's people.\r\nDelete this file, or use Admin > Test folder, to make it an ordinary folder again.\r\n`);
  }
  /* ---------- A responsibility rehearsal (0.62, test folders) ----------
   * Walks an admin through a missed duty climbing its center's ladder, without waiting: the test clock jumps ahead, this
   * page notices for the terminal (as the terminal would, once a minute), and each person's launcher opens in a tab,
   * signed in without a PIN while the rehearsal allows it. */
  const reh = { center: null, terminal: null, last: null };
  const MINUTE = 60000;
  async function rehearsalPart() {
    const d = el('div', 'fpa-reh');
    d.appendChild(el('h3', null, 'Responsibility rehearsal'));
    d.appendChild(el('p', 'ffe-note', 'See a missed duty climb a responsibility center\'s ladder, and what each person sees, without waiting: the test clock jumps ahead for every tab on this folder. Install the production pilot pack for a ready-made one (Line operators\' hourly check: the line, then Shift supervisors, Quality techs and Plant management).'));
    const centers = FP.centers ? await FP.centers.list().catch(() => []) : [];
    const withLadder = centers.filter(c => c.ladder.length && c.duties.length);
    if (!withLadder.length) { d.appendChild(el('div', 'fpe-warn', 'No responsibility center here has both a duty and a ladder yet. Install the production pilot pack (Admin › Packs), or give a center a ladder (People › Responsibility centers).')); return d; }
    if (!reh.center || !withLadder.some(c => c.id === reh.center)) reh.center = withLadder[0].id;
    const c = withLadder.find(x => x.id === reh.center);
    const groups = await FP.groups.list().catch(() => []);
    const ts = await FP.groups.terminals().catch(() => new Map());
    const reg = (await FP.identity.all().catch(() => [])).filter(t => !FP.identity.isEditor(t.terminalId));
    const dutyForms = new Set(c.duties.flatMap(x => x.forms || []));
    // Terminals that run the duty's forms: in a group whose forms include one, or on their own.
    const runs = reg.map(t => t.terminalId).filter(tid => { const g = groups.find(x => x.terminals.includes(tid)); const f = g ? g.forms : ((ts.get(tid) || {}).forms || []); return f.some(x => dutyForms.has(x)); });
    if (!reh.terminal || !runs.includes(reh.terminal)) reh.terminal = runs[0] || null;
    const cs = select(withLadder.map(x => [x.id, `${x.name}: ${x.duties.map(y => y.label || y.name).join(', ')}`]), c.id); cs.onchange = () => { reh.center = cs.value; paint(); };
    const tsel = select(runs.length ? runs.map(t => [t, t]) : [['', 'no terminal runs its forms yet']], reh.terminal || '');
    tsel.onchange = () => { reh.terminal = tsel.value; paint(); };
    d.append(set('Center', 'the duty and the ladder to rehearse', cs), set('At the terminal', 'where the duty is owed', tsel));
    const live = el('div', 'fpa-reh-live');
    d.appendChild(live);
    const rf = await FP.files.readJson(['_test'], 'rehearsal.json').catch(() => null);
    let quick = !!(rf && rf.quickSignIn);
    const setQuick = async on => { await FP.files.writeJson(['_test'], 'rehearsal.json', { quickSignIn: !!on, by: ((await FP.users.current()) || {}).name || null }); quick = !!on; };
    const launcherAs = (tid, uid) => `${launcherFor(tid)}${uid ? `&as=${encodeURIComponent(uid)}` : ''}`;
    const fmt = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const inMin = ms => { const m = Math.max(1, Math.round(ms / MINUTE)); return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`; };
    // Who to watch: the terminal's sign-in, then the first person each level tells, at a desk terminal (one not running the duty).
    async function viewpoints() {
      const out = [];
      const place = reh.terminal ? await FP.groups.forTerminal(reh.terminal).catch(() => null) : null;
      const users = (await FP.users.list().catch(() => [])).filter(u => u.active);
      const rank = r => FP.users.ROLES.indexOf(r);
      const sup = users.find(u => rank(FP.users.topRole(u.roles)) >= rank('supervisor'));
      const atLine = place && place.signIn === 'supervisors' ? sup : users.find(u => FP.centers.isMember(c, u, { terminalId: reh.terminal, group: place && place.group, site: null }, Date.now())) || sup;
      if (reh.terminal) out.push({ label: `The line: ${reh.terminal}`, who: atLine, tid: reh.terminal, note: 'where it is due, then missed' });
      const desk = reg.map(t => t.terminalId).find(t => !runs.includes(t)) || reh.terminal;
      for (let i = 0; i < c.ladder.length; i++) {
        const people = await FP.alerts.whoIsTold(c.ladder[i].tell, Date.now());
        out.push({ label: `Level ${i + 1}: ${await FP.alerts.tellText(c.ladder[i].tell)}`, who: people[0] || null, tid: desk, note: `after ${inMin(c.ladder[i].after * MINUTE)}${people.length > 1 ? ` · also ${people.slice(1).map(u => u.name).join(', ')}` : ''}` });
      }
      return out;
    }
    async function paint() {
      if (!d.isConnected && live.childNodes.length) return;
      const now = Date.now();
      const kids = [];
      kids.push(el('div', 'fpa-reh-clock', `Test clock: ${fmt(now)} (${FP.testClock ? FP.testClock.text() : 'real time'})`));
      let state = null;
      if (reh.terminal) {
        state = await FP.alerts.noticeFor(reh.terminal).catch(e => ({ error: e.message, list: [] }));
        reh.last = state;
      }
      const mine = (state && state.list || []).filter(x => x.center && x.center.id === c.id);
      const alerts = (await FP.alerts.list(true).catch(() => [])).filter(a => a.center === c.id);
      const open = alerts.filter(a => !a.closedAt);
      // Where things stand
      const st = el('div', 'fpa-reh-state');
      const due = mine.filter(x => ['due', 'late', 'upcoming'].includes(x.state));
      if (state && state.error) st.appendChild(el('div', 'fpe-warn', state.error));
      if (!due.length && !open.length) st.appendChild(el('div', null, `Nothing of ${c.name}'s is due at ${reh.terminal || 'a terminal'} right now. ${c.duties.some(x => x.forEach) ? `Its duty goes item by item: start one (a run: Start shift at the line), or add a rehearsal item below.` : 'Jump ahead to the next one.'}`));
      due.slice(0, 6).forEach(x => st.appendChild(el('div', 'fpa-reh-slot ' + x.state.replace(' ', '-'), `${x.title}${x.item ? ` · ${x.item.id}` : ''}: ${FP.due.words(x)}`)));
      open.forEach(a => st.appendChild(el('div', 'fpa-reh-alert' + (a.ackAt ? ' acked' : ''), `Alert · ${a.title}${a.item ? ` · ${a.item}` : ''} · missed ${fmt(Date.parse(a.dueBy || a.since))} · ${FP.alerts.words(a)}`)));
      const closed = alerts.filter(a => a.closedAt).slice(0, 3);
      closed.forEach(a => st.appendChild(el('div', 'fpa-reh-alert done', `Put right · ${a.title}${a.item ? ` · ${a.item}` : ''} · ${a.closedHow}`)));
      kids.push(set('Now', null, st));
      // The next thing that will happen, and the jump to it
      const events = [];
      due.filter(x => x.state !== 'upcoming').forEach(x => events.push({ at: x.lateUntil + MINUTE, what: `${x.title}${x.item ? ` · ${x.item.id}` : ''} is missed` }));
      due.filter(x => x.state === 'upcoming').forEach(x => events.push({ at: x.start + MINUTE, what: `${x.title} comes due` }));
      const levelNames = await Promise.all(c.ladder.map(l => FP.alerts.tellText(l.tell)));
      open.filter(a => !a.ackAt).forEach(a => { const L = c.ladder[a.level]; if (L) events.push({ at: Date.parse(a.since) + L.after * MINUTE + MINUTE, what: `level ${a.level + 1} tells ${levelNames[a.level]}` }); });
      events.sort((x, y) => x.at - y.at);
      const next = events.find(x => x.at > now);
      const jr = el('div', 'fpa-row');
      const jump = ms => act(async () => { await FP.testClock.jump(ms); await paint(); }, null);
      jr.append(btn('+15 min', 'small', () => jump(15 * MINUTE)), btn('+1 hour', 'small', () => jump(60 * MINUTE)));
      if (next) jr.appendChild(btn(`To the next step: ${next.what} (in ${inMin(next.at - now)})`, 'primary', () => jump(next.at - now)));
      jr.appendChild(btn('Back to the real time', 'small', () => act(async () => { if (!confirm('Back to the real time? What was saved in test time stays dated ahead of now (on a test folder that is fine).')) return; await FP.testClock.set(0); await paint(); }, null)));
      kids.push(set('Jump ahead', 'every tab on this folder moves with it; this page notices for the terminal, as it would once a minute', jr));
      // Something to check: an item for an item-by-item duty
      const each = c.duties.find(x => x.forEach);
      if (each && FP.structures.has(each.forEach)) {
        const ar = el('div', 'fpa-row');
        ar.appendChild(btn(`+ a rehearsal item in ${FP.structures.get(each.forEach).label || each.forEach}`, 'small', () => act(async () => {
          const id = `REHEARSAL ${new Date().toTimeString().slice(0, 5)}`;
          await FP.entry.record({ entry: `${each.forEach}.rehearsal`, item: { structure: each.forEach, id }, form: { id: 'rehearsal', version: 1 }, values: { notes: 'rehearsal' }, site: FP.identity.site || (reg.find(t => t.terminalId === reh.terminal) || {}).site });
          FP.current.clearCache(); await paint(); return id;
        }, id => `${id} is open: its ${each.label || each.name} is owed from now.`)));
        kids.push(set('Something to check', `${c.name}'s ${each.label || each.name} goes item by item: start one at the line the usual way, or add one here (open until it ends)`, ar));
      }
      // Each viewpoint, one tap
      const vp = el('div', 'fpa-reh-vps');
      const qr = el('label', 'ffe-check'); const qi = input('', { type: 'checkbox' }); qi.checked = quick;
      qi.onchange = () => act(async () => { await setQuick(qi.checked); await paint(); }, qi.checked ? 'People open signed in, without their PIN, until the rehearsal ends.' : 'Quick sign-in is off.');
      qr.append(qi, document.createTextNode(' Quick sign-in: tabs open signed in as that person, without their PIN (this test folder only)'));
      vp.appendChild(qr);
      for (const v of await viewpoints()) {
        const row = el('div', 'fpa-row');
        row.append(el('b', null, v.label), el('span', 'lead', `${v.who ? v.who.name : 'nobody'} · ${v.note}`));
        if (v.tid) row.appendChild(btn(v.who && quick ? `Open as ${v.who.name}` : `Open ${v.tid}`, 'small', () => window.open(launcherAs(v.tid, quick && v.who ? v.who.id : null), '_blank')));
        vp.appendChild(row);
      }
      kids.push(set('See it as', 'each in its own tab; a level\'s people see the alert at the top of their home page, with Acknowledge', vp));
      // The steps
      const ol = el('ol', 'fpa-reh-steps');
      ['Tick Quick sign-in, then open the line and the first level\'s person.', 'Make sure something is due at the line (a run on a line, or + a rehearsal item).', 'Jump to the next step until it is missed: the line shows Missed, and an alert opens.',
        'Jump again: each level is told in turn; open that person\'s tab to see the alert at the top of their home page.', 'Acknowledge it in their tab (with a note): it stops climbing. Excuse it (as a supervisor, at the line), or do the check again on time: it closes.',
        'End: untick Quick sign-in and go back to the real time.'].forEach(t => ol.appendChild(el('li', null, t)));
      kids.push(set('How it goes', null, ol));
      if (quick || (FP.testClock && FP.testClock.offset())) kids.push(btn('End the rehearsal', 'small', () => act(async () => { await setQuick(false); await FP.testClock.set(0); await paint(); }, 'Rehearsal over: real time, and PINs again.')));
      live.replaceChildren(...kids);
    }
    await paint();
    const timer = setInterval(() => { if (!d.isConnected) { clearInterval(timer); return; } paint().catch(() => {}); }, 20000);
    return d;
  }

  async function testPart(again) {
    const isTest = await isTestFolder();
    const name = FP.folder.handle ? FP.folder.handle.name : '';
    const d = el('div', 'fpa-test');
    d.appendChild(el('h3', null, isTest ? `${name} is a test folder` : `${name} is an ordinary data folder`));
    d.appendChild(el('p', 'ffe-note', isTest
      ? 'Here you can purge all data, run the stress test, open the launcher as other terminals (simulated terminals) and install a pack\'s people. Every launcher and the editor say TEST FOLDER in their top bar.'
      : 'Records here are kept for audit: nothing may be purged, and the stress test, simulated terminals and a pack\'s people are off. To try things out, make a copy of the data folder (or a new empty one), connect a computer to it, and mark that copy as a test folder here.'));
    const ul = el('ul');
    ['Purge all data (Admin > Purge all data)', 'The stress test (Admin > Stress test)', 'Simulated terminals: Open as on a terminal group, or launch.html?terminal=T02', 'A pack\'s people, each with the pack\'s PIN'].forEach(t => ul.appendChild(el('li', null, t)));
    d.appendChild(ul);
    if (!(await FP.users.can('admin'))) { d.appendChild(el('p', 'ffe-note', 'Only an admin can mark or unmark it.')); return d; }
    const b = btn(isTest ? 'Make it an ordinary folder again' : 'Mark this folder as a test folder…', isTest ? 'small' : 'primary', () => act(async () => {
      if (isTest) {
        if (!confirm(`Make ${name} an ordinary data folder again? Purge, the stress test and simulated terminals turn off here.`)) return null;
        await FP.files.remove([], TEST_MARK);
        return 'ordinary';
      }
      const typed = prompt(`A test folder can be purged. To mark this one, type its name: ${name}`, '');
      if (typed == null) return null;
      if (typed.trim() !== name) throw new Error(`That isn't the folder's name (${name}); nothing changed.`);
      await markTest();
      return 'test';
    }, r => (r === 'test' ? `${name} is a test folder.` : r === 'ordinary' ? `${name} is an ordinary folder again.` : null), again));
    d.appendChild(b);
    // The responsibility rehearsal (0.62): on a test folder, for admins.
    if (isTest && FP.alerts && FP.testClock) d.appendChild(await rehearsalPart());
    return d;
  }

  /* ---------- Stress test (0.53): fp-stress.js, on a test folder only ---------- */
  let stressNode = null;
  async function stressPart() {
    if (!FP.stress) return el('div', 'fpe-warn', 'The stress test (fp-stress.js) isn\'t loaded in this release.');
    if (!(await FP.folder.isTest())) {
      stressNode = null;
      const d = el('div', 'fpa-stress-off');
      d.append(el('h3', null, 'Off: this isn\'t a test folder'), el('p', 'ffe-note', `The stress test writes a great deal of data (a year of the plant) and publishes broken and giant definitions on purpose, so it only runs on a copy of the data folder marked as a test folder (Admin > Test folder).`));
      return d;
    }
    // Kept between visits, so a run goes on (and its results stay) while other parts of Admin are open.
    if (!stressNode) { stressNode = el('div'); FP.stress.render(stressNode); }
    return stressNode;
  }

  /* ---------- People, sites, terminal groups and terminals, from the map (0.41) ---------- */
  const ROLE_PICK = [['user', 'User · fills in the forms of the terminal they are at'], ['supervisor', 'Supervisor · any form at the site; approvals; documents'], ['publisher', 'Publisher · makes and publishes forms, structures…; groups and terminals'], ['admin', 'Admin · everything: people, sites, updates']];
  const formTitle = id => { const d = FP.defs.get('form', id) || FP.defs.list('form').find(x => x.id === id); return d ? ((d.def && d.def.title) || d.id) : id; };
  const formsAt = site => FP.defs.list('form').filter(d => !d.retired && (FP.defs.sitesOf(d.def).includes('all') || FP.defs.sitesOf(d.def).includes(site)))
    .sort((a, b) => formTitle(a.id).localeCompare(formTitle(b.id)));
  /* A list of forms in order, each moved up, down or off; + form picks one used at the site. save(list) stores it. */
  function formList(list, site, save, readOnly) {
    const box = el('div', 'fpp-list');
    list.forEach((f, i) => {
      const li = el('div', 'fpp-li');
      const d = FP.defs.get('form', f);
      li.append(el('span', null, formTitle(f)), el('small', null, d ? `v${d.version}` : 'gone'));
      if (!readOnly) {
        const mv = (k, to) => { const n = list.slice(); n.splice(k, 1); n.splice(to, 0, f); save(n); };
        const up = btn('▲', null, () => mv(i, i - 1)); up.disabled = i === 0; up.setAttribute('aria-label', `Move ${formTitle(f)} up`);
        const dn = btn('▼', null, () => mv(i, i + 1)); dn.disabled = i === list.length - 1; dn.setAttribute('aria-label', `Move ${formTitle(f)} down`);
        const x = btn('✕', null, () => save(list.filter(y => y !== f))); x.setAttribute('aria-label', `Take ${formTitle(f)} off`);
        li.append(up, dn, x);
      }
      box.appendChild(li);
    });
    if (!list.length) box.appendChild(el('p', 'ffe-note', readOnly ? 'No forms.' : 'No forms yet.'));
    if (!readOnly) {
      const left = formsAt(site).filter(d => !list.includes(d.id));
      const pick = select([['', left.length ? '+ form…' : 'every form at this site is here']].concat(left.map(d => [d.id, `${formTitle(d.id)}${d.def && d.def.launchable ? '' : ' (opened from other forms)'}`])), '');
      pick.onchange = () => { if (pick.value) save(list.concat(pick.value)); };
      box.appendChild(pick);
    }
    return box;
  }
  /* ---------- The media library (0.61) ----------
   * On the map under Data. Entries with folders and a search; an entry: its file, name, tags, the forms that show it
   * and its versions (Replace with a new version); tag names for the whole library (typed, or linked to a list); and
   * the maker: files brought in one at a time, each given an internal name, tags and a folder. */
  const libState = { q: '', folder: '', sel: null, queue: null, tagsOpen: false, browse: null };
  const fileUrl = blob => { try { return URL.createObjectURL(blob); } catch (_) { return null; } };
  function preview(blob, name) {
    const box = el('div', 'fpa-lib-prev');
    const type = (blob && blob.type) || FP.media.typeOf(name || '');
    const url = blob ? fileUrl(type && blob.type !== type ? new Blob([blob], { type }) : blob) : null;
    if (!url) { box.appendChild(el('div', 'lead', 'No preview.')); return box; }
    if (/^image\/(png|jpeg|gif|webp)$/.test(type)) { const i = el('img'); i.src = url; i.alt = name || ''; box.appendChild(i); }
    else if (type === 'application/pdf') { const f = el('iframe'); f.src = url; f.title = name || 'PDF'; box.appendChild(f); }
    else box.appendChild(el('div', 'lead', `${name || 'This file'}: no preview here; Open shows it.`));
    setTimeout(() => URL.revokeObjectURL(url), 10 * 60000);
    return box;
  }
  /* Tags: one row per tag name (the library's names), its values (comma between); a linked tag offers its list's items in
   * use and marks a value that isn't on it. onChange(tags). */
  function tagEditor(tags, onChange, ro) {
    const L = FP.media.library;
    const box = el('div', 'fpa-lib-tags');
    let rows = Object.entries(tags || {}).map(([name, v]) => ({ name, text: [].concat(v).join(', ') }));
    const out = () => { const o = {}; rows.filter(r => r.name && r.text.trim()).forEach(r => { o[r.name] = r.text.split(',').map(x => x.trim()).filter(Boolean); }); onChange(o); };
    function paint() {
      box.replaceChildren();
      const names = L.tags().map(t => t.name);
      rows.forEach((r, i) => {
        const line = el('div', 'fpa-row');
        const t = L.tags().find(x => x.name === r.name);
        const ns = select([['', 'tag…']].concat(names.concat(r.name && !names.includes(r.name) ? [r.name] : []).map(n => [n, n]), ro ? [] : [['__new', '+ a new tag name…']]), r.name);
        ns.disabled = !!ro;
        ns.onchange = async () => {
          if (ns.value === '__new') {
            const n = (prompt('A new tag name for the whole library (a lowercase letter, then letters and digits, e.g. die):', '') || '').trim();
            if (n) { try { await L.setTag(n, {}); r.name = n; } catch (e) { toast(e.message, true); } }
          } else r.name = ns.value;
          out(); paint();
        };
        const vi = input(r.text, { placeholder: t && t.list ? `from ${(FP.structures.has(t.list) && FP.structures.get(t.list).label) || t.list}, or typed` : 'value, another value', autocomplete: 'off' });
        vi.disabled = !!ro;
        const dl = el('datalist'); dl.id = 'fpa-lt-' + Math.random().toString(36).slice(2); vi.setAttribute('list', dl.id);
        const warn = el('div', 'fpa-lib-warn');
        const check = vals => {
          if (!(t && t.list)) { warn.textContent = ''; return; }
          const on = new Set(vals.filter(v => v.onList).map(v => String(v.value).toLowerCase()));
          const off = r.text.split(',').map(x => x.trim()).filter(x => x && x.toLowerCase() !== 'all' && !on.has(x.toLowerCase()));
          warn.textContent = off.length ? `Not on ${(FP.structures.has(t.list) && FP.structures.get(t.list).label) || t.list}: ${off.join(', ')}` : '';
        };
        let vals = [];
        if (r.name) L.valuesFor(r.name).then(v => { vals = v; dl.replaceChildren(...v.map(x => { const o = el('option'); o.value = x.value; return o; })); check(vals); }).catch(() => {});
        vi.oninput = () => { r.text = vi.value; out(); check(vals); };
        line.append(ns, vi, dl);
        if (!ro) { const x = btn('✕', 'small', () => { rows.splice(i, 1); out(); paint(); }); x.setAttribute('aria-label', `Take tag ${r.name || ''} off`); line.appendChild(x); }
        box.append(line, warn);
      });
      if (!ro) box.appendChild(btn('+ tag', 'small', () => { rows.push({ name: '', text: '' }); paint(); }));
      if (!rows.length && ro) box.appendChild(el('div', 'lead', 'No tags.'));
    }
    paint();
    box.setTags = t => { rows = Object.entries(t || {}).map(([name, v]) => ({ name, text: [].concat(v).join(', ') })); paint(); };
    return box;
  }
  async function libraryPane(card, head, ctx, canPublish) {
    const L = FP.media.library;
    const ro = !canPublish;
    const repaint = async () => { if (ctx.refresh) await ctx.refresh(); if (ctx.openPlace) ctx.openPlace('media-library', null); };
    await L.load({ fresh: true }).catch(() => null);
    const all = L.cached();
    const live = all.filter(e => e.active);
    const formTitle2 = id => { const d = FP.defs.get('form', id); return (d && d.def && d.def.title) || id; };

    /* ---- The maker: one file at a time ---- */
    if (libState.queue) {
      const Q = libState.queue;
      if (Q.i >= Q.files.length) {
        head('Data › Media library', 'Brought in', `${Q.done.length} added${Q.skipped.length ? `, ${Q.skipped.length} skipped` : ''}.`);
        if (Q.done.length) { const ul = el('ul'); Q.done.forEach(e => { const li = el('li'); li.appendChild(btn(e.name, 'small', () => { libState.queue = null; libState.sel = e.id; repaint(); })); li.appendChild(document.createTextNode(` · ${FP.media.tagsText(e.tags) || 'no tags'} · ${e.folder || 'library'}`)); ul.appendChild(li); }); card.appendChild(set('Added', null, ul)); }
        if (Q.skipped.length) card.appendChild(set('Skipped', 'not brought in: bring them in again any time', el('div', null, Q.skipped.join(', '))));
        card.appendChild(btn('Done', 'primary', () => { libState.queue = null; repaint(); }));
        return { isDirty: () => false };
      }
      const f = Q.files[Q.i];
      head('Data › Media library › Bringing in', `File ${Q.i + 1} of ${Q.files.length}`, f.from ? `media/${f.from}` : f.blob.name);
      const bar = el('div', 'fpa-lib-bar'); const bi = el('i'); bi.style.width = `${Math.round(100 * Q.i / Q.files.length)}%`; bar.appendChild(bi); card.appendChild(bar);
      const grid = el('div', 'fpa-lib-make');
      const left = el('div'); const right = el('div');
      grid.append(left, right); card.appendChild(grid);
      const blob = f.blob || await FP.media.file(f.from).catch(() => null);
      left.appendChild(preview(blob, f.blob ? f.blob.name : f.from));
      const base = String((f.blob && f.blob.name) || (f.from || '').split('/').pop() || '').replace(/\.[A-Za-z0-9]{1,8}$/, '');
      if (!f.draft) f.draft = { name: base, tags: {}, folder: Q.lastFolder || '', note: '' };
      const D = f.draft;
      const ni = input(D.name, { placeholder: 'e.g. D-1047 setup sheet', autocomplete: 'off' }); ni.oninput = () => { D.name = ni.value; };
      // The folder follows the kind tag until it is typed in: an existing folder of that kind (setup sheets for setup sheet) first.
      const norm = x => String(x || '').trim().toLowerCase().replace(/e?s$/, '');
      const folderFor = k => L.folders().find(x => norm(x) === norm(k)) || k;
      const te = tagEditor(D.tags, t => { D.tags = t; if (!D.folderTouched && t.kind && t.kind[0]) { D.folder = folderFor(t.kind[0]); fo.value = D.folder; } });
      const fo = input(D.folder, { placeholder: 'e.g. setup sheets', autocomplete: 'off' }); fo.oninput = () => { D.folder = fo.value; D.folderTouched = true; };
      const fdl = el('datalist'); fdl.id = 'fpa-lib-folders'; L.folders().forEach(x => { const o = el('option'); o.value = x; fdl.appendChild(o); }); fo.setAttribute('list', fdl.id);
      const nt = input(D.note, { placeholder: 'optional, e.g. from the customer, Rev B', autocomplete: 'off' }); nt.oninput = () => { D.note = nt.value; };
      const err = el('div', 'fpa-lib-err');
      right.append(set('Internal name', 'what forms and people call it; unique in the library', ni), set('Tags', 'what forms find it by: die, profile, kind…', te),
        set('Folder', 'inside the library\'s folder; files of one kind together', fo), fdl, set('Note', null, nt), err);
      const row = el('div', 'fpa-row');
      if (Q.lastTags && Object.keys(Q.lastTags).length) row.appendChild(btn('Same tags as the last one', 'small', () => { D.tags = JSON.parse(JSON.stringify(Q.lastTags)); te.setTags(D.tags); if (!D.folderTouched) { D.folder = Q.lastFolder || D.folder; fo.value = D.folder; } }));
      row.appendChild(btn('Skip', 'small', () => { Q.skipped.push(base); Q.i++; repaint(); }));
      const go = btn(Q.i + 1 < Q.files.length ? 'Add and next' : 'Add and finish', 'primary', async () => {
        go.disabled = true; err.textContent = '';
        try {
          const o = { name: D.name, tags: D.tags, folder: D.folder, note: D.note };
          const e = f.blob ? await L.add(f.blob, o) : await L.adopt(f.from, o);
          Q.done.push(e); Q.lastTags = D.tags; Q.lastFolder = D.folder; Q.i++;
          repaint();
        } catch (e) { err.textContent = e.message; go.disabled = false; }
      });
      row.appendChild(go);
      right.appendChild(row);
      right.appendChild(btn('Stop here', 'small', () => { Q.files.length = Q.i; repaint(); }));
      setTimeout(() => ni.focus(), 50);
      return { isDirty: () => !!libState.queue, keep: null };
    }
    const startQueue = files => { libState.queue = { files, i: 0, done: [], skipped: [], lastTags: null, lastFolder: '' }; libState.sel = null; repaint(); };

    /* ---- One entry ---- */
    const e = libState.sel ? L.get(libState.sel) : null;
    if (e) {
      head('Data › Media library', e.name, `${e.active ? '' : 'Retired · '}version ${e.revision} · ${e.folder || 'library'} · ${e.revisedBy ? `by ${e.revisedBy}, ` : ''}${ago(e.revisedAt)}`);
      card.appendChild(btn('‹ Every entry', 'small', () => { libState.sel = null; repaint(); }));
      const top = el('div', 'fpa-lib-make'); const left = el('div'); const right = el('div'); top.append(left, right); card.appendChild(top);
      left.appendChild(preview(await FP.media.file(e.path).catch(() => null), e.path));
      const ni = input(e.name, { autocomplete: 'off' }); ni.disabled = ro;
      let tags = e.tags;
      const te = tagEditor(e.tags, t => { tags = t; }, ro);
      const nt = input(e.note || '', { autocomplete: 'off' }); nt.disabled = ro;
      right.append(set('Internal name', null, ni), set('Tags', null, te), set('Note', null, nt));
      const r1 = el('div', 'fpa-row');
      r1.appendChild(btn('Open', 'small', () => FP.media.view(e.path).catch(x => toast(x.message, true))));
      if (!ro) r1.appendChild(btn('Save', 'primary', () => act(() => L.update(e.id, { name: ni.value, tags, note: nt.value }), 'Saved: forms show it as it is now.', repaint)));
      right.appendChild(r1);
      const by = L.usedBy(e.id);
      const ub = el('div', 'fpa-row'); by.forEach(id => ub.appendChild(btn(formTitle2(id), 'small', () => ctx.open && ctx.open('form', id))));
      if (!by.length) ub.appendChild(el('span', 'lead', 'No form shows it yet: on a form\'s map, Media › + from the library.'));
      card.appendChild(set('Shown by', 'forms that name it, or take in every entry with its tags', ub));
      // Versions
      const vt = el('table'); const hr = el('tr'); ['Version', 'When', 'By', 'Note', ''].forEach(h => hr.appendChild(el('th', null, h))); vt.appendChild(hr);
      [{ revision: e.revision, path: e.path, at: e.revisedAt, by: e.revisedBy, note: e.note, now: true }].concat(e.history.slice().reverse()).forEach(v => {
        const tr = el('tr');
        [`${v.revision}${v.now ? ' (in use)' : ''}`, v.at ? new Date(v.at).toLocaleString() : '', v.by || '', v.note || ''].forEach(x => tr.appendChild(el('td', null, x)));
        const td = el('td'); td.appendChild(btn('Open', 'small', () => FP.media.view(v.path).catch(x => toast(x.message, true)))); tr.appendChild(td);
        vt.appendChild(tr);
      });
      card.appendChild(set('Versions', 'the one in use first; older ones are kept', vt));
      if (!ro) {
        const fi = input('', { type: 'file' }); const rn = input('', { placeholder: 'what changed, e.g. Rev C from the customer', autocomplete: 'off' });
        const rr = el('div', 'fpa-row'); rr.append(fi, rn, btn('Replace with a new version', 'small', () => act(async () => { const b = fi.files && fi.files[0]; if (!b) throw new Error('Choose the new file.'); return L.revise(e.id, b, rn.value); }, x => `${x.name} is version ${x.revision} now: forms show it, and Read first asks people to read it again.`, repaint)));
        card.appendChild(set('New version', 'the file stays this entry; the old one is kept above', rr));
        card.appendChild(btn(e.active ? 'Retire this entry' : 'Bring it back', 'small', () => {
          if (e.active && !confirm(`Retire ${e.name}? Forms stop showing it; its files stay in the folder.`)) return;
          act(() => L.setActive(e.id, !e.active), e.active ? `${e.name} is retired.` : `${e.name} is back.`, repaint);
        }));
      }
      return { isDirty: () => false };
    }

    /* ---- Every entry ---- */
    head('Data', 'Media library', 'Every file a form shows, once: an internal name, tags and a folder. Forms show entries by name, or every entry with some tags. Bring files in and you are asked for each one in turn.');
    if (!ro) {
      const row = el('div', 'fpa-row');
      const fi = input('', { type: 'file', multiple: true }); fi.hidden = true;
      fi.onchange = () => { const list = Array.from(fi.files || []); if (list.length) startQueue(list.map(blob => ({ blob }))); };
      row.append(fi, btn('+ Bring in files', 'primary', () => fi.click()), btn('From the media folder…', 'small', () => { libState.browse = libState.browse ? null : { parts: [], picked: new Set() }; repaint(); }),
        btn(libState.tagsOpen ? 'Hide tag names' : 'Tag names', 'small', () => { libState.tagsOpen = !libState.tagsOpen; repaint(); }));
      card.appendChild(row);
    }
    // Files already in the media folder, not in the library yet: tick them and bring them in.
    if (libState.browse && !ro) {
      const B = libState.browse;
      const r = await L.loose(B.parts).catch(x => ({ error: x.message, folders: [], files: [] }));
      const box = el('div', 'fpa-lib-browse');
      const crumbs = el('div', 'fpa-row'); crumbs.appendChild(btn('media', 'small', () => { B.parts = []; repaint(); }));
      B.parts.forEach((x, k) => crumbs.append(el('span', 'lead', '›'), btn(x, 'small', () => { B.parts = B.parts.slice(0, k + 1); repaint(); })));
      box.appendChild(crumbs);
      if (r.error) box.appendChild(el('div', 'fpa-lib-err', r.error));
      r.folders.forEach(d => box.appendChild(btn(`📁 ${d}`, 'small', () => { B.parts = B.parts.concat(d); repaint(); })));
      r.files.forEach(f => {
        const lab = el('label', 'ffe-check'); const c = input('', { type: 'checkbox' }); c.checked = B.picked.has(f.path); c.disabled = f.inLibrary;
        c.onchange = () => { if (c.checked) B.picked.add(f.path); else B.picked.delete(f.path); };
        lab.append(c, document.createTextNode(` ${f.name}${f.inLibrary ? ' · already in the library' : ''}`));
        box.appendChild(lab);
      });
      if (!r.folders.length && !r.files.length) box.appendChild(el('div', 'lead', 'Nothing here.'));
      box.appendChild(btn('Bring in the ones ticked', 'primary', () => { const list = Array.from(B.picked); if (!list.length) { toast('Tick the files to bring in.', true); return; } libState.browse = null; startQueue(list.map(from => ({ from }))); }));
      card.appendChild(set('From the media folder', 'copies into the library; the files stay where they are', box));
    }
    // Tag names for the whole library: typed freely, or linked to a list (its items in use are the values).
    if (libState.tagsOpen) {
      const tb = el('div', 'fpa-lib-tagnames');
      const lists = FP.kinds ? FP.kinds.lists() : [];
      const listOpts = [['', 'typed freely']].concat(lists.map(id => [id, `from ${FP.structures.get(id).label || id}`]));
      L.tags().forEach(t => {
        const row = el('div', 'fpa-row');
        const s = select(listOpts.concat(t.list && !lists.includes(t.list) ? [[t.list, `from ${t.list} (gone)`]] : []), t.list || '');
        s.disabled = ro;
        s.onchange = () => act(() => L.setTag(t.name, { list: s.value || null }), `${t.name} is ${s.value ? 'from ' + s.value : 'typed freely'}.`, repaint);
        row.append(el('b', null, t.name), s);
        const n = live.filter(x => (x.tags || {})[t.name]).length;
        row.appendChild(el('span', 'lead', `${n} entr${n === 1 ? 'y' : 'ies'}`));
        if (!ro) row.appendChild(btn('Remove', 'small', () => act(() => L.removeTag(t.name), `${t.name} is no longer offered (entries keep it).`, repaint)));
        tb.appendChild(row);
      });
      if (!L.tags().length) tb.appendChild(el('div', 'lead', 'No tag names yet.'));
      if (!ro) {
        const ni = input('', { placeholder: 'e.g. die', autocomplete: 'off' }); const ls = select(listOpts, '');
        const row = el('div', 'fpa-row'); row.append(ni, ls, btn('+ Add the tag name', 'small', () => act(() => L.setTag(ni.value.trim(), { list: ls.value || null }), `${ni.value.trim()} is a tag name.`, repaint)));
        tb.appendChild(row);
      }
      card.appendChild(set('Tag names', 'one set for the whole library; a tag from a list offers its items in use, and marks a value that isn\'t on it', tb));
    }
    // Folders and the search
    const folders = L.folders();
    const fr = el('div', 'fpa-lib-folders');
    [['', `All · ${live.length}`]].concat(folders.map(f => [f, `${f} · ${live.filter(x => x.folder === f).length}`]), all.some(x => !x.active) ? [['__retired', `Retired · ${all.filter(x => !x.active).length}`]] : [])
      .forEach(([f, label]) => { const b = btn(label, 'fpa-forchip' + (libState.folder === f ? ' on' : ''), () => { libState.folder = f; repaint(); }); fr.appendChild(b); });
    const q = input(libState.q, { placeholder: 'Find by name or tag', autocomplete: 'off', type: 'search' });
    let qt = null;
    q.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { libState.q = q.value; paintList(); }, 200); };
    card.append(fr, q);
    const listBox = el('div', 'fpa-lib-list');
    card.appendChild(listBox);
    function paintList() {
      const words = libState.q.trim().toLowerCase();
      const shown = (libState.folder === '__retired' ? all.filter(x => !x.active) : live.filter(x => !libState.folder || x.folder === libState.folder))
        .filter(x => !words || `${x.name} ${FP.media.tagsText(x.tags)} ${x.folder}`.toLowerCase().includes(words));
      listBox.replaceChildren();
      if (!shown.length) { listBox.appendChild(el('div', 'lead', all.length ? 'Nothing matches.' : 'The library is empty: + Bring in files to start.')); return; }
      shown.forEach(x => {
        const b = btn('', 'fpa-lib-row', () => { libState.sel = x.id; repaint(); });
        b.dataset.entry = x.id;
        const used = L.usedBy(x.id).length;
        b.append(el('b', null, x.name), el('span', 'tags', FP.media.tagsText(x.tags) || 'no tags'), el('span', 'v', `v${x.revision}`), el('span', 'u' + (used ? '' : ' warn'), used ? `${used} form${used === 1 ? '' : 's'}` : 'on no form'));
        listBox.appendChild(b);
      });
    }
    paintList();
    return { isDirty: () => false };
  }

  async function places(host, kind, id, ctx) {
    injectCss();
    const md = ctx.data ? ctx.data() : null;
    const again = async () => { if (ctx.refresh) await ctx.refresh(); await places(host, kind, id, ctx); };
    // Not fpp: that is the forms' print page, hidden on screen once a form has been opened (the blank pane, 0.53.3).
    const card = el('div', 'fpa-place');
    const wrap = el('div', 'fpe'); wrap.appendChild(card);
    const head = (crumb, title, lead) => { if (crumb) card.appendChild(el('div', 'crumb', crumb)); card.appendChild(el('h2', null, title)); if (lead) card.appendChild(el('p', 'lead', lead)); };
    const sites = (md && md.sites) || await FP.sites.list().catch(() => []);
    const siteName = sid => (sites.find(x => x.id === sid) || {}).name || sid || 'no site';
    const isAdmin = await FP.users.can('admin').catch(() => false);
    const canPublish = await FP.users.can('publisher').catch(() => false);
    const me = await FP.users.current().catch(() => null);
    // The editor's "Opening…" stays above until the pane is filled (0.53.3): a pane that waits on the folder isn't blank.
    const note = host.querySelector(':scope > .fpe-opening');
    host.replaceChildren(...(note ? [note, wrap] : [wrap]));

    if (kind === 'media-library') return libraryPane(card, head, ctx, canPublish);
    if (kind === 'person' || kind === 'new-person') {
      if (!isAdmin) { head('People', 'People', 'Only an admin can see and change people.'); return { isDirty: () => false }; }
      const u = kind === 'person' ? (await FP.users.list(true)).find(x => x.id === id) : null;
      if (kind === 'person' && !u) { head('People', 'Not found', 'This person is no longer on the list.'); return { isDirty: () => false }; }
      head('People', u ? u.name + (me && me.id === u.id ? ' (you)' : '') : 'A new person', u ? [FP.users.ROLE_LABEL[FP.users.topRole(u.roles)], u.department, u.active ? null : 'retired', u.mustChange ? 'chooses a PIN at next sign-in' : null].filter(Boolean).join(' · ') : 'They sign in with the temporary PIN once, then choose their own.');
      const ni = input(u ? u.name : '', { placeholder: 'e.g. Maria Lopez', autocomplete: 'off' });
      const di = input(u ? u.department : '', { placeholder: 'e.g. Extrusion', autocomplete: 'off' });
      const rs = select(ROLE_PICK, u ? FP.users.topRole(u.roles) : 'user');
      card.append(set('Name', null, ni), set('Department', 'optional', di), set('Role', 'each role can do what the ones above it can', rs));
      if (!u) {
        const pi = input('', { inputmode: 'numeric', maxlength: 6, placeholder: '6 digits', autocomplete: 'off' });
        card.appendChild(set('Temporary PIN', 'they sign in with it once, then choose their own', pi));
        card.appendChild(btn('Add this person', 'primary', () => act(() => FP.users.create({ name: ni.value, department: di.value, roles: [rs.value], tempPin: pi.value.trim() }), `${ni.value.trim()} is added.`, async newId => { if (ctx.refresh) await ctx.refresh(); if (newId && ctx.openPlace) ctx.openPlace('person', newId); })));
        return { isDirty: () => false };
      }
      card.appendChild(btn('Save', 'primary', () => act(async () => {
        if (ni.value.trim() !== u.name || di.value.trim() !== u.department) await FP.users.rename(u.id, { name: ni.value, department: di.value });
        if (rs.value !== FP.users.topRole(u.roles)) await FP.users.setRoles(u.id, [rs.value]);
      }, `${ni.value.trim()} is saved.`, again)));
      // Away (0.56, vacation mode): left out of every responsibility center for those days, then back with nothing to undo.
      const af = input(u.awayFrom || '', { type: 'date' }), at2 = input(u.awayTo || '', { type: 'date' }), an = input(u.awayNote || '', { placeholder: 'e.g. vacation', autocomplete: 'off' });
      const ar = el('div', 'fpa-row'); ar.append(af, el('span', null, 'to'), at2, an,
        btn('Save away', 'small', () => act(() => FP.users.setAway(u.id, af.value, at2.value, an.value), af.value ? `${u.name} is away from ${af.value}${at2.value ? ' to ' + at2.value : ''}.` : `${u.name} is not away.`, again)));
      if (u.awayFrom) ar.appendChild(btn('Not away', 'small', () => act(() => FP.users.setAway(u.id, null), `${u.name} is not away.`, again)));
      card.appendChild(set('Away', `${FP.users.isAway(u) ? 'away now: ' : ''}left out of every responsibility center for these days (not responsible, not told); the last day is included, and empty means until cleared`, ar));
      if (FP.centers) {
        const mine = (await FP.centers.list().catch(() => [])).filter(c => FP.centers.isMember(c, Object.assign({}, u, { awayFrom: null }), null));
        card.appendChild(set('Responsibility centers', 'by name, role or department; centers they are in only while signed in somewhere are not listed', el('div', null, mine.length ? mine.map(c => c.name).join(', ') : 'none')));
      }
      const pin = input('', { inputmode: 'numeric', maxlength: 6, placeholder: '6 digits', autocomplete: 'off' });
      const pr = el('div', 'fpa-row'); pr.append(pin, btn('Give a temporary PIN', 'small', () => act(() => FP.users.resetPin(u.id, pin.value.trim()), `${u.name} chooses a new PIN at next sign-in.`, again)));
      card.appendChild(set('Forgotten PIN', 'they sign in with this once, then choose their own; nobody can see a PIN', pr));
      if (me && me.id === u.id) card.appendChild(el('p', 'ffe-note', 'You can\'t retire yourself while signed in.'));
      else card.appendChild(btn(u.active ? 'Retire this person' : 'Reinstate this person', 'small', () => {
        if (u.active && !confirm(`Retire ${u.name}? They can't sign in until reinstated; what they saved keeps their name.`)) return;
        act(() => FP.users.setActive(u.id, !u.active), u.active ? `${u.name} is retired.` : `${u.name} is reinstated.`, again);
      }));
      return { isDirty: () => false };
    }

    /* ---------- A responsibility center (0.56): who owns duties, and what they owe when ---------- */
    if (kind === 'center' || kind === 'new-center') {
      if (!FP.centers) { head('People', 'Responsibility centers', 'This release has no responsibility centers.'); return { isDirty: () => false }; }
      const c0 = kind === 'center' ? await FP.centers.get(id) : null;
      if (kind === 'center' && !c0) { head('Responsibility centers', 'Not found', 'This responsibility center is gone.'); return { isDirty: () => false }; }
      const c = c0 ? JSON.parse(JSON.stringify(c0)) : { name: '', members: { people: [], role: null, departments: [], signedInAt: [] }, duties: [] };
      let dirty = false;
      const touch = () => { dirty = true; };
      head('Responsibility centers', c0 ? c0.name : 'A new responsibility center', 'Who owns duties, and what they owe when. A person can be in several; anyone away is left out for those days.');
      if (!canPublish) card.appendChild(el('p', 'ffe-note', 'Only a publisher or an admin can change it.'));
      const users = await FP.users.list().catch(() => []);
      const groups = (md && md.groups) || await FP.groups.list().catch(() => []);
      const registry = (md && md.registry) || (await FP.identity.all().catch(() => [])).filter(t => !FP.identity.isEditor(t.terminalId));
      const forms = FP.defs.list('form').filter(d => !d.retired && d.def).sort((a, b) => formTitle(a.id).localeCompare(formTitle(b.id)));
      const structures = FP.defs.list('structure').filter(d => !d.retired && d.def).sort((a, b) => String(a.def.label || a.id).localeCompare(String(b.def.label || b.id)));
      const placeName = (k, x) => (k === 'site' ? siteName(x) : k === 'group' ? ((groups.find(g => g.id === x) || {}).name || x) : k === 'person' ? ((users.find(y => y.id === x) || {}).name || x) : x);
      const csv = a => (a || []).join(', ');
      const fromCsv = t => String(t || '').split(',').map(x => x.trim()).filter(Boolean);
      // Chips with ✕, and a picker that adds one.
      function chips(list, options, onChange, addLabel) {
        const box = el('div', 'fpa-row');
        list.forEach((v, i) => { const o = options.find(x => x[0] === v); const ch = el('span', 'fpa-chip', o ? o[1] : v); const x = btn('✕', 'small', () => { list.splice(i, 1); onChange(); }); x.setAttribute('aria-label', `Take ${o ? o[1] : v} off`); ch.appendChild(x); box.appendChild(ch); });
        const left = options.filter(o => !list.includes(o[0]));
        const pick = select([['', left.length ? addLabel : 'all are here']].concat(left), '');
        pick.onchange = () => { if (pick.value) { list.push(pick.value); onChange(); } };
        box.appendChild(pick);
        return box;
      }
      const ni = input(c.name, { placeholder: 'e.g. Quality techs', autocomplete: 'off' });
      ni.oninput = () => { c.name = ni.value; touch(); };
      card.appendChild(set('Name', 'shown to people on the terminals, e.g. "for Quality techs"', ni));

      // Members
      const mem = el('div', 'ffe-group');
      const paintMembers = () => {
        const m = c.members;
        mem.replaceChildren(el('b', null, 'Who is in it'));
        mem.appendChild(set('People', 'by name', chips(m.people, users.filter(u => u.active).map(u => [u.id, u.name]), () => { touch(); paintMembers(); }, '+ person…')));
        const rs = select([['', 'No role']].concat(FP.users.ROLES.map(r => [r, `${FP.users.ROLE_LABEL[r]}s and up`])), m.role || '');
        rs.onchange = () => { m.role = rs.value || null; touch(); };
        const di = input(csv(m.departments), { placeholder: 'e.g. Quality', autocomplete: 'off' });
        di.oninput = () => { m.departments = fromCsv(di.value); touch(); };
        mem.append(set('Role', 'everyone with this role or above (with a department below: both)', rs), set('Departments', 'as written on each person; several with commas', di));
        const placeOpts = sites.filter(x => x.active !== false).map(x => [`site:${x.id}`, `Site ${x.name || x.id}`])
          .concat(groups.map(g => [`group:${g.id}`, `Group ${g.name}`])).concat(registry.map(t => [`terminal:${t.terminalId}`, `Terminal ${t.terminalId}`]));
        const at = m.signedInAt.map(x => `${x.kind}:${x.id}`);
        mem.appendChild(set('Whoever is signed in at', 'responsibility follows the sign-in: each person while they are signed in there (a shift)', chips(at, placeOpts, () => { m.signedInAt = at.map(v => { const i = v.indexOf(':'); return { kind: v.slice(0, i), id: v.slice(i + 1) }; }); touch(); paintMembers(); }, '+ site, group or terminal…')));
      };
      paintMembers();
      card.appendChild(mem);
      if (c0) {
        const now = await FP.centers.membersOf(c0).catch(() => []);
        const away = users.filter(u => u.active && FP.users.isAway(u) && FP.centers.isMember(c0, Object.assign({}, u, { awayFrom: null }), null));
        card.appendChild(el('p', 'ffe-note', `In it today by name, role or department: ${now.length ? now.map(u => u.name).join(', ') : 'nobody'}${away.length ? ` · away: ${away.map(u => `${u.name}${u.awayTo ? ' until ' + u.awayTo : ''}`).join(', ')}` : ''}.`));
      }

      // Duties
      const dutiesBox = el('div');
      const paintDuties = () => {
        dutiesBox.replaceChildren(el('h3', null, 'Duties'));
        if (!c.duties.length) dutiesBox.appendChild(el('p', 'ffe-note', 'What this center owes, and when: + duty.'));
        c.duties.forEach((d, i) => {
          const box = el('div', 'ffe-group fpa-duty');
          const where = !d.attach || d.attach.kind === 'form' ? 'wherever its forms run' : `at ${(d.attach.ids || []).map(x => placeName(d.attach.kind, x)).join(', ') || '(none chosen)'}`;
          box.appendChild(el('p', 'ffe-note', `${FP.due.describe(d)} Done by ${(d.forms || []).map(formTitle).join(' or ') || '(no form yet)'}; ${where}${(d.exclude || []).length ? `; leaving out ${(d.exclude || []).map(x => placeName(x.kind, x.id) + (x.from || x.to ? ` (${x.from || '…'} to ${x.to || '…'})` : '')).join(', ')}` : ''}.`));
          const nm = input(d.name || '', { placeholder: 'e.g. hourly', spellcheck: false }); nm.oninput = () => { d.name = nm.value.trim(); touch(); };
          const lb = input(d.label || '', { placeholder: 'e.g. each run', autocomplete: 'off' }); lb.oninput = () => { if (lb.value.trim()) d.label = lb.value.trim(); else delete d.label; touch(); };
          box.append(set('Name', 'one word', nm), set('Label', 'shown beside the form\'s title, optional', lb));
          d.forms = d.forms || [];
          box.appendChild(set('Done by', 'saving any of these forms does it', chips(d.forms, forms.map(f => [f.id, formTitle(f.id)]), () => { touch(); paintDuties(); }, '+ form…')));
          const how = select([['every', 'Every so many minutes'], ['at', 'At set times of day']], d.at ? 'at' : 'every');
          how.onchange = () => { if (how.value === 'at') { delete d.every; delete d.forEach; delete d.while; d.at = d.at || ['08:00']; } else { delete d.at; delete d.days; delete d.window; d.every = d.every || 60; } touch(); paintDuties(); };
          box.appendChild(set('Repeats', null, how));
          if (d.at) {
            const ti = input(csv(d.at), { placeholder: '06:00, 14:00', spellcheck: false }); ti.oninput = () => { d.at = fromCsv(ti.value); touch(); };
            const dy = input(csv(d.days), { placeholder: 'every day, or mon, tue, wed, thu, fri', spellcheck: false }); dy.oninput = () => { const v = fromCsv(dy.value.toLowerCase()); if (v.length) d.days = v; else delete d.days; touch(); };
            const wi = input(d.window == null ? '' : String(d.window), { inputmode: 'numeric', placeholder: '60' }); wi.oninput = () => { const v = parseInt(wi.value, 10); if (v > 0) d.window = v; else delete d.window; touch(); };
            box.append(set('At', '24-hour times', ti), set('On', 'mon … sun; empty for every day', dy), set('Minutes to do it in', '60 when empty', wi));
          } else {
            const ei = input(String(d.every || ''), { inputmode: 'numeric' }); ei.oninput = () => { d.every = parseInt(ei.value, 10) || d.every; touch(); };
            box.appendChild(set('Every (minutes)', 'counted from midnight, or from an item\'s first save', ei));
            // Item by item (0.60): structures whose kind opens and closes (and any without a kind, from before kinds).
            const each = structures.filter(st => st.id === d.forEach || !FP.kinds || FP.kinds.opensAndCloses(st.id) || !(FP.structures.has(st.id) && FP.structures.get(st.id).kind));
            const fo = select([['', 'No']].concat(each.map(st => [st.id, `Each item of ${st.def.label || st.id}`])), d.forEach || '');
            fo.onchange = () => { if (fo.value) { d.forEach = fo.value; delete d.per; } else { delete d.forEach; delete d.while; } touch(); paintDuties(); };
            box.appendChild(set('Item by item', 'one series for each item, from its first save; saving the form on the item does it', fo));
            if (d.forEach) {
              const rule = FP.structures.has(d.forEach) ? FP.structures.get(d.forEach).open : null;
              const wf = input(d.while || '', { placeholder: rule ? `${rule} (its Still open rule)` : 'e.g. status <> "Ended"', spellcheck: false });
              wf.oninput = () => { if (wf.value.trim()) d.while = wf.value; else delete d.while; touch(); };
              box.appendChild(set('While', 'a formula over the item (its values, status, firstAt, lastAt); empty: while it is open, by its kind', wf));
            }
          }
          const gi = input(d.grace == null ? '' : String(d.grace), { inputmode: 'numeric', placeholder: String(FP.due.graceOf(d)) });
          gi.oninput = () => { const v = parseInt(gi.value, 10); if (gi.value.trim() === '') delete d.grace; else if (v >= 0) d.grace = v; touch(); };
          box.appendChild(set('Late, then missed after (minutes)', 'it can still be done, late, for this long', gi));
          const cl = el('label', 'ffe-check'); const ci = input('', { type: 'checkbox' }); ci.checked = !!d.critical;
          ci.onchange = () => { if (ci.checked) d.critical = true; else delete d.critical; touch(); };
          cl.append(ci, document.createTextNode(' Critical'));
          box.appendChild(cl);
          // Looking it over counts (0.60): for a check of data already there, nothing to type in.
          const kl = el('label', 'ffe-check'); const ki = input('', { type: 'checkbox' }); ki.checked = !!d.confirm;
          ki.onchange = () => { if (ki.checked) d.confirm = true; else delete d.confirm; touch(); };
          kl.append(ki, document.createTextNode(' Looking it over counts: the form shows "Checked, nothing new", which does the duty without typing anything in'));
          box.appendChild(kl);
          // Where it applies, and what it leaves out
          const a = d.attach || { kind: 'form' };
          const ak = select([['form', 'Wherever its forms run'], ['site', 'At sites…'], ['group', 'At terminal groups…'], ['terminal', 'At terminals…']], a.kind);
          ak.onchange = () => { d.attach = ak.value === 'form' ? undefined : { kind: ak.value, ids: [] }; if (!d.attach) delete d.attach; touch(); paintDuties(); };
          box.appendChild(set('Applies', 'a terminal owes it when it runs one of the forms and is here', ak));
          if (a.kind !== 'form') {
            const opts = a.kind === 'site' ? sites.map(x => [x.id, x.name || x.id]) : a.kind === 'group' ? groups.map(g => [g.id, `${g.name} (${siteName(g.site)})`]) : registry.map(t => [t.terminalId, `${t.terminalId} (${siteName(t.site)})`]);
            d.attach.ids = d.attach.ids || [];
            box.appendChild(set(a.kind === 'site' ? 'Sites' : a.kind === 'group' ? 'Terminal groups' : 'Terminals', null, chips(d.attach.ids, opts, () => { touch(); paintDuties(); }, '+ add…')));
          }
          if (!d.forEach) {
            const pe = select([['', `Default (${c.members.signedInAt.length ? 'each terminal group' : 'each site'})`], ['group', 'Each terminal group (a terminal in none: itself)'], ['terminal', 'Each terminal'], ['site', 'Each site']], d.per || '');
            pe.onchange = () => { if (pe.value) d.per = pe.value; else delete d.per; touch(); };
            box.appendChild(set('Once for', 'a save anywhere in it counts', pe));
          }
          const ex = el('div', 'fpp-list');
          d.exclude = d.exclude || [];
          d.exclude.forEach((x, k) => {
            const li = el('div', 'fpp-li');
            const f = input(x.from || '', { type: 'date' }), t = input(x.to || '', { type: 'date' });
            f.onchange = () => { if (f.value) x.from = f.value; else delete x.from; touch(); };
            t.onchange = () => { if (t.value) x.to = t.value; else delete x.to; touch(); };
            li.append(el('span', null, `${x.kind === 'group' ? 'Group' : x.kind === 'terminal' ? 'Terminal' : 'Person'} ${placeName(x.kind, x.id)}`), el('small', null, 'from'), f, el('small', null, 'to'), t, btn('✕', null, () => { d.exclude.splice(k, 1); touch(); paintDuties(); }));
            ex.appendChild(li);
          });
          const xo = [['', '+ leave out…']].concat(groups.map(g => [`group:${g.id}`, `Group ${g.name}`]), registry.map(t => [`terminal:${t.terminalId}`, `Terminal ${t.terminalId}`]), users.filter(u => u.active).map(u => [`person:${u.id}`, u.name]));
          const xp = select(xo, '');
          xp.onchange = () => { if (!xp.value) return; const i2 = xp.value.indexOf(':'); d.exclude.push({ kind: xp.value.slice(0, i2), id: xp.value.slice(i2 + 1) }); touch(); paintDuties(); };
          ex.appendChild(xp);
          box.appendChild(set('Leave out', 'terminal groups, terminals or people, always or between two dates (light duty, a line down for a month)', ex));
          box.appendChild(btn('Remove this duty', 'small', () => { c.duties.splice(i, 1); touch(); paintDuties(); }));
          dutiesBox.appendChild(box);
        });
        dutiesBox.appendChild(btn('+ duty', 'small', () => {
          const used = new Set(c.duties.map(x => x.name)); let n = 'duty', k = 1; while (used.has(n)) n = 'duty' + (++k);
          c.duties.push({ name: n, forms: [], every: 60 }); touch(); paintDuties();
        }));
      };
      paintDuties();
      card.appendChild(dutiesBox);

      // The ladder (0.62): while a missed duty isn't acknowledged or put right, who is told and when.
      c.ladder = Array.isArray(c.ladder) ? c.ladder : [];
      const centersAll = (await FP.centers.list().catch(() => [])).filter(x => !c0 || x.id !== c0.id);
      const ladderBox = el('div');
      const paintLadder = () => {
        ladderBox.replaceChildren(el('h3', null, 'When a duty is missed: the ladder'));
        ladderBox.appendChild(el('p', 'ffe-note', c.ladder.length
          ? 'A miss is shown at the line at once; then each level is told in turn, counted from when it was missed, until someone told acknowledges it (with a note), a supervisor excuses it, or the check is done again on time. A level whose people are all away passes straight on.'
          : 'No ladder: a miss is shown at the line, recorded, and can be excused. + level makes it climb, e.g. 30 minutes: Shift supervisors; 2 hours: Quality techs.'));
        c.ladder.forEach((l, i) => {
          l.tell = l.tell || {};
          const box = el('div', 'ffe-group fpa-duty');
          box.appendChild(el('b', null, `Level ${i + 1}`));
          const ai = input(l.after == null ? '' : String(l.after), { inputmode: 'numeric', placeholder: '30' });
          ai.oninput = () => { const v = parseInt(ai.value, 10); l.after = Number.isInteger(v) && v >= 0 ? v : 0; touch(); };
          box.appendChild(set('After (minutes)', 'since it was missed; 0 at once', ai));
          l.tell.centers = Array.isArray(l.tell.centers) ? l.tell.centers : [];
          box.appendChild(set('Tell', 'their members (named, by role or department)', chips(l.tell.centers, centersAll.map(x => [x.id, x.name]), () => { touch(); paintLadder(); }, '+ responsibility center…')));
          const rs = select([['', 'and no role']].concat(FP.users.ROLES.map(r => [r, `${FP.users.ROLE_LABEL[r]}s and up`])), l.tell.role || '');
          rs.onchange = () => { if (rs.value) l.tell.role = rs.value; else delete l.tell.role; touch(); };
          const di = input(csv(l.tell.departments), { placeholder: 'e.g. Management', autocomplete: 'off' });
          di.oninput = () => { l.tell.departments = fromCsv(di.value); touch(); };
          l.tell.people = Array.isArray(l.tell.people) ? l.tell.people : [];
          box.append(set('Or a role', null, rs), set('Or departments', 'several with commas', di),
            set('Or people', 'by name', chips(l.tell.people, users.filter(u => u.active).map(u => [u.id, u.name]), () => { touch(); paintLadder(); }, '+ person…')));
          const kl = el('label', 'ffe-check'); const ki = input('', { type: 'checkbox' }); ki.checked = !!l.ack;
          ki.onchange = () => { if (ki.checked) l.ack = true; else delete l.ack; touch(); };
          kl.append(ki, document.createTextNode(' Needs acknowledging: shown until someone told acknowledges it'));
          box.appendChild(kl);
          const r = el('div', 'fpa-row');
          r.appendChild(btn('Remove this level', 'small', () => { c.ladder.splice(i, 1); touch(); paintLadder(); }));
          box.appendChild(r);
          ladderBox.appendChild(box);
        });
        ladderBox.appendChild(btn('+ level', 'small', () => { const last = c.ladder[c.ladder.length - 1]; c.ladder.push({ after: last ? last.after + 60 : 30, tell: { centers: [] }, ack: true }); touch(); paintLadder(); }));
      };
      paintLadder();
      card.appendChild(ladderBox);
      if (c0 && FP.alerts) {
        const open = (await FP.alerts.list().catch(() => [])).filter(a => a.center === c0.id && !a.closedAt);
        card.appendChild(el('p', 'ffe-note', open.length ? `Open now: ${open.map(a => `${a.title}${a.item ? ` · ${a.item}` : ''} (${FP.alerts.words(a)})`).join('; ')}` : 'No alerts open now.'));
      }
      if (canPublish) {
        const row = el('div', 'fpa-row');
        row.appendChild(btn(c0 ? 'Save' : 'Add this responsibility center', 'primary', () => act(async () => {
          const values = { name: c.name, members: c.members, duties: c.duties, ladder: (c.ladder || []).map(l => Object.assign({ after: l.after || 0, tell: Object.fromEntries(Object.entries(l.tell || {}).filter(([, v]) => v && (!Array.isArray(v) || v.length))) }, l.ack ? { ack: true } : {})) };
          if (c0) { await FP.centers.update(c0.id, values); return c0.id; }
          return FP.centers.create(values);
        }, `${c.name || 'It'} is saved.`, async cid => { dirty = false; if (ctx.refresh) await ctx.refresh(); if (cid && ctx.openPlace) ctx.openPlace('center', cid); })));
        if (c0) row.appendChild(btn('Remove this responsibility center', 'small', () => {
          if (!confirm(`Remove ${c0.name}? Its duties stop being owed; misses already recorded stay.`)) return;
          act(() => FP.centers.remove(c0.id), `${c0.name} is removed.`, async () => { if (ctx.refresh) await ctx.refresh(); });
        }));
        card.appendChild(row);
      }
      return { isDirty: () => dirty };
    }

    if (kind === 'new-site') {
      head('Sites', 'A new site', 'A facility or area. Every terminal is at one; everything it saves is marked with it.');
      if (!isAdmin) { card.appendChild(el('p', 'ffe-note', 'Only an admin can add a site.')); return { isDirty: () => false }; }
      const ci = input('', { placeholder: 'e.g. ELP', autocomplete: 'off' }); ci.style.textTransform = 'uppercase';
      const ni = input('', { placeholder: 'e.g. El Paso', autocomplete: 'off' });
      card.append(set('Code', '1–16 capital letters, digits or dashes; it never changes', ci), set('Name', null, ni));
      card.appendChild(btn('Add site', 'primary', () => act(() => FP.sites.create(ci.value, ni.value), sid => `Site ${sid} is added.`, async sid => { if (ctx.refresh) await ctx.refresh(); if (sid && ctx.openPlace) ctx.openPlace('site', sid); })));
      return { isDirty: () => false };
    }

    if (kind === 'site') {
      const site = sites.find(x => x.id === id);
      if (!site) { head('Sites', 'Not found', `There is no site ${id}.`); return { isDirty: () => false }; }
      const groups = ((md && md.groups) || await FP.groups.list()).filter(g => g.site === id);
      const terms = ((md && md.registry) || await FP.identity.all()).filter(t => t.site === id);
      const defs = FP.defs.list().filter(d => !d.retired && Array.isArray(d.def && d.def.sites) && d.def.sites.includes(id));
      head('Sites', site.name, `${id} · ${terms.length} terminal${terms.length === 1 ? '' : 's'} · ${groups.length} group${groups.length === 1 ? '' : 's'} · ${defs.length} definition${defs.length === 1 ? '' : 's'} for it alone${site.active ? '' : ' · turned off'}`);
      if (isAdmin) {
        const ni = input(site.name, { autocomplete: 'off' });
        const nr = el('div', 'fpa-row'); nr.append(ni, btn('Rename', 'small', () => act(() => { if (!ni.value.trim()) throw new Error('Give the site a name.'); return FP.sites.rename(id, ni.value); }, 'Renamed.', again)));
        card.appendChild(set('Name', `its code, ${id}, never changes: saved records and definitions name it`, nr));
      }
      if (canPublish) card.appendChild(btn('+ terminal group here', 'small', () => ctx.openPlace && ctx.openPlace('new-group', id)));
      if (isAdmin) {
        if (site.active) {
          if (terms.length || defs.length) {
            const w = el('div', 'fpa-warn'); w.appendChild(el('b', null, 'Before turning it off: these still name it'));
            const ul = el('ul');
            terms.forEach(x => ul.appendChild(el('li', null, `terminal ${x.terminalId}`)));
            defs.forEach(x => ul.appendChild(el('li', null, `${FP.defs.LABELS[x.kind]} ${(x.def && (x.def.title || x.def.label)) || x.id}`)));
            w.appendChild(ul); card.appendChild(w);
          }
          card.appendChild(btn('Turn this site off', 'small', () => { if (!confirm(`Turn ${site.name} off? It can't be picked for a terminal and is greyed in Used at. Records saved there are kept.`)) return; act(() => FP.sites.setActive(id, false), `${site.name} is off.`, again); }));
        } else card.appendChild(btn('Turn this site back on', 'small', () => act(() => FP.sites.setActive(id, true), `${site.name} is on.`, again)));
      }
      card.appendChild(el('p', 'lead', 'A terminal is put at a site on that terminal, when it is set up; moving it is done there too. A site is never deleted: saved records and definitions name it.'));
      return { isDirty: () => false };
    }

    if (kind === 'new-group') {
      head('Terminal groups', 'A new terminal group', 'Terminals at one site that run the same forms, e.g. Production presses: T01–T05.');
      if (!canPublish) { card.appendChild(el('p', 'ffe-note', 'Only a publisher or an admin can make a group.')); return { isDirty: () => false }; }
      const ni = input('', { placeholder: 'e.g. Production presses', autocomplete: 'off' });
      const ss = select(sites.filter(x => x.active).map(x => [x.id, `${x.name} (${x.id})`]), id || (sites[0] && sites[0].id) || '');
      card.append(set('Name', null, ni), set('Site', 'its terminals are all at this site', ss));
      card.appendChild(btn('Make the group', 'primary', () => act(() => FP.groups.create({ name: ni.value, site: ss.value }), `${ni.value.trim()} is made: add its terminals and forms.`, async gid => { if (ctx.refresh) await ctx.refresh(); if (gid && ctx.openPlace) ctx.openPlace('group', gid); })));
      return { isDirty: () => false };
    }

    if (kind === 'group') {
      const groups = (md && md.groups) || await FP.groups.list();
      const g = groups.find(x => x.id === id);
      if (!g) { head('Terminal groups', 'Not found', 'This group was broken up.'); return { isDirty: () => false }; }
      const registry = (md && md.registry) || await FP.identity.all();
      const tset = (md && md.termSet) || await FP.groups.terminals();
      head(`${siteName(g.site)} › terminal group`, g.name, 'Terminals that run the same forms. A setting here is a setting on every terminal in it.');
      const ro = !canPublish;
      if (!ro) {
        const ni = input(g.name, { autocomplete: 'off' });
        const nr = el('div', 'fpa-row'); nr.append(ni, btn('Rename', 'small', () => act(() => FP.groups.update(id, { name: ni.value }), 'Renamed.', again)));
        card.appendChild(set('Name', null, nr));
      }
      // Terminals
      const tc = el('div', 'fpp-chips');
      g.terminals.forEach(t => {
        const c = el('span', 'fpp-chip'); c.appendChild(document.createTextNode(((tset.get(t) || {}).name) ? `${t} ${tset.get(t).name}` : t));
        if (!ro) { const x = btn('✕', null, () => act(() => FP.groups.update(id, { terminals: g.terminals.filter(y => y !== t) }), `${t} is out of ${g.name}; it keeps a copy of its forms.`, again)); x.setAttribute('aria-label', `Take ${t} out of the group`); c.appendChild(x); }
        tc.appendChild(c);
      });
      if (!ro) {
        const others = registry.filter(t => t.site === g.site && !g.terminals.includes(t.terminalId));
        const inGroup = t => { const o = groups.find(x => x.terminals.includes(t)); return o ? ` (now in ${o.name})` : ''; };
        const pick = select([['', others.length ? '+ terminal…' : `no other terminal at ${siteName(g.site)}`]].concat(others.map(t => [t.terminalId, t.terminalId + inGroup(t.terminalId)])), '');
        pick.onchange = () => { if (pick.value) act(() => FP.groups.update(id, { terminals: g.terminals.concat(pick.value) }), `${pick.value} is in ${g.name}.`, again); };
        tc.appendChild(pick);
      }
      card.appendChild(set('Terminals', 'a terminal is in one group at most; one taken out keeps a copy of the forms', tc));
      card.appendChild(set('Forms on their home screen', 'in this order; users see only these', formList(g.forms, g.site, list => act(() => FP.groups.update(id, { forms: list }), null, again), ro)));
      card.appendChild(set('Stays signed in for', 'without a tap; then the next person signs in. Every save shows who it is saved as.', signedInSelect(g.signedInFor, m => act(() => FP.groups.update(id, { signedInFor: m }), 'Saved: the terminals pick it up when they next load their settings.', again), ro)));
      card.appendChild(set('Who signs in', 'supervisors only: a shared terminal; its forms need a Who did it field', signInSelect(g.signIn, v => act(() => FP.groups.update(id, { signIn: v }), 'Saved: the terminals pick it up when they next load their settings.', again), ro)));
      card.appendChild(set('Home form', 'shown open on the home page, e.g. a line board whose buttons open the other forms', homeSelect(g.homeForm, g.forms, v => act(() => FP.groups.update(id, { homeForm: v }), 'Saved: the terminals show it when they next go home.', again), ro)));
      card.appendChild(set('View', 'kiosk for a line or a press; admin for a desk PC with a wide screen', viewSelect(g.view, v => act(() => FP.groups.update(id, { view: v }), 'Saved: the terminals show it when they next go home.', again), ro)));
      card.appendChild(set('For', 'the lines (or other list items) these terminals work on: forms read it as HERE(); for several, the launcher asks which', forPicker(g.for, v => act(() => FP.groups.update(id, { for: v }), 'Saved: the terminals pick it up when they next load their settings.', again), ro)));
      if (await FP.folder.isTest()) card.appendChild(simulateRow(g.terminals, ro ? null : async id => { await FP.groups.update(g.id, { terminals: g.terminals.concat(id) }); }));
      else card.appendChild(set('Simulate', 'opening the launcher as one of these terminals, from this computer', el('div', 'lead', 'Only on a test folder: Admin > Test folder marks one.')));
      card.appendChild(el('p', 'lead', `Users who sign in at these terminals see these forms and nothing else. Supervisors, publishers and admins see these first, then every form at ${siteName(g.site)}.`));
      if (g.terminals.length) {
        const tbl = el('table'); const hr = el('tr'); ['Terminal', 'Last seen', 'Kernel'].forEach(h => hr.appendChild(el('th', null, h))); tbl.appendChild(hr);
        g.terminals.forEach(t => { const r = registry.find(x => x.terminalId === t) || {}; const tr = el('tr'); [t, ago(r.lastSeen), r.kernel || '?'].forEach(v => tr.appendChild(el('td', null, v))); tbl.appendChild(tr); });
        card.appendChild(set('Its terminals', null, tbl));
      }
      if (!ro) {
        const row = el('div', 'fpa-row');
        row.appendChild(btn('Make a group like this one…', 'small', () => {
          const n = prompt('Name of the new group (same site and forms, no terminals yet):', `${g.name} (2)`);
          if (n) act(() => FP.groups.create({ name: n, site: g.site, forms: g.forms, homeForm: g.homeForm || undefined, view: g.view || undefined }), `${n} is made.`, async gid => { if (ctx.refresh) await ctx.refresh(); if (gid && ctx.openPlace) ctx.openPlace('group', gid); });
        }));
        row.appendChild(btn('Break up the group', 'small', () => { if (!confirm(`Break up ${g.name}? Each of its terminals keeps a copy of its forms.`)) return; act(() => FP.groups.remove(id), `${g.name} is broken up.`, async () => { if (ctx.refresh) await ctx.refresh(); host.replaceChildren(el('div', 'fpe-empty', `${g.name} is broken up; its terminals are on the map under ${siteName(g.site)}.`)); }); }));
        card.appendChild(row);
      }
      return { isDirty: () => false };
    }

    if (kind === 'terminal') {
      const registry = (md && md.registry) || await FP.identity.all();
      const groups = (md && md.groups) || await FP.groups.list();
      const tset = (md && md.termSet) || await FP.groups.terminals();
      const t = registry.find(x => x.terminalId === id) || { terminalId: id };
      const ts = tset.get(id) || { name: '', forms: [] };
      const g = groups.find(x => x.terminals.includes(id)) || null;
      const ro = !canPublish;
      head(`${siteName(t.site)}${g ? ' › ' + g.name : ''} › terminal`, id, [t.lastSeen ? `seen ${ago(t.lastSeen)}` : 'never seen', t.kernel ? `kernel ${t.kernel}` : null].filter(Boolean).join(' · '));
      // What it is, as it last told us (0.43): its screen, touch, keys and scanner.
      {
        const sc = t.screen;
        const lines = sc ? [
          `Screen for forms ${sc.width} × ${sc.height} (${sc.orientation})${sc.screenWidth ? `, whole screen ${sc.screenWidth} × ${sc.screenHeight}` : ''}${sc.scale && sc.scale !== 1 ? `, Windows scaling ${Math.round(sc.scale * 100)}%` : ''}`,
          sc.touch ? `Touch screen${sc.touchPoints ? ` (${sc.touchPoints} touch points)` : ''}` : 'No touch screen',
          t.scannerSeenAt ? `Scanner seen ${ago(t.scannerSeenAt)}` : 'No scanner seen',
          t.keysSeenAt ? `Real keys seen ${ago(t.keysSeenAt)}` : 'No real keys seen yet',
          `Measured ${ago(sc.at)}`,
        ] : ['Not measured yet: it measures itself the next time it starts on 0.43 or later.'];
        const box = el('div', 'box');
        lines.forEach(x => box.appendChild(el('div', null, x)));
        card.appendChild(set('This device', 'as it last told us; it measures again whenever it starts or its window changes size', box));
      }
      {
        const ts2 = tset.get(id) || {};
        const kb = select([['auto', 'Auto: when a field is tapped with a finger'], ['always', 'Always: every field'], ['never', 'Never: it has a keyboard']], ts2.keyboard || 'auto');
        kb.disabled = ro;
        kb.onchange = () => act(() => FP.groups.setTerminal(id, { keyboard: kb.value }), 'Keyboard saved: the terminal picks it up when it next opens a form.', again);
        card.appendChild(set('On-screen keyboard', 'numbers get a number pad, text a full keyboard; a field can turn it off (a scanned rack ID)', kb));
        const gIn = (await FP.groups.list().catch(() => [])).find(x => x.terminals.includes(id));
        card.appendChild(gIn ? set('Stays signed in for', `from ${gIn.name}`, el('div', null, `${(gIn.signedInFor || 15)} minutes without a tap`))
          : set('Stays signed in for', 'without a tap; then the next person signs in', signedInSelect(ts2.signedInFor, m => act(() => FP.groups.setTerminal(id, { signedInFor: m }), 'Saved.', again), ro)));
        card.appendChild(gIn ? set('Who signs in', `from ${gIn.name}`, el('div', null, gIn.signIn === 'supervisors' ? 'Supervisors only' : 'Anyone'))
          : set('Who signs in', 'supervisors only: a shared terminal; its forms need a Who did it field', signInSelect(ts2.signIn, v => act(() => FP.groups.setTerminal(id, { signIn: v }), 'Saved.', again), ro)));
      }
      if (!ro) {
        const ni = input(ts.name || '', { placeholder: 'e.g. Press 3', autocomplete: 'off' });
        const nr = el('div', 'fpa-row'); nr.append(ni, btn('Save', 'small', () => act(() => FP.groups.setTerminal(id, { name: ni.value }), 'Saved.', again)));
        card.appendChild(set('Name on the map', 'optional', nr));
      }
      const gb = el('div', 'box');
      if (g) {
        gb.appendChild(el('div', null, `In the group ${g.name}: its forms and who uses them come from the group.`));
        if (!ro) gb.appendChild(btn('Take it out of the group', 'small', () => act(() => FP.groups.leave(id), `${id} is out of ${g.name}; it keeps a copy of the group's forms.`, again)));
      } else gb.appendChild(el('div', null, 'In no group: it has its own forms, below.'));
      if (!ro) {
        const here = groups.filter(x => x.site === t.site && (!g || x.id !== g.id));
        if (here.length) {
          const mv = select([['', g ? 'Move to another group…' : 'Put it in a group…']].concat(here.map(x => [x.id, x.name])), '');
          mv.onchange = () => { const to = here.find(x => x.id === mv.value); if (to) act(() => FP.groups.update(to.id, { terminals: to.terminals.concat(id) }), `${id} is in ${to.name}.`, again); };
          gb.appendChild(mv);
        }
      }
      card.appendChild(set('Group', null, gb));
      if (await FP.folder.isTest()) card.appendChild(simulateRow([id], null));
      else card.appendChild(set('Simulate', null, el('div', 'lead', 'Only on a test folder: Admin > Test folder marks one.')));
      card.appendChild(set(g ? `Its forms · from ${g.name}` : 'Its forms', g ? null : 'in this order; users see only these', formList(g ? g.forms : ts.forms, t.site, list => act(() => FP.groups.setTerminal(id, { forms: list }), null, again), ro || !!g)));
      if (g) card.appendChild(set('Home form and view', `from ${g.name}`, el('div', null, `${g.homeForm && g.homeForm !== 'none' ? formTitle(g.homeForm) : 'No home form'} · ${g.view === 'admin' ? 'Admin view' : 'Kiosk view'}`)));
      else {
        card.appendChild(set('Home form', 'shown open on the home page, e.g. a line board whose buttons open the other forms', homeSelect(ts.homeForm, ts.forms, v => act(() => FP.groups.setTerminal(id, { homeForm: v }), 'Saved: it shows it when it next goes home.', again), ro)));
        card.appendChild(set('View', 'kiosk for a line or a press; admin for a desk PC with a wide screen', viewSelect(ts.view, v => act(() => FP.groups.setTerminal(id, { view: v }), 'Saved: it shows it when it next goes home.', again), ro)));
      }
      // What it is for (0.60): its own setting wins over its group's (one terminal of a group on one line).
      card.appendChild(set('For', g ? `its own, or as ${g.name}` : 'the lines (or other list items) it works on: forms read it as HERE(); for several, the launcher asks which',
        forPicker(ts.for, v => act(() => FP.groups.setTerminal(id, { for: v }), 'Saved: it picks it up when it next loads its settings.', again), ro, g && g.for ? g.for : null)));
      card.appendChild(set('Site', null, el('div', 'lead', `${siteName(t.site)}. A terminal's site is kept on that machine; moving it to another site is done on that terminal, and takes it out of its group.`)));
      if (isAdmin && t.lastSeen) card.appendChild(btn('Take it off the list', 'small', () => {
        if (!confirm(`Take ${id} off the list? Do this for a terminal that is gone or replaced; its ID can then be used again.`)) return;
        act(async () => { if (g) await FP.groups.leave(id); await FP.identity.forget(id); }, `${id} is off the list.`, async () => { if (ctx.refresh) await ctx.refresh(); host.replaceChildren(el('div', 'fpe-empty', `${id} is off the list.`)); });
      }));
      return { isDirty: () => false };
    }
    head(null, 'Nothing here', '');
    return { isDirty: () => false };
  }
  FP.editor.places = { pane: places };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-admin'] = '0.65.0';
})();
