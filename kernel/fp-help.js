/* Form Platform: Help in the editor (step 28).
 * Load after fp-form-editor.js.
 *
 * A reference made from the platform itself, so it can't drift from what the editor does:
 *   - Fields: every control in the catalog with its settings (FP.forms.controls()).
 *   - Form settings (FP.forms.formSettings()).
 *   - Formulas: every built-in with what goes in its brackets, what it gives and an example (FP.fn.help),
 *     then the functions in this library.
 *   - What publish checks.
 * Shown in the editor (? Help in the bar), searchable, and saved as one HTML page to print or share.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.editor) throw new Error('Load fp-form-editor.js before fp-help.js');
  const { el, btn, input } = FP.editor.ui;

  const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const TYPE_TEXT = { text: 'text', name: 'a name (letters, digits, _)', number: 'a number', integer: 'a whole number', boolean: 'yes or no', choice: 'one of a list', formula: 'a formula', texts: 'a list of words', target: 'source.value', list: 'a list', map: 'names and values', any: 'see the note', control: 'a kind of field', form: 'a form\'s name', options: 'a list of options' };

  /* ---------- The chapters, as plain data ---------- */
  function mediaChapter() {
    return {
      id: 'media', title: 'Media',
      intro: 'Files from the data folder\'s media folder that forms show, and the files forms save.',
      blocks: [
        { h: 'The media library (0.61)', list: [
          'Every file a form shows has one entry in the media library (Data › Media library on the map): an internal name, tags and a folder. Its files are kept in media/library.',
          '+ Bring in files (from this computer) or From the media folder (files already there; they are copied, and stay where they were) asks for each file in turn: its name, its tags and its folder. Same tags as the last one saves typing; Skip leaves one out.',
          'Tag names are set once for the whole library (Tag names). One can be typed freely, or come from a List structure: its items in use are offered, and a value that isn\'t on the list is marked.',
          'Replace with a new version keeps the entry and its name: forms show the new file, Read first asks again, and the old one is kept in the entry\'s versions. Retire takes it off every form; its files stay.',
          'Publishers and admins change the library; everyone sees it through the forms. The library is a built-in List, so a choice can pick from it too.',
        ] },
        { h: 'On a form', list: [
          'A form\'s Media (on its map) names library entries (+ from the library), or takes in every entry with some tags (+ every library entry tagged…, e.g. kind: setup sheet): entries added later with those tags show too, without changing the form.',
          'A Media field and Read first show the files of that list whose tags match: die = dieNo shows the files tagged die = the Die no. field. A tag value all matches anything.',
          'Read first asks again when the file changes: a new version, or the file\'s modified time.',
          'A file attached by its path before the library (0.42) still shows; new ones come from the library.',
          'Signatures (drawing pads) save into media/signatures, photos into media/photos, other files into media/files, named form_record_field_person_date-time, so a report can find them by that. The field saves the file\'s path.',
        ] },
      ],
    };
  }

  function fieldsChapter() {
    const all = FP.forms.controls();
    const cats = [['entry', 'Fields people fill in'], ['display', 'Fields that show something'], ['visual', 'Charts and visuals']];
    return {
      id: 'fields', title: 'Fields',
      intro: 'Every kind of field and its settings, from the control catalog. Settings marked * are required.',
      blocks: cats.map(([cat, h]) => ({ h, items: all.filter(c => (c.category === cat) || (cat === 'display' && !['entry', 'visual'].includes(c.category))).map(c => ({
        name: c.name, title: c.label || c.name, text: c.help || '',
        rows: (c.settings || []).filter(s => !['name', 'control'].includes(s.name)).map(s => [s.name + (s.required ? ' *' : ''), [s.label, s.help, s.options ? `one of: ${s.options.join(', ')}` : TYPE_TEXT[s.type] || s.type].filter(Boolean).join(' · ')]),
      })) })),
    };
  }

  function formChapter() {
    return {
      id: 'form', title: 'Form settings',
      intro: 'The settings of a form itself (the first row of its map).',
      blocks: [{ table: FP.forms.formSettings().filter(s => !['fields', 'comments', 'lists'].includes(s.name)).map(s => [s.name + (s.required ? ' *' : ''), [s.label, s.help].filter(Boolean).join(' · ')]) }],
    };
  }

  function subformsChapter() {
    return {
      id: 'subforms', title: 'Sub-forms',
      intro: 'A sub-form is a form inside a form, opened by a button (0.40). It has its own fields and sources, reads the master form\'s fields and sources by name, and sends values back to it. It replaces opening another published form.',
      blocks: [
        { h: 'Its settings (its row on the master form\'s map)', table: [
          ['Label, Named by', 'What people see; Named by is a formula, e.g. "Re-test for " & dieNo, shown on its screen and its button.'],
          ['Opened by', 'The buttons that open it (What it does: Open a sub-form).'],
          ['How many times', 'Once; a set number; a number a formula works out; once for each item of a list (each is the item, index its number); or as many as needed (Save and add another, then Finish).'],
          ['Its records are saved', 'With this form (default): they wait with it and are saved in its save, all or nothing. On their own: its Save saves at once, and they point at this form\'s record, whose ID is set aside for it.'],
          ['Its records point at', 'Which of this form\'s items (the first one it saves, unless you pick another).'],
          ['Required', 'This form can\'t be saved until it is done (every run, when it repeats; a run skipped because someone else saw to it counts).'],
          ['Sends back', 'A field here ← its field; when it repeats, what to do with the several values: the first, the last, the average, the lowest, the highest, the total, how many, all joined, or all of them into a field that holds several.'],
        ] },
        { h: 'On the terminal', list: [
          'Its button says how far it has got: Done, Saved, 3 of 5 done, 2 done.',
          'It opens over the form, with ‹ Back. Back leaves the run it is on; the ones done stay done.',
          'Going through a list: the list is taken when it opens. When a run\'s item was changed on another terminal meanwhile, that run says so, with Skip it or Add mine anyway.',
          'A record saved on its own while the master form is never saved is listed in Admin › Clean-up.',
        ] },
        { h: 'Changed since you opened it', list: [
          'Every form (0.40): saving an item someone else changed after the form read it asks first. Keep theirs puts their values back on screen; Save mine over it saves; See both shows the two side by side.',
        ] },
      ],
    };
  }

  function placesChapter() {
    return {
      id: 'places', title: 'The map, terminals and roles',
      intro: 'The editor\'s map (0.41) is every site with its terminal groups and terminals, each with its forms, and each form with what it uses. People sit above the sites, for admins.',
      blocks: [
        { h: 'Roles, each including the one before', table: [
          ['User', 'Fills in the forms of the terminal they are at.'],
          ['Supervisor', 'Fills in any form at the site; approves what waits for approval.'],
          ['Publisher', 'Makes and publishes forms, structures and functions, and their media; sets which forms each group and terminal has.'],
          ['Admin', 'Everything: people and roles, sites, updates, records, clean-up.'],
        ] },
        { h: 'Terminal groups and terminals', list: [
          'A group is terminals at one site that run the same forms, e.g. Production presses: T01–T05. A terminal is in one group at most.',
          'A terminal taken out of its group keeps a copy of the group\'s forms; one in no group has its own list.',
          'Users see the forms of their terminal\'s group (or its own list), in that order. Supervisors and up see those, then every form at the site.',
          'A terminal with no forms yet: users see "No forms yet: ask a supervisor". Until a site has any group or terminal list, everyone there sees every form.',
          'A form opened some other way (a shortcut, an address) follows the same rules, and offers to sign in as someone who can.',
          'Home form (0.51): one of its forms, shown open on the home screen, e.g. a line board whose card buttons open the other forms; or none.',
          'View (0.51): Kiosk shows its forms as big buttons under the home form, for a line or a press. Admin lists its forms down the left and opens each on the right, the home form there when none is open, for a desk PC; under 900 px wide the list folds into a ☰ Forms menu.',
        ] },
        { h: 'The launcher', list: [
          'launch.html, at the top of the data folder, is the one launcher every terminal opens. It knows which terminal it is; whoever signs in decides what its home screen shows.',
          'Publishers and admins get an Editor button. The editor is always the terminal Editor, on any computer, and works on every site.',
        ] },
        { h: 'Approvals', list: [
          'A form with "Needs a supervisor\'s approval" doesn\'t save what a user fills in: it waits, unsaved, until a supervisor approves it.',
          'A supervisor opening the launcher sees what waits first: Approve saves it as it was filled in (with who approved it); Not approved saves nothing.',
          'A supervisor\'s own saves on such a form are saved straight away.',
        ] },
      ],
    };
  }

  function formulasChapter() {
    const names = (FP.fn.HELP_NAMES || []).slice();
    const lib = FP.fn.list().filter(f => !/^ZzTry/.test(f.name)).sort((a, b) => a.name.localeCompare(b.name));
    return {
      id: 'formulas', title: 'Formulas',
      intro: 'A formula is like a spreadsheet formula: names of fields and sources, numbers, "text", + - * / ^, & to join text, = <> < > <= >= to compare, and functions. AND, OR and NOT are functions: AND(a, b). source.value reads a value; a list\'s .value gives every item\'s value as a list; list["ID"] picks one item. In FILTER, EACH and SORT, item is each item in turn. NAME.selected (0.51) is what a list field has selected: the item behind a choice\'s value (options from a formula), the items behind chips, the row or tile tapped in records or a board set to Tapping selects it; e.g. lines.selected.speed.',
      blocks: [
        { h: 'Built in', items: names.map(n => { const h = FP.fn.help(n); return { name: n, title: `${n}(${h.args.join(', ')})`, text: h.text, example: h.example }; }) },
        { h: 'In this library', items: lib.length ? lib.map(f => { const h = FP.fn.help(f.name) || { args: [] }; return { name: f.name, title: `${f.name}(${h.args.join(', ')})`, text: [f.label && f.label !== f.name ? f.label : null, f.kind === 'lookup' ? `reads ${(f.reads || {}).structure}` : null, f.output && f.output !== 'any' ? `gives ${f.output}` : null].filter(Boolean).join(' · '), example: f.formula ? `= ${f.formula}` : null }; }) : [{ name: '-', title: 'None yet', text: '+ Add > A function makes one.' }] },
      ],
    };
  }

  function checksChapter() {
    return {
      id: 'checks', title: 'What publish checks',
      intro: 'Every definition is checked as you edit, with the same checks publish runs. Nothing with a problem can be published; each problem is marked ✗ on its row of the map.',
      blocks: [
        { h: 'Every definition', list: ['Its sites are named, and exist.', 'Whatever it uses (a structure, a function, a form it opens) is used at all of its sites.', 'Whatever uses it still covers all of its sites.', 'It is the version you opened: if someone published since, reload first.'] },
        { h: 'Forms', list: ['Every field has a name (letters, digits, _), used once, and a kind of field that exists; every setting is one that kind has, of the right type.',
          'Formulas read without errors, call functions that exist with the right number of inputs, and name only fields and sources of this form (item inside FILTER, EACH and SORT).',
          'A field saves to a source of this form, to a value ticked write on it; nothing saves to a value a structure works out itself.',
          'Two fields don\'t save to one value unless each has a shown-when.',
          'An item\'s ID comes from somewhere: a field (made required), a fixed ID, made new each save, the open one (whose values match this form\'s fields), or found by a rule; and the form follows its structure\'s ID rule.',
          'A choice or chips that picks from a structure (Pick from) names a published structure with a kind, and has no options of its own; only the open ones and the open one go with a kind whose items open and close (or a list: its items in use), never records.',
          'A table with a row per item takes its rows from a list source.',
          'The layout places every required field once, and only fields and buttons that exist.',
          'Buttons: open names a published form; a link names an item the form saves to; scope names a section, tab or step that exists.',
          'Read first: text has text; media needs files on the form\'s media list.',
          'Media: every file has a path in the media folder, is on the list once, not in media/signatures, photos or files, and has tags named with a lowercase letter, then letters and digits.',
          'Sub-forms: a name used once on the form, a button that opens it, no sub-forms inside it; its own fields and sources are checked like a form\'s (they may also read this form\'s fields and sources, and each and index when it repeats).',
          'A value sent back lands in a field people fill in here, from one of its fields, and fits: a number into a number or text, files into files; a sub-form that repeats says what to do with the several values (first, last, average, lowest, highest, total, how many, joined, or all into a field that holds several), and one that doesn\'t says nothing.'] },
        { h: 'Structures', list: ['It has a kind (List, Orders, Runs, Inventory, Cases or Records), and says which of its values plays each part the kind needs; the kind gives its status, its open rule and its ID rule.', 'The ID rule is entered or made new, with a prefix only when made new.', 'Container rules are latest, first, sum, count, average, min, max or list.', 'A calculated value names a function that exists, with each needed input filled from a value or $firstAt, $lastAt, $asOf, $entryCount, $lastAction.', 'No value is both a container and a calculated value, and no form saves to a value the structure works out.', 'Status rules have a status and a formula that reads.', 'No sessions (they were removed in 0.36).'] },
        { h: 'Functions', list: ['The name is letters, digits and _ and isn\'t a built-in.', 'Inputs have names and types; the formula reads with only its inputs, and gives what it says it gives.', 'No loops (a calls b calls a), and no deeper than the nesting limit.', 'A lookup names a structure, matches on its inputs, and gives back a value, several, or the whole item.', 'Functions and structures that use it still work.'] },
      ],
    };
  }

  const chapters = () => [fieldsChapter(), formChapter(), subformsChapter(), placesChapter(), mediaChapter(), formulasChapter(), checksChapter()];

  /* ---------- Drawing ---------- */
  const CSS = `
  .fph{display:grid;grid-template-columns:220px minmax(0,1fr);gap:16px;align-items:start}
  @media (max-width:900px){.fph{grid-template-columns:1fr}}
  .fph-nav{position:sticky;top:52px;display:flex;flex-direction:column;gap:4px}
  .fph-nav button{font:inherit;text-align:left;padding:8px 10px;border:1px solid var(--l-n-88);border-radius:8px;background:var(--s-n-100);cursor:pointer}
  .fph-nav button.on{border-color:var(--l-blue-42);background:var(--s-blue-93);font-weight:600}
  .fph-body{min-width:0;font-size:14px;line-height:1.5}
  .fph-body h2{margin:0 0 6px;font-size:20px}
  .fph-body h3{margin:18px 0 6px;font-size:15px;text-transform:uppercase;letter-spacing:.04em;color:var(--t-n-42)}
  .fph-body p.intro{color:var(--t-n-29);margin:0 0 10px}
  .fph-body pre{background:var(--s-n-100);border:1px solid var(--l-n-88);border-radius:8px;padding:10px 12px;font:13px/1.45 Consolas,"Cascadia Mono",monospace;overflow-x:auto}
  .fph-body table{border-collapse:collapse;width:100%;margin:4px 0 8px}
  .fph-body td{border-top:1px solid var(--l-n-95);padding:5px 8px;vertical-align:top}
  .fph-body td:first-child{font-family:Consolas,"Cascadia Mono",monospace;font-size:13px;white-space:nowrap;color:var(--t-blue-42);width:1%}
  .fph-item{border:1px solid var(--l-n-88);border-radius:8px;padding:8px 12px;margin:0 0 8px;background:var(--s-n-100)}
  .fph-item b{font-family:Consolas,"Cascadia Mono",monospace}
  .fph-item .t{color:var(--t-n-29)}
  .fph-item code{display:block;margin-top:4px;color:var(--t-violet-31);font:12px Consolas,monospace;white-space:pre-wrap}
  .fph-item table td:first-child{color:var(--t-teal-30)}
  .fph mark{background:var(--s-yellow-95)}`;
  function injectCss() { if (document.getElementById('fp-help-css')) return; const s = el('style'); s.id = 'fp-help-css'; s.textContent = CSS; document.head.appendChild(s); }

  const hit = (q, ...parts) => !q || parts.some(x => String(x || '').toLowerCase().includes(q));
  function blockHtml(b, q) {
    let h = '';
    const items = (b.items || []).filter(it => hit(q, it.name, it.title, it.text, it.example, (it.rows || []).map(r => r.join(' ')).join(' ')));
    const table = (b.table || []).filter(r => hit(q, r[0], r[1]));
    const list = (b.list || []).filter(x => hit(q, x));
    const code = b.code && hit(q, b.code) ? b.code : null;
    if (!items.length && !table.length && !list.length && !code) return '';
    if (b.h) h += `<h3>${esc(b.h)}</h3>`;
    if (list.length) h += `<ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    if (code) h += `<pre>${esc(code)}</pre>`;
    if (table.length) h += `<table>${table.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>`;
    items.forEach(it => {
      h += `<div class="fph-item"><b>${esc(it.title)}</b>${it.name && it.title !== it.name && !/\(/.test(it.title) ? ` <span class="fpe-hint">${esc(it.name)}</span>` : ''}${it.text ? `<div class="t">${esc(it.text)}</div>` : ''}${it.example ? `<code>${esc(it.example)}</code>` : ''}`
        + (it.rows && it.rows.length ? `<table>${it.rows.map(r => `<tr><td>${esc(r[0])}</td><td>${esc(r[1])}</td></tr>`).join('')}</table>` : '') + '</div>';
    });
    return h;
  }
  function chapterHtml(c, q) {
    const inner = c.blocks.map(b => blockHtml(b, q)).join('');
    if (q && !inner) return '';
    return `<section id="help-${c.id}"><h2>${esc(c.title)}</h2>${c.intro ? `<p class="intro">${esc(c.intro)}</p>` : ''}${inner}</section>`;
  }

  /* The whole reference as one HTML page, to save, print or share. */
  /* only: a chapter id (or a list of them) for just those chapters, like Fields for a newcomer. */
  function exportHtml(only) {
    const want = only == null ? null : [].concat(only);
    const list = chapters().filter(c => !want || want.includes(c.id));
    const body = list.map(c => chapterHtml(c, '')).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>Form Platform reference ${esc(FP.version)}</title><style>
body{font:14px/1.5 var(--font-sans,system-ui,"Segoe UI",sans-serif);color:var(--t-blue-15);max-width:900px;margin:24px auto;padding:0 16px}
h1{font-size:24px}h2{font-size:20px;border-bottom:2px solid var(--l-n-88);padding-bottom:4px;margin-top:28px}h3{font-size:14px;text-transform:uppercase;letter-spacing:.04em;color:var(--t-n-42)}
pre{background:var(--s-n-100);border:1px solid var(--l-n-88);border-radius:6px;padding:10px;font:12px/1.45 Consolas,monospace}
table{border-collapse:collapse;width:100%}td{border-top:1px solid var(--l-n-95);padding:4px 8px;vertical-align:top}td:first-child{font-family:Consolas,monospace;white-space:nowrap;color:var(--t-blue-42);width:1%}
.fph-item{border:1px solid var(--l-n-88);border-radius:6px;padding:6px 10px;margin:0 0 6px;break-inside:avoid}.fph-item b{font-family:Consolas,monospace}.fph-item code{display:block;color:var(--t-violet-31);font:12px Consolas,monospace;white-space:pre-wrap}
.fpe-hint{color:var(--t-n-42);font-size:12px}
@media print{body{margin:0;max-width:none;font-size:11px;line-height:1.35}h2{margin-top:10px}pre{font-size:10px;padding:6px}td{padding:2px 6px}}
</style></head><body><h1>${want && list.length === 1 ? esc(list[0].title) : 'Form Platform reference'}</h1><p>Kernel ${esc(FP.version)} · made ${esc(new Date().toLocaleString())} from the platform itself.</p>${body}</body></html>`;
  }

  async function help(host, opts) {
    opts = opts || {};
    injectCss();
    host.replaceChildren();
    const page = el('div', 'fpe');
    host.appendChild(page);
    const head = el('div', 'fpa-head');
    head.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin:0 0 12px';
    const h2 = el('h2', null, 'Help'); h2.style.margin = '0';
    const q = input('', { placeholder: 'Find in the reference: a setting, a function, a keyword…' });
    q.style.flex = '1 1 260px';
    const save = btn('Save as a page', 'small', () => {
      const blob = new Blob([exportHtml()], { type: 'text/html' });
      const a = el('a'); a.href = URL.createObjectURL(blob); a.download = `form-platform-reference-${FP.version}.html`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
    save.title = 'One HTML page with all of it, to print or share';
    const one = btn('Save this chapter', 'small', () => {
      const blob = new Blob([exportHtml(at)], { type: 'text/html' });
      const a = el('a'); a.href = URL.createObjectURL(blob); a.download = `form-platform-${at}-${FP.version}.html`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
    one.title = 'Just the chapter you are on, to print for someone';
    head.append(h2, q, one, save);
    page.appendChild(head);
    const wrap = el('div', 'fph');
    const nav = el('div', 'fph-nav');
    const body = el('div', 'fph-body');
    wrap.append(nav, body);
    page.appendChild(wrap);
    const all = chapters();
    let at = opts.chapter && all.some(c => c.id === opts.chapter) ? opts.chapter : 'fields';
    function paint() {
      const query = q.value.trim().toLowerCase();
      nav.replaceChildren(...all.map(c => { const b = btn(c.title, c.id === at && !query ? 'on' : '', () => { at = c.id; q.value = ''; paint(); }); return b; }));
      body.innerHTML = query ? (all.map(c => chapterHtml(c, query)).join('') || '<p class="intro">Nothing matches.</p>') : chapterHtml(all.find(c => c.id === at), '');
      if (opts.onChapter) opts.onChapter(at);
    }
    q.oninput = paint;
    paint();
    return { isDirty: () => false };
  }

  FP.help = { chapters, exportHtml };
  FP.editor.help = help;

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-help'] = '0.63.1';
})();
