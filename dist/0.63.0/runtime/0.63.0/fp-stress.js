/* Form Platform: stress test (0.53)
 * Load after fp-help.js, before fp-admin.js (the editor only). Admin › Stress test, on a data folder marked as a
 * test folder: it tries every part of the platform hard, on this computer and its real folder and sync, and keeps
 * a report to download and send.
 *
 * Suites, each a list of tests that pass, warn (slow, or a soft problem) or fail (something broke):
 *   Formulas     deep and long formulas, big lists, every kind of mistake, random formulas, function chains
 *   Definitions  a giant form, a catalogue of broken definitions that must be refused, a corrupted library file,
 *                many definitions at once
 *   Orphans      items, structures, functions and forms taken away from under what uses them
 *   Pressure     typing, saving and opening as fast as a form can be hit; saving offline; two forms on one item
 *   Files        damaged data files: garbage lines, a changed line, a line twice, a version from the future
 *   Volume       a year of the plant (about 140,000 entries across 9 lines and two shifts a day), then loading,
 *                checkpoints, lookups, a board and the chain checks over it
 *
 * Each result says what the folder cost while it ran (reads, lists, writes, and how many were tried again because a
 * synced folder had the file busy or changed under it: 0.53.2).
 *
 * Everything it makes is named zz-stress…, so it is easy to tell apart; the volume data is real files. Purge all
 * data (on a test folder) clears it. Nothing here runs anywhere but a test folder. */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.defs || !FP.forms || !FP.current) throw new Error('Load the kernel before fp-stress.js');

  const P = 'zz-stress';
  const tests = [];
  const SUITES = [
    ['formulas', 'Formulas', 'deep, long and broken formulas; big lists; random formulas; function chains'],
    ['definitions', 'Definitions', 'a giant form; broken definitions that must be refused; a damaged library file'],
    ['orphans', 'Orphans', 'what happens when what a form uses is taken away'],
    ['pressure', 'Pressure', 'typing, saving and opening as fast as possible; offline; two forms on one item'],
    ['files', 'Files', 'damaged data files'],
    ['volume', 'Volume', 'a year of the plant (about 140,000 entries): slow, 10–40 minutes; a stopped run carries on where it stopped'],
  ];
  const T = (suite, id, title, run) => tests.push({ suite, id, title, run });

  /* ---------- Helpers ---------- */
  const now = () => performance.now();
  const idle = ms => new Promise(r => setTimeout(r, ms || 0));
  const round = (x, d) => Math.round(x * Math.pow(10, d || 0)) / Math.pow(10, d || 0);
  const ms = x => (x < 1000 ? `${Math.round(x)} ms` : `${round(x / 1000, 1)} s`);
  const isInternal = e => e && (e instanceof TypeError || e instanceof RangeError || e instanceof ReferenceError || e instanceof SyntaxError);
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const dayOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const special = v => !!(v && typeof v === 'object' && v.__fp);
  let cancelled = false;
  const checkCancel = () => { if (cancelled) throw new Error('Stopped'); };
  let say = () => {};     // progress line, set by the runner
  let bench = null;       // where forms open while being tested
  let runOpts = {};       // the run's options (days: a shorter year, for the platform's own tests)

  // Publish (a new version of one already here, when the test runs again).
  // Forms are written with sources (0.48), even when they have none.
  const pub = (kind, id, def, opts) => { const cur = FP.defs.get(kind, id); return FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, kind === 'form' && def && !def.sources ? { sources: [] } : {}, def), Object.assign({ note: 'stress test', basedOn: cur ? cur.version : null }, opts || {})); };
  async function refused(kind, id, def) {
    try { await pub(kind, id, def); return { took: true }; } catch (e) { return { took: false, message: e.message, internal: isInternal(e) }; }
  }
  const retire = (kind, id, force) => { const cur = FP.defs.get(kind, id); return FP.defs.retire(kind, id, { force: !!force, basedOn: cur ? cur.version : null }); };
  async function retireQuietly(kind, id) { try { if (FP.defs.get(kind, id) && !FP.defs.get(kind, id).retired) await retire(kind, id, true); } catch (_) { /* best effort */ } }
  async function fresh(structure, opts) { FP.current.clearCache(); return FP.current.load(structure, Object.assign({ fresh: true }, opts || {})); }
  /* What the folder cost between two moments (0.53.2): on a synced folder, slow loads are often slow reads. */
  const ioNow = () => Object.assign({}, FP.files.io || {});
  function ioSince(a) {
    const b = ioNow(), d = k => (b[k] || 0) - (a[k] || 0);
    const parts = [`${d('reads')} reads ${ms(d('readMs'))}`, `${d('lists')} lists ${ms(d('listMs'))}`];
    if (d('writes')) parts.push(`${d('writes')} writes ${ms(d('writeMs'))}`);
    if (d('retries')) parts.push(`${d('retries')} retried`);
    return parts.join(', ');
  }
  async function timedLoad(structure, opts) { const a = ioNow(), t0 = now(); const r = await fresh(structure, opts); return { r, t: now() - t0, io: ioSince(a) }; }
  async function openForm(id, opts) {
    const host = document.createElement('div');
    host.className = 'fps-form';
    bench.replaceChildren(host);
    const t0 = now();
    const inst = await FP.forms.open(host, id, Object.assign({ draft: false }, opts || {}));
    return { inst, host, openMs: now() - t0 };
  }
  // Wait for a form to stop working things out: its values stop changing for a moment.
  async function settle(inst, quietMs) {
    let last = '', same = 0;
    for (let i = 0; i < 400; i++) {
      await idle(50);
      const v = JSON.stringify(inst.values());
      if (v === last) { same += 50; if (same >= (quietMs || 400)) return; } else { same = 0; last = v; }
    }
  }
  // Errors the page reports while a test runs (an uncaught error is a failure whatever the test says).
  const caught = [];
  window.addEventListener('error', e => { if (running) caught.push(e.message || String(e.error)); });
  window.addEventListener('unhandledrejection', e => { if (running) caught.push('Unhandled: ' + (e.reason && e.reason.message || e.reason)); });
  let running = false;

  /* ================= Formulas ================= */
  const ev = (f, inputs) => { try { return { v: FP.fn.evaluate(f, inputs || {}) }; } catch (e) { return { threw: e }; } };
  const evA = async (f, inputs) => { try { return { v: await FP.fn.evaluateAsync(f, inputs || {}) }; } catch (e) { return { threw: e }; } };

  T('formulas', 'deep', 'Formulas nested 50, 200, 1,000 and 5,000 deep', async () => {
    const out = [];
    let worst = 'pass';
    for (const n of [50, 200, 1000, 5000]) {
      const f = 'IF(TRUE, '.repeat(n) + '1' + ', 0)'.repeat(n);
      const t0 = now();
      const r = ev(f);
      const t = now() - t0;
      if (r.threw) { out.push(`${n}: threw ${r.threw.name}: ${r.threw.message}`); worst = isInternal(r.threw) ? 'fail' : worst; }
      else if (r.v === 1) out.push(`${n}: 1 in ${ms(t)}`);
      else if (special(r.v)) out.push(`${n}: refused (${r.v.message || r.v.__fp}) in ${ms(t)}`);
      else { out.push(`${n}: gave ${JSON.stringify(r.v)}`); worst = 'fail'; }
      if (t > 3000 && worst === 'pass') worst = 'warn';
      await idle();
    }
    return { result: worst, detail: out.join(' · ') };
  });

  T('formulas', 'long', 'Formulas of 150 and 20,000 terms', async () => {
    const out = []; let worst = 'pass';
    for (const n of [150, 20000]) {
      const f = '1' + ' + 1'.repeat(n - 1);
      const t0 = now(); const r = ev(f); const t = now() - t0;
      if (r.threw) { out.push(`${n}: threw ${r.threw.name}: ${r.threw.message}`); worst = 'fail'; continue; }
      if (r.v === n) out.push(`${n}: ${n} in ${ms(t)}`);
      else if (special(r.v) && n > 200) out.push(`${n}: refused (${r.v.message})`);
      else { out.push(`${n}: gave ${JSON.stringify(special(r.v) ? r.v.message : r.v)}`); worst = 'fail'; }
    }
    return { result: worst, detail: out.join(' · ') };
  });

  T('formulas', 'lists', 'FILTER, EACH, SORT and UNIQUE over 50,000 items', async () => {
    const xs = Array.from({ length: 50000 }, (_, i) => ({ $id: 'X' + i, a: i, b: i % 7, c: 'Line ' + (i % 9 + 1), d: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString() }));
    const cases = [
      ['COUNT(FILTER(xs, item.b = 3))', 7143],
      ['SUM(EACH(xs, item.a))', 1249975000],
      ['COUNT(SORT(xs, item.c & "|" & item.a))', 50000],
      ['COUNT(UNIQUE(EACH(xs, item.c)))', 9],
      ['FIRST(SORT(FILTER(xs, item.b = 6), item.a, "desc")).a', 49993],
      ['COUNT(FILTER(xs, item.d >= "2026-01-20"))', null],
    ];
    const out = []; let worst = 'pass';
    for (const [f, want] of cases) {
      const t0 = now(); const r = await evA(f, { xs }); const t = now() - t0;
      if (r.threw) { out.push(`${f}: threw ${r.threw.message}`); worst = 'fail'; continue; }
      const okv = want == null ? typeof r.v === 'number' : r.v === want;
      if (!okv) worst = 'fail'; else if (t > 2000 && worst === 'pass') worst = 'warn';
      out.push(`${f.split('(')[0]}…: ${special(r.v) ? r.v.message : r.v} in ${ms(t)}`);
      await idle();
    }
    return { result: worst, detail: out.join(' · ') };
  });

  const MISTAKES = ['1/0', '"a" * 2', 'nosuch.field', 'NOSUCHFN(1)', 'IF(', ')))', '"unterminated', 'SUM(LIST(1, "x"))', 'DATEADD("bad", 1, "days")', 'TEXT(NOW(), 5)',
    'FILTER(1, item)', 'xs[999999]', 'xs["nope"].a', 'LIST()[0]', 'item.a', 'EACH(xs)', 'SORT()', 'IF(TRUE)', '1 +', '+', '"a" & ', '((((1))))', '1 = = 1', 'AND()', 'OR(1, "x")',
    'NOT(LIST(1,2))', 'ROUND("x", 2)', 'MAX()', 'MIN(LIST())', 'AVERAGE(LIST())', 'COUNT(5)', 'JOIN(5, ",")', 'STARTOF("x", "hour")', 'DATEDIFF(NOW(), "x", "hours")', 'FIRST(5)', 'LAST(LIST())',
    'COALESCE()', 'IN(1, 5)', 'TEXT("x", "0.0")', '1e999 * 1e999', '-(-(-1))', '"' + 'x'.repeat(100000) + '"', 'LIST(' + Array(5000).fill('1').join(',') + ')', 'xs.a.b.c.d', '$id', 'item', 'form.x', 'USER()', 'NOW() + 1'];
  T('formulas', 'mistakes', `${MISTAKES.length} kinds of mistake give an answer or a message, never a crash`, async () => {
    const xs = [{ $id: 'A', a: 1 }, { $id: 'B', a: 2 }];
    const bad = [];
    for (const f of MISTAKES) {
      for (const which of ['sync', 'async']) {
        const r = which === 'sync' ? ev(f, { xs }) : await evA(f, { xs });
        if (r.threw && (isInternal(r.threw) || !(r.threw instanceof Error))) bad.push(`${f.slice(0, 40)} (${which}): ${r.threw.name || 'thrown'} ${r.threw.message || r.threw}`);
      }
      try { FP.fn.syntax(f); } catch (e) { bad.push(`syntax ${f.slice(0, 40)}: ${e.name} ${e.message}`); }
    }
    return { result: bad.length ? 'fail' : 'pass', detail: bad.length ? `Internal errors: ${bad.slice(0, 6).join(' | ')}${bad.length > 6 ? ` and ${bad.length - 6} more` : ''}` : `${MISTAKES.length * 2} evaluations, each an answer or a message` };
  });

  T('formulas', 'fuzz', '3,000 random formulas, sense and nonsense', async () => {
    const atoms = ['1', '2.5', '"x"', '""', 'TRUE', 'FALSE', 'n', 's', 'xs', 'item', 'item.a', 'xs.a', 'NOW()', 'TODAY()', 'LIST()', 'LIST(1,2,3)', 'xs[0]', 'missing', '$id', '-1', '0'];
    const fns = ['IF', 'AND', 'OR', 'NOT', 'SUM', 'COUNT', 'MAX', 'MIN', 'ROUND', 'TEXT', 'COALESCE', 'ISBLANK', 'FIRST', 'LAST', 'FILTER', 'EACH', 'SORT', 'UNIQUE', 'JOIN', 'IN', 'DATEADD', 'DATEDIFF', 'STARTOF', 'HOUR', 'AVERAGE', 'NOSUCH'];
    const ops = [' + ', ' - ', ' * ', ' / ', ' & ', ' = ', ' <> ', ' < ', ' >= ', '^'];
    let seed = 12345;
    const rnd = n => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
    const gen = d => {
      if (d > 5 || rnd(3) === 0) return atoms[rnd(atoms.length)];
      const k = rnd(10);
      if (k < 4) return `${fns[rnd(fns.length)]}(${Array.from({ length: rnd(4) }, () => gen(d + 1)).join(', ')})`;
      if (k < 8) return gen(d + 1) + ops[rnd(ops.length)] + gen(d + 1);
      if (k < 9) return `(${gen(d + 1)})`;
      return gen(d + 1) + ['(', ')', ',', '"', '[', '.'][rnd(6)];   // damage
    };
    const inputs = { n: 5, s: 'abc', xs: [{ $id: 'A', a: 1 }, { $id: 'B', a: null }] };
    const bad = []; let errors = 0, values = 0;
    const t0 = now();
    for (let i = 0; i < 3000; i++) {
      const f = gen(0);
      const r = await evA(f, inputs);
      if (r.threw) { if (isInternal(r.threw) || !(r.threw instanceof Error)) bad.push(`${f.slice(0, 60)} → ${r.threw.name}: ${r.threw.message}`); }
      else if (special(r.v)) errors++; else values++;
      if (i % 200 === 0) { await idle(); checkCancel(); }
    }
    return { result: bad.length ? 'fail' : 'pass', detail: bad.length ? `${bad.length} internal errors, e.g. ${bad.slice(0, 4).join(' | ')}` : `${values} values, ${errors} messages, no crash, in ${ms(now() - t0)}` };
  });

  T('formulas', 'chains', 'Functions calling functions: too deep, and calling each other', async () => {
    const out = []; let worst = 'pass';
    const fn = (name, formula) => ({ label: name, output: 'number', inputs: [{ name: 'x', type: 'number', required: false }], formula });
    // A chain 6 deep: the limit is 4, so the deepest must be refused, the shallow ones published.
    const names = Array.from({ length: 6 }, (_, i) => `ZzStressChain${i + 1}`);
    const took = [];
    for (let i = names.length - 1; i >= 0; i--) {
      const f = i === names.length - 1 ? 'COALESCE(x, 0) + 1' : `${names[i + 1]}(x) + 1`;
      const r = await refused('function', names[i], fn(names[i], f));
      took.push(`${names[i]} ${r.took ? 'published' : 'refused'}`);
      if (r.internal) worst = 'fail';
    }
    out.push(took.reverse().join(', '));
    if (FP.defs.get('function', names[0]) && !FP.defs.get('function', names[0]).retired) { worst = 'fail'; out.push(`a chain ${names.length} deep was published (the limit is 4)`); }
    // Two that call each other.
    await refused('function', 'ZzStressLoopA', fn('A', 'COALESCE(x, 0)'));
    const b = await refused('function', 'ZzStressLoopB', fn('B', 'ZzStressLoopA(x) + 1'));
    const a2 = await refused('function', 'ZzStressLoopA', fn('A', 'ZzStressLoopB(x) + 1'));
    out.push(a2.took ? 'a loop A → B → A was published' : `a loop A → B → A was refused (${a2.message})`);
    if (a2.took || a2.internal || b.internal) worst = 'fail';
    // Calling one that is published works.
    const r = await evA('ZzStressChain6(1)');
    out.push(`ZzStressChain6(1) = ${special(r.v) ? r.v.message : r.v}`);
    return { result: worst, detail: out.join(' · ') };
  });

  /* ================= Definitions ================= */
  // A setting's value that satisfies it, for building fields of every control.
  function fill(s) {
    switch (s.type) {
      case 'options': return ['Alpha', 'Beta', 'Gamma'];
      case 'number': return s.name === 'max' ? 100 : 0;
      case 'integer': return s.min != null ? Math.max(1, s.min) : 1;
      case 'formula': return 'LIST()';
      case 'choice': return (s.options || [])[0];
      case 'boolean': return true;
      case 'text': case 'texts': return s.type === 'texts' ? ['x'] : 'x';
      case 'list': return [];
      case 'map': return {};
      default: return undefined;
    }
  }
  function fieldOf(c, name) {
    const f = { name, control: c.name || c.control, label: `${c.label || c.name} ${name}` };
    (c.settings || []).forEach(s => { if (s.required && f[s.name] == null && !['name', 'control', 'label'].includes(s.name)) { const v = fill(s); if (v !== undefined) f[s.name] = v; } });
    if (f.control === 'slider') { f.min = 0; f.max = 10; }
    if (f.control === 'choice' || f.control === 'chips') f.options = ['Alpha', 'Beta', 'Gamma'];
    if (f.control === 'table') f.columns = [{ name: 'a', label: 'A' }, { name: 'b', label: 'B', control: 'number' }];
    if (f.control === 'tree') f.levels = [{ name: 'more', label: 'More', formula: 'LIST(item)' }];
    return f;
  }
  // The controls that make a field on their own (with only their required settings filled in).
  function usableControls() {
    const ok = [], not = [];
    FP.forms.controls().forEach(c => {
      const f = fieldOf(c, 'probe');
      const p = FP.forms.check({ title: 'probe', sites: ['all'], fields: [f] });
      if (p.length) not.push(`${c.name}: ${p[0]}`); else ok.push(c);
    });
    return { ok, not };
  }

  T('definitions', 'giant', 'A giant form: 400 fields of every kind, tabs, sections, steps and 10 sub-forms', async () => {
    const { ok, not } = usableControls();
    const entry = ok.filter(c => c.category === 'entry'), shown = ok.filter(c => c.category !== 'entry');
    const containers = {}; for (let i = 0; i < 120; i++) containers['c' + i] = {};
    await pub('structure', `${P}-giant`, { label: 'Stress: giant', kind: 'records', containers });
    const fields = [];
    let w = 0;
    for (let i = 0; i < 400; i++) {
      const pickEntry = i % 3 !== 2;
      const c = pickEntry ? entry[i % entry.length] : shown[i % shown.length];
      const f = fieldOf(c, 'f' + i);
      const basic = ['text', 'number', 'choice', 'toggle', 'date', 'textarea'].includes(f.control);
      if (pickEntry && basic && w < 120) f.writes = `rec.c${w++}`;
      if (f.control === 'value') f.formula = i > 3 ? `COALESCE(f${i - 3}, "") & "·" & ${i}` : '1';
      fields.push(f);
    }
    // Layout: four tabs, each with sections of rows of three.
    const names = fields.map(f => f.name);
    const per = Math.ceil(names.length / 4);
    const layout = [{ tabs: [0, 1, 2, 3].map(t => ({ tab: 'Tab ' + (t + 1), rows: [] })) }];
    names.forEach((n, i) => {
      const tab = layout[0].tabs[Math.min(3, Math.floor(i / per))];
      const sec = Math.floor((i % per) / 30);
      if (!tab.rows[sec]) tab.rows[sec] = { section: `Section ${sec + 1}`, fold: sec ? 'closed' : 'open', rows: [] };
      const rows = tab.rows[sec].rows;
      if (!rows.length || rows[rows.length - 1].length >= 3) rows.push([]);
      rows[rows.length - 1].push(`${n} 4`);
    });
    const subforms = Array.from({ length: 10 }, (_, s) => ({ name: 'sub' + s, label: 'Sub-form ' + (s + 1),
      fields: Array.from({ length: 20 }, (_, j) => fieldOf(entry[(s + j) % entry.length], `s${s}f${j}`)) }));
    const def = { title: 'Stress: giant form', sources: [{ name: 'rec', kind: 'item', structure: `${P}-giant`, id: { generate: true, prefix: 'G' }, values: Object.fromEntries(Object.keys(containers).map(k => [k, 'write'])) }],
      fields, layout, subforms, buttons: subforms.map(s => ({ name: 'open' + s.name, label: s.label, action: 'subform', subform: s.name })).concat({ name: 'save', label: 'Save', action: 'save' }) };
    const problems = FP.forms.check(def);
    if (problems.length) return { result: 'fail', detail: `The giant form has ${problems.length} problems, e.g. ${problems.slice(0, 3).join(' | ')}` };
    let t0 = now();
    await pub('form', `${P}-giant-form`, def);
    const pubMs = now() - t0;
    const { inst, openMs } = await openForm(`${P}-giant-form`);
    t0 = now(); await inst.recalc(); const calcMs = now() - t0;
    t0 = now();
    for (let i = 0; i < 400; i++) { const f = fields[i]; if (f.control === 'text' || f.control === 'textarea') inst.set(f.name, 'v' + i); else if (f.control === 'number') inst.set(f.name, i); }
    await settle(inst);
    const fillMs = now() - t0;
    const cells = bench.querySelectorAll('.fpf-cell').length;
    inst.destroy();
    if (cells < 100) return { result: 'fail', detail: `only ${cells} fields drawn of 400` };
    const slow = openMs > 5000 || calcMs > 3000;
    return { result: slow ? 'warn' : 'pass', metrics: { pubMs, openMs, calcMs, fillMs },
      detail: `${cells} fields drawn; published in ${ms(pubMs)}, opened in ${ms(openMs)}, worked out in ${ms(calcMs)}, filled in ${ms(fillMs)}${not.length ? ` · controls left out (need more than their required settings): ${not.map(x => x.split(':')[0]).join(', ')}` : ''}` };
  });

  // Definitions that must be refused, each with what is wrong.
  function brokenCatalogue() {
    const S = `${P}-broken`;
    const okField = { name: 'a', control: 'text', label: 'A' };
    const F = extra => Object.assign({ title: 'Broken', fields: [okField] }, extra);
    return [
      ['form', 'no fields', F({ fields: [] })],
      ['form', 'a field with no name', F({ fields: [{ control: 'text' }] })],
      ['form', 'a name used twice', F({ fields: [okField, okField] })],
      ['form', 'an unknown control', F({ fields: [{ name: 'a', control: 'hologram' }] })],
      ['form', 'a formula that doesn\'t parse', F({ fields: [okField, { name: 'b', control: 'value', formula: 'IF(a,' }] })],
      ['form', 'a function that doesn\'t exist', F({ fields: [okField, { name: 'b', control: 'value', formula: 'NOSUCHTHING(a)' }] })],
      ['form', 'a value field with no formula', F({ fields: [{ name: 'b', control: 'value' }] })],
      ['form', 'a choice with no options', F({ fields: [{ name: 'b', control: 'choice' }] })],
      ['form', 'a slider whose top is below its bottom', F({ fields: [{ name: 'b', control: 'slider', min: 10, max: 1 }] })],
      ['form', 'saving to a structure that doesn\'t exist', F({ sources: [{ name: 'r', kind: 'item', structure: 'zz-no-such', id: { generate: true }, values: { a: 'write' } }], fields: [Object.assign({}, okField, { writes: 'r.a' })] })],
      ['form', 'saving to a value the structure doesn\'t have', F({ sources: [{ name: 'r', kind: 'item', structure: S, id: { generate: true }, values: { nope: 'write' } }], fields: [Object.assign({}, okField, { writes: 'r.nope' })] })],
      ['form', 'saving to a source that doesn\'t exist', F({ fields: [Object.assign({}, okField, { writes: 'ghost.a' })] })],
      ['form', 'an item source with no way to find its item', F({ sources: [{ name: 'r', kind: 'item', structure: S, values: { a: 'write' } }], fields: [Object.assign({}, okField, { writes: 'r.a' })] })],
      ['form', 'a source of an unknown kind', F({ sources: [{ name: 'r', kind: 'wormhole', structure: S }] })],
      ['form', 'two sources with one name', F({ sources: [{ name: 'r', kind: 'value', formula: '1' }, { name: 'r', kind: 'value', formula: '2' }] })],
      ['form', 'a carry to a source that doesn\'t exist', F({ sources: [{ name: 'r', kind: 'item', structure: S, id: { field: 'a' }, values: { a: 'read' }, carry: { to: 'ghost', values: ['a'] } }] })],
      ['form', 'a layout naming a field that doesn\'t exist', F({ layout: [['a 6', 'ghost 6']] })],
      ['form', 'a button with an unknown action', F({ buttons: [{ name: 'b', label: 'B', action: 'teleport' }] })],
      ['form', 'a sub-form button naming no sub-form', F({ buttons: [{ name: 'b', label: 'B', action: 'subform', subform: 'ghost' }] })],
      ['form', 'a set button setting a field that doesn\'t exist', F({ buttons: [{ name: 'b', label: 'B', action: 'set', sets: { ghost: 1 } }] })],
      ['form', 'a when rule that doesn\'t parse', F({ fields: [Object.assign({}, okField, { when: 'a = ' })] })],
      ['form', 'a saved message naming a field that doesn\'t exist', F({ savedMessage: 'Saved {ghost}' })],
      ['form', 'a home form setting of the wrong kind', F({ density: 'gigantic' })],
      ['form', 'a person field asking a PIN of nobody', F({ fields: [{ name: 'p', control: 'person', pin: 'nobody' }] })],
      ['form', 'an unknown setting', F({ fields: [Object.assign({}, okField, { colour: 'red' })] })],
      ['form', 'a field name that isn\'t a name', F({ fields: [{ name: '1st field', control: 'text' }] })],
      ['form', 'a records field with no formula', F({ fields: [{ name: 'r', control: 'records' }] })],
      ['form', 'a chart over a formula that doesn\'t parse', F({ fields: [{ name: 'c', control: 'chart', formula: 'FILTER(' }] })],
      ['structure', 'a status rule that doesn\'t parse', { label: 'Broken', kind: 'records', containers: { a: {} }, status: [{ value: 'X', when: 'a = ' }] }],
      ['structure', 'a calculated value from a function that doesn\'t exist', { label: 'Broken', kind: 'records', containers: { a: {} }, calculated: { b: { fn: 'NoSuchFn', inputs: { x: 'a' } } } }],
      ['structure', 'a container rule that doesn\'t exist', { label: 'Broken', kind: 'records', containers: { a: { rule: 'multiply' } } }],
      ['structure', 'a live window of minus days', { label: 'Broken', kind: 'records', containers: { a: {} }, live: { days: -5 } }],
      ['structure', 'no kind (0.59)', { label: 'Broken', containers: { a: {} } }],
      ['structure', 'a run with nothing saying when it ended', { label: 'Broken', kind: 'runs', containers: { a: {} } }],
      ['function', 'no formula', { label: 'Broken', output: 'number', inputs: [] }],
      ['function', 'a formula that doesn\'t parse', { label: 'Broken', output: 'number', inputs: [], formula: '1 +' }],
      ['function', 'a lookup of a structure that doesn\'t exist', { label: 'Broken', kind: 'lookup', output: 'list', inputs: [], reads: { structure: 'zz-no-such', from: 'items', return: '*', summary: 'list', window: 'all' } }],
      ['function', 'an input with no name', { label: 'Broken', output: 'number', inputs: [{ type: 'number' }], formula: '1' }],
      ['function', 'an output that isn\'t a type', { label: 'Broken', output: 'colour', inputs: [], formula: '1' }],
    ];
  }
  T('definitions', 'broken', 'Broken definitions are refused, each with a message', async () => {
    await pub('structure', `${P}-broken`, { label: 'Stress: broken', kind: 'records', containers: { a: {} } });
    const slipped = [], internal = [];
    const list = brokenCatalogue();
    for (let i = 0; i < list.length; i++) {
      const [kind, what, def] = list[i];
      const id = kind === 'function' ? `ZzStressBroken${i}` : `${P}-broken-${i}`;
      const r = await refused(kind, id, def);
      if (r.took) { slipped.push(`${kind}: ${what}`); await retireQuietly(kind, id); }
      else if (r.internal || !r.message) internal.push(`${kind}: ${what} (${r.message || 'no message'})`);
      await idle();
    }
    const n = list.length;
    return { result: slipped.length || internal.length ? 'fail' : 'pass',
      detail: slipped.length || internal.length ? [slipped.length ? `Published though broken: ${slipped.join('; ')}` : null, internal.length ? `Refused with an internal error: ${internal.join('; ')}` : null].filter(Boolean).join(' · ') : `all ${n} refused with a message` };
  });

  T('definitions', 'corrupt', 'A damaged file in the library doesn\'t stop the rest loading', async () => {
    const dir = ['library', 'form', `${P}-corrupt`];
    await FP.files.writeText(dir, '0001-STRESS.json', '{ "fp": "def", "kind": "form", "id": "' + P + '-corrupt", "def": { "title": "half a fi');
    let r, threw = null;
    try { r = await FP.defs.load({ fresh: true }); } catch (e) { threw = e; }
    const rep = FP.defs.report ? FP.defs.report() : null;
    const listed = JSON.stringify(rep || '').includes(`${P}-corrupt`);
    const others = FP.defs.list('form').length;
    await FP.files.remove(dir, '0001-STRESS.json').catch(() => {});
    await FP.defs.load({ fresh: true }).catch(() => {});
    if (threw) return { result: 'fail', detail: `loading the library failed: ${threw.message}` };
    return { result: listed ? 'pass' : 'warn', detail: `${others} forms still loaded; the damaged file ${listed ? 'is named in the library report' : 'was skipped without being named in the library report'}` };
  });

  T('definitions', 'many', '150 forms published one after another, then the library loaded', async () => {
    let t0 = now();
    for (let i = 0; i < 150; i++) {
      await pub('form', `${P}-many-${i}`, { title: `Stress many ${i}`, fields: [{ name: 'a', control: 'text' }, { name: 'b', control: 'value', formula: `"${i}" & a` }] });
      if (i % 10 === 0) { say(`published ${i} of 150`); checkCancel(); }
    }
    const pubMs = now() - t0;
    t0 = now(); await FP.defs.load({ fresh: true }); const loadMs = now() - t0;
    t0 = now(); for (let i = 0; i < 150; i++) await retireQuietly('form', `${P}-many-${i}`); const retireMs = now() - t0;
    return { result: loadMs > 10000 ? 'warn' : 'pass', metrics: { pubMs, loadMs, retireMs }, detail: `150 published in ${ms(pubMs)} (${ms(pubMs / 150)} each), library loaded in ${ms(loadMs)}, retired again in ${ms(retireMs)}` };
  });

  /* ================= Orphans ================= */
  T('orphans', 'missing-item', 'A form finding an item that was never saved', async () => {
    await pub('structure', `${P}-parts`, { label: 'Stress: parts', kind: 'list', containers: { name: {}, size: {} } });
    await pub('form', `${P}-orphan-item`, { title: 'Stress: orphan item',
      sources: [{ name: 'part', kind: 'item', structure: `${P}-parts`, id: { field: 'pid' }, values: { name: 'read', size: 'read' } }],
      fields: [{ name: 'pid', control: 'text', label: 'Part' }, { name: 'shows', control: 'value', label: 'Size', formula: 'part.size * 2' }, { name: 'nm', control: 'value', label: 'Name', formula: 'COALESCE(part.name, "none")' }] });
    const { inst } = await openForm(`${P}-orphan-item`);
    inst.set('pid', 'P-NEVER'); await settle(inst);
    const v = inst.values();
    inst.destroy();
    const fine = special(v.shows) || v.shows == null;
    return { result: fine ? 'pass' : 'fail', detail: `size × 2 shows ${special(v.shows) ? v.shows.__fp + (v.shows.message ? ': ' + v.shows.message : '') : JSON.stringify(v.shows)}; name shows ${JSON.stringify(special(v.nm) ? v.nm.__fp : v.nm)}` };
  });

  T('orphans', 'retired-structure', 'A structure retired from under a form that saves to it', async () => {
    await pub('structure', `${P}-gone`, { label: 'Stress: gone', kind: 'records', containers: { a: {} } });
    await pub('form', `${P}-orphan-structure`, { title: 'Stress: orphan structure',
      sources: [{ name: 'r', kind: 'item', structure: `${P}-gone`, id: { generate: true }, values: { a: 'write' } }],
      fields: [{ name: 'a', control: 'text', writes: 'r.a', required: true }] });
    const plain = await retire('structure', `${P}-gone`).then(() => 'retired', e => `refused: ${e.message}`);
    const forced = await retire('structure', `${P}-gone`, true).then(() => 'retired', e => `refused: ${e.message}`);
    let opened, saved;
    try { const { inst } = await openForm(`${P}-orphan-structure`); inst.set('a', 'x'); await settle(inst); saved = await Promise.resolve(inst.save()).then(() => 'saved?!', e => `not saved: ${e.message}`); opened = 'opened'; inst.destroy(); }
    catch (e) { opened = `didn't open: ${e.message}`; if (isInternal(e)) return { result: 'fail', detail: `${e.name}: ${e.message}` }; }
    const result = plain.startsWith('retired') || (saved && saved.startsWith('saved')) ? 'fail' : 'pass';
    return { result, detail: `retire while used: ${plain}; forced: ${forced}; the form ${opened}${saved ? ', ' + saved : ''}` };
  });

  T('orphans', 'retired-function', 'A function retired from under a form that calls it', async () => {
    await pub('function', 'ZzStressDouble', { label: 'Double', output: 'number', inputs: [{ name: 'x', type: 'number', required: false }], formula: 'COALESCE(x, 0) * 2' });
    await pub('form', `${P}-orphan-fn`, { title: 'Stress: orphan function', fields: [{ name: 'n', control: 'number' }, { name: 'd', control: 'value', formula: 'ZzStressDouble(n)' }] });
    const forced = await retire('function', 'ZzStressDouble', true).then(() => 'retired', e => `refused: ${e.message}`);
    try {
      const { inst } = await openForm(`${P}-orphan-fn`); inst.set('n', 4); await settle(inst);
      const d = inst.values().d; inst.destroy();
      return { result: special(d) ? 'pass' : 'warn', detail: `forced retire: ${forced}; the field shows ${special(d) ? (d.message || d.__fp) : JSON.stringify(d)}` };
    } catch (e) { return { result: isInternal(e) ? 'fail' : 'pass', detail: `forced retire: ${forced}; the form didn't open: ${e.message}` }; }
  });

  T('orphans', 'churn', '300 items made and retired at random while a board lists them', async () => {
    await pub('structure', `${P}-churn`, { label: 'Stress: churn', kind: 'list', roles: { active: 'active' }, containers: { name: {}, active: {}, n: { rule: 'sum' } } });
    await pub('form', `${P}-churn-board`, { title: 'Stress: churn board',
      sources: [{ name: 'all', kind: 'items', structure: `${P}-churn` }],
      fields: [{ name: 'live', control: 'board', formula: 'FILTER(all, item.$status = "Active")', title: 'name', select: true, limit: 500 }, { name: 'pick', control: 'value', formula: 'COALESCE(live.selected.name, "none")' }, { name: 'n', control: 'value', formula: 'COUNT(FILTER(all, item.$status = "Active"))' }] });
    const { inst, host } = await openForm(`${P}-churn-board`);
    let seed = 7; const rnd = n => { seed = (seed * 16807) % 2147483647; return seed % n; };
    const active = new Set();
    for (let i = 0; i < 300; i++) {
      const id = 'CH' + rnd(80);
      const on = !active.has(id) || rnd(3) === 0;
      await FP.entry.record({ entry: `${P}-churn.set`, item: { structure: `${P}-churn`, id }, form: { id: 'stress', version: 1 }, values: { name: id, active: on, n: 1 } });
      if (on) active.add(id); else active.delete(id);
      if (i % 25 === 0) {
        FP.current.clearCache(); await inst.recalc();
        const tile = host.querySelector('.fpv-tile'); if (tile) tile.click();
        say(`item ${i} of 300`); checkCancel();
      }
    }
    FP.current.clearCache(); await inst.recalc(); await settle(inst);
    const shown = inst.values().n;
    inst.destroy();
    return { result: shown === active.size ? 'pass' : 'fail', detail: `the board counts ${shown} active; ${active.size} are` };
  });

  /* ================= Pressure ================= */
  async function mediumForm() {
    await pub('structure', `${P}-press`, { label: 'Stress: pressure', kind: 'records', containers: Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['v' + i, {}]).concat([['total', {}]])) });
    const fields = [];
    for (let i = 0; i < 20; i++) fields.push({ name: 'n' + i, control: 'number', label: 'N' + i, writes: `rec.v${i}` });
    for (let i = 0; i < 20; i++) fields.push({ name: 'k' + i, control: 'value', label: 'K' + i, formula: i ? `COALESCE(n${i}, 0) + COALESCE(k${i - 1}, 0)` : 'COALESCE(n0, 0)' });
    fields.push({ name: 'total', control: 'value', formula: 'k19', snapshot: 'rec.total' });
    await pub('form', `${P}-press-form`, { title: 'Stress: pressure', sources: [{ name: 'rec', kind: 'item', structure: `${P}-press`, id: { generate: true, prefix: 'PR' }, values: Object.fromEntries(Array.from({ length: 20 }, (_, i) => ['v' + i, 'write']).concat([['total', 'write']])) }],
      fields, buttons: [{ name: 'save', label: 'Save', action: 'save', then: 'stay' }] });
  }
  const count = async st => (await fresh(st)).items.size;

  T('pressure', 'typing', '3,000 changes as fast as they come, then the sums checked', async () => {
    await mediumForm();
    const { inst } = await openForm(`${P}-press-form`);
    const want = Array(20).fill(0);
    let seed = 3; const rnd = n => { seed = (seed * 48271) % 2147483647; return seed % n; };
    const t0 = now();
    for (let i = 0; i < 3000; i++) { const k = rnd(20), v = rnd(1000); want[k] = v; inst.set('n' + k, v); if (i % 500 === 0) await idle(); }
    const typeMs = now() - t0;
    await settle(inst, 600);
    const got = inst.values().k19, expect = want.reduce((a, b) => a + b, 0);
    inst.destroy();
    return { result: got === expect ? 'pass' : 'fail', detail: `3,000 changes in ${ms(typeMs)}; the running total reads ${got}, should be ${expect}` };
  });

  T('pressure', 'keys', '2,000 real input events on the fields', async () => {
    const { inst, host } = await openForm(`${P}-press-form`);
    const inputs = Array.from(host.querySelectorAll('.fpf-cell input')).slice(0, 20);
    let last = Array(inputs.length).fill(0);
    const t0 = now();
    for (let i = 0; i < 2000; i++) {
      const k = i % inputs.length, v = (i * 7) % 500;
      inputs[k].value = String(v); inputs[k].dispatchEvent(new Event('input', { bubbles: true })); last[k] = v;
      if (i % 250 === 0) await idle();
    }
    await settle(inst, 600);
    const got = inst.values().k19, expect = last.reduce((a, b) => a + b, 0);
    inst.destroy();
    return { result: got === expect ? 'pass' : 'fail', detail: `${inputs.length} inputs, 2,000 events in ${ms(now() - t0)}; total ${got}, should be ${expect}` };
  });

  T('pressure', 'double-save', 'Save pressed 25 times at once makes one record', async () => {
    const before = await count(`${P}-press`);
    const { inst } = await openForm(`${P}-press-form`);
    inst.set('n0', 5); await settle(inst);
    const results = await Promise.allSettled(Array.from({ length: 25 }, () => Promise.resolve(inst.press('save'))));
    await settle(inst); await FP.outbox.flush();
    const after = await count(`${P}-press`);
    inst.destroy();
    const made = after - before;
    return { result: made === 1 ? 'pass' : 'fail', detail: `${made} record${made === 1 ? '' : 's'} made (${results.filter(r => r.status === 'rejected').length} presses refused)` };
  });

  T('pressure', 'churn-open', 'The form opened and closed 150 times', async () => {
    const times = [];
    const heap0 = performance.memory ? performance.memory.usedJSHeapSize : null;
    for (let i = 0; i < 150; i++) {
      const { inst, openMs } = await openForm(`${P}-press-form`);
      times.push(openMs); inst.destroy();
      if (i % 25 === 0) { say(`opened ${i} of 150`); checkCancel(); }
    }
    bench.replaceChildren();
    await idle(500);
    const heap1 = performance.memory ? performance.memory.usedJSHeapSize : null;
    const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
    const first = avg(times.slice(0, 15)), last = avg(times.slice(-15));
    const grew = last > first * 2.5 && last - first > 50;
    return { result: grew ? 'warn' : 'pass', detail: `first opens ${ms(first)}, last ${ms(last)}${heap0 != null ? `; memory ${round((heap1 - heap0) / 1048576, 1)} MB more after` : ''}` };
  });

  T('pressure', 'offline', '30 saves while the folder is unreachable, then it comes back', async () => {
    const before = await count(`${P}-press`);
    await FP.outbox.simulateOffline(true);
    const { inst } = await openForm(`${P}-press-form`);
    let refusedSaves = 0;
    try {
      for (let i = 0; i < 30; i++) { inst.set('n1', i + 1); await settle(inst, 150); try { await inst.press('save'); } catch (_) { refusedSaves++; } }
    } finally { await FP.outbox.simulateOffline(false); }
    inst.destroy();
    const st = await FP.outbox.flush();
    const after = await count(`${P}-press`);
    const made = after - before;
    return { result: made === 30 - refusedSaves && st.pending !== undefined ? (made === 30 ? 'pass' : 'warn') : (made === 30 ? 'pass' : 'fail'), detail: `${made} records after coming back (of 30 saves, ${refusedSaves} refused while offline); outbox ${st.state}` };
  });

  T('pressure', 'same-item', 'Two forms saving one item 20 times each, at once', async () => {
    await pub('structure', `${P}-shared`, { label: 'Stress: shared', kind: 'records', containers: { who: {}, n: { rule: 'sum' } } });
    await pub('form', `${P}-shared-form`, { title: 'Stress: shared', sources: [{ name: 'r', kind: 'item', structure: `${P}-shared`, id: { fixed: 'ONE' }, values: { who: 'write', n: 'write' } }],
      fields: [{ name: 'who', control: 'text', writes: 'r.who' }, { name: 'one', control: 'value', formula: '1', snapshot: 'r.n' }], buttons: [{ name: 'save', label: 'Save', action: 'save', then: 'stay' }] });
    const before = (await fresh(`${P}-shared`)).items.get('ONE');
    const n0 = before ? Number(before.values.n || 0) : 0;
    const a = document.createElement('div'), b = document.createElement('div');
    bench.replaceChildren(a, b);
    const A = await FP.forms.open(a, `${P}-shared-form`, { draft: false }), B = await FP.forms.open(b, `${P}-shared-form`, { draft: false });
    const run = async (f, tag) => { for (let i = 0; i < 20; i++) { f.set('who', tag + i); await settle(f, 120); await f.press('save'); } };
    // Each form warns that the other saved the item since it opened (as it should); the person answers Save mine over it.
    let warned = 0;
    const answer = setInterval(() => bench.querySelectorAll('.fpf-veil button.fpf-save').forEach(x => { warned++; x.click(); }), 30);
    try { await Promise.all([run(A, 'A'), run(B, 'B')]); } finally { clearInterval(answer); }
    A.destroy(); B.destroy();
    await FP.outbox.flush();
    const it = (await fresh(`${P}-shared`)).items.get('ONE');
    const n = Number(it.values.n || 0) - n0;
    return { result: n === 40 && warned > 0 ? 'pass' : 'fail', detail: `the sum counts ${n} saves of 40; ${warned} times a form warned that the other had saved the item since it opened${warned ? ' and was answered Save mine over it' : ' (it should have)'}; the last name saved is ${it.values.who}` };
  });

  /* ================= Files ================= */
  T('files', 'garbage', 'Garbage lines, a half line and a blank in a day file', async () => {
    await pub('structure', `${P}-files`, { label: 'Stress: files', kind: 'records', containers: { a: {}, n: { rule: 'sum' } } });
    for (let i = 0; i < 5; i++) await FP.entry.record({ entry: `${P}-files.set`, item: { structure: `${P}-files`, id: 'F' + i }, form: { id: 'stress', version: 1 }, values: { a: 'x' + i, n: 1 } });
    const loc = FP.entry.location({ item: { structure: `${P}-files` } });
    const text = await FP.files.readText(loc.parts, loc.fileName);
    await FP.files.writeText(loc.parts, loc.fileName, text + 'not json at all\n\n{"half": "a li\n');
    for (let i = 5; i < 8; i++) await FP.entry.record({ entry: `${P}-files.set`, item: { structure: `${P}-files`, id: 'F' + i }, form: { id: 'stress', version: 1 }, values: { a: 'x' + i, n: 1 } });
    const r = await fresh(`${P}-files`);
    const ok = r.items.size === 8;
    return { result: ok ? 'pass' : 'fail', detail: `${r.items.size} items of 8 read; health: ${r.health.slice(0, 3).join(' | ') || 'nothing said'}` };
  });

  T('files', 'tamper', 'A saved line changed by hand', async () => {
    const loc = FP.entry.location({ item: { structure: `${P}-files` } });
    const lines = (await FP.files.readText(loc.parts, loc.fileName)).split('\n');
    const i = lines.findIndex(l => l.includes('"x2"'));
    if (i < 0) return { result: 'warn', detail: 'no line to change (run Garbage lines first)' };
    lines[i] = lines[i].replace('"x2"', '"CHANGED"');
    await FP.files.writeText(loc.parts, loc.fileName, lines.join('\n'));
    const v = await FP.current.verifyFiles(`${P}-files`).catch(e => ({ error: e.message }));
    const r = await fresh(`${P}-files`);
    const said = r.health.some(h => /follow the line before|changed/.test(h)) || JSON.stringify(v).includes('broken');
    return { result: said ? 'pass' : 'fail', detail: `${said ? 'the change is reported' : 'the change went unnoticed'}: ${r.health.filter(h => /follow|changed/.test(h)).slice(0, 2).join(' | ') || JSON.stringify(v).slice(0, 160)}` };
  });

  T('files', 'twice', 'One save written twice (a sync copy)', async () => {
    const loc = FP.entry.location({ item: { structure: `${P}-files` } });
    const text = await FP.files.readText(loc.parts, loc.fileName);
    const last = text.trim().split('\n').pop();
    await FP.files.writeText(loc.parts, loc.fileName, text.replace(/\n?$/, '\n') + last + '\n');
    const r = await fresh(`${P}-files`);
    const id = JSON.parse(last).item.id;
    const n = Number((r.items.get(id) || { values: {} }).values.n || 0);
    return { result: n === 1 ? 'pass' : 'fail', detail: `the item's sum counts ${n} (should be 1)${r.health.length ? '; health: ' + r.health.slice(-2).join(' | ') : ''}` };
  });

  T('files', 'future', 'An entry from a newer version, and one from tomorrow', async () => {
    const loc = FP.entry.location({ item: { structure: `${P}-files` } });
    const text = await FP.files.readText(loc.parts, loc.fileName);
    const base = JSON.parse(text.trim().split('\n').pop());
    const out = []; let worst = 'pass';
    // A newer entry format: the structure says this terminal needs the update, rather than misreading it.
    const v99 = Object.assign({}, base, { v: 99, entryId: base.entryId + '-V99', item: { structure: base.item.structure, id: 'F-V99' }, submissionId: 'S-V99', prev: undefined });
    await FP.files.writeText(loc.parts, loc.fileName, text.replace(/\n?$/, '\n') + JSON.stringify(v99) + '\n');
    const a = await fresh(`${P}-files`).then(() => null, e => e);
    if (!a) { worst = 'fail'; out.push('an entry of format 99 was read as if this terminal knew it'); }
    else if (isInternal(a)) { worst = 'fail'; out.push(`format 99: ${a.name}: ${a.message}`); }
    else out.push(`format 99: "${a.message.slice(0, 110)}…"`);
    // Tomorrow's: read, and the clock warning says so.
    const tomorrow = Object.assign({}, base, { entryId: base.entryId + '-TMR', item: { structure: base.item.structure, id: 'F-TMR' }, submissionId: 'S-TMR', writtenAt: new Date(Date.now() + 2 * 864e5).toISOString(), prev: undefined });
    await FP.files.writeText(loc.parts, loc.fileName, text.replace(/\n?$/, '\n') + JSON.stringify(tomorrow) + '\n');
    const r = await fresh(`${P}-files`).catch(e => e);
    if (r instanceof Error) { worst = 'fail'; out.push(`tomorrow's: loading failed: ${r.message}`); }
    else out.push(`tomorrow's ${r.items.has('F-TMR') ? 'read' : 'left out'}${r.health.length ? '; health: ' + r.health.slice(-2).join(' | ') : ''}`);
    await FP.files.writeText(loc.parts, loc.fileName, text);
    return { result: worst, detail: out.join(' · ') };
  });

  /* ================= Volume: a year of the plant ================= */
  const VOL = { runs: `${P}-runs`, racks: `${P}-racks` };
  const LINES = 9, DAYS = 365;
  async function volumeDefs() {
    await pub('structure', VOL.runs, { label: 'Stress: runs', kind: 'runs', roles: { ended: 'endAt', started: 'startAt' }, live: { days: 60 },
      containers: { line: {}, profile: {}, crew: {}, startAt: {}, endAt: {}, racks: { rule: 'sum' }, pieces: { rule: 'sum' }, slot: {}, speed: {}, length: {}, checks: { from: 'slot', rule: 'count' }, avgSpeed: { from: 'speed', rule: 'average' } } });
    await pub('structure', VOL.racks, { label: 'Stress: racks', kind: 'inventory', roles: { quantity: 'pieces', madeFrom: 'run' }, live: { days: 60 }, containers: { run: {}, line: {}, profile: {}, pieces: {} } });
  }
  /* The year is written day by day, and where it got to is kept in data/zz-stress-runs/stress-progress.json, so a
   * run that stopped part way (the computer slept, the folder was busy) carries on where it stopped (0.53.2).
   * Entry IDs are the same each time it is written, and a day half written is finished without repeating a line. */
  const PROGRESS = () => [['data', VOL.runs], 'stress-progress.json'];
  T('volume', 'write', 'A year of the plant written as day files', async () => {
    await volumeDefs();
    const term = 'STRESS';
    const site = FP.identity.site || ((await FP.sites.list())[0] || {}).id || null;
    const days = runOpts.days || DAYS;
    const prog = await FP.files.readJson(...PROGRESS());
    let start, from = 0;
    if (prog && prog.days === days && prog.lines === LINES && /^\d{4}-\d{2}-\d{2}$/.test(prog.start || '')) {
      start = new Date(prog.start + 'T00:00:00'); from = (prog.doneThrough || -1) + 1;
    } else { start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - days); }
    if (from >= days) return { result: 'pass', detail: `already written: ${days} days from ${dayOf(start)} (Purge all data to write it again)` };
    let n = 0, skipped = 0, catching = from > 0;
    const t0 = now();
    const mk = (structure, action, id, values, at, seq) => {
      const entryId = `${term}-${dayOf(at).replace(/-/g, '')}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}-${pad(seq, 7)}`;
      return { v: FP.ENTRY_VERSION, entryId, entry: `${structure}.${action}`, item: { structure, id }, refs: {}, form: { id: 'stress', version: 1 }, writtenAt: at.toISOString(), terminalId: term, site: site || undefined, userId: null, corrects: null, submissionId: 'S-' + entryId, commit: true, values };
    };
    // The entries already in a file (a day that was being written when the run stopped).
    const have = async (structure, day) => new Set((await FP.files.readLines(['data', structure, day], `${term}.jsonl`)).records.map(e => e && e.entryId));
    for (let d = from; d < days; d++) {
      const day = new Date(start); day.setDate(start.getDate() + d);
      const runsOut = [], racksOut = [];
      let seq = d * 10000;
      for (let line = 1; line <= LINES; line++) {
        for (const [crew, h0] of [['A', 6], ['P', 18]]) {
          const st = new Date(day); st.setHours(h0, 0, 0, 0);
          const run = `${dayOf(day)}-${crew}-L${line}`;
          const profile = `P${(line * 7 + d) % 30}`;
          runsOut.push(mk(VOL.runs, 'start', run, { line: 'Line ' + line, profile, crew, startAt: st.toISOString() }, st, ++seq));
          for (let h = 0; h < 11; h++) { const at = new Date(st.getTime() + (h * 60 + 5 + line) * 60000); runsOut.push(mk(VOL.runs, 'hourly', run, { slot: new Date(st.getTime() + h * 3600000).toISOString(), speed: 30 + ((line + h + d) % 20), length: 179 + ((h % 3) - 1) * 0.05 }, at, ++seq)); }
          for (let r = 0; r < 4; r++) {
            const at = new Date(st.getTime() + (r * 170 + 30 + line) * 60000);
            const rid = `R${dayOf(day).replace(/-/g, '')}${crew}${line}${r}`;
            racksOut.push(mk(VOL.racks, 'make', rid, { run, line: 'Line ' + line, profile, pieces: 360 }, at, ++seq));
            runsOut.push(mk(VOL.runs, 'rack', run, { racks: 1, pieces: 360 }, new Date(at.getTime() + 1000), ++seq));
          }
          const end = new Date(st.getTime() + 12 * 3600000 - 60000);
          if (d < days - 1 || crew === 'A') runsOut.push(mk(VOL.runs, 'end', run, { endAt: end.toISOString() }, end, ++seq));
        }
      }
      const write = async (structure, list) => {
        list.sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));
        // After a stop (where it got to is saved every five days): leave out what is already there, until a day has none of it.
        if (catching) {
          const there = new Set();
          for (const dd of uniqDays(list)) (await have(structure, dd)).forEach(id => there.add(id));
          const before = list.length;
          list = list.filter(e => !there.has(e.entryId));
          skipped += before - list.length;
          if (structure === VOL.racks && before && list.length === before) catching = false;
        }
        await Promise.all(list.map(e => FP.files.appendLine(['data', structure, dayOf(new Date(e.writtenAt))], `${term}.jsonl`, e, { chain: true })));
        return list.length;
      };
      n += await write(VOL.runs, runsOut) + await write(VOL.racks, racksOut);
      // Where it got to: every five days, and at the end.
      if (d % 5 === 4 || d === days - 1) await FP.files.writeJson(...PROGRESS(), { start: dayOf(start), days, lines: LINES, doneThrough: d });
      if (runOpts.stopAfter && d - from + 1 >= runOpts.stopAfter) throw new Error(`Stopped after ${runOpts.stopAfter} days (as asked)`);
      if (d % 5 === 0) { say(`day ${d + 1} of ${days}: ${n.toLocaleString()} entries, ${Math.round(n / ((now() - t0) / 1000))} a second`); checkCancel(); await idle(); }
    }
    const t = now() - t0;
    return { result: 'pass', metrics: { entries: n, ms: t }, detail: `${n.toLocaleString()} entries in ${ms(t)} (${Math.round(n / (t / 1000))} a second)${from ? `; carried on from day ${from + 1} of ${days}${skipped ? `, ${skipped} entries already there left out` : ''}` : ''}` };
  });
  const uniqDays = list => Array.from(new Set(list.map(e => dayOf(new Date(e.writtenAt)))));

  T('volume', 'load', 'Loading a year: live window, then everything', async () => {
    const out = []; let worst = 'pass';
    for (const st of [VOL.runs, VOL.racks]) {
      const L = await timedLoad(st), A = await timedLoad(st, { history: true });
      const live = L.r, all = A.r, liveMs = L.t;
      out.push(`${st.replace(P + '-', '')}: live ${live.items.size.toLocaleString()} items from ${live.entries.toLocaleString()} entries in ${ms(liveMs)} (${L.io}); all ${all.items.size.toLocaleString()} in ${ms(A.t)} (${A.io})${live.health.length ? ` (${live.health[0]})` : ''}`);
      if (liveMs > 5000 && worst === 'pass') worst = 'warn';
      await idle();
    }
    const runs = await fresh(VOL.runs, { history: true });
    const expect = LINES * 2 * (runOpts.days || DAYS);
    if (runs.items.size !== expect) { worst = 'fail'; out.push(`runs: ${runs.items.size} items, expected ${expect}`); }
    const one = runs.items.values().next().value;
    out.push(`a run: ${one ? `${one.values.checks} checks, ${one.values.racks} racks, ${one.status}` : 'none'}`);
    if (one && (Number(one.values.checks) !== 11 || Number(one.values.racks) !== 4)) worst = 'fail';
    return { result: worst, detail: out.join(' · ') };
  });

  T('volume', 'checkpoints', 'Checkpoints written, then loading again', async () => {
    const out = []; let worst = 'pass';
    for (const st of [VOL.runs, VOL.racks]) {
      const a = ioNow(), t0 = now(); const did = await FP.current.checkpoint(st); const cpMs = now() - t0, cpIo = ioSince(a);
      const L = await timedLoad(st), A = await timedLoad(st, { history: true }), liveMs = L.t;
      out.push(`${st.replace(P + '-', '')}: checkpoints in ${ms(cpMs)} (${cpIo}; ${did.summary}); then live ${ms(liveMs)} (${L.io}${L.r.carryFrom ? `, carried from ${L.r.carryFrom}` : ''}), all ${ms(A.t)} (${A.io})`);
      if (liveMs > 3000 && worst === 'pass') worst = 'warn';
    }
    return { result: worst, detail: out.join(' · ') };
  });

  T('volume', 'lookups', 'Lookups over the year, and a board over the live runs', async () => {
    await pub('function', 'ZzStressRunsAll', { label: 'Every stress run', kind: 'lookup', output: 'list', inputs: [], reads: { structure: VOL.runs, from: 'items', return: '*', summary: 'list', window: 'all' } });
    await pub('function', 'ZzStressRuns31', { label: 'Stress runs of 31 days', kind: 'lookup', output: 'list', inputs: [], reads: { structure: VOL.runs, from: 'items', return: '*', summary: 'list', window: { days: 31 } } });
    FP.current.clearCache();
    const out = [];
    out.push('(a lookup of items with the window all reads the live window, here 60 days back from the start of that month)');
    for (const f of ['COUNT(ZzStressRunsAll())', 'COUNT(ZzStressRuns31())', 'SUM(EACH(ZzStressRunsAll(), item.pieces))', 'COUNT(UNIQUE(EACH(ZzStressRunsAll(), item.profile)))']) {
      const t0 = now(); const r = await evA(f); out.push(`${f.split('(').slice(0, 2).join('(')}…: ${r.threw ? r.threw.message : special(r.v) ? r.v.message : Number(r.v).toLocaleString()} in ${ms(now() - t0)}`);
    }
    await pub('form', `${P}-vol-board`, { title: 'Stress: year board', sources: [{ name: 'runs', kind: 'value', formula: 'ZzStressRuns31()' }],
      fields: [{ name: 'k', control: 'kpi', label: 'Runs', formula: 'COUNT(runs)' },
        { name: 'by', control: 'summary', label: 'By line', formula: 'runs', rows: ['line'], heading: 'Line', totals: true, figures: { Runs: 'COUNT(group)', Pieces: 'SUM(group.pieces)', 'Avg speed': 'AVERAGE(group.avgSpeed)' } },
        { name: 'list', control: 'records', label: 'Runs', formula: 'runs', sort: 'startAt', limit: 200, select: true }, { name: 'c', control: 'chart', label: 'Speed', formula: 'runs', type: 'line', x: 'startAt', y: 'avgSpeed', series: 'line' }] });
    const { inst, openMs } = await openForm(`${P}-vol-board`);
    await settle(inst, 600);
    inst.destroy();
    out.push(`a board of 31 days opened in ${ms(openMs)}`);
    return { result: openMs > 8000 ? 'warn' : 'pass', detail: out.join(' · ') };
  });

  T('volume', 'verify', 'Every day file\'s chain checked', async () => {
    const out = []; let worst = 'pass';
    for (const st of [VOL.runs, VOL.racks]) {
      const t0 = now(); const v = await FP.current.verifyFiles(st); const t = now() - t0;
      out.push(`${st.replace(P + '-', '')}: ${v.files} files, ${v.lines.toLocaleString()} lines (${v.chained.toLocaleString()} chained) in ${ms(t)}, ${v.broken.length} broken`);
      if (v.broken.length || v.chained < v.lines) worst = 'fail';
    }
    return { result: worst, detail: out.join(' · ') };
  });

  /* ---------- Running ---------- */
  const results = new Map();   // test key -> { result, detail, ms, errors }
  const keyOf = t => `${t.suite}/${t.id}`;
  async function run(opts) {
    if (running) throw new Error('Already running.');
    if (!(await FP.folder.isTest())) throw new Error('The stress test only runs on a folder marked as a test folder (Admin > Test folder).');
    if (!(await FP.users.can('admin'))) throw new Error('Only an admin can run the stress test.');
    running = true; cancelled = false;
    say = opts.say || (() => {});
    bench = opts.bench;
    runOpts = opts;
    const list = tests.filter(t => !opts.suites || opts.suites.includes(t.suite)).filter(t => !opts.only || opts.only.includes(keyOf(t)));
    try {
      for (const t of list) {
        if (cancelled) break;
        caught.length = 0;
        say(`${t.title}…`);
        if (opts.onStart) opts.onStart(t);
        const t0 = now(), io0 = ioNow();
        let r;
        try { r = await t.run(); }
        catch (e) { r = { result: e.message === 'Stopped' ? 'stopped' : 'fail', detail: `${e.name && e.name !== 'Error' ? e.name + ': ' : ''}${e.message}` }; }
        r.ms = now() - t0;
        r.io = ioSince(io0);
        r.errors = caught.slice();
        if (r.errors.length && r.result === 'pass') r.result = 'warn';
        results.set(keyOf(t), r);
        if (opts.onDone) opts.onDone(t, r);
        await idle(50);
      }
    } finally { running = false; FP.outbox.simulateOffline && FP.outbox.simulateOffline(false).catch(() => {}); if (bench) bench.replaceChildren(); }
  }
  function report() {
    return { fp: 'stress-report', kernel: FP.version, at: new Date().toISOString(), userAgent: navigator.userAgent, folder: FP.folder.handle && FP.folder.handle.name,
      io: ioNow(), terminal: FP.identity.terminalId, screen: `${screen.width}×${screen.height}`, memory: performance.memory ? Math.round(performance.memory.jsHeapSizeLimit / 1048576) + ' MB limit' : null,
      results: tests.filter(t => results.has(keyOf(t))).map(t => Object.assign({ suite: t.suite, test: t.id, title: t.title }, results.get(keyOf(t)))) };
  }

  /* ---------- The page (Admin › Stress test) ---------- */
  const CSS = `
  .fps{display:flex;flex-direction:column;gap:12px}
  .fps-suites{display:flex;flex-wrap:wrap;gap:8px}.fps-suites label{display:flex;gap:6px;align-items:flex-start;border:1px solid #d9dee5;border-radius:10px;padding:8px 10px;background:#fff;max-width:330px;font-size:14px}
  .fps-suites small{display:block;color:#5b6573}
  .fps-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .fps-row button{font:inherit;font-size:14px;min-height:40px;padding:6px 14px;border-radius:10px;border:1px solid #c9d0d9;background:#fff;cursor:pointer}
  .fps-row button.primary{background:#1f5fbf;border-color:#1f5fbf;color:#fff;font-weight:600}.fps-row button:disabled{opacity:.5}
  .fps-say{font-size:14px;color:#3b4552;min-height:20px}
  .fps-table{width:100%;border-collapse:collapse;font-size:13.5px;background:#fff}
  .fps-table td,.fps-table th{border-bottom:1px solid #eef1f5;padding:6px 8px;text-align:left;vertical-align:top}
  .fps-table td.r{font-weight:700;white-space:nowrap}.fps-table td.t{white-space:nowrap}.fps-pass{color:#1a7f37}.fps-warn{color:#9a6700}.fps-fail{color:#b42318}.fps-stopped{color:#5b6573}
  .fps-bench{border:1px dashed #c9d0d9;border-radius:10px;max-height:320px;overflow:auto;padding:6px;background:#fbfcfd}
  .fps-bench:empty{display:none}
  .fps-sum{font-weight:600}`;
  function render(host) {
    if (!document.getElementById('fps-css')) { const s = document.createElement('style'); s.id = 'fps-css'; s.textContent = CSS; document.head.appendChild(s); }
    const el = (t, c, x) => FP.dom.el(t, c, x);
    const root = el('div', 'fps');
    const picks = el('div', 'fps-suites');
    const chosen = new Set(SUITES.filter(s => s[0] !== 'volume').map(s => s[0]));
    SUITES.forEach(([k, label, help]) => {
      const l = el('label'); const c = document.createElement('input'); c.type = 'checkbox'; c.checked = chosen.has(k);
      c.onchange = () => { if (c.checked) chosen.add(k); else chosen.delete(k); };
      const t = el('span'); t.append(el('b', null, label), el('small', null, `${help} · ${tests.filter(x => x.suite === k).length} tests`));
      l.append(c, t); picks.appendChild(l);
    });
    const go = el('button', 'primary', 'Run'); go.type = 'button';
    const stop = el('button', null, 'Stop'); stop.type = 'button'; stop.disabled = true;
    const dl = el('button', null, 'Download the report'); dl.type = 'button';
    const row = el('div', 'fps-row'); row.append(go, stop, dl);
    const sayEl = el('div', 'fps-say', results.size ? '' : 'Pick the suites and press Run. Forms being tested open below while they run.');
    const sum = el('div', 'fps-sum');
    const table = el('table', 'fps-table');
    const benchEl = el('div', 'fps-bench');
    const paint = () => {
      const hr = el('tr'); ['', 'Test', 'Took', 'What happened'].forEach(h => hr.appendChild(el('th', null, h)));
      const rows = tests.filter(t => results.has(keyOf(t))).map(t => {
        const r = results.get(keyOf(t)); const tr = el('tr');
        tr.append(el('td', 'r fps-' + r.result, { pass: '✓ pass', warn: '! warn', fail: '✕ fail', stopped: '– stopped' }[r.result] || r.result),
          el('td', null, `${SUITES.find(s => s[0] === t.suite)[1]}: ${t.title}`), el('td', 't', ms(r.ms)),
          el('td', null, r.detail + (r.errors && r.errors.length ? ` · page errors: ${r.errors.slice(0, 3).join(' | ')}` : '') + (r.io && /retried/.test(r.io) ? ` · the folder: ${r.io}` : '')));
        return tr;
      });
      table.replaceChildren(hr, ...rows);
      const all = Array.from(results.values());
      sum.textContent = all.length ? `${all.filter(r => r.result === 'pass').length} passed · ${all.filter(r => r.result === 'warn').length} warnings · ${all.filter(r => r.result === 'fail').length} failed` : '';
    };
    go.onclick = async () => {
      go.disabled = true; stop.disabled = false;
      try {
        await run({ suites: Array.from(chosen), bench: benchEl, say: t => { sayEl.textContent = t; }, onDone: paint });
        sayEl.textContent = cancelled ? 'Stopped.' : 'Done. Download the report to keep it or send it.';
      } catch (e) { sayEl.textContent = e.message; }
      go.disabled = false; stop.disabled = true; paint();
    };
    stop.onclick = () => { cancelled = true; sayEl.textContent = 'Stopping after this test…'; };
    dl.onclick = () => {
      const blob = new Blob([JSON.stringify(report(), null, 1)], { type: 'application/json' });
      const a = el('a'); a.href = URL.createObjectURL(blob); a.download = `stress-report-${FP.version}-${dayOf(new Date())}.json`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };
    root.append(picks, row, sayEl, sum, table, benchEl);
    host.replaceChildren(root);
    paint();
  }

  FP.stress = { SUITES, tests: () => tests.map(t => ({ suite: t.suite, id: t.id, title: t.title })), run, results: () => new Map(results), report, render, stop: () => { cancelled = true; } };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-stress'] = '0.63.0';
})();
