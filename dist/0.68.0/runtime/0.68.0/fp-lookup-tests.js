/* Form Platform: lookup test suite (step 7)
 * Load after fp-lookup.js. Uses in-memory data only (nothing is read or
 * written in the data folder). FP.lookupTests.run() returns
 * { passed, failed, results } and leaves the function library as it found it.
 */
(function () {
  'use strict';
  const FP = window.FP;
  if (!FP || !FP.lookup) throw new Error('Load fp-lookup.js before fp-lookup-tests.js');

  const at = (d, h, m) => new Date(2026, 10, d, h, m || 0);
  const iso = d => d.toISOString();
  let n = 0;
  const entry = (structure, action, id, when, values, refs) => ({
    v: 5, entryId: `T01-TEST-${String(++n).padStart(4, '0')}`, entry: `${structure}.${action}`,
    item: { structure, id }, refs: refs || {}, form: { id: null, version: null },
    writtenAt: iso(when), terminalId: 'T01', userId: null, corrects: null, submissionId: null, values,
  });
  const run = (profile, line) => ({ id: 'RUN-' + profile, auto: true, source: 'open', date: '2026-11-11', profile, line });

  const SPEC = [
    entry('spec-limits', 'define', 'P-210|lineal', at(1, 8), { profile: 'P-210', measurement: 'lineal', min: 119.8, max: 120.2 }),
    entry('spec-limits', 'define', 'P-305|lineal', at(1, 8), { profile: 'P-305', measurement: 'lineal', min: 95.9, max: 96.1 }),
    entry('spec-limits', 'define', 'P-210|width', at(1, 9), { profile: 'P-210', measurement: 'width', min: 3.0, max: 3.1 }),
    entry('spec-limits', 'revise', 'P-210|lineal', at(10, 8), { max: 120.3 }),
  ];
  const RACKS = [
    entry('racks', 'create', 'R1', at(11, 6, 30), { qty: 100 }, { line: 'L05', run: run('P-210') }),
    entry('racks', 'create', 'R2', at(11, 7, 30), { qty: 100 }, { line: 'L05', run: run('P-210') }),
    entry('racks', 'create', 'R3', at(11, 8, 30), { qty: 80 }, { line: 'L07', run: run('P-305') }),
    entry('racks', 'disposition', 'R1', at(11, 9), { decision: 'Scrap' }),
  ];
  const SCHEDULE = [
    entry('schedule', 'plan', 'L05|2026-11-11', at(10, 15), { line: 'L05', profile: 'P-210', racksNeeded: 4 }),
  ];

  const DOCS = [
    entry('docs', 'add', 'D1', at(2, 8), { title: 'QCP-12', kind: 'procedure', profile: ['P-210', 'P-305'] }),
    entry('docs', 'add', 'D2', at(2, 8), { title: 'QCP-1', kind: 'procedure', profile: ['all'] }),
    entry('docs', 'add', 'D3', at(2, 8), { title: 'QCP-30', kind: 'procedure', profile: ['P-305'] }),
  ];

  const ZEROS = [
    entry('zeros', 'add', 'Z1', at(1, 8), { code: '', tag: 'blank' }),
    entry('zeros', 'add', 'Z2', at(1, 8), { code: 0, tag: 'zero' }),
  ];

  const NOW = at(11, 12);
  const key = (s, asOf) => s + '@' + asOf.toISOString();
  function dataAt(asOf) {
    const d = {};
    for (const [s, list] of [['spec-limits', SPEC], ['racks', RACKS], ['schedule', SCHEDULE], ['docs', DOCS], ['zeros', ZEROS]]) {
      d[key(s, asOf)] = FP.current.foldEntries(s, list, asOf);
    }
    return d;
  }
  const ctxAt = (asOf, extra) => Object.assign({ asOf, now: NOW, data: dataAt(asOf) }, extra || {});
  const describe = v => FP.fn.describe(v).text;

  function defineLibrary() {
    FP.fn.define({ name: 'CurrentSpec', kind: 'lookup', output: 'record',
      inputs: [{ name: 'profile', type: 'text' }, { name: 'measurement', type: 'text', required: false }],
      reads: { structure: 'spec-limits', from: 'items', match: { profile: 'profile', measurement: 'measurement' }, return: ['min', 'max'], summary: 'latest', window: 'all' } });
    FP.fn.define({ name: 'SpecMax', output: 'any', inputs: [{ name: 'profile', type: 'text' }],
      formula: 'CurrentSpec(profile, "lineal").max' });
    FP.fn.define({ name: 'RacksProduced', kind: 'lookup', output: 'number', inputs: [{ name: 'line', type: 'text' }],
      reads: { structure: 'racks', from: 'entries', action: 'create', match: { 'ref:line': 'line' }, return: '*', summary: 'count' } });
    FP.fn.define({ name: 'QtyForProfile', kind: 'lookup', inputs: [{ name: 'profile', type: 'text' }],
      reads: { structure: 'racks', from: 'entries', action: 'create', match: { 'ref:run.profile': 'profile' }, return: 'qty', summary: 'sum' } });
    FP.fn.define({ name: 'RacksNeeded', kind: 'lookup', inputs: [{ name: 'line', type: 'text' }],
      reads: { structure: 'schedule', from: 'items', match: { line: 'line' }, return: 'racksNeeded', summary: 'latest', window: 'all' } });
    FP.fn.define({ name: 'Attainment', output: 'number', inputs: [{ name: 'line', type: 'text' }],
      formula: 'RacksProduced(line) / RacksNeeded(line)' });
    FP.fn.define({ name: 'RacksLast30Days', kind: 'lookup', output: 'number', inputs: [{ name: 'line', type: 'text' }],
      reads: { structure: 'racks', from: 'entries', action: 'create', match: { 'ref:line': 'line' }, return: '*', summary: 'count', window: { days: 30 } } });
    FP.fn.define({ name: 'DocsFor', kind: 'lookup', output: 'list', inputs: [{ name: 'profile', type: 'text' }],
      reads: { structure: 'docs', from: 'items', match: { kind: { const: 'procedure' }, profile: 'profile' }, return: 'title', summary: 'list', window: 'all' } });
    FP.fn.define({ name: 'TodaysNeed', kind: 'lookup', inputs: [{ name: 'line', type: 'text' }],
      reads: { structure: 'schedule', from: 'items', match: { line: 'line' }, return: 'racksNeeded', window: 'always-current' } });
  }

  function defineMore() {
    FP.fn.define({ name: 'ByCode', kind: 'lookup', output: 'list', inputs: [{ name: 'code', type: 'any', required: false }],
      reads: { structure: 'zeros', from: 'entries', match: { code: 'code' }, return: 'tag', summary: 'list', window: 'all' } });
  }
  const wholeDay = { from: iso(at(11, 0)), to: iso(at(11, 23, 59)) };
  const morning = { from: iso(at(11, 7)), to: iso(at(11, 12)) };

  const CASES = [
    ['Current spec now: latest revision', () => FP.fn.call('CurrentSpec', { profile: 'P-210', measurement: 'lineal' }, ctxAt(NOW)), { id: 'P-210|lineal', min: 119.8, max: 120.3 }],
    ['Current spec as of Nov 5: before the revision', () => FP.fn.call('CurrentSpec', { profile: 'P-210', measurement: 'lineal' }, ctxAt(at(5, 12))).max, 120.2],
    ['Blank optional input matches anything (latest wins)', () => FP.fn.call('CurrentSpec', { profile: 'P-210', measurement: null }, ctxAt(NOW)).id, 'P-210|lineal'],
    ['Reading a field from a lookup in a formula', () => FP.fn.call('SpecMax', { profile: 'P-210' }, ctxAt(NOW)), 120.3],
    ['Spec check through a lookup', () => FP.fn.evaluate('IF(INRANGE(120.25, CurrentSpec("P-210", "lineal").min, CurrentSpec("P-210", "lineal").max), "Pass", "Fail")', {}, ctxAt(NOW)), 'Pass'],
    ['Field arithmetic: max - min', () => FP.fn.evaluate('CurrentSpec("P-210", "lineal").max - CurrentSpec("P-210", "lineal").min', {}, ctxAt(NOW)), 0.5],
    ['Count racks created on L05 over the whole day', () => FP.fn.call('RacksProduced', { line: 'L05' }, ctxAt(NOW, { window: wholeDay })), 2],
    ['The form window narrows it (07:00 to 12:00)', () => FP.fn.call('RacksProduced', { line: 'L05' }, ctxAt(NOW, { window: morning })), 1],
    ['Match a value a session stamped (run profile), sum qty', () => FP.fn.call('QtyForProfile', { profile: 'P-210' }, ctxAt(NOW)), 200],
    ['Sum first, divide last across lookups', () => FP.fn.call('Attainment', { line: 'L05' }, ctxAt(NOW, { window: wholeDay })), 0.5],
    ['A fixed 30-day window ignores the form window', () => FP.fn.call('RacksLast30Days', { line: 'L05' }, ctxAt(NOW, { window: morning })), 2],
    ['Always-current reads today even for an old record', () => FP.fn.call('TodaysNeed', { line: 'L05' }, Object.assign(ctxAt(at(9, 12)), { data: Object.assign(dataAt(at(9, 12)), dataAt(NOW)) })), 4],
    ['A list matches when it contains the value; "all" matches everything', () => FP.fn.call('DocsFor', { profile: 'P-210' }, ctxAt(NOW)).sort().join(','), 'QCP-1,QCP-12'],
    ['List matching ignores capitals', () => FP.fn.call('DocsFor', { profile: 'p-305' }, ctxAt(NOW)).sort().join(','), 'QCP-1,QCP-12,QCP-30'],
    ['As of before anything existed: No data', () => describe(FP.fn.call('CurrentSpec', { profile: 'P-210', measurement: 'lineal' }, ctxAt(at(1, 1)))), 'No data'],
    ['Spec check with no spec: No data, not Fail', () => describe(FP.fn.evaluate('IF(INRANGE(120, CurrentSpec("P-999", "lineal").min, CurrentSpec("P-999", "lineal").max), "Pass", "Fail")', {}, ctxAt(NOW))), 'No data'],
    ['No match: No data', () => describe(FP.fn.call('CurrentSpec', { profile: 'P-999', measurement: 'lineal' }, ctxAt(NOW))), 'No data'],
    ['Data not loaded: Waiting, never a wrong answer', () => describe(FP.fn.call('CurrentSpec', { profile: 'P-210', measurement: 'lineal' }, { asOf: NOW, data: {} })), 'Waiting for data from spec-limits'],
    ['A missing field is an error', () => describe(FP.fn.evaluate('CurrentSpec("P-210", "lineal").nope', {}, ctxAt(NOW))), 'No field nope'],
    ['Data needs found through other functions', () => FP.fn.needs('Attainment').map(x => x.structure).sort().join(','), 'racks,schedule'],
    ['Data needs found in a formula', () => FP.fn.needs('SpecMax("P-210") + 1').map(x => x.structure).join(','), 'spec-limits'],
    ['Refuses a match on an unknown input', () => FP.fn.check({ name: 'BadL1', kind: 'lookup', inputs: [], reads: { structure: 'racks', match: { line: 'line' }, return: 'qty' } })[0], 'match line uses line, which is not one of this lookup\'s inputs'],
    ['A user\'s PIN is never read (whole item)', () => { const d = { [key('users', NOW)]: FP.current.foldEntries('users', [entry('users', 'add', 'U1', at(1, 8), { name: 'Ann', pin: 'x1' })], NOW) }; FP.fn.define({ name: 'TstUser', kind: 'lookup', output: 'record', inputs: [], reads: { structure: 'users', from: 'items', return: '*', summary: 'latest', window: 'all' } }); const v = FP.fn.call('TstUser', {}, { asOf: NOW, now: NOW, data: d }); return 'pin' in v ? 'has pin' : v.name; }, 'Ann'],
    ['A user\'s PIN is never read (by name)', () => { const d = { [key('users', NOW)]: FP.current.foldEntries('users', [entry('users', 'add', 'U1', at(1, 8), { name: 'Ann', pin: 'x1' })], NOW) }; FP.fn.define({ name: 'TstPin', kind: 'lookup', output: 'any', inputs: [], reads: { structure: 'users', from: 'items', return: 'pin', summary: 'latest', window: 'all' } }); return describe(FP.fn.call('TstPin', {}, { asOf: NOW, now: NOW, data: d })); }, 'No data'],
    ['Refuses a bad structure', () => FP.fn.check({ name: 'BadL2', kind: 'lookup', inputs: [], reads: { structure: 'Racks!', return: 'qty' } })[0], 'Bad structure Racks!'],
    ['Refuses a declared output that does not match', () => FP.fn.check({ name: 'BadL3', kind: 'lookup', output: 'number', inputs: [], reads: { structure: 'racks', return: ['a', 'b'] } })[0], 'This lookup gives record, but the output is declared number'],
    // F4: sum, average, min and max need one container to work on; over * or several containers they are refused.
    ['Refuses sum over a whole item', () => FP.fn.check({ name: 'BadS1', kind: 'lookup', inputs: [], reads: { structure: 'racks', from: 'entries', return: '*', summary: 'sum' } }).join(' | '), 'summary sum needs one container to return, not * or several: use latest, first, count or list'],
    ['Refuses average over several containers', () => FP.fn.check({ name: 'BadS2', kind: 'lookup', inputs: [], reads: { structure: 'racks', from: 'entries', return: ['a', 'b'], summary: 'average' } }).join(' | '), 'summary average needs one container to return, not * or several: use latest, first, count or list'],
    ['Refuses min and max over several containers', () => ['min', 'max'].map(m => FP.fn.check({ name: 'BadS3', kind: 'lookup', inputs: [], reads: { structure: 'racks', from: 'entries', return: ['a', 'b'], summary: m } }).length).join(','), '1,1'],
    ['Allows sum over one container', () => FP.fn.check({ name: 'OkS1', kind: 'lookup', inputs: [], reads: { structure: 'racks', from: 'entries', return: 'qty', summary: 'sum' } }).length, 0],
    ['Allows latest, first, count and list over several containers', () => ['latest', 'first', 'count', 'list'].map(m => FP.fn.check({ name: 'OkS2', kind: 'lookup', inputs: [], reads: { structure: 'racks', from: 'entries', return: ['a', 'b'], summary: m } }).length).join(','), '0,0,0,0'],
    // F28: a Waiting optional input is blank (matches anything); an empty value is not 0.
    ['A Waiting optional input counts as blank', () => FP.fn.call('CurrentSpec', { profile: 'P-210', measurement: FP.fn.WAITING }, ctxAt(NOW)).id, 'P-210|lineal'],
    ['A Waiting required input still waits', () => describe(FP.fn.call('CurrentSpec', { profile: FP.fn.WAITING, measurement: null }, ctxAt(NOW))), 'Waiting for profile'],
    ['An optional input with No data counts as blank', () => FP.fn.call('CurrentSpec', { profile: 'P-210', measurement: FP.fn.NODATA }, ctxAt(NOW)).id, 'P-210|lineal'],
    ['0 does not match an empty value', () => FP.fn.call('ByCode', { code: 0 }, ctxAt(NOW)).join(','), 'zero'],
    ['An empty text matches anything (blank input)', () => FP.fn.call('ByCode', { code: '' }, ctxAt(NOW)).slice().sort().join(','), 'blank,zero'],
  ];

  const same = (got, want) => (typeof want === 'number' ? typeof got === 'number' && Math.abs(got - want) < 1e-9 : JSON.stringify(got) === JSON.stringify(want));

  FP.lookupTests = {
    run() {
      const before = new Map(FP.fn.list().map(f => [f.name, f]));
      const results = [];
      try {
        defineLibrary();
        defineMore();
        for (const [name, fn, want] of CASES) {
          let got;
          try { got = fn(); } catch (e) { got = 'threw: ' + e.message; }
          results.push({ name, ok: same(got, want), got, want });
        }
      } finally {
        // Put the library back exactly as it was: remove test functions, restore any replaced.
        FP.fn.list().forEach(f => { if (!before.has(f.name)) FP.fn.remove(f.name); });
        before.forEach((f, name) => { if (FP.fn.get(name) !== f) { try { FP.fn.define(f); } catch (_) { /* keep going */ } } });
      }
      const passed = results.filter(r => r.ok).length;
      return { passed, failed: results.length - passed, results };
    },
  };

  (window.FP.modules = window.FP.modules || {})['fp-lookup-tests'] = '0.68.0';
})();
