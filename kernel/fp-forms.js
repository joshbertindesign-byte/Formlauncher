/* Form Platform runtime: forms (step 13)
 * Load after the kernel (fp-users.js, fp-media.js) and before fp-defs.js.
 *
 * A form is a definition (kind 'form') in the library:
 *
 *   {
 *     "title": "OD check",
 *     "action": "check",                         entries are named {structure}.check
 *     "items": { "od-checks": { "generate": true } },   where each structure's entry lands:
 *                                                 { "field": "rackId" } an ID typed, scanned or picked;
 *                                                 { "generate": true, "prefix": "OD" } a new item
 *     "fields": [
 *       { "name": "line", "control": "choice", "options": ["L01", "L02"], "ref": "line", "keep": true },
 *     Controls are generic ways of entering a kind of value; a field's label,
 *     options and writes give it its purpose. Nothing here knows what a rack is.
 *       { "name": "measuredOD", "control": "number", "unit": "in", "decimals": 3,
 *         "writes": "od-checks.measuredOD", "required": true, "limits": { "min": 0, "max": 10 } },
 *       { "name": "spec", "control": "value", "formula": "CurrentSpec(profile, \"od\")", "format": "{min} – {max} in" },
 *       { "name": "result", "control": "badge", "formula": "InSpec(measuredOD, spec.min, spec.max)",
 *         "colors": { "Pass": "good", "Fail": "bad" }, "snapshot": "od-checks.result", "required": true },
 *       { "name": "notes", "control": "textarea" }
 *     ],
 *     "layout": [ ["line 4", "profile 4", "measuredOD 4"], ["spec 6", "result 6"],
 *                 { "section": "Notes", "rows": [["notes 12"]] } ]
 *   }
 *
 * Layout (step 15) is a list of blocks:
 *   ["line 4", "profile 4", "notes 4"]
 *       a row: field names, each with a width out of 12 (PCs and tablets); phones show each field
 *       full width. One width per field (0.48): an older pc:N is read as N, and tablet:N and phone:N
 *       are no longer used (panels reflow for small screens instead).
 *       A size word stands for a width (0.44): S 3, M 4, L 6, Full 12. A row
 *       whose widths add up to more than 12 wraps onto the next line.
 *       The size is the form's own width: under 600 px a phone, under 1000 px
 *       a tablet, otherwise a PC. With no width, a row's fields share it evenly.
 *   { "section": "Notes", "rows": [...], "when": "...", "fold": "open" | "closed" }
 *       a box with a heading. fold lets people open and close it; several
 *       folding sections in a row make an accordion.
 *   { "tabs": [ { "tab": "Measure", "rows": [...], "when": "..." }, ... ] }
 *       one tab shows at a time; a tab with something to fix shows how many.
 *   { "panels": [ { "panel": "Your lines", "width": "narrow", "rows": [...] }, { "panel": "Readings", "rows": [...] } ] }
 *       groups side by side when the form is 900 px or wider, one above the other
 *       when it is narrower (0.44). width: narrow (320 px), third or half; a panel
 *       with no width shares what is left. Each panel has its own rows; its fields
 *       keep their sizes in a panel 400 px or wider, and are full width in a narrower one.
 *   { "steps": [ { "step": "Line", "rows": [...], "when": "..." }, ... ] }
 *       one step at a time, with Back and Next. Next needs the step complete,
 *       and Save is on the last step. One steps block per form, at the top
 *       level; rows outside it show on every step.
 * when hides a section, tab or step (and checks nothing in it) until true.
 *
 * Buttons (step 16). Without "buttons" a form has one Save. With them:
 *   { "name": "saveAll", "label": "Save", "action": "save", "scope": "form" }
 *       scope: "form" (every field), "tree" (the form and the linked records
 *       waiting with it), a list of field names, or { "section" | "tab" | "step": "Label" }.
 *       then (0.44): what the form does after this button saves the whole form:
 *       "next" (the default: it clears for the next record), "close" (back to the
 *       terminal's home screen; on a one-form launcher, as next) or "stay" (the
 *       saved record stays on screen; the next change starts a new record).
 *       A button checks only its scope and stays greyed out until the scope is
 *       complete; a dot marks a scope with unsaved changes. Saving a part keeps
 *       the record on screen (later saves go to the same items); saving the
 *       form or tree finishes the record and starts the next.
 *   { "name": "retest", "label": "Record re-test", "action": "open", "form": "od-retest",
 *     "link": "od-checks", "prefill": { "profile": "profile" }, "apply": { "retestResult": "result" } }
 *       opens another form over this one, with a breadcrumb to come back.
 *       prefill: the other form's fields, each set from a formula over this form's fields.
 *       link: the other form's entries get a reference to this form's item in that
 *       structure (a linked record). If that item isn't saved yet, the other form's
 *       Apply holds its record here until this form saves with scope "tree".
 *       apply: this form's fields set from the other form's values when it applies or saves.
 *   { "name": "done", "label": "Apply", "action": "apply" }
 *       hands values back to the form that opened this one; writes nothing. A form
 *       opened with link or apply gets an Apply button if it has none.
 * Buttons go in the layout by name like fields; the rest sit at the bottom.
 *
 * Print (step 18): "print": true, or { page: "letter" | "a4", orientation, margin (mm),
 * layout (rows for paper; default: the form's layout with every tab, step and fold
 * opened out), signatures: ["Checked by", ...], blankRows }. The launcher's Print
 * prints the record on screen, or a blank form for paper backup.
 *
 * Acknowledgments (step 18): "acknowledge": [ { name, label, show: "media" | "text",
 * where (media: { tag: formula } picking from the form's media list, see fp-media.js) | text, statement, every, when } ].
 * Entry fields stay locked until each item is opened (media) or read to the end
 * (text) and confirmed; fields the formulas need stay open. every: "record",
 * "day", "hours" (every so many hours) or "revision" (once per person per version of the file, by its
 * modified time: the default for media). Each confirmation is an entry in the built-in acknowledgments structure.
 *
 * Entry fields write a container (writes), name a reference (ref), or, with
 * neither, go on the submission record. Display fields show a formula's value;
 * formulas use field names as inputs, and a display field can use the ones
 * above it. snapshot saves a display field's raw value with the entry, marked
 * with the formula and function versions. One Save is one submission: one
 * entry per item touched, all or nothing.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.entry || !FP.fn || !FP.lookup || !FP.users) throw new Error('Load the kernel before fp-forms.js');

  // Fields that belong to no structure are kept on a submission record.
  FP.structures.define({ id: 'submissions', version: 1, containers: {} });
  // Proof that someone read something: item {userId}|{key}, one entry per confirmation.
  FP.structures.define({ id: 'acknowledgments', version: 1, containers: {} });

  const BASIC = ['text', 'textarea', 'number', 'choice', 'toggle', 'date', 'time', 'datetime'];
  const DISPLAY = ['value', 'badge', 'text', 'media', 'buttons'];
  const NAME_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;
  const SLUG_RE = /^[a-z][a-z0-9-]{0,39}$/;
  /* More controls register themselves (fp-controls.js, fp-visuals.js): FP.forms.register(name, {
   *   describe: { label, category: 'entry' | 'visual', help, value | data, settings: [...] },
   *   make(field, api) -> { wrap, get, set, focus, problem?, media?, formulaValue? }     entry controls
   *   render(box, value, field, shown, extras, api)                                      visual controls
   *   check?(field, where, problems, helpers) }). */
  const CONTROLS = {};
  const catOf = name => (CONTROLS[name] ? CONTROLS[name].describe.category : BASIC.includes(name) ? 'entry' : DISPLAY.includes(name) ? 'display' : null);
  const entryControls = () => BASIC.concat(Object.keys(CONTROLS).filter(n => catOf(n) === 'entry'));
  const isEntry = f => catOf(f.control) === 'entry';
  const isDisplay = f => catOf(f.control) === 'display' || catOf(f.control) === 'visual';
  const isVisual = f => catOf(f.control) === 'visual';
  const computed = f => f.control === 'value' || f.control === 'badge' || f.control === 'media' || f.control === 'buttons' || isVisual(f);

  /* ---------- The control catalog ----------
   * Every control describes the settings it takes, so a form editor can offer
   * them and publish can check them. A setting: { name, type, label, help,
   * required, default, options (choice), of (object and list), keys/values (map), min }.
   * Types: text, name, number, integer, boolean, choice, texts, options, formula,
   * target (structure.container), structure, field (a field of this form),
   * kind (a media kind), tone (good, warn, bad), map, object, list, any. */
  // A save's key: a structure, or structure~source for a second item of the same structure (FP.sources.itemKeys).
  const KEY_RE = /^[a-z][a-z0-9-]{0,39}(~[A-Za-z][A-Za-z0-9_]{0,39})?$/;
  const realSt = k => String(k == null ? '' : k).split('~')[0];
  const S = (name, type, label, extra) => Object.assign({ name, type, label }, extra || {});
  const TONES = ['good', 'warn', 'bad'];
  const COMMON = {
    all: [
      S('name', 'name', 'Name', { required: true, help: 'Used in formulas, layouts and buttons. Letters, digits and _.' }),
      S('control', 'control', 'Control', { required: true }),
      S('label', 'text', 'Label'),
      S('hint', 'text', 'Hint', { help: 'Small help text under the label.' }),
      S('when', 'formula', 'Show when', { help: 'The field shows, and is checked and saved, only while this is true.' }),
    ],
    entry: [
      S('required', 'boolean', 'Required'),
      S('writes', 'target', 'Saves to', { help: 'structure.container, e.g. od-checks.measuredOD' }),
      S('ref', 'name', 'Saves as a reference', { help: 'A reference role, e.g. line.' }),
      S('keep', 'boolean', 'Keep for the next record'),
      S('default', 'any', 'Starting value'),
      S('defaultFrom', 'formula', 'Starting value from a formula', { help: 'Follows the formula until someone changes the field, e.g. the next need for the line.' }),
      S('rule', 'formula', 'Must be true', { help: 'A rule the value must meet to save, e.g. ISBLANK(rack.$firstAt) for a rack not recorded yet.' }),
      S('ruleText', 'text', 'When it isn\'t', { help: 'What to tell them, e.g. Rack {value} is already recorded.' }),
      S('keyboard', 'choice', 'On-screen keyboard', { options: ['numbers', 'text', 'none'], help: 'For fields typed into, on terminals that show one: numbers a number pad, text a full keyboard, none for a scanned value. Left out: numbers for number fields, text for the rest.' }),
    ],
    computed: [
      S('formula', 'formula', 'Formula', { required: true }),
      S('required', 'boolean', 'Required', { help: 'Saving waits until it has a value.' }),
    ],
  };
  const BUILTIN = {
    text: { label: 'Text', category: 'entry', value: 'text', settings: [S('placeholder', 'text', 'Placeholder'), S('uppercase', 'boolean', 'Capital letters'), S('enterMovesOn', 'boolean', 'Enter moves to the next field', { help: 'Suits barcode scanners.' })] },
    textarea: { label: 'Long text', category: 'entry', value: 'text', settings: [S('placeholder', 'text', 'Placeholder')] },
    number: { label: 'Number', category: 'entry', value: 'number', settings: [
      S('unit', 'text', 'Unit'), S('decimals', 'integer', 'Decimals', { min: 0 }), S('placeholder', 'text', 'Placeholder'),
      S('limits', 'object', 'Allowed range', { help: 'Values outside it cannot be saved. Each end a number or a formula.', of: [S('min', 'numberOrFormula', 'Lowest'), S('max', 'numberOrFormula', 'Highest')] }),
      S('warn', 'object', 'Usual range', { help: 'Values outside it show a warning but can be saved. Each end a number or a formula, e.g. profile.lengthIn - 0.25.', of: [S('min', 'numberOrFormula', 'Lowest'), S('max', 'numberOrFormula', 'Highest'), S('message', 'text', 'Warning')] })] },
    choice: { label: 'Choice', category: 'entry', value: 'one of the options', settings: [
      S('options', 'options', 'Options', { help: 'Required unless options come from a formula, or it picks from a structure.' }), S('optionsFrom', 'formula', 'Options from a formula'),
      S('pick', 'structure', 'Pick from', { help: 'A structure: its open items are the options (a list\'s items in use; runs still running; orders not done). 0.60.' }),
      S('pickWhere', 'formula', 'Only those where', { help: 'With Pick from: a rule over each item, e.g. line = form.line.' }),
      S('optionLabel', 'formula', 'Each option says', { help: 'With options from a formula: a formula with item, e.g. item.label & " · " & item.made & "/" & item.racks.' }),
      S('colors', 'map', 'Colours', { keys: 'text', values: 'tone' }), S('list', 'boolean', 'Show as a drop-down'), S('placeholder', 'text', 'Placeholder')] },
    toggle: { label: 'Yes / no', category: 'entry', value: 'true or false', settings: [S('yes', 'text', 'Yes label'), S('no', 'text', 'No label')] },
    date: { label: 'Date', category: 'entry', value: 'a date, 2026-11-12', settings: [] },
    time: { label: 'Time', category: 'entry', value: 'a time, 14:30', settings: [] },
    datetime: { label: 'Date and time', category: 'entry', value: 'a date and time', settings: [] },
    value: { label: 'Value', category: 'display', data: 'any value', settings: [S('format', 'text', 'Format', { help: '{value}, or {min} – {max} for a record; or as TEXT formats it: ddd h:mm AM/PM, 0.0%.' }), S('decimals', 'integer', 'Decimals', { min: 0 }), S('snapshot', 'target', 'Saves its value to')] },
    badge: { label: 'Badge', category: 'display', data: 'a value', settings: [S('colors', 'map', 'Colours', { keys: 'text', values: 'tone', help: 'A value ← its colour; * for any other value.' }), S('format', 'text', 'Format'), S('decimals', 'integer', 'Decimals', { min: 0 }), S('snapshot', 'target', 'Saves its value to')] },
    // One button per item of a list: the hours of a shift, the open orders, the presses. Each says and colours
    // itself by a formula using item; tapping one opens a form (filled in from the item) or sets a field here.
    buttons: { label: 'Buttons from a list', category: 'display', data: 'a list', help: 'One button per item of a list, e.g. RANGE(6, 17) for the hours of a day shift. What each says and its colour are formulas using item; tapping opens a form filled in from the item, or sets a field here to it.', settings: [
      S('caption', 'formula', 'Each button says', { help: 'A formula with item, e.g. item & ":00". Leave it out to show the item.' }),
      S('tone', 'formula', 'Each button\'s colour', { help: 'A formula with item giving good, warn or bad (or nothing), e.g. IF(item < HOUR(NOW()), "bad", "")' }),
      S('form', 'form', 'Tapping opens'), S('prefill', 'map', 'Filled in on it', { help: 'Its field ← a formula with item, e.g. hour ← item.', values: 'formula' }),
      S('sets', 'field', 'Or tapping sets this field to the item'), S('empty', 'text', 'When the list is empty', { help: 'e.g. Start your shift first' }),
      // Cards (0.47): each item a card with a second line and buttons of its own, e.g. a line board.
      S('detail', 'formula', 'Each card\'s second line', { help: 'A formula with item, e.g. "Need " & item.need & " · " & item.racks & " racks". Makes each button a card.' }),
      S('actions', 'list', 'Each card\'s buttons', { help: 'Each opens its form filled in from the card\'s item.', of: [
        S('label', 'text', 'Label', { required: true }), S('form', 'form', 'Opens', { required: true }),
        S('prefill', 'map', 'Filled in on it', { help: 'Its field ← a formula with item, e.g. run ← item.$id.', values: 'formula' })] })] },
    media: { label: 'Media', category: 'display', data: 'files of this form\'s media list', help: 'Files from the form\'s media list, chosen by their tags: die ← dieNo shows the files tagged die = the Die no. field.', settings: [
      S('where', 'map', 'Shows the files tagged', { help: 'Tag ← a formula, e.g. die ← dieNo; kind ← "setup sheet". Empty: every file on the form\'s media list.', keys: 'text', values: 'formula' }),
      S('embed', 'boolean', 'Show the first one in the form'), S('height', 'integer', 'Height (px)', { min: 120 }), S('empty', 'text', 'When there is none', { help: 'e.g. No setup sheet for this die yet' })] },
  };
  const FORM_SETTINGS = [
    S('title', 'text', 'Title'), S('sites', 'texts', 'Sites', { required: true }), S('action', 'text', 'Name of its saves', { help: 'Older setting: entries are named structure.action. A save button can name its own saves (saveAs).' }),
    S('items', 'map', 'Items', { help: 'For each structure: { field } or { generate, prefix }.', keys: 'structure', values: 'any' }),
    S('fields', 'list', 'Fields', { required: true }), S('layout', 'any', 'Layout'), S('buttons', 'list', 'Buttons'),
    S('launchable', 'boolean', 'Has its own launcher'),
    S('home', 'boolean', 'Shown on the home screen (older)', { older: true, help: 'Before 0.51. Each terminal or group now picks its home form (Admin › the terminal or group); Clean-up moves this setting there. Read until then: on a terminal with no home form chosen, a form set to home is shown at the top of its home screen.' }),
    S('approval', 'boolean', 'Needs a supervisor\'s approval', { help: 'What a user saves waits, unsaved, until a supervisor approves it at a launcher. A supervisor\'s own saves are saved straight away.' }),
    S('density', 'choice', 'Spacing', { options: ['comfortable', 'compact'], help: 'compact: 44 px controls, short hints beside the label, messages over the field\'s edge, wider on big screens; for touch terminals. Sub-forms use their form\'s.' }),
    S('keyboard', 'choice', 'On-screen keyboard', { options: ['terminal', 'always'], help: 'always: the in-app keyboard opens for every field typed into, however it was tapped, on terminals whose keyboard is not set to never. terminal (or left out): the terminal\'s own setting. Sub-forms use their form\'s.' }),
    S('saveLabel', 'text', 'Save button label'), S('savedMessage', 'text', 'Message after saving'),
    S('backLabel', 'text', 'Back button label'), S('nextLabel', 'text', 'Next button label'),
    S('print', 'any', 'Print', { help: 'true, or { page, orientation, margin, layout, signatures, blankRows }.' }),
    S('acknowledge', 'list', 'Read before starting', { of: [
      S('name', 'name', 'Name', { required: true }), S('label', 'text', 'Label'), S('show', 'choice', 'What', { options: ['media', 'text'], required: true }),
      S('where', 'map', 'Files tagged', { help: 'For media: files of the form\'s media list whose tags match, e.g. die ← dieNo. Empty: every file on the list.', keys: 'text', values: 'formula' }), S('text', 'text', 'Text', { help: 'For text: what to read.' }),
      S('statement', 'text', 'Confirmation', { help: 'e.g. I have read {title}' }), S('every', 'choice', 'How often', { options: ['record', 'day', 'hours', 'revision'], older: ['shift'] }), S('hours', 'number', 'Every how many hours', { help: 'With every: hours, e.g. 12 for a 12-hour shift.', min: 1 }),
      S('required', 'boolean', 'Required', { default: true, help: 'fields stay locked until it is confirmed; off: shown, can be confirmed, never locks the form' }),
      S('when', 'formula', 'Only when')] }),
    S('media', 'any', 'Media', { help: 'Files from the media folder this form uses, each with tags: [{ path, title, tags: { die: "D-1047" } }]. Media fields and Read first pick from them by tag.' }),
    S('due', 'any', 'Due', { help: 'When the form is due (0.54): a list of schedules, see fp-due.js. Shown and missed on the launcher; misses recorded in dues.' }),
    S('refresh', 'number', 'Refresh every (minutes)', { help: 'Charts and lookups reload this often. Default 5 when the form has charts.' }),
    S('sources', 'list', 'Sources', { help: 'Named connections to items, lists of items and worked-out values; see fp-sources.js.' }),
    S('lists', 'any', 'Lists saved to', { help: 'Worked out from the sources when the form runs (a field saving the same value to every item of a list); never written by hand.' }),
  ];

  /* What a control is, for the editor: built in or registered. Display text has its own entry. */
  function describe(name) {
    if (CONTROLS[name]) return Object.assign({ name }, CONTROLS[name].describe);
    return BUILTIN[name] ? Object.assign({ name }, BUILTIN[name]) : null;
  }
  /* All of a field's settings: the common ones for its category, then the control's own. */
  function settingsFor(f) {
    const d = describe(f.control);
    if (!d) return null;
    const own = d.settings || [];
    const common = COMMON.all.concat(d.category === 'entry' ? COMMON.entry : COMMON.computed);
    return common.filter(c => !own.some(o => o.name === c.name)).concat(own);
  }
  const plain = v => v && typeof v === 'object' && !Array.isArray(v);

  /* Check values against settings: unknown names, missing required ones, and types. */
  function checkSettings(obj, settings, where, p, h, skip) {
    const byKey = new Map(settings.map(x => [x.name, x]));
    Object.keys(obj).forEach(k => {
      if (!byKey.has(k) && !(k === 'carried' && skip && skip.has(k))) {   // carried: made by a source's carry (0.50)
        const lk = k.toLowerCase();
        // Capitals aside, or at most two letters off (unt for unit).
        const off = (x, y) => { if (Math.abs(x.length - y.length) > 2) return 9; const d = Array.from({ length: x.length + 1 }, (_, i) => [i]); for (let j = 1; j <= y.length; j++) d[0][j] = j; for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1)); return d[x.length][y.length]; };
        const near = settings.find(x => x.name.toLowerCase() === lk) || settings.filter(x => off(x.name.toLowerCase(), lk) <= (lk.length > 4 ? 2 : 1)).sort((x, y) => off(x.name.toLowerCase(), lk) - off(y.name.toLowerCase(), lk))[0];
        p.push(`${where}: ${k} is not a setting here${near ? ` (did you mean ${near.name}?)` : ''}`);
      }
    });
    settings.forEach(x => {
      const v = obj[x.name];
      if (v == null) { if (x.required && !(skip && skip.has(x.name))) p.push(`${where}: ${x.name} is required`); return; }
      if (skip && skip.has(x.name)) return; // checked by the form check itself
      checkValue(v, x, `${where}: ${x.name}`, p, h);
    });
  }
  function checkValue(v, x, where, p, h) {
    const bad = what => p.push(`${where} must be ${what}`);
    switch (x.type) {
      case 'text': if (typeof v !== 'string') bad('text'); break;
      case 'name': if (!NAME_RE.test(String(v))) bad('a name (letters, digits, _)'); break;
      case 'number': if (typeof v !== 'number' || !isFinite(v)) bad('a number'); else if (x.min != null && v < x.min) bad(`at least ${x.min}`); break;
      case 'integer': if (!Number.isInteger(v)) bad('a whole number'); else if (x.min != null && v < x.min) bad(`at least ${x.min}`); break;
      case 'boolean': if (typeof v !== 'boolean') bad('true or false'); break;
      case 'choice': if (!x.options.includes(v) && !(x.older && x.older.includes(v))) bad(`one of ${x.options.join(', ')}`); break;
      case 'tone': if (!TONES.includes(v)) bad(`one of ${TONES.join(', ')}`); break;
      case 'texts': if (!Array.isArray(v) || v.some(t => typeof t !== 'string')) bad('a list of text'); break;
      case 'options': if (!Array.isArray(v) || !v.length || v.some(o => !(['string', 'number', 'boolean'].includes(typeof o) || (plain(o) && 'value' in o)))) bad('a list of options (text, or { value, label })'); break;
      case 'formula': if (typeof v !== 'string') bad('a formula'); else h.formulaOk(where, v); break;
      case 'numberOrFormula': if (typeof v === 'number') { if (!isFinite(v)) bad('a number'); } else if (typeof v !== 'string' || !v.trim()) bad('a number or a formula'); else h.formulaOk(where, v); break;
      case 'target': { const t = target(v); if (!t || !SLUG_RE.test(t.structure) || !NAME_RE.test(t.container)) bad('structure.container'); break; }
      case 'structure': if (!SLUG_RE.test(String(v))) bad('a structure name'); break;
      case 'form': if (!SLUG_RE.test(String(v))) bad('a form name'); break;
      case 'field': if (!h.names.has(v)) bad('a field of this form'); break;
      case 'kind': if (!/^[a-z][a-z0-9-]{0,30}$/.test(String(v))) bad('a short lowercase name, like photo'); break;
      case 'map':
        if (!plain(v)) { bad('a set of name: value pairs'); break; }
        Object.entries(v).forEach(([k, val]) => {
          if (x.keys === 'field' && !h.names.has(k)) p.push(`${where}: ${k} is not a field of this form`);
          if (x.keys === 'structure' && !SLUG_RE.test(k)) p.push(`${where}: ${k} is not a structure name`);
          if (x.values && x.values !== 'any') checkValue(val, { type: x.values, options: x.options }, `${where}.${k}`, p, h);
        });
        break;
      case 'object': if (!plain(v)) bad('a set of settings'); else checkSettings(v, x.of || [], where, p, h); break;
      case 'list':
        if (!Array.isArray(v)) { bad('a list'); break; }
        // A list of settings; one that allows it (fixed rows) also takes a bare word for its first setting.
        if (x.of) v.forEach((item, i) => { if (x.strings && typeof item === 'string' && item.trim()) return; if (!plain(item)) p.push(`${where} ${i + 1} must be a set of settings`); else checkSettings(item, x.of, `${where} ${i + 1}`, p, h); });
        break;
      default: break; // any
    }
  }

  /* Every formula in a form: fields (any formula setting), layout rules and buttons. */
  function formulasOf(def) {
    const out = [];
    const walkSettings = (obj, settings) => settings.forEach(x => {
      const v = obj[x.name];
      if (v == null) return;
      if (x.type === 'formula' && typeof v === 'string') out.push(v);
      else if (x.type === 'map' && x.values === 'formula' && plain(v)) Object.values(v).forEach(f => typeof f === 'string' && out.push(f));
      else if (x.type === 'object' && plain(v) && x.of) walkSettings(v, x.of);
      else if (x.type === 'list' && Array.isArray(v) && x.of) v.forEach(i => plain(i) && walkSettings(i, x.of));
    });
    ((def && def.fields) || []).forEach(f => { const st = f && settingsFor(f); if (st) walkSettings(f, st); });
    ((def && def.acknowledge) || []).forEach(a => { if (a) [a.formula, a.when].forEach(x => typeof x === 'string' && out.push(x)); });
    return out;
  }
  const blank = v => v == null || v === '' || (Array.isArray(v) && !v.length);
  const fmtNum = n => String(Math.round(n * 1e6) / 1e6);
  const target = w => { const i = String(w || '').indexOf('.'); return i > 0 ? { structure: w.slice(0, i), container: w.slice(i + 1) } : null; };

  /* ---------- Layout ---------- */
  const WIDTH_RE = /^(?:(pc|tablet|phone):)?(\d{1,2})$/;
  /* Size words (0.44): what the layout editor offers, a share of the row. */
  const SIZES = { s: 3, m: 4, l: 6, full: 12 };
  const PANEL_WIDTHS = ['narrow', 'third', 'half'];
  function parseCell(text, count) {
    const [name, ...rest] = String(text).trim().split(/\s+/);
    const w = { base: null, pc: null, tablet: null, phone: null };
    const bad = [];
    rest.forEach(t => {
      const word = /^(?:(pc|tablet|phone):)?([a-z]+)$/i.exec(t);
      if (word && SIZES[word[2].toLowerCase()]) { w[word[1] || 'base'] = SIZES[word[2].toLowerCase()]; return; }
      const m = WIDTH_RE.exec(t);
      const n = m ? Number(m[2]) : NaN;
      if (!(n >= 1 && n <= 12)) bad.push(t);
      else w[m[1] || 'base'] = n;
    });
    const base = w.base || w.pc || Math.max(1, Math.floor(12 / Math.max(1, count)));
    return { name, pc: base, tablet: base, phone: 12, bad };
  }

  function checkLayout(list, where, p, formulaOk, placed, top) {
    if (!Array.isArray(list)) { p.push(`${where}: rows must be a list`); return; }
    list.forEach((r, i) => {
      if (Array.isArray(r)) {
        r.forEach(c => {
          const x = parseCell(c, r.length);
          placed.push(x.name);
          x.bad.forEach(t => p.push(`${where}: "${c}": ${t} is not a width; use S, M, L or Full, or 1 to 12`));
        });
        return;
      }
      if (!r || typeof r !== 'object') { p.push(`${where}: each row is a list of fields, a section, panels, tabs or steps`); return; }
      if (Array.isArray(r.panels)) {
        if (r.panels.length < 2) p.push(`${where}: panels needs at least two panels`);
        r.panels.forEach((t, j) => {
          const w = `Panel ${(t && t.panel) || j + 1}`;
          if (!t || typeof t !== 'object') { p.push(`${w}: a panel is { "panel": "Heading", "rows": [ ... ] }`); return; }
          if (t.width != null && !PANEL_WIDTHS.includes(t.width)) p.push(`${w}: width is ${PANEL_WIDTHS.join(', ')}, or left out to share what is left`);
          if (t.when) formulaOk(`${w} (when)`, t.when);
          checkLayout(t.rows, w, p, formulaOk, placed, false);
        });
        return;
      }
      if (Array.isArray(r.tabs) || Array.isArray(r.steps)) {
        const kind = r.tabs ? 'tab' : 'step';
        const items = r.tabs || r.steps;
        if (kind === 'step' && !top) p.push(`${where}: steps can only be at the top of the layout, not inside a section or tab`);
        if (!items.length) p.push(`${where}: ${kind}s needs at least one ${kind}`);
        items.forEach((t, j) => {
          const label = t && typeof t[kind] === 'string' && t[kind].trim() ? t[kind].trim() : null;
          const w = `${kind === 'tab' ? 'Tab' : 'Step'} ${label || j + 1}`;
          if (!label) p.push(`${w}: give it a name, e.g. { "${kind}": "Measure", "rows": [ ... ] }`);
          if (t && t.when) formulaOk(`${w} (when)`, t.when);
          checkLayout(t && t.rows, w, p, formulaOk, placed, false);
        });
        return;
      }
      if (Array.isArray(r.rows)) {
        const w = `Section ${r.section || i + 1}`;
        if (r.when) formulaOk(`${w} (when)`, r.when);
        if (r.fold != null && !['open', 'closed'].includes(r.fold)) p.push(`${w}: fold is "open" or "closed"`);
        if (r.fold != null && !r.section) p.push(`${w}: a section that folds needs a heading (section)`);
        checkLayout(r.rows, w, p, formulaOk, placed, false);
        return;
      }
      p.push(`${where}: each row is a list of fields, a section, panels, tabs or steps`);
    });
  }

  const ACTIONS = ['save', 'apply', 'open', 'subform', 'set'];

  /* ---------- Sub-forms (0.40) ----------
   * "subforms": [ { name, label, title (a formula naming it, e.g. "Re-test for " & dieNo),
   *   sources, fields, layout (a form of its own, inside this one; it reads this form's fields and sources by name,
   *   and each (the list item) and index (1, 2, …) when it repeats),
   *   repeat: { count: formula } | { list: formula } | { open: true } (as many as needed),
   *   saves: "with" (default: its records are saved with this form's save) | "own" (its own Save, at once),
   *   required, link (which of this form's items its records point to; default the first one this form saves),
   *   back: [ { to: field here, from: its field, how: first | last | avg | min | max | sum | count | join | all } ] } ]
   * A button with action "subform" and subform: name opens it. */
  const HOWS = ['first', 'last', 'avg', 'min', 'max', 'sum', 'count', 'join', 'all'];
  const HOW_LABEL = { first: 'the first', last: 'the last', avg: 'the average', min: 'the lowest', max: 'the highest', sum: 'the total', count: 'how many', join: 'all, joined', all: 'all of them (a list)' };
  const kindOfField = f => (!f ? 'any'
    : ['number', 'slider', 'tally', 'timer', 'rating'].includes(f.control) ? 'number'
    : ['file', 'draw'].includes(f.control) ? 'file'
    : f.control === 'toggle' ? 'boolean'
    : ['date', 'datetime'].includes(f.control) ? 'date'
    : ['chips', 'table'].includes(f.control) ? 'list'
    : catOf(f.control) === 'entry' ? 'text' : 'any');
  const KIND_WORD = { number: 'a number', file: 'files', boolean: 'yes or no', date: 'a date', list: 'a list', text: 'text', any: 'a value' };
  const repeatKind = sf => (!sf.repeat ? 'once' : sf.repeat.list != null ? 'list' : sf.repeat.count != null ? 'count' : 'open');
  /* Names a sub-form sees from the form it is in. */
  const outerNames = master => (master.fields || []).map(f => f && f.name)
    .concat((Array.isArray(master.sources) ? master.sources : []).map(x => x && x.name), ['each', 'index', 'others']).filter(Boolean);
  function subDef(master, sf) {
    const d = { title: sf.label || sf.name, fields: sf.fields, __outer: outerNames(master) };
    if (master && master.media) d.media = master.media;   // a sub-form shows the master form's media
    ['sources', 'layout', 'items', 'lists'].forEach(k => { if (sf[k] != null) d[k] = sf[k]; });
    return d;
  }
  /* Whether a value sent back fits the field it lands in: '' when it does, else why not. */
  function backFits(sf, fromF, toF, how) {
    const from = kindOfField(fromF), to = kindOfField(toF);
    const many = repeatKind(sf) !== 'once';
    const label = x => (x && (x.label || x.name)) || '?';
    if (!many && how) return `${sf.label || sf.name} doesn't repeat, so ${label(fromF)} is one value: leave "${HOW_LABEL[how] || how}" out`;
    if (many && !how) return `${sf.label || sf.name} repeats, so ${label(fromF)} is several values and ${label(toF)} holds one: pick the first, the last, the average, the lowest, the highest, the total, how many, or all joined`;
    const one = (a, b) => a === b || b === 'text' && ['number', 'date', 'boolean', 'any'].includes(a) || (a === 'any' && !['file', 'list'].includes(b));
    let ok;
    if (!how || how === 'first' || how === 'last') ok = one(from, to);
    else if (['avg', 'min', 'max', 'sum'].includes(how)) ok = ['number', 'any'].includes(from) && ['number', 'text'].includes(to);
    else if (how === 'count') ok = ['number', 'text'].includes(to);
    else if (how === 'join') ok = to === 'text' && from !== 'file';
    else if (how === 'all') ok = to === 'list' || (from === 'file' && to === 'file');
    if (ok) return '';
    if (['avg', 'min', 'max', 'sum'].includes(how) && !['number', 'any'].includes(from)) return `${label(fromF)} is ${KIND_WORD[from]}, so it has no ${HOW_LABEL[how].replace('the ', '')}`;
    if (how === 'all') return `${label(toF)} holds one value; a list goes to a field that holds several (chips, a table, files)`;
    return `${label(fromF)} is ${KIND_WORD[from]}${how ? ` (${HOW_LABEL[how]})` : ''}, and ${label(toF)} holds ${KIND_WORD[to]}`;
  }
  function checkSubforms(raw, p, formulaOk, byName, btnNames, writes) {
    if (raw.subforms == null) return;
    if (!Array.isArray(raw.subforms)) { p.push('subforms must be a list'); return; }
    const taken = new Set(Array.from(byName.keys()).concat(Array.from(btnNames), (Array.isArray(raw.sources) ? raw.sources : []).map(x => x && x.name).filter(Boolean)));
    raw.subforms.forEach((sf, i) => {
      const w = `Sub-form ${sf && sf.name ? sf.name : i + 1}`;
      if (!plain(sf)) { p.push(`${w}: must be { name, fields, … }`); return; }
      if (!NAME_RE.test(sf.name || '')) { p.push(`${w}: needs a name (letters, digits, _; starting with a letter)`); return; }
      if (taken.has(sf.name)) p.push(`${w}: the name is used by a field, button, source or other sub-form here`);
      taken.add(sf.name);
      if (sf.label != null && typeof sf.label !== 'string') p.push(`${w}: label is text`);
      if (sf.title) formulaOk(`${w} (title)`, sf.title);
      if (sf.subforms != null) p.push(`${w}: a sub-form can't have sub-forms of its own`);
      if (sf.saves != null && !['with', 'own'].includes(sf.saves)) p.push(`${w}: saves is "with" (with this form) or "own" (its own Save)`);
      if (sf.required != null && typeof sf.required !== 'boolean') p.push(`${w}: required is true or false`);
      if (sf.repeat != null) {
        const r = sf.repeat;
        if (!plain(r) || [r.count != null, r.list != null, r.open === true].filter(Boolean).length !== 1) p.push(`${w}: repeat is { count }, { list } or { open: true }`);
        else if (r.count != null && typeof r.count !== 'number') formulaOk(`${w} (how many)`, String(r.count));
        else if (r.list != null) formulaOk(`${w} (for each)`, String(r.list));
      }
      if (sf.link != null && !writes.has(sf.link)) p.push(`${w}: link names ${sf.link}, which this form doesn't save to`);
      const inner = check(subDef(raw, sf)).map(x => `${w}: ${x}`);
      p.push(...inner);
      const theirs = new Map((Array.isArray(sf.fields) ? sf.fields : []).filter(f => f && f.name).map(f => [f.name, f]));
      if (sf.back != null && !Array.isArray(sf.back)) p.push(`${w}: back is a list of { to, from, how }`);
      const landed = new Set();
      (Array.isArray(sf.back) ? sf.back : []).forEach(b => {
        if (!plain(b)) { p.push(`${w}: each value sent back is { to, from, how }`); return; }
        const toF = byName.get(b.to), fromF = theirs.get(b.from);
        if (!toF || !isEntry(toF)) { p.push(`${w}: sends back to ${b.to}, which is not a field people fill in here`); return; }
        if (!fromF) { p.push(`${w}: sends back ${b.from}, which is not one of its fields`); return; }
        if (landed.has(b.to)) p.push(`${w}: two values are sent back to ${toF.label || b.to}`);
        landed.add(b.to);
        if (b.how != null && !HOWS.includes(b.how)) { p.push(`${w}: how is one of ${HOWS.join(', ')}`); return; }
        const why = backFits(sf, fromF, toF, b.how);
        if (why) p.push(`${w}: ${why}`);
      });
      if (!(Array.isArray(raw.buttons) ? raw.buttons : []).some(b => b && b.action === 'subform' && b.subform === sf.name)) p.push(`${w}: no button opens it (add one, or pick it as a button's sub-form)`);
    });
  }
  /* ---------- Walking a layout (0.50): one place that knows a layout's shape ----------
   * A layout is a list of rows (lists of cells: "name width") and blocks: a section { rows }, or a set of tabs, steps
   * or panels, each { rows }. FP.layout.lists(block) gives a block's own lists of rows; FP.layout.rows(layout, fn)
   * visits every row with the list it sits in; FP.layout.cells(layout) lists every cell. */
  const LAYOUT = {
    KIDS: ['tabs', 'steps', 'panels'],
    lists(r) {
      if (!r || Array.isArray(r) || typeof r !== 'object') return [];
      const out = Array.isArray(r.rows) ? [r.rows] : [];
      ['tabs', 'steps', 'panels'].forEach(k => (Array.isArray(r[k]) ? r[k] : []).forEach(t => { if (t && Array.isArray(t.rows)) out.push(t.rows); }));
      return out;
    },
    rows(list, fn) { (Array.isArray(list) ? list : []).forEach((r, i) => { if (Array.isArray(r)) fn(r, list, i); else LAYOUT.lists(r).forEach(l => LAYOUT.rows(l, fn)); }); },
    cells(list) { const out = []; LAYOUT.rows(list, r => r.forEach(c => out.push(String(c)))); return out; },
    nameOf: c => String(c).trim().split(/\s+/)[0],
  };
  FP.layout = LAYOUT;

  /* The labels of the layout's sections, tabs and steps: 'section:Notes', 'tab:Checks'. */
  function layoutLabels(list, out) {
    out = out || new Set();
    (Array.isArray(list) ? list : []).forEach(r => {
      if (!r || Array.isArray(r) || typeof r !== 'object') return;
      if (Array.isArray(r.rows)) { if (r.section) out.add('section:' + r.section); layoutLabels(r.rows, out); }
      (r.tabs || []).forEach(t => { if (t) { out.add('tab:' + t.tab); layoutLabels(t.rows, out); } });
      (r.steps || []).forEach(t => { if (t) { out.add('step:' + t.step); layoutLabels(t.rows, out); } });
      (r.panels || []).forEach(t => { if (t) { if (t.panel) out.add('panel:' + t.panel); layoutLabels(t.rows, out); } });
    });
    return out;
  }

  // Field settings the form check below looks at itself (with better messages).
  const CHECKED_BELOW = new Set(['name', 'control', 'writes', 'ref', 'snapshot', 'when', 'optionsFrom', 'formula', 'carried']);
  const allControls = () => entryControls().concat(DISPLAY, Object.keys(CONTROLS).filter(n => catOf(n) === 'visual'));

  /* ---------- Checking a form definition ---------- */
  function check(def) {
    if (!def || typeof def !== 'object') return ['A form must be an object'];
    // Picks and fills (0.60) are checked as written, then the form as the runtime works with it.
    const kindProblems = FP.kinds ? FP.kinds.checkForm(def) : [];
    if (FP.kinds) def = FP.kinds.form(def);
    const raw = def;
    const outer = new Set(Array.isArray(def.__outer) ? def.__outer : []);
    // Sources first, then everything else on the form as the save path sees it.
    const p = kindProblems.concat(FP.sources ? (Array.isArray(def.sources) ? FP.sources.check(def) : FP.sources.checkLegacy(def)) : []);
    if (FP.sources) def = FP.sources.normalize(def);
    if (def.title != null && typeof def.title !== 'string') p.push('title must be text');
    if (def.action != null && !/^[a-z][a-zA-Z0-9]{0,39}$/.test(def.action)) p.push('action must be a word like check or disposition');
    if (!Array.isArray(def.fields) || !def.fields.length) { p.push('fields must be a list with at least one field'); return p; }
    const names = new Set();
    const fieldNames = new Set(def.fields.map(f => f && f.name).filter(Boolean));
    checkSettings(Object.fromEntries(Object.entries(def).filter(([k]) => !['fields', 'subforms', '__outer'].includes(k))), FORM_SETTINGS.filter(x => x.name !== 'fields'), 'Form', p, { formulaOk: () => {}, names: fieldNames }, new Set(['items', 'layout', 'buttons', 'sites', 'print', 'acknowledge', 'sources', 'subforms', '__outer', 'media', 'due']));
    if (FP.media) p.push(...FP.media.check(def));
    if (FP.due) p.push(...FP.due.check(def));
    const builtins = new Set(FP.fn.builtins());
    const formulaOk = (where, formula) => {
      const s = FP.fn.syntax(String(formula || ''));
      if (s.error) p.push(`${where}: ${s.error}`);
      else s.calls.forEach(n => { if (!builtins.has(n.toUpperCase()) && !FP.fn.get(n)) p.push(`${where}: no function named ${n}`); });
    };
    def.fields.forEach((f, i) => {
      const where = `Field ${f && f.name ? f.name : i + 1}`;
      if (!f || !NAME_RE.test(f.name || '')) { p.push(`${where}: needs a name (letters, digits, _; starting with a letter)`); return; }
      if (names.has(f.name)) p.push(`${where}: the name is used twice`);
      names.add(f.name);
      if (!isEntry(f) && !isDisplay(f)) { p.push(`${where}: control must be one of ${allControls().join(', ')}`); return; }
      // Settings by the catalog; the rules below add what types alone can't say.
      checkSettings(f, settingsFor(f), where, p, { formulaOk, names: fieldNames }, CHECKED_BELOW);
      if (CONTROLS[f.control] && CONTROLS[f.control].check) CONTROLS[f.control].check(f, where, p, { formulaOk, NAME_RE, SLUG_RE, names: fieldNames });
      if (f.writes != null) {
        const t = target(f.writes);
        if (!isEntry(f)) p.push(`${where}: only entry fields write; use snapshot on a display field`);
        else if (!t || !(KEY_RE.test(t.structure) || (def.lists && def.lists[t.structure])) || !NAME_RE.test(t.container)) p.push(`${where}: writes must be structure.container`);
      }
      if (f.ref != null && !NAME_RE.test(f.ref)) p.push(`${where}: ref must be a reference role like line`);
      if (f.snapshot != null) { const t = target(f.snapshot); if (!t || !KEY_RE.test(t.structure) || !NAME_RE.test(t.container)) p.push(`${where}: snapshot must be structure.container`); }
      if (f.control === 'choice' && !(Array.isArray(f.options) && f.options.length) && !f.optionsFrom) p.push(`${where}: a choice needs options, or a structure to pick from`);
      if (f.control === 'buttons' && f.actions != null) {
        if (!Array.isArray(f.actions)) p.push(`${where}: each card's buttons are a list`);
        else f.actions.forEach((a, j) => {
          const aw = `${where}, card button ${a && a.label ? a.label : j + 1}`;
          if (!a || typeof a !== 'object' || !a.label) p.push(`${aw}: needs a label`);
          else if (!SLUG_RE.test(a.form || '')) p.push(`${aw}: say which form it opens`);
          if (a && a.prefill != null) { if (typeof a.prefill !== 'object' || Array.isArray(a.prefill)) p.push(`${aw}: Filled in on it is field ← formula`); else Object.entries(a.prefill).forEach(([k, x]) => formulaOk(`${aw} (${k})`, String(x))); }
          if (a && a.when != null) formulaOk(`${aw} (when)`, a.when);
        });
      }
      if (f.optionsFrom) formulaOk(`${where} options`, f.optionsFrom);
      if (computed(f)) {
        if (f.formula) formulaOk(where, f.formula);
        else if (f.control !== 'media') p.push(`${where}: a ${f.control} needs a formula`);
      }
      if (f.when) formulaOk(`${where} (when)`, f.when);
      if (f.optionLabel && !f.optionsFrom) p.push(`${where}: Each option says goes with options from a formula`);
      if ((f.rule || f.ruleText) && !isEntry(f)) p.push(`${where}: Must be true is for fields people fill in`);
      if (f.ruleText && !f.rule) p.push(`${where}: When it isn't goes with Must be true`);
      if (f.defaultFrom && f.default !== undefined) p.push(`${where}: give a starting value or a formula for it, not both`);
    });
    const byName = new Map(def.fields.filter(f => f && f.name).map(f => [f.name, f]));
    Object.entries(def.items || {}).forEach(([s, cfg]) => {
      if (!KEY_RE.test(s)) p.push(`items: bad structure ${s}`);
      if (cfg && cfg.field && !byName.has(cfg.field) && !outer.has(cfg.field)) p.push(`items.${s}: no field named ${cfg.field}`);
      if (!cfg || (!cfg.field && !cfg.generate && !cfg.fixed && !cfg.where)) p.push(`items.${s}: say field, fixed, where or generate`);
    });
    // Print: true, or settings. Printing follows the form's own layout.
    const PRINT = [S('page', 'choice', 'Paper', { options: ['letter', 'a4'] }), S('orientation', 'choice', 'Orientation', { options: ['portrait', 'landscape'] }),
      S('margin', 'integer', 'Margin (mm)', { min: 5 }), S('signatures', 'texts', 'Signature lines'), S('blankRows', 'integer', 'Table rows on a blank form', { min: 1 })];
    if (def.print != null && def.print !== true && def.print !== false) {
      if (!plain(def.print)) p.push('print is true, or { page, orientation, margin, signatures, blankRows }');
      else {
        checkSettings(def.print, PRINT, 'Print', p, { formulaOk, names: fieldNames });
      }
    }
    // A picker needs a structure.
    def.fields.forEach(f => {
      if (!f || !f.name) return;
      if (f.control === 'pick' && !f.structure) p.push(`Field ${f.name}: say which structure to pick from`);
    });
    // Acknowledgments: text needs the text; media picks from the form's media list.
    const ackNames = new Set();
    (Array.isArray(def.acknowledge) ? def.acknowledge : []).forEach((a, i) => {
      const w = `Read before starting ${a && a.name ? a.name : i + 1}`;
      if (!plain(a)) return;
      checkSettings(a, (FORM_SETTINGS.find(x => x.name === 'acknowledge').of), w, p, { formulaOk, names: fieldNames });
      if (a.name && ackNames.has(a.name)) p.push(`${w}: the name is used twice`);
      ackNames.add(a.name);
      if (a.show === 'media' && !(Array.isArray(def.media) && def.media.length)) p.push(`${w}: this form has no media yet: attach the files to read under Media`);
      if (a.show === 'text' && !a.text) p.push(`${w}: give the text to read`);
    });

    if (typeof def.savedMessage === 'string') (def.savedMessage.match(/\{([^}]*)\}/g) || []).forEach(m => { if (!byName.has(m.slice(1, -1))) p.push(`The saved message names {${m.slice(1, -1)}}, which is not a field`); });
    // Buttons: save (with a scope), apply, open another form.
    const btnNames = new Set();
    const labels = layoutLabels(def.layout);
    const writes = new Set(Object.keys(def.items || {}));
    def.fields.forEach(f => { if (f && f.writes && target(f.writes)) writes.add(target(f.writes).structure); });
    if (def.buttons != null && !Array.isArray(def.buttons)) p.push('buttons must be a list');
    (Array.isArray(def.buttons) ? def.buttons : []).forEach((b, i) => {
      const w = `Button ${b && b.name ? b.name : i + 1}`;
      if (!b || !NAME_RE.test(b.name || '')) { p.push(`${w}: needs a name (letters, digits, _)`); return; }
      if (byName.has(b.name) || btnNames.has(b.name)) p.push(`${w}: the name is used twice`);
      btnNames.add(b.name);
      if (!ACTIONS.includes(b.action)) { p.push(`${w}: action must be ${ACTIONS.join(', ')}`); return; }
      if (b.label != null && typeof b.label !== 'string') p.push(`${w}: label is text`);
      if (b.when) formulaOk(`${w} (when)`, b.when);
      if (b.then != null && (b.action !== 'save' || !['next', 'close', 'stay'].includes(b.then))) p.push(`${w}: then is next, close or stay, on a save button`);
      if (typeof b.savedMessage === 'string') (b.savedMessage.match(/\{([^}]*)\}/g) || []).forEach(m => { if (!byName.has(m.slice(1, -1))) p.push(`${w}: the saved message names {${m.slice(1, -1)}}, which is not a field`); });
      // set (0.46): fills fields with fixed values, e.g. All pass sets Surface, Color and Gauge to Pass; nothing is saved.
      if (b.action === 'set') {
        if (!b.sets || typeof b.sets !== 'object' || Array.isArray(b.sets) || !Object.keys(b.sets).length) p.push(`${w}: say which fields it sets, e.g. { "surface": "Pass" }`);
        else Object.entries(b.sets).forEach(([n, v]) => {
          const f = byName.get(n);
          if (!f) p.push(`${w}: sets ${n}, which is not a field`);
          else if (!isEntry(f)) p.push(`${w}: sets ${n}, which is not filled in by people`);
          if (v != null && typeof v === 'object') p.push(`${w}: ${n} is set to a value (text, a number, true or false)`);
        });
      } else if (b.sets != null) p.push(`${w}: sets is for buttons that set fields`);
      if (b.saveAs != null && (b.action !== 'save' || typeof b.saveAs !== 'string' || !/^[a-z][a-zA-Z0-9]{0,39}$/.test(b.saveAs))) p.push(`${w}: saveAs names a save button's saves: a word like check, ship or create`);
      if (b.action === 'save' && b.scope != null) {
        const sc = b.scope;
        if (Array.isArray(sc)) sc.forEach(n => { if (!byName.has(n)) p.push(`${w}: scope names ${n}, which is not a field`); });
        else if (sc && typeof sc === 'object') {
          const kind = ['section', 'tab', 'step'].find(k => typeof sc[k] === 'string');
          if (!kind) p.push(`${w}: scope is "form", "tree", a list of fields, or { "section": "Label" } (or tab, step)`);
          else if (!labels.has(kind + ':' + sc[kind])) p.push(`${w}: there is no ${kind} called ${sc[kind]} in the layout`);
        } else if (sc !== 'form' && sc !== 'tree') p.push(`${w}: scope is "form", "tree", a list of fields, or { "section": "Label" } (or tab, step)`);
      }
      if (b.action === 'subform' && !(Array.isArray(raw.subforms) && raw.subforms.some(x => x && x.name === b.subform))) p.push(`${w}: say which sub-form it opens`);
      if (b.action === 'open') {
        if (!SLUG_RE.test(b.form || '')) p.push(`${w}: say which form it opens (form)`);
        if (b.link != null && !writes.has(b.link)) p.push(`${w}: link names ${b.link}, which this form doesn't write to`);
        if (b.prefill != null && (typeof b.prefill !== 'object' || Array.isArray(b.prefill))) p.push(`${w}: prefill maps the other form's fields to formulas`);
        Object.entries(b.prefill || {}).forEach(([k, f]) => { if (!NAME_RE.test(k)) p.push(`${w}: prefill: ${k} is not a field name`); formulaOk(`${w} prefill ${k}`, f); });
        if (b.apply != null && (typeof b.apply !== 'object' || Array.isArray(b.apply))) p.push(`${w}: apply maps this form's fields to the other form's fields`);
        Object.entries(b.apply || {}).forEach(([mine, theirs]) => {
          if (!byName.has(mine) || !isEntry(byName.get(mine))) p.push(`${w}: apply sets ${mine}, which is not an entry field here`);
          if (!NAME_RE.test(String(theirs))) p.push(`${w}: apply ${mine}: say the other form's field name`);
        });
      }
    });
    if ((def.buttons || []).some(b => b && b.action === 'save' && b.scope === 'tree') && !(def.buttons || []).some(b => b && ((b.action === 'open' && b.link) || b.action === 'subform'))) {
      p.push('A save with scope "tree" needs an open button with link: otherwise use "form"');
    }
    checkSubforms(raw, p, formulaOk, byName, btnNames, writes);

    // Layout: every placed name exists, none twice, every required field placed.
    const placed = [];
    if (def.layout != null) {
      checkLayout(def.layout, 'Layout', p, formulaOk, placed, true);
      if (Array.isArray(def.layout) && def.layout.filter(r => r && Array.isArray(r.steps)).length > 1) p.push('Layout: a form can have one steps block');
    }
    if (def.layout) {
      const seen = new Set();
      placed.forEach(n => { if (!byName.has(n) && !btnNames.has(n)) p.push(`Layout: no field or button named ${n}`); if (seen.has(n)) p.push(`Layout: ${n} is placed twice`); seen.add(n); });
      def.fields.forEach(f => { if (f && f.required && !seen.has(f.name)) p.push(`Layout: required field ${f.name} is not placed`); });
    }
    return p;
  }

  /* ---------- Formatting ---------- */
  function show(v, f) {
    const d = FP.fn.describe(v, f);
    if (d.state !== 'value') return d;
    if (Array.isArray(v)) return { state: 'value', text: v.map(x => (x && typeof x === 'object' ? (x.title || x.id || JSON.stringify(x)) : String(x))).join(', ') || '—' };
    if (v && typeof v === 'object') {
      if (f.format) return { state: 'value', text: f.format.replace(/\{(\w+)\}/g, (_, k) => (v[k] == null ? '—' : typeof v[k] === 'number' && f.decimals != null ? v[k].toFixed(f.decimals) : String(v[k]))) };
      return { state: 'value', text: Object.entries(v).filter(([k]) => k !== 'id' && k[0] !== '$').map(([k, x]) => `${k} ${x}`).join(', ') };
    }
    if (f.format && typeof v !== 'object') return { state: 'value', text: /\{\w+\}/.test(f.format) ? f.format.replace(/\{value\}/g, d.text) : FP.fn.format(v, f.format) };
    return d;
  }

  /* ---------- Styles ---------- */
  const CSS = `
  .fpf [hidden]{display:none!important}
  .fpf{container-type:inline-size;--ink:#1b1f24;--muted:#5b6573;--line:#d9dee5;--accent:#1f5fbf;--good:#1a7f37;--bad:#b42318;--warn:#9a6700;font:16px/1.45 system-ui,"Segoe UI",sans-serif;color:var(--ink)}
  .fpf-grid{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:14px 16px;margin-bottom:14px}
  .fpf-cell{min-width:0;grid-column:span var(--pc,12)}
  @container (max-width:999px){.fpf-cell{grid-column:span var(--tablet,12)}}
  @container (max-width:599px){.fpf-cell{grid-column:span var(--phone,12)}}
  .fpf[data-device="pc"] .fpf-cell{grid-column:span var(--pc,12)}
  .fpf[data-device="tablet"] .fpf-cell{grid-column:span var(--tablet,12)}
  .fpf[data-device="phone"] .fpf-cell{grid-column:span var(--phone,12)}
  .fpf-head{font:inherit;font-weight:600;min-height:48px;padding:8px 16px;border:0;background:none;color:var(--muted);cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:8px}
  .fpf-count{display:none;min-width:22px;height:22px;padding:0 6px;border-radius:999px;background:#dfe3e9;color:var(--ink);font-size:12px;font-weight:700;align-items:center;justify-content:center}
  .fpf-count.n{display:inline-flex}.fpf-count.bad{background:var(--bad);color:#fff}
  .fpf-tabs{margin:0 0 14px}
  .fpf-tabbar{display:flex;gap:2px;overflow-x:auto;border-bottom:2px solid var(--line);margin-bottom:16px}
  .fpf-tabbar .fpf-head{border-bottom:3px solid transparent;margin-bottom:-2px;border-radius:8px 8px 0 0}
  .fpf-tabbar .fpf-head:hover{background:#eef1f5}
  .fpf-tabbar .fpf-head.on{color:var(--accent);border-bottom-color:var(--accent)}
  .fpf-stepbar{display:flex;gap:6px;overflow-x:auto;margin-bottom:16px}
  .fpf-stepbar .fpf-head{flex:1 1 0;min-width:0;padding:8px 12px;border-radius:10px;background:#e6e9ee;color:var(--muted)}
  .fpf-stepbar .fpf-head.done{background:#dcf3e2;color:var(--good)}
  .fpf-stepbar .fpf-head.on{background:var(--accent);color:#fff}
  .fpf-stepbar .fpf-head:disabled{cursor:default}
  .fpf-head-label{overflow:hidden;text-overflow:ellipsis}
  .fpf-num{display:inline-flex;flex:none;width:26px;height:26px;border-radius:50%;align-items:center;justify-content:center;background:rgba(0,0,0,.1);font-size:13px}
  @container (max-width:599px){.fpf-stepbar .fpf-head{flex:0 0 auto}.fpf-stepbar .fpf-head.on{flex:1 1 auto}.fpf-stepbar .fpf-head:not(.on) .fpf-head-label{display:none}}
  .fpf-panel.fpf-off{display:none}
  .fpf-panels{display:flex;gap:16px;align-items:flex-start;margin:0 0 14px}
  .fpf-pane{flex:1 1 0;min-width:0;container-type:inline-size}
  .fpf-pane[data-w="narrow"]{flex:0 0 320px}.fpf-pane[data-w="third"]{flex:0 0 calc((100% - 32px) / 3)}.fpf-pane[data-w="half"]{flex:0 0 calc(50% - 8px)}
  .fpf-pane>h3{margin:0 0 10px;font-size:15px;color:var(--muted);font-weight:600}
  .fpf-pane>.fpf-body>.fpf-grid:last-child{margin-bottom:0}
  @container (max-width:899px){.fpf-panels{flex-direction:column;align-items:stretch}.fpf-pane,.fpf-pane[data-w]{flex:1 1 auto}}
  @container (min-width:400px) and (max-width:599px){.fpf-pane .fpf-cell{grid-column:span var(--tablet,12)}}
  .fpf-tip{margin-left:auto;padding-left:10px;font-weight:400;color:var(--muted);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
  .fpf-info{font:600 12px/1 Georgia,serif;width:22px;height:22px;margin:-4px 0 -4px 8px;padding:0;border:1px solid #9aa6b5;border-radius:50%;background:#fff;color:var(--muted);cursor:pointer;flex:none;position:relative}
  .fpf-info::after{content:'';position:absolute;inset:-11px}
  .fpf.compact .fpf-grid{gap:12px 12px;margin-bottom:12px}
  .fpf.compact .fpf-cell{position:relative}
  .fpf.compact .fpf-label{display:flex;align-items:baseline;font-size:13px;margin:0 0 4px;min-width:0;white-space:nowrap}
  .fpf.compact .fpf-hint{margin:0 0 4px}
  .fpf.compact input,.fpf.compact textarea,.fpf.compact select{min-height:44px;padding:8px 10px}
  .fpf.compact textarea{min-height:72px}
  .fpf.compact .fpf-seg button{min-height:44px;padding:6px 10px;min-width:56px}
  .fpf.compact .fpf-value,.fpf.compact .fpf-visual{min-height:44px}.fpf.compact .fpf-value{font-size:17px}
  .fpf.compact .fpf-msg{position:absolute;right:6px;top:100%;margin-top:-10px;z-index:3;min-height:0;padding:1px 8px;border-radius:6px;font-size:12px;font-weight:600;max-width:calc(100% - 12px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;background:#eef1f5;color:var(--muted)}
  .fpf.compact .fpf-msg:empty{display:none}
  .fpf.compact .fpf-msg.bad{background:var(--bad);color:#fff}.fpf.compact .fpf-msg.warn{background:#8a4b00;color:#fff}
  .fpf.compact .fpf-msg.long{position:static;margin-top:4px;white-space:normal;max-width:none;display:block}
  .fpf.compact .fpf-section{padding:10px 12px 0;margin:0 0 12px}
  .fpf.compact .fpf-section>h3,.fpf.compact .fpf-pane>h3{margin:0 0 6px;font-size:14px}
  .fpf.compact .fpf-panels{gap:12px;margin-bottom:12px}
  .fpf.compact .fpf-head{min-height:44px}
  .fpf.compact .fpf-tabbar,.fpf.compact .fpf-stepbar{margin-bottom:10px}
  .fpf.compact .fpf-tile{min-height:44px}
  .fpf.compact .fpf-badge{min-height:36px}
  .fpf.compact .fpf-foot{padding:10px 0 8px}
  .fpf.compact .fpf-save,.fpf.compact .fpf-btn,.fpf.compact .fpf-back,.fpf.compact .fpf-next{min-height:48px;padding:8px 22px}
  .fpf-fold{display:flex;width:100%;align-items:center;gap:8px;font:inherit;font-size:15px;font-weight:600;color:var(--muted);background:none;border:0;padding:0 0 10px;margin:0;cursor:pointer;text-align:left;min-height:40px}
  .fpf-fold::after{content:'';margin-left:auto;margin-right:6px;width:9px;height:9px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg)}
  .fpf-section.closed .fpf-fold::after{transform:rotate(-45deg)}
  .fpf-section.closed>.fpf-body{display:none}
  .fpf-section.closed{padding-bottom:4px}
  .fpf-back,.fpf-next{font:inherit;font-weight:700;min-height:52px;padding:10px 24px;border-radius:12px;cursor:pointer}
  .fpf-back{border:1px solid #c9d0d9;background:#fff;color:var(--ink)}
  .fpf-next{border:0;background:var(--accent);color:#fff}.fpf-next:disabled{background:#9aa6b5;cursor:not-allowed}
  .fpf-section{border:1px solid var(--line);border-radius:12px;padding:14px 16px 2px;margin:0 0 14px;background:#fff}
  .fpf-section>h3{margin:0 0 10px;font-size:15px;color:var(--muted);font-weight:600}
  .fpf-label{display:block;font-size:14px;font-weight:600;margin:0 0 6px}
  .fpf-hint{font-size:13px;color:var(--muted);margin:-3px 0 6px}
  .fpf-visual{min-height:48px}
  .fpf-label .req{color:var(--bad);margin-left:3px}
  .fpf input,.fpf textarea,.fpf select{font:inherit;width:100%;box-sizing:border-box;min-height:48px;padding:10px 12px;border:1px solid #c9d0d9;border-radius:10px;background:#fff;color:inherit}
  .fpf textarea{min-height:90px;resize:vertical}
  .fpf .unitwrap{display:flex;align-items:center;gap:8px}.fpf .unit{color:var(--muted);white-space:nowrap}
  .fpf-seg{display:flex;flex-wrap:wrap;gap:6px}
  .fpf-seg button{font:inherit;flex:1 1 auto;min-width:76px;white-space:nowrap;min-height:48px;padding:8px 14px;border:1px solid #c9d0d9;border-radius:10px;background:#fff;cursor:pointer}
  .fpf-seg button.on{background:var(--accent);border-color:var(--accent);color:#fff}
  .fpf-seg button.on.good{background:var(--good);border-color:var(--good)}.fpf-seg button.on.bad{background:var(--bad);border-color:var(--bad)}
  .fpf-value{min-height:48px;display:flex;align-items:center;padding:0 2px;font-size:18px;font-weight:600}
  .fpf-tiles{display:flex;flex-wrap:wrap;gap:8px}
  .fpf-tile{font:inherit;font-weight:700;min-width:64px;min-height:52px;padding:6px 14px;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--ink);cursor:pointer}
  .fpf-tile:hover{border-color:var(--accent)}
  .fpf-tile.good{background:#dcf3e2;border-color:#9fd19c;color:var(--good)}.fpf-tile.bad{background:#fde3e0;border-color:#f3b0a8;color:var(--bad)}.fpf-tile.warn{background:#fdf0d0;border-color:#ebc66a;color:var(--warn)}
  .fpf-badge{display:inline-flex;align-items:center;min-height:40px;padding:4px 16px;border-radius:999px;font-weight:700;background:#eef1f5}
  .fpf-badge.good{background:#dcf3e2;color:var(--good)}.fpf-badge.bad{background:#fde3e0;color:var(--bad)}.fpf-badge.warn{background:#fdf0d0;color:var(--warn)}
  .fpf .waiting,.fpf .nodata,.fpf .blank{color:var(--muted);font-weight:400;font-size:15px}.fpf .error{color:var(--bad);font-weight:400;font-size:15px}
  .fpf-msg{font-size:13px;margin-top:5px;min-height:1em}.fpf-msg.bad{color:var(--bad)}.fpf-msg.warn{color:var(--warn)}
  .fpf-text{color:var(--muted);white-space:pre-wrap}
  .fpf-foot{position:sticky;bottom:0;background:linear-gradient(rgba(244,246,248,0),#f4f6f8 30%);padding:18px 0 10px;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
  .fpf-save{font:inherit;font-weight:700;min-height:52px;padding:10px 28px;border-radius:12px;border:0;background:var(--accent);color:#fff;cursor:pointer}
  .fpf-save:disabled{background:#9aa6b5;cursor:not-allowed}
  .fpf-why{font-size:14px;color:var(--muted);flex:1 1 240px}.fpf-why.bad{color:var(--bad)}
  .fpf-as{flex:1 1 100%;font-size:13px;color:var(--muted);display:flex;align-items:center;gap:2px;flex-wrap:wrap}
  .fpf-as b{color:var(--ink);font-weight:600}
  .fpf-notyou{font:inherit;font-size:13px;color:var(--accent);background:none;border:0;padding:10px 6px;margin:-10px 0;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
  .fpf-media-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid #eef1f5}
  .fpf-media-title{font:inherit;font-weight:600;text-align:left;border:0;background:none;color:var(--accent);cursor:pointer;padding:6px 0;flex:1 1 auto}
  .fpf-media-where{font-size:13px;color:var(--muted)}
  .fpf-media-report{font:inherit;font-size:13px;border:0;background:none;color:var(--accent);text-decoration:underline;cursor:pointer;padding:4px 6px;white-space:nowrap}
  .fpf-media-report:disabled{color:var(--muted);text-decoration:none;cursor:default;white-space:normal}
  .fpf-ack-gone{flex:1 1 100%;font-size:14px;color:#b42318;padding:4px 0}
  .fpf-media-open{font:inherit;min-height:44px;padding:6px 14px;border:1px solid #c9d0d9;border-radius:10px;background:#fff;cursor:pointer}
  .fpf-media-frame iframe{width:100%;border:1px solid var(--line);border-radius:10px;margin-top:10px;background:#fff}
  .fpf-media-frame img{max-width:100%;border-radius:10px;margin-top:10px}
  .fpf-value:has(.fpf-media){display:block;font-size:16px;font-weight:400}
  .fpf-btn{font:inherit;font-weight:700;min-height:52px;padding:10px 22px;border-radius:12px;border:2px solid var(--accent);background:#fff;color:var(--accent);cursor:pointer}
  .fpf-btn:disabled{border-color:#9aa6b5;color:#9aa6b5;cursor:not-allowed}
  .fpf-btncell .fpf-btn,.fpf-btncell .fpf-save{width:100%}
  .fpf-btncell .fpf-label{visibility:hidden}
  .fpf-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#e0a100;margin-left:9px;vertical-align:middle}
  .fpf-queue{border:1px dashed #b8c2cf;border-radius:12px;padding:10px 14px;margin:0 0 14px;background:#fff}
  .fpf-queue h4{margin:0 0 4px;font-size:14px;color:var(--muted)}
  .fpf-queue-row{display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px solid #eef1f5}
  .fpf-queue-row:first-of-type{border-top:0}
  .fpf-queue-row span{flex:1 1 auto}
  .fpf-queue-row button{font:inherit;min-height:44px;padding:6px 14px;border:1px solid #c9d0d9;border-radius:10px;background:#fff;cursor:pointer}
  .fpf-sheet{position:fixed;inset:0;z-index:8000;background:#f4f6f8;overflow-y:auto}
  .fpf-crumbs{position:sticky;top:0;z-index:60;display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:8px 16px;background:#1b2633;color:#c6d0dc;font:15px/1.3 system-ui,"Segoe UI",sans-serif}
  .fpf-crumbs button{font:inherit;min-height:44px;padding:6px 6px;background:none;border:0;color:#c6d0dc;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
  .fpf-crumbs button.back{text-decoration:none;color:#fff;border:1px solid #4a5a6c;background:#26364a;border-radius:10px;padding:6px 14px;margin-right:10px}
  .fpf-crumbs .here{color:#fff;font-weight:700}
  .fpf-crumbs .sep{opacity:.55;padding:0 2px}
  .fpf-sheet-body{max-width:1100px;margin:0 auto;padding:18px 16px 0}
  .fpf-sheet-body.wide{max-width:1680px;padding-top:12px}
  .fpf-acks{border:1px solid #c9d0d9;border-left:5px solid var(--warn);border-radius:12px;background:#fff;padding:12px 14px;margin:0 0 16px}
  .fpf-acks.done{border-left-color:var(--good)}
  .fpf-acks h3{margin:0 0 4px;font-size:16px}
  .fpf-acks p{margin:0 0 8px;color:var(--muted);font-size:14px}
  .fpf-ack{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:8px 0;border-top:1px solid #eef1f5}
  .fpf-ack .t{flex:1 1 220px;font-weight:600}
  .fpf-ack .t small{display:block;font-weight:400;color:var(--muted)}
  .fpf-ack button{font:inherit;min-height:44px;padding:6px 14px;border:1px solid #c9d0d9;border-radius:10px;background:#fff;cursor:pointer}
  .fpf-ack button.ok{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600}
  .fpf-ack button:disabled{opacity:.5;cursor:not-allowed}
  .fpf-ack .ok-done{color:var(--good);font-weight:600}
  .fpf-ack-text{flex:1 1 100%;max-height:180px;overflow:auto;border:1px solid #d9dee5;border-radius:10px;padding:10px 12px;background:#f8f9fa;white-space:pre-wrap;line-height:1.5}
  .fpf-locked{opacity:.45}
  .fpp{display:none}
  @media print{
    body.fpp-printing>*:not(.fpp){display:none!important}
    body.fpp-printing{background:#fff!important}
    body.fpp-printing .fpp{display:block;color:#000;font:11pt/1.35 system-ui,"Segoe UI",sans-serif}
  }
  .fpp .part+.part{break-before:page}
  .fpp .note{font-size:9.5pt;color:#7a4a00;margin:-6pt 0 8pt}
  .fpp h1{font-size:17pt;margin:0 0 2pt}
  .fpp .meta{color:#444;font-size:9.5pt;margin:0 0 10pt;display:flex;flex-wrap:wrap;gap:2pt 14pt}
  .fpp h2{font-size:12pt;margin:12pt 0 6pt;padding-bottom:2pt;border-bottom:1pt solid #999;break-after:avoid}
  .fpp .g{display:grid;grid-template-columns:repeat(12,1fr);gap:6pt 10pt;margin-bottom:6pt}
  .fpp .c{break-inside:avoid;min-width:0}
  .fpp .l{font-size:8.5pt;font-weight:600;color:#333;text-transform:uppercase;letter-spacing:.02em;margin-bottom:1pt}
  .fpp .v{font-size:11pt;min-height:14pt;white-space:pre-wrap;overflow-wrap:anywhere}
  .fpp .box{border:1pt solid #666;border-radius:3pt;min-height:20pt;display:flex;align-items:center;justify-content:flex-end;padding:0 5pt;color:#666;font-size:9pt}
  .fpp .box.tall{min-height:54pt}
  .fpp .opts{display:flex;flex-wrap:wrap;gap:3pt 12pt}
  .fpp .opts span::before{content:'';display:inline-block;width:9pt;height:9pt;border:1pt solid #333;border-radius:1.5pt;margin-right:4pt;vertical-align:-1pt}
  .fpp table{border-collapse:collapse;width:100%;font-size:9.5pt}
  .fpp th,.fpp td{border:0.75pt solid #888;padding:3pt 5pt;text-align:left;height:15pt}
  .fpp img{max-width:100%;max-height:140pt;border:0.5pt solid #ccc}
  .fpp .imgs{display:flex;flex-wrap:wrap;gap:6pt}
  .fpp .imgs img{width:110pt;height:82pt;object-fit:cover}
  .fpp .vis{break-inside:avoid}
  .fpp .vis details,.fpp .vis .fpv-tip{display:none}
  .fpp .sig{display:grid;grid-template-columns:2fr 2fr 1fr;gap:6pt 14pt;margin-top:22pt;break-inside:avoid}
  .fpp .sig div{border-top:1pt solid #000;padding-top:2pt;font-size:8.5pt;color:#333;margin-top:22pt}
  .fpp .acked{margin-top:12pt;font-size:9pt;color:#333}
  .fpp .if{font-weight:400;text-transform:none;color:#666}
  .fpf-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1a7f37;color:#fff;padding:12px 20px;border-radius:12px;font-weight:600;box-shadow:0 6px 24px rgba(0,0,0,.2);z-index:9000}
  .fpf-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
  .fpf-card{border:1px solid #d5dbe3;border-left:6px solid #9aa5b1;border-radius:12px;background:#fff;display:flex;flex-direction:column;overflow:hidden}
  .fpf-card.good{border-left-color:#1a7f37}.fpf-card.warn{border-left-color:#d4a72c}.fpf-card.bad{border-left-color:#cf222e}
  .fpf-card-head{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;border:0;background:none;padding:12px 14px;font:inherit;color:inherit;cursor:pointer}
  .fpf-card-head:disabled{cursor:default;color:inherit}
  .fpf-card-head b{font-size:17px}.fpf-card-head span{font-size:14px;color:#4a5562}
  .fpf-card-acts{display:flex;flex-wrap:wrap;gap:8px;padding:0 12px 12px}
  .fpf-card-act{flex:1 1 auto;min-height:48px;padding:0 14px;border:1px solid #1f5fbf;border-radius:10px;background:#eef4fd;color:#1f5fbf;font:inherit;font-weight:600;cursor:pointer}
  .fpf-card-act:active{background:#d6e5fa}
  .fpf-toast.saved{top:16px;bottom:auto;font-size:18px;padding:14px 24px;max-width:calc(100vw - 32px)}
  .fpf-subbtn{display:inline-flex;flex-direction:column;align-items:flex-start;gap:2px}
  .fpf-substate{font-size:13px;font-weight:500;opacity:.8}
  .fpf-substate[hidden]{display:none}
  .fpf-veil{position:fixed;inset:0;z-index:8500;background:rgba(20,27,36,.45);display:flex;align-items:center;justify-content:center;padding:16px}
  .fpf-dialog{background:#fff;border-radius:14px;max-width:640px;width:100%;max-height:90vh;overflow:auto;padding:18px 20px;box-shadow:0 12px 40px rgba(0,0,0,.25);font:16px/1.4 system-ui,sans-serif;color:#1b2633}
  .fpf-dialog h3{margin:0 0 8px;font-size:19px}
  .fpf-dialog p{margin:6px 0}
  .fpf-dialog table{border-collapse:collapse;width:100%;margin:8px 0;font-size:15px}
  .fpf-dialog th,.fpf-dialog td{text-align:left;padding:6px 8px;border-bottom:1px solid #e3e7ec}
  .fpf-dialog tr.diff td{background:#fff7e6}
  .fpf-dialog-btns{display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:12px}
  .fpf-link{background:none;border:0;color:#1f5fbf;text-decoration:underline;font:inherit;cursor:pointer;margin-right:auto;min-height:44px}
  .fpf-notice{background:#fff7e6;border:1px solid #f1d39a;border-radius:12px;padding:12px 14px;margin:0 0 14px;font-size:16px}
  .fpf-notice .fpf-dialog-btns{justify-content:flex-start}`;

  function el(tag, cls, text) { return FP.dom.el(tag, cls, text); }   // one copy, in fp-core (0.50)

  /* ---------- Controls ---------- */
  function makeControl(f, onChange, api) {
    if (CONTROLS[f.control]) return CONTROLS[f.control].make(f, Object.assign({ fire: () => onChange(f.name), next: () => onChange(f.name, { next: true }), el, blank }, api));
    const wrap = el('div');
    let get, set, focus;
    const extra = {};
    const fire = () => onChange(f.name);
    const seg = (opts) => {
      const box = el('div', 'fpf-seg');
      let cur = null;
      const btns = opts.map(o => {
        const b = el('button', null, o.label);
        b.type = 'button';
        b.onclick = () => { cur = cur === o.value ? null : o.value; paint(); fire(); };
        box.appendChild(b);
        return { b, o };
      });
      const paint = () => btns.forEach(({ b, o }) => { b.className = (cur === o.value ? 'on ' : '') + (o.tone || ''); b.setAttribute('aria-pressed', cur === o.value); });
      wrap.appendChild(box);
      get = () => cur;
      set = v => { cur = v == null ? null : v; paint(); };
      focus = () => btns[0] && btns[0].b.focus();
    };
    switch (f.control) {
      case 'textarea': {
        const t = el('textarea'); t.oninput = fire; wrap.appendChild(t);
        get = () => (t.value.trim() ? t.value : null); set = v => { t.value = v == null ? '' : v; }; focus = () => t.focus();
        break;
      }
      case 'number': {
        const box = el('div', 'unitwrap');
        const i = el('input'); i.inputMode = 'decimal'; i.autocomplete = 'off'; i.oninput = fire;
        box.appendChild(i);
        if (f.unit) box.appendChild(el('span', 'unit', f.unit));
        wrap.appendChild(box);
        get = () => { const s = i.value.trim().replace(',', '.'); if (!s) return null; const n = Number(s); return isNaN(n) ? { bad: s } : n; };
        set = v => { i.value = v == null ? '' : String(v); }; focus = () => i.focus();
        i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); onChange(f.name, { next: true }); } };
        break;
      }
      case 'choice': {
        if (f.optionsFrom && !(Array.isArray(f.options) && f.options.length)) {
          // Options from a formula: a drop-down that follows it (the form sets them as it works things out).
          const s = el('select'); wrap.appendChild(s);
          let list = [], want = null;
          s.onchange = () => { want = null; fire(); };   // a choice made here wins over a value waiting for its options
          const fill = () => {
            const keep = want != null ? want : (s.value === '' ? null : (list[Number(s.value)] || {}).value);
            s.replaceChildren();
            s.appendChild(el('option', null, f.placeholder || 'Choose…')).value = '';
            list.forEach((o, k) => { const op = el('option', null, o.label); op.value = String(k); s.appendChild(op); });
            const at = keep == null ? -1 : list.findIndex(o => String(o.value) === String(keep));
            s.value = at < 0 ? '' : String(at);
            // A value set before its options arrived waits for them; once there are options without it, it is dropped.
            if (at >= 0 || keep == null || list.length) want = null;
          };
          get = () => (s.value === '' ? want : list[Number(s.value)].value);
          set = v => { want = v == null || v === '' ? null : v; fill(); };
          extra.labelOf = v => { const o = list.find(x => String(x.value) === String(v)); return o ? o.label : v; };
          focus = () => s.focus();
          extra.setOptions = v => {
            const raw = Array.isArray(v) ? v : [];
            const seen = new Set();
            list = raw.map(o => (o && typeof o === 'object' ? { value: o.value != null ? o.value : o.$id != null ? o.$id : o.id, label: o.label != null ? String(o.label) : String(o.value != null ? o.value : o.$id != null ? o.$id : o.id) } : { value: o, label: String(o) }))
              .filter(o => o.value != null && o.value !== '' && !seen.has(String(o.value)) && seen.add(String(o.value)));
            fill();
          };
          fill();
          break;
        }
        // colors: { "Fail": "bad" } tints a chosen option (good, bad or warn).
        const opts = (f.options || []).map(o => (o && typeof o === 'object' ? { value: o.value, label: o.label || String(o.value) } : { value: o, label: String(o) }))
          .map(o => Object.assign(o, { tone: (f.colors || {})[String(o.value)] || '' }));
        extra.labelOf = v => { const o = opts.find(x => String(x.value) === String(v)); return o ? o.label : v; };
        if (opts.length <= 6 && !f.list) seg(opts);
        else {
          const s = el('select'); s.appendChild(el('option', null, f.placeholder || 'Choose…')).value = '';
          opts.forEach(o => { const op = el('option', null, o.label); op.value = String(o.value); s.appendChild(op); });
          s.onchange = fire; wrap.appendChild(s);
          get = () => { const o = opts.find(x => String(x.value) === s.value); return o ? o.value : null; };
          set = v => { s.value = v == null ? '' : String(v); }; focus = () => s.focus();
        }
        break;
      }
      case 'toggle': seg([{ value: true, label: f.yes || 'Yes' }, { value: false, label: f.no || 'No' }]); break;
      case 'date': case 'time': case 'datetime': {
        const i = el('input'); i.type = f.control === 'datetime' ? 'datetime-local' : f.control; i.onchange = fire; i.oninput = fire; wrap.appendChild(i);
        get = () => { if (!i.value) return null; return f.control === 'datetime' ? new Date(i.value).toISOString() : i.value; };
        set = v => {
          if (v == null) { i.value = ''; return; }
          if (f.control === 'datetime') { const d = new Date(v); i.value = isNaN(d) ? '' : new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); }
          else i.value = v;
        };
        focus = () => i.focus();
        break;
      }
      default: { // text: uppercase turns typing to capitals; enterMovesOn suits barcode scanners, which type and press Enter
        const i = el('input'); i.autocomplete = 'off'; i.oninput = fire;
        if (f.uppercase) i.style.textTransform = 'uppercase';
        if (f.enterMovesOn) i.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); onChange(f.name, { next: true }); } };
        wrap.appendChild(i);
        get = () => { const s = i.value.trim(); if (!s) return null; return f.uppercase ? s.toUpperCase() : s; };
        set = v => { i.value = v == null ? '' : v; }; focus = () => i.focus();
      }
    }
    return Object.assign({ wrap, get, set, focus }, extra);
  }

  /* ---------- Printing: one renderer for a form on screen, a waiting record and a saved one ----------
   * o: { mode: 'record' | 'blank', title, meta: [text], value(f), display(f), visible(f), files(f) -> Blobs,
   *      live(f) -> element (a chart as drawn), when(formula) -> Promise<boolean>, acked, note } */
  async function mediaImage(path, alt) {
    if (FP.media.isImage(path)) {
      const r = await FP.media.open(path).catch(() => null);
      if (r && r.url) { const img = el('img'); img.src = r.url; img.alt = alt || FP.media.titleOf(path); return img; }
    }
    return el('span', null, FP.media.split(path).pop() || path);
  }
  async function printPart(def, o) {
    const cfg = def.print && def.print !== true ? def.print : {};
    const fields = def.fields || [];
    const byName = new Map(fields.map(f => [f.name, f]));
    const part = el('div', 'part');
    part.appendChild(el('h1', null, o.title + (o.mode === 'blank' ? ' (blank form)' : '')));
    const meta = el('div', 'meta');
    (o.meta || []).filter(Boolean).forEach(t => meta.appendChild(el('span', null, t)));
    part.appendChild(meta);
    if (o.note) part.appendChild(el('div', 'note', o.note));
    const optLabel = (f, x) => { const op = (f.options || []).find(q => (q && typeof q === 'object' ? q.value : q) === x); return op && typeof op === 'object' ? op.label || String(op.value) : String(x); };
    const blankBox = f => {
      if (f.control === 'choice' || f.control === 'chips') { const b = el('div', 'opts'); (f.options || []).forEach(x => b.appendChild(el('span', null, x && typeof x === 'object' ? x.label || String(x.value) : String(x)))); return b; }
      if (f.control === 'toggle') { const b = el('div', 'opts'); b.append(el('span', null, f.yes || 'Yes'), el('span', null, f.no || 'No')); return b; }
      if (f.control === 'rating') { const b = el('div', 'opts'); for (let i = 1; i <= (f.max || 5); i++) b.appendChild(el('span', null, String(i))); return b; }
      if (f.control === 'table') {
        const t = el('table'), hr = el('tr');
        const fixed = Array.isArray(f.rows) ? f.rows.map(r => (r && typeof r === 'object' ? r.label || r.key : String(r))) : null;
        if (fixed) hr.appendChild(el('th', null, f.rowLabel || ''));
        f.columns.forEach(c => hr.appendChild(el('th', null, (c.label || c.name) + (c.unit ? ` (${c.unit})` : ''))));
        t.appendChild(hr);
        (fixed || Array.from({ length: cfg.blankRows || 5 }, () => null)).forEach(r => { const tr = el('tr'); if (fixed) tr.appendChild(el('td', null, r)); f.columns.forEach(() => tr.appendChild(el('td'))); t.appendChild(tr); });
        return t;
      }
      if (!isEntry(f)) return el('div', 'box');
      return el('div', 'box' + (f.control === 'textarea' || f.control === 'draw' || f.control === 'file' ? ' tall' : ''), f.unit || (f.control === 'file' ? 'attach separately' : ''));
    };
    async function valueOf(f) {
      const box = el('div', 'v');
      if (isEntry(f)) {
        const v = o.value(f);
        const files = o.files ? o.files(f) : null;
        if (f.control === 'draw' || f.control === 'file') {
          const wrap = el('div', f.control === 'file' ? 'imgs' : null);
          const blobs = (files || []).filter(x => x instanceof Blob);
          if (blobs.length) blobs.forEach(file => { if (/^image\//.test(file.type)) { const img = el('img'); img.src = URL.createObjectURL(file); img.alt = file.name || f.name; if (f.control === 'draw') img.style.maxHeight = '70pt'; wrap.appendChild(img); } else wrap.appendChild(el('span', null, file.name)); });
          else if (typeof v === 'string' && v.startsWith('data:image')) { const img = el('img'); img.src = v; img.alt = f.label || f.name; img.style.maxHeight = '70pt'; wrap.appendChild(img); }
          else if (Array.isArray(v) && v.every(x => x instanceof Blob)) v.forEach(file => { const img = el('img'); img.src = URL.createObjectURL(file); img.alt = file.name; wrap.appendChild(img); });
          else if (!blank(v)) for (const path of [].concat(v)) if (typeof path === 'string' && path.includes('/')) { const im = await mediaImage(path, f.label); if (f.control === 'draw' && im.tagName === 'IMG') im.style.maxHeight = '70pt'; wrap.appendChild(im); }
          if (!wrap.childNodes.length) { box.textContent = '—'; return box; }
          return wrap;
        }
        if (blank(v)) { box.textContent = '—'; return box; }
        if (f.control === 'table') {
          const t = el('table'), hr = el('tr');
          const fixed = Array.isArray(f.rows);
          if (fixed) hr.appendChild(el('th', null, f.rowLabel || ''));
          f.columns.forEach(col => hr.appendChild(el('th', null, (col.label || col.name) + (col.unit ? ` (${col.unit})` : ''))));
          t.appendChild(hr);
          [].concat(v).forEach(r => { const tr = el('tr'); if (fixed) tr.appendChild(el('td', null, String(r.row))); f.columns.forEach(col => tr.appendChild(el('td', null, r[col.name] == null ? '' : String(r[col.name])))); t.appendChild(tr); });
          return t;
        }
        const val = v && typeof v === 'object' && !Array.isArray(v) && v.id ? v.id : v; // a reference
        box.textContent = f.control === 'toggle' ? (val ? f.yes || 'Yes' : f.no || 'No')
          : f.control === 'choice' ? optLabel(f, val)
          : f.control === 'chips' ? [].concat(val).map(x => optLabel(f, x)).join(', ')
          : f.control === 'rating' ? `${'★'.repeat(val)}${'☆'.repeat(Math.max(0, (f.max || 5) - val))} (${val} of ${f.max || 5})`
          : f.control === 'timer' ? `${Math.floor(val / 60)}:${String(val % 60).padStart(2, '0')}`
          : f.control === 'datetime' ? new Date(val).toLocaleString()
          : `${val}${f.unit ? ' ' + f.unit : ''}`;
        return box;
      }
      const live = o.live && o.live(f);
      if (live) { const vis = el('div', 'vis'); vis.appendChild(live); return vis; }
      const v = o.display(f);
      if (v === undefined) return null; // not saved with the record: left out rather than shown wrong
      if (f.control === 'media') { box.textContent = (Array.isArray(v) ? v : [v]).map(x => (x && typeof x === 'object' ? x.title || x.path : x)).filter(Boolean).join('\n') || '—'; return box; }
      box.textContent = show(v, f).text;
      return box;
    }
    async function walk(list, into) {
      for (const r of list || []) {
        if (Array.isArray(r)) {
          const g = el('div', 'g');
          for (const cell of r) {
            const w = parseCell(cell, r.length);
            const f = byName.get(w.name);
            if (!f) continue; // buttons don't print
            if (o.mode === 'record' && !o.visible(f)) continue;
            if (o.mode === 'blank' && (f.control === 'media' || isVisual(f))) continue; // nothing to fill in by hand
            if (o.mode === 'record' && isVisual(f) && !(o.live && o.live(f))) continue; // a chart prints as drawn on screen
            const content = o.mode === 'blank' ? blankBox(f) : await valueOf(f);
            if (!content) continue;
            const c = el('div', 'c');
            c.style.gridColumn = `span ${w.pc}`;
            const l = el('div', 'l', (f.label || f.name) + (o.mode === 'blank' && f.required && isEntry(f) ? ' *' : ''));
            if (o.mode === 'blank' && f.when) l.appendChild(el('span', 'if', ' (if it applies)'));
            c.append(l, content);
            g.appendChild(c);
          }
          if (g.childNodes.length) into.appendChild(g);
          continue;
        }
        if (!r || typeof r !== 'object') continue;
        const parts = r.panels ? r.panels.map(t => ({ label: t && t.panel, rows: t && t.rows, when: t && t.when })) : r.tabs ? r.tabs.map(t => ({ label: t.tab, rows: t.rows, when: t.when })) : r.steps ? r.steps.map(t => ({ label: t.step, rows: t.rows, when: t.when })) : [{ label: r.section, rows: r.rows, when: r.when }];
        for (const pt of parts) {
          if (o.mode === 'record' && pt.when && o.when && !(await o.when(pt.when))) continue;
          const sec = el('div');
          if (pt.label) sec.appendChild(el('h2', null, pt.label));
          await walk(pt.rows, sec);
          if (sec.querySelector('.c')) into.appendChild(sec);
        }
      }
    }
    await walk(def.layout || fields.map(f => [f.name + ' 12']), part);
    if (o.acked) part.appendChild(el('div', 'acked', o.acked));
    (Array.isArray(cfg.signatures) ? cfg.signatures : []).forEach(sg => { const row = el('div', 'sig'); row.append(el('div', null, `${sg}: name`), el('div', null, 'Signature'), el('div', null, 'Date')); part.appendChild(row); });
    return part;
  }
  /* The structure a form's records are counted by: its first item, else the first it writes to. */
  function primaryStructure(def) {
    const keys = Object.keys(def.items || {});
    if (keys.length) return keys[0];
    const f = (def.fields || []).find(x => x && (x.writes || x.snapshot));
    return f ? target(f.writes || f.snapshot).structure : null;
  }
  const refId = r => (r && typeof r === 'object' ? r.id : r);
  /* Saved records of form childId linked to item linkId through role: printed with their own linked records below them. */
  async function savedTree(childId, role, linkId, parentTitle, seen, depth) {
    const doc = FP.defs.get('form', childId);
    if (!doc || doc.retired || depth > 6) return [];
    const def = FP.sources ? FP.sources.normalize(doc.def) : doc.def;
    const st = primaryStructure(def);
    if (!st) return [];
    const data = await FP.current.load(st).catch(() => null);
    if (!data) return [];
    const items = Array.from(data.items.values()).filter(it => refId((it.firstRefs || {})[role]) === linkId || refId((it.refs || {})[role]) === linkId)
      .sort((a, b) => String(a.firstAt).localeCompare(String(b.firstAt)));
    const out = [];
    for (const it of items) {
      const key = st + '/' + it.id;
      if (seen.has(key)) continue;
      seen.add(key);
      const title = def.title || childId;
      const container = w => { const t = target(w); return t && t.structure === st ? it.values[t.container] : undefined; };
      out.push(await printPart(def, {
        mode: 'record', title,
        meta: [`${st} ${it.id}`, `Linked to ${parentTitle} ${linkId}`, `Saved ${new Date(it.lastAt).toLocaleString()}`, it.site ? `Site ${it.site}` : null],
        value: f => (f.writes ? container(f.writes) : f.ref ? refId((it.firstRefs || {})[f.ref]) : Object.entries(def.items || {}).some(([s2, c]) => s2 === st && c.field === f.name) ? it.id : undefined),
        display: f => (f.snapshot ? container(f.snapshot) : undefined),
        visible: f => !f.writes || container(f.writes) !== undefined || !f.when,
        files: () => null,
      }));
      for (const b of (def.buttons || []).filter(x => x && x.action === 'open' && x.link === st)) out.push(...await savedTree(b.form, b.link, it.id, title, seen, depth + 1));
    }
    return out;
  }
  /* One saved record (a row from FP.current: one save to one item) as its form shows it on paper. The form is the
   * version that saved it when that can be read, else the current one; without either, its values as a list.
   * opts: { who (the user's name), more: [meta lines] } */
  async function recordForm(row) {
    const fid = row.form && row.form.id;
    let doc = null;
    if (fid && row.form.version && FP.defs.version) doc = await FP.defs.version('form', fid, row.form.version).catch(() => null);
    if (!doc && fid) doc = FP.defs.get('form', fid);
    return doc;
  }
  async function recordPart(row, opts) {
    opts = opts || {};
    const st = row.item.structure;
    const doc = await recordForm(row);
    const plainDef = { title: st, fields: Object.keys(row.values || {}).filter(k => k !== 'reason').map(k => ({ name: k, label: k, control: 'text', writes: `${st}.${k}` })) };
    const def = doc ? (FP.sources ? FP.sources.normalize(doc.def) : doc.def) : plainDef;
    const container = w => { const t = target(w); return t && t.structure === st ? (row.values || {})[t.container] : undefined; };
    const idOf = f => Object.entries(def.items || {}).some(([s2, c]) => s2 === st && c && c.field === f.name);
    const fixes = (row.corrections || []).map(c => `Corrected ${new Date(c.at).toLocaleString()}${c.reason ? `: ${c.reason}` : ''}`);
    return printPart(def, {
      mode: 'record', title: (doc && doc.def.title) || (row.form && row.form.id) || st,
      meta: [`${st} ${row.item.id}`, `Saved ${new Date(row.writtenAt).toLocaleString()}${row.action ? ` (${row.action})` : ''}`, [FP.identity.label(row.terminalId), row.site, opts.who].filter(Boolean).join(' · '), doc ? `Form version ${doc.version}` : null].concat(opts.more || []).filter(Boolean),
      note: fixes.length ? fixes.join(' · ') : null,
      value: f => (f.writes ? container(f.writes) : f.ref ? refId((row.refs || {})[f.ref]) : idOf(f) ? row.item.id : undefined),
      display: f => (f.snapshot ? container(f.snapshot) : undefined),
      visible: f => !f.writes || container(f.writes) !== undefined || !f.when,
      files: () => null,
    });
  }
  /* Print a saved record (the browser's print dialog). opts.printPreview: build it without the dialog (tests). */
  async function printRecord(row, opts) {
    opts = opts || {};
    if (!document.getElementById('fp-forms-css')) { const s = el('style'); s.id = 'fp-forms-css'; s.textContent = CSS; document.head.appendChild(s); }
    const doc = await recordForm(row);
    const cfg = doc && doc.def.print && doc.def.print !== true ? doc.def.print : {};
    const part = await recordPart(row, opts);
    const docEl = el('div', 'fpp');
    docEl.appendChild(part);
    const title = (doc && doc.def.title) || row.item.structure;
    const page = el('style');
    page.textContent = `@page{size:${cfg.page || 'letter'} ${cfg.orientation || 'portrait'};margin:${cfg.margin || 14}mm ${cfg.margin || 12}mm;`
      + `@top-left{content:${cssText(title)};font:9pt system-ui,sans-serif;color:#444}`
      + `@top-right{content:${cssText(`${row.item.structure} ${row.item.id}`)};font:9pt system-ui,sans-serif;color:#444}`
      + `@bottom-left{content:${cssText(`Printed ${new Date().toLocaleString()} · ${FP.identity.label(FP.identity.terminalId)}`)};font:8pt system-ui,sans-serif;color:#666}`
      + `@bottom-right{content:"Page " counter(page) " of " counter(pages);font:8pt system-ui,sans-serif;color:#666}}`;
    document.head.appendChild(page);
    document.body.appendChild(docEl);
    document.body.classList.add('fpp-printing');
    const done = () => { document.body.classList.remove('fpp-printing'); docEl.remove(); page.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    if (opts.printPreview) return { element: docEl, done };
    window.print();
    return { element: docEl, done };
  }
  async function blankTree(formId, seen) {
    if (seen.has(formId)) return [];
    seen.add(formId);
    const doc = FP.defs.get('form', formId);
    if (!doc || doc.retired) return [];
    const out = [await printPart(FP.sources ? FP.sources.normalize(doc.def) : doc.def, { mode: 'blank', title: doc.def.title || formId, meta: ['Opened from the form before it: fill in only when it applies'] })];
    for (const b of (doc.def.buttons || []).filter(x => x && x.action === 'open')) out.push(...await blankTree(b.form, seen));
    return out;
  }
  const cssText = t => '"' + String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ') + '"';

  /* Forms opened over other forms, bottom first. Going back to one closes those above it. */
  const LEVELS = [];
  function closeAbove(index) {
    for (let i = LEVELS.length - 1; i > index; i--) if (!LEVELS[i].close(false)) return false;
    return true;
  }

  /* ---------- A running form ---------- */
  async function open(host, formId, opts) {
    opts = opts || {};
    const openedAt = performance.now();   // how long until the form is ready to use (0.49, Admin > Speed)
    if (!document.getElementById('fp-forms-css')) { const s = el('style'); s.id = 'fp-forms-css'; s.textContent = CSS; document.head.appendChild(s); }
    // opts.doc: a particular version (a launcher pinned to it); opts.def: an unpublished definition (tests, the editor).
    // opts.preview: the editor's live preview; buttons and confirmations save nothing.
    const doc0 = opts.doc || (opts.def ? { id: formId, version: 0, def: opts.def } : FP.defs.get('form', formId));
    // Picks and fills (0.60) worked out into options and starting values.
    const doc = doc0 && FP.kinds && doc0.def ? Object.assign({}, doc0, { def: FP.kinds.form(doc0.def) }) : doc0;
    // A sub-form runs with the master form's names (opts.sub.outer), each and index when it repeats, and saves under the master form.
    const sub = opts.sub || null;
    const formRef = opts.formRef || { id: formId, version: doc ? doc.version : 0 };
    // others (0.44.5): the sub-form's other runs done so far, each the values typed in it with $each and $index.
    const outerVals = () => (sub ? Object.assign({}, sub.outer(), { each: sub.each === undefined ? FP.fn.NODATA : sub.each, index: sub.index, others: sub.others ? sub.others() : [] }) : {});
    if (!doc || doc.retired) throw new Error(`No published form named ${formId}.`);
    const sitesOk = opts.doc ? FP.sites.covers(FP.defs.sitesOf(doc.def)) : opts.def || FP.defs.usedHere('form', formId);
    if (!sitesOk) {
      throw new Error(`Form ${formId} is not used at this terminal's site (${FP.identity.site}). It is for ${FP.defs.sitesOf(doc.def).join(', ')}.`);
    }
    const problems = check(doc.def);
    // A structure it saves to or reads taken away since (retired): it doesn't open, rather than save to nothing (0.53).
    if (!opts.preview) {
      const gone = new Set();
      (Array.isArray(doc.def.sources) ? doc.def.sources : []).forEach(x => { if (x && (x.kind === 'item' || x.kind === 'items') && x.structure && !FP.structures.has(String(x.structure).split('~')[0])) gone.add(String(x.structure).split('~')[0]); });
      Object.keys(doc.def.items || {}).forEach(k => { if (!FP.structures.has(k.split('~')[0])) gone.add(k.split('~')[0]); });
      gone.forEach(st => problems.push(`it uses structure ${st}, which is retired or not published`));
    }
    if (problems.length) throw new Error(`Form ${formId} has problems: ${problems.join('; ')}`);
    // Sources become writes to structure.container and items; the sources themselves are worked out in recalc.
    const def = FP.sources ? FP.sources.normalize(doc.def) : doc.def;
    const hasSources = Array.isArray(def.sources) && def.sources.length > 0;
    // Worked-out fields an item source is found by (0.51: a profile picked by a formula, a need tapped on a board).
    const idByValue = new Set(hasSources ? def.sources.filter(x => x && x.kind === 'item' && x.id && (x.id.field || x.id.open)).flatMap(x => (x.id.field ? [x.id.field] : Object.values(x.id.open))) : []);
    let srcValues = {};
    const withSources = vals => (hasSources ? Object.assign({}, vals, srcValues) : vals);
    const fields = def.fields;
    const byName = new Map(fields.map(f => [f.name, f]));
    const draftKey = 'formDraft:' + formId;
    const title = def.title || formId;

    /* Buttons: the form's own, or one Save. A form opened by another gets Apply. */
    const parent = opts.parent || null;   // set by the form that opened this one
    const trail = opts.trail || [];       // titles of the forms above this one
    const opensLinked = (def.buttons || []).some(b => b.action === 'open' && b.link);
    const buttons = sub ? sub.buttons.map(b => Object.assign({}, b))
      : def.buttons
        ? def.buttons.map(b => Object.assign({}, b))
        : [{ name: '__save', label: def.saveLabel || 'Save', action: 'save', scope: 'form' }];
    if (parent && parent.canApply && !sub && !buttons.some(b => b.action === 'apply')) buttons.unshift({ name: '__apply', label: 'Apply', action: 'apply' });
    const btnByName = new Map(buttons.map(b => [b.name, b]));
    const edited = new Set();  // fields changed since they were last saved
    const personSet = new Set();   // fields someone filled in (or a caller prefilled): a starting value from a formula stops following it
    const ruleOk = {};             // field -> false when its "must be true" rule fails
    const rangeNow = {};           // field -> { warnMin, warnMax, limMin, limMax } worked out from numbers or formulas
    const queue = [];          // linked records waiting to be saved with this form (scope tree)
    const ids = Object.assign({}, opts.ids || {});  // structure -> the new item ID of the record on screen (a sub-form run opened again keeps its own)
    const seenAt = new Map();  // structure|id -> the latest change this form had seen when it read the item
    /* Sub-forms: this form's own (when it is a master form). runsOf: name -> [run by index - 1]. */
    const subforms = sub ? [] : (Array.isArray(doc.def.subforms) ? doc.def.subforms.filter(Boolean) : []);
    const subByName = new Map(subforms.map(x => [x.name, x]));
    const runsOf = {};
    const plannedOf = {};
    subforms.forEach(x => { runsOf[x.name] = []; });

    const root = el('div', 'fpf');
    if (opts.device) root.dataset.device = opts.device;   // the editor shows a device's widths at any size
    // Spacing (0.44): a sub-form uses its form's; the editor can show either.
    const density = opts.density || def.density || 'comfortable';
    if (density === 'compact') root.classList.add('compact');
    // The on-screen keyboard (0.44.5): always for this form (and its sub-forms), or the terminal's setting.
    const keyboard = opts.keyboard || (def.keyboard === 'always' ? 'always' : null);
    if (keyboard) root.dataset.keyboard = keyboard;
    host.replaceChildren(root);
    const ui = {};          // name -> { cell, control, msg, out }
    const display = {};     // name -> raw value
    const visible = {};     // name -> boolean (when rules)
    let calcSeq = 0;
    // NAME.selected (0.51): what a list field has selected — the item behind a choice's value, the items behind chips,
    // the row or tile tapped in records or a board. Formulas and other fields read it; it is never saved itself.
    const picked = {};      // records / board name -> the record tapped
    const selNow = {};      // 'name.selected' -> its value now
    const itemKey = (item, labelled) => item && typeof item === 'object'
      ? (labelled ? (item.$id != null ? item.$id : item.id != null ? item.id : item.value) : (item.value != null ? item.value : item.$id != null ? item.$id : item.id))
      : item;
    const recId = r => (r && typeof r === 'object' ? (r.$id != null ? String(r.$id) : r.id != null ? String(r.id) : null) : null);
    let dirty = false;
    let stayed = false;     // a save with then: "stay" left the saved record on screen (0.44)
    let saving = false;

    const entryValues = () => {
      const v = {};
      fields.filter(isEntry).forEach(f => {
        const c = ui[f.name].control;
        const x = c.formulaValue ? c.formulaValue() : c.get();
        v[f.name] = x && typeof x === 'object' && !Array.isArray(x) && 'bad' in x ? null : x;
      });
      return v;
    };
    // What controls may use from the form they sit in.
    const controlApi = {
      setField(name, v) { if (ui[name] && ui[name].control) { ui[name].control.set(v); changed(name); } },
      values: () => entryValues(),
      // A control whose value arrives later (a name checked against the people list) asks for the form to be worked out again.
      recalc: () => { try { clearTimeout(timer); timer = setTimeout(() => recalc(), 60); } catch (e) { /* still opening: it works itself out once open */ } },
    };

    function cell(w, owner) {
      const name = w.name;
      const f = byName.get(name);
      const c = el('div', 'fpf-cell');
      c.dataset.name = name;
      c.style.setProperty('--pc', w.pc);
      c.style.setProperty('--tablet', w.tablet);
      c.style.setProperty('--phone', w.phone);
      const lab = el('label', 'fpf-label', f.label || name);
      if (f.required && isEntry(f)) lab.appendChild(el('span', 'req', '*'));
      c.appendChild(lab);
      if (f.hint && f.control !== 'draw') {
        // Compact: a short hint sits at the label's right; a long one opens from an ⓘ.
        if (density !== 'compact') c.appendChild(el('div', 'fpf-hint', f.hint));
        else if (String(f.hint).length <= 32) { const tip = el('span', 'fpf-tip', f.hint); tip.title = f.hint; lab.appendChild(tip); }
        else {
          const more = el('div', 'fpf-hint');
          more.textContent = f.hint; more.hidden = true;
          const i = el('button', 'fpf-info', 'i');
          i.type = 'button'; i.setAttribute('aria-label', `About ${f.label || name}`); i.setAttribute('aria-expanded', 'false');
          i.onclick = e => { e.preventDefault(); more.hidden = !more.hidden; i.setAttribute('aria-expanded', String(!more.hidden)); };
          lab.appendChild(i);
          c.appendChild(more);
        }
      }
      let control = null, out = null;
      if (isEntry(f)) { control = makeControl(f, changed, controlApi); c.appendChild(control.wrap); if (f.keyboard) c.dataset.kb = f.keyboard; }
      else if (f.control === 'text') { c.removeChild(lab); if (f.label) c.appendChild(lab); c.appendChild(el('div', 'fpf-text', f.text || '')); }
      else if (isVisual(f)) { out = el('div', 'fpf-visual'); c.appendChild(out); }
      else { out = el('div', 'fpf-value'); c.appendChild(out); }
      const msg = el('div', 'fpf-msg');
      c.appendChild(msg);
      ui[name] = { cell: c, control, msg, out, field: f, owner };
      return c;
    }

    /* Layout blocks: sections, tabs and steps. Each knows the block it sits in (owner). */
    const blocks = [];      // { kind: 'section' | 'tab' | 'step', label, when, owner, panel, head, count, set, index, open, off }
    let stepper = null;     // the steps block: { items, at, seen }
    const order = [];       // field names in layout order
    const chain = b => { const out = []; for (let x = b; x; x = x.owner) out.unshift(x); return out; };
    const stepOf = name => (ui[name] ? chain(ui[name].owner).find(b => b.kind === 'step') || null : null);

    function makeButton(b) {
      const btn = el('button', ['open', 'subform', 'finish', 'set'].includes(b.action) ? 'fpf-btn' : 'fpf-save');
      btn.type = 'button';
      b.text = el('span', null, b.label || (b.action === 'apply' ? 'Apply' : b.action === 'save' ? 'Save' : b.action === 'subform' ? ((subByName.get(b.subform) || {}).label || b.subform) : b.name));
      b.dot = el('span', 'fpf-dot');
      b.dot.hidden = true;
      btn.append(b.text, b.dot);
      // A sub-form's button says how far it has got: Done, 3 of 5, Saved.
      if (b.action === 'subform') { b.state = el('span', 'fpf-substate'); btn.classList.add('fpf-subbtn'); btn.appendChild(b.state); }
      btn.onclick = () => press(b);
      b.el = btn;
      return btn;
    }
    function buttonCell(w, owner) {
      const b = btnByName.get(w.name);
      const c = el('div', 'fpf-cell fpf-btncell');
      c.dataset.name = w.name;
      c.dataset.button = '1';
      c.style.setProperty('--pc', w.pc);
      c.style.setProperty('--tablet', w.tablet);
      c.style.setProperty('--phone', w.phone);
      c.append(el('label', 'fpf-label', '.'), makeButton(b));
      b.owner = owner;
      b.cell = c;
      b.placed = true;
      return c;
    }

    // path: where a list of rows sits in the layout ('' for the top, '2.rows' inside the third row's section, '3.tabs.0.rows' …).
    function rows(list, into, owner, path) {
      path = path || '';
      into.dataset.list = path;
      const at = i => (path ? `${path}.${i}` : String(i));
      (list || []).forEach((r, ri) => {
        if (Array.isArray(r)) {
          const g = el('div', 'fpf-grid');
          g.dataset.path = at(ri);
          r.forEach((x, ci) => {
            const w = parseCell(x, r.length);
            if (btnByName.has(w.name)) { const bc = buttonCell(w, owner); bc.dataset.col = ci; g.appendChild(bc); return; }
            order.push(w.name);
            const c = cell(w, owner);
            c.dataset.col = ci;
            g.appendChild(c);
          });
          into.appendChild(g);
        } else if (r.panels) {
          // Panels (0.44): side by side when the form is wide enough, one above the other when not.
          const box = el('div', 'fpf-panels');
          box.dataset.path = at(ri);
          box.dataset.block = 'panels';
          into.appendChild(box);
          r.panels.forEach((t, i) => {
            t = t || {};
            const pane = el('div', 'fpf-pane');
            if (t.width) pane.dataset.w = t.width;
            const b = { kind: 'section', label: t.panel || '', when: t.when || '', owner, panel: pane, fold: false, open: true, pane: true };
            blocks.push(b);
            if (t.panel) pane.appendChild(el('h3', null, t.panel));
            const body = el('div', 'fpf-body');
            pane.appendChild(body);
            rows(t.rows, body, b, `${at(ri)}.panels.${i}.rows`);
            box.appendChild(pane);
          });
        } else if (r.tabs || r.steps) {
          const kind = r.tabs ? 'tab' : 'step';
          const set = { kind, items: [], at: 0, seen: 0 };
          const box = el('div', kind === 'tab' ? 'fpf-tabs' : 'fpf-steps');
          box.dataset.path = at(ri);
          box.dataset.block = kind === 'tab' ? 'tabs' : 'steps';
          const bar = el('div', kind === 'tab' ? 'fpf-tabbar' : 'fpf-stepbar');
          box.appendChild(bar);
          into.appendChild(box);
          (r.tabs || r.steps).forEach((t, i) => {
            const b = { kind, label: String(t[kind]).trim(), when: t.when || '', owner, set, index: i, panel: el('div', 'fpf-panel'), head: el('button', 'fpf-head'), count: el('span', 'fpf-count') };
            b.head.type = 'button';
            if (kind === 'step') b.head.appendChild(el('span', 'fpf-num', String(i + 1)));
            b.head.append(el('span', 'fpf-head-label', b.label), b.count);
            b.head.onclick = () => (kind === 'tab' ? showTab(b) : goStep(b.index));
            bar.appendChild(b.head);
            box.appendChild(b.panel);
            set.items.push(b);
            blocks.push(b);
            rows(t.rows, b.panel, b, `${at(ri)}.${kind === 'tab' ? 'tabs' : 'steps'}.${i}.rows`);
          });
          if (kind === 'step') stepper = set;
        } else {
          const sec = el('section', 'fpf-section');
          sec.dataset.path = at(ri);
          sec.dataset.block = 'section';
          const b = { kind: 'section', label: r.section || '', when: r.when || '', owner, panel: sec, fold: !!r.fold, open: r.fold !== 'closed' };
          blocks.push(b);
          if (r.fold) {
            b.head = el('button', 'fpf-fold');
            b.head.type = 'button';
            b.count = el('span', 'fpf-count');
            b.head.append(el('span', null, r.section), b.count);
            b.head.setAttribute('aria-expanded', String(b.open));
            b.head.onclick = () => { b.open = !b.open; paintLayout(); };
            sec.appendChild(b.head);
          } else if (r.section) sec.appendChild(el('h3', null, r.section || 'Section'));
          const body = el('div', 'fpf-body');
          sec.appendChild(body);
          rows(r.rows, body, b, `${at(ri)}.rows`);
          into.appendChild(sec);
        }
      });
    }
    const ackBox = el('section', 'fpf-acks');
    ackBox.hidden = true;
    root.appendChild(ackBox);
    rows(def.layout || fields.map(f => [f.name + ' 12']), root, null);
    // A field the layout leaves out is off the form: it never shows and is never checked, but formulas still see it.
    fields.forEach(f => {
      if (ui[f.name]) return;
      const hold = el('div');
      hold.appendChild(cell(parseCell(f.name + ' 12', 1), null));
      ui[f.name].offForm = true;
    });
    fields.forEach(f => { if (!order.includes(f.name) && ui[f.name]) order.push(f.name); });

    const live = set => set.items.filter(b => !b.off);
    function paintLayout() {
      blocks.forEach(b => {
        if (b.kind === 'section') {
          b.panel.hidden = !!b.off;
          b.panel.classList.toggle('closed', b.fold && !b.open);
          if (b.head) b.head.setAttribute('aria-expanded', String(b.open));
          return;
        }
        const on = b.set.at === b.index;
        b.head.hidden = !!b.off;
        b.head.classList.toggle('on', on);
        b.panel.classList.toggle('fpf-off', !on || !!b.off);
        if (b.kind === 'step') {
          b.head.classList.toggle('done', b.index < b.set.at);
          b.head.disabled = !on && b.index > b.set.seen; // forward only through Next
        }
      });
    }
    function showTab(b) { b.set.at = b.index; paintLayout(); }
    /* Open every tab, step and folded section around a field. */
    function reveal(name) {
      chain(ui[name] && ui[name].owner).forEach(b => {
        if (b.kind === 'section') b.open = true;
        else { b.set.at = b.index; if (b.kind === 'step') b.set.seen = Math.max(b.set.seen, b.index); }
      });
      paintLayout();
    }
    // Problems that keep you on a step: those in it, and those outside every step.
    const blocksStep = (name, step) => { const s = stepOf(name); return !s || s === step; };
    function goStep(i) {
      if (!stepper || i === stepper.at || i > stepper.seen) return;
      if (i > stepper.at) {
        const probs = problemsNow();
        const stuck = Object.keys(probs).filter(n => { const s = stepOf(n); return !s ? true : s.index >= stepper.at && s.index < i; });
        if (stuck.length) { stuck.forEach(n => { ui[n].touched = true; }); paintMessages(probs, true); paintFoot(probs); return; }
      }
      stepper.at = i;
      paintLayout();
      const probs = problemsNow();
      paintMessages(probs, true);
      paintFoot(probs);
      const top = root.querySelector('.fpf-stepbar');
      if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start' });
      const first = order.find(n => stepOf(n) === stepper.items[i] && isEntry(byName.get(n)) && visible[n] && blank(ui[n].control.get()));
      if (first) ui[first].control.focus();
    }
    function nextStep(dir) {
      if (!stepper) return;
      const items = live(stepper);
      const k = items.indexOf(stepper.items[stepper.at]);
      const to = items[k + dir];
      if (!to) return;
      if (dir > 0) {
        const probs = problemsNow();
        const here = Object.keys(probs).filter(n => blocksStep(n, stepper.items[stepper.at]));
        if (here.length) { here.forEach(n => { ui[n].touched = true; }); paintMessages(probs, true); paintFoot(probs); return; }
        stepper.seen = Math.max(stepper.seen, to.index);
      }
      goStep(to.index);
    }
    const onLastStep = () => !stepper || live(stepper).slice(-1)[0] === stepper.items[stepper.at];

    const queueBox = el('div', 'fpf-queue');
    queueBox.hidden = true;
    root.appendChild(queueBox);
    const foot = el('div', 'fpf-foot');
    const footButtons = buttons.filter(b => !b.placed);
    footButtons.forEach(makeButton);
    const why = el('div', 'fpf-why');
    const backBtn = el('button', 'fpf-back', def.backLabel || 'Back');
    const nextBtn = el('button', 'fpf-next', def.nextLabel || 'Next');
    backBtn.type = nextBtn.type = 'button';
    backBtn.onclick = () => nextStep(-1);
    nextBtn.onclick = () => nextStep(1);
    if (stepper) foot.append(backBtn, nextBtn);
    footButtons.forEach(b => foot.appendChild(b.el));
    foot.appendChild(why);
    // Who saves (0.46): on a shared terminal that stays signed in a while, the name is on every save, with a way to switch.
    if (!opts.preview && !parent && !sub && FP.users && FP.users.now && footButtons.some(b => b.action === 'save')) {
      const as = el('div', 'fpf-as');
      const paintAs = () => {
        const u = FP.users.now();
        as.replaceChildren();
        as.hidden = !u;
        if (!u) return;
        // On a shared terminal (0.50.1) the signed-in supervisor is responsible; who did it is a field on the form.
        as.append(document.createTextNode(opts.responsible ? 'Responsible: ' : 'Saving as '), el('b', null, u.name), document.createTextNode(' · '));
        const nb = el('button', 'fpf-notyou', opts.responsible ? 'Hand over' : 'Not you?'); nb.type = 'button';
        nb.onclick = () => window.dispatchEvent(new CustomEvent('fp-switch-user'));
        as.appendChild(nb);
      };
      paintAs();
      foot.appendChild(as);
      root.__paintAs = paintAs;
    }
    root.appendChild(foot);

    /* Validation: what blocks saving, per field. */
    function problemsNow(scope) {
      const out = {};
      for (const f of fields) {
        if (!visible[f.name] || !ui[f.name]) continue;
        if (scope && !scope.has(f.name)) continue;
        if (isEntry(f)) {
          const c = ui[f.name].control;
          const v = c.get();
          if (v && typeof v === 'object' && !Array.isArray(v) && 'bad' in v) { out[f.name] = 'Enter a number'; continue; }
          const own = c.problem ? c.problem() : null;
          if (own) { out[f.name] = own; continue; }
          if (blank(v)) { if (f.required) out[f.name] = 'Required'; continue; }
          if (f.control === 'number' && f.limits) {
            const r = rangeNow[f.name] || {};
            const lo = r.limMin, hi = r.limMax;
            if (lo != null && v < lo) out[f.name] = `Must be at least ${fmtNum(lo)}${f.unit ? ' ' + f.unit : ''}`;
            if (hi != null && v > hi) out[f.name] = `Must be at most ${fmtNum(hi)}${f.unit ? ' ' + f.unit : ''}`;
          }
          if (ruleOk[f.name] === false && !out[f.name]) out[f.name] = f.ruleText ? String(f.ruleText).replace(/\{value\}/g, Array.isArray(v) ? v.join(', ') : String(v)) : 'Not allowed';
        } else if (f.required && computed(f)) {
          const v = display[f.name];
          if (f.control === 'media') {
            const st = mediaUsable[f.name];
            if (st === 'waiting' || st === undefined) out[f.name] = 'Still waiting';
            else if (st === 'gone') out[f.name] = `${f.label || f.name} can't be found in the media folder`;
            else if (st === 'none') out[f.name] = f.empty || `No ${(f.label || f.name).toLowerCase()} yet`;
          }
          else if (v === undefined || FP.fn.isWaiting(v)) out[f.name] = 'Still waiting';
          else if (FP.fn.isNoData(v)) out[f.name] = 'No data';
          else if (FP.fn.isError(v)) out[f.name] = 'Error';
        }
      }
      // Each structure written by an item ID field needs that ID.
      Object.entries(def.items || {}).forEach(([s, cfg]) => {
        if (!cfg.field || !writesTo(s, scope)) return;
        // The ID comes from a field people fill in, a display field (each.$id in a sub-form), or the master form.
        const f = byName.get(cfg.field);
        const v = f ? (isEntry(f) ? ui[f.name] && ui[f.name].control && ui[f.name].control.get() : display[f.name]) : outerVals()[cfg.field];
        if (blank(v) || (v && typeof v === 'object' && v.__fp)) { if (f) out[cfg.field] = out[cfg.field] || 'Required'; }
      });
      return out;
    }

    function writesTo(structure, scope) {
      return fields.some(f => visible[f.name] !== false && (!scope || scope.has(f.name)) && ((f.writes && target(f.writes).structure === structure) || (f.snapshot && target(f.snapshot).structure === structure)));
    }

    /* What a button covers: null for the whole form, or a set of field names. */
    function scopeOf(b) {
      const sc = b.action === 'save' ? (b.scope == null ? 'form' : b.scope) : 'form';
      if (sc === 'form' || sc === 'tree') return null;
      if (Array.isArray(sc)) return new Set(sc);
      const kind = ['section', 'tab', 'step'].find(k => typeof sc[k] === 'string');
      return new Set(order.filter(n => chain(ui[n].owner).some(x => x.kind === kind && x.label === sc[kind])));
    }
    /* Why a button can't be used right now, beyond its scope's own problems. */
    function blockedBy(b) {
      if ((b.action === 'save' || b.action === 'apply') && ackPending()) return ackPending();
      if (b.action === 'save' && stayed && !scopeOf(b)) return 'Saved. Change something to start the next one.';
      if (b.action === 'save') {
        if (parent && parent.link && !parent.link.exists && !sub) return `The ${parent.title} record isn't saved yet: use Apply, and this is saved with it.`;
        const linked = queue.filter(q => !q.sub).length;
        if (b.scope !== 'tree' && !scopeOf(b) && linked) return `${linked} linked record${linked === 1 ? ' is' : 's are'} waiting to be saved with this form; use the button that saves them, or remove them.`;
        if (!scopeOf(b)) { const need = subNeeded(); if (need) return need; }
      }
      if (b.action === 'open' && b.link) {
        const cfg = (def.items || {})[b.link] || {};
        if (cfg.field && blank(ui[cfg.field] && ui[cfg.field].control.get())) return `Fill ${byName.get(cfg.field).label || cfg.field} first.`;
      }
      // An item found by a rule (the run on now) must have been found before saving to it.
      if (b.action === 'save') {
        const sc = scopeOf(b);
        for (const [st, cfg] of Object.entries(def.items || {})) {
          if (!cfg.where || !writesTo(st, sc)) continue;
          const hit = srcValues[cfg.source];
          if (!(hit && typeof hit === 'object' && hit.$id != null)) return `No ${realSt(st)} item is the one where ${cfg.where}: start one first.`;
        }
      }
      return null;
    }
    const lc = t => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
    function paintButtons() {
      paintSubStates();
      const out = new Map();
      for (const b of buttons) {
        const shown = !b.off && !(b.owner && b.owner.off) && (b.placed || onLastStep());
        b.el.hidden = !shown;
        if (!shown) continue;
        const scope = scopeOf(b);
        const probs = ['open', 'subform', 'finish', 'set'].includes(b.action) ? {} : problemsNow(scope);
        const block = blockedBy(b);
        b.el.disabled = saving || Object.keys(probs).length > 0 || !!block;
        b.el.title = block || Object.keys(probs).map(n => `${byName.get(n).label || n}: ${lc(probs[n])}`).join('\n');
        if (b.action === 'save') b.dot.hidden = !((scope ? Array.from(scope).some(n => edited.has(n)) : edited.size > 0) || (b.scope === 'tree' && queue.length > 0));
        out.set(b, { probs, block });
      }
      return out;
    }

    function paintFoot(probs, extra) {
      let names = Object.keys(probs);
      const last = onLastStep();
      if (stepper) {
        const items = live(stepper);
        backBtn.hidden = items[0] === stepper.items[stepper.at];
        nextBtn.hidden = last;
        if (!last) names = names.filter(n => blocksStep(n, stepper.items[stepper.at]));
        nextBtn.disabled = names.length > 0;
      }
      const states = paintButtons();
      // A form with no buttons and no steps (a dashboard) shows no bar at the bottom.
      foot.hidden = !stepper && !buttons.length && !extra;
      paintCounts(probs);
      why.className = 'fpf-why' + (extra ? ' bad' : '');
      if (extra) { why.textContent = extra; return; }
      // On the last step (or with no steps), the reasons shown are the main bottom button's.
      const main = footButtons.filter(b => !['open', 'subform', 'finish', 'set'].includes(b.action) && !b.el.hidden).slice(-1)[0];
      if (last) {
        const st = main && states.get(main);
        if (st && st.block && !Object.keys(st.probs).length) { why.textContent = st.block; return; }
        names = st ? Object.keys(st.probs) : [];
        probs = st ? st.probs : {};
      }
      const where = n => { const s = stepper && stepOf(n); return s && s !== stepper.items[stepper.at] ? ` in step ${s.index + 1}` : ''; };
      why.textContent = names.length
        ? (last ? (main && main.action === 'apply' ? 'To apply: ' : 'To save: ') : 'To go on: ') + names.map(n => `${byName.get(n).label || n} (${lc(probs[n])}${where(n)})`).join(', ')
        : (ownSavedRuns().length ? `${ownSavedRuns().length} ${ownSavedRuns().length === 1 ? 'record is' : 'records are'} already saved from ${ownSavedRuns().map(r => r.label).filter((x, i, a) => a.indexOf(x) === i).join(', ')}: save this ${title} too, so they point at a saved record.`
          : isDirty() ? 'Not saved yet.' : '');
    }

    /* How many things to fix inside each tab, step and folding section; red once a message is showing. */
    function paintCounts(probs) {
      blocks.forEach(b => {
        if (!b.count) return;
        // Steps not reached yet show nothing: they are filled in when you get there.
        const mine = b.kind === 'step' && b.index > b.set.seen ? [] : Object.keys(probs).filter(n => chain(ui[n] && ui[n].owner).includes(b));
        b.count.textContent = mine.length ? String(mine.length) : '';
        b.count.classList.toggle('n', mine.length > 0);
        b.count.classList.toggle('bad', mine.some(n => /\bbad\b/.test(ui[n].msg.className)));
        b.count.title = mine.length ? mine.map(n => byName.get(n).label || n).join(', ') : '';
      });
    }

    function paintMessages(probs, touchedOnly) {
      for (const f of fields) {
        const u = ui[f.name];
        if (!u) continue;
        let text = '', cls = 'fpf-msg';
        // While typing, only fields already touched show problems; a save attempt shows them all.
        if (probs[f.name] && (!touchedOnly || u.touched)) { text = probs[f.name]; cls += ' bad'; }
        else if (f.control === 'number' && f.warn && u.control) {
          const v = u.control.get();
          const r = rangeNow[f.name] || {};
          if (typeof v === 'number' && ((r.warnMin != null && v < r.warnMin) || (r.warnMax != null && v > r.warnMax))) { text = f.warn.message || `Outside the usual ${r.warnMin != null ? fmtNum(r.warnMin) : ''}–${r.warnMax != null ? fmtNum(r.warnMax) : ''}`; cls += ' warn'; }
        }
        u.msg.textContent = text;
        // Compact: a message sits over the field's bottom edge; a long one takes its own line.
        if (density === 'compact' && text.length > 44) cls += ' long';
        u.msg.className = cls;
      }
    }

    /* The entry fields a display field depends on, through other display fields too. */
    const mentions = (formula, name) => new RegExp('(^|[^A-Za-z0-9_.])' + name + '([^A-Za-z0-9_]|$)').test(formula || '');
    // A media field or Read first names what it needs in its where formulas.
    const whereText = w => Object.values(w || {}).filter(x => typeof x === 'string').join(' , ');
    function feeds(f, seen) {
      seen = seen || new Set([f.name]);
      const out = new Set();
      const fx = f.formula || whereText(f.where);
      for (const x of fields) {
        if (seen.has(x.name) || !mentions(fx, x.name)) continue;
        if (isEntry(x)) out.add(x.name);
        else if (x.formula) { seen.add(x.name); feeds(x, seen).forEach(n => out.add(n)); }
      }
      // Through the form's sources too: a worked-out value by its formula, one item by the field holding its ID.
      for (const sx of (Array.isArray(def.sources) ? def.sources : [])) {
        if (!sx || !sx.name || seen.has('src:' + sx.name) || !mentions(fx, sx.name)) continue;
        seen.add('src:' + sx.name);
        if (sx.kind === 'value' && sx.formula) feeds({ name: 'src:' + sx.name, formula: sx.formula }, seen).forEach(n => out.add(n));
        else if (sx.id && sx.id.field) feeds({ name: 'src:' + sx.name, formula: sx.id.field }, seen).forEach(n => out.add(n));
        else if (sx.id && sx.id.open) feeds({ name: 'src:' + sx.name, formula: Object.values(sx.id.open).join(' , ') }, seen).forEach(n => out.add(n));
      }
      return out;
    }

    /* Work out every display field and when-rule, in order, then validate. */
    async function recalc() {
      const seq = ++calcSeq;
      let defaultsMoved = false;
      const inputs = Object.assign(outerVals(), subValues(), entryValues(), selNow);
      const ctx = opts.asOf ? { asOf: opts.asOf } : {};
      // Sources found by a worked-out field use its value as last worked out; when it moves, the form is worked out again.
      const idSeen = {};
      idByValue.forEach(n => { if (!(n in inputs) && n in display) { inputs[n] = display[n]; idSeen[n] = JSON.stringify(display[n] == null ? null : display[n]); } });
      if (hasSources) {
        const sv = await FP.sources.evaluate(def, inputs, ctx, { generated: st => ids[st] || null });
        if (seq !== calcSeq) return;
        srcValues = sv;
        noteSeen();
        Object.assign(inputs, sv);
      }
      const selBefore = JSON.stringify(selNow);
      const vis = {};
      // Section, tab and step rules first, outer before inner.
      const off = new Map();
      for (const b of blocks) {
        let hide = !!(b.owner && off.get(b.owner));
        if (!hide && b.when) { const v = await FP.fn.evaluateAsync(b.when, inputs, ctx); hide = v !== true; }
        if (seq !== calcSeq) return;
        off.set(b, hide);
      }
      blocks.forEach(b => { b.off = off.get(b); });
      // A tab set or the steps never rests on a hidden tab or step.
      new Set(blocks.filter(b => b.set).map(b => b.set)).forEach(set => {
        if (!set.items[set.at].off) return;
        const to = set.items.slice(set.at).find(b => !b.off) || set.items.find(b => !b.off);
        if (to) { set.at = to.index; set.seen = Math.max(set.seen, to.index); }
      });
      paintLayout();
      for (const b of buttons) {
        let hide = false;
        if (b.when) { const v = await FP.fn.evaluateAsync(b.when, inputs, ctx); hide = v !== true; }
        if (seq !== calcSeq) return;
        b.off = hide;
      }
      const noteSel = (name, val) => { selNow[name + '.selected'] = val; inputs[name + '.selected'] = val; };
      for (const f of fields) {
        const u = ui[f.name];
        // A carried value (0.50) is off the form but counts as shown, so its copy is saved.
        let shown = !!u && (f.carried || (!u.offForm && !(u.owner && u.owner.off)));
        if (shown && f.when) { const v = await FP.fn.evaluateAsync(f.when, inputs, ctx); shown = v === true; }
        if (seq !== calcSeq) return;
        vis[f.name] = shown;
        if (u) u.cell.hidden = !shown;
        // A table of a list's items follows the list; a choice's options follow their formula.
        if (u && f.rowsFrom && u.control.setRows) u.control.setRows(srcValues[f.rowsFrom]);
        if (u && f.optionsFrom && u.control.setOptions) {
          let ov = await FP.fn.evaluateAsync(f.optionsFrom, inputs, ctx).catch(() => null);
          u.optItems = Array.isArray(ov) ? ov.slice() : [];
          // Each option labelled by a formula of its item; its value stays the item's ID (or the item itself).
          if (Array.isArray(ov) && f.optionLabel) {
            const out = [];
            for (const item of ov) {
              const lab = await FP.fn.evaluateAsync(f.optionLabel, Object.assign({}, inputs, { item }), ctx).catch(() => null);
              const value = item && typeof item === 'object' ? (item.$id != null ? item.$id : item.id != null ? item.id : item.value) : item;
              out.push({ value, label: lab == null || (typeof lab === 'object') ? String(value) : String(lab) });
            }
            ov = out;
          }
          if (seq !== calcSeq) return;
          u.control.setOptions(ov);
        }
        if (u && (f.control === 'choice' || f.control === 'chips')) {
          // A choice's .selected is the item its value stands for (the value itself when options are listed); chips' the items picked.
          const cur = u.control.get();
          const items = f.optionsFrom && u.optItems ? u.optItems : null;
          const find = x => { if (!items) return x; const k = String(x); const it = items.find(i => String(itemKey(i, !!f.optionLabel)) === k); return it === undefined ? x : it; };
          noteSel(f.name, blank(cur) || (cur && typeof cur === 'object' && !Array.isArray(cur)) ? null : Array.isArray(cur) ? cur.map(find) : find(cur));
        }
        if (u && isEntry(f) && f.defaultFrom && !personSet.has(f.name)) {
          // A starting value from a formula: it follows the formula until someone changes the field.
          let dv = await FP.fn.evaluateAsync(f.defaultFrom, inputs, ctx).catch(() => null);
          if (seq !== calcSeq) return;
          if (dv && typeof dv === 'object' && !Array.isArray(dv) && !dv.__fp) dv = dv.$id != null ? dv.$id : dv.id != null ? dv.id : dv;
          if ((dv && typeof dv === 'object' && dv.__fp) || dv === '') dv = null;
          const now = u.control.get();
          if (JSON.stringify(now == null ? null : now) !== JSON.stringify(dv == null ? null : dv)) {
            u.control.set(dv == null ? null : dv);
            inputs[f.name] = u.control.get();
            defaultsMoved = true;
          }
        }
        if (u && isEntry(f) && f.control === 'number' && (f.warn || f.limits)) {
          const end = async x => { if (x == null) return null; if (typeof x === 'number') return x; const r = await FP.fn.evaluateAsync(String(x), inputs, ctx).catch(() => null); return typeof r === 'number' && isFinite(r) ? r : null; };
          const r = { warnMin: await end((f.warn || {}).min), warnMax: await end((f.warn || {}).max), limMin: await end((f.limits || {}).min), limMax: await end((f.limits || {}).max) };
          if (seq !== calcSeq) return;
          rangeNow[f.name] = r;
        }
        if (u && isEntry(f) && f.rule) {
          const cur = u.control.get();
          let ok = true;
          if (shown && !blank(cur)) { const r = await FP.fn.evaluateAsync(f.rule, inputs, ctx).catch(() => null); ok = r !== false; }
          if (seq !== calcSeq) return;
          ruleOk[f.name] = ok;
        }
        if (!computed(f)) continue;
        if (f.control === 'media') {
          const r = await mediaFor(f.where, inputs, ctx);
          if (seq !== calcSeq) return;
          display[f.name] = r.files || null; inputs[f.name] = r.files || null;
          if (u) await renderMedia(u, f, r);
          continue;
        }
        let v;
        try { v = await FP.fn.evaluateAsync(f.formula, inputs, ctx); }
        catch (e) { v = { __fp: 'error', message: e.message }; }
        if (seq !== calcSeq) return;
        display[f.name] = v;
        inputs[f.name] = v;
        if (idByValue.has(f.name) && JSON.stringify(v == null ? null : v) !== (idSeen[f.name] || 'null')) defaultsMoved = true;
        if (!u) continue;
        let d = show(v, f);
        if (d.state === 'waiting') {
          // Name the form's own fields still missing, not the function's input names.
          const missing = Array.from(feeds(f)).filter(n => blank(inputs[n])).map(n => byName.get(n).label || n);
          d = { state: 'waiting', text: missing.length ? `Waiting for ${missing.join(', ')}` : 'Waiting' };
        }
        if (isVisual(f)) {
          // A visual's other formula settings (targets, limits, lines) are worked out alongside it.
          const extras = {};
          for (const x of settingsFor(f)) {
            if (x.name === 'formula' || x.name === 'when' || f[x.name] == null) continue;
            if (x.type === 'formula') extras[x.name] = await FP.fn.evaluateAsync(f[x.name], inputs, ctx).catch(e => ({ __fp: 'error', message: e.message }));
            else if (x.type === 'map' && x.values === 'formula' && !x.perGroup) {
              extras[x.name] = {};
              for (const [k, fx] of Object.entries(f[x.name])) extras[x.name][k] = await FP.fn.evaluateAsync(fx, inputs, ctx).catch(e => ({ __fp: 'error', message: e.message }));
            }
          }
          // A visual that works out more before it draws (0.55, the trace tree: a formula for each item it shows).
          if (CONTROLS[f.control] && CONTROLS[f.control].prepare && !(v && typeof v === 'object' && v.__fp)) {
            extras.__prepared = await CONTROLS[f.control].prepare(f, v, (fx, vars) => FP.fn.evaluateAsync(fx, Object.assign({}, inputs, vars || {}), ctx)).catch(e => ({ roots: [], all: [], error: e.message }));
          }
          if (seq !== calcSeq) return;
          if ((f.control === 'records' || f.control === 'board' || f.control === 'tree') && f.select) {
            // The tapped record follows the list: its latest values, or nothing once it has left the list.
            // A tree's items can share an ID (a run, and a check saved on it): an entry is followed by its entry ID.
            const keyOf = f.control === 'tree' ? r => (r && r.$entry != null ? 'e:' + r.$entry : recId(r)) : recId;
            const was = keyOf(picked[f.name]);
            const pool = f.control === 'tree' ? ((extras.__prepared && extras.__prepared.all) || []) : v;
            const now = was != null && Array.isArray(pool) ? pool.find(r => keyOf(r) === was) : null;
            if (now) picked[f.name] = now; else delete picked[f.name];
            noteSel(f.name, now || null);
          }
          u.visual = { v, d, extras };
          paintVisual(u, f);
        } else if (f.control === 'buttons') {
          await paintButtonList(u, f, v, d, inputs, ctx, seq);
          if (seq !== calcSeq) return;
        } else if (f.control === 'badge') {
          const tone = d.state === 'value' ? ((f.colors || {})[String(v)] || (f.colors || {})['*'] || '') : '';   // * : any other value (0.44.5)
          u.out.replaceChildren(d.state === 'value' ? el('span', 'fpf-badge ' + tone, d.text) : el('span', d.state, d.text));
        } else {
          u.out.replaceChildren(el('span', d.state === 'value' ? '' : d.state, d.text));
        }
      }
      Object.assign(visible, vis);
      // A starting value that followed its formula, or a .selected that changed, changes what earlier formulas saw: work it out once more.
      if (JSON.stringify(selNow) !== selBefore) defaultsMoved = true;
      // A few times at most: a moved value can move another (a tapped row fills in a field a source is found by).
      if (defaultsMoved && (recalc.again || 0) < 3) { recalc.again = (recalc.again || 0) + 1; try { await recalc(); } finally { recalc.again -= 1; } return; }
      if (acks.length) { await refreshAcks(inputs, ctx, seq); if (seq !== calcSeq) return; }
      if (subforms.length) { await planSubs(); if (seq !== calcSeq) return; }
      const probs = problemsNow();
      paintMessages(probs, true);
      paintFoot(probs);
      if (pendingFocus && ui[pendingFocus] && !ui[pendingFocus].cell.inert) { ui[pendingFocus].control.focus(); pendingFocus = null; }
    }

    /* Buttons from a list: one per item, each labelled and coloured by formulas that see the item. */
    async function paintButtonList(u, f, v, d, inputs, ctx, seq) {
      if (!Array.isArray(v)) { u.out.replaceChildren(el('span', d.state === 'value' ? 'nodata' : d.state, d.state === 'value' ? 'Not a list' : d.text)); return; }
      const cards = !!(f.detail || (Array.isArray(f.actions) && f.actions.length));
      const box = el('div', cards ? 'fpf-cards' : 'fpf-tiles');
      const text = x => (x == null || (typeof x === 'object' && x.__fp) ? '' : typeof x === 'object' ? (x.label || x.title || x.$id || x.id || '') : String(x));
      for (const item of v.slice(0, 200)) {
        const vals = Object.assign({}, inputs, { item });
        const label = text(f.caption ? await FP.fn.evaluateAsync(f.caption, vals, ctx).catch(() => null) : item);
        const tone = f.tone ? await FP.fn.evaluateAsync(f.tone, vals, ctx).catch(() => '') : '';
        if (cards) {
          // A card: its caption and second line (tapping them does what a tile does), then its own buttons.
          const card = el('div', 'fpf-card ' + (TONES.includes(tone) ? tone : ''));
          const head = el('button', 'fpf-card-head'); head.type = 'button';
          head.appendChild(el('b', null, label));
          if (f.detail) head.appendChild(el('span', null, text(await FP.fn.evaluateAsync(f.detail, vals, ctx).catch(() => ''))));
          if (f.form || f.sets) head.onclick = () => tapItem(f, item); else head.disabled = true;
          card.appendChild(head);
          const row = el('div', 'fpf-card-acts');
          for (const a of (Array.isArray(f.actions) ? f.actions : [])) {
            if (a.when && (await FP.fn.evaluateAsync(a.when, vals, ctx).catch(() => false)) !== true) continue;
            const ab = el('button', 'fpf-card-act', a.label); ab.type = 'button';
            ab.onclick = () => tapItem(Object.assign({}, f, { form: a.form, prefill: a.prefill || {}, sets: null, name: f.name }), item);
            row.appendChild(ab);
          }
          if (row.childNodes.length) card.appendChild(row);
          if (seq !== calcSeq) return;
          box.appendChild(card);
          continue;
        }
        if (seq !== calcSeq) return;
        const b = el('button', 'fpf-tile ' + (TONES.includes(tone) ? tone : ''), label);
        b.type = 'button';
        b.onclick = () => tapItem(f, item);
        box.appendChild(b);
      }
      if (!v.length) box.appendChild(el('span', 'nodata', f.empty || 'Nothing in the list'));
      u.out.replaceChildren(box);
    }
    function tapItem(f, item) {
      if (opts.preview) { paintFoot(problemsNow(), `Preview: ${f.form ? `this would open ${f.form} for ${item && typeof item === 'object' ? item.$id || item.id : item}` : f.sets ? `this would set ${f.sets}` : 'nothing happens'}. Nothing is saved here.`); return; }
      if (f.sets && ui[f.sets] && ui[f.sets].control) { ui[f.sets].control.set(item && typeof item === 'object' ? (item.$id != null ? item.$id : item.id) : item); changed(f.sets); }
      if (f.form && opts.onOpenForm) {
        // On the launcher's home screen (0.47): the launcher opens the form itself, filled in from the item.
        prefillFor(f.prefill || {}, { item }).then(pre => opts.onOpenForm(f.form, pre)).catch(e => paintFoot(problemsNow(), `Could not open ${f.form}: ${e.message}`));
      } else if (f.form) openOther({ name: f.name, action: 'open', form: f.form, prefill: f.prefill || {} }, null, { item }).catch(e => paintFoot(problemsNow(), `Could not open ${f.form}: ${e.message}`));
    }

    /* Visual controls draw into their box; they redraw when the box changes width. */
    function paintVisual(u, f) {
      if (!u.visual) return;
      const { v, d, extras } = u.visual;
      const helpers = { el, show, isSpecial: x => !!(x && typeof x === 'object' && x.__fp) };
      if (f.select) {
        // Tapping a row or tile selects it; tapping the selected one again lets it go.
        helpers.selectedId = () => recId(picked[f.name]);
        helpers.select = r => {
          if (recId(r) != null && recId(r) === recId(picked[f.name])) delete picked[f.name]; else picked[f.name] = r;
          selNow[f.name + '.selected'] = picked[f.name] || null;   // seen from the start, by sources found by it too
          recalc();
        };
      }
      try { CONTROLS[f.control].render(u.out, v, f, d, extras, helpers); }
      catch (e) { u.out.replaceChildren(el('span', 'error', `Could not draw: ${e.message}`)); }
      if (!u.resize && window.ResizeObserver) {
        let w = u.out.clientWidth;
        u.resize = new ResizeObserver(() => { const nw = u.out.clientWidth; if (Math.abs(nw - w) > 4) { w = nw; paintVisual(u, f); } });
        u.resize.observe(u.out);
      }
    }

    /* Which files of this form's media list a where map picks now: { files } or { waiting: 'Die no.' } or { error }. */
    async function mediaFor(where, inputs, ctx) {
      const wanted = {};
      for (const [tag, fx] of Object.entries(where || {})) {
        let v;
        try { v = await FP.fn.evaluateAsync(fx, inputs, ctx); } catch (e) { return { error: e.message }; }
        if (FP.fn.isWaiting(v) || FP.fn.isNoData(v) || blank(v)) {
          const names = Array.from(feeds({ name: '__media', where: { [tag]: fx } })).filter(n => blank(inputs[n])).map(n => (byName.get(n) && byName.get(n).label) || n);
          return { waiting: names.join(', ') || tag };
        }
        if (FP.fn.isError(v)) return { error: v.message || 'error' };
        wanted[tag] = (Array.isArray(v) ? v : [v]).map(x => (x && typeof x === 'object' ? (x.$id != null ? x.$id : x.id) : x));
      }
      return { files: await FP.media.pick(def, wanted).catch(() => []) };
    }

    /* A media display: the files of the form's media list its tags pick, each with Open; embed: true also
     * shows the first (or the one tapped) inside the form. */
    async function renderMedia(u, f, r) {
      const key = JSON.stringify(r);
      if (u.mediaKey === key) return; // unchanged: don't reload frames
      u.mediaKey = key;
      if (r.waiting != null) { mediaUsable[f.name] = 'waiting'; u.out.replaceChildren(el('span', 'waiting', `Waiting for ${r.waiting}`)); return; }
      if (r.error) { mediaUsable[f.name] = 'waiting'; u.out.replaceChildren(el('span', 'error', r.error)); return; }
      const items = r.files || [];
      if (!items.length) { mediaUsable[f.name] = 'none'; u.out.replaceChildren(el('span', 'nodata', f.empty || 'Nothing to show')); return; }
      mediaUsable[f.name] = items.some(x => !x.missing) ? true : 'gone';
      const box = el('div', 'fpf-media');
      const list = el('div', 'fpf-media-list');
      const frameBox = el('div', 'fpf-media-frame');
      box.append(list, frameBox);
      u.out.replaceChildren(box);
      async function embed(item) {
        frameBox.replaceChildren();
        if (!f.embed || item.missing) return;
        try {
          const o = await FP.media.open(item.path);
          if (item.image) { const img = el('img'); img.src = o.url; img.alt = item.title; frameBox.appendChild(img); return; }
          const fr = el('iframe');
          if (o.active) fr.setAttribute('sandbox', '');   // HTML, SVG and the like: shown, scripts off (0.45)
          fr.src = o.url;
          fr.title = item.title;
          fr.style.height = (f.height || 520) + 'px';
          frameBox.appendChild(fr);
        } catch (e) { frameBox.appendChild(el('div', 'fpf-msg bad', e.message)); }
      }
      items.forEach((item, i) => {
        const row = el('div', 'fpf-media-row');
        const t = el('button', 'fpf-media-title', item.title);
        t.type = 'button';
        t.onclick = () => embed(item);
        const where = item.missing ? "Can't be found in the media folder" : item.lastModified ? `changed ${new Date(item.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : '';
        const o = el('button', 'fpf-media-open', 'Open');
        o.type = 'button';
        o.onclick = () => FP.media.view(item.path).catch(e => { o.textContent = e.code === 'missing' ? 'File missing' : 'Could not open'; o.title = e.message; });
        if (item.missing) o.disabled = true;
        row.append(t, el('span', 'fpf-media-where', where), o);
        list.appendChild(row);
        if (i === 0) embed(item);
      });
    }
    const mediaUsable = {};

    /* ---------- Acknowledgments ---------- */
    const acks = Array.isArray(def.acknowledge) ? def.acknowledge : [];
    const ackedHere = new Map();   // key -> { at, every } confirmed on this screen
    const openedHere = new Set();  // keys opened or read to the end on this screen
    let ackItems = [];             // what must be read now: { a, key, title, sub, path, text, done, at }
    let ackWaiting = null;         // a formula still waiting (e.g. the profile not entered yet)
    let ackFeeds = new Set();      // entry fields the acknowledgment formulas need: never locked
    acks.forEach(a => { [a.when].concat(Object.values(a.where || {})).forEach(fx => { if (fx) feeds({ formula: fx, name: '__ack' }).forEach(n => ackFeeds.add(n)); }); });
    const hashText = t => { let h = 5381; for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
    const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

    function ackPending() {
      if (!acks.length) return null;
      if (ackWaiting) return `First fill ${ackWaiting}, then read and confirm what appears at the top.`;
      const left = ackItems.filter(x => !x.done);
      return left.length ? `Read and confirm ${left.length === 1 ? left[0].title : left.length + ' items'} at the top first.` : null;
    }

    async function refreshAcks(inputs, ctx, seq) {
      const user = await FP.users.current().catch(() => null);
      const items = [];
      let waiting = null;
      for (const a of acks) {
        if (a.when && (await FP.fn.evaluateAsync(a.when, inputs, ctx)) !== true) continue;
        if (a.show === 'text') {
          items.push({ a, key: `text:${formId}:${a.name}:${hashText(a.text || '')}`, title: a.label || a.name, text: a.text });
          continue;
        }
        // Files of the form's media list whose tags match; each is read once per version of the file (its modified time).
        const r = await mediaFor(a.where, inputs, ctx);
        if (r.waiting != null) { waiting = r.waiting; continue; }
        if (r.error) continue;
        for (const m of r.files || []) {
          const rev = m.lastModified ? new Date(m.lastModified).toISOString() : null;
          // The key goes in an item ID: the path as a short hash, the version as the file's modified time.
          let h = 0x811c9dc5; for (const ch of m.path.toLowerCase()) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
          items.push({ a, every: a.every || 'revision', key: `file-${h.toString(16)}-${m.lastModified || 0}`, path: m.path, title: m.title, revision: rev, gone: m.missing, optional: a.required === false,
            sub: [a.label || null, m.lastModified ? `changed ${new Date(m.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : null].filter(Boolean).join(' · ') });
        }
      }
      // Done: confirmed here, or on record for this person often enough.
      let store = null;
      if (user && items.length) store = await FP.current.load('acknowledgments').catch(() => null);
      const now = Date.now();
      items.forEach(x => {
        const every = x.a.every || (x.a.show === 'media' ? 'revision' : 'day');
        x.every = every;
        const here = ackedHere.get(x.key);
        const rec = store && user ? store.items.get(`${user.id}|${x.key}`) : null;
        const last = Math.max(here ? here.at : 0, rec ? Date.parse(rec.lastAt) : 0) || null;
        x.at = last;
        // Every so many hours (a shift's length, say); every: 'shift' from before 0.36 is every 12 hours.
        const hours = every === 'hours' ? Number(x.a.hours) || 12 : every === 'shift' ? 12 : null;
        x.done = !!last && (every === 'record' ? !!here
          : every === 'revision' ? true
          : hours != null ? last >= now - hours * 3600e3
          : sameDay(last, now));
      });
      if (seq != null && seq !== calcSeq) return;
      ackItems = items;
      ackWaiting = waiting;
      paintAcks(user);
    }

    function paintAcks(user) {
      const pending = ackItems.filter(x => !x.done && !x.optional);
      ackBox.hidden = !ackItems.length && !ackWaiting;
      ackBox.classList.toggle('done', !pending.length && !ackWaiting);
      ackBox.replaceChildren(el('h3', null, pending.length || ackWaiting ? 'Read before you start' : 'Read'));
      if (!user) ackBox.appendChild(el('p', null, 'Sign in to confirm you have read these.'));
      else if (ackWaiting) ackBox.appendChild(el('p', null, `Fill ${ackWaiting} to see what to read.`));
      else if (pending.length) ackBox.appendChild(el('p', null, 'Open each one, then confirm. The rest of the form unlocks when all are confirmed.'));
      ackItems.forEach(x => {
        const row = el('div', 'fpf-ack');
        const t = el('div', 't', x.title);
        if (x.sub) t.appendChild(el('small', null, x.sub));
        row.appendChild(t);
        // Nothing usable to read: it says so; required, it holds the form (supervisors see it under Needs a look).
        if (x.gone) {
          row.appendChild(el('div', 'fpf-ack-gone', x.optional ? `${x.title} can't be found in the media folder right now. You can carry on.` : `${x.title} can't be found in the media folder, and this needs it. Tell a supervisor.`));
          ackBox.appendChild(row);
          return;
        }
        if (x.done) {
          row.appendChild(el('span', 'ok-done', `✓ Confirmed ${new Date(x.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`));
          ackBox.appendChild(row);
          return;
        }
        const statement = (x.a.statement || 'I have read {title}').replace(/\{title\}/g, x.title).replace(/\{revision\}/g, x.revision || '');
        const ok = el('button', 'ok', statement); ok.type = 'button';
        ok.disabled = !user || !openedHere.has(x.key);
        if (x.path) {
          const o = el('button', null, 'Open'); o.type = 'button';
          o.onclick = async () => {
            try { await FP.media.view(x.path); openedHere.add(x.key); ok.disabled = !user; }
            catch (e) { o.textContent = e.code === 'missing' ? 'File missing' : 'Could not open'; o.title = e.message; }
          };
          row.appendChild(o);
          if (!openedHere.has(x.key)) ok.title = 'Open it first.';
        } else {
          const box = el('div', 'fpf-ack-text', x.text);
          const atEnd = () => box.scrollTop + box.clientHeight >= box.scrollHeight - 4;
          const mark = () => { if (atEnd()) { openedHere.add(x.key); ok.disabled = !user; ok.title = ''; } };
          box.onscroll = mark;
          row.appendChild(box);
          requestAnimationFrame(mark); // short text: nothing to scroll
          if (!openedHere.has(x.key)) ok.title = 'Read to the end first.';
        }
        ok.onclick = async () => {
          ok.disabled = true;
          try {
            if (!opts.preview) await FP.entry.record({ entry: 'acknowledgments.ack', item: { structure: 'acknowledgments', id: `${user.id}|${x.key}` }, form: formRef,
              values: { key: x.key, title: x.title, kind: x.path ? 'media' : 'text', path: x.path || null, statement, revision: x.revision || null, every: x.every, form: formId } });
            ackedHere.set(x.key, { at: Date.now(), every: x.every });
            x.done = true; x.at = Date.now();
            paintAcks(user);
            paintLocks();
            paintFoot(problemsNow());
          } catch (e) { ok.disabled = false; ok.title = e.message; }
        };
        row.appendChild(ok);
        ackBox.appendChild(row);
      });
      paintLocks();
    }

    /* Entry fields stay locked (inert) until everything has been read, except those the reading list
     * needs and any placed before them (a line picked before the profile). */
    const openUpTo = Math.max(-1, ...Array.from(ackFeeds).map(n => order.indexOf(n)));
    function paintLocks() {
      // Locked only once there is something known to read; while the list is still being worked out
      // (the profile not entered yet), typing goes on and only saving waits.
      const locked = !ackWaiting && ackItems.some(x => !x.done && !x.optional);
      fields.filter(isEntry).forEach(f => {
        const u = ui[f.name];
        if (!u) return;
        const lock = locked && !ackFeeds.has(f.name) && order.indexOf(f.name) > openUpTo;
        u.cell.inert = lock;
        u.cell.classList.toggle('fpf-locked', lock);
      });
      buttons.forEach(b => { if (b.cell) { b.cell.inert = locked && b.action === 'open'; b.cell.classList.toggle('fpf-locked', locked && b.action === 'open'); } });
    }

    /* ---------- Printing ----------
     * The record on screen, or a blank form for paper backup; with tree, also every
     * form open over this one, the linked records waiting here or already saved, and
     * their own linked records (blank: every form this one can open). Each form starts
     * a new page. Uses the browser's print dialog, so Save as PDF comes free. */
    let activeChild = null; // the form open over this one, if any
    const hasTree = () => buttons.some(b => b.action === 'open');
    async function printParts(mode, tree, seen) {
      seen = seen || new Set();
      const user = await FP.users.current().catch(() => null);
      const site = FP.sites ? await FP.sites.current().catch(() => null) : null;
      if (mode === 'blank') {
        seen.add(formId);
        const parts = [await printPart(def, { mode: 'blank', title, meta: ['Filled by hand: enter it on a terminal when one is working', `Printed ${new Date().toLocaleString()}`, `${FP.identity.label(FP.identity.terminalId)}${site ? ' · ' + site.name : ''}`] })];
        if (tree) for (const b of buttons.filter(x => x.action === 'open')) parts.push(...await blankTree(b.form, seen));
        return parts;
      }
      await recalc();
      const vals = entryValues();
      const idName = st => { const sd = FP.structures.get(realSt(st)); return (sd.itemId && sd.itemId.label) || `${sd.label || st} ID`; };
      const idText = Object.entries(def.items || {}).map(([st, c]) => { const id = c.field ? vals[c.field] : c.fixed || ids[st]; return id ? `${idName(st)} ${id}` : null; }).filter(Boolean).join(' · ');
      const ctx = opts.asOf ? { asOf: opts.asOf } : {};
      const inputs = withSources(Object.assign({}, vals, display));
      const parts = [await printPart(def, {
        mode: 'record', title,
        meta: [idText || 'Not saved yet', parent ? `Opened from ${parent.title}` : null, `Printed ${new Date().toLocaleString()}`, `${FP.identity.label(FP.identity.terminalId)}${site ? ' · ' + site.name : ''}`, user ? `By ${user.name}` : null],
        value: f => ui[f.name].control.get(),
        files: f => { const v = ui[f.name] && ui[f.name].control.get(); return Array.isArray(v) && v.every(x => x instanceof Blob) ? v : null; },
        display: f => display[f.name],
        visible: f => visible[f.name] !== false,
        live: f => (isVisual(f) && ui[f.name] ? (() => { const c = ui[f.name].out.cloneNode(true); c.querySelectorAll('details').forEach(d => d.remove()); return c; })() : null),
        when: async fx => (await FP.fn.evaluateAsync(fx, inputs, ctx)) === true,
        acked: ackItems.some(x => x.done) ? 'Read before starting: ' + ackItems.filter(x => x.done).map(x => `${x.title}${x.revision ? ' rev ' + x.revision : ''} (confirmed ${new Date(x.at).toLocaleString()})`).join('; ') : null,
      })];
      if (!tree) return parts;
      if (activeChild) parts.push(...await activeChild.printParts('record', true, seen));
      // Linked records already saved (oldest first, each with its own linked records)...
      for (const b of buttons.filter(x => x.action === 'open' && x.link)) {
        const id = await itemIdFor(b.link).catch(() => null);
        if (!blank(id) && await FP.current.item(b.link, id).catch(() => null)) parts.push(...await savedTree(b.form, b.link, id, title, seen, 1));
      }
      // Then the ones still waiting to be saved with this form.
      for (const q of queue) {
        const cd = FP.defs.get('form', q.formId);
        if (!cd) continue;
        parts.push(await printPart(cd.def, {
          mode: 'record', title: q.title, note: `Waiting: saved with this ${title} when it is saved.`,
          meta: [q.summary, `Linked to ${title}`],
          value: f => q.snap.values[f.name],
          files: f => (q.snap.media[f.name] ? q.snap.media[f.name].map(m => m.file) : null),
          display: f => q.snap.display[f.name],
          visible: f => q.snap.visible[f.name] !== false,
        }));
      }
      return parts;
    }

    async function print(mode, how) {
      mode = mode === 'blank' ? 'blank' : 'record';
      const tree = !!(how && how.tree);
      const cfg = def.print && def.print !== true ? def.print : {};
      const parts = await printParts(mode, tree);
      const docEl = el('div', 'fpp');
      parts.forEach(pt => docEl.appendChild(pt));
      const stamp = new Date().toLocaleString();
      const page = el('style');
      page.textContent = `@page{size:${cfg.page || 'letter'} ${cfg.orientation || 'portrait'};margin:${cfg.margin || 14}mm ${cfg.margin || 12}mm;`
        + `@top-left{content:${cssText(title + (tree ? ' and linked forms' : ''))};font:9pt system-ui,sans-serif;color:#444}`
        + `@top-right{content:${cssText(mode === 'blank' ? 'Blank form' : '')};font:9pt system-ui,sans-serif;color:#444}`
        + `@bottom-left{content:${cssText(`Printed ${stamp} · ${FP.identity.label(FP.identity.terminalId)}`)};font:8pt system-ui,sans-serif;color:#666}`
        + `@bottom-right{content:"Page " counter(page) " of " counter(pages);font:8pt system-ui,sans-serif;color:#666}}`;
      document.head.appendChild(page);
      document.body.appendChild(docEl);
      document.body.classList.add('fpp-printing');
      const done = () => {
        document.body.classList.remove('fpp-printing');
        docEl.querySelectorAll('img').forEach(img => { if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src); });
        docEl.remove(); page.remove();
        window.removeEventListener('afterprint', done);
      };
      window.addEventListener('afterprint', done);
      if (opts.printPreview) return { element: docEl, done, parts: parts.length }; // tests look at it without the dialog
      window.print();
      return { element: docEl, done, parts: parts.length };
    }

    let timer = null;
    let pendingFocus = null;
    function changed(name, how) {
      dirty = true;
      if (stayed) { stayed = false; Object.keys(ids).forEach(k => delete ids[k]); }   // a change after "stay" starts a new record
      edited.add(name);
      personSet.add(name);
      if (ui[name]) ui[name].touched = true;
      if (how && how.next) {
        const list = order.filter(n => isEntry(byName.get(n)) && visible[n] !== false);
        const to = list[list.indexOf(name) + 1];
        // Moves on to the next field, but never into another step: that takes Next. A field still locked
        // (a reading list being worked out) gets the focus once it unlocks.
        if (to && (!stepper || stepOf(to) === stepOf(name) || !stepOf(to) || !stepOf(name))) { reveal(to); if (ui[to].cell.inert) pendingFocus = to; else ui[to].control.focus(); }
      }
      clearTimeout(timer);
      timer = setTimeout(() => { recalc(); saveDraft(); }, 120);
    }

    async function saveDraft() {
      if (opts.draft === false) return; // a form opened by another keeps no draft of its own
      const v = entryValues();
      await FP.kv.set(draftKey, { at: new Date().toISOString(), values: v }).catch(() => {});
    }

    /* ---------- Saving ---------- */
    const isDirty = () => dirty || queue.length > 0 || ownSavedRuns().length > 0;
    /* A value as its field shows it: a choice's words, not its stored value (a need's label, not its ID). */
    const shownOf = (f, v) => { const c = ui[f.name] && ui[f.name].control; return c && c.labelOf ? c.labelOf(v) : v; };

    /* The record on screen gets its new item IDs once, so linked records and
     * saves of part of the form all point at the same items. */
    async function itemIdFor(s, values) {
      const cfg = (def.items || {})[s] || { generate: true };
      if (cfg.fixed) return cfg.fixed;
      if (cfg.where) {
        // The item a rule found when the form last worked things out; none found means nothing to save to.
        const hit = srcValues[cfg.source];
        if (hit && typeof hit === 'object' && hit.$id != null) return String(hit.$id);
        throw new Error(`No ${realSt(s)} item is the one where ${cfg.where}, so there is nothing to save to. Start one first.`);
      }
      if (cfg.field) {
        let id = Object.assign(outerVals(), display, values || entryValues())[cfg.field];
        if (id && typeof id === 'object' && id.__fp) id = null;
        if (id && typeof id === 'object' && !Array.isArray(id) && id.$id != null) id = String(id.$id);
        // An entered ID left empty must never quietly start a new item.
        if (id == null || id === '' || (typeof id === 'string' && !id.trim())) {
          const f = byName.get(cfg.field);
          throw new Error(`${(f && f.label) || cfg.field} is empty: it names the ${realSt(s)} item this saves to.`);
        }
        return id;
      }
      if (!ids[s]) {
        // The structure's own prefix wins, so every form makes its IDs alike.
        const sid = FP.structures.get(realSt(s)).itemId || {};
        const prefix = sid.prefix || cfg.prefix || realSt(s).split('-').map(w => w[0]).join('').toUpperCase();
        ids[s] = `${prefix}-${await FP.entry.newId()}`;
      }
      return ids[s];
    }

    /* Everything a save needs, taken from the screen now. */
    async function snapshot(scope) {
      const values = entryValues();
      const media = {};
      let who = null;
      for (const f of fields) {
        const c = isEntry(f) && visible[f.name] && (!scope || scope.has(f.name)) && ui[f.name].control;
        if (c && c.media) media[f.name] = await c.media();
        if (c && c.ref) { const r = c.ref(); if (r) (who || (who = {}))[f.name] = r; }   // who did it (0.50.1)
      }
      const lists = {};
      Object.keys(def.lists || {}).forEach(n => { const v = srcValues[n]; lists[n] = Array.isArray(v) ? v.map(x => x && x.$id).filter(id => id != null).map(String) : []; });
      return { values, display: Object.assign({}, display), visible: Object.assign({}, visible), media, scope, lists, who };
    }

    /* The entries for a snapshot: one per structure touched, plus media and a submission record.
     * Uses no screen state, so a linked record can be written later by the form that holds it. */
    async function buildPlan(snap, extraRefs) {
      const values = Object.assign({}, snap.values);
      const inScope = n => snap.visible[n] && (!snap.scope || snap.scope.has(n));
      const mediaSpecs = [];   // nothing now: captured files are written to the media folder, not saved as entries
      // Signatures, photos and attached files go into media/ named after what they belong to (form, record,
      // field, person, time), so a report can find them by that; the field saves the file's path.
      const capFields = fields.filter(f => snap.media[f.name] && snap.media[f.name].length && inScope(f.name));
      let subId = null;
      if (capFields.length) {
        const firstKey = (fields.find(f => isEntry(f) && f.writes && inScope(f.name) && target(f.writes) && !(def.lists && def.lists[target(f.writes).structure])) || {}).writes;
        let record;
        if (firstKey) record = await itemIdFor(target(firstKey).structure, values);
        else { subId = 'SUB-' + await FP.entry.newId(); record = subId; }
        const u = await FP.users.current().catch(() => null);
        const at = new Date();
        for (const f of capFields) {
          const paths = [];
          for (const m of snap.media[f.name]) paths.push(await FP.media.capture(FP.media.captureKind(f), m.file, { form: formId, record, field: f.name, user: u ? u.name : 'nobody', at }));
          values[f.name] = f.multiple === false || (ui[f.name] && ui[f.name].control.single) ? paths[0] : paths;
        }
      }
      // References come from every visible ref field (the context of the record), plus a link to a parent.
      const refs = Object.assign({}, extraRefs || {});
      fields.filter(f => isEntry(f) && f.ref && snap.visible[f.name] && !blank(values[f.name])).forEach(f => { refs[f.ref] = values[f.name]; });
      // Who did it (a person field, 0.50.1): the person and whether a PIN confirmed it, named after the field.
      Object.entries(snap.who || {}).forEach(([n, r]) => { if (inScope(n) && !blank(values[n])) refs[(byName.get(n) && byName.get(n).ref) || n] = r; });
      const groups = new Map(); // structure -> { values, derived }
      const group = st => { if (!groups.has(st)) groups.set(st, { values: {}, derived: {} }); return groups.get(st); };
      const loose = {};
      const rowSaves = [];
      const listVals = new Map(); // a list source -> the value(s) every item of it gets
      for (const f of fields) {
        if (!inScope(f.name)) continue;
        if (isEntry(f)) {
          if (blank(values[f.name])) continue; // optional and blank: no change, never 0
          if (f.rowsFrom) { rowSaves.push(f); continue; }
          if (f.writes) {
            const t = target(f.writes);
            if (def.lists && def.lists[t.structure]) { if (!listVals.has(t.structure)) listVals.set(t.structure, {}); listVals.get(t.structure)[t.container] = values[f.name]; }
            else group(t.structure).values[t.container] = values[f.name];
          }
          else if (!f.ref && !(Object.values(def.items || {}).some(c => c.field === f.name))) loose[f.name] = values[f.name];
        } else if (f.snapshot) {
          const v = snap.display[f.name];
          if (v === undefined || FP.fn.isWaiting(v) || FP.fn.isNoData(v) || FP.fn.isError(v)) continue;
          const t = target(f.snapshot);
          const g = group(t.structure);
          g.values[t.container] = v;
          const fns = {};
          FP.fn.syntax(f.formula).calls.forEach(n => { const fn = FP.fn.get(n); if (fn) fns[fn.name] = fn.version != null ? fn.version : null; });
          g.derived[t.container] = { formula: f.formula, functions: fns };
        }
      }
      const plan = mediaSpecs.slice();
      const action = snap.saveAs || def.action || 'save';
      for (const [key, g] of groups) {
        const st = realSt(key);   // a second item of a structure is saved under structure~source
        const id = await itemIdFor(key, values);
        const existing = await FP.current.item(st, id).catch(() => null);
        plan.push({ entry: `${st}.${action}`, item: { structure: st, id }, form: formRef, refs, values: g.values, derived: g.derived, after: existing ? existing.lastAt : undefined, seenAt: existing ? seenAt.get(`${st}|${id}`) : undefined });
      }
      // A list a field saves to: the same value to every item of it, merged with that item's row of a table of the list.
      const perList = new Map();
      listVals.forEach((vals, name) => { const m = new Map(); ((snap.lists || {})[name] || []).forEach(id => m.set(id, Object.assign({}, vals))); perList.set(name, m); });
      // A table of a list's items: each changed row is an entry on its own item.
      for (const f of rowSaves) {
        const src = (def.sources || []).find(x => x && x.name === f.rowsFrom);
        if (!src || !src.structure) continue;
        for (const row of values[f.name] || []) {
          if (!row || row.row == null) continue;
          const vals = Object.assign({}, row); delete vals.row;
          if (!Object.keys(vals).length) continue;
          const id = String(row.row);
          if (perList.has(f.rowsFrom)) { const m = perList.get(f.rowsFrom); m.set(id, Object.assign({}, m.get(id) || {}, vals)); continue; }
          const existing = await FP.current.item(src.structure, id).catch(() => null);
          plan.push({ entry: `${src.structure}.${action}`, item: { structure: src.structure, id }, form: formRef, refs, values: vals, after: existing ? existing.lastAt : undefined, seenAt: existing ? seenAt.get(`${src.structure}|${id}`) : undefined });
        }
      }
      for (const [name, m] of perList) {
        const st = def.lists[name];
        for (const [id, vals] of m) {
          const existing = await FP.current.item(st, id).catch(() => null);
          plan.push({ entry: `${st}.${action}`, item: { structure: st, id }, form: formRef, refs, values: vals, after: existing ? existing.lastAt : undefined, seenAt: existing ? seenAt.get(`${st}|${id}`) : undefined });
        }
      }
      // One entry per item: an item both saved to and on a list the form saves to (or in its table) gets one entry.
      for (let i = mediaSpecs.length; i < plan.length; i++) {
        for (let j = i + 1; j < plan.length; j++) {
          const x = plan[i], y = plan[j];
          if (x.entry !== y.entry || x.item.structure !== y.item.structure || String(x.item.id) !== String(y.item.id)) continue;
          x.values = Object.assign({}, y.values, x.values);
          if (y.derived) x.derived = Object.assign({}, y.derived, x.derived || {});
          plan.splice(j--, 1);
        }
      }
      if (Object.keys(loose).length || plan.length === mediaSpecs.length) {
        plan.push({ entry: 'submissions.save', item: { structure: 'submissions', id: subId || 'SUB-' + await FP.entry.newId() }, form: formRef, refs, values: Object.assign({ form: formId }, loose) });
      }
      return plan;
    }

    const linkRefs = () => (parent && parent.link ? { [parent.link.role]: parent.link.id } : {});

    async function runSave(b) {
      if (saving) return null;
      const scope = scopeOf(b);
      saving = true;
      paintFoot({}, 'Saving…');
      try {
        await recalc(); // final inputs, final derived values
        const probs = problemsNow(scope);
        paintMessages(probs, false);
        const block = blockedBy(b);
        if (Object.keys(probs).length || block) {
          saving = false;
          const firstBad = order.find(n => probs[n]);
          if (firstBad) reveal(firstBad);
          paintFoot(problemsNow(), block || undefined);
          return null;
        }
        const snap = await snapshot(scope);
        if (b.saveAs) snap.saveAs = b.saveAs;
        const plan = await buildPlan(snap, linkRefs());
        const withQueue = b.scope === 'tree' ? queue.slice() : scope ? [] : queue.filter(q => q.sub);
        for (const q of withQueue) plan.push(...(await q.build()));
        // Someone else changed an item since this form read it: ask before saving over it.
        if (!(await confirmChanges(plan))) { saving = false; return null; }
        // Saved under the site of the branch it was opened from (the editor) or this terminal's.
        const addAll = async add => { for (const spec of plan) { const x = Object.assign({}, spec); delete x.seenAt; if (opts.site && !x.site) x.site = opts.site; await add(x); } };
        // A form that needs a supervisor's approval: what a user saves is made and kept in approvals/, not saved.
        const needsOk = (sub ? sub.approval : def.approval) && !(await FP.users.can('supervisor').catch(() => false));
        let result;
        if (needsOk) {
          result = await FP.entry.prepare(addAll);
          const summary = fields.filter(f => isEntry(f) && snap.visible[f.name] && !blank(snap.values[f.name]) && typeof snap.values[f.name] !== 'object').slice(0, 4).map(f => `${f.label || f.name}: ${shownOf(f, snap.values[f.name])}`).join(' · ');
          await FP.approvals.hold({ form: formRef, title: sub ? `${sub.title || title}` : title, summary, entries: result.entries, submissionId: result.submissionId, site: opts.site });
          result.held = true;
        } else result = await FP.entry.submit(addAll);
        if (result.held) b = Object.assign({}, b, { savedMessage: 'Sent for a supervisor\'s approval: it is saved when one approves it.' });
        noteSaved(plan);
        FP.current.clearCache();
        saving = false;
        if (scope) {
          // Part of the record saved: it stays on screen, and later saves go to the same items.
          scope.forEach(n => { edited.delete(n); if (ui[n]) ui[n].touched = false; });
          if (!edited.size && !queue.length) dirty = false;
          toast(savedText(b.savedMessage || 'Saved', snap), true);
          await recalc();
          if (opts.onSaved) opts.onSaved(result);
          return result;
        }
        withQueue.forEach(q => { const i = queue.indexOf(q); if (i >= 0) queue.splice(i, 1); });
        subforms.forEach(sf => { runsOf[sf.name] = []; });
        seenAt.clear();
        ackedHere.forEach((v, k) => { if (v.every === 'record') ackedHere.delete(k); });
        paintQueue();
        const childValues = Object.assign(entryValues(), display);
        const childInput = entryValues();
        const savedIds = Object.assign({}, ids);
        // What next (0.44): a form opened by another always goes back to it; otherwise the button's then.
        const then = parent ? 'next' : b.then === 'close' && opts.onClose ? 'close' : b.then === 'stay' ? 'stay' : 'next';
        if (then === 'stay') {
          // The saved record stays on screen; the ids are kept until something changes, so it isn't saved twice.
          edited.clear();
          fields.filter(isEntry).forEach(f => { ui[f.name].touched = false; });
          dirty = false;
          stayed = true;
          await FP.kv.del(draftKey).catch(() => {});
          toast(savedText(b.savedMessage || def.savedMessage || 'Saved', snap), true);
          await recalc();
          paintFoot(problemsNow());
          if (opts.onSaved) opts.onSaved(result);
          return result;
        }
        // The record is finished: clear it (fields marked keep stay for the next one) and start a new one.
        fields.filter(isEntry).forEach(f => { if (!f.keep) { ui[f.name].control.set(f.default !== undefined ? f.default : null); personSet.delete(f.name); } ui[f.name].touched = false; });
        Object.keys(ids).forEach(k => delete ids[k]);
        edited.clear();
        dirty = false;
        await FP.kv.del(draftKey).catch(() => {});
        toast(savedText(b.savedMessage || def.savedMessage || 'Saved', snap), true);
        if (parent) { parent.applyBack(childValues, { input: childInput, ids: savedIds, how: 'saved' }); parent.close(true); if (opts.onSaved) opts.onSaved(result); return result; }
        if (then === 'close') { if (opts.onSaved) opts.onSaved(result); opts.onClose(result); return result; }
        await recalc();
        // Back to the start: the first step (or the step of the first field to fill in), first tab.
        blocks.forEach(x => { if (x.set) { x.set.at = live(x.set)[0] ? live(x.set)[0].index : 0; x.set.seen = x.set.at; } });
        const firstEmpty = order.find(n => isEntry(byName.get(n)) && !byName.get(n).keep && visible[n] && blank(ui[n].control.get()));
        if (firstEmpty && stepper) { const st = stepOf(firstEmpty); if (st && st.index > stepper.at) stepper.seen = st.index; }
        if (firstEmpty) { reveal(firstEmpty); ui[firstEmpty].control.focus(); } else paintLayout();
        paintFoot(problemsNow());
        if (opts.onSaved) opts.onSaved(result);
        return result;
      } catch (e) {
        saving = false;
        paintFoot(problemsNow(), e.code === 'session-required' ? e.message : `Not saved: ${e.message || e}`);
        return null;
      }
    }

    /* Apply: hand values back to the form that opened this one, and, for a linked
     * record whose parent isn't saved yet, leave the record with it to save later. */
    async function runApply() {
      if (!parent) return;
      await recalc();
      const probs = problemsNow(null);
      paintMessages(probs, false);
      if (Object.keys(probs).length) { const firstBad = order.find(n => probs[n]); if (firstBad) reveal(firstBad); paintFoot(probs); return; }
      const all = Object.assign(entryValues(), display);
      const held = !!(parent.link || (parent.holdAlways && writesAnything()));
      if (held) {
        const snap = await snapshot(null);
        const refs = linkRefs();
        const summary = fields.filter(f => isEntry(f) && snap.visible[f.name] && !blank(snap.values[f.name]) && !f.keep && typeof snap.values[f.name] !== 'object').slice(0, 3).map(f => shownOf(f, snap.values[f.name])).join(' · ');
        parent.hold({ title, summary, values: snap.values, snap, formId, build: () => buildPlan(snap, refs) });
      }
      dirty = false;
      parent.applyBack(all, { input: entryValues(), ids: Object.assign({}, ids), how: held ? 'held' : 'done' });
      parent.close(true);
    }

    function press(b) {
      // Set: fill the named fields that show now (works in the editor's preview too: nothing is saved).
      if (b.action === 'set') {
        Object.entries(b.sets || {}).forEach(([n, v]) => {
          const u = ui[n];
          if (!u || !u.control || visible[n] === false || u.offForm) return;
          u.control.set(v);
          changed(n);
        });
        recalc();
        return;
      }
      // The editor's preview: buttons say what they would do, and nothing is saved or opened.
      if (opts.preview) { paintFoot(problemsNow(), `Preview: ${b.action === 'open' ? `this would open ${b.form}` : b.action === 'apply' ? 'this would apply' : 'this would save'}. Nothing is saved here.`); return; }
      if (b.action === 'save') return runSave(b);
      if (b.action === 'apply') return runApply();
      if (b.action === 'open') return openOther(b).catch(e => paintFoot(problemsNow(), `Could not open ${b.form}: ${e.message}`));
      if (b.action === 'subform') return openSubform(subByName.get(b.subform)).catch(e => paintFoot(problemsNow(), `Could not open ${b.subform}: ${e.message}`));
      if (b.action === 'finish' && parent) {
        if (dirty && !confirm('Finish without this one? What you typed in it is lost.')) return;
        parent.finish();
      }
    }

    /* ---------- Opening another form over this one ---------- */
    function paintQueue() {
      queueBox.hidden = !queue.length;
      queueBox.replaceChildren(el('h4', null, `Saved with this ${title} when you save it:`));
      queue.forEach((q, i) => {
        const row = el('div', 'fpf-queue-row');
        const edit = el('button', null, 'Edit'); edit.type = 'button';
        const drop = el('button', null, 'Remove'); drop.type = 'button';
        edit.onclick = () => (q.sub ? editRun(subByName.get(q.sub), q.index) : openOther(q.button, { values: q.values, replace: i })).catch(e => paintFoot(problemsNow(), e.message));
        drop.onclick = () => {
          if (!confirm(`Remove this ${q.title}? It hasn't been saved.`)) return;
          queue.splice(i, 1);
          if (q.sub && runsOf[q.sub]) { runsOf[q.sub][q.index - 1] = undefined; applyBackSub(subByName.get(q.sub)); }
          Object.entries(q.before || {}).forEach(([n, v]) => controlApi.setField(n, v));
          paintQueue();
          paintFoot(problemsNow());
        };
        row.append(el('span', null, `${q.title}${q.summary ? ': ' + q.summary : ''}`), edit, drop);
        queueBox.appendChild(row);
      });
    }

    async function prefillFor(map, extra) {
      const inputs = Object.assign(allValues(), extra || {});
      const ctx = opts.asOf ? { asOf: opts.asOf } : {};
      const prefill = {};
      for (const [k, formula] of Object.entries(map || {})) {
        const v = await FP.fn.evaluateAsync(String(formula), inputs, ctx);
        if (!(v && typeof v === 'object' && v.__fp)) prefill[k] = v;
      }
      return prefill;
    }
    async function openOther(b, again, extra) {
      const other = FP.defs.get('form', b.form);
      if (!other || other.retired) throw new Error(`there is no published form ${b.form}`);
      const prefill = await prefillFor(b.prefill, extra);
      if (again) Object.assign(prefill, again.values);
      let link = null;
      if (b.link) {
        const id = await itemIdFor(b.link);
        if (blank(id)) throw new Error(blockedBy(b) || 'this record has no ID yet');
        link = { role: realSt(b.link), id, exists: !!(await FP.current.item(realSt(b.link), id).catch(() => null)) };
      }
      const sheet = el('div', 'fpf-sheet');
      const crumbs = el('div', 'fpf-crumbs');
      const body = el('div', 'fpf-sheet-body');
      if (other.def.density === 'compact') body.classList.add('wide');
      const hostEl = el('div');
      body.appendChild(hostEl);
      sheet.append(crumbs, body);
      document.body.appendChild(sheet);
      let child = null;
      const close = force => {
        if (!force && child && child.isDirty() && !confirm(`Leave ${other.def.title || b.form} without saving? What you typed there is lost.`)) return false;
        if (child) child.destroy();
        if (activeChild === child) activeChild = null;
        sheet.remove();
        LEVELS.splice(LEVELS.indexOf(level), 1);
        recalc();
        return true;
      };
      const level = { close };
      LEVELS.push(level);
      // Breadcrumb: every form above, then this one. Going back closes the forms above the one picked.
      const names = trail.concat([title]);
      const back = el('button', 'back', '‹ Back'); back.type = 'button';
      back.onclick = () => close(false);
      crumbs.appendChild(back);
      names.forEach((n, i) => {
        const c = el('button', null, n); c.type = 'button';
        c.onclick = () => closeAbove(LEVELS.indexOf(level) - (names.length - i)); // crumb i is the form at depth i; depth 0 has no sheet
        crumbs.append(c, el('span', 'sep', '›'));
      });
      crumbs.appendChild(el('span', 'here', other.def.title || b.form));
      try {
        child = await open(hostEl, b.form, {
          prefill, draft: false, restoreDraft: false, trail: names, asOf: opts.asOf, site: opts.site,
          parent: {
            title, link, canApply: !!(b.link || b.apply),
            applyBack: vals => Object.entries(b.apply || {}).forEach(([mine, theirs]) => { if (vals[theirs] !== undefined && ui[mine]) controlApi.setField(mine, vals[theirs]); }),
            hold: item => {
              item.button = b;
              // What apply is about to overwrite, so removing the waiting record puts it back.
              item.before = again && again.replace != null && queue[again.replace] ? queue[again.replace].before
                : Object.fromEntries(Object.keys(b.apply || {}).filter(n => ui[n]).map(n => [n, ui[n].control.get()]));
              if (again && again.replace != null) queue.splice(again.replace, 1, item); else queue.push(item);
              dirty = true;
              paintQueue();
            },
            close,
          },
        });
      } catch (e) { sheet.remove(); LEVELS.splice(LEVELS.indexOf(level), 1); throw e; }
      activeChild = child;
      return child;
    }

    /* ---------- Someone else changed it while it was open ---------- */
    function noteSeen() {
      (Array.isArray(def.sources) ? def.sources : []).forEach(x => {
        if (!x || !x.structure) return;
        const v = srcValues[x.name];
        (Array.isArray(v) ? v : [v]).forEach(it => {
          if (!it || typeof it !== 'object' || it.$id == null || !it.$at) return;
          const k = `${x.structure}|${it.$id}`;
          if (!seenAt.has(k)) seenAt.set(k, it.$at);
        });
      });
    }
    // After a save the items are this form's latest: they are read afresh next time.
    function noteSaved(plan) { plan.forEach(x => { if (x.item && x.item.id != null) seenAt.delete(`${x.item.structure}|${x.item.id}`); }); }
    const when = iso => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    async function whoDid(it) {
      const users = await FP.users.list().catch(() => []);
      const u = users.find(x => x.id === it.lastUserId);
      return `${u ? u.name : 'someone'}${it.lastTerminalId ? ` on ${it.lastTerminalId}` : ''} at ${when(it.lastAt)}`;
    }
    /* Before saving over an item someone else changed since this form read it: keep theirs, or save mine over it. */
    async function confirmChanges(plan) {
      // Saves that only add (a rack counted into sum, count or list values) can't overwrite anyone: no need to ask.
      const adds = x => { const cs = (FP.structures.get(x.item.structure) || {}).containers || {}; const vals = Object.keys(x.values || {}); return vals.length > 0 && vals.every(k => ['sum', 'count', 'list'].includes((cs[k] || {}).rule) || Object.values(cs).some(c => c && c.from === k && ['sum', 'count', 'list'].includes(c.rule)) && !(k in cs)); };
      const checked = plan.filter(x => x.seenAt && x.item && x.item.id != null && !adds(x));
      if (!checked.length) return true;
      FP.current.clearCache();
      const hits = [];
      for (const x of checked) {
        const now = await FP.current.item(x.item.structure, String(x.item.id)).catch(() => null);
        if (now && now.lastAt && now.lastAt > x.seenAt) hits.push({ spec: x, now, who: await whoDid(now) });
      }
      if (!hits.length) return true;
      const answer = await new Promise(resolve => {
        const veil = el('div', 'fpf-veil');
        const box = el('div', 'fpf-dialog');
        box.appendChild(el('h3', null, hits.length === 1 ? `${hits[0].spec.item.id} changed since you opened it` : `${hits.length} records changed since you opened them`));
        const both = el('div', 'fpf-both');
        both.hidden = true;
        hits.forEach(h => {
          box.appendChild(el('p', null, `${FP.structures.get(h.spec.item.structure) ? (FP.structures.get(h.spec.item.structure).label || h.spec.item.structure) : h.spec.item.structure} ${h.spec.item.id}: saved by ${h.who}.`));
          const t = el('table');
          const head = el('tr'); ['', 'Theirs now', 'Yours'].forEach(x => head.appendChild(el('th', null, x))); t.appendChild(head);
          Object.entries(h.spec.values || {}).forEach(([k, mine]) => {
            const theirs = (h.now.values || {})[k];
            const tr = el('tr', JSON.stringify(theirs) === JSON.stringify(mine) ? 'same' : 'diff');
            const f = fields.find(x => x.writes && target(x.writes) && target(x.writes).container === k);
            const fmt = v => (v == null ? '—' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v));
            tr.append(el('td', null, (f && (f.label || f.name)) || k), el('td', null, fmt(theirs)), el('td', null, fmt(mine)));
            t.appendChild(tr);
          });
          both.appendChild(t);
        });
        const row = el('div', 'fpf-dialog-btns');
        const keep = el('button', 'fpf-btn', 'Keep theirs'); keep.type = 'button';
        const mine = el('button', 'fpf-save', 'Save mine over it'); mine.type = 'button';
        const see = el('button', 'fpf-link', 'See both'); see.type = 'button';
        see.onclick = () => { both.hidden = !both.hidden; see.textContent = both.hidden ? 'See both' : 'Hide'; };
        const end = a => { veil.remove(); resolve(a); };
        keep.onclick = () => end('theirs');
        mine.onclick = () => end('mine');
        row.append(see, keep, mine);
        box.append(both, row);
        veil.appendChild(box);
        root.appendChild(veil);
        mine.focus();
      });
      if (answer === 'mine') return true;
      // Theirs: the fields that save to those items show what they hold now.
      hits.forEach(h => {
        const st = h.spec.item.structure;
        fields.filter(f => isEntry(f) && f.writes && target(f.writes) && realSt(target(f.writes).structure) === st && Object.prototype.hasOwnProperty.call(h.spec.values || {}, target(f.writes).container))
          .forEach(f => { const v = (h.now.values || {})[target(f.writes).container]; ui[f.name].control.set(v == null ? null : v); });
        seenAt.set(`${st}|${h.spec.item.id}`, h.now.lastAt);
      });
      await recalc();
      paintFoot(problemsNow(), `Not saved: what ${hits.map(h => h.who.split(' on ')[0].split(' at ')[0]).join(', ')} saved is back on screen.`);
      return false;
    }

    /* ---------- Sub-forms (master side) ---------- */
    function subValues() {
      const o = {};
      subforms.forEach(x => {
        const runs = runsOf[x.name].filter(r => r && r.how !== 'skipped');
        o[x.name] = repeatKind(x) === 'once' ? (runs[0] ? runs[0].values : FP.fn.NODATA) : runs.map(r => r.values);
      });
      return o;
    }
    function allValues() { return Object.assign(outerVals(), subValues(), withSources(Object.assign(entryValues(), display)), selNow); }
    // Records a sub-form saved on its own that point at this record, which isn't saved yet.
    function ownSavedRuns() { return subforms.flatMap(x => runsOf[x.name].filter(r => r && r.how === 'saved' && r.linked).map(r => Object.assign({ label: x.label || x.name }, r))); }
    function writesAnything() { return fields.some(f => (isEntry(f) && (f.writes || f.rowsFrom)) || f.snapshot); }
    // Which of this form's items a sub-form's records point to: its link, or the first item this form saves.
    function subLinkKey(sf) {
      if (sf.link) return Object.keys(def.items || {}).find(k => k === sf.link || k.split('~')[1] === sf.link || realSt(k) === sf.link) || null;
      return Object.keys(def.items || {}).find(k => fields.some(f => f.writes && target(f.writes) && target(f.writes).structure === k)) || null;
    }
    /* A sub-form that repeats over a list or a count is planned again whenever the form changes (0.44.5), so its
     * button and Save always count against the list as it is now. A list's runs follow their item: a line added
     * gets a run to do, a line taken out loses its run (and the records waiting with it); one already saved stays. */
    async function stepsOf(sf) {
      const kind = repeatKind(sf);
      const v = await FP.fn.evaluateAsync(kind === 'list' ? String(sf.repeat.list) : String(sf.repeat.count), allValues(), opts.asOf ? { asOf: opts.asOf } : {}).catch(() => null);
      return kind === 'list'
        ? (Array.isArray(v) ? v : []).map((x, i) => ({ index: i + 1, each: x }))
        : Array.from({ length: typeof v === 'number' && isFinite(v) ? Math.max(0, Math.min(500, Math.floor(v))) : 0 }, (_, i) => ({ index: i + 1 }));
    }
    const plannedEach = {};
    const eachText = x => (x && typeof x === 'object' ? String(x.$id || x.id || x.label || '') : String(x));
    function replan(sf, steps) {
      plannedOf[sf.name] = steps.length;
      plannedEach[sf.name] = steps.map(st => st.each);
      if (repeatKind(sf) !== 'list') return [];
      const runs = runsOf[sf.name];
      const key = x => JSON.stringify(x === undefined ? null : x);
      const next = [], from = new Map(), used = new Set();
      steps.forEach((st, i) => {
        const j = runs.findIndex((r, k) => r && !used.has(k) && key(r.each) === key(st.each));
        if (j >= 0) { used.add(j); next[i] = runs[j]; from.set(j + 1, i + 1); }
      });
      const gone = [];
      runs.forEach((r, k) => { if (r && !used.has(k) && r.how !== 'saved' && r.how !== 'skipped') gone.push(r.each); });
      for (let i = queue.length - 1; i >= 0; i--) {
        const q = queue[i];
        if (q.sub !== sf.name) continue;
        if (from.has(q.index)) q.index = from.get(q.index); else queue.splice(i, 1);
      }
      runsOf[sf.name] = next;
      return gone;
    }
    async function planSubs() {
      for (const sf of subforms) {
        const kind = repeatKind(sf);
        if (kind !== 'list' && kind !== 'count') continue;
        const gone = replan(sf, await stepsOf(sf));
        if (gone.length) {
          toast(`${gone.map(eachText).join(', ')}: no longer in ${sf.label || sf.name}, so ${gone.length === 1 ? 'its' : 'their'} entry is dropped.`);
          applyBackSub(sf);
          paintQueue();
        }
      }
      paintSubStates();
    }
    function subNeeded() {
      for (const sf of subforms) {
        if (!sf.required) continue;
        const kind0 = repeatKind(sf);
        const done = (kind0 === 'list' || kind0 === 'count') && plannedOf[sf.name] != null ? runsOf[sf.name].slice(0, plannedOf[sf.name]).filter(Boolean).length : runsOf[sf.name].filter(Boolean).length;
        if ((kind0 === 'list' || kind0 === 'count') && plannedOf[sf.name] === 0) return `${sf.label || sf.name}: nothing to do yet (its list is empty).`;
        const kind = repeatKind(sf);
        const name = sf.label || sf.name;
        if (!done) return `Do ${name} first.`;
        if (kind === 'list' && plannedEach[sf.name] && done < plannedOf[sf.name]) {
          const left = plannedEach[sf.name].filter((x, i) => !runsOf[sf.name][i]).map(eachText).filter(Boolean);
          if (left.length) return `${name}: still to do for ${left.join(', ')}.`;
        }
        if ((kind === 'count' || kind === 'list') && plannedOf[sf.name] && done < plannedOf[sf.name]) return `${name}: ${done} of ${plannedOf[sf.name]} done.`;
      }
      return null;
    }
    function paintSubStates() {
      buttons.filter(b => b.action === 'subform' && b.state).forEach(b => {
        const sf = subByName.get(b.subform);
        if (!sf) return;
        const kind = repeatKind(sf);
        const runs = (plannedOf[sf.name] != null && kind !== 'open' && kind !== 'once' ? runsOf[sf.name].slice(0, plannedOf[sf.name]) : runsOf[sf.name]).filter(Boolean);
        const savedN = runs.filter(r => r.how === 'saved').length;
        let t = '';
        if (kind === 'once') t = !runs.length ? (sf.required ? 'To do' : '') : savedN ? 'Saved' : runs[0].how === 'held' ? 'Done · saved with this' : 'Done';
        else if (plannedOf[sf.name] && kind !== 'open') { const sk = runs.filter(r => r.how === 'skipped').length; t = `${runs.length} of ${plannedOf[sf.name]} done${sk ? ` (${sk} skipped)` : ''}`; }
        else t = runs.length ? `${runs.length} done` : (sf.required ? 'To do' : '');
        b.state.textContent = t;
        b.state.hidden = !t;
      });
    }
    const NUMS = l => l.filter(x => typeof x === 'number' && isFinite(x));
    function reduceList(how, l) {
      const n = NUMS(l);
      switch (how) {
        case 'first': return l.length ? l[0] : null;
        case 'last': return l.length ? l[l.length - 1] : null;
        case 'avg': return n.length ? Math.round(n.reduce((a, b) => a + b, 0) / n.length * 1e9) / 1e9 : null;
        case 'min': return n.length ? Math.min.apply(null, n) : null;
        case 'max': return n.length ? Math.max.apply(null, n) : null;
        case 'sum': return n.length ? Math.round(n.reduce((a, b) => a + b, 0) * 1e9) / 1e9 : null;
        case 'count': return l.length;
        case 'join': return l.length ? l.map(x => (Array.isArray(x) ? x.join(' ') : String(x))).join(', ') : null;
        case 'all': return l.length ? (l.every(Array.isArray) ? [].concat(...l) : l) : null;
        default: return l.length ? l[l.length - 1] : null;
      }
    }
    // The values a sub-form sends back, worked out again from all its runs.
    function applyBackSub(sf) {
      if (!sf) return;
      const runs = runsOf[sf.name].filter(r => r && r.how !== 'skipped');
      const once = repeatKind(sf) === 'once';
      (sf.back || []).forEach(p => {
        if (!ui[p.to] || !ui[p.to].control) return;
        const ok = x => !blank(x) && !(x && typeof x === 'object' && x.__fp);
        let v;
        if (once) v = runs[0] ? runs[0].values[p.from] : null;
        else v = reduceList(p.how || 'last', runs.map(r => r.values[p.from]).filter(ok));
        if (!ok(v)) v = null;
        ui[p.to].control.set(v);
        changed(p.to);
      });
      paintFoot(problemsNow());
    }
    async function subTitle(sf, st) {
      const name = sf.label || sf.name;
      if (!sf.title) return name;
      const v = await FP.fn.evaluateAsync(String(sf.title), Object.assign(allValues(), { each: st.each === undefined ? FP.fn.NODATA : st.each, index: st.index }), opts.asOf ? { asOf: opts.asOf } : {}).catch(() => null);
      return v == null || typeof v === 'object' || v === '' ? name : String(v);
    }
    /* Open a sub-form: once, a run per count or list item (starting at the first not done), or as many as needed. */
    async function openSubform(sf) {
      if (!sf) throw new Error('there is no such sub-form');
      const kind = repeatKind(sf);
      const since = new Date().toISOString();
      if (kind === 'once') { await openRun(sf, { index: 1 }, { since, of: 1 }); return; }
      if (kind === 'open') {
        let i = runsOf[sf.name].length;
        while ((await openRun(sf, { index: i + 1 }, { since, of: null })) === 'next') i++;
        return;
      }
      await recalc();
      const steps = await stepsOf(sf);
      if (!steps.length) { paintFoot(problemsNow(), `${sf.label || sf.name}: ${kind === 'list' ? 'the list is empty' : 'how many is 0, or not worked out yet'}, so there is nothing to do.`); return; }
      replan(sf, steps);
      const runs = runsOf[sf.name];
      // Start at the first not done (a line added since); with every one done, go through them again.
      let at = steps.findIndex(x => !runs[x.index - 1]);
      const again = at < 0;   // all done: go through them again; otherwise only the ones still to do
      for (let k = again ? 0 : at; k < steps.length; k++) {
        if (!again && runsOf[sf.name][k]) continue;
        if ((await openRun(sf, steps[k], { since, of: steps.length })) !== 'next') break;
      }
      paintFoot(problemsNow());
    }
    async function editRun(sf, index) {
      const r = runsOf[sf.name][index - 1];
      await openRun(sf, { index, each: r ? r.each : undefined }, { since: new Date().toISOString(), of: plannedOf[sf.name] || null, alone: true });
    }
    /* One run of a sub-form, over this form. Resolves 'next' (done or saved), 'stop' (went back) or 'finish'. */
    async function openRun(sf, st, o) {
      const mode = sf.saves === 'own' ? 'own' : 'with';
      const kind = repeatKind(sf);
      const sdef = subDef(doc.def, sf);
      const saves = (sdef.fields || []).some(f => f && (f.writes || f.snapshot));
      const btns = [{ name: '__main', label: mode === 'own' && saves ? (kind === 'open' && !o.alone ? 'Save and add another' : 'Save') : (kind === 'open' && !o.alone ? 'Done, add another' : 'Done'), action: mode === 'own' && saves ? 'save' : 'apply' }];
      if (kind === 'open' && !o.alone) btns.unshift({ name: '__finish', label: 'Finish', action: 'finish' });
      let link = null;
      const key = subLinkKey(sf);
      if (key) {
        try { const id = await itemIdFor(key); link = { role: realSt(key), id, exists: !!(await FP.current.item(realSt(key), id).catch(() => null)) }; }
        catch (e) { link = null; }
      }
      const prev = runsOf[sf.name][st.index - 1];
      const head = await subTitle(sf, st);
      const shown = head + (o.of > 1 ? ` (${st.index} of ${o.of})` : kind === 'open' && st.index > 1 ? ` (${st.index})` : '');
      return new Promise((resolve, reject) => {
        let settled = false;
        const done = r => { if (!settled) { settled = true; resolve(r); } };
        const sheet = el('div', 'fpf-sheet');
        const crumbs = el('div', 'fpf-crumbs');
        const body = el('div', 'fpf-sheet-body');
        if (density === 'compact') body.classList.add('wide');
        const hostEl = el('div');
        body.appendChild(hostEl);
        sheet.append(crumbs, body);
        document.body.appendChild(sheet);
        let child = null;
        const close = force => {
          if (!force && child && child.isDirty() && !confirm(`Leave ${shown} without finishing it? What you typed there is lost.`)) return false;
          if (child) child.destroy();
          if (activeChild === child) activeChild = null;
          sheet.remove();
          const li = LEVELS.indexOf(level);
          if (li >= 0) LEVELS.splice(li, 1);
          recalc();
          return true;
        };
        const level = { close: force => { const ok = close(force); if (ok) done('stop'); return ok; } };
        LEVELS.push(level);
        const names = trail.concat([title]);
        const back = el('button', 'back', '‹ Back'); back.type = 'button';
        back.onclick = () => level.close(false);
        crumbs.appendChild(back);
        names.forEach((n, i) => {
          const c = el('button', null, n); c.type = 'button';
          c.onclick = () => closeAbove(LEVELS.indexOf(level) - (names.length - i));
          crumbs.append(c, el('span', 'sep', '›'));
        });
        crumbs.appendChild(el('span', 'here', shown));
        open(hostEl, `${formId}.${sf.name}`, {
          def: Object.assign({}, sdef, { title: shown }), prefill: prev ? prev.input : {}, draft: false, restoreDraft: false, trail: names, asOf: opts.asOf,
          formRef: { id: formRef.id, version: formRef.version, sub: sf.name },
          ids: prev ? prev.ids : null, site: opts.site, density, keyboard,
          sub: { outer: allValues, each: st.each, index: st.index, since: o.since,
            others: () => runsOf[sf.name].map((r, i) => (r && i !== st.index - 1 && r.how !== 'skipped' ? Object.assign({}, r.input || {}, { $each: r.each === undefined ? null : r.each, $index: i + 1 }) : null)).filter(Boolean), buttons: btns, approval: !!def.approval, title: `${title} › ${shown}`, skip: () => {
            // Someone else saw to it: it counts as done, and sends nothing back.
            runsOf[sf.name][st.index - 1] = { values: {}, input: {}, ids: {}, how: 'skipped', each: st.each, at: new Date().toISOString() };
            applyBackSub(sf);
            close(true); done('next');
          } },
          parent: {
            title: shown, link, canApply: true, holdAlways: mode === 'with',
            applyBack: (vals, info) => {
              info = info || {};
              runsOf[sf.name][st.index - 1] = { values: vals, input: info.input || {}, ids: info.ids || {}, how: info.how || 'done', each: st.each, at: new Date().toISOString(), linked: !!(link && !link.exists) };
              applyBackSub(sf);
              recalc();
            },
            hold: item => {
              item.sub = sf.name; item.index = st.index; item.title = shown;
              const i = queue.findIndex(q => q.sub === sf.name && q.index === st.index);
              if (i >= 0) queue.splice(i, 1, item); else queue.push(item);
              dirty = true;
              paintQueue();
            },
            finish: () => { close(true); done('finish'); },
            close: force => { if (close(force)) done('next'); },
          },
        }).then(c => { child = c; activeChild = c; }).catch(e => { sheet.remove(); const li = LEVELS.indexOf(level); if (li >= 0) LEVELS.splice(li, 1); settled = true; reject(e); });
      });
    }

    function toast(text, saved) {
      document.querySelectorAll('.fpf-toast.saved').forEach(x => x.remove());
      const t = el('div', 'fpf-toast' + (saved ? ' saved' : ''), (saved ? '✓ ' : '') + text);
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
      setTimeout(() => t.remove(), saved ? 3500 : 1800);
    }
    // The saved message (0.46) can name what was saved: 'Check saved: {run}, {slot}' shows the values as they read on screen.
    function savedText(msg, snap) {
      return String(msg).replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, n) => {
        const f = byName.get(n);
        if (!f) return m;
        const v = snap && snap.values && n in snap.values ? snap.values[n] : display[n];
        if (blank(v)) return '—';
        const t = isEntry(f) ? shownOf(f, v) : v;
        return typeof t === 'object' ? m : String(t).replace(/ \((late|due)\)$/, '');
      });
    }

    // Forms with charts reload their data every few minutes (refresh, in minutes).
    const refreshMin = def.refresh != null ? def.refresh : fields.some(isVisual) ? 5 : 0;
    const refresher = refreshMin > 0 ? setInterval(() => { if (!saving && document.visibilityState !== 'hidden') { FP.current.clearCache(); recalc(); } }, refreshMin * 60000) : null;
    const beforeUnload = e => { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    // The line this terminal works on changed (0.60): HERE() moves, and what follows it with it.
    const hereMoved = () => { if (!saving) recalc(); };
    window.addEventListener('fp-here', hereMoved);

    // Starting values: prefill from the caller, then an unsaved draft from this device.
    const draft = opts.restoreDraft === false || opts.draft === false ? null : await FP.kv.get(draftKey).catch(() => null);
    const start = Object.assign({}, draft ? draft.values : {}, opts.prefill || {});
    fields.filter(isEntry).forEach(f => { if (start[f.name] !== undefined) { ui[f.name].control.set(start[f.name]); if (!blank(start[f.name])) personSet.add(f.name); } else if (f.default !== undefined) ui[f.name].control.set(f.default); });
    if (draft && Object.values(draft.values).some(v => !blank(v))) dirty = true;
    fields.forEach(f => { visible[f.name] = true; });
    await recalc();
    if (!opts.preview && !parent && !sub && FP.current.noteForm) FP.current.noteForm(formId, performance.now() - openedAt);
    // A run of a sub-form: an item it reads was changed on another terminal since the pass began.
    if (sub && sub.since) {
      const me = FP.identity.terminalId;
      const hit = Object.values(srcValues).find(v => v && typeof v === 'object' && !Array.isArray(v) && v.$at && v.$at > sub.since && v.$terminal && v.$terminal !== me);
      if (hit) {
        const box = el('div', 'fpf-notice');
        box.appendChild(el('div', null, `${hit.$id} was changed by ${await whoDid({ lastUserId: hit.$by, lastTerminalId: hit.$terminal, lastAt: hit.$at })} since you started.`));
        const row = el('div', 'fpf-dialog-btns');
        const skip = el('button', 'fpf-save', 'Skip it'); skip.type = 'button';
        const anyway = el('button', 'fpf-btn', 'Add mine anyway'); anyway.type = 'button';
        skip.onclick = () => sub.skip();
        anyway.onclick = () => box.remove();
        row.append(skip, anyway);
        box.appendChild(row);
        root.insertBefore(box, root.firstChild);
      }
    }
    // Start on the first field to fill in, without skipping ahead of the first step.
    const first = order.find(n => isEntry(byName.get(n)) && visible[n] && blank(ui[n].control.get()) && (!stepper || !stepOf(n) || stepOf(n) === stepper.items[stepper.at]));
    paintLayout();
    if (first && opts.focus !== false) { reveal(first); ui[first].control.focus(); }

    return {
      id: formId, version: doc.version, def,
      values: () => Object.assign(entryValues(), display),
      set(name, v) { if (ui[name] && ui[name].control) { ui[name].control.set(v); changed(name); } },
      /* Save: the first save button covering the whole form (or the first save button). */
      save: () => { const b = buttons.find(x => x.action === 'save' && !scopeOf(x)) || buttons.find(x => x.action === 'save'); return b ? runSave(b) : null; },
      press: name => (btnByName.has(name) ? press(btnByName.get(name)) : Promise.reject(new Error(`No button ${name}`))),
      buttons: () => buttons.map(b => ({ name: b.name, label: b.text.textContent, action: b.action, shown: !b.el.hidden, enabled: !b.el.disabled, unsaved: b.dot ? !b.dot.hidden : false })),
      waiting: () => queue.map(q => ({ title: q.title, summary: q.summary, sub: q.sub || null, index: q.index || null })),
      /* Sub-forms: how far each has got ({ name: [{ index, how, values }] }), and opening one as its button would. */
      runs: () => Object.fromEntries(subforms.map(x => [x.name, runsOf[x.name].map((r, i) => (r ? { index: i + 1, how: r.how, values: r.values } : null)).filter(Boolean)])),
      openSubform: name => openSubform(subByName.get(name)),
      recalc,
      isDirty,
      problems: () => problemsNow(),
      /* Layout state: the step showing ({ index, label, of }) and each tab set's tab. */
      where: () => ({
        step: stepper ? { index: stepper.at, label: stepper.items[stepper.at].label, of: live(stepper).length } : null,
        tabs: Array.from(new Set(blocks.filter(b => b.kind === 'tab').map(b => b.set))).map(s => s.items[s.at].label),
      }),
      next: () => nextStep(1),
      back: () => nextStep(-1),
      reveal: name => reveal(name),
      refresh: () => { FP.current.clearCache(); return recalc(); },
      /* Print the record on screen ('record') or a blank form ('blank'). */
      print: (mode, how) => print(mode, how),
      printParts: (mode, tree, seen) => printParts(mode, tree, seen),
      canPrint: () => !!def.print,
      /* Whether this form opens others, so printing "with everything linked" means something. */
      hasTree,
      /* What must be read before starting: [{ title, revision, done, every }]. */
      readingList: () => ackItems.map(x => ({ key: x.key, title: x.title, revision: x.revision || null, every: x.every, done: x.done })),
      destroy() {
        clearTimeout(timer);
        if (refresher) clearInterval(refresher);
        Object.values(ui).forEach(u => u.resize && u.resize.disconnect());
        window.removeEventListener('beforeunload', beforeUnload);
        window.removeEventListener('fp-here', hereMoved);
        host.replaceChildren();
      },
    };
  }

  FP.forms = {
    get ENTRY() { return entryControls(); }, DISPLAY, check, open, show,
    /* Sub-forms (0.40), for the editor: the form a sub-form runs as, whether a value sent back fits, how it repeats. */
    subDef, backFits, repeatKind, HOWS, HOW_LABEL, kindOfField,
    /* Register a control. describe says what it is and the settings it takes (see the catalog above). */
    register(name, spec) {
      if (BASIC.includes(name) || DISPLAY.includes(name)) throw new Error(`${name} is a built-in control`);
      const d = spec.describe || {};
      const category = d.category || (spec.render ? 'visual' : 'entry');
      if (category === 'entry' && typeof spec.make !== 'function') throw new Error(`${name}: an entry control needs make`);
      if (category === 'visual' && typeof spec.render !== 'function') throw new Error(`${name}: a visual control needs render`);
      CONTROLS[name] = Object.assign({}, spec, { describe: Object.assign({ label: name, settings: [] }, d, { category }) });
    },
    /* The catalog, for an editor: every control with its category, what it saves or shows, and its
     * settings, the common ones included. */
    controls() {
      const names = BASIC.concat(DISPLAY.filter(n => !BASIC.includes(n)), Object.keys(CONTROLS));
      const out = names.map(n => { const d = describe(n); return Object.assign({}, d, { settings: settingsFor({ control: n }) }); });
      return out;
    },
    describe,
    formSettings: () => FORM_SETTINGS.slice(),
    /* The form's plain settings (0.50): one value each, in the order the editor lists them. */
    plainFormSettings: () => FORM_SETTINGS.filter(x => ['text', 'boolean', 'integer', 'number', 'choice'].includes(x.type) && !['title', 'action'].includes(x.name)).map(x => x.name),
    formulasOf,
    TONES,
    /* Saved records: on screen (an element) and printed. row: one of FP.current's rows. */
    recordPart: (row, opts) => { if (!document.getElementById('fp-forms-css')) { const s2 = el('style'); s2.id = 'fp-forms-css'; s2.textContent = CSS; document.head.appendChild(s2); } return recordPart(row, opts); },
    printRecord,
  };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-forms'] = '0.62.0';
})();
