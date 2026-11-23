/* Form Platform: the editor (step 25)
 * Load after fp-map.js. Runs editor.html.
 *
 * One app edits every definition in the library. Most people will use it for
 * forms, but structures and functions are edited here too (saved fields and
 * groups are gone, 0.48).
 *
 *   Left:  the library, by kind, with each definition's state (loaded, another
 *          site, trial, retired, not loaded) and a search box.
 *   Right: the open definition. Edit is the visual editor where one exists
 *          (structures now; forms and functions in the next steps); Code is the
 *          definition as JSON, for every kind; History restores or promotes a
 *          version; Used by and the form map show what it touches.
 *
 * Every change is checked as you go with the same checks publish runs, so the
 * Publish button only lights up when the definition would be accepted.
 *
 * FP.editor.editStructure(id, opts) opens the structure editor over whatever is
 * on screen and resolves with { id, container } once it is published (or null).
 * The form editor uses it when a field's "saves to" needs a new structure or
 * container.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.defs || !FP.map) throw new Error('Load fp-map.js before fp-editor.js');

  const KIND_ORDER = ['form', 'structure', 'function', 'session-type'];
  // What + Add offers, each with the colour it has everywhere in the editor. Saved fields and groups are
  // retired: ones already published still show, under Older, and still work. Session types aren't shown.
  const ADDABLE = [
    ['form', '#2a78d6', 'A form', 'A screen people fill in, or a dashboard to look at'],
    ['structure', '#0e7490', 'A structure', 'A kind of thing you keep records of: racks, checks, deliveries'],
    ['function', '#7c3aed', 'A function', 'A calculation or a lookup that forms and structures call by name'],
  ];
  const KIND_COLOR = { form: '#2a78d6', structure: '#0e7490', function: '#7c3aed', media: '#b45309', 'session-type': '#94a3b8', field: '#94a3b8', group: '#94a3b8' };
  const OLDER = ['session-type'];
  const KIND_TITLE = { form: 'Forms', structure: 'Structures', function: 'Functions', 'session-type': 'Session types', field: 'Saved fields', group: 'Groups' };
  const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
  const SLUG_RE = /^[a-z][a-z0-9-]{0,39}$/;
  const FN_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
  const clone = x => (x == null ? x : JSON.parse(JSON.stringify(x)));
  const el = (tag, cls, text) => FP.dom.el(tag, cls, text);   // one copy, in fp-core (0.50)
  const btn = (label, cls, onclick) => { const b = el('button', cls, label); b.type = 'button'; if (onclick) b.onclick = onclick; return b; };
  const input = (value, attrs) => { const i = el('input'); i.value = value == null ? '' : value; Object.assign(i, attrs || {}); return i; };
  const select = (options, value) => {
    const s = el('select');
    options.forEach(([v, t]) => { const o = el('option', null, t); o.value = v; s.appendChild(o); });
    s.value = value == null ? '' : value;
    return s;
  };

  const CSS = `
  *{box-sizing:border-box}
  body{margin:0;background:#f4f6f8;color:#1b1f24;font:15px/1.45 system-ui,"Segoe UI",sans-serif}
  .fpe-bar{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:8px;padding:4px 12px;min-height:40px;box-sizing:border-box;background:#1b2633;color:#fff}
  .fpe-bar h1{font-size:15px;margin:0 6px 0 0;flex:1 1 auto}
  .fpe-bar .meta{font-size:12px;color:#c6d0dc;white-space:nowrap}
  .fpe-bar button{font:inherit;font-size:13px;min-height:30px;padding:3px 10px;border-radius:8px;border:1px solid #4a5a6c;background:#26364a;color:#fff;cursor:pointer;white-space:nowrap}
  .fpe-app{display:grid;grid-template-columns:280px minmax(0,1fr);gap:12px;padding:12px;align-items:start}
  .fpe-app.nolib{grid-template-columns:34px minmax(0,1fr)}
  .fpe-app.nolib>.fpe-lib{display:none}
  .fpe-app>.fpe-libtab{display:none}
  .fpe-app.nolib>.fpe-libtab{display:block;position:sticky;top:52px;writing-mode:vertical-rl;font:inherit;font-size:13px;padding:12px 6px;border:1px solid #d9dee5;border-radius:10px;background:#fff;color:#1b2633;cursor:pointer}
  .fpe-app.nolib>.fpe-libtab:hover{background:#f4f6f8}
  .fpe-libhead{display:flex;align-items:center;justify-content:space-between;margin:-2px 0 6px}
  .fpe-libhead b{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#5b6573}
  .fpe-libhead button{font:inherit;font-size:12px;padding:2px 8px;border:1px solid #d9dee5;border-radius:6px;background:#fff;color:#3b4552;cursor:pointer}
  @media (max-width:900px){.fpe-app{grid-template-columns:1fr}}
    .fpe-lib{position:sticky;top:52px;background:#fff;border:1px solid #d9dee5;border-radius:12px;padding:10px;max-height:calc(100vh - 66px);overflow:auto}
  .fpe-lib input{width:100%;font:inherit;padding:8px 10px;border:1px solid #c9d0d9;border-radius:8px;margin-bottom:8px}
  .fpe-kind{margin-bottom:8px}
  .fpe-libtop{display:flex;gap:6px;margin-bottom:8px}.fpe-libtop input{margin:0;flex:1 1 auto;min-width:0}
  .fpe-add{font:inherit;font-weight:700;white-space:nowrap;border:1px solid #1f5fbf;background:#1f5fbf;color:#fff;border-radius:8px;padding:6px 12px;cursor:pointer}
  .fpe-addmenu{border:1px solid #d9dee5;border-radius:10px;background:#fbfcfd;padding:6px;margin-bottom:8px;display:flex;flex-direction:column;gap:4px}
  .fpe-addmenu button{display:flex;flex-direction:column;align-items:flex-start;text-align:left;font:inherit;padding:7px 10px;border:1px solid #e3e7ec;border-left:5px solid var(--c);border-radius:8px;background:#fff;cursor:pointer}
  .fpe-addmenu button:hover{background:#f3f7fd}.fpe-addmenu small{color:#5b6573;font-size:11px}
  .fpe-libbar{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-bottom:8px}
  .fpe-libbar .chip{font:inherit;font-size:12px;min-height:26px;padding:1px 9px;border:1px solid #d9dee5;border-radius:999px;background:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
  .fpe-libbar .chip i{width:8px;height:8px;border-radius:50%;background:var(--c)}
  .fpe-libbar .chip.on{background:#1b2633;border-color:#1b2633;color:#fff}
  .fpe-libbar select{font:inherit;font-size:12px;margin-left:auto;padding:2px 4px;border:1px solid #d9dee5;border-radius:6px;background:#fff}
  .fpe-lib .fpe-item{position:relative;padding-left:12px}
  .fpe-lib .fpe-map .fpe-item{padding-left:6px}.fpe-lib .fpe-map .fpe-item::before{display:none}
  .fpe-lib .fpe-item::before{content:"";position:absolute;left:2px;top:6px;bottom:6px;width:4px;border-radius:2px;background:var(--c)}
  .fpe-item .k{font-size:10px;font-weight:700;color:#5b6573;text-transform:uppercase;letter-spacing:.03em}
  @media (min-width:901px){.fpe-app:not(.nolib){grid-template-columns:340px minmax(0,1fr)}}
  .fpe-libtools{display:flex;justify-content:flex-end;gap:6px;margin:-2px 0 6px}
  .fpe-libtools button{font:inherit;font-size:12px;padding:2px 8px;border:1px solid #d9dee5;border-radius:6px;background:#fff;color:#3b4552;cursor:pointer}
  .fpe-maphead{display:flex;align-items:baseline;gap:6px;width:100%;margin:10px 0 4px;padding:4px 2px;border:0;background:none;font:inherit;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#3b4552;text-align:left;cursor:pointer;border-radius:6px}
  .fpe-maphead:hover{background:#eef1f5}.fpe-maphead i{font-style:normal;width:12px;color:#5b6573}
  .fpe-maphead b{font-weight:700}.fpe-maphead span{text-transform:none;letter-spacing:0;color:#5b6573}
  .fpe-map .fpe-mrow{display:flex;align-items:center;gap:6px;width:calc(100% - var(--ml,0px));text-align:left;font:inherit;font-size:14px;padding:5px 8px 5px 6px;border:0;border-left:4px solid var(--c);border-radius:6px;background:none;cursor:pointer;margin-bottom:2px;min-height:32px}
  .fpe-map .fpe-mrow:hover{background:#eef1f5}.fpe-map .fpe-mrow.on{background:#e3edfb}
  .fpe-map .fpe-mrow.warn{background:#fffaf2}
  .fpe-map .fpe-mrow.add{border-left-color:transparent;color:#1f5fbf;font-size:13px;min-height:28px}
  .fpe-map .fpe-mrow .cv{font-style:normal;width:14px;flex:none;color:#5b6573;font-size:11px;text-align:center}
  .fpe-map .fpe-mrow span{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fpe-map .fpe-mrow small{font-size:11px;color:#5b6573;white-space:nowrap}
  .fpe-map .fpe-mrow small.chip{background:#eef1f5;border-radius:999px;padding:0 7px}
  .fpe-map .fpe-mrow.warn small.chip{background:#fff1e0;color:#8a4b00}
  .fpe-map .fpe-mrow small.k{text-transform:uppercase;font-weight:700;font-size:10px}
  .fpe-map .fpe-mrow small.draft{color:#9a5b00}.fpe-map .fpe-mrow small.bad{color:#b42318}
  .fpe-msub{font-size:12px;color:#5b6573;margin:-3px 0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fpe-mterms,.fpe-mparts{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:0 0 4px;padding:2px 0 2px 8px;border-left:2px solid #e3e7ec}
  .fpe-mterms .k,.fpe-mparts .k{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#5b6573;width:70px;flex:none}
  .fpe-map .fpe-mrow.part{min-height:28px;font-size:13px;padding-top:3px;padding-bottom:3px}.fpe-map .fpe-mrow.part small.k{color:var(--c)}
  .fpe-tchip,.fpe-pill{font:inherit;font-size:12px;padding:1px 8px;border:1px solid #d9dee5;border-radius:999px;background:#fff;cursor:pointer;display:inline-flex;align-items:center;gap:5px;min-height:24px}
  .fpe-pill{border-color:var(--c)}.fpe-pill i{width:7px;height:7px;border-radius:50%;background:var(--c)}
  .fpe-tchip.on,.fpe-pill.on{background:#e3edfb}
  .fpe-kind h3{display:flex;align-items:center;justify-content:space-between;margin:6px 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#5b6573}
  .fpe-kind h3 button{font:inherit;font-size:12px;text-transform:none;letter-spacing:0;border:1px solid #c9d0d9;background:#fff;border-radius:6px;padding:2px 8px;cursor:pointer}
  .fpe-item{display:flex;align-items:center;gap:8px;width:100%;text-align:left;font:inherit;padding:7px 8px;border:0;border-radius:8px;background:none;cursor:pointer}
  .fpe-item:hover{background:#eef1f5}.fpe-item.on{background:#e3edfb}
  .fpe-item span{flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fpe-item small{font-size:11px;color:#5b6573;white-space:nowrap}
  .fpe-item small.bad{color:#b42318}.fpe-item small.trial{color:#8a5a00}.fpe-item small.draft{color:#9a5b00;font-weight:600}
  .fpe-draftstate{font-size:12px;color:#5b6573;white-space:nowrap}.fpe-draftstate.bad{color:#b42318}
  .fpe-draftbar{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;background:#fff7e6;border:1px solid #f1d39a;border-radius:8px;padding:8px 12px;margin:0 0 10px;font-size:13px}
  .fpe-panel{background:#fff;border:1px solid #d9dee5;border-radius:12px;padding:12px 14px;min-width:0}
  .fpe-empty{color:#5b6573;padding:30px 10px;text-align:center}
  .fpe-head{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 14px;margin-bottom:6px}
  .fpe-head h2{margin:0;font-size:20px}
  .fpe-head .ver{color:#5b6573;font-size:13px}
  .fpe [hidden],.fpe-fix[hidden]{display:none!important}
  .fpe-icons{margin-left:auto;display:flex;gap:4px;align-self:center}
  .fpe-icon{font:600 13px Consolas,"Cascadia Mono",monospace;min-width:34px;min-height:30px;padding:2px 8px;border:1px solid #d9dee5;border-radius:8px;background:#fff;color:#3b4552;cursor:pointer}
  .fpe-icon.wide{font-family:inherit}.fpe-icon.on{background:#1b2633;border-color:#1b2633;color:#fff}
  .fpe-fix{font:inherit;font-size:13px;font-weight:700;min-height:36px;padding:4px 12px;border:1px solid #f3b0a8;border-radius:999px;background:#fde3e0;color:#b42318;cursor:pointer}
  .fpe-tabs{display:flex;gap:2px;border-bottom:2px solid #d9dee5;margin:10px 0 14px;overflow-x:auto}
  .fpe-tabs button{font:inherit;font-weight:600;min-height:42px;padding:6px 14px;border:0;background:none;color:#5b6573;border-bottom:3px solid transparent;margin-bottom:-2px;cursor:pointer;white-space:nowrap}
  .fpe-tabs button.on{color:#1f5fbf;border-bottom-color:#1f5fbf}
  .fpe-sec{margin:0 0 18px}
  .fpe-sec>h3{margin:0 0 4px;font-size:15px}
  .fpe-sec>p{margin:0 0 8px;color:#5b6573;font-size:13px}
  .fpe-row{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;margin-bottom:6px}
  .fpe-row label{display:flex;flex-direction:column;gap:3px;font-size:12px;font-weight:600;color:#5b6573}
  .fpe input,.fpe select,.fpe textarea{font:inherit;font-size:14px;padding:7px 9px;border:1px solid #c9d0d9;border-radius:8px;background:#fff;color:#1b1f24;min-height:38px}
  .fpe input.bad,.fpe textarea.bad{border-color:#b42318;background:#fff6f5}
  .fpe .err{color:#b42318;font-size:12px;font-weight:400}
  .fpe button.small{font:inherit;font-size:13px;min-height:34px;padding:4px 10px;border:1px solid #c9d0d9;border-radius:8px;background:#fff;cursor:pointer}
  .fpe button.primary{font:inherit;font-weight:700;min-height:42px;padding:6px 18px;border:0;border-radius:10px;background:#1f5fbf;color:#fff;cursor:pointer}
  .fpe button.primary:disabled{background:#9aa6b5;cursor:not-allowed}
  .fpe button.ghost{font:inherit;min-height:42px;padding:6px 14px;border:1px solid #c9d0d9;border-radius:10px;background:#fff;cursor:pointer}
  .fpe-table{width:100%;border-collapse:collapse}
  .fpe-table th{text-align:left;font-size:12px;color:#5b6573;font-weight:600;padding:4px 6px;border-bottom:1px solid #d9dee5}
  .fpe-table td{padding:4px 6px;vertical-align:top;border-bottom:1px solid #eef1f5}
  .fpe-table td input,.fpe-table td select{width:100%}
  .fpe-hint{font-size:12px;color:#5b6573}
  .fpe-sheetwrap{overflow-x:auto;border:1px solid #d9dee5;border-radius:10px}
  .fpe-grid{border-collapse:separate;border-spacing:0;min-width:100%}
  .fpe-grid td,.fpe-grid th{padding:6px 8px;border-right:1px solid #eef1f5;border-bottom:1px solid #eef1f5;vertical-align:top;min-width:190px;max-width:240px;font-size:13px}
  .fpe-grid th.side{position:sticky;left:0;z-index:1;min-width:120px;max-width:120px;background:#f7f8fa;text-align:left;font-size:12px;color:#5b6573;font-weight:600}
  .fpe-grid td input,.fpe-grid td select{width:100%}
  .fpe-grid td.idcol{background:#fffaf0}
  .fpe-grid tr.set.name td{font-size:15px}
  .fpe-grid tr.set.act td{border-bottom:2px solid #d9dee5}
  .fpe-grid tr.band td,.fpe-grid tr.band th{background:#f7f8fa}
  .fpe-grid tr.data td{font-family:Consolas,"Cascadia Mono",monospace;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .fpe-grid .fpe-in{display:flex;flex-direction:column;gap:2px;font-size:12px;font-weight:600;color:#5b6573;margin-bottom:4px}
  .fpe-pick{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
  .fpe-chip{font:inherit;font-size:12px;min-height:28px;padding:2px 9px;border:1px solid #c9d0d9;border-radius:999px;background:#fff;cursor:pointer;color:#1b1f24}
  .fpe-chip.container,.fpe-chip.from{border-color:#9ebce8;background:#f1f6fd}
  .fpe-chip.calculated{border-color:#b9b0f0;background:#f6f4ff}
  .fpe-chip.fact{border-color:#d9dee5;background:#f7f8fa}
  .fpe-chip.status{border-color:#9fd19c;background:#f0f9ef}
  .fpe-chip.action{border-color:#e7b56b;background:#fff7ea}
  .fpe-chip.on{background:#1f5fbf;border-color:#1f5fbf;color:#fff}
  .fpe-warn{color:#8a5a00;font-size:12px}
  .fpe-tag{display:inline-block;font-size:11px;font-weight:700;padding:1px 8px;border-radius:999px;color:#1b1f24;white-space:nowrap}
  .fpe-probs{margin:0 0 12px;padding:10px 12px;border-radius:10px;background:#fde8e6;color:#7a1a12;font-size:13px}
  .fpe-probs.ok{background:#e5f4e4;color:#1a5c1a}
  .fpe-probs ul{margin:4px 0 0;padding-left:18px}
  .fpe-foot{position:sticky;bottom:0;display:flex;flex-wrap:wrap;gap:8px 10px;align-items:center;padding:12px 0 4px;background:linear-gradient(rgba(255,255,255,0),#fff 30%)}
  .fpe-foot input{flex:1 1 220px}
  .fpe-chips{display:flex;flex-wrap:wrap;gap:6px}
  .fpe-chips button{font:inherit;font-size:13px;min-height:34px;padding:4px 12px;border:1px solid #c9d0d9;border-radius:999px;background:#fff;cursor:pointer}
  .fpe-chips button.on{background:#1f5fbf;border-color:#1f5fbf;color:#fff}
  .fpe-chips button.off{border-style:dashed;color:#8a94a3}.fpe-chips button.on.off{background:#8a94a3;border-color:#8a94a3;color:#fff}
  .fpe-note{background:#e8f0fb;color:#1d3f73;border-radius:10px;padding:10px 12px;font-size:13px;margin-bottom:12px}
  .fpe-hist td{padding:6px 8px;border-bottom:1px solid #eef1f5;font-size:13px}
  .fpe-sheet{position:fixed;inset:0;z-index:8500;background:rgba(15,20,25,.45);display:flex;justify-content:flex-end}
  .fpe-sheet>.fpe-panel{width:min(980px,100%);height:100%;overflow:auto;border-radius:0}
  .fpe-msg{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9100;background:#1a7f37;color:#fff;padding:12px 20px;border-radius:12px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.2)}
  .fpe-msg.bad{background:#b42318}
  .fpe-bar .fpe-adminbtn.on{background:#fff;color:#1b2633}
  .fpe-update{background:#e8f0fb;color:#1d3f73;padding:10px 16px;font-size:14px;border-bottom:1px solid #c7d7ef}
  .fpe-update>div{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}
  .fpe-update>div.bad{color:#7a1a12}
  .fpe-update button.primary{font:inherit;font-weight:700;min-height:38px;padding:4px 16px;border:0;border-radius:10px;background:#1f5fbf;color:#fff;cursor:pointer}`;
  function injectCss() {
    if (document.getElementById('fp-editor-css')) return;
    const s = el('style'); s.id = 'fp-editor-css'; s.textContent = CSS; document.head.appendChild(s);
  }
  // Nothing fails silently in the editor (0.53.3): an error nobody caught shows as a message.
  if (typeof window !== 'undefined' && !window.__fpeErrors) {
    window.__fpeErrors = true;
    window.addEventListener('unhandledrejection', e => { const m = e.reason && e.reason.message || String(e.reason || ''); if (m) toast(`Something went wrong: ${m}`, true); });
    window.addEventListener('error', e => { if (e.message) toast(`Something went wrong: ${e.message}`, true); });
  }
  function toast(text, bad) { const t = el('div', 'fpe-msg' + (bad ? ' bad' : ''), text); document.body.appendChild(t); setTimeout(() => t.remove(), bad ? 9000 : 2200); }

  /* ---------- Sites: all, or a list ---------- */
  async function sitesPicker(def, onChange) {
    const wrap = el('div', 'fpe-chips');
    const every = await FP.sites.list().catch(() => []);
    const paint = () => {
      wrap.replaceChildren();
      const cur = Array.isArray(def.sites) && def.sites.length ? def.sites : ['all'];
      // Sites that are off show only where this already names them, greyed, so they can be taken out.
      const sites = every.filter(s => s.active || cur.includes(s.id));
      const all = btn('All sites', cur.includes('all') ? 'on' : '', () => { def.sites = ['all']; paint(); onChange(); });
      wrap.appendChild(all);
      sites.forEach(s => {
        const on = !cur.includes('all') && cur.includes(s.id);
        const b = wrap.appendChild(btn(`${s.name} (${s.id})${s.active ? '' : ' · off'}`, (on ? 'on' : '') + (s.active ? '' : ' off'), () => {
          let next = cur.includes('all') ? [] : cur.slice();
          next = on ? next.filter(x => x !== s.id) : next.concat(s.id);
          def.sites = next.length ? next : ['all'];
          paint(); onChange();
        }));
        if (!s.active) b.title = 'This site is turned off (Admin, Sites). Tap to take it out.';
      });
    };
    paint();
    return wrap;
  }

  /* A formula box that shows its syntax error (or an unknown function) as you type. */
  /* Chips to tap into a box. pick(text) inserts it. Each chip: [text, kind, insert?]. */
  function chips(list, pick) {
    const bar = el('div', 'fpe-pick');
    list.forEach(([text, kind, ins]) => {
      const c = btn(text, 'fpe-chip ' + (kind || ''));
      c.title = kind === 'action' ? `the action ${text}` : kind ? `${kind}` : '';
      c.onmousedown = e => e.preventDefault();   // keep the cursor in the box
      c.onclick = () => pick(ins != null ? ins : text);
      bar.appendChild(c);
    });
    return bar;
  }

  /* A formula box that shows its syntax error, an unknown function, or a name it can't read, as you type.
   * help (optional): { names: () => [[name, kind]], actions: () => [action] } — shown as chips while the
   * box has the cursor; tapping one inserts it. A name that isn't one of names() is flagged (not refused:
   * a form that saves it may come later). */
  /* ---------- A formula box: coloured as you type, with what each function takes, and plain messages ----------
   * Colours: functions purple (library functions teal), names this box can read blue, names it can't
   * red and underlined, text green, numbers orange. Inside a function's brackets, a line shows what
   * goes there, with the part being typed in bold. */
  const FX_CSS = `
  .fpe-fx{position:relative}
  .fpe-fx-hl{position:absolute;pointer-events:none;white-space:pre;overflow:hidden;box-sizing:border-box;border-color:transparent!important;background:#fff;color:#1b1f24}
  .fpe-fx input.fpe-fx-in{position:relative;z-index:1;background:transparent!important;color:transparent!important;caret-color:#1b1f24}
  .fpe-fx input.fpe-fx-in::placeholder{color:#8a94a3}
  .fpe-fx input.fpe-fx-in::selection{background:rgba(31,95,191,.25);color:transparent}
  .fpe-fx.bad .fpe-fx-hl{background:#fff6f5}
  .fx-fn{color:#7c3aed;font-weight:600}.fx-lib{color:#0e7490;font-weight:600}
  .fx-name{color:#1f5fbf}.fx-member{color:#334155}.fx-lit{color:#b45309;font-weight:600}
  .fx-unknown{color:#b42318;text-decoration:underline wavy #e5484d;text-underline-offset:3px}
  .fx-str{color:#15803d}.fx-num{color:#c2410c}.fx-op{color:#64748b}
  .fx-err{color:#b42318;background:#fde2df;border-radius:3px}
  .fpe-fx-sig{font-size:12px;color:#3b4552;background:#f4f1fe;border:1px solid #e1dafc;border-radius:7px;padding:4px 8px;margin-top:4px;line-height:1.45}
  .fpe-fx-sig code{font:600 12px Consolas,"Cascadia Mono",monospace;color:#5b21b6}
  .fpe-fx-sig code b{background:#ddd3fb;border-radius:3px;padding:0 2px}
  .fpe-fx-sig em{font-style:normal;color:#5b6573}`;
  const fxEsc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const isFn = n => FP.fn.builtins().includes(String(n).toUpperCase()) || !!FP.fn.get(n);
  /* The syntax error in plainer words, and where it is (a position in the text as typed, or null). */
  function explainError(msg, raw) {
    const lead = (/^\s*=?\s*/.exec(raw) || [''])[0].length;   // the parser reads the text trimmed, without a leading =
    const posOf = m => { const p = /position (\d+)/.exec(m); return p ? lead + Number(p[1]) - 1 : null; };
    let m;
    if ((m = /^Unexpected "(AND|OR)"/i.exec(msg))) return { text: `${m[1].toUpperCase()} is a function here, as in Excel: ${m[1].toUpperCase()}(first test, second test)`, at: posOf(msg) };
    if ((m = /^Unexpected "NOT"/i.exec(msg))) return { text: 'NOT is a function: NOT(test)', at: posOf(msg) };
    if (/ends too early/.test(msg)) return { text: 'Something is missing at the end: a value after an operator, or a closing )', at: raw.length ? raw.length - 1 : null };
    if ((m = /^Expected a closing \) for (\S+)/.exec(msg))) return { text: `${m[1]}( is missing its closing )`, at: posOf(msg) };
    if (/^Expected a closing \)/.test(msg)) return { text: 'A ( is missing its closing )', at: posOf(msg) };
    if (/^Expected a closing \]/.test(msg)) return { text: 'A [ is missing its closing ]', at: posOf(msg) };
    if (/missing its closing "/.test(msg)) return { text: 'A piece of text is missing its closing "', at: posOf(msg) };
    if ((m = /^Unexpected ","/.exec(msg))) return { text: 'A comma only goes between the inputs of a function, inside its brackets', at: posOf(msg) };
    if ((m = /^Unexpected "\)"/.exec(msg))) {
      const at = posOf(msg);
      const before = raw.slice(0, at == null ? raw.length : at).trimEnd();
      const open = (before.match(/\(/g) || []).length - (before.match(/\)/g) || []).length;
      if (/,$/.test(before)) return { text: 'An input is missing after the comma: put a value there, or take the comma out', at };
      if (open <= 0) return { text: 'There is a ) with no ( to close', at };
      return { text: 'A value is missing before this )', at };
    }
    if ((m = /^Unexpected "(.+?)" at/.exec(msg))) return { text: `"${m[1]}" isn't expected there${/^[A-Za-z_]/.test(m[1]) ? ': is an operator (+, &, =…) or a comma missing before it?' : ''}`, at: posOf(msg) };
    return { text: msg, at: posOf(msg) };
  }
  /* Which function's brackets the cursor is in, and which input: { name, arg } or null. */
  function callAt(toks, caret) {
    const stack = [];
    let prev = null;
    for (const t of toks) {
      if (t.start >= caret) break;
      if (t.type === 'space') continue;
      if (t.type === 'op' && t.text === '(') stack.push({ name: prev && prev.type === 'name' ? prev.text : null, arg: 0 });
      else if (t.type === 'op' && t.text === ')') stack.pop();
      else if (t.type === 'op' && t.text === ',' && stack.length) stack[stack.length - 1].arg++;
      prev = t;
    }
    for (let k = stack.length - 1; k >= 0; k--) if (stack[k].name && isFn(stack[k].name)) return stack[k];
    // On a function's name, before its brackets: show it too.
    const on = toks.find(t => t.type === 'name' && t.start < caret && caret <= t.end);
    return on && isFn(on.text) ? { name: on.text, arg: -1 } : null;
  }
  function formulaInput(value, onChange, placeholder, help) {
    if (!document.getElementById('fp-editor-fx-css')) { const s = el('style'); s.id = 'fp-editor-fx-css'; s.textContent = FX_CSS; document.head.appendChild(s); }
    const box = el('div');
    const wrap = el('div', 'fpe-fx');
    const hl = el('div', 'fpe-fx-hl');
    const i = input(value, { placeholder: placeholder || 'formula', spellcheck: false });
    i.classList.add('fpe-fx-in');
    i.style.width = '100%';
    wrap.append(hl, i);
    const sig = el('div', 'fpe-fx-sig'); sig.hidden = true;
    const msg = el('div', 'err');
    const warn = el('div', 'fpe-warn');
    let bar = null, errAt = null;
    const known = () => (help && help.names ? new Set(help.names().map(([n]) => String(n).toLowerCase())) : null);
    /* The coloured copy behind the box, lined up with it. */
    function paint() {
      if (i.isConnected) {
        const cs = getComputedStyle(i);
        ['fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle', 'borderRadius', 'textIndent'].forEach(k => { hl.style[k] = cs[k]; });
        Object.assign(hl.style, { left: i.offsetLeft + 'px', top: i.offsetTop + 'px', width: i.offsetWidth + 'px', height: i.offsetHeight + 'px', display: 'flex', alignItems: 'center' });
      }
      const v = i.value;
      const names = known();
      const toks = FP.fn.scan(v);
      const next = k => { for (let j = k + 1; j < toks.length; j++) if (toks[j].type !== 'space') return toks[j]; return null; };
      let html = '';
      toks.forEach((t, k) => {
        let cls = '';
        const n = next(k);
        if (t.type === 'name') {
          const call = n && n.type === 'op' && n.text === '(';
          const root = t.text.split('.')[0];
          if (call) cls = FP.fn.builtins().includes(t.text.toUpperCase()) ? 'fx-fn' : FP.fn.get(t.text) ? 'fx-lib' : 'fx-unknown';
          else if (/^(true|false|waiting)$/i.test(t.text)) cls = 'fx-lit';
          else if (names && (names.has(root.toLowerCase()) || root === 'item')) cls = 'fx-name';   // an input called min is a name, not MIN; item inside FILTER, EACH, SORT
          else if (isFn(t.text)) cls = 'fx-unknown';
          else if (names) cls = names.has(root.toLowerCase()) ? 'fx-name' : 'fx-unknown';
          else cls = 'fx-name';
          if (cls === 'fx-name' && t.text.includes('.')) { html += `<span class="fx-name">${fxEsc(root)}</span><span class="fx-member">${fxEsc(t.text.slice(root.length))}</span>`; return; }
        } else if (t.type === 'str') cls = 'fx-str';
        else if (t.type === 'num') cls = 'fx-num';
        else if (t.type === 'op') cls = 'fx-op';
        else if (t.type === 'bad') cls = 'fx-err';
        if (errAt != null && t.type !== 'space' && errAt >= t.start && errAt < t.end) cls = 'fx-err';
        html += cls ? `<span class="${cls}">${fxEsc(t.text)}</span>` : fxEsc(t.text);
      });
      hl.innerHTML = `<span>${html}</span>`;   // one line inside: spaces between pieces stay
      hl.scrollLeft = i.scrollLeft;
    }
    /* What goes in the brackets the cursor is in. */
    function paintSig() {
      if (document.activeElement !== i) { sig.hidden = true; return; }
      const c = callAt(FP.fn.scan(i.value), i.selectionStart == null ? i.value.length : i.selectionStart);
      const h = c && FP.fn.help(c.name);
      if (!h) { sig.hidden = true; return; }
      const many = h.args.length && /…$/.test(h.args[h.args.length - 1]);
      const at = c.arg < 0 ? -1 : many && c.arg >= h.args.length - 1 ? Math.max(0, h.args.length - 2) : c.arg;
      const args = h.args.map((a, k) => (k === at ? `<b>${fxEsc(a)}</b>` : fxEsc(a))).join(', ');
      sig.innerHTML = `<code>${fxEsc(h.name)}(${args})</code>${h.text ? ` <em>· ${fxEsc(h.text)}</em>` : ''}${h.example && c.arg < 0 ? ` <em>· e.g. ${fxEsc(h.example)}</em>` : ''}${!h.args.length && c.arg >= 0 ? ' <em>· nothing goes in the brackets</em>' : ''}`;
      sig.hidden = false;
    }
    const check = () => {
      const v = i.value.trim();
      warn.textContent = ''; msg.textContent = ''; errAt = null;
      wrap.classList.remove('bad'); i.classList.remove('bad');
      if (v) {
        const sx = FP.fn.syntax(v);
        let bad = '';
        if (sx.error) { const e = explainError(sx.error, i.value); bad = e.text; errAt = e.at; }
        else {
          const unknown = sx.calls.find(n => !isFn(n));
          if (unknown) bad = `There's no function named ${unknown}. Check the spelling, or publish it in the library first.`;
          else {
            // Each function given the right number of inputs.
            for (const c of sx.callArgs || []) {
              const h = FP.fn.help(c.name);
              const b = FP.fn.builtins().includes(c.name.toUpperCase());
              const f = !b && FP.fn.get(c.name);
              const lim = b ? (FP.fn.argLimits ? FP.fn.argLimits(c.name) : null) : f ? { min: (f.inputs || []).length, max: (f.inputs || []).length } : null;
              if (lim && (c.args < lim.min || c.args > lim.max)) {
                const want = lim.min === lim.max ? `${lim.min}` : lim.max >= 99 ? `at least ${lim.min}` : `${lim.min} or ${lim.max}`;
                bad = `${h ? h.name : c.name} takes ${want} input${lim.max === 1 ? '' : 's'}${h && h.args.length ? ` (${h.args.join(', ')})` : ''}, not ${c.args}${h && h.example ? `: e.g. ${h.example}` : ''}`;
                break;
              }
            }
          }
          if (!bad && help && help.names) {
            const names = known();
            const fnNames = (sx.refs || []).filter(n => isFn(n) && !names.has(n.toLowerCase()));
            const strange = (sx.refs || []).filter(n => !isFn(n) && !names.has(n.toLowerCase()));
            if (fnNames.length) {
              const h = FP.fn.help(fnNames[0]);
              warn.textContent = h ? `${h.name} is a function, so it needs brackets: ${h.name}(${h.args.join(', ')})${h.example ? `, e.g. ${h.example}` : ''}.` : `${fnNames[0]} is a function, so it needs brackets after it.`;
            } else if (strange.length) warn.textContent = help.unknown ? `${strange.join(', ')}: ${help.unknown}. Check the spelling.` : `${strange.join(', ')}: not a value of this structure. Check the spelling; if a form will save it later, this is fine.`;
          }
        }
        if (bad) { i.classList.add('bad'); wrap.classList.add('bad'); msg.textContent = bad; }
      }
      paint(); paintSig();
    };
    const insert = text => {
      const a = i.selectionStart == null ? i.value.length : i.selectionStart, b = i.selectionEnd == null ? a : i.selectionEnd;
      const before = i.value.slice(0, a), after = i.value.slice(b);
      const pad = before && !/[\s(,[]$/.test(before) ? ' ' : '';
      i.value = before + pad + text + (after && !/^[\s),\]]/.test(after) ? ' ' : '') + after;
      const at = (before + pad + text).length;
      i.setSelectionRange(at, at);
      check(); onChange(i.value.trim());
    };
    if (help) {
      i.addEventListener('focus', () => {
        if (bar) bar.remove();
        const list = (help.names ? help.names() : []).concat((help.actions ? help.actions() : []).map(a => [a, 'action', `"${a}"`]));
        bar = chips(list, insert);
        box.appendChild(bar);   // under the messages, so a message stays next to the box
      });
      i.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== i && bar) { bar.remove(); bar = null; } }, 150));
    }
    i.addEventListener('focus', () => { paint(); paintSig(); });
    i.addEventListener('blur', () => setTimeout(paintSig, 150));
    ['keyup', 'click', 'select'].forEach(ev => i.addEventListener(ev, paintSig));
    i.addEventListener('scroll', () => { hl.scrollLeft = i.scrollLeft; });
    i.addEventListener('keydown', () => requestAnimationFrame(() => { hl.scrollLeft = i.scrollLeft; }));
    i.oninput = () => { check(); onChange(i.value.trim()); };
    check();
    // Line the colours up once the box is on the page (and again if its size changes).
    let tries = 0;
    const settle = () => { if (i.isConnected) { paint(); if (window.ResizeObserver) new ResizeObserver(() => paint()).observe(i); } else if (tries++ < 50) setTimeout(settle, 40); };
    setTimeout(settle, 0);
    box.append(wrap, sig, msg, warn);
    return box;
  }

  /* ---------- The structure editor ---------- */
  /* Empty parts the editor adds while you work are left out of what is checked and published. */
  function tidy(draft, kind) {
    if (kind === 'form' && FP.editor.tidyForm) return FP.editor.tidyForm(draft);
    const d = clone(draft);
    ['calculated', 'sessions'].forEach(k => { if (d[k] && typeof d[k] === 'object' && !Array.isArray(d[k]) && !Object.keys(d[k]).length) delete d[k]; });
    if (Array.isArray(d.status) && !d.status.length) delete d.status;
    return d;
  }

  /* ---------- One open definition ---------- */
  async function panel(host, kind, id, opts) {
    opts = opts || {};
    const doc = FP.defs.get(kind, id);
    const isNew = !doc;
    const label = FP.defs.LABELS[kind];
    const draft = clone(opts.def || (doc ? doc.def : null) || (kind === 'structure' ? { itemId: { made: 'entered' }, containers: {}, sites: ['all'] } : kind === 'form' ? { title: id.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase()), sites: ['all'], fields: [{ name: 'notes', label: 'Notes', control: 'textarea' }] } : { sites: ['all'] }));
    if (!draft.sites) draft.sites = ['all'];
    // A form written before sources opens in sources terms (it saves exactly the same way).
    if (kind === 'form' && FP.editor.toSources) FP.editor.toSources(draft);
    const base = doc ? doc.version : null;
    let dirty = !!isNew || !!opts.dirty;
    // A draft: kept in the data folder as you go, problems and all, until it is published or thrown away.
    let touched = false, draftTimer = null, draftSaved = opts.draft || null;
    const draftState = el('span', 'fpe-draftstate');
    let tab = ['edit', 'history', 'uses'].includes(opts.tab) ? opts.tab : 'edit';
    host.replaceChildren();
    const root = el('div', 'fpe');
    host.appendChild(root);

    // Forms, structures and functions keep the top out of the way: sites live in the settings on the map's first
    // row, problems are marked on the map's rows, and Code and History are small icons beside the title.
    const compact = (kind === 'form' && !!FP.editor.formEditor) || (kind === 'structure' && !!FP.editor.structureMap) || (kind === 'function' && !!FP.editor.functionEditor);
    const head = el('div', 'fpe-head');
    head.append(el('h2', null, (kind === 'form' ? draft.title : draft.label) || id), el('span', 'ver', `${label} ${id} · ${isNew ? 'new, not published yet' : `version ${doc.version}${doc.retired ? ' (retired)' : ''}`}`));
    const icons = el('span', 'fpe-icons');
    head.appendChild(icons);
    root.appendChild(head);
    const sitesRow = el('div', 'fpe-row');
    sitesRow.appendChild(el('span', 'fpe-hint', 'Used at:'));
    root.appendChild(sitesRow);
    const probs = el('div');
    root.appendChild(probs);
    const tabs = el('div', 'fpe-tabs');
    root.appendChild(tabs);
    if (compact) { sitesRow.hidden = true; probs.hidden = true; tabs.hidden = true; }
    const body = el('div');
    root.appendChild(body);
    const foot = el('div', 'fpe-foot');
    const note = input('', { placeholder: 'What changed (kept with the version)' });
    const publishBtn = btn(isNew ? 'Publish' : 'Publish a new version', 'primary');
    const trialBtn = btn('Publish as trial', 'ghost');
    trialBtn.title = 'A new version that only launchers pinned to it use; everyone else stays on the current one';
    const revertBtn = btn('Undo changes', 'ghost');
    // Compact: how many problems are left (they're marked on the map); tapping it goes to the first one.
    const fixChip = btn('', 'fpe-fix', () => { if (ctx.goToProblem) ctx.goToProblem(); });
    fixChip.hidden = true;
    if (compact) foot.appendChild(fixChip);
    foot.append(note, publishBtn);
    if (kind === 'form') foot.appendChild(trialBtn);
    if (!isNew) foot.appendChild(revertBtn);
    const discardBtn = btn('Throw away the draft', 'ghost');
    discardBtn.title = 'Delete the draft kept for this; the published version (if any) stays as it is';
    foot.append(draftState, discardBtn);
    const paintDraft = (text, bad) => {
      draftState.textContent = text != null ? text : draftSaved ? `Draft kept ${new Date(draftSaved.savedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '';
      draftState.classList.toggle('bad', !!bad);
      discardBtn.hidden = !draftSaved;
    };
    paintDraft();
    if (opts.onCancel) foot.appendChild(btn('Close', 'ghost', () => { if (!dirty || confirm('Close without publishing? Your changes are lost.')) opts.onCancel(); }));
    root.appendChild(foot);

    // Checks run as you go: the same checks publish runs.
    let checkSeq = 0, lastProblems = [];
    async function recheck() {
      const seq = ++checkSeq;
      let p;
      try { p = await FP.defs.check(kind, id, tidy(draft, kind)); } catch (e) { p = [e.message]; }
      if (seq !== checkSeq) return;
      lastProblems = p;
      probs.replaceChildren();
      const box = el('div', 'fpe-probs' + (p.length ? '' : ' ok'));
      if (p.length) { box.appendChild(el('b', null, `${p.length} thing${p.length === 1 ? '' : 's'} to fix before publishing`)); const ul = el('ul'); p.slice(0, 12).forEach(x => ul.appendChild(el('li', null, x))); box.appendChild(ul); }
      else box.textContent = dirty ? 'No problems: ready to publish.' : 'No problems.';
      probs.appendChild(box);
      publishBtn.disabled = !!p.length || !dirty;
      trialBtn.disabled = !!p.length || !dirty;
      if (compact) {
        fixChip.hidden = !p.length;
        fixChip.textContent = `✗ ${p.length} to fix`;
        fixChip.title = 'Each one is marked ✗ on the map. Tap to go to the first.';
      }
      ctx.problems = p;
      if (ctx.problemsChanged) ctx.problemsChanged(p);
    }
    let t = null;
    const ctx = { id, kind, site: opts.site || null, subform: opts.subform || null, media: opts.media || null, changed() { dirty = true; clearTimeout(t); t = setTimeout(recheck, 250); keepDraft(); if (opts.onChange) opts.onChange(draft); }, onContainerAdded: opts.onContainerAdded, open: opts.open };
    // A draft is written a moment after the last change (and at once when you leave), never for nothing changed.
    function keepDraft() {
      touched = true;
      clearTimeout(draftTimer);
      paintDraft('Keeping a draft…');
      draftTimer = setTimeout(saveDraft, 1500);
    }
    async function saveDraft() {
      clearTimeout(draftTimer); draftTimer = null;
      if (!touched || !dirty) return;
      try {
        draftSaved = await FP.defs.drafts.save(kind, id, { def: clone(draft), basedOn: base, note: note.value.trim() });
        touched = false;
        paintDraft();
        window.dispatchEvent(new CustomEvent('fp-drafts'));
      } catch (e) { paintDraft(`Draft not kept: ${e.message}`, true); }
    }
    note.addEventListener('input', () => { if (dirty) keepDraft(); });
    discardBtn.onclick = async () => {
      if (!confirm(isNew ? `Throw away the draft of ${label} ${id}? It was never published, so it is gone for good.` : `Throw away the draft? ${label} ${id} stays as published (version ${doc.version}).`)) return;
      clearTimeout(draftTimer); draftTimer = null; touched = false; dirty = false;
      await FP.defs.drafts.remove(kind, id);
      draftSaved = null;
      window.dispatchEvent(new CustomEvent('fp-drafts'));
      if (isNew) { host.replaceChildren(el('div', 'fpe-empty', 'Draft thrown away. Pick something from the library, or start a new one.')); if (opts.onClosed) opts.onClosed(); }
      else if (opts.reopen) opts.reopen(kind, id, { fresh: true });
    };
    // Opened from a draft: say so, and what it was based on.
    if (opts.draft) {
      const d = opts.draft;
      const bar = el('div', 'fpe-draftbar');
      const who = d.savedBy ? `${d.savedBy.name}'s draft` : 'A draft';
      bar.appendChild(el('span', null, `${who} from ${new Date(d.savedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${d.terminal ? ` on ${d.terminal}` : ''}, not published.`));
      if (doc && d.basedOn != null && d.basedOn !== doc.version) bar.appendChild(el('b', null, ` It started from version ${d.basedOn}; version ${doc.version} has been published since, and publishing this replaces it.`));
      if (doc) bar.appendChild(btn('Open the published version instead', 'small', () => { if (opts.reopen) opts.reopen(kind, id, { fresh: true }); }));
      root.insertBefore(bar, body);
      if (d.note) note.value = d.note;
    }
    sitesRow.appendChild(await sitesPicker(draft, () => ctx.changed()));

    // Tabs
    // A form's map is its Edit tab: the whole form as one outline you edit in place.
    const TABS = [['edit', 'Edit'], ['history', 'History']].concat(compact ? [] : [['uses', kind === 'form' ? 'Map' : 'Used by']]);
    function paintTabs() {
      tabs.replaceChildren(...TABS.filter(([k]) => !(isNew && k === 'history')).map(([k, t]) => btn(t, k === tab ? 'on' : '', () => { tab = k; paintTabs(); paintBody(); })));
      if (!compact) return;
      // History as an icon beside the title; away from the editor, one icon takes you back.
      const icon = (k, glyph, tip) => { const b = btn(glyph, 'fpe-icon' + (tab === k ? ' on' : ''), () => { tab = tab === k ? 'edit' : k; paintTabs(); paintBody(); }); b.title = tip; return b; };
      icons.replaceChildren(
        ...(tab !== 'edit' ? [btn('← Back to the editor', 'fpe-icon wide', () => { tab = 'edit'; paintTabs(); paintBody(); })] : []),
        ...(isNew ? [] : [icon('history', '⟲', 'History: every version, restore one')]));
    }
    function paintBody() {
      body.replaceChildren();
      if (tab === 'edit') {
        if (kind === 'structure' && FP.editor.structureMap) body.appendChild(FP.editor.structureMap(draft, ctx));
        else if (kind === 'form' && FP.editor.formEditor) body.appendChild(FP.editor.formEditor(draft, ctx));
        else if (kind === 'function' && FP.editor.functionEditor) body.appendChild(FP.editor.functionEditor(draft, ctx));
        else body.appendChild(el('div', 'fpe-note', `${KIND_TITLE[kind]} are retired and have no editor: Admin › Clean-up takes them out.`));
      } else if (tab === 'history') {
        body.appendChild(el('div', 'fpe-hint', 'Loading…'));
        FP.defs.history(kind, id).then(h => {
          body.replaceChildren();
          const tbl = el('table', 'fpe-hist');
          h.forEach(d => {
            const tr = el('tr');
            [`v${d.version}${d.trial ? ' trial' : ''}${d.retired ? ' retired' : ''}${doc && d.version === doc.version ? ' (current)' : ''}`, d.publishedBy ? d.publishedBy.name : '?', FP.identity.label(d.terminalId), new Date(d.publishedAt).toLocaleString(), d.note || ''].forEach(v => tr.appendChild(el('td', null, v)));
            const td = el('td');
            if (doc && d.version !== doc.version && !d.trial) td.appendChild(btn('Restore', 'small', () => act(`Restore v${d.version}`, async () => { await FP.defs.restore(kind, id, d.version); return reopen(`Restored version ${d.version} as a new version.`); })));
            if (d.trial && (!doc || d.version > doc.version)) td.appendChild(btn('Promote', 'small', () => act(`Promote v${d.version}`, async () => { await FP.defs.promote(kind, id, d.version); return reopen(`Trial version ${d.version} is now the current version.`); })));
            tr.appendChild(td); tbl.appendChild(tr);
          });
          body.appendChild(tbl);
        }).catch(e => { body.replaceChildren(el('div', 'err', e.message)); });
      } else {
        const mapHost = el('div');
        body.appendChild(mapHost);
        if (kind === 'form') {
          // The map of the form as it stands in the editor, published or not. Tapping a field or button goes to it.
          const goEdit = focus => { ctx.focus = focus; tab = 'edit'; paintTabs(); paintBody(); };
          FP.map.render(mapHost, id, { doc: { id, version: base == null ? 'new' : `${base}, editing`, def: tidy(draft, kind) }, onOpen: other => (other === id ? null : opts.open && opts.open('form', other)), onField: n => goEdit({ field: n }), onButton: n => goEdit({ button: n }) });
        }
        else if (kind === 'structure' || kind === 'function') {
          const list = FP.map.usedBy(kind, id);
          const tbl = el('table', 'fpe-table');
          const hr = el('tr'); ['Where', 'What', 'How'].forEach(h => hr.appendChild(el('th', null, h))); tbl.appendChild(hr);
          list.forEach(u => { const tr = el('tr'); [u.title, u.field, u.how].forEach(v => tr.appendChild(el('td', null, v || ''))); if (u.form && opts.open) { tr.style.cursor = 'pointer'; tr.onclick = () => opts.open('form', u.form); } tbl.appendChild(tr); });
          mapHost.appendChild(list.length ? tbl : el('div', 'fpe-hint', 'Nothing uses it yet.'));
        } else {
          const deps = FP.defs.dependents(kind, id);
          mapHost.appendChild(el('div', 'fpe-hint', deps.length ? `Used by: ${deps.join(', ')}` : 'Nothing uses it yet.'));
        }
      }
    }
    async function act(what, fn) {
      try { const m = await fn(); if (m) toast(m); }
      catch (e) { toast(`${what} failed: ${(e && e.message) || e || "unknown problem"}`, true); }
    }
    function reopen(message) { dirty = false; if (opts.reopen) opts.reopen(kind, id); return message; }
    async function publish(trial) {
      if (lastProblems.length) return;
      publishBtn.disabled = trialBtn.disabled = true;
      try {
        // Signed out meanwhile (12 hours, or another window): sign in here and carry on with the publish.
        if (FP.users && !(await FP.users.current())) { toast('You are signed out. Sign in to publish; your changes are kept.', true); await FP.users.gate({ title: 'Editor' }); if (FP.editor.showUser) await FP.editor.showUser(); }
        // A form that scrolls on a terminal that runs it (0.44): a warning, not a block; some forms are meant to scroll.
        if (kind === 'form' && FP.editor.screenFit) {
          const over = (await FP.editor.screenFit(tidy(draft, kind), id).catch(() => [])).filter(x => x.spare < 0);
          if (over.length && !confirm(`${draft.title || id} scrolls on ${over.map(x => `${x.id} (${x.w}×${x.h}) by ${-x.spare} px`).join(', ')}.\n\nCompact spacing (the form's settings, with nothing picked), panels or smaller sizes can make it fit. Publish anyway?`)) { publishBtn.disabled = trialBtn.disabled = false; recheck(); return; }
        }
        const r = await FP.defs.publish(kind, id, tidy(draft, kind), { basedOn: base, note: note.value.trim() || (isNew ? 'Created in the editor' : 'Edited in the editor'), trial });
        dirty = false; touched = false; clearTimeout(draftTimer); draftTimer = null;
        await FP.defs.drafts.remove(kind, id).catch(() => {});
        window.dispatchEvent(new CustomEvent('fp-drafts'));
        toast(`Published ${label} ${id} version ${r.doc.version}${trial ? ' as a trial' : ''}.`);
        if (opts.onPublished) opts.onPublished(r.doc); else if (opts.reopen) opts.reopen(kind, id);
      } catch (e) { toast(`Not published: ${e.message}`, true); recheck(); }
    }
    publishBtn.onclick = () => publish(false);
    trialBtn.onclick = () => publish(true);
    revertBtn.onclick = async () => {
      if (dirty && !confirm(`Undo every change, back to version ${doc.version} as published? The draft is thrown away.`)) return;
      clearTimeout(draftTimer); draftTimer = null; touched = false; dirty = false;
      await FP.defs.drafts.remove(kind, id).catch(() => {});
      window.dispatchEvent(new CustomEvent('fp-drafts'));
      if (opts.reopen) opts.reopen(kind, id, { fresh: true });
    };
    paintTabs(); paintBody(); recheck();
    return { isDirty: () => dirty, draft, recheck, keep: saveDraft, unsaved: () => !!draftTimer };
  }

  /* ---------- The editor app ---------- */
  function start() {
    const mods = FP.modules || {};
    const need = FP.launchers.KERNEL.concat('fp-map', 'fp-editor', 'fp-form-editor', 'fp-help', 'fp-stress', 'fp-admin');
    const wrong = need.filter(m => mods[m] !== FP.launchers.VERSION).map(m => (mods[m]
      ? `${m}.js is version ${mods[m]}; the editor needs ${FP.launchers.VERSION}. Replace it with the new copy.`
      : `${m}.js did not load, or stopped with an error. Replace it with the new copy.`));
    if (wrong.length) { wrong.forEach(window.__fpReport); return Promise.resolve(null); }
    injectCss();
    document.title = 'Editor';
    const bar = el('div', 'fpe-bar');
    const title = el('h1', null, 'Editor');
    const term = el('span', 'meta');
    const ver = el('span', 'meta', `kernel ${FP.version}`);
    ver.title = 'The kernel release this editor runs';
    const who = btn('Sign in');
    // The Admin page: launchers and shortcuts, updates, saved records, packs, clean-up (admins only).
    const adminBtn = btn('⚙ Admin', 'fpe-adminbtn');
    adminBtn.title = 'Launchers and shortcuts, updates, saved records, packs and clean-up'; 
    // The library folds away, for more room to edit, from its own corner; a tab on the left brings it back.
    const libBtn = btn('« Hide', 'fpe-libbtn');
    libBtn.title = 'Fold the map away for more room';
    const libTab = btn('☰ Map', 'fpe-libtab');
    libTab.title = 'Show the map';
    // Help: the reference made from the platform itself (fields, formulas, what publish checks).
    const helpBtn = btn('? Help', 'fpe-adminbtn fpe-helpbtn');
    helpBtn.title = 'Every kind of field, every function, what publish checks';
    bar.append(title, ver, term, helpBtn, adminBtn, who);
    const app = el('div', 'fpe-app');
    const lib = el('div', 'fpe-lib');
    const right = el('div', 'fpe-panel');
    right.appendChild(el('div', 'fpe-empty', 'Pick something on the map, or start a new one with + Add.'));
    app.append(libTab, lib, right);
    document.body.prepend(bar, app);
    let libHidden = false;
    try { libHidden = localStorage.getItem('fpe-lib-hidden') === '1'; } catch (_) { /* best effort */ }
    // While a form is open the map folds away (0.58), for the form editor's three columns; ☰ Map brings it back,
    // and that choice is remembered (« Hide while a form is open folds it for forms again).
    let foldForForms = true, formShown = false;
    try { foldForForms = localStorage.getItem('fpe-fold-forms') !== '0'; } catch (_) { /* best effort */ }
    const paintLibBtn = () => { app.classList.toggle('nolib', libHidden || (formShown && foldForForms)); };
    const remember = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* best effort */ } };
    libBtn.onclick = () => { if (formShown) { foldForForms = true; remember('fpe-fold-forms', '1'); } else { libHidden = true; remember('fpe-lib-hidden', '1'); } paintLibBtn(); };
    libTab.onclick = () => { if (formShown && foldForForms) { foldForForms = false; remember('fpe-fold-forms', '0'); } libHidden = false; remember('fpe-lib-hidden', '0'); paintLibBtn(); };
    const showingForm = on => { formShown = !!on; paintLibBtn(); };
    paintLibBtn();

    let current = null; // { kind, id, view }
    let filter = '';
    const search = input('', { placeholder: 'Search the library' });
    search.oninput = () => { filter = search.value.trim().toLowerCase(); paintLib(); };

    // Drafts in the data folder, by kind:id; a draft of something never published shows in the library too.
    let drafts = new Map();
    async function loadDrafts() {
      try { drafts = new Map((await FP.defs.drafts.list()).map(d => [`${d.kind}:${d.id}`, d])); } catch (_) { drafts = new Map(); }
    }
    window.addEventListener('fp-drafts', async () => { await loadDrafts(); paintLib(); });
    function state(d) {
      if (d.draftOnly) return ['draft', 'draft'];
      const dr = drafts.get(`${d.kind}:${d.id}`);
      if (dr && !d.retired) return [`v${d.version} · draft`, 'draft'];
      if (d.retired) return ['retired', ''];
      if (d.gone) return ['gone', 'bad'];
      if (!d.here) return ['other site', ''];
      if (!d.loaded) return ['not loaded', 'bad'];
      return [`v${d.version}`, ''];
    }
    /* ---------- The master map (0.41): replaces the library ----------
     * Plant · Data · Forms · People (0.60). Plant: each site, its terminal groups and the terminals in none, each with
     * what it is for and its forms; a form opens to what it uses (data, documents, formulas, sub-forms). Data: the
     * structures by kind, each with the forms that use it and the lookups that read it (on no form in amber). Forms:
     * each once, with where it runs (on no terminal in amber), then the formulas. People (admins): by role, and the
     * responsibility centers. Drafts sit in their heading. */
    let mapData = null;   // sites, groups, terminals, users, loaded by refreshMap()
    let openKeys = {};
    try { openKeys = JSON.parse(localStorage.getItem('fpe-map-open') || '{}'); } catch (_) { openKeys = {}; }
    const keepOpen = () => { try { localStorage.setItem('fpe-map-open', JSON.stringify(openKeys)); } catch (_) { /* best effort */ } };
    const isOpen = (key, dflt) => (openKeys[key] == null ? dflt : openKeys[key]);
    let adding = false;
    const addBtn = btn('+ Add', 'fpe-add', () => { adding = !adding; paintLib(); });
    const foldBtn = btn('Collapse to forms', 'fpe-fold', () => {
      Object.keys(openKeys).forEach(k => { if (/^(f|role|loose|unplaced|drafts|older|people|all-)/.test(k)) delete openKeys[k]; });
      Object.keys(openKeys).forEach(k => { if (/^(site|group|term|every)/.test(k)) openKeys[k] = true; });
      ['head:people', 'head:data', 'head:forms'].forEach(k => { openKeys[k] = false; });
      openKeys['head:plant'] = true;
      keepOpen(); paintLib();
    });
    foldBtn.title = 'Every site, group and terminal open, every form closed';
    // Collapse all: every branch closed, the headings too (Plant, Data, Forms, People).
    const allBtn = btn('Collapse all', 'fpe-fold', () => {
      const walk = list => (list || []).forEach(n => { if (n.children && n.children.length) { openKeys[n.key] = false; walk(n.children); } });
      try { walk(buildTree()); } catch (_) { /* the map isn't loaded yet */ }
      keepOpen(); paintLib();
    });
    allBtn.title = 'Close every branch of the map';
    const libHead = el('div', 'fpe-libhead'); libHead.append(el('b', null, 'Map'), libBtn);
    const libTop = el('div', 'fpe-libtop'); libTop.append(search, addBtn);
    const libTools = el('div', 'fpe-libtools'); libTools.append(foldBtn, allBtn);
    const libList = el('div', 'fpe-map');
    lib.append(libHead, libTop, libTools, libList);
    search.placeholder = 'Find a site, terminal, form, structure…';

    async function refreshMap() {
      const isAdmin = FP.users ? await FP.users.can('admin').catch(() => false) : false;
      const canPublish = FP.users ? await FP.users.can(FP.defs.publishRole).catch(() => false) : false;
      const [sites, groups, termSet, registry, users, centers] = await Promise.all([
        FP.sites.list().catch(() => []),
        FP.groups ? FP.groups.list().catch(() => []) : [],
        FP.groups ? FP.groups.terminals().catch(() => new Map()) : new Map(),
        FP.identity.all().catch(() => []),
        isAdmin ? FP.users.list(true).catch(() => []) : [],
        FP.centers ? FP.centers.list().catch(() => []) : [],
        FP.media && FP.media.library ? FP.media.library.load().catch(() => []) : [],   // the media library (0.61)
      ]);
      mapData = { sites, groups, termSet, registry: registry.filter(t => !FP.identity.isEditor(t.terminalId)), users, centers, isAdmin, canPublish };
      await loadDrafts();
      paintLib();
    }
    FP.editor.refreshMap = refreshMap;
    FP.editor.openDef = (kind, id, opts) => open(kind, id, opts || {});
    FP.editor.openPlace = (kind, id, extra) => openPlace(kind, id, extra);   // the media library from a form's map (0.61)

    const nameOf = d => (d.def && (d.def.title || d.def.label)) || d.id;
    // Everything a definition uses, all the way down (a lookup's structure, a structure's functions).
    function usesAll(kind, def, seen) {
      seen = seen || new Set();
      (FP.defs.usesOf(kind, def) || []).forEach(u => {
        const k = `${u.kind}:${u.id}`;
        if (seen.has(k)) return;
        seen.add(k);
        const d = FP.defs.get(u.kind, u.id);
        if (d && d.def) usesAll(u.kind, d.def, seen);
      });
      return seen;
    }

    function buildTree() {
      const md = mapData || { sites: [], groups: [], termSet: new Map(), registry: [], users: [], isAdmin: false };
      const live = KIND_ORDER.filter(k => k !== 'session-type').reduce((acc, k) => acc.concat(FP.defs.list(k).filter(d => !d.retired)), []);
      const defBy = new Map(live.map(d => [`${d.kind}:${d.id}`, d]));
      const forms = live.filter(d => d.kind === 'form');
      // What every form uses; anything outside that is "not on any form".
      const usedByForms = new Set();
      const partsOf = new Map();
      forms.forEach(f => { const u = usesAll('form', f.def); partsOf.set(f.id, u); u.forEach(k => usedByForms.add(k)); });
      const placed = new Set();
      md.groups.forEach(g => g.forms.forEach(f => placed.add(f)));
      // A terminal's own list counts only while it is in no group (in a group, the group's forms are its forms).
      const grouped = new Set(md.groups.flatMap(g => g.terminals));
      md.termSet.forEach((t, id) => { if (!grouped.has(id)) (t.forms || []).forEach(f => placed.add(f)); });
      const sitesOf = d => FP.defs.sitesOf(d.def);
      const atSite = (d, s) => sitesOf(d).includes(s) && !sitesOf(d).includes('all');
      const everywhere = d => sitesOf(d).includes('all');
      const defNode = (d, key, depth) => ({ key, kind: d.kind, id: d.id, label: nameOf(d), color: KIND_COLOR[d.kind], state: state(d), def: d });
      const formNode = (formId, key, opts) => {
        const d = defBy.get(`form:${formId}`) || FP.defs.list('form').find(x => x.id === formId);
        const n = d ? defNode(d, key) : { key, kind: 'form', id: formId, label: formId, color: '#e5484d', state: ['gone', 'bad'] };
        n.site = opts && opts.site;
        n.children = d ? formParts(d, key, n.site) : [];
        n.isForm = true;
        if (opts && opts.shared) n.chips = [opts.shared];
        return n;
      };
      // What a form is made of, one row each under it: its sub-forms, the structures and functions it uses
      // (all the way down: a lookup's structure too), its media list, and any older kinds.
      const TAG = { structure: 'structure', function: 'function' };
      function formParts(d, key, site) {
        const u = partsOf.get(d.id) || new Set();
        const of = kind => Array.from(u).filter(k => k.startsWith(kind + ':')).map(k => defBy.get(k) || { kind, id: k.slice(kind.length + 1), def: null });
        const rows = [];
        (Array.isArray(d.def.subforms) ? d.def.subforms : []).filter(Boolean).forEach(x => rows.push({ key: `${key}>sf:${x.name}`, kind: 'form', id: d.id, label: x.label || x.name, tag: 'sub-form', color: KIND_COLOR.form, site, openWith: { subform: x.name }, subKey: `sub:${d.id}:${x.name}` }));
        ['structure', 'function'].forEach(kind => of(kind).forEach(x => {
          const fn = kind === 'function' && x.def && x.def.reads ? 'lookup' : TAG[kind];
          rows.push({ key: `${key}>${kind}:${x.id}`, kind, id: x.id, label: x.def ? nameOf(x) : x.id, tag: fn, color: KIND_COLOR[kind], site, state: x.def ? state(x) : ['gone', 'bad'] });
        }));
        (FP.media ? FP.media.listOf(d.def) : []).forEach(m => rows.push({ key: `${key}>media:${m.entry || m.path}`, kind: 'form', id: d.id, label: m.title, tag: 'media', color: KIND_COLOR.media, site, openWith: { media: m.entry || m.path }, subKey: `media:${d.id}:${m.entry || m.path}`, sub: FP.media.tagsText(m.tags) || m.path, chips: Object.keys(m.tags || {}).length ? [Object.values(m.tags).map(v => [].concat(v).join('/')).join(' · ').slice(0, 24)] : [] }));
        return rows;
      }
      const groupsWith = formId => md.groups.filter(g => g.forms.includes(formId)).length;
      const nodes = [];
      let peopleNode = null;
      // People, for admins: a block per role.
      // (A publisher who isn't an admin sees only the responsibility centers here.)
      if (md.isAdmin || (md.canPublish && FP.centers)) {
        const roles = md.isAdmin ? [['admin', 'Admins'], ['publisher', 'Publishers'], ['supervisor', 'Supervisors'], ['user', 'Users']] : [];
        const people = { key: 'head:people', head: 'People', note: md.isAdmin ? `${md.users.filter(u => u.active).length} · admins only` : 'responsibility centers', dflt: false, children: [] };
        roles.forEach(([r, t]) => {
          const list = md.users.filter(u => u.active && FP.users.topRole(u.roles) === r);
          const pin = list.filter(u => u.mustChange).length;
          people.children.push({ key: 'role:' + r, label: t, color: '#9333ea', sub: list.length ? list.map(u => u.name).join(', ') : 'nobody yet',
            chips: [String(list.length)].concat(pin ? [`${pin} choosing a PIN`] : []), dflt: false,
            children: list.map(u => ({ key: 'person:' + u.id, label: u.name, tag: u.department || null, sub: u.department || '', color: '#9333ea', place: { kind: 'person', id: u.id } })) });
        });
        const gone = md.isAdmin ? md.users.filter(u => !u.active) : [];
        if (gone.length) people.children.push({ key: 'role:retired', label: 'Retired', color: '#c9d0d9', chips: [String(gone.length)], sub: gone.map(u => u.name).join(', '), dflt: false, children: gone.map(u => ({ key: 'person:' + u.id, label: u.name, sub: 'retired', color: '#c9d0d9', place: { kind: 'person', id: u.id } })) });
        if (md.isAdmin) people.children.push({ key: 'add-person', label: '+ person', add: true, place: { kind: 'new-person' } });
        // Responsibility centers (0.56): who owns duties, and what they owe when.
        if (FP.centers) {
          const cs = md.centers || [];
          const who = c => [c.members.people.length ? `${c.members.people.length} by name` : null, c.members.role ? `${FP.users.ROLE_LABEL[c.members.role].toLowerCase()}s and up` : null,
            c.members.departments.length ? c.members.departments.join(', ') : null, c.members.signedInAt.length ? 'whoever is signed in at ' + c.members.signedInAt.length + ' place' + (c.members.signedInAt.length === 1 ? '' : 's') : null].filter(Boolean).join(' · ');
          people.children.push({ key: 'centers', label: 'Responsibility centers', color: '#0e7490', chips: [String(cs.length)], sub: 'who owns duties, and what they owe when', dflt: true,
            children: cs.map(c => ({ key: 'center:' + c.id, label: c.name, color: '#0e7490', sub: who(c), chips: [`${c.duties.length} dut${c.duties.length === 1 ? 'y' : 'ies'}`], place: { kind: 'center', id: c.id } }))
              .concat([{ key: 'add-center', label: '+ responsibility center', add: true, place: { kind: 'new-center' } }]) });
        }
        peopleNode = people;
      }
      // Plant (0.60, was Sites): each site, its terminal groups and the terminals in none, with what each is for.
      const sitesHead = { key: 'head:plant', head: 'Plant', note: `${md.sites.length} site${md.sites.length === 1 ? '' : 's'}`, dflt: true, children: [] };
      const forText = f => (f && f.items && f.items.length ? ` · for ${f.items.join(', ')}` : '');
      md.sites.forEach(site => {
        const S = site.id;
        const groups = md.groups.filter(g => g.site === S);
        const inGroups = new Set(groups.flatMap(g => g.terminals));
        const loneTerms = md.registry.filter(t => t.site === S && !inGroups.has(t.terminalId));
        const formCount = new Set(groups.flatMap(g => g.forms).concat(loneTerms.flatMap(t => ((md.termSet.get(t.terminalId) || {}).forms || [])))).size;
        const termCount = inGroups.size + loneTerms.length;
        const sn = { key: 'site:' + S, label: site.name, chips: [S], sub: `${S} · ${termCount} terminal${termCount === 1 ? '' : 's'} · ${formCount} form${formCount === 1 ? '' : 's'}`, color: site.active ? '#0e7490' : '#c9d0d9', place: { kind: 'site', id: S }, dflt: true, children: [] };
        groups.forEach(g => {
          const gn = { key: 'group:' + g.id, label: g.name, tag: 'group', color: '#64748b', place: { kind: 'group', id: g.id }, dflt: true,
            sub: `${g.terminals.length ? g.terminals.join(', ') : 'no terminals yet'} · ${g.forms.length} form${g.forms.length === 1 ? '' : 's'}${forText(g.for)}`, chips: g.for && g.for.items.length ? [g.for.items.length > 2 ? `${g.for.items.length} ${((FP.structures.has(g.for.list) && FP.structures.get(g.for.list).label) || g.for.list).toLowerCase()}` : g.for.items.join(', ')] : [], children: [] };
          if (g.terminals.length) gn.children.push({ key: `terms:${g.id}`, terms: g.terminals.map(t => ({ id: t, label: ((md.termSet.get(t) || {}).name) || t })) });
          g.forms.forEach(f => gn.children.push(formNode(f, `f:${S}:${g.id}:${f}`, { site: S, shared: groupsWith(f) > 1 ? `in ${groupsWith(f)} groups` : null })));
          if (md.canPublish) gn.children.push({ key: `addf:${g.id}`, label: '+ form', add: true, place: { kind: 'group', id: g.id, focus: 'forms' } });
          sn.children.push(gn);
        });
        loneTerms.forEach(t => {
          const ts = md.termSet.get(t.terminalId) || { name: '', forms: [] };
          const tn = { key: 'term:' + t.terminalId, label: t.terminalId, tag: 'terminal', color: '#475569', place: { kind: 'terminal', id: t.terminalId }, dflt: false,
            sub: `${ts.name ? ts.name + ' · ' : ''}${ts.forms.length} form${ts.forms.length === 1 ? '' : 's'}${forText(ts.for)}${t.simulated ? ' · simulated' : t.screen ? ' · ' + FP.identity.describe(t) : ''}`, children: ts.forms.map(f => formNode(f, `f:${S}:${t.terminalId}:${f}`, { site: S })) };
          sn.children.push(tn);
        });
        if (md.canPublish) sn.children.push({ key: `addg:${S}`, label: '+ terminal group', add: true, place: { kind: 'new-group', id: S } });
        sitesHead.children.push(sn);
      });
      if (md.isAdmin) sitesHead.children.push({ key: 'add-site', label: '+ site', add: true, place: { kind: 'new-site' } });
      nodes.push(sitesHead);
      // Structures, Formulas and Forms (0.53.1): each one once. Forms show under the sites only where a terminal runs
      // them; here each form says where it runs. Drafts not published yet sit in their own heading.
      const formsUsing = k => forms.filter(f => (partsOf.get(f.id) || new Set()).has(k));
      const draftRows = kind => Array.from(drafts.values()).filter(dr => dr.kind === kind && !FP.defs.list(dr.kind).some(x => x.id === dr.id))
        .map(dr => ({ key: `draft:${dr.kind}:${dr.id}`, kind: dr.kind, id: dr.id, label: (dr.def && (dr.def.title || dr.def.label)) || dr.id, color: KIND_COLOR[dr.kind], state: ['draft', 'draft'] }));
      const heading = (key, head, list, rows) => {
        const all = rows.concat(draftRows(list));
        if (all.length) nodes.push({ key, head, note: String(all.length), dflt: false, children: all });
      };
      const byName = (a, b) => nameOf(a).localeCompare(nameOf(b));
      const usedRow = (d, tagOf) => {
        const by = formsUsing(`${d.kind}:${d.id}`);
        return Object.assign(defNode(d, `all-${d.kind}:${d.id}`), { tag: tagOf ? tagOf(d) : null,
          chips: [by.length ? `${by.length} form${by.length === 1 ? '' : 's'}` : 'on no form'], warn: !by.length,
          sub: by.length ? `used by ${by.slice(0, 3).map(nameOf).join(', ')}${by.length > 3 ? ` and ${by.length - 3} more` : ''}` : 'no form uses it' });
      };
      // Data (0.60): the structures by kind (Lists, Orders, Runs, Inventory, Cases, Records); under each structure, the
      // forms that use it and the lookups that read it.
      const structs = live.filter(d => d.kind === 'structure');
      const fns = live.filter(d => d.kind === 'function');
      const lookups = fns.filter(d => d.def && d.def.reads);
      const formulas = fns.filter(d => !(d.def && d.def.reads));
      const structRow = d => {
        const n = usedRow(d);
        const by = formsUsing(`structure:${d.id}`).sort(byName);
        const lk = lookups.filter(f => f.def.reads.structure === d.id).sort(byName);
        n.children = by.map(f => ({ key: `${n.key}>form:${f.id}`, kind: 'form', id: f.id, label: nameOf(f), tag: 'form', color: KIND_COLOR.form, state: state(f) }))
          .concat(lk.map(f => Object.assign(usedRow(f, () => 'lookup'), { key: `${n.key}>fn:${f.id}` })));
        if (lk.length) n.chips.push(`${lk.length} lookup${lk.length === 1 ? '' : 's'}`);
        return n;
      };
      // Each structure once, its kind as its tag (Lists first, then Orders, Runs, Inventory, Cases, Records; none last).
      const KN = FP.kinds ? FP.kinds.NAMES : [];
      const kindOf = d => (d.def && d.def.kind && FP.kinds && FP.kinds.get(d.def.kind) ? d.def.kind : null);
      const rank = d => (kindOf(d) ? KN.indexOf(kindOf(d)) : KN.length);
      const dataKids = structs.slice().sort((a, b) => rank(a) - rank(b) || byName(a, b)).map(d => {
        const n = structRow(d);
        const K = kindOf(d) ? FP.kinds.get(kindOf(d)) : null;
        n.tag = K ? K.label.toLowerCase() : 'no kind';
        if (!K) { n.warn = true; n.sub = 'From before kinds (0.59): it needs a kind to be published again'; }
        else n.sub = `${K.label}: ${K.help.split(':')[0].toLowerCase()} · ${n.sub}`;
        return n;
      });
      // Lookups of data that has no structure here (the built-in users, sites…).
      const elsewhere = lookups.filter(f => !structs.some(x => x.id === f.def.reads.structure)).sort(byName);
      if (elsewhere.length) dataKids.push({ key: 'kind:builtin', label: 'Built in', color: '#94a3b8', chips: [String(elsewhere.length)], sub: 'Lookups reading the kernel\'s own data: users, sites…', dflt: false, children: elsewhere.map(f => usedRow(f, () => 'lookup')) });
      // The media library (0.61): one row; its entries open on the right (there can be hundreds).
      if (FP.media && FP.media.library) {
        const L = FP.media.library;
        const entries = L.cached().filter(e => e.active);
        const untagged = entries.filter(e => !Object.keys(e.tags || {}).length).length;
        const unused = entries.filter(e => !L.usedBy(e.id).length).length;
        dataKids.unshift({ key: 'media-library', label: 'Media library', tag: 'media', color: KIND_COLOR.media, place: { kind: 'media-library', id: null },
          chips: [`${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`].concat(untagged ? [`${untagged} untagged`] : []), warn: !!untagged,
          sub: entries.length ? `${entries.length} files with names and tags; ${unused ? `${unused} on no form` : 'every one on a form'}` : 'empty: open it and bring files in' });
      }
      const dataAll = dataKids.concat(draftRows('structure'));
      if (dataAll.length) nodes.push({ key: 'head:data', head: 'Data', note: `${structs.length} structure${structs.length === 1 ? '' : 's'}`, dflt: false, children: dataAll });
      // Where each form runs: the groups and the terminals in none whose forms include it.
      const runsAt = formId => md.groups.filter(g => g.forms.includes(formId)).map(g => g.name)
        .concat(Array.from(md.termSet.entries()).filter(([tid, t]) => !grouped.has(tid) && (t.forms || []).includes(formId)).map(([tid]) => tid));
      const formRows = forms.slice().sort(byName).map(d => {
        const n = formNode(d.id, `all-form:${d.id}`, { site: null });
        const at = runsAt(d.id);
        n.chips = [at.length ? at.slice(0, 2).join(', ') + (at.length > 2 ? ` +${at.length - 2}` : '') : 'on no terminal'];
        n.warn = !at.length;
        n.sub = at.length ? `runs on ${at.join(', ')}` : 'no terminal group or terminal runs it';
        return n;
      });
      // Forms (0.60): every form once, then the formulas they and the structures work with (lookups are under Data).
      const fxRows = formulas.sort(byName).map(d => usedRow(d)).concat(draftRows('function'));
      const formKids = formRows.concat(draftRows('form'));
      if (fxRows.length) formKids.push({ key: 'formulas', label: 'Formulas', color: KIND_COLOR.function, chips: [String(fxRows.length)], sub: 'worked out on forms and structures; lookups are under Data', dflt: false, children: fxRows });
      if (formKids.length) nodes.push({ key: 'head:forms', head: 'Forms', note: String(forms.length), dflt: false, children: formKids });
      if (peopleNode) nodes.push(peopleNode);
      return nodes;
    }

    // Keep only what matches the search, with the rows above it.
    function filterTree(list, q) {
      return list.map(n => {
        const kids = n.children ? filterTree(n.children, q) : [];
        const me = [n.label, n.id, n.sub, n.tag].some(x => x && String(x).toLowerCase().includes(q)) || (n.terms && n.terms.some(t => t.id.toLowerCase().includes(q) || t.label.toLowerCase().includes(q)));
        if (!me && !kids.length) return null;
        return Object.assign({}, n, { children: me && !kids.length ? n.children : kids, forceOpen: kids.length > 0 });
      }).filter(Boolean);
    }

    function paintLib() {
      libList.replaceChildren();
      if (adding) {
        const m = el('div', 'fpe-addmenu');
        ADDABLE.forEach(([kind, color, label, help]) => {
          const b = btn('', null, () => { adding = false; paintLib(); newDef(kind); });
          b.style.setProperty('--c', color);
          b.append(el('b', null, label), el('small', null, help));
          m.appendChild(b);
        });
        if (mapData && mapData.canPublish) {
          const b = btn('', null, () => { adding = false; paintLib(); openPlace('new-group', null); });
          b.style.setProperty('--c', '#64748b'); b.append(el('b', null, 'A terminal group'), el('small', null, 'Terminals at one site that run the same forms'));
          m.appendChild(b);
          if (FP.centers) {
            const rc = btn('', null, () => { adding = false; paintLib(); openPlace('new-center', null); });
            rc.style.setProperty('--c', '#0e7490'); rc.append(el('b', null, 'A responsibility center'), el('small', null, 'Who owns duties, and what they owe when'));
            m.appendChild(rc);
          }
        }
        if (mapData && mapData.isAdmin) {
          [['new-person', '#9333ea', 'A person', 'Someone who signs in: their role and a temporary PIN'], ['new-site', '#0e7490', 'A site', 'A facility or area; every terminal is at one']].forEach(([k, c, l, h]) => {
            const b = btn('', null, () => { adding = false; paintLib(); openPlace(k, null); });
            b.style.setProperty('--c', c); b.append(el('b', null, l), el('small', null, h));
            m.appendChild(b);
          });
        }
        libList.appendChild(m);
      }
      let tree = buildTree();
      if (filter) tree = filterTree(tree, filter);
      const curKey = current ? `${current.kind}:${current.id}` : '';
      const row = (n, depth, box) => {
        if (n.head) {
          // A heading folds away whole (0.51.1): People, Sites, Structures, Formulas, Everywhere.
          const headOpen = filter ? (n.forceOpen || isOpen(n.key, n.dflt)) : isOpen(n.key, !!n.dflt);
          const h = btn('', 'fpe-maphead');
          h.setAttribute('aria-expanded', String(headOpen));
          h.append(el('i', null, headOpen ? '▾' : '▸'), el('b', null, n.head));
          if (n.note) h.appendChild(el('span', null, '· ' + n.note));
          h.onclick = () => { openKeys[n.key] = !headOpen; keepOpen(); paintLib(); };
          box.appendChild(h);
          if (headOpen) (n.children || []).forEach(c => row(c, depth, box));
          return;
        }
        if (n.terms) {
          const t = el('div', 'fpe-mterms'); t.style.marginLeft = (depth * 14) + 'px';
          t.appendChild(el('span', 'k', 'Terminals'));
          n.terms.forEach(x => { const c = btn(x.label === x.id ? x.id : `${x.id} ${x.label}`, 'fpe-tchip' + (curKey === `terminal:${x.id}` ? ' on' : ''), () => openPlace('terminal', x.id)); t.appendChild(c); });
          box.appendChild(t);
          return;
        }
        const hasKids = !!(n.children && n.children.length);
        const openNow = filter ? (n.forceOpen || isOpen(n.key, n.dflt)) : isOpen(n.key, !!n.dflt);
        const isDef = n.kind && n.id;
        const curSub = current && current.subKey;
        const on = n.subKey ? curSub === n.subKey : (isDef && curKey === `${n.kind}:${n.id}` && !curSub) || (n.place && !n.add && curKey === `${n.place.kind}:${n.place.id}`);
        const b = btn('', (isDef ? 'fpe-item ' : '') + 'fpe-mrow' + (n.add ? ' add' : '') + (n.warn ? ' warn' : '') + (n.key && n.key.includes('>') ? ' part' : '') + (on ? ' on' : ''));
        b.style.setProperty('--c', n.color || '#94a3b8');
        b.style.marginLeft = (depth * 14) + 'px'; b.style.setProperty('--ml', (depth * 14) + 'px');
        const cv = el('i', 'cv', hasKids ? (openNow ? '▾' : '▸') : '');
        if (hasKids) cv.onclick = e => { e.stopPropagation(); openKeys[n.key] = !openNow; keepOpen(); paintLib(); };
        b.appendChild(cv);
        const txt = el('span'); txt.textContent = n.label; b.appendChild(txt);
        if (n.tag) b.appendChild(el('small', 'k', n.tag));
        (n.chips || []).filter(Boolean).forEach(c => b.appendChild(el('small', 'chip', c)));
        if (n.state) b.appendChild(el('small', n.state[1], n.state[0]));
        b.title = n.subKey ? (n.sub || '') : isDef ? `${n.kind} ${n.id}` : (n.sub || '');
        b.onclick = () => {
          // A form opens and unfolds to what it is made of.
          if (n.isForm && hasKids && !openNow) { openKeys[n.key] = true; keepOpen(); }
          if (isDef) open(n.kind, n.id, Object.assign({ site: n.site, subKey: n.subKey || null }, n.openWith || {}));
          else if (n.place) openPlace(n.place.kind, n.place.id, n.place);
          else if (hasKids) { openKeys[n.key] = !openNow; keepOpen(); paintLib(); }
        };
        box.appendChild(b);
        // Every row alike (0.60): what it is in a word or two on the row, the rest when hovered; nothing on a line below.
        if (n.sub && !n.add) b.title = n.sub;
        if (!openNow) return;
        (n.children || []).forEach(c => row(c, depth + 1, box));
      };
      tree.forEach(n => row(n, 0, libList));
      if (!tree.length) libList.appendChild(el('p', 'fpe-hint', filter ? 'Nothing matches.' : 'Nothing here yet: + Add makes the first thing.'));
    }

    /* Settings of a person, site, terminal group or terminal, on the right. */
    /* The pane while something opens (0.53.3): "Opening…" at once, before anything is read or kept; after 8 s it says
     * it is still waiting on the folder, with Try again. Only the latest click fills the pane, and anything that goes
     * wrong is shown in it. */
    let clicks = 0;
    function opening(again) {
      const holder = el('div');
      const note = el('div', 'fpe-empty fpe-opening', 'Opening…');
      holder.appendChild(note);
      right.replaceChildren(holder);
      const slow = setTimeout(() => {
        if (!note.isConnected) return;
        note.textContent = 'Still opening: waiting on the data folder (OneDrive can be slow right after a change). ';
        note.appendChild(btn('Try again', 'fpe-fold', again));
      }, 8000);
      const failed = (e, mine) => {
        clearTimeout(slow);
        if (mine !== clicks) return;
        const box = el('div', 'fpe-warn', `Couldn't open it: ${e && e.message || e}`);
        box.appendChild(btn('Try again', 'fpe-fold', again));
        right.replaceChildren(box);
      };
      return { holder, done: () => { clearTimeout(slow); note.remove(); }, failed };
    }
    // Leaving something half done keeps it as a draft (nothing to confirm): it opens as you left it next time.
    async function leaveCurrent() {
      const v = current && current.view;
      if (!(v && v.keep && v.isDirty())) return;
      try { if (v.unsaved()) await v.keep(); toast('Kept as a draft: it opens as you left it.'); }
      catch (e) { toast(`Couldn't keep your changes as a draft: ${e.message}`, true); }
    }
    async function openPlace(kind, id, extra) {
      if (!FP.editor.places) return;
      const mine = ++clicks;
      const o = opening(() => openPlace(kind, id, extra));
      try {
        await leaveCurrent();
        if (mine !== clicks) return;
        adminBtn.classList.remove('on'); helpBtn.classList.remove('on');
        showingForm(false); const me = current = { kind, id, view: null };
        paintLib();
        const view = await FP.editor.places.pane(o.holder, kind, id, Object.assign({ open, openPlace, refresh: refreshMap, data: () => mapData }, extra || {}));
        if (mine !== clicks || current !== me) return;
        o.done();
        current.view = view;
        history.replaceState(null, '', `?place=${encodeURIComponent(kind)}${id ? `&id=${encodeURIComponent(id)}` : ''}`);
      } catch (e) { o.failed(e, mine); }
    }

    async function openAdmin(section) {
      if (!FP.editor.admin) return;
      ++clicks;
      if (current && current.view && current.view.keep && current.view.isDirty()) { if (current.view.unsaved()) await current.view.keep(); toast('Kept as a draft: it opens as you left it.'); }
      current = { kind: 'admin', id: null, view: null }; showingForm(false);
      paintLib();
      adminBtn.classList.add('on'); helpBtn.classList.remove('on');
      const setUrl = s => history.replaceState(null, '', `?admin=${encodeURIComponent(s)}`);
      current.view = await FP.editor.admin(right, { section, onSection: setUrl });
      if (current.view && current.view.section) setUrl(current.view.section());
    }
    adminBtn.onclick = () => openAdmin();
    async function openHelp(chapter) {
      if (!FP.editor.help) return;
      ++clicks;
      if (current && current.view && current.view.keep && current.view.isDirty()) { if (current.view.unsaved()) await current.view.keep(); toast('Kept as a draft: it opens as you left it.'); }
      current = { kind: 'help', id: null, view: null }; showingForm(false);
      paintLib();
      adminBtn.classList.remove('on'); helpBtn.classList.add('on');
      current.view = await FP.editor.help(right, { chapter, onChapter: c => history.replaceState(null, '', `?help=${encodeURIComponent(c)}`) });
    }
    helpBtn.onclick = () => openHelp();
    async function open(kind, id, opts) {
      opts = opts || {};
      const mine = ++clicks;
      const o = opening(() => open(kind, id, opts));
      try {
        await leaveCurrent();
        if (mine !== clicks) return;
        if (!opts.fresh && !opts.def) {
          const d = await FP.defs.drafts.get(kind, id).catch(() => null);
          if (mine !== clicks) return;
          if (d && d.def) opts = Object.assign({}, opts, { def: d.def, dirty: true, draft: d });
        }
        adminBtn.classList.remove('on'); helpBtn.classList.remove('on');
        showingForm(kind === 'form');
        const me = current = { kind, id, view: null, subKey: opts.subKey || null };
        paintLib();
        o.done();
        const view = await panel(right, kind, id, Object.assign({ open, reopen: (k, i, x) => open(k, i, Object.assign({ force: true }, x || {})), onClosed: () => { if (current === me) { current = null; paintLib(); } } }, opts));
        if (current !== me) return;
        current.view = view;
        history.replaceState(null, '', `?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`);
      } catch (e) { o.failed(e, mine); }
    }
    function newDef(kind) {
      const re = kind === 'function' ? FN_RE : SLUG_RE;
      const id = prompt(`Name of the new ${FP.defs.LABELS[kind]}:\n${kind === 'function' ? 'Letters, digits and _, starting with a letter, e.g. ScrapPct' : 'Lowercase letters, digits and -, e.g. od-checks'}`);
      if (id == null) return;
      const v = id.trim();
      if (!re.test(v)) { toast('That name won\'t do: ' + (kind === 'function' ? 'letters, digits and _, starting with a letter.' : 'lowercase letters, digits and -, starting with a letter.'), true); return; }
      if (FP.defs.get(kind, v) || FP.defs.list(kind).some(d => d.id.toLowerCase() === v.toLowerCase())) { toast(`${FP.defs.LABELS[kind]} ${v} already exists; open it instead.`, true); return; }
      if (Array.from(drafts.values()).some(d => d.kind === kind && d.id.toLowerCase() === v.toLowerCase())) { toast(`There is already a draft of ${FP.defs.LABELS[kind]} ${v}; open it from the library.`, true); return; }
      open(kind, v, { tab: 'edit', force: true });
    }

    async function showUser() { const u = await FP.users.current(); who.textContent = u ? u.name : 'Sign in'; }
    FP.editor.showUser = showUser;
    who.onclick = async () => { await FP.users.signOut('switched'); await FP.users.gate({ title: 'Editor' }); await showUser(); };
    // Closing the page with a draft still waiting to be written: write it now, and ask the browser to hold on.
    window.addEventListener('beforeunload', e => { if (current && current.view && current.view.unsaved && current.view.unsaved()) { current.view.keep(); e.preventDefault(); e.returnValue = ''; } });
    window.addEventListener('fp-defs', () => paintLib());

    return FP.startup.run({ title: 'Editor', editor: true }).then(async ready => {
      // The editor is always the terminal Editor, and works on every site.
      term.textContent = 'Editor · every site';
      term.title = `Saved here as terminal Editor (this computer's files: ${ready.terminalId})`;
      // A test folder says so (0.53).
      FP.folder.isTest().then(t => { if (!t) return; const tb = el('span', 'meta'); tb.textContent = 'TEST FOLDER'; tb.title = 'This data folder is marked as a test folder (Admin > Test folder)'; Object.assign(tb.style, { background: '#f2c94c', color: '#1b2633', fontWeight: '700', borderRadius: '6px', padding: '3px 8px' }); term.before(tb); }).catch(() => {});
      FP.editor.repaintBar = () => { term.textContent = 'Editor · every site'; };
      await FP.defs.load();
      await loadDrafts();
      await FP.users.gate({ title: 'Editor' });
      await showUser();
      FP.defs.watch();
      await refreshMap();
      FP.users.watchIdle(30, async () => { await FP.users.gate({ title: 'Editor' }); await showUser(); });
      // The name in the bar is always who is signed in now: after 12 hours, or a sign-in in another window, it says so.
      FP.users.watchSignIn(async u => {
        if (!u) { toast('Your sign-in ended. Sign in again; nothing you changed is lost.', true); await FP.users.gate({ title: 'Editor' }); }
        else toast(`${u.name} is signed in on this terminal now.`);
        await showUser();
      });
      const u = await FP.users.current();
      if (u && !(await FP.users.can(FP.defs.publishRole))) right.replaceChildren(el('div', 'fpe-note', 'You can look at everything here; publishing takes a publisher or an admin.'));
      paintLib();
      // Updates: offered to admins when a newer release zip is in updates/; every page moves to a new release at a safe moment.
      if (FP.updates) {
        FP.updates.watch({ isSafe: () => !(current && current.view && (current.view.unsaved ? current.view.unsaved() : current.view.isDirty())), onReady: v => toast(`Version ${v} is ready: the editor reloads once your draft is kept.`) });
        const offer = async () => {
          if (!(await FP.users.can('admin'))) return;
          const list = (await FP.updates.pending().catch(() => [])).filter(z => z.newer || z.problems.length);
          let box = document.getElementById('fpe-update');
          if (!list.length) { if (box) box.remove(); return; }
          if (!box) { box = el('div', 'fpe-update'); box.id = 'fpe-update'; bar.after(box); }
          const cfg = await FP.updates.installed().catch(() => null);
          box.replaceChildren();
          list.forEach(z => {
            const row = el('div');
            if (z.problems.length) { row.textContent = `updates/${z.name} can't be installed: ${z.problems.join('; ')}.`; row.className = 'bad'; }
            else {
              row.append(el('b', null, `Version ${z.version} of the platform is ready to install`), document.createTextNode(` (this site runs ${cfg && cfg.current ? cfg.current : 'files from before releases'}). Every terminal moves to it by itself, at a moment when nothing unsaved is on its screen. `));
              row.appendChild(btn('Install now', 'primary', async e => {
                e.target.disabled = true;
                try { const r = await FP.updates.installShown(z.name); toast(`Installed ${r.version}.${r.launchers ? ` ${r.launchers} older launcher file${r.launchers === 1 ? '' : 's'} moved to shortcuts.` : ''}`); offer(); }
                catch (err) { toast(err.message, true); e.target.disabled = false; }
              }));
            }
            box.appendChild(row);
          });
        };
        FP.editor.checkUpdates = offer;   // also run on demand (after putting a zip in updates/)
        offer();
        setInterval(() => offer().catch(() => {}), 2 * 60 * 1000);
      }
      const q = new URLSearchParams(location.search);
      if (q.get('kind') && q.get('id') && FP.defs.get(q.get('kind'), q.get('id'))) await open(q.get('kind'), q.get('id'));
      else if (q.get('place')) await openPlace(q.get('place'), q.get('id'));
      else if (q.get('admin') != null) await openAdmin(q.get('admin'));
      else if (q.get('help') != null) await openHelp(q.get('help'));
      return { open };
    }).catch(e => window.__fpReport('Startup failed: ' + (e.message || e)));
  }

  /* ---------- The structure editor over anything (used by the form editor) ---------- */
  /* id: an existing structure or a new name. opts.container: a container to add if missing.
   * Resolves with { id, container } when published, null when closed. */
  function editStructure(id, opts) {
    opts = opts || {};
    injectCss();
    return new Promise(resolve => {
      const sheet = el('div', 'fpe-sheet');
      const host = el('div', 'fpe-panel');
      sheet.appendChild(host);
      document.body.appendChild(sheet);
      const close = v => { sheet.remove(); resolve(v); };
      const doc = FP.defs.get('structure', id);
      const def = doc ? clone(doc.def) : { itemId: { made: 'entered' }, containers: {}, sites: opts.sites || ['all'] };
      // An existing structure opened for a new container starts with it added (not yet published).
      let added = false;
      if (opts.container && NAME_RE.test(opts.container)) { def.containers = def.containers || {}; if (!def.containers[opts.container]) { def.containers[opts.container] = {}; added = true; } }
      let lastAdded = opts.container || null;
      panel(host, 'structure', id, {
        def, dirty: added, tab: 'edit',
        onCancel: () => close(null),
        onPublished: d => close({ id: d.id, container: lastAdded }),
        onContainerAdded: n => { lastAdded = n; },
      }).catch(e => { toast(e.message, true); close(null); });
    });
  }

  /* A function in a sheet over the page (a new lookup from the form editor). Resolves { id } once published, or null. */
  function editFunction(id, opts) {
    opts = opts || {};
    injectCss();
    return new Promise(resolve => {
      const sheet = el('div', 'fpe-sheet');
      const host = el('div', 'fpe-panel');
      sheet.appendChild(host);
      document.body.appendChild(sheet);
      const close = v => { sheet.remove(); resolve(v); };
      const doc = FP.defs.get('function', id);
      const def = doc ? clone(doc.def) : opts.lookup
        ? { kind: 'lookup', output: 'record', inputs: [], reads: { structure: '', from: 'items', return: '*', summary: 'latest' }, sites: opts.sites || ['all'] }
        : { inputs: [], formula: '', output: 'any', sites: opts.sites || ['all'] };
      panel(host, 'function', id, { def, dirty: !doc, tab: 'edit', onCancel: () => close(null), onPublished: d => close({ id: d.id }) })
        .catch(e => { toast(e.message, true); close(null); });
    });
  }

  FP.editor = { start, editStructure, editFunction, panel, ui: { el, btn, input, select, formulaInput, chips, toast, sitesPicker } };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-editor'] = '0.62.0';
})();
