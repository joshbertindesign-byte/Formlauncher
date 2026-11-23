/* The production pilot, rebuilt for 0.51 from the same workbooks (Profiles, the 2025 and 2026 production reports,
 * the production schedule), for shared terminals:
 *   - Line terminals: a supervisor signs in and stays responsible; whoever does the work taps their name (Who did it).
 *     Kiosk view, the Lines board as the home form; its cards open the hourly check, a rack and a changeover,
 *     filled in with the line and its operator.
 *   - The QC office PC: people sign in; admin view (the forms down the left), the Needs board as the home form.
 * Simpler than the first pilot: values carried from item sources instead of copy fields, calculated values on the
 * structures (a need's label and color name), NAME.selected (tap a need to change it, a profile or line to edit it,
 * a run to see its checks), and no "every line" toggle: the board shows every running line. */
const COLORS = [
  { value: 'W', label: 'White' }, { value: 'AL', label: 'Almond' }, { value: 'BLK', label: 'Black' },
  { value: 'DS', label: 'Desert Sand' }, { value: 'BRZ', label: 'Bronze' }, { value: 'MS', label: 'Mix sell' },
];
const PASSFAIL = { options: ['Pass', 'Fail'], colors: { Pass: 'good', Fail: 'bad' } };
const PRIORITY = [{ value: 1, label: '1 · first' }, { value: 2, label: '2' }, { value: 3, label: '3 · last' }];
const ALL = ['all'];
const NOWHOUR = 'STARTOF(NOW(), "hour")';
const LASTHOUR = 'DATEADD(STARTOF(NOW(), "hour"), -1, "hours")';
const SLOTS = 'item.startAt, item.doneSlots, item.shiftEndAt';

const functions = [
  // ---- Whole lists, filtered where they are used ----
  ['NeedsAll', { label: 'Every need', kind: 'lookup', output: 'list', inputs: [], reads: { structure: 'needs', from: 'items', return: '*', summary: 'list', window: 'all' } }],
  // (0.60: every line, every profile and every partial rack are read with items sources, picks and "the open one".)
  ['RunsRecent', { label: 'Runs of the last 3 days', kind: 'lookup', output: 'list', inputs: [], reads: { structure: 'runs', from: 'items', return: '*', summary: 'list', window: { days: 3 } } }],
  ['RunsAll', { label: 'Runs of the last 400 days (for the report)', kind: 'lookup', output: 'list', inputs: [], reads: { structure: 'runs', from: 'items', return: '*', summary: 'list', window: { days: 400 } } }],
  ['RacksRecent', { label: 'Racks of the last 3 days', kind: 'lookup', output: 'list', inputs: [], reads: { structure: 'racks', from: 'items', return: '*', summary: 'list', window: { days: 3 } } }],
  ['LastRunOn', { label: 'The latest run on a line', kind: 'lookup', output: 'record', inputs: [{ name: 'line', type: 'text' }],
    reads: { structure: 'runs', from: 'items', match: { line: 'line' }, return: '*', summary: 'latest', window: 'all' } }],
  // ---- The trace (0.55): one rack back to its run, and the run to its shift, need, checks and racks, a year back ----
  ['TraceRun', { label: 'A run by its ID (a year back)', kind: 'lookup', output: 'record', inputs: [{ name: 'run', type: 'text' }],
    reads: { structure: 'runs', from: 'items', match: { $id: 'run' }, return: '*', summary: 'latest', window: { days: 400 } } }],
  ['TraceShift', { label: 'A shift by its ID (a year back)', kind: 'lookup', output: 'record', inputs: [{ name: 'shift', type: 'text' }],
    reads: { structure: 'shifts', from: 'items', match: { $id: 'shift' }, return: '*', summary: 'latest', window: { days: 400 } } }],
  ['TraceNeed', { label: 'A need by its ID', kind: 'lookup', output: 'record', inputs: [{ name: 'need', type: 'text' }],
    reads: { structure: 'needs', from: 'items', match: { $id: 'need' }, return: '*', summary: 'latest', window: 'all' } }],
  ['TraceChecks', { label: 'Hour checks of a run (a year back)', kind: 'lookup', output: 'list', inputs: [{ name: 'run', type: 'text' }],
    reads: { structure: 'runs', from: 'entries', action: 'hourly', match: { $id: 'run' }, window: { days: 400 }, return: ['slot', 'lineStatus', 'lengthAct', 'lengthDev', 'surface', 'colorCheck', 'gaugeCheck', 'speed', 'weight', 'checkedBy'], summary: 'list' } }],
  ['TraceRacks', { label: 'Racks made on a run (a year back)', kind: 'lookup', output: 'list', inputs: [{ name: 'run', type: 'text' }],
    reads: { structure: 'racks', from: 'items', match: { run: 'run' }, return: '*', summary: 'list', window: { days: 400 } } }],
  ['RunChecks', { label: 'Hour checks of a run', kind: 'lookup', output: 'list', inputs: [{ name: 'run', type: 'text' }],
    reads: { structure: 'runs', from: 'entries', action: 'hourly', match: { $id: 'run' }, window: { days: 2 }, return: ['slot', 'lineStatus', 'lengthAct', 'lengthDev', 'surface', 'colorCheck', 'gaugeCheck', 'speed', 'weight', 'checkedBy'], summary: 'list' } }],
  ['ChecksRecent', { label: 'Hour checks of the last 31 days', kind: 'lookup', output: 'list', inputs: [],
    reads: { structure: 'runs', from: 'entries', action: 'hourly', return: ['slot', 'line', 'part', 'profile', 'color', 'lineStatus', 'lengthAct', 'lengthDev', 'surface', 'colorCheck', 'surfaceBad', 'colorBad', 'speed', 'weight'], summary: 'list', window: { days: 31 } } }],

  // ---- Words ----
  ['ColorName', { label: 'A color code in words', output: 'text', inputs: [{ name: 'code', type: 'text', required: false }],
    formula: 'IF(code = "W", "White", IF(code = "AL", "Almond", IF(code = "BLK", "Black", IF(code = "DS", "Desert Sand", IF(code = "BRZ", "Bronze", IF(code = "MS", "Mix sell", code))))))' }],
  ['NeedLabel', { label: 'A need in words', output: 'text', inputs: [{ name: 'profile', type: 'text', required: false }, { name: 'color', type: 'text', required: false }, { name: 'racks', type: 'number', required: false }],
    formula: 'profile & " " & ColorName(color) & " · " & racks & " racks"' }],
  ['OffLineNote', { label: 'Racks of a need made on other lines, in words', output: 'text', inputs: [{ name: 'n', type: 'number', required: false }],
    formula: 'IF(COALESCE(n, 0) > 0, " · " & n & " made on other lines", "")' }],

  // ---- Needs: a line runs its own first; another line's when nobody runs it ----
  ['OpenNeedsFor', { label: 'Open needs of a line, first first', output: 'list', inputs: [{ name: 'line', type: 'text' }],
    formula: 'SORT(FILTER(NeedsAll(), AND(item.line = line, item.$open)), item.priority & "|" & item.$firstAt)' }],
  ['NeedsRunningElsewhere', { label: 'Needs being run now on other lines', output: 'list', inputs: [{ name: 'position', type: 'text' }],
    formula: 'EACH(FILTER(RunsRecent(), AND(item.$status = "Running", NOT(ISBLANK(item.need)), item.line <> position)), item.need)' }],
  ['NeedChoices', { label: 'Needs a line can run: its own, then other lines\' not running', output: 'list',
    inputs: [{ name: 'position', type: 'text' }, { name: 'line', type: 'text' }, { name: 'taken', type: 'list', required: false }],
    formula: 'SORT(FILTER(NeedsAll(), AND(item.$open, OR(item.line = line, item.$id = IF(ISBLANK(LastRunOn(position).need), "", LastRunOn(position).need), AND(NOT(IN(item.$id, NeedsRunningElsewhere(position))), NOT(IN(item.$id, COALESCE(taken, LIST()))))))), IF(item.line = line, "0", "1") & "|" & item.line & "|" & item.priority & "|" & item.$firstAt)' }],
  ['NextNeed', { label: 'The need a line runs next', output: 'text', inputs: [{ name: 'position', type: 'text' }, { name: 'line', type: 'text' }],
    formula: 'IF(ISBLANK(LastRunOn(position).need), FIRST(OpenNeedsFor(line)).$id, IF(IN(LastRunOn(position).need, EACH(OpenNeedsFor(line), item.$id)), LastRunOn(position).need, FIRST(OpenNeedsFor(line)).$id))' }],

  // ---- Hour checks: due during the hour, late during the next, then closed ----
  ['SlotsOpen', { label: 'Hours a run can still be checked for', output: 'list',
    inputs: [{ name: 'startAt', type: 'date' }, { name: 'done', type: 'list', required: false }, { name: 'endAt', type: 'date', required: false }],
    formula: `FILTER(LIST(${LASTHOUR}, ${NOWHOUR}), AND(item >= STARTOF(startAt, "hour"), OR(ISBLANK(endAt), item < endAt), NOT(IN(item, COALESCE(done, LIST())))))` }],
  ['SlotState', { label: 'How a run stands on hour checks', output: 'text',
    inputs: [{ name: 'startAt', type: 'date' }, { name: 'done', type: 'list', required: false }, { name: 'endAt', type: 'date', required: false }],
    formula: `IF(COUNT(FILTER(SlotsOpen(startAt, done, endAt), item < ${NOWHOUR})) > 0, "late", IF(COUNT(SlotsOpen(startAt, done, endAt)) > 0, "due", "done"))` }],
  ['SlotNote', { label: 'Hour checks owed, in words', output: 'text',
    inputs: [{ name: 'startAt', type: 'date' }, { name: 'done', type: 'list', required: false }, { name: 'endAt', type: 'date', required: false }],
    formula: `IF(COUNT(SlotsOpen(startAt, done, endAt)) = 0, "checks up to date", JOIN(EACH(SlotsOpen(startAt, done, endAt), TEXT(item, "h AM") & IF(item < ${NOWHOUR}, " check late", " check due")), " · "))` }],
  ['SlotUrgency', { label: 'Late first, then due, then up to date', output: 'number',
    inputs: [{ name: 'startAt', type: 'date' }, { name: 'done', type: 'list', required: false }, { name: 'endAt', type: 'date', required: false }],
    formula: 'IF(SlotState(startAt, done, endAt) = "late", 0, IF(SlotState(startAt, done, endAt) = "due", 1, 2))' }],
  ['MissedChecks', { label: 'Hours that closed without a check', output: 'number',
    inputs: [{ name: 'startAt', type: 'date' }, { name: 'done', type: 'list', required: false }, { name: 'endAt', type: 'date', required: false }, { name: 'shiftEndAt', type: 'date', required: false }],
    formula: `MAX(0, ROUND(DATEDIFF(STARTOF(startAt, "hour"), IF(AND(NOT(ISBLANK(COALESCE(endAt, shiftEndAt))), COALESCE(endAt, shiftEndAt) < ${LASTHOUR}), COALESCE(endAt, shiftEndAt), ${LASTHOUR}), "hours") + 0.4999, 0) - COUNT(FILTER(COALESCE(done, LIST()), AND(item >= STARTOF(startAt, "hour"), item < IF(AND(NOT(ISBLANK(COALESCE(endAt, shiftEndAt))), COALESCE(endAt, shiftEndAt) < ${LASTHOUR}), COALESCE(endAt, shiftEndAt), ${LASTHOUR})))))` }],

  // ---- Footage and pounds (the report's columns) ----
  ['PrimeFeet', { label: 'Feet of good pieces', output: 'number', inputs: [{ name: 'pieces', type: 'number', required: false }, { name: 'lengthIn', type: 'number', required: false }],
    formula: 'COALESCE(pieces, 0) * COALESCE(lengthIn, 0) / 12' }],
  ['WtPerFt', { label: 'Pounds per foot: measured, or nominal', output: 'number', inputs: [{ name: 'measured', type: 'number', required: false }, { name: 'nominal', type: 'number', required: false }],
    formula: 'COALESCE(measured, nominal, 0)' }],
  ['Lbs', { label: 'Pounds from feet', output: 'number', inputs: [{ name: 'ft', type: 'number', required: false }, { name: 'wt', type: 'number', required: false }],
    formula: 'COALESCE(ft, 0) * COALESCE(wt, 0)' }],
  ['AddUp', { label: 'Two numbers added, blanks as 0', output: 'number', inputs: [{ name: 'a', type: 'number', required: false }, { name: 'b', type: 'number', required: false }],
    formula: 'COALESCE(a, 0) + COALESCE(b, 0)' }],
  ['Share', { label: 'A part of a whole', output: 'any', inputs: [{ name: 'part', type: 'number', required: false }, { name: 'whole', type: 'number', required: false }],
    formula: 'IF(COALESCE(whole, 0) > 0, COALESCE(part, 0) / whole, "")' }],
  ['RunHours', { label: 'Hours a run ran', output: 'number', inputs: [{ name: 'startAt', type: 'date' }, { name: 'endAt', type: 'date', required: false }, { name: 'shiftEndAt', type: 'date', required: false }],
    formula: 'ROUND(DATEDIFF(startAt, IF(NOT(ISBLANK(endAt)), endAt, IF(AND(NOT(ISBLANK(shiftEndAt)), shiftEndAt < NOW()), shiftEndAt, NOW())), "hours"), 2)' }],
];

const structures = [
  ['profiles', { label: 'Profiles', kind: 'list', roles: { active: 'active' }, sites: ALL, itemId: { label: 'Profile', made: 'entered' },
    containers: { part: {}, customer: {}, lengthIn: {}, lengthTol: {}, pcsPerRack: {}, wtLow: {}, wtNom: {}, wtHigh: {}, pattern: {}, gauge: {}, active: {}, notes: {} } }],
  ['lines', { label: 'Lines', kind: 'list', roles: { active: 'active' }, sites: ALL, itemId: { label: 'Line', made: 'entered' },
    containers: { line: {}, active: {}, notes: {} } }],
  ['needs', { label: 'Needs', kind: 'orders', roles: { wanted: 'racks', done: 'made', cancelled: 'cancelled', due: 'due' }, sites: ALL, live: { days: 60 }, itemId: { label: 'Need' },
    containers: { line: {}, profile: {}, part: {}, customer: {}, color: {}, racks: {}, priority: {}, due: {}, notes: {}, cancelled: {}, made: { rule: 'sum' },
      madeOffLine: { rule: 'sum' }, madeOn: {}, madeOnLines: { from: 'madeOn', rule: 'list' } },
    // Worked out on the need itself (0.51 pilot): no copy fields on the forms.
    calculated: {
      colorName: { fn: 'ColorName', inputs: { code: 'color' } },
      label: { fn: 'NeedLabel', inputs: { profile: 'profile', color: 'color', racks: 'racks' } },
      offLineNote: { fn: 'OffLineNote', inputs: { n: 'madeOffLine' } },
    } }],
  ['shifts', { label: 'Shifts', kind: 'runs', roles: { ended: 'endedAt', started: 'startAt' }, sites: ALL, live: { days: 60 }, itemId: { label: 'Shift', made: 'entered' },
    containers: { operator: {}, crew: {}, startAt: {}, hours: {}, endAt: {}, lines: {}, caliperOn: {}, caliperOff: {}, endedAt: {}, endedBy: {}, notes: {} },
    // A runs kind (0.59): Ended and Running are its own; Over is the shift's, while it is still open.
    status: [{ value: 'Over', when: 'endAt < NOW()' }] }],
  ['runs', { label: 'Runs', kind: 'runs', roles: { ended: 'endAt', started: 'startAt' }, sites: ALL, live: { days: 60 }, itemId: { label: 'Run', made: 'entered' },
    containers: {
      shift: {}, operator: {}, crew: {}, date: {}, line: {}, machine: {}, need: {}, needLine: {}, offLine: {}, profile: {}, part: {}, customer: {}, color: {},
      material: {}, materialKey: {}, lengthNom: {}, lengthTol: {}, wtNom: {}, wtLow: {}, wtHigh: {}, pcsPerRack: {}, gauge: {},
      startAt: {}, shiftEndAt: {}, endAt: {}, endReason: {}, partialLeft: {}, scrapFt: {}, adoptedPartial: {}, adoptedPieces: {},
      weatherStrip: {}, wsStrands: {}, wsColor: {}, wsSize: {}, notes: {},
      racks: { rule: 'sum' }, pieces: { rule: 'sum' },
      slot: {}, lineStatus: {}, lengthAct: {}, lengthDev: {}, surface: {}, colorCheck: {}, gaugeCheck: {}, speed: {}, weight: {}, checkedBy: {}, checkNote: {},
      doneSlots: { from: 'slot', rule: 'list' }, checks: { from: 'slot', rule: 'count' },
      avgSpeed: { from: 'speed', rule: 'average' }, avgWeight: { from: 'weight', rule: 'average' }, avgLength: { from: 'lengthAct', rule: 'average' },
      surfaceFails: { from: 'surfaceBad', rule: 'sum' }, colorFails: { from: 'colorBad', rule: 'sum' },
    },
    calculated: {
      colorName: { fn: 'ColorName', inputs: { code: 'color' } },
      primeFt: { fn: 'PrimeFeet', inputs: { pieces: 'pieces', lengthIn: 'lengthNom' } },
      wtFt: { fn: 'WtPerFt', inputs: { measured: 'avgWeight', nominal: 'wtNom' } },
      primeLbs: { fn: 'Lbs', inputs: { ft: 'primeFt', wt: 'wtFt' } },
      scrapLbs: { fn: 'Lbs', inputs: { ft: 'scrapFt', wt: 'wtFt' } },
      totalLbs: { fn: 'AddUp', inputs: { a: 'primeLbs', b: 'scrapLbs' } },
      scrapPct: { fn: 'Share', inputs: { part: 'scrapLbs', whole: 'totalLbs' } },
      hours: { fn: 'RunHours', inputs: { startAt: 'startAt', endAt: 'endAt', shiftEndAt: 'shiftEndAt' } },
      missed: { fn: 'MissedChecks', inputs: { startAt: 'startAt', done: 'doneSlots', endAt: 'endAt', shiftEndAt: 'shiftEndAt' } },
    },
    status: [{ value: 'Shift over', when: 'shiftEndAt < NOW()' }] }],
  ['racks', { label: 'Racks', kind: 'inventory', roles: { quantity: 'pieces', madeFrom: 'run' }, sites: ALL, live: { days: 60 }, itemId: { label: 'Rack ID', made: 'entered', once: true },
    containers: { run: {}, shift: {}, operator: {}, crew: {}, date: {}, line: {}, machine: {}, need: {}, needLine: {}, offLine: {}, profile: {}, part: {}, customer: {}, color: {}, pieces: {}, partial: {}, partialPieces: {}, madeAt: {}, notes: {} } }],
  ['partials', { label: 'Partial racks', kind: 'inventory', roles: { quantity: 'pieces', place: 'location', madeFrom: 'fromRun', gone: 'adoptedRun' }, sites: ALL, live: { days: 60 }, itemId: { label: 'Partial rack', made: 'entered' },
    containers: { profile: {}, part: {}, customer: {}, color: {}, pieces: {}, fromRun: {}, line: {}, location: {}, adoptedRun: {}, adoptedAt: {}, adoptedBy: {} } }],
];

/* ---------- Pieces the line forms share ---------- */
const running = { name: 'running', kind: 'items', structure: 'runs', filter: 'status = "Running"' };
const URGENCY = `SlotUrgency(${SLOTS})`;
// The line: every running line, the most urgent first; the line board fills it in.
const runPick = extra => Object.assign({ name: 'run', control: 'choice', label: 'Line', required: true, optionsFrom: `SORT(running, ${URGENCY} & "|" & item.line)`,
  optionLabel: 'item.line & " · " & item.part & " " & item.customer & " · " & item.colorName' }, extra || {});
// Whoever does the work taps their name; a supervisor confirms with their PIN. The line board fills in the run's operator.
const who = (to, label) => Object.assign({ name: 'who', control: 'person', label: label || 'Who did it', required: true }, to ? { writes: to } : {});
const RUN_WRITES = ['shift', 'operator', 'crew', 'date', 'line', 'machine', 'need', 'needLine', 'offLine', 'profile', 'part', 'customer', 'color', 'material', 'materialKey',
  'lengthNom', 'lengthTol', 'wtNom', 'wtLow', 'wtHigh', 'pcsPerRack', 'gauge', 'startAt', 'shiftEndAt', 'adoptedPartial', 'adoptedPieces', 'weatherStrip', 'wsStrands', 'wsColor', 'wsSize'];
const writes = names => Object.fromEntries(names.map(n => [n, 'write']));
const reads = names => Object.fromEntries(names.map(n => [n, 'read']));
const both = names => Object.fromEntries(names.map(n => [n, 'both']));

/* A new run (start of shift, and changeover): what it makes, from its need (or a profile and color not on the
 * needs list), its material, weather strip, and a waiting partial rack. The need and the profile are item sources
 * that carry their values onto the run. o: { when, target, machine, position, taken, defaultNeed, runId, operator }. */
function newRun(o) {
  const W = c => (o.when && c ? `AND(${o.when}, ${c})` : o.when || c);
  const w = (f, c) => { const x = W(c); return x ? Object.assign(f, { when: x }) : f; };
  // The color it makes, as a code: the need's, or the one picked (0.60: a field, so the partial rack can be found by it).
  const COLOR = 'colorCode';
  const sources = [
    { name: 'needRec', kind: 'item', structure: 'needs', id: { field: 'need' }, values: reads(['line', 'profile', 'color', 'racks', 'made']),
      carry: { to: o.target, when: W('NOT(ISBLANK(need))'), values: { needLine: 'line', offLine: `= needRec.line <> ${o.machine}` } } },
    { name: 'prof', kind: 'item', structure: 'profiles', id: { field: 'profile' }, values: reads(['part', 'customer', 'lengthIn', 'lengthTol', 'wtNom', 'wtLow', 'wtHigh', 'pcsPerRack', 'gauge']),
      carry: { to: o.target, when: o.when, values: { profile: '$id', part: 'part', customer: 'customer', lengthNom: 'lengthIn', lengthTol: '= COALESCE(prof.lengthTol, 0.25)',
        wtNom: 'wtNom', wtLow: 'wtLow', wtHigh: 'wtHigh', pcsPerRack: 'pcsPerRack', gauge: 'gauge', color: `= ${COLOR}`, materialKey: `= material & " " & ColorName(${COLOR})` } } },
    // A partial rack of what it makes, still in stock (0.60: the open one whose profile and color are this run's), marked
    // as used by this run; the run keeps which one and its pieces.
    { name: 'partial', kind: 'item', structure: 'partials', id: { open: { profile: 'profile', color: 'colorCode' } },
      values: Object.assign(reads(['pieces', 'line', 'location']), writes(['adoptedRun', 'adoptedAt', 'adoptedBy'])),
      carry: [
        { to: 'partial', when: W('adopt = TRUE'), values: { adoptedRun: `= ${o.runId}`, adoptedAt: '= NOW()', adoptedBy: `= ${o.operator}` } },
        { to: o.target, when: W('adopt = TRUE'), values: { adoptedPartial: '$id', adoptedPieces: 'pieces' } },
      ] },
  ];
  const fields = [
    w({ name: 'noNeeds', control: 'badge', label: 'Needs', colors: { '*': 'warn' },
      formula: `"No open needs for " & ${o.machine} & IF(COUNT(FILTER(NeedChoices(${o.position}, ${o.machine}, ${o.taken}), item.line <> ${o.machine})) > 0, ". The needs below are other lines' that nobody is running: pick one to run it here, or Not on the needs list.", ". Pick Not on the needs list and choose the profile.")` },
      `COUNT(OpenNeedsFor(${o.machine})) = 0`),
    w({ name: 'need', control: 'choice', label: 'Need', optionsFrom: `NeedChoices(${o.position}, ${o.machine}, ${o.taken})`,
      optionLabel: `IF(item.line = ${o.machine}, "", item.line & "'s · ") & item.label & " · " & COALESCE(item.made, 0) & " done" & IF(IN(item.$id, NeedsRunningElsewhere(${o.position})), " · running on another line now", "")`,
      defaultFrom: o.defaultNeed, placeholder: 'Not on the needs list', hint: 'The line\'s next need; other lines\' needs nobody is running come last.', writes: `${o.target}.need` }),
    w({ name: 'needFrom', control: 'badge', label: 'Another line\'s need', colors: { '*': 'warn' },
      formula: `"This is " & needRec.line & "'s need: its racks count toward it, marked as made on " & ${o.machine} & "."` }, `AND(NOT(ISBLANK(need)), needRec.line <> ${o.machine})`),
    w({ name: 'otherProfile', control: 'choice', label: 'Profile', required: true, pick: 'profiles' }, 'ISBLANK(need)'),
    w({ name: 'otherColor', control: 'choice', label: 'Color', required: true, options: COLORS, list: true }, 'ISBLANK(need)'),
    // What it makes, in a line: worked out from the need (or the profile and color picked).
    w({ name: 'profile', control: 'value', label: 'Makes', formula: 'COALESCE(needRec.profile, otherProfile)', required: true }),
    { name: 'colorCode', control: 'value', label: 'Color code', formula: 'COALESCE(needRec.color, otherColor)' },
    w({ name: 'makes', control: 'value', label: 'Color · length · a rack', formula: `ColorName(${COLOR}) & " · " & prof.lengthIn & " in · " & prof.pcsPerRack & " pieces"` }),
    // The line's last material when it ran the same profile: one tap less on most starts.
    w({ name: 'material', control: 'choice', label: 'Material', required: true, options: ['Virgin', 'Regrind', 'Pulverized', 'Mix sell'], writes: `${o.target}.material`,
      defaultFrom: `IF(AND(NOT(ISBLANK(profile)), LastRunOn(${o.position}).profile = profile), LastRunOn(${o.position}).material, "")`, hint: 'Filled in from the line\'s last run of this profile' }),
    w({ name: 'partialInfo', control: 'value', label: 'A partial rack is waiting', formula: 'partial.$id & ": " & partial.pieces & " pieces, left by " & partial.line & IF(ISBLANK(partial.location), "", " · " & partial.location)' }, 'NOT(ISBLANK(partial))'),
    w({ name: 'adopt', control: 'toggle', label: 'Use it?', required: true, yes: 'Yes, use it', no: 'No' }, 'NOT(ISBLANK(partial))'),
    w({ name: 'weatherStrip', control: 'toggle', label: 'Weather strip', writes: `${o.target}.weatherStrip` }),
    w({ name: 'wsStrands', control: 'number', label: 'Strands', writes: `${o.target}.wsStrands` }, 'weatherStrip = TRUE'),
    w({ name: 'wsColor', control: 'choice', label: 'Strip color', options: ['White', 'Grey'], writes: `${o.target}.wsColor` }, 'weatherStrip = TRUE'),
    w({ name: 'wsSize', control: 'text', label: 'Strip size', placeholder: '187x250', writes: `${o.target}.wsSize` }, 'weatherStrip = TRUE'),
  ];
  const rows = [['noNeeds 12'], ['need 12'], ['needFrom 12'], ['otherProfile 7', 'otherColor 5'], ['profile 5', 'makes 7'], ['material 12'], ['partialInfo 12'], ['adopt 12'], ['weatherStrip 12'], ['wsStrands 4', 'wsColor 4', 'wsSize 4']];
  return { sources, fields, rows };
}

const forms = [];

/* ---------- Profiles (QC office): tap one in the list to change it ---------- */
forms.push(['profiles', {
  title: 'Profiles', sites: ALL, saveLabel: 'Save profile', savedMessage: 'Profile {profileId} saved',
  sources: [
    // Fill in from it (0.60): each field saving to the profile starts at the profile's value.
    { name: 'profile', kind: 'item', structure: 'profiles', id: { field: 'profileId' }, fill: true, values: both(['part', 'customer', 'lengthIn', 'lengthTol', 'pcsPerRack', 'wtLow', 'wtNom', 'wtHigh', 'pattern', 'gauge', 'active', 'notes']) },
    { name: 'list', kind: 'items', structure: 'profiles' },
  ],
  fields: [
    { name: 'part', control: 'text', label: 'Part number', required: true, hint: 'e.g. 805, V819. Or tap a profile in the list.', defaultFrom: 'all.selected.part', writes: 'profile.part' },
    { name: 'customer', control: 'text', label: 'Customer', required: true, uppercase: true, hint: 'e.g. ABI, CLAYTON, MI WINDOWS', defaultFrom: 'all.selected.customer', writes: 'profile.customer' },
    { name: 'profileId', control: 'value', label: 'Profile', formula: 'part & " " & customer', required: true },
    { name: 'isNew', control: 'badge', label: 'This is', formula: 'IF(ISBLANK(profile.$firstAt), "a new profile", "a change to " & profileId)', colors: { 'a new profile': 'good' } },
    { name: 'lengthIn', control: 'number', label: 'Length', unit: 'in', required: true, writes: 'profile.lengthIn', limits: { min: 1 } },
    { name: 'lengthTol', control: 'number', label: 'Length ±', unit: 'in', required: true, default: 0.25, writes: 'profile.lengthTol', limits: { min: 0 } },
    { name: 'pcsPerRack', control: 'number', label: 'Pieces a rack', required: true, writes: 'profile.pcsPerRack', limits: { min: 1 } },
    { name: 'pattern', control: 'text', label: 'Across / up', writes: 'profile.pattern', hint: 'e.g. 7 / 15' },
    { name: 'wtLow', control: 'number', label: 'Lowest lbs/ft', decimals: 3, writes: 'profile.wtLow' },
    { name: 'wtNom', control: 'number', label: 'Nominal lbs/ft', decimals: 3, required: true, writes: 'profile.wtNom', warn: { min: 'wtLow', max: 'wtHigh', message: 'Not between the lowest and highest' } },
    { name: 'wtHigh', control: 'number', label: 'Highest lbs/ft', decimals: 3, writes: 'profile.wtHigh', rule: 'OR(ISBLANK(wtLow), wtHigh > wtLow)', ruleText: 'The highest must be above the lowest' },
    { name: 'gauge', control: 'toggle', label: 'Gauge check', default: true, writes: 'profile.gauge' },
    { name: 'active', control: 'toggle', label: 'Running it now', yes: 'Active', no: 'Off', default: true, writes: 'profile.active', hint: 'Off: left out of the needs and the line forms' },
    { name: 'notes', control: 'textarea', label: 'Notes', writes: 'profile.notes' },
    { name: 'all', control: 'records', label: 'Every profile (tap one to change it)', formula: 'list', sort: '$id', ascending: true, limit: 300, select: true,
      columns: [{ key: '$id', label: 'Profile' }, { key: 'lengthIn', label: 'Length (in)' }, { key: 'pcsPerRack', label: 'Pcs/rack' }, { key: 'wtNom', label: 'Lbs/ft', format: '0.000' }, { key: '$status', label: 'Status' }] },
  ],
  layout: [
    ['part 4', 'customer 4', 'profileId 4'], ['isNew 12'],
    ['lengthIn 3', 'lengthTol 3', 'pcsPerRack 3', 'pattern 3'], ['wtLow 4', 'wtNom 4', 'wtHigh 4'],
    ['gauge 4', 'active 4'], ['notes 12'], ['all 12'],
  ],
}]);

/* ---------- Lines (QC office) ---------- */
forms.push(['lines', {
  title: 'Lines', sites: ALL, saveLabel: 'Save line', savedMessage: '{lineId} saved',
  sources: [
    { name: 'lineItem', kind: 'item', structure: 'lines', id: { field: 'lineId' }, fill: true, values: { line: 'both', active: 'both', notes: 'both' } },
    { name: 'list', kind: 'items', structure: 'lines' },
  ],
  fields: [
    { name: 'lineId', control: 'text', label: 'Line', required: true, defaultFrom: 'all.selected.$id', hint: 'e.g. Line 4; one strand of a line: Line 3 A. Or tap a line in the list.' },
    { name: 'belongsTo', control: 'text', label: 'Line it belongs to', required: true, defaultFrom: 'COALESCE(lineItem.line, lineId)', writes: 'lineItem.line', hint: 'Itself; for a strand, its line. Needs are set for this.' },
    { name: 'active', control: 'toggle', label: 'Running', yes: 'Active', no: 'Off', required: true, default: false, writes: 'lineItem.active', hint: 'Active lines are offered when a shift starts' },
    { name: 'notes', control: 'textarea', label: 'Notes', writes: 'lineItem.notes' },
    { name: 'all', control: 'records', label: 'Every line (tap one to change it)', formula: 'list', sort: '$id', ascending: true, limit: 100, select: true,
      columns: [{ key: '$id', label: 'Line' }, { key: 'line', label: 'Belongs to' }, { key: '$status', label: 'Status' }] },
  ],
  layout: [['lineId 6', 'belongsTo 6'], ['active 6'], ['notes 12'], ['all 12']],
}]);

/* ---------- Needs (QC office): add one ---------- */
forms.push(['needs', {
  title: 'Add a need', sites: ALL, saveLabel: 'Add the need', savedMessage: 'Need added',
  sources: [
    { name: 'need', kind: 'item', structure: 'needs', id: { generate: true, prefix: 'N' }, values: writes(['line', 'profile', 'part', 'customer', 'color', 'racks', 'priority', 'due', 'notes']) },
    // The profile's part and customer go onto the need.
    { name: 'prof', kind: 'item', structure: 'profiles', id: { field: 'profile' }, values: reads(['part', 'customer']), carry: { to: 'need', values: ['part', 'customer'] } },
    { name: 'lines', kind: 'items', structure: 'lines' },
    { name: 'openNeeds', kind: 'items', structure: 'needs', open: true },
  ],
  fields: [
    { name: 'line', control: 'choice', label: 'Line', required: true, optionsFrom: 'SORT(UNIQUE(EACH(lines, item.line)))', writes: 'need.line' },
    { name: 'profile', control: 'choice', label: 'Profile', required: true, pick: 'profiles', optionLabel: 'item.$id & " · " & item.lengthIn & " in · " & item.pcsPerRack & " a rack"', writes: 'need.profile' },
    { name: 'color', control: 'choice', label: 'Color', required: true, options: COLORS, writes: 'need.color' },
    { name: 'racks', control: 'number', label: 'Racks needed', required: true, limits: { min: 1 }, writes: 'need.racks' },
    { name: 'priority', control: 'choice', label: 'Priority', required: true, options: PRIORITY, default: 2, writes: 'need.priority', hint: 'A line runs its open needs in this order, oldest first within a priority' },
    { name: 'due', control: 'date', label: 'Due', writes: 'need.due' },
    { name: 'notes', control: 'textarea', label: 'Notes', placeholder: 'e.g. use pulverized material', writes: 'need.notes' },
    { name: 'open', control: 'board', label: 'Open needs', formula: 'SORT(openNeeds, item.line & "|" & item.priority & "|" & item.$firstAt)', title: 'label', show: '{line} · priority {priority}{offLineNote}', progress: { done: 'made', of: 'racks' }, sort: 'given', limit: 100 },
  ],
  layout: [['line 4', 'profile 8'], ['color 4', 'racks 4', 'priority 4'], ['due 4', 'notes 8'], ['open 12']],
}]);

/* ---------- Change a need (QC office): tap it on the board ---------- */
forms.push(['change-need', {
  title: 'Change a need', sites: ALL, saveLabel: 'Save the change', savedMessage: 'Need changed',
  sources: [
    { name: 'openNeeds', kind: 'items', structure: 'needs', open: true },
    { name: 'need', kind: 'item', structure: 'needs', id: { field: 'pick' }, fill: true, values: { label: 'read', profile: 'read', made: 'read', racks: 'both', priority: 'both', due: 'both', notes: 'both', cancelled: 'both' } },
  ],
  fields: [
    { name: 'open', control: 'board', label: 'Open needs: tap the one to change', formula: 'SORT(openNeeds, item.line & "|" & item.priority & "|" & item.$firstAt)', title: 'label', show: '{line} · priority {priority}', progress: { done: 'made', of: 'racks' }, sort: 'given', limit: 100, select: true },
    { name: 'pick', control: 'value', label: 'Need ID', formula: 'open.selected.$id', required: true },
    { name: 'done', control: 'value', label: 'Done so far', formula: 'IF(ISBLANK(pick), "Tap a need above", need.label & " · " & COALESCE(need.made, 0) & " made")' },
    { name: 'racks', control: 'number', label: 'Racks needed', required: true, limits: { min: 1 }, writes: 'need.racks', hint: 'At or below what is done, the need closes' },
    { name: 'priority', control: 'choice', label: 'Priority', required: true, options: PRIORITY, writes: 'need.priority' },
    { name: 'due', control: 'date', label: 'Due', writes: 'need.due' },
    { name: 'notes', control: 'textarea', label: 'Notes', writes: 'need.notes' },
    { name: 'cancel', control: 'toggle', label: 'Cancel this need', yes: 'Cancel it', no: 'Keep it', writes: 'need.cancelled' },
  ],
  layout: [['open 12'], ['pick 4', 'done 8'], ['racks 4', 'priority 4', 'due 4'], ['notes 12'], ['cancel 6']],
}]);

/* ---------- Start shift (line terminal): the operator, the shift, then what runs on each line ---------- */
{
  const nr = newRun({ target: 'run', machine: 'COALESCE(lineRec.line, each)', position: 'each', taken: 'EACH(others, item.need)', defaultNeed: 'NextNeed(each, COALESCE(lineRec.line, each))', runId: 'runId', operator: 'operator' });
  forms.push(['start-shift', {
    title: 'Start shift', sites: ALL, saveLabel: 'Start the shift', savedMessage: 'Shift started: {shiftId}',
    density: 'compact',
    sources: [
      { name: 'shift', kind: 'item', structure: 'shifts', id: { field: 'shiftId' }, values: writes(['operator', 'crew', 'startAt', 'hours', 'endAt', 'lines', 'caliperOn']) },
      { name: 'lines', kind: 'items', structure: 'lines' },
    ],
    fields: [
      { name: 'operator', control: 'person', label: 'Operator', required: true, writes: 'shift.operator' },
      { name: 'crew', control: 'choice', label: 'Crew', required: true, options: [{ value: 'A', label: 'Day (A)' }, { value: 'P', label: 'Night (P)' }], defaultFrom: 'IF(AND(HOUR(NOW()) >= 4, HOUR(NOW()) < 16), "A", "P")', writes: 'shift.crew' },
      { name: 'startAt', control: 'datetime', label: 'Shift started', required: true, defaultFrom: 'STARTOF(DATEADD(NOW(), 30, "minutes"), "hour")', writes: 'shift.startAt',
        rule: 'AND(DATEDIFF(startAt, NOW(), "hours") < 12, DATEDIFF(startAt, NOW(), "hours") > -1)', ruleText: 'The start must be in the last 12 hours (or the next hour)' },
      { name: 'hours', control: 'choice', label: 'Hours', required: true, options: [12, 10, 8, 6, 4], default: 12, writes: 'shift.hours' },
      { name: 'endAt', control: 'value', label: 'Ends', formula: 'DATEADD(startAt, hours, "hours")', format: 'ddd h:mm AM/PM', snapshot: 'shift.endAt', required: true },
      { name: 'lineList', control: 'chips', label: 'Lines', required: true, pick: 'lines', writes: 'shift.lines' },
      { name: 'caliper', control: 'toggle', label: 'Caliper is at the line', required: true, yes: 'Yes', no: 'No', writes: 'shift.caliperOn', rule: 'caliper = TRUE', ruleText: 'Find the caliper before you start' },
      { name: 'shiftId', control: 'value', label: 'Shift', formula: 'TEXT(startAt, "yyMMdd-HHmm") & " " & operator', required: true },
    ],
    subforms: [{
      name: 'lineRuns', label: 'What runs on each line', title: '"What runs on " & each', repeat: { list: 'lineList' }, required: true,
      sources: [
        // The run, with the shift's values carried onto it.
        { name: 'run', kind: 'item', structure: 'runs', id: { field: 'runId' }, values: writes(RUN_WRITES),
          carry: { to: 'run', values: { line: '= each', machine: '= COALESCE(lineRec.line, each)', shift: '= shiftId', operator: '= operator', crew: '= crew', date: '= TEXT(startAt, "yyyy-MM-dd")', startAt: '= startAt', shiftEndAt: '= endAt' } } },
        { name: 'lineRec', kind: 'value', formula: 'lines[each]' },
      ].concat(nr.sources),
      fields: [{ name: 'runId', control: 'value', label: 'Run', formula: 'TEXT(startAt, "yyMMdd-HHmm") & " " & each', required: true }].concat(nr.fields),
      layout: nr.rows.concat([['runId 12']]),
    }],
    buttons: [
      { name: 'lineRunsBtn', label: 'What runs on each line', action: 'subform', subform: 'lineRuns' },
      { name: 'save', label: 'Start the shift', action: 'save', then: 'close' },
    ],
    layout: [
      { panels: [
        { panel: 'The shift', width: 'half', rows: [['operator 12'], ['crew 6', 'hours 6'], ['startAt 6', 'endAt 6'], ['shiftId 12']] },
        { panel: 'The lines', rows: [['lineList 12'], ['caliper 12'], ['lineRunsBtn 12']] },
      ] },
    ],
  }]);
}

/* ---------- The Lines board (line terminals' home form): every running line, the most urgent first ---------- */
forms.push(['line-board', {
  title: 'Lines', sites: ALL, refresh: 1, buttons: [],
  sources: [running, { name: 'needs', kind: 'value', formula: 'NeedsAll()' }],
  fields: [
    { name: 'lines', control: 'buttons', label: 'Running lines', formula: `SORT(running, ${URGENCY} & "|" & item.line)`,
      caption: 'item.line & " · " & item.part & " " & item.customer & " · " & item.colorName',
      detail: `item.operator & " · " & SlotNote(${SLOTS}) & " · " & IF(ISBLANK(item.need), COALESCE(item.racks, 0) & " racks", COALESCE(needs[item.need].made, 0) & " of " & needs[item.need].racks & " racks of the need")`,
      tone: `IF(SlotState(${SLOTS}) = "late", "bad", IF(SlotState(${SLOTS}) = "due", "warn", "good"))`,
      actions: [
        { label: 'Hourly check', form: 'hourly', prefill: { run: 'item.$id', who: 'item.operator' } },
        { label: 'Rack', form: 'rack', prefill: { run: 'item.$id', who: 'item.operator' } },
        { label: 'Changeover', form: 'changeover', prefill: { run: 'item.$id', who: 'item.operator' } },
      ],
      empty: 'No line is running: start the shift first.' },
  ],
  layout: [['lines 12']],
}]);

/* ---------- Hourly check ---------- */
forms.push(['hourly', {
  title: 'Hourly check', sites: ALL, refresh: 1, savedMessage: 'Check saved: {run}, {slot}',
  // When it is due: a duty of the Line operators responsibility center (CENTERS, below; 0.56).
  density: 'compact',
  sources: [
    running,
    // The check is an entry on the run; its line, part, profile and color go with it for the report.
    { name: 'runRec', kind: 'item', structure: 'runs', id: { field: 'run' }, values: writes(['slot', 'lineStatus', 'lengthAct', 'lengthDev', 'surface', 'colorCheck', 'gaugeCheck', 'speed', 'weight', 'surfaceBad', 'colorBad', 'checkedBy', 'checkNote', 'line', 'part', 'profile', 'color']),
      carry: [
        { to: 'runRec', values: ['line', 'part', 'profile', 'color'] },
        { to: 'runRec', when: 'lineStatus <> "Down"', values: { surfaceBad: '= IF(surface = "Fail", 1, 0)', colorBad: '= IF(colorCheck = "Fail", 1, 0)' } },
      ] },
    { name: 'open', kind: 'value', formula: 'SlotsOpen(runRec.startAt, runRec.doneSlots, runRec.shiftEndAt)' },
  ],
  fields: [
    runPick({ defaultFrom: `FIRST(SORT(running, ${URGENCY} & "|" & item.line)).$id` }),
    who('runRec.checkedBy', 'Checked by'),
    { name: 'slot', control: 'choice', label: 'Hour', required: true, optionsFrom: 'open', optionLabel: 'TEXT(item, "h AM") & IF(item < STARTOF(NOW(), "hour"), " (late)", "")', defaultFrom: 'FIRST(open)', writes: 'runRec.slot',
      rule: 'IN(slot, open)', ruleText: 'That hour has closed: a check can be entered until the end of the next hour' },
    { name: 'upToDate', control: 'badge', label: 'Checks', formula: 'IF(ISBLANK(run), "", SlotNote(runRec.startAt, runRec.doneSlots, runRec.shiftEndAt))', colors: { 'checks up to date': 'good' } },
    { name: 'lineStatus', control: 'choice', label: 'The line this hour', required: true, options: ['Running', 'Start up', 'Scrapping', 'Down'], colors: { Running: 'good', 'Start up': 'warn', Scrapping: 'warn', Down: 'bad' }, writes: 'runRec.lineStatus',
      defaultFrom: 'IF(ISBLANK(run), "", COALESCE(runRec.lineStatus, "Running"))' },
    { name: 'lengthAct', control: 'number', label: 'Actual length', unit: 'in', decimals: 3, required: true, when: 'lineStatus <> "Down"', writes: 'runRec.lengthAct',
      warn: { min: 'runRec.lengthNom - runRec.lengthTol', max: 'runRec.lengthNom + runRec.lengthTol', message: 'Off nominal by more than the tolerance' } },
    { name: 'nominal', control: 'value', label: 'Nominal', formula: 'runRec.lengthNom & " in ± " & runRec.lengthTol', when: 'lineStatus <> "Down"' },
    { name: 'lengthDev', control: 'value', label: 'Off nominal', formula: 'ROUND(lengthAct - runRec.lengthNom, 3)', format: '0.000', snapshot: 'runRec.lengthDev', when: 'lineStatus <> "Down"' },
    Object.assign({ name: 'surface', control: 'choice', label: 'Surface defects', required: true, when: 'lineStatus <> "Down"', writes: 'runRec.surface' }, PASSFAIL),
    Object.assign({ name: 'colorCheck', control: 'choice', label: 'Color check', required: true, when: 'lineStatus <> "Down"', writes: 'runRec.colorCheck' }, PASSFAIL),
    Object.assign({ name: 'gaugeCheck', control: 'choice', label: 'Gauge check', when: 'AND(lineStatus <> "Down", runRec.gauge = TRUE)', writes: 'runRec.gaugeCheck' }, PASSFAIL),
    { name: 'speed', control: 'number', label: 'Line speed', unit: 'ft/min', required: true, when: 'lineStatus <> "Down"', writes: 'runRec.speed', limits: { min: 0 } },
    { name: 'weight', control: 'number', label: 'Weight', unit: 'lbs/ft', decimals: 3, when: 'lineStatus <> "Down"', writes: 'runRec.weight', warn: { min: 'runRec.wtLow', max: 'runRec.wtHigh', message: 'Outside the profile\'s lowest to highest' } },
    { name: 'checkNote', control: 'text', label: 'Note', writes: 'runRec.checkNote' },
    { name: 'history', control: 'records', label: 'This run\'s checks', formula: 'IF(ISBLANK(run), LIST(), RunChecks(run))', sort: 'slot', limit: 24,
      columns: [{ key: 'slot', label: 'Hour', format: 'h AM' }, { key: 'lineStatus', label: 'Line' }, { key: 'lengthAct', label: 'Length', format: '0.000' }, { key: 'surface', label: 'Surface' }, { key: 'colorCheck', label: 'Color' }, { key: 'speed', label: 'Speed' }, { key: 'checkedBy', label: 'By' }] },
  ],
  buttons: [
    { name: 'allPass', label: 'All pass', action: 'set', sets: { surface: 'Pass', colorCheck: 'Pass', gaugeCheck: 'Pass' }, when: 'lineStatus <> "Down"' },
    { name: 'save', label: 'Save check', action: 'save', saveAs: 'hourly', then: 'close' },
  ],
  layout: [
    { panels: [
      { panel: 'The line', width: 'third', rows: [['run 12'], ['who 12'], ['slot 12'], ['upToDate 12'], ['lineStatus 12']] },
      { panel: 'The check', rows: [['lengthAct 4', 'nominal 4', 'lengthDev 4'], ['allPass 12'], ['surface 4', 'colorCheck 4', 'gaugeCheck 4'], ['speed 6', 'weight 6'], ['checkNote 12']] },
    ] },
    { section: 'This run\'s checks', fold: 'closed', rows: [['history 12']] },
  ],
}]);

/* ---------- Rack ---------- */
forms.push(['rack', {
  title: 'Rack', sites: ALL, refresh: 1, saveLabel: 'Save rack', savedMessage: 'Rack {rackId} saved',
  density: 'compact',
  sources: [
    running,
    // The run's details go onto the rack; the rack counts toward the run (and its need).
    { name: 'runRec', kind: 'item', structure: 'runs', id: { field: 'run' }, values: writes(['racks', 'pieces']),
      carry: [
        { to: 'rack', values: { run: '= run', shift: 'shift', crew: 'crew', date: 'date', line: 'line', machine: 'machine', need: 'need', profile: 'profile', part: 'part', customer: 'customer', color: 'color', madeAt: '= NOW()' } },
        { to: 'rack', when: 'NOT(ISBLANK(runRec.need))', values: { needLine: 'needLine', offLine: '= runRec.offLine = TRUE' } },
        { to: 'rack', when: 'onPartial = TRUE', values: { partial: 'adoptedPartial', partialPieces: 'adoptedPieces' } },
        { to: 'runRec', values: { racks: '= 1', pieces: '= pieces - IF(onPartial, runRec.adoptedPieces, 0)' } },
      ] },
    { name: 'needs', kind: 'value', formula: 'NeedsAll()' },
    // The first rack of a run that took over a partial rack finishes it.
    { name: 'onPartial', kind: 'value', formula: 'AND(COALESCE(runRec.racks, 0) = 0, NOT(ISBLANK(runRec.adoptedPartial)))' },
    { name: 'rack', kind: 'item', structure: 'racks', id: { field: 'rackId' }, values: writes(['run', 'shift', 'operator', 'crew', 'date', 'line', 'machine', 'need', 'needLine', 'offLine', 'profile', 'part', 'customer', 'color', 'pieces', 'partial', 'partialPieces', 'madeAt', 'notes']) },
    { name: 'needItem', kind: 'item', structure: 'needs', id: { where: '$id = form.runRec.need' }, values: writes(['made', 'madeOffLine', 'madeOn']),
      carry: { to: 'needItem', when: 'NOT(ISBLANK(runRec.need))', values: { made: '= 1', madeOffLine: '= IF(runRec.offLine = TRUE, 1, 0)', madeOn: '= runRec.machine' } } },
  ],
  fields: [
    Object.assign(runPick(), { keep: true }),
    who('rack.operator'),
    { name: 'rackId', control: 'text', label: 'Rack ID (ERP)', required: true, uppercase: true, enterMovesOn: true, hint: 'Type or scan the ERP tag',
      rule: 'ISBLANK(rack.$firstAt)', ruleText: 'Rack {value} is already recorded' },
    // The pieces a rack of what the line is running holds (NAME.selected: the run picked above).
    { name: 'pieces', control: 'number', label: 'Pieces on the rack', required: true, defaultFrom: 'run.selected.pcsPerRack', limits: { min: 1 }, writes: 'rack.pieces' },
    { name: 'partialNote', control: 'badge', label: 'Partial rack', formula: 'IF(onPartial, "This rack finishes partial rack " & runRec.adoptedPartial & " (" & runRec.adoptedPieces & " pieces already on it)", "")', colors: {} },
    { name: 'needProgress', control: 'badge', label: 'Need', formula: 'IF(ISBLANK(runRec.need), "Not on the needs list", needs[runRec.need].label & ": this makes " & (COALESCE(needs[runRec.need].made, 0) + 1) & " of " & needs[runRec.need].racks & IF(runRec.offLine = TRUE, " (" & runRec.needLine & "\'s need, made on " & runRec.machine & ")", ""))' },
    { name: 'notes', control: 'text', label: 'Note', writes: 'rack.notes' },
  ],
  layout: [['run 6', 'who 6'], ['rackId 6', 'pieces 6'], ['needProgress 12'], ['partialNote 12'], ['notes 12']],
}]);

/* ---------- Changeover: end the run, leave a partial rack, start the next ---------- */
{
  const NEXT = 'next = "New run"';
  const nr = newRun({ when: NEXT, target: 'newRun', machine: 'old.machine', position: 'old.line', taken: 'LIST()', defaultNeed: 'FIRST(FILTER(OpenNeedsFor(old.machine), item.$id <> old.need)).$id', runId: 'newRunId', operator: 'who' });
  forms.push(['changeover', {
    title: 'Changeover', sites: ALL, refresh: 1, saveLabel: 'Save the changeover', savedMessage: 'Changeover saved',
    density: 'compact',
    sources: [
      running,
      { name: 'old', kind: 'item', structure: 'runs', id: { field: 'run' }, values: writes(['endAt', 'endReason', 'partialLeft', 'scrapFt', 'pieces']),
        carry: [
          { to: 'old', values: { endAt: '= NOW()', endReason: '= IF(next = "New run", "Changeover", "Line stopped")' } },
          { to: 'old', when: 'partialLeft > 0', values: { pieces: '= partialLeft' } },
          { to: 'leftover', when: 'partialLeft > 0', values: { profile: 'profile', part: 'part', customer: 'customer', color: 'color', line: 'line', pieces: '= partialLeft', fromRun: '= run' } },
          { to: 'newRun', when: NEXT, values: { shift: 'shift', crew: 'crew', date: 'date', line: 'line', machine: 'machine', shiftEndAt: 'shiftEndAt', operator: '= who', startAt: '= NOW()' } },
        ] },
      { name: 'leftover', kind: 'item', structure: 'partials', id: { field: 'partialId' }, values: writes(['profile', 'part', 'customer', 'color', 'pieces', 'fromRun', 'line', 'location']) },
      { name: 'newRun', kind: 'item', structure: 'runs', id: { field: 'newRunId' }, values: writes(RUN_WRITES) },
    ].concat(nr.sources),
    fields: [
      runPick(),
      who(),   // saved as the new run's operator, and who took the partial rack
      { name: 'runs', control: 'value', label: 'Running now', formula: 'old.part & " " & old.customer & " · " & old.colorName & " · " & COALESCE(old.racks, 0) & " racks"' },
      { name: 'partialLeft', control: 'number', label: 'Pieces left on the partial rack', required: true, limits: { min: 0 }, writes: 'old.partialLeft', hint: '0 if the last rack was full' },
      { name: 'location', control: 'text', label: 'Where the partial rack is', when: 'partialLeft > 0', writes: 'leftover.location', placeholder: 'e.g. end of Line 3' },
      { name: 'partialId', control: 'value', label: 'Partial rack', formula: '"PR " & TEXT(NOW(), "yyMMdd-HHmm") & " " & old.line', required: true, when: 'partialLeft > 0' },
      { name: 'scrapFt', control: 'number', label: 'Scrap this run', unit: 'ft', limits: { min: 0 }, writes: 'old.scrapFt' },
      { name: 'next', control: 'choice', label: 'What next', required: true, options: ['New run', 'Line stops'], default: 'New run' },
      { name: 'newRunId', control: 'value', label: 'New run', formula: 'TEXT(NOW(), "yyMMdd-HHmm") & " " & old.line', required: true, when: NEXT },
    ].concat(nr.fields),
    layout: [
      { panels: [
        { panel: 'Ending this run', rows: [['run 6', 'who 6'], ['runs 12'], ['partialLeft 6', 'scrapFt 6'], ['location 6', 'partialId 6'], ['next 12']] },
        { panel: 'The next run', width: 'half', when: NEXT, rows: nr.rows.concat([['newRunId 12']]) },
      ] },
    ],
  }]);
}

/* ---------- End shift ---------- */
forms.push(['end-shift', {
  title: 'End shift', sites: ALL, saveLabel: 'End the shift', savedMessage: 'Shift ended',
  density: 'compact',
  sources: [
    { name: 'mine', kind: 'items', structure: 'runs', open: true, filter: 'shift = form.shiftPick', values: { scrapFt: 'both', endAt: 'write', endReason: 'write' } },
    { name: 'shifts', kind: 'items', structure: 'shifts', open: true },
    { name: 'shift', kind: 'item', structure: 'shifts', id: { field: 'shiftPick' }, values: writes(['endedAt', 'endedBy', 'caliperOff']),
      carry: { to: 'shift', values: { endedAt: '= endNow' } } },
  ],
  fields: [
    { name: 'shiftPick', control: 'choice', label: 'Shift', required: true, optionsFrom: 'SORT(shifts, item.startAt, "desc")',
      optionLabel: 'item.operator & " · " & TEXT(item.startAt, "ddd h AM") & " to " & TEXT(item.endAt, "h AM") & " · " & JOIN(item.lines, ", ")', defaultFrom: 'FIRST(SORT(shifts, item.startAt, "desc")).$id' },
    who('shift.endedBy', 'Ended by'),
    { name: 'scrap', control: 'table', label: 'Scrap on each line', rowsFrom: 'mine', rowLabel: 'Run', empty: 'No runs of this shift are still open', pinHeader: true, visibleRows: 6,
      columns: [{ name: 'line', label: 'Line' }, { name: 'part', label: 'Part' }, { name: 'color', label: 'Color' }, { name: 'racks', label: 'Racks' }, { name: 'scrapFt', label: 'Scrap (ft)', control: 'number', edit: true }] },
    { name: 'endNow', control: 'datetime', label: 'Ended', required: true, defaultFrom: 'NOW()', writes: 'mine.endAt' },
    { name: 'endReason', control: 'choice', label: 'Why', required: true, options: ['End of shift'], default: 'End of shift', writes: 'mine.endReason' },
    { name: 'caliperOff', control: 'toggle', label: 'Caliper left at the line', required: true, writes: 'shift.caliperOff', rule: 'caliperOff = TRUE', ruleText: 'Leave the caliper at the line for the next shift' },
    { name: 'missed', control: 'kpi', label: 'Hour checks missed this shift', formula: 'SUM(EACH(mine, item.missed))', target: '0', better: 'lower' },
  ],
  buttons: [{ name: 'save', label: 'End the shift', action: 'save', then: 'close' }],
  layout: [
    { panels: [
      { panel: 'Ending the shift', width: 'third', rows: [['shiftPick 12'], ['who 12'], ['endNow 12'], ['endReason 12'], ['caliperOff 12'], ['missed 12']] },
      { rows: [['scrap 12']] },
    ] },
  ],
}]);

/* ---------- Needs board (QC office's home form): tap a running line to see its checks ---------- */
forms.push(['needs-board', {
  title: 'Needs board', sites: ALL, refresh: 1, buttons: [], density: 'compact',
  sources: [
    { name: 'needs', kind: 'value', formula: 'NeedsAll()' },
    { name: 'open', kind: 'items', structure: 'needs', open: true },
    { name: 'runs', kind: 'value', formula: 'RunsRecent()' },
    { name: 'racks', kind: 'value', formula: 'RacksRecent()' },
  ],
  fields: [
    { name: 'openNeeds', control: 'kpi', label: 'Open needs', formula: 'COUNT(open)' },
    { name: 'racksLeft', control: 'kpi', label: 'Racks still needed', formula: 'SUM(EACH(open, item.racks - COALESCE(item.made, 0)))' },
    { name: 'racksToday', control: 'kpi', label: 'Racks today', formula: 'COUNT(FILTER(racks, item.$firstAt >= STARTOF(NOW(), "day")))' },
    { name: 'board', control: 'board', label: 'Open needs, by line', formula: 'SORT(open, item.line & "|" & item.priority & "|" & item.$firstAt)',
      title: 'label', show: '{line} · priority {priority}{offLineNote}', progress: { done: 'made', of: 'racks' }, sort: 'given', limit: 100 },
    { name: 'now', control: 'records', label: 'Running now (tap one for its checks)', formula: 'FILTER(runs, item.$status = "Running")', sort: 'line', ascending: true, select: true,
      columns: [{ key: 'line', label: 'Line' }, { key: 'profile', label: 'Profile' }, { key: 'colorName', label: 'Color' }, { key: 'operator', label: 'Operator' }, { key: 'racks', label: 'Racks' }, { key: 'checks', label: 'Checks' }, { key: 'missed', label: 'Missed' }, { key: 'startAt', label: 'Since', format: 'ddd h:mm AM/PM' }] },
    { name: 'nowChecks', control: 'records', label: 'Its checks', formula: 'RunChecks(now.selected.$id)', when: 'NOT(ISBLANK(now.selected))', sort: 'slot', limit: 24, empty: 'No checks yet',
      columns: [{ key: 'slot', label: 'Hour', format: 'h AM' }, { key: 'lineStatus', label: 'Line' }, { key: 'lengthAct', label: 'Length', format: '0.000' }, { key: 'lengthDev', label: '±', format: '0.000' }, { key: 'surface', label: 'Surface' }, { key: 'colorCheck', label: 'Color' }, { key: 'speed', label: 'Speed' }, { key: 'weight', label: 'Lbs/ft', format: '0.000' }, { key: 'checkedBy', label: 'By' }] },
    { name: 'over', control: 'records', label: 'Needs with more racks than asked for', formula: 'FILTER(needs, COALESCE(item.made, 0) > item.racks)', sort: 'line', ascending: true,
      columns: [{ key: 'line', label: 'Line' }, { key: 'label', label: 'Need' }, { key: 'racks', label: 'Asked for' }, { key: 'made', label: 'Made' }, { key: 'madeOnLines', label: 'Made on' }], empty: 'None' },
    { name: 'done', control: 'records', label: 'Done lately', formula: 'FILTER(needs, item.$status = "Done")', sort: '$at', limit: 20,
      columns: [{ key: 'line', label: 'Line' }, { key: 'label', label: 'Need' }, { key: 'made', label: 'Racks' }, { key: 'madeOnLines', label: 'Made on' }, { key: '$at', label: 'Done', format: 'ddd MMM d h:mm AM/PM' }] },
  ],
  layout: [['openNeeds 4', 'racksLeft 4', 'racksToday 4'], ['board 12'], ['now 12'], ['nowChecks 12'], ['over 12'], ['done 12']],
}]);

/* ---------- Trace a rack (QC office, 0.55): scan or type a rack ID; the tree shows its run and everything about it ---------- */
forms.push(['trace-rack', {
  title: 'Trace a rack', sites: ALL, buttons: [], print: true,
  sources: [{ name: 'rack', kind: 'item', structure: 'racks', id: { field: 'rackId' }, values: reads(['run', 'line', 'profile', 'part', 'customer', 'color', 'pieces', 'madeAt', 'operator', 'crew', 'date']) }],
  fields: [
    { name: 'rackId', control: 'text', label: 'Rack ID', placeholder: 'Scan or type the rack ID from the tag' },
    { name: 'found', control: 'value', label: 'Rack', formula: 'IF(ISBLANK(rackId), "Scan or type a rack ID", IF(ISBLANK(rack.run), "No rack with that ID", rack.profile & " · " & rack.customer & " · " & rack.pieces & " pcs, made " & TEXT(rack.madeAt, "MMM d h:mm AM/PM") & " on " & rack.line))' },
    { name: 'trace', control: 'tree', label: 'Where it came from', formula: 'IF(ISBLANK(rack.run), LIST(), rack)', select: true, empty: 'Scan or type a rack ID',
      title: 'Rack {$id}', show: '{profile} · {color} · {pieces} pcs · {customer}',
      levels: [
        { name: 'run', label: 'Run', formula: 'TraceRun(item.run)', title: '{line} · {profile} · {crew}', show: 'Started {startAt} · ended {endAt} · {racks} racks · scrap {scrapPct}', status: '$status', colors: { Ended: 'good', Running: 'warn', 'Shift over': 'warn' }, open: true },
        { name: 'shift', label: 'Shift', under: 'run', formula: 'TraceShift(item.shift)', title: '{$id}', show: '{operator} · crew {crew} · {startAt}' },
        { name: 'need', label: 'Need', under: 'run', formula: 'TraceNeed(item.need)', title: '{label}', show: '{customer} · {racks} racks', status: '$status' },
        { name: 'checks', label: 'Hour checks', under: 'run', formula: 'SORT(TraceChecks(item.$id), item.slot)', title: '{slot}', show: '{lineStatus} · length {lengthAct} ({lengthDev}) · surface {surface} · color {colorCheck} · by {checkedBy}', limit: 24 },
        { name: 'racks', label: 'Racks from this run', under: 'run', formula: 'TraceRacks(item.$id)', title: '{$id}', show: '{pieces} pcs · {madeAt}', limit: 40 },
      ] },
  ],
  layout: [['rackId 6', 'found 6'], ['trace 12']],
}]);

/* ---------- Production report (QC office): the workbook's pivots, from the runs ---------- */
const SCRAP_PCT = 'SUM(group.scrapLbs) / SUM(group.totalLbs)';
const LBS = { 'Scrap %': '0.0%', 'Scrap lbs': '#,##0', 'Prime lbs': '#,##0', 'Total lbs': '#,##0' };
forms.push(['production-report', {
  title: 'Production report', sites: ALL, refresh: 5, buttons: [],
  sources: [
    { name: 'all', kind: 'value', formula: 'RunsAll()' },
    { name: 'runs', kind: 'value', formula: 'FILTER(all, AND(item.date >= TEXT(fromDate, "yyyy-MM-dd"), item.date <= TEXT(toDate, "yyyy-MM-dd"), OR(ISBLANK(lineF), item.line = lineF), OR(ISBLANK(crewF), item.crew = crewF), OR(ISBLANK(profileF), item.profile = profileF)))' },
    { name: 'checks', kind: 'value', formula: 'FILTER(ChecksRecent(), AND(item.slot >= STARTOF(fromDate, "day"), item.slot < DATEADD(STARTOF(toDate, "day"), 1, "days"), OR(ISBLANK(lineF), item.line = lineF), OR(ISBLANK(profileF), item.profile = profileF)))' },
  ],
  fields: [
    { name: 'fromDate', control: 'date', label: 'From', required: true, defaultFrom: 'DATEADD(TODAY(), -6, "days")' },
    { name: 'toDate', control: 'date', label: 'To', required: true, defaultFrom: 'TODAY()' },
    { name: 'lineF', control: 'choice', label: 'Line', optionsFrom: 'SORT(UNIQUE(EACH(all, item.line)))', placeholder: 'Every line' },
    { name: 'crewF', control: 'choice', label: 'Crew', options: [{ value: 'A', label: 'Day (A)' }, { value: 'P', label: 'Night (P)' }], list: true, placeholder: 'Both crews' },
    { name: 'profileF', control: 'choice', label: 'Profile', optionsFrom: 'SORT(UNIQUE(EACH(all, item.profile)))', placeholder: 'Every profile' },
    { name: 'kTotal', control: 'kpi', label: 'Total lbs', formula: 'SUM(EACH(runs, item.totalLbs))', decimals: 0 },
    { name: 'kPrime', control: 'kpi', label: 'Prime lbs', formula: 'SUM(EACH(runs, item.primeLbs))', decimals: 0 },
    { name: 'kScrap', control: 'kpi', label: 'Scrap lbs', formula: 'SUM(EACH(runs, item.scrapLbs))', decimals: 0, better: 'lower' },
    { name: 'kPct', control: 'kpi', label: 'Scrap %', formula: 'IF(SUM(EACH(runs, item.totalLbs)) > 0, ROUND(SUM(EACH(runs, item.scrapLbs)) / SUM(EACH(runs, item.totalLbs)) * 100, 1), "")', unit: '%', decimals: 1, better: 'lower' },
    { name: 'kRacks', control: 'kpi', label: 'Racks', formula: 'SUM(EACH(runs, COALESCE(item.racks, 0)))', decimals: 0 },
    { name: 'kMissed', control: 'kpi', label: 'Hour checks missed', formula: 'SUM(EACH(runs, item.missed))', decimals: 0, target: '0', better: 'lower' },
    { name: 'byDay', control: 'summary', label: 'By day', formula: 'runs', rows: ['date'], heading: 'Date', chart: 'bar', totals: true,
      figures: { 'Scrap %': SCRAP_PCT, 'Scrap lbs': 'SUM(group.scrapLbs)', 'Prime lbs': 'SUM(group.primeLbs)', 'Total lbs': 'SUM(group.totalLbs)', Racks: 'SUM(group.racks)', Runs: 'COUNT(group)' }, formats: LBS },
    { name: 'byShift', control: 'summary', label: 'By day and crew', formula: 'runs', rows: ['date', 'crew'], heading: 'Date · crew', totals: true,
      figures: { 'Scrap %': SCRAP_PCT, 'Scrap lbs': 'SUM(group.scrapLbs)', 'Prime lbs': 'SUM(group.primeLbs)', 'Total lbs': 'SUM(group.totalLbs)' }, formats: LBS },
    { name: 'materials', control: 'summary', label: 'Material used (lbs)', formula: 'runs', rows: ['date', 'crew'], heading: 'Date · crew', across: 'materialKey', totals: true, figures: { lbs: 'SUM(group.totalLbs)' }, formats: { lbs: '#,##0' } },
    { name: 'byProfile', control: 'summary', label: 'By profile', formula: 'runs', rows: ['profile'], heading: 'Profile', totals: true, sort: 'Total lbs', descending: true,
      figures: { 'Scrap %': SCRAP_PCT, 'Scrap lbs': 'SUM(group.scrapLbs)', 'Total lbs': 'SUM(group.totalLbs)', 'Avg lbs/ft': 'AVERAGE(group.wtFt)', Racks: 'SUM(group.racks)', Runs: 'COUNT(group)' },
      formats: { 'Scrap %': '0.0%', 'Scrap lbs': '#,##0', 'Total lbs': '#,##0', 'Avg lbs/ft': '0.000' } },
    { name: 'bestLine', control: 'summary', label: 'Scrap % by profile and line (lowest marked)', formula: 'runs', rows: ['profile'], heading: 'Profile', across: 'line', mark: 'lowest', figures: { 'Scrap %': SCRAP_PCT }, formats: { 'Scrap %': '0.0%' } },
    { name: 'lastRun', control: 'value', label: 'Last run', formula: 'IF(ISBLANK(profileF), "Pick a profile above", LAST(SORT(FILTER(all, item.profile = profileF), item.startAt)).date & " on " & LAST(SORT(FILTER(all, item.profile = profileF), item.startAt)).line & " · scrap " & TEXT(LAST(SORT(FILTER(all, item.profile = profileF), item.startAt)).scrapPct, "0.0%"))' },
    { name: 'history', control: 'summary', label: 'Every run of the profile, by day and line', formula: 'IF(ISBLANK(profileF), LIST(), FILTER(all, item.profile = profileF))', rows: ['date'], heading: 'Date', across: 'line', descending: true, limit: 60,
      figures: { 'Scrap %': SCRAP_PCT, 'Total lbs': 'SUM(group.totalLbs)' }, formats: { 'Scrap %': '0.0%', 'Total lbs': '#,##0' } },
    { name: 'quality', control: 'summary', label: 'Hour checks by line', formula: 'checks', rows: ['line'], heading: 'Line', totals: true,
      figures: { Checks: 'COUNT(FILTER(group, item.lineStatus <> "Down"))', 'Surface fails': 'SUM(group.surfaceBad)', 'Color fails': 'SUM(group.colorBad)', 'Avg speed': 'AVERAGE(group.speed)', 'Avg off nominal (in)': 'AVERAGE(group.lengthDev)', 'Hours down': 'COUNT(FILTER(group, item.lineStatus = "Down"))' },
      formats: { 'Avg speed': '0.0', 'Avg off nominal (in)': '0.000' } },
    { name: 'lengthChart', control: 'control-chart', label: 'Length off nominal (in)', formula: 'FILTER(checks, NOT(ISBLANK(item.lengthDev)))', value: 'lengthDev', x: 'slot', last: 60, unit: 'in', decimals: 3 },
    { name: 'speedChart', control: 'chart', label: 'Line speed (ft/min)', formula: 'FILTER(checks, NOT(ISBLANK(item.speed)))', type: 'line', x: 'slot', y: 'speed', series: 'line', unit: 'ft/min' },
    { name: 'table', control: 'records', label: 'Every run', formula: 'runs', sort: 'startAt', limit: 500, details: true,
      columns: [{ key: 'date', label: 'Date' }, { key: 'line', label: 'Line' }, { key: 'crew', label: 'Shift' }, { key: 'profile', label: 'Profile' }, { key: 'color', label: 'Color' },
        { key: 'wtFt', label: 'Wt/ft', format: '0.000' }, { key: 'primeFt', label: 'Prime ft', format: '#,##0' }, { key: 'primeLbs', label: 'Prime #', format: '#,##0' },
        { key: 'scrapFt', label: 'Scrap ft', format: '#,##0' }, { key: 'scrapLbs', label: 'Scrap #', format: '#,##0' }, { key: 'totalLbs', label: 'Total #', format: '#,##0' }, { key: 'scrapPct', label: 'Scrap %', format: '0.0%' },
        { key: 'materialKey', label: 'Material' }, { key: 'racks', label: 'Racks' }, { key: 'missed', label: 'Missed' }, { key: 'operator', label: 'Operator' }] },
  ],
  layout: [
    ['fromDate 3', 'toDate 3', 'lineF 2', 'crewF 2', 'profileF 2'],
    { tabs: [
      { tab: 'Summary', rows: [['kTotal 4', 'kPrime 4', 'kScrap 4'], ['kPct 4', 'kRacks 4', 'kMissed 4'], ['byDay 12']] },
      { tab: 'Day & crew', rows: [['byShift 12'], ['materials 12']] },
      { tab: 'Profiles', rows: [['byProfile 12'], ['bestLine 12']] },
      { tab: 'Last time run', rows: [['lastRun 12'], ['history 12']] },
      { tab: 'Quality', rows: [['quality 12'], ['lengthChart 12'], ['speedChart 12']] },
      { tab: 'Every run', rows: [['table 12']] },
    ] },
  ],
}]);

/* Where the forms go (0.52: carried in the pack): Abilene, the line terminals and the QC office PC. People go in only
 * when the pack is installed on a folder marked as a test folder. */
const SITES = [{ id: 'ABI', name: 'Abilene' }];
const TERMINALS = {
  line: { name: 'Line terminals', site: 'ABI', terminals: ['T01'], forms: ['line-board', 'start-shift', 'hourly', 'rack', 'changeover', 'end-shift'], homeForm: 'line-board', view: 'kiosk', signIn: 'supervisors', signedInFor: 720 },
  office: { name: 'QC office', site: 'ABI', terminals: ['T02'], forms: ['needs-board', 'needs', 'change-need', 'profiles', 'lines', 'production-report', 'trace-rack'], homeForm: 'needs-board', view: 'admin', signIn: 'anyone', signedInFor: 120 },
};
const PEOPLE = [
  { name: 'Maria Lopez', roles: ['supervisor'], pin: '135790' },
  { name: 'Kevin Hart', department: 'Quality', roles: ['supervisor'], pin: '975310' },
  { name: 'Tom Reed', roles: ['user'], pin: '246802' },
  { name: 'Ana Diaz', roles: ['user'], pin: '357913' },
  { name: 'Sam Cole', roles: ['user'], pin: '468024' },
  { name: 'Ed Moore', department: 'Management', roles: ['supervisor'], pin: '579135' },
];

/* Responsibility centers (0.56, carried in the pack; groups and people by name). */
// 0.62: a missed hourly check climbs Line operators' ladder: shown at the line at once, then the shift supervisors after
// 30 minutes, Quality techs after 2 hours, Plant management after 4, each until someone told acknowledges it.
const CENTERS = [
  { name: 'Line operators', members: { signedInAt: [{ kind: 'group', id: 'Line terminals' }] },
    duties: [{ name: 'hourly', label: 'each run', forms: ['hourly'], every: 60, forEach: 'runs', grace: 15, critical: true }],
    ladder: [
      { after: 30, tell: { centers: ['Shift supervisors'] }, ack: true },
      { after: 120, tell: { centers: ['Quality techs'] }, ack: true },
      { after: 240, tell: { centers: ['Plant management'] }, ack: true },
    ] },
  { name: 'Quality techs', members: { departments: ['Quality'] }, duties: [] },
  { name: 'Shift supervisors', members: { role: 'supervisor' }, duties: [] },
  { name: 'Plant management', members: { departments: ['Management'] }, duties: [] },
];

module.exports = { functions, structures, forms, COLORS, SITES, TERMINALS, PEOPLE, CENTERS };
