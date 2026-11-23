/* Form Platform: function engine test suite (step 5)
 * Load after fp-formula.js. FP.formulaTests.run() returns
 * { passed, failed, results: [{ name, ok, got, want }] } and leaves the
 * library as it found it.
 */
(function () {
  'use strict';
  const FP = window.FP;
  if (!FP || !FP.fn) throw new Error('Load fp-formula.js before fp-formula-tests.js');

  const AS_OF = new Date(2026, 10, 11, 9, 30); // 11 Nov 2026, 09:30 local
  const ctx = { asOf: AS_OF };
  const ev = (f, inputs) => FP.fn.evaluate(f, inputs, ctx);
  const state = v => FP.fn.describe(v).state;
  const close = (a, b) => typeof a === 'number' && Math.abs(a - b) < 1e-9;

  function defineLibrary() {
    FP.fn.define({ name: 'ScrapPct', label: 'Scrap %', kind: 'calculation', output: 'number',
      inputs: [{ name: 'good', type: 'number' }, { name: 'bad', type: 'number' }],
      formula: 'ROUND(bad / (good + bad) * 100, 1)' });
    FP.fn.define({ name: 'InSpec', label: 'In Spec', kind: 'calculation', output: 'text',
      inputs: [{ name: 'value', label: 'Measured OD', type: 'number' }, { name: 'min', type: 'number' }, { name: 'max', type: 'number' }],
      formula: 'IF(INRANGE(value, min, max), "Pass", "Fail")' });
    FP.fn.define({ name: 'ODCheck', kind: 'calculation', output: 'text',
      inputs: [{ name: 'measuredOD', label: 'Measured OD', type: 'number' }, { name: 'spec', type: 'record', fields: { min: 'number', max: 'number' } }],
      formula: 'InSpec(measuredOD, spec.min, spec.max)' });
    FP.fn.define({ name: 'Pad', kind: 'calculation', output: 'number',
      inputs: [{ name: 'a', type: 'number' }, { name: 'b', type: 'number', required: false }],
      formula: 'a + COALESCE(b, 0)' });
    FP.fn.define({ name: 'Attainment', kind: 'summary', output: 'number',
      inputs: [{ name: 'produced', type: 'list' }, { name: 'scheduled', type: 'list' }],
      formula: 'SUM(produced) / SUM(scheduled)' });
  }

  const CASES = [
    ['Precedence: 1 + 2 * 3', () => ev('1 + 2 * 3'), 7],
    ['Brackets: (1 + 2) * 3', () => ev('(1 + 2) * 3'), 9],
    ['Powers group right: 2 ^ 3 ^ 2', () => ev('2 ^ 3 ^ 2'), 512],
    ['Leading = is allowed', () => ev('=10 / 4'), 2.5],
    ['Join text: "R" & 12345', () => ev('"R" & 12345'), 'R12345'],
    ['Compare numbers', () => ev('1.25 >= 1.245'), true],
    ['Compare text ignores case', () => ev('"Pass" = "pass"'), true],
    ['Compare dates', () => ev('"2026-11-10" < "2026-11-11"'), true],
    ['Blank passes through arithmetic', () => ev('x + 1', { x: null }), null],
    ['ISBLANK with IF', () => ev('IF(ISBLANK(x), "none", x)', { x: '' }), 'none'],
    ['ISBLANK of no data', () => ev('IF(ISBLANK(x), "none yet", x.qty)', { x: FP.fn.NODATA }), 'none yet'],
    ['COALESCE past no data', () => ev('COALESCE(x, "fallback")', { x: FP.fn.NODATA }), 'fallback'],
    ['COALESCE takes the first value', () => ev('COALESCE(a, b, 5)', { a: null, b: 3 }), 3],
    ['Divide by zero is an error', () => state(ev('1 / 0')), 'error'],
    ['Text in arithmetic is an error', () => state(ev('"abc" * 2')), 'error'],
    ['ROUND(2.345, 2)', () => ev('ROUND(2.345, 2)'), 2.35],
    ['AVERAGE(1, 2, 3)', () => ev('AVERAGE(1, 2, 3)'), 2],
    ['COUNT skips blanks', () => ev('COUNT(1, x, 3)', { x: null }), 2],
    ['MIN of nothing is No data', () => state(ev('MIN(x)', { x: null })), 'nodata'],
    ['SUM of nothing is 0', () => ev('SUM(x)', { x: [] }), 0],
    ['DATEDIFF in hours', () => ev('DATEDIFF("2026-11-10T06:00:00Z", "2026-11-11T06:00:00Z", "hours")'), 24],
    ['TODAY uses the form time, not the clock', () => ev('TODAY()'), '2026-11-11'],
    ['Unknown names are refused', () => state(ev('constructor')), 'error'],
    ['Record fields only, never internals', () => state(ev('spec.constructor', { spec: { min: 1 } })), 'error'],
    ['Index a list by item ID', () => ev('racks["R-1"].qty', { racks: [{ $id: 'R-1', qty: 5 }, { $id: 'R-2', qty: 7 }] }), 5],
    ['Index by a field\'s value', () => ev('racks[pick].qty', { racks: [{ $id: 'R-1', qty: 5 }, { $id: 'R-2', qty: 7 }], pick: 'R-2' }), 7],
    ['Index a record by name', () => ev('m["b"]', { m: { a: 1, b: 2 } }), 2],
    ['An ID not in the list is No data', () => state(ev('racks["R-9"].qty', { racks: [{ $id: 'R-1', qty: 5 }] })), 'nodata'],
    ['An item\'s facts start with $', () => ev('rack.$status', { rack: { $status: 'Open' } }), 'Open'],
    ['HOUR of a time, with minutes', () => ev('HOUR(t)', { t: new Date(2026, 10, 11, 6, 30).toISOString() }), 6.5],
    ['A shift from a save time', () => ev('IF(AND(HOUR(t) >= 6, HOUR(t) < 18), "Day", "Night")', { t: new Date(2026, 10, 11, 19, 5).toISOString() }), 'Night'],
    ['WEEKDAY: Wednesday is 3', () => ev('WEEKDAY(d)', { d: new Date(2026, 10, 11, 12).toISOString() }), 3],
    ['RANGE makes the hours of a shift', () => JSON.stringify(ev('RANGE(6, 9)')), '[6,7,8,9]'],
    ['IN finds a value in a list', () => ev('IN(7, RANGE(6, 9))'), true],
    ['IN compares text without capitals', () => ev('IN("l05", lines)', { lines: ['L05', 'L07'] }), true],
    ['MOD for hours past midnight', () => ev('MOD(25, 24)'), 1],
    ['FLOOR of an hour with minutes', () => ev('FLOOR(9.75)'), 9],
    ['LIST makes a list', () => JSON.stringify(ev('LIST("L01", 2, "L05")')), '["L01",2,"L05"]'],
    ['FILTER keeps the items the test is true for', () => JSON.stringify(ev('FILTER(racks, item.qty > 5)', { racks: [{ $id: 'R-1', qty: 5 }, { $id: 'R-2', qty: 9 }, { $id: 'R-3' }] }).map(r => r.$id)), '["R-2"]'],
    ['FILTER can use the form\'s own values too', () => ev('COUNT(FILTER(racks, item.line = line))', { line: 'L05', racks: [{ line: 'L05' }, { line: 'L07' }, { line: 'L05' }] }), 2],
    ['EACH works a formula out per item', () => JSON.stringify(ev('EACH(racks, item.$id & ":" & item.qty)', { racks: [{ $id: 'R-1', qty: 5 }, { $id: 'R-2', qty: 9 }] })), '["R-1:5","R-2:9"]'],
    ['SORT numbers', () => JSON.stringify(ev('SORT(LIST(10, 2, 33))')), '[2,10,33]'],
    ['SORT by a value, largest first, blanks last', () => JSON.stringify(ev('SORT(racks, item.qty, "desc")', { racks: [{ $id: 'a', qty: 5 }, { $id: 'b' }, { $id: 'c', qty: 9 }] }).map(r => r.$id)), '["c","a","b"]'],
    ['SORT text naturally (R-2 before R-10)', () => JSON.stringify(ev('SORT(LIST("R-10", "R-2", "r-1"))')), '["r-1","R-2","R-10"]'],
    ['UNIQUE takes repeats out, text without capitals', () => JSON.stringify(ev('UNIQUE(LIST("P-210", "p-210", "P-305", 4, 4))')), '["P-210","P-305",4]'],
    ['JOIN makes one text, blanks left out', () => ev('JOIN(LIST("a", "", "b", c))', { c: null }), 'a, b'],
    ['JOIN with a separator over a list value', () => ev('JOIN(UNIQUE(checks.profile), " / ")', { checks: [{ profile: 'P-210' }, { profile: 'P-305' }, { profile: 'P-210' }] }), 'P-210 / P-305'],
    ['A blank list filters to an empty list', () => JSON.stringify(ev('FILTER(none, item > 1)', { none: null })), '[]'],
    ['item is only known inside FILTER', () => FP.fn.syntax('FILTER(racks, item.qty > qtyMin) + item').refs.join(','), 'racks,qtyMin,item'],
    ['A value of a list is that value of every item', () => JSON.stringify(ev('racks.qty', { racks: [{ $id: 'R-1', qty: 5 }, { $id: 'R-2' }, { $id: 'R-3', qty: 7 }] })), '[5,null,7]'],
    ['SUM over a list\'s value', () => ev('SUM(racks.qty)', { racks: [{ qty: 5 }, { qty: 7 }] }), 12],
    ['A value of a function\'s list', () => JSON.stringify(ev('(racks).qty', { racks: [{ qty: 5 }, { qty: 7 }] })), '[5,7]'],
    ['Never internals through an index', () => state(ev('m["constructor"]', { m: { a: 1 } })), 'nodata'],
    ['Library: Scrap % of 90 good, 10 bad', () => FP.fn.call('ScrapPct', { good: 90, bad: 10 }, ctx), 10],
    ['Library: In Spec passes 1.250', () => FP.fn.call('InSpec', { value: 1.25, min: 1.245, max: 1.255 }, ctx), 'Pass'],
    ['Library: In Spec fails 1.260', () => FP.fn.call('InSpec', { value: 1.26, min: 1.245, max: 1.255 }, ctx), 'Fail'],
    ['Text in a number input is an error, not a Fail', () => FP.fn.describe(FP.fn.call('InSpec', { value: 'abc', min: 1.245, max: 1.255 }, ctx)).text, 'Measured OD needs a number'],
    ['No data passes through built-ins (never a Fail)', () => state(ev('IF(INRANGE(1.25, x, 1.3), "Pass", "Fail")', { x: FP.fn.NODATA })), 'nodata'],
    ['No data in a required input gives No data', () => state(FP.fn.call('InSpec', { value: 1.25, min: FP.fn.NODATA, max: FP.fn.NODATA }, ctx)), 'nodata'],
    ['Aggregates skip No data', () => ev('SUM(1, x, 2)', { x: FP.fn.NODATA }), 3],
    ['Blank required input gives Waiting', () => FP.fn.describe(FP.fn.call('InSpec', { value: null, min: 1.245, max: 1.255 }, ctx)).text, 'Waiting for Measured OD'],
    ['Functions call functions', () => FP.fn.call('ODCheck', { measuredOD: 1.251, spec: { min: 1.245, max: 1.255 } }, ctx), 'Pass'],
    ['Waiting passes up a chain', () => state(FP.fn.call('ODCheck', { measuredOD: null, spec: { min: 1, max: 2 } }, ctx)), 'waiting'],
    ['Sum first, divide last (not an average of percentages)', () => FP.fn.call('Attainment', { produced: [90, 10], scheduled: [100, 50] }, ctx), 100 / 150],
    ['Inline formula using a library function', () => ev('ScrapPct(good, bad) > 5', { good: 90, bad: 10 }), true],
    ['Refuses unknown names when defined', () => FP.fn.check({ name: 'Bad1', inputs: [], formula: 'nope + 1' })[0], 'Unknown name nope'],
    ['Refuses wrong types when defined', () => FP.fn.check({ name: 'Bad2', inputs: [{ name: 't', type: 'text' }], formula: 't * 2' })[0], '* needs numbers, but the left side is text'],
    ['Refuses wrong input counts', () => FP.fn.check({ name: 'Bad3', inputs: [], formula: 'ROUND()' })[0], 'ROUND takes 1 to 2 inputs, not 0'],
    ['Refuses a declared output that does not match', () => FP.fn.check({ name: 'Bad4', inputs: [], output: 'number', formula: '"text"' })[0], 'The formula gives text, but the output is declared number'],
    ['Refuses built-in names', () => FP.fn.check({ name: 'Sum', inputs: [], formula: '1' })[0], 'Sum is a built-in function name'],
    ['Refuses loops', () => {
      FP.fn.define({ name: 'LoopA', inputs: [], formula: '1' });
      FP.fn.define({ name: 'LoopB', inputs: [], formula: 'LoopA() + 1' });
      try { FP.fn.define({ name: 'LoopA', inputs: [], formula: 'LoopB() + 1' }); return 'defined'; }
      catch (e) { return e.problems[0]; }
    }, 'Loop: LoopA → LoopB → LoopA'],
    ['Refuses chains deeper than 4', () => {
      FP.fn.define({ name: 'D1', inputs: [], formula: '1' });
      FP.fn.define({ name: 'D2', inputs: [], formula: 'D1()' });
      FP.fn.define({ name: 'D3', inputs: [], formula: 'D2()' });
      FP.fn.define({ name: 'D4', inputs: [], formula: 'D3()' });
      try { FP.fn.define({ name: 'D5', inputs: [], formula: 'D4()' }); return 'defined'; }
      catch (e) { return e.problems[0]; }
    }, 'D5 nests functions 5 deep; the limit is 4'],
    ['Summary latest ignores input order', () => FP.summary.apply('latest', [{ value: 'B', at: '2026-11-11T10:00:00Z' }, { value: 'A', at: '2026-11-11T09:00:00Z' }]), 'B'],
    ['Summary sum', () => FP.summary.apply('sum', [{ value: 24000 }, { value: 16000 }]), 40000],
    ['Summary count skips blanks', () => FP.summary.apply('count', [{ value: 1 }, { value: null }, { value: 3 }]), 2],
    ['Summary average of nothing is No data', () => state(FP.summary.apply('average', [])), 'nodata'],
    ['Formatting changes the look, not the value', () => FP.fn.describe(1.25, { decimals: 3, unit: 'in' }).text, '1.250 in'],
    ['Syntax errors say where', () => FP.fn.describe(ev('1 + (2')).text, 'Expected a closing ) at position 7'],
    // 0.43: dates moved and rounded, text, lists.
    ['STARTOF hour', () => ev('TEXT(STARTOF(NOW(), "hour"), "yyyy-MM-dd HH:mm")'), '2026-11-11 09:00'],
    ['DATEADD back an hour', () => ev('TEXT(DATEADD(STARTOF(NOW(), "hour"), -1, "hours"), "h:mm AM/PM")'), '8:00 AM'],
    ['DATEADD days keeps a date alone', () => ev('DATEADD("2026-11-30", 2, "days")'), '2026-12-02'],
    ['STARTOF week is Monday', () => ev('TEXT(STARTOF(NOW(), "week"), "ddd MMM d")'), 'Mon Nov 9'],
    ['Slots compare as times', () => ev('DATEADD(STARTOF(NOW(), "hour"), 1, "hours") > NOW()'), true],
    ['TEXT 12-hour clock', () => ev('TEXT(DATEADD(STARTOF(NOW(), "day"), 17, "hours"), "h AM")'), '5 PM'],
    ['TEXT percent', () => ev('TEXT(0.1234, "0.0%")'), '12.3%'],
    ['TEXT thousands', () => ev('TEXT(1234567.8, "#,##0")'), '1,234,568'],
    ['TEXT number without a format', () => ev('TEXT(17)'), '17'],
    ['FIRST and LAST', () => ev('FIRST(LIST(3, 4, 5)) & LAST(LIST(3, 4, 5))'), '35'],
    ['FIRST of nothing is No data', () => state(ev('FIRST(LIST())')), 'nodata'],
    ['INDEX from the end', () => ev('INDEX(LIST("a", "b", "c"), -2)'), 'b'],
    // F3: a date alone ("2026-11-18", what TODAY() gives) is a LOCAL day: the same weekday, hour 0 and date text in every time zone.
    ['A date alone is a local day: WEEKDAY', () => ev('WEEKDAY("2026-11-18")'), 3],
    ['A date alone is midnight, not the evening before: HOUR', () => ev('HOUR("2026-11-18")'), 0],
    ['WEEKDAY(TODAY()) on the form clock', () => ev('WEEKDAY(TODAY())'), 3],
    ['HOUR(TODAY()) is 0', () => ev('HOUR(TODAY())'), 0],
    ['TEXT of a date alone: day name', () => ev('TEXT("2026-11-18", "dddd d MMM yyyy")'), 'Wednesday 18 Nov 2026'],
    ['DATEDIFF of two dates alone: whole days', () => ev('DATEDIFF("2026-11-18", "2026-11-25")'), 7],
    ['DATEDIFF across the autumn clock change is still whole days', () => ev('DATEDIFF("2026-10-31", "2026-11-08")'), 8],
    ['DATEDIFF across the spring clock change is still whole days', () => ev('DATEDIFF("2026-03-05", "2026-03-20")'), 15],
    ['STARTOF week of a date alone is that Monday', () => ev('TEXT(STARTOF("2026-11-18", "week"), "yyyy-MM-dd")'), '2026-11-16'],
    ['DATEADD days keeps a date alone', () => ev('DATEADD("2026-11-18", 1, "days")'), '2026-11-19'],
    // F22: ROUND goes away from zero at .5, as Excel does.
    ['ROUND(-2.5) is -3', () => ev('ROUND(-2.5)'), -3],
    ['ROUND(2.5) is 3', () => ev('ROUND(2.5)'), 3],
    ['ROUND(-1.25, 1) is -1.3', () => ev('ROUND(-1.25, 1)'), -1.3],
    ['ROUND(-0.4) is 0', () => ev('TEXT(ROUND(-0.4))'), '0'],
    // F23: text that is not a number is skipped, never NaN.
    ['SUM skips text that is not a number', () => ev('SUM(LIST(1, "abc", 2))'), 3],
    ['SUM of only text is 0', () => ev('SUM("abc")'), 0],
    ['MIN skips text', () => ev('MIN(LIST(4, "abc", 2))'), 2],
    ['MAX of only text is No data', () => state(ev('MAX("abc")')), 'nodata'],
    ['AVERAGE skips text', () => ev('AVERAGE(LIST(4, "n/a", 2))'), 3],
    ['AVERAGE of only text is No data', () => state(ev('AVERAGE("abc")')), 'nodata'],
    // F24
    ['RIGHT(x, 0) is empty', () => ev('RIGHT("abc", 0)'), ''],
    ['RIGHT(x, 2)', () => ev('RIGHT("abc", 2)'), 'bc'],
    ['LEFT(x, 0) is empty', () => ev('LEFT("abc", 0)'), ''],
    // F25: months stop at the end of a shorter month.
    ['DATEADD 1 month from Jan 31', () => ev('DATEADD("2026-01-31", 1, "months")'), '2026-02-28'],
    ['DATEADD 1 month from Jan 31 in a leap year', () => ev('DATEADD("2028-01-31", 1, "months")'), '2028-02-29'],
    ['DATEADD -1 month from Mar 31', () => ev('DATEADD("2026-03-31", -1, "months")'), '2026-02-28'],
    ['DATEADD 12 months from Feb 29', () => ev('DATEADD("2028-02-29", 12, "months")'), '2029-02-28'],
    ['DATEADD a time by a month keeps the time', () => ev('TEXT(DATEADD(t, 1, "months"), "yyyy-MM-dd HH:mm")', { t: new Date(2026, 0, 31, 10, 15).toISOString() }), '2026-02-28 10:15'],
    // F26: Error beats Waiting beats No data, whichever side of an operator each is on.
    ['Operator: No data then Waiting is Waiting', () => state(ev('a + b', { a: FP.fn.NODATA, b: FP.fn.WAITING })), 'waiting'],
    ['Operator: Waiting then No data is Waiting', () => state(ev('a + b', { a: FP.fn.WAITING, b: FP.fn.NODATA })), 'waiting'],
    ['Operator: No data then an error is the error', () => state(ev('a & b', { a: FP.fn.NODATA, b: ev('1/0') })), 'error'],
    ['Operator: Waiting then an error is the error', () => state(ev('a * b', { a: FP.fn.WAITING, b: ev('1/0') })), 'error'],
    ['Operator: No data and No data is No data', () => state(ev('a - b', { a: FP.fn.NODATA, b: FP.fn.NODATA })), 'nodata'],
    // F27: an optional input of a library function may be left out; a required one may not.
    ['An optional input can be left out (runs)', () => ev('Pad(5)'), 5],
    ['An optional input can be given', () => ev('Pad(5, 2)'), 7],
    ['An optional input left out passes the publish check', () => FP.fn.check({ name: 'UsesPad', output: 'number', inputs: [], formula: 'Pad(5)' }).length, 0],
    ['A required input left out is still refused', () => FP.fn.check({ name: 'UsesPad2', inputs: [], formula: 'Pad()' })[0], 'Pad takes 1 to 2 inputs, not 0'],
    ['Too many inputs are refused', () => FP.fn.check({ name: 'UsesPad3', inputs: [], formula: 'Pad(1, 2, 3)' })[0], 'Pad takes 1 to 2 inputs, not 3'],
    ['A function with no optional inputs keeps its message', () => FP.fn.check({ name: 'UsesScrap', inputs: [], formula: 'ScrapPct(1)' })[0], 'ScrapPct takes 2 inputs, not 1'],
  ];

  const same = (got, want) => (typeof want === 'number' ? close(got, want) : JSON.stringify(got) === JSON.stringify(want));

  FP.formulaTests = {
    run() {
      const before = new Map(FP.fn.list().map(f => [f.name, f]));
      const results = [];
      try {
        defineLibrary();
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

  (window.FP.modules = window.FP.modules || {})['fp-formula-tests'] = '0.63.0';
})();
