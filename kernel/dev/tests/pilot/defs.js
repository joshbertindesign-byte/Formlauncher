/* The production pilot: structures, functions and forms, as published definitions.
 * Loaded in the test harness, published through FP.defs.publish (so every check runs), then packed. */
const COLORS = [
  { value: 'W', label: 'White' }, { value: 'AL', label: 'Almond' }, { value: 'BLK', label: 'Black' },
  { value: 'DS', label: 'Desert Sand' }, { value: 'BRZ', label: 'Bronze' }, { value: 'MS', label: 'Mix sell' },
];
const PASSFAIL = { options: ['Pass', 'Fail'], colors: { Pass: 'good', Fail: 'bad' } };
const ALL = ['all'];

// Hour checks: the hours a run still owes, and how it stands. A check for an hour is due during that hour,
// late during the next one, and closed after that.
const NOWHOUR = 'STARTOF(NOW(), "hour")';
const LASTHOUR = 'DATEADD(STARTOF(NOW(), "hour"), -1, "hours")';

const functions = [
  // ---- Lookups: whole lists, filtered and sorted where they are used ----
  ['NeedsAll', { label: 'Every need', kind: 'lookup', output: 'list', inputs: [],
    reads: { structure: 'needs', from: 'items', return: '*', summary: 'list', window: 'all' } }],
  ['LinesAll', { label: 'Every line', kind: 'lookup', output: 'list', inputs: [],
    reads: { structure: 'lines', from: 'items', return: '*', summary: 'list', window: 'all' } }],
  ['ProfilesAll', { label: 'Every profile', kind: 'lookup', output: 'list', inputs: [],
    reads: { structure: 'profiles', from: 'items', return: '*', summary: 'list', window: 'all' } }],
  ['PartialsAll', { label: 'Every partial rack', kind: 'lookup', output: 'list', inputs: [],
    reads: { structure: 'partials', from: 'items', return: '*', summary: 'list', window: 'all' } }],
  ['RunsRecent', { label: 'Runs of the last 3 days', kind: 'lookup', output: 'list', inputs: [],
    reads: { structure: 'runs', from: 'items', return: '*', summary: 'list', window: { days: 3 } } }],
  ['RunsAll', { label: 'Runs of the last 400 days (for the report)', kind: 'lookup', output: 'list', inputs: [],
    reads: { structure: 'runs', from: 'items', return: '*', summary: 'list', window: { days: 400 } } }],
  ['ShiftsRecent', { label: 'Shifts of the last 2 days', kind: 'lookup', output: 'list', inputs: [],
    reads: { structure: 'shifts', from: 'items', return: '*', summary: 'list', window: { days: 2 } } }],
  ['RacksRecent', { label: 'Racks of the last 3 days', kind: 'lookup', output: 'list', inputs: [],
    reads: { structure: 'racks', from: 'items', return: '*', summary: 'list', window: { days: 3 } } }],
  ['LastRunOn', { label: 'The latest run on a line', kind: 'lookup', output: 'record', inputs: [{ name: 'line', type: 'text' }],
    reads: { structure: 'runs', from: 'items', match: { line: 'line' }, return: '*', summary: 'latest', window: 'all' } }],
  ['RunChecks', { label: 'Hour checks of a run', kind: 'lookup', output: 'list', inputs: [{ name: 'run', type: 'text' }],
    reads: { structure: 'runs', from: 'entries', action: 'hourly', match: { $id: 'run' }, window: { days: 2 }, return: ['slot', 'lineStatus', 'lengthAct', 'lengthDev', 'surface', 'colorCheck', 'gaugeCheck', 'speed', 'weight', 'checkedBy'], summary: 'list' } }],
  ['ChecksRecent', { label: 'Hour checks of the last 31 days', kind: 'lookup', output: 'list', inputs: [],
    reads: { structure: 'runs', from: 'entries', action: 'hourly', return: ['slot', 'line', 'part', 'profile', 'color', 'lineStatus', 'lengthAct', 'lengthDev', 'surface', 'colorCheck', 'surfaceBad', 'colorBad', 'speed', 'weight'], summary: 'list', window: { days: 31 } } }],

  // ---- Needs ----
  ['OpenNeedsFor', { label: 'Open needs of a line, first first', output: 'list', inputs: [{ name: 'line', type: 'text' }],
    formula: 'SORT(FILTER(NeedsAll(), AND(item.line = line, item.$status = "Open")), item.priority & "|" & item.$firstAt)' }],
  // A line may run another line's open need (0.44.4) when nobody runs it now: its own needs first, then the others.
  ['NeedsRunningElsewhere', { label: 'Needs being run now on other lines', output: 'list', inputs: [{ name: 'position', type: 'text' }],
    formula: 'EACH(FILTER(RunsRecent(), AND(item.$status = "Running", NOT(ISBLANK(item.need)), item.line <> position)), item.need)' }],
  ['NeedChoices', { label: 'Needs a line can run: its own, then other lines\' not running', output: 'list',
    inputs: [{ name: 'position', type: 'text' }, { name: 'line', type: 'text' }, { name: 'taken', type: 'list', required: false }],
    formula: 'SORT(FILTER(NeedsAll(), AND(item.$status = "Open", OR(item.line = line, item.$id = IF(ISBLANK(LastRunOn(position).need), "", LastRunOn(position).need), AND(NOT(IN(item.$id, NeedsRunningElsewhere(position))), NOT(IN(item.$id, COALESCE(taken, LIST()))))))), IF(item.line = line, "0", "1") & "|" & item.line & "|" & item.priority & "|" & item.$firstAt)' }],
  ['OffLineNote', { label: 'Racks of a need made on other lines, in words', output: 'text', inputs: [{ name: 'n', type: 'number', required: false }],
    formula: 'IF(COALESCE(n, 0) > 0, " · " & n & " made on other lines", "")' }],
  ['NextNeed', { label: 'The need a line runs next', output: 'text', inputs: [{ name: 'position', type: 'text' }, { name: 'line', type: 'text' }],
    // What the line was running, while that need is open; otherwise the line's first open need.
    formula: 'IF(ISBLANK(LastRunOn(position).need), FIRST(OpenNeedsFor(line)).$id, IF(IN(LastRunOn(position).need, EACH(OpenNeedsFor(line), item.$id)), LastRunOn(position).need, FIRST(OpenNeedsFor(line)).$id))' }],

  // ---- Hour checks ----
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
    // Closed hours: from the run's first hour up to the hour before last, or to when the run ended.
    formula: `MAX(0, ROUND(DATEDIFF(STARTOF(startAt, "hour"), IF(AND(NOT(ISBLANK(COALESCE(endAt, shiftEndAt))), COALESCE(endAt, shiftEndAt) < ${LASTHOUR}), COALESCE(endAt, shiftEndAt), ${LASTHOUR}), "hours") + 0.4999, 0) - COUNT(FILTER(COALESCE(done, LIST()), AND(item >= STARTOF(startAt, "hour"), item < IF(AND(NOT(ISBLANK(COALESCE(endAt, shiftEndAt))), COALESCE(endAt, shiftEndAt) < ${LASTHOUR}), COALESCE(endAt, shiftEndAt), ${LASTHOUR})))))` }],

  // ---- Footage and pounds ----
  ['ColorName', { label: 'A color code in words', output: 'text', inputs: [{ name: 'code', type: 'text', required: false }],
    formula: 'IF(code = "W", "White", IF(code = "AL", "Almond", IF(code = "BLK", "Black", IF(code = "DS", "Desert Sand", IF(code = "BRZ", "Bronze", IF(code = "MS", "Mix sell", code))))))' }],
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
    containers: { line: {}, profile: {}, part: {}, customer: {}, color: {}, colorName: {}, racks: {}, priority: {}, due: {}, notes: {}, label: {}, cancelled: {}, made: { rule: 'sum' },
      // Racks made on a line that isn't the need's own (0.44.4), and the lines its racks came from.
      madeOffLine: { rule: 'sum' }, madeOn: {}, madeOnLines: { from: 'madeOn', rule: 'list' } },
    calculated: { offLineNote: { fn: 'OffLineNote', inputs: { n: 'madeOffLine' } } },
    status: [] }],
  ['shifts', { label: 'Shifts', kind: 'runs', roles: { ended: 'endedAt', started: 'startAt' }, sites: ALL, live: { days: 60 }, itemId: { label: 'Shift', made: 'entered' },
    containers: { operator: {}, crew: {}, startAt: {}, hours: {}, endAt: {}, lines: {}, caliperOn: {}, caliperOff: {}, endedAt: {}, notes: {} },
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
    containers: { profile: {}, part: {}, customer: {}, color: {}, pieces: {}, fromRun: {}, line: {}, location: {}, adoptedRun: {}, adoptedAt: {}, adoptedBy: {} },
    status: [] }],
];

/* ---------- Pieces shared by the operator forms ---------- */
// 0.47: the line board picks the line; the forms list every running line, the operator's own first.
const runningSource = { name: 'running', kind: 'items', structure: 'runs', filter: 'status = "Running"' };
const MINE_FIRST = 'IF(item.operator = USER(), "0", "1")';
const MINE = 'FILTER(running, item.operator = USER())';
const ONLY_MINE = `IF(COUNT(${MINE}) = 1, FIRST(${MINE}).$id, "")`;
const URGENCY = 'SlotUrgency(item.startAt, item.doneSlots, item.shiftEndAt)';
const everyLineField = { name: 'everyLine', control: 'toggle', label: 'Lines shown', yes: 'Every running line', no: 'Just mine', keep: true };
const runPick = (dflt) => ({ name: 'run', control: 'choice', label: 'Line', required: true, optionsFrom: `SORT(running, ${MINE_FIRST} & "|" & ${URGENCY} & "|" & item.line)`,
  optionLabel: 'item.line & " · " & item.part & " " & item.customer & " · " & ColorName(item.color)', defaultFrom: dflt });

// A new run's details, from its need (or a profile and color when it isn't on the needs list).
// prefix: the source the new run saves to; lineExpr / machineExpr: where it runs.
function newRunFields(target, o) {
  const when = o.when ? { when: o.when } : {};
  const w = extra => Object.assign({}, when, extra || {});
  const need = `${target}Need`;
  return [
    // No needs of its own: say so, and where the others are.
    w({ name: 'noNeeds', control: 'badge', label: 'Needs', colors: { '*': 'warn' },
      formula: `"No open needs for " & ${o.machine} & IF(COUNT(FILTER(NeedChoices(${o.position}, ${o.machine}, ${o.taken}), item.line <> ${o.machine})) > 0, ". The needs below are other lines' that nobody is running: pick one to run it here, or Not on the needs list.", ". Pick Not on the needs list and choose the profile, or ask for a need to be added.")`,
      when: o.when ? `AND(${o.when}, COUNT(OpenNeedsFor(${o.machine})) = 0)` : `COUNT(OpenNeedsFor(${o.machine})) = 0` }),
    Object.assign({ name: 'need', control: 'choice', label: 'Need', optionsFrom: `NeedChoices(${o.position}, ${o.machine}, ${o.taken})`,
      optionLabel: `IF(item.line = ${o.machine}, "", item.line & "'s · ") & item.label & " · " & COALESCE(item.made, 0) & " of " & item.racks & " racks done" & IF(IN(item.$id, NeedsRunningElsewhere(${o.position})), " · running on another line now", "")`, defaultFrom: o.defaultNeed,
      placeholder: 'Not on the needs list', hint: 'Filled in from the line\'s next need; pick another to change it. Other lines\' needs that nobody is running come last.', writes: `${target}.need` }, when),
    // Another line's need: say so; the run, its racks and the need all keep it (0.44.4).
    w({ name: 'needFrom', control: 'badge', label: 'Another line\'s need', colors: { '*': 'warn' },
      formula: `"This need is " & needRec.line & "'s. Running it on " & ${o.machine} & " counts its racks toward it, and each one is marked as made on " & ${o.machine} & "."`,
      when: o.when ? `AND(${o.when}, NOT(ISBLANK(need)), needRec.line <> ${o.machine})` : `AND(NOT(ISBLANK(need)), needRec.line <> ${o.machine})` }),
    w({ name: 'cpNeedLine', control: 'value', label: 'The need\'s line', formula: 'needRec.line', snapshot: `${target}.needLine`, when: o.when ? `AND(${o.when}, NOT(ISBLANK(need)))` : 'NOT(ISBLANK(need))' }),
    w({ name: 'cpOffLine', control: 'value', label: 'Off its line', formula: `needRec.line <> ${o.machine}`, snapshot: `${target}.offLine`, when: o.when ? `AND(${o.when}, NOT(ISBLANK(need)))` : 'NOT(ISBLANK(need))' }),
    w({ name: 'otherProfile', control: 'choice', label: 'Profile (not on the needs list)', required: true, optionsFrom: 'FILTER(profiles, item.active = TRUE)', optionLabel: 'item.$id & " · " & item.lengthIn & " in"',
      when: o.when ? `AND(${o.when}, ISBLANK(need))` : 'ISBLANK(need)' }),
    w({ name: 'otherColor', control: 'choice', label: 'Color (not on the needs list)', required: true, options: COLORS, list: true,
      when: o.when ? `AND(${o.when}, ISBLANK(need))` : 'ISBLANK(need)' }),
    w({ name: 'runsWhat', control: 'value', label: 'Profile', formula: 'prof.$id & " · " & ColorName(COALESCE(needRec.color, otherColor)) & " · " & prof.lengthIn & " in · " & prof.pcsPerRack & " pieces a rack"' }),
    // The line's last material when it ran the same profile (0.46): one tap less on most starts.
    w({ name: 'material', control: 'choice', label: 'Material', required: true, options: ['Virgin', 'Regrind', 'Pulverized', 'Mix sell'], writes: `${target}.material`,
      defaultFrom: `IF(AND(NOT(ISBLANK(prof.$id)), LastRunOn(${o.position}).profile = prof.$id), LastRunOn(${o.position}).material, "")`, hint: 'Filled in from the line\'s last run of this profile' }),
    w({ name: 'weatherStrip', control: 'toggle', label: 'Weather strip', writes: `${target}.weatherStrip` }),
    w({ name: 'wsStrands', control: 'number', label: 'Strands', when: o.when ? `AND(${o.when}, weatherStrip = TRUE)` : 'weatherStrip = TRUE', writes: `${target}.wsStrands` }),
    w({ name: 'wsColor', control: 'choice', label: 'Strip color', options: ['White', 'Grey'], when: o.when ? `AND(${o.when}, weatherStrip = TRUE)` : 'weatherStrip = TRUE', writes: `${target}.wsColor` }),
    w({ name: 'wsSize', control: 'text', label: 'Strip size', placeholder: '187x250', when: o.when ? `AND(${o.when}, weatherStrip = TRUE)` : 'weatherStrip = TRUE', writes: `${target}.wsSize` }),
    // A partial rack of the same profile and color waiting from an earlier run: use it?
    w({ name: 'adopt', control: 'toggle', label: 'Use the partial rack waiting for this profile and color?', required: true, yes: 'Yes, use it', no: 'No',
      when: o.when ? `AND(${o.when}, NOT(ISBLANK(partial)))` : 'NOT(ISBLANK(partial))' }),
    w({ name: 'partialInfo', control: 'value', label: 'Partial rack', formula: 'partial.$id & ": " & partial.pieces & " pieces, left by " & partial.line & " on " & TEXT(partial.$firstAt, "ddd MMM d h:mm AM/PM") & IF(ISBLANK(partial.location), "", " · " & partial.location)',
      when: o.when ? `AND(${o.when}, NOT(ISBLANK(partial)))` : 'NOT(ISBLANK(partial))' }),
    // Copied onto the run, so reports and racks have them as they were.
    w({ name: 'cpProfile', control: 'value', label: 'Profile', formula: 'prof.$id', snapshot: `${target}.profile`, required: true }),
    w({ name: 'cpPart', control: 'value', label: 'Part', formula: 'prof.part', snapshot: `${target}.part` }),
    w({ name: 'cpCustomer', control: 'value', label: 'Customer', formula: 'prof.customer', snapshot: `${target}.customer` }),
    w({ name: 'cpColor', control: 'value', label: 'Color', formula: 'COALESCE(needRec.color, otherColor)', snapshot: `${target}.color`, required: true }),
    w({ name: 'cpMaterialKey', control: 'value', label: 'Material', formula: 'material & " " & ColorName(COALESCE(needRec.color, otherColor))', snapshot: `${target}.materialKey` }),
    w({ name: 'cpLength', control: 'value', label: 'Length (in)', formula: 'prof.lengthIn', snapshot: `${target}.lengthNom` }),
    w({ name: 'cpTol', control: 'value', label: 'Length ± (in)', formula: 'COALESCE(prof.lengthTol, 0.25)', snapshot: `${target}.lengthTol` }),
    w({ name: 'cpWtNom', control: 'value', label: 'Lbs/ft nominal', formula: 'prof.wtNom', snapshot: `${target}.wtNom` }),
    w({ name: 'cpWtLow', control: 'value', label: 'Lbs/ft lowest', formula: 'prof.wtLow', snapshot: `${target}.wtLow` }),
    w({ name: 'cpWtHigh', control: 'value', label: 'Lbs/ft highest', formula: 'prof.wtHigh', snapshot: `${target}.wtHigh` }),
    w({ name: 'cpPcs', control: 'value', label: 'Pieces a rack', formula: 'prof.pcsPerRack', snapshot: `${target}.pcsPerRack` }),
    w({ name: 'cpGauge', control: 'value', label: 'Gauge check', formula: 'prof.gauge', snapshot: `${target}.gauge` }),
    w({ name: 'cpAdopted', control: 'value', label: 'Partial rack used', formula: 'partial.$id', snapshot: `${target}.adoptedPartial`, when: o.when ? `AND(${o.when}, adopt = TRUE)` : 'adopt = TRUE' }),
    w({ name: 'cpAdoptedPcs', control: 'value', label: 'Its pieces', formula: 'partial.pieces', snapshot: `${target}.adoptedPieces`, when: o.when ? `AND(${o.when}, adopt = TRUE)` : 'adopt = TRUE' }),
    // The partial rack, marked as used by this run.
    w({ name: 'adoptRun', control: 'value', label: 'Used by run', formula: o.runId, snapshot: 'adoptP.adoptedRun', when: o.when ? `AND(${o.when}, adopt = TRUE)` : 'adopt = TRUE' }),
    w({ name: 'adoptAt', control: 'value', label: 'Used at', formula: 'NOW()', format: 'ddd h:mm AM/PM', snapshot: 'adoptP.adoptedAt', when: o.when ? `AND(${o.when}, adopt = TRUE)` : 'adopt = TRUE' }),
    w({ name: 'adoptBy', control: 'value', label: 'Used by', formula: 'USER()', snapshot: 'adoptP.adoptedBy', when: o.when ? `AND(${o.when}, adopt = TRUE)` : 'adopt = TRUE' }),
  ];
}
// Sources a new run's fields read: needs, profiles, the chosen need and profile, a waiting partial rack.
const newRunSources = [
  { name: 'needs', kind: 'value', formula: 'NeedsAll()' },
  { name: 'profiles', kind: 'value', formula: 'ProfilesAll()' },
  { name: 'needRec', kind: 'value', formula: 'IF(ISBLANK(need), "", needs[need])' },
  { name: 'prof', kind: 'value', formula: 'profiles[COALESCE(needRec.profile, otherProfile)]' },
  { name: 'partial', kind: 'value', formula: 'FIRST(SORT(FILTER(PartialsAll(), AND(item.$status = "In stock", item.profile = prof.$id, item.color = COALESCE(needRec.color, otherColor))), item.$firstAt, "desc"))' },
  { name: 'adoptP', kind: 'item', structure: 'partials', id: { where: '$id = form.partial.$id' }, values: { adoptedRun: 'write', adoptedAt: 'write', adoptedBy: 'write' } },
];
const DETAILS = ['cpProfile 4', 'cpPart 4', 'cpCustomer 4'];
const detailRows = [['cpNeedLine 6', 'cpOffLine 6'], DETAILS, ['cpColor 4', 'cpMaterialKey 4', 'cpLength 4'], ['cpTol 4', 'cpWtNom 4', 'cpWtLow 4'], ['cpWtHigh 4', 'cpPcs 4', 'cpGauge 4'], ['cpAdopted 4', 'cpAdoptedPcs 4', 'adoptRun 4'], ['adoptAt 6', 'adoptBy 6']];

const forms = [];

/* ---------- Profiles: the master list ---------- */
forms.push(['profiles', {
  title: 'Profiles', sites: ALL, launchable: true, saveLabel: 'Save profile', savedMessage: 'Profile saved',
  sources: [
    { name: 'profile', kind: 'item', structure: 'profiles', id: { field: 'profileId' }, values: { part: 'both', customer: 'both', lengthIn: 'both', lengthTol: 'both', pcsPerRack: 'both', wtLow: 'both', wtNom: 'both', wtHigh: 'both', pattern: 'both', gauge: 'both', active: 'both', notes: 'both' } },
    { name: 'list', kind: 'value', formula: 'ProfilesAll()' },
    // The profile as it is now, while the part and customer are typed (empty for a new one).
    { name: 'cur', kind: 'value', formula: 'IF(OR(ISBLANK(part), ISBLANK(customer)), "", list[part & " " & customer])' },
  ],
  fields: [
    { name: 'part', control: 'text', label: 'Part number', required: true, hint: 'e.g. 805, V819, PO14134', writes: 'profile.part' },
    { name: 'customer', control: 'text', label: 'Customer', required: true, uppercase: true, hint: 'e.g. ABI, CLAYTON, MI WINDOWS, JELDWEN', writes: 'profile.customer' },
    { name: 'profileId', control: 'value', label: 'Profile', formula: 'part & " " & customer', required: true },
    { name: 'isNew', control: 'badge', label: 'This is', formula: 'IF(ISBLANK(cur), "a new profile", "a change to " & profileId)', colors: { 'a new profile': 'good' } },
    { name: 'lengthIn', control: 'number', label: 'Length', unit: 'in', required: true, defaultFrom: 'cur.lengthIn', writes: 'profile.lengthIn', limits: { min: 1 } },
    { name: 'lengthTol', control: 'number', label: 'Length ±', unit: 'in', required: true, defaultFrom: 'COALESCE(cur.lengthTol, 0.25)', writes: 'profile.lengthTol', hint: 'Lengths further off than this show a warning', limits: { min: 0 } },
    { name: 'pcsPerRack', control: 'number', label: 'Pieces a rack', required: true, defaultFrom: 'cur.pcsPerRack', writes: 'profile.pcsPerRack', limits: { min: 1 } },
    { name: 'pattern', control: 'text', label: 'Across / up', defaultFrom: 'cur.pattern', writes: 'profile.pattern', hint: 'e.g. 7 / 15, or Weight Count 1856' },
    { name: 'wtLow', control: 'number', label: 'Lowest lbs/ft', decimals: 3, defaultFrom: 'cur.wtLow', writes: 'profile.wtLow' },
    { name: 'wtNom', control: 'number', label: 'Nominal lbs/ft', decimals: 3, required: true, defaultFrom: 'cur.wtNom', writes: 'profile.wtNom', warn: { min: 'wtLow', max: 'wtHigh', message: 'Not between the lowest and highest' } },
    { name: 'wtHigh', control: 'number', label: 'Highest lbs/ft', decimals: 3, defaultFrom: 'cur.wtHigh', writes: 'profile.wtHigh', rule: 'OR(ISBLANK(wtLow), wtHigh > wtLow)', ruleText: 'The highest must be above the lowest' },
    { name: 'gauge', control: 'toggle', label: 'Gauge check', defaultFrom: 'COALESCE(cur.gauge, TRUE)', writes: 'profile.gauge' },
    { name: 'active', control: 'toggle', label: 'Running it now', yes: 'Active', no: 'Off', defaultFrom: 'COALESCE(cur.active, TRUE)', writes: 'profile.active', hint: 'Off: left out of the needs and the operator forms' },
    { name: 'notes', control: 'textarea', label: 'Notes', defaultFrom: 'cur.notes', writes: 'profile.notes' },
    { name: 'all', control: 'records', label: 'Every profile', formula: 'list', sort: '$id', ascending: true, limit: 300,
      columns: [{ key: '$id', label: 'Profile' }, { key: 'lengthIn', label: 'Length (in)' }, { key: 'pcsPerRack', label: 'Pcs/rack' }, { key: 'wtLow', label: 'Low', format: '0.000' }, { key: 'wtNom', label: 'Nom', format: '0.000' }, { key: 'wtHigh', label: 'High', format: '0.000' }, { key: 'pattern', label: 'Across / up' }, { key: '$status', label: 'Status' }] },
  ],
  layout: [
    ['part 4', 'customer 4', 'profileId 4'], ['isNew 12'],
    ['lengthIn 3', 'lengthTol 3', 'pcsPerRack 3', 'pattern 3'],
    ['wtLow 4', 'wtNom 4', 'wtHigh 4'],
    ['gauge 4', 'active 4'], ['notes 12'],
    { section: 'Every profile', fold: 'open', rows: [['all 12']] },
  ],
}]);

/* ---------- Lines ---------- */
forms.push(['lines', {
  title: 'Lines', sites: ALL, launchable: true, saveLabel: 'Save line', savedMessage: 'Line saved',
  sources: [
    { name: 'lineItem', kind: 'item', structure: 'lines', id: { field: 'lineId' }, values: { line: 'both', active: 'both', notes: 'both' } },
    { name: 'list', kind: 'value', formula: 'LinesAll()' },
  ],
  fields: [
    { name: 'lineId', control: 'text', label: 'Line', required: true, hint: 'e.g. Line 4. A line running several strands at once: one for each, e.g. Line 3 A, Line 3 B.' },
    { name: 'belongsTo', control: 'text', label: 'Line it belongs to', required: true, defaultFrom: 'COALESCE(lineItem.line, lineId)', writes: 'lineItem.line', hint: 'Itself; for a strand, its line (Line 3). Needs are set for this.' },
    { name: 'active', control: 'toggle', label: 'Running', yes: 'Active', no: 'Off', required: true, defaultFrom: 'COALESCE(lineItem.active, FALSE)', writes: 'lineItem.active', hint: 'Active lines are offered when a shift starts' },
    { name: 'notes', control: 'textarea', label: 'Notes', defaultFrom: 'lineItem.notes', writes: 'lineItem.notes' },
    { name: 'all', control: 'records', label: 'Every line', formula: 'list', sort: '$id', ascending: true, limit: 100,
      columns: [{ key: '$id', label: 'Line' }, { key: 'line', label: 'Belongs to' }, { key: '$status', label: 'Status' }, { key: 'notes', label: 'Notes' }] },
  ],
  layout: [['lineId 6', 'belongsTo 6'], ['active 6'], ['notes 12'], { section: 'Every line', rows: [['all 12']] }],
}]);

/* ---------- Needs: what to make, per profile per line ---------- */
forms.push(['needs', {
  title: 'Needs', sites: ALL, launchable: true, saveLabel: 'Add the need', savedMessage: 'Need added',
  sources: [
    { name: 'need', kind: 'item', structure: 'needs', id: { generate: true, prefix: 'N' }, values: { line: 'write', profile: 'write', part: 'write', customer: 'write', color: 'write', colorName: 'write', racks: 'write', priority: 'write', due: 'write', notes: 'write', label: 'write' } },
    { name: 'lines', kind: 'value', formula: 'LinesAll()' },
    { name: 'profiles', kind: 'value', formula: 'ProfilesAll()' },
    { name: 'needs', kind: 'value', formula: 'NeedsAll()' },
  ],
  fields: [
    { name: 'line', control: 'choice', label: 'Line', required: true, optionsFrom: 'SORT(UNIQUE(EACH(lines, item.line)))', writes: 'need.line' },
    { name: 'profile', control: 'choice', label: 'Profile', required: true, optionsFrom: 'SORT(FILTER(profiles, item.active = TRUE), item.$id)', optionLabel: 'item.$id & " · " & item.lengthIn & " in · " & item.pcsPerRack & " pcs a rack"', writes: 'need.profile' },
    { name: 'color', control: 'choice', label: 'Color', required: true, options: COLORS, writes: 'need.color' },
    { name: 'racks', control: 'number', label: 'Racks needed', required: true, limits: { min: 1 }, writes: 'need.racks' },
    { name: 'priority', control: 'choice', label: 'Priority', required: true, options: [{ value: 1, label: '1 · first' }, { value: 2, label: '2' }, { value: 3, label: '3 · last' }], default: 2, writes: 'need.priority', hint: 'A line runs its open needs in this order, oldest first within a priority' },
    { name: 'due', control: 'date', label: 'Due', writes: 'need.due' },
    { name: 'notes', control: 'textarea', label: 'Notes', placeholder: 'e.g. use pulverized material; use the partial rack', writes: 'need.notes' },
    { name: 'part', control: 'value', label: 'Part', formula: 'profiles[profile].part', snapshot: 'need.part' },
    { name: 'customer', control: 'value', label: 'Customer', formula: 'profiles[profile].customer', snapshot: 'need.customer' },
    { name: 'colorName', control: 'value', label: 'Color', formula: 'ColorName(color)', snapshot: 'need.colorName' },
    { name: 'label', control: 'value', label: 'Shown as', formula: 'profile & " " & ColorName(color) & " · " & racks & " racks"', snapshot: 'need.label', required: true },
    { name: 'open', control: 'board', label: 'Open needs', formula: 'SORT(FILTER(needs, item.$status = "Open"), item.line & "|" & item.priority & "|" & item.$firstAt)', title: 'profile', show: '{line} · {colorName} · priority {priority}{offLineNote}', progress: { done: 'made', of: 'racks' }, sort: 'given', limit: 100, colors: { Open: 'warn', Done: 'good' } },
  ],
  layout: [['line 4', 'profile 8'], ['color 4', 'racks 4', 'priority 4'], ['due 4', 'notes 8'], ['part 3', 'customer 3', 'colorName 3', 'label 3'], ['open 12']],
}]);

forms.push(['change-need', {
  title: 'Change a need', sites: ALL, launchable: true, saveLabel: 'Save the change', savedMessage: 'Need changed',
  sources: [
    { name: 'needs', kind: 'value', formula: 'NeedsAll()' },
    { name: 'need', kind: 'item', structure: 'needs', id: { field: 'pick' }, values: { racks: 'both', priority: 'both', due: 'both', notes: 'both', cancelled: 'both', label: 'write' } },
  ],
  fields: [
    { name: 'pick', control: 'choice', label: 'Need', required: true, optionsFrom: 'SORT(FILTER(needs, item.$status = "Open"), item.line & "|" & item.priority)', optionLabel: 'item.line & " · " & item.label & " · " & COALESCE(item.made, 0) & " done"' },
    { name: 'done', control: 'value', label: 'Done so far', formula: 'COALESCE(need.made, 0) & " of " & need.racks & " racks"' },
    { name: 'racks', control: 'number', label: 'Racks needed', required: true, defaultFrom: 'need.racks', limits: { min: 1 }, writes: 'need.racks', hint: 'At or below what is done, the need closes' },
    { name: 'priority', control: 'choice', label: 'Priority', required: true, options: [{ value: 1, label: '1 · first' }, { value: 2, label: '2' }, { value: 3, label: '3 · last' }], defaultFrom: 'need.priority', writes: 'need.priority' },
    { name: 'due', control: 'date', label: 'Due', defaultFrom: 'need.due', writes: 'need.due' },
    { name: 'notes', control: 'textarea', label: 'Notes', defaultFrom: 'need.notes', writes: 'need.notes' },
    { name: 'cancel', control: 'toggle', label: 'Cancel this need', yes: 'Cancel it', no: 'Keep it', writes: 'need.cancelled' },
    { name: 'label', control: 'value', label: 'Shown as', formula: 'need.profile & " " & ColorName(need.color) & " · " & racks & " racks"', snapshot: 'need.label' },
  ],
  layout: [['pick 8', 'done 4'], ['racks 4', 'priority 4', 'due 4'], ['notes 12'], ['cancel 6', 'label 6']],
}]);

/* ---------- Start shift: the shift, then what runs on each line ---------- */
forms.push(['start-shift', {
  title: 'Start shift', sites: ALL, launchable: true, saveLabel: 'Start the shift', savedMessage: 'Shift started',
  density: 'compact', keyboard: 'always',
  sources: [
    { name: 'shift', kind: 'item', structure: 'shifts', id: { field: 'shiftId' }, values: { operator: 'write', crew: 'write', startAt: 'write', hours: 'write', endAt: 'write', lines: 'write', caliperOn: 'write' } },
    { name: 'lines', kind: 'value', formula: 'LinesAll()' },
  ],
  fields: [
    { name: 'me', control: 'value', label: 'Operator', formula: 'USER()', snapshot: 'shift.operator', required: true },
    { name: 'crew', control: 'choice', label: 'Crew', required: true, options: [{ value: 'A', label: 'Day (A)' }, { value: 'P', label: 'Night (P)' }], defaultFrom: 'IF(AND(HOUR(NOW()) >= 4, HOUR(NOW()) < 16), "A", "P")', writes: 'shift.crew' },
    { name: 'startAt', control: 'datetime', label: 'Shift started', required: true, defaultFrom: 'STARTOF(DATEADD(NOW(), 30, "minutes"), "hour")', writes: 'shift.startAt',
      rule: 'AND(DATEDIFF(startAt, NOW(), "hours") < 12, DATEDIFF(startAt, NOW(), "hours") > -1)', ruleText: 'The start must be in the last 12 hours (or the next hour)' },
    { name: 'hours', control: 'choice', label: 'Hours', required: true, options: [12, 10, 8, 6, 4, 3], default: 12, writes: 'shift.hours', hint: 'Half and quarter shifts too' },
    { name: 'endAt', control: 'value', label: 'Ends', formula: 'DATEADD(startAt, hours, "hours")', format: 'ddd h:mm AM/PM', snapshot: 'shift.endAt', required: true },
    { name: 'lineList', control: 'chips', label: 'Lines you run', required: true, optionsFrom: 'SORT(EACH(FILTER(lines, item.active = TRUE), item.$id))', writes: 'shift.lines', hint: 'Active lines; set them up in the Lines form' },
    { name: 'caliper', control: 'toggle', label: 'Caliper is at the line', required: true, yes: 'Yes', no: 'No', writes: 'shift.caliperOn', rule: 'caliper = TRUE', ruleText: 'Find the caliper before you start' },
    { name: 'shiftId', control: 'value', label: 'Shift', formula: 'TEXT(startAt, "yyMMdd-HHmm") & " " & me', required: true },
  ],
  subforms: [{
    name: 'lineRuns', label: 'What runs on each line', title: '"What runs on " & each', repeat: { list: 'lineList' }, required: true,
    sources: [
      { name: 'run', kind: 'item', structure: 'runs', id: { field: 'runId' }, values: { shift: 'write', operator: 'write', crew: 'write', date: 'write', line: 'write', machine: 'write', need: 'write', needLine: 'write', offLine: 'write', profile: 'write', part: 'write', customer: 'write', color: 'write', material: 'write', materialKey: 'write', lengthNom: 'write', lengthTol: 'write', wtNom: 'write', wtLow: 'write', wtHigh: 'write', pcsPerRack: 'write', gauge: 'write', startAt: 'write', shiftEndAt: 'write', adoptedPartial: 'write', adoptedPieces: 'write', weatherStrip: 'write', wsStrands: 'write', wsColor: 'write', wsSize: 'write' } },
      { name: 'lineRec', kind: 'value', formula: 'lines[each]' },
    ].concat(newRunSources),
    fields: [
      { name: 'pos', control: 'value', label: 'Line', formula: 'each', snapshot: 'run.line', required: true },
      { name: 'machine', control: 'value', label: 'Belongs to', formula: 'COALESCE(lineRec.line, each)', snapshot: 'run.machine' },
      { name: 'runId', control: 'value', label: 'Run', formula: 'TEXT(startAt, "yyMMdd-HHmm") & " " & each', required: true },
      { name: 'cpShift', control: 'value', label: 'Shift', formula: 'shiftId', snapshot: 'run.shift' },
      { name: 'cpOperator', control: 'value', label: 'Operator', formula: 'me', snapshot: 'run.operator' },
      { name: 'cpCrew', control: 'value', label: 'Crew', formula: 'crew', snapshot: 'run.crew' },
      { name: 'cpDate', control: 'value', label: 'Date', formula: 'TEXT(startAt, "yyyy-MM-dd")', snapshot: 'run.date' },
      { name: 'cpStart', control: 'value', label: 'Started', formula: 'startAt', format: 'ddd h:mm AM/PM', snapshot: 'run.startAt' },
      { name: 'cpEnd', control: 'value', label: 'Shift ends', formula: 'endAt', format: 'ddd h:mm AM/PM', snapshot: 'run.shiftEndAt' },
    ].concat(newRunFields('run', { machine: 'COALESCE(lineRec.line, each)', position: 'each', taken: 'EACH(others, item.need)', defaultNeed: 'NextNeed(each, COALESCE(lineRec.line, each))', runId: 'runId' })),
    layout: [
      { panels: [
        { panel: 'What it makes', rows: [['noNeeds 12'], ['need 12'], ['needFrom 12'], ['otherProfile 7', 'otherColor 5'], ['runsWhat 12']] },
        { panel: 'Material and extras', width: 'half', rows: [['material 12'], ['partialInfo 12'], ['adopt 12'], ['weatherStrip 12'], ['wsStrands 4', 'wsColor 4', 'wsSize 4']] },
      ] },
      { section: 'Saved with the run', fold: 'closed', rows: [['pos 4', 'machine 4', 'runId 4'], ['cpShift 4', 'cpOperator 4', 'cpCrew 4'], ['cpDate 4', 'cpStart 4', 'cpEnd 4']].concat(detailRows) },
    ],
  }],
  buttons: [
    { name: 'lineRunsBtn', label: 'What runs on each line', action: 'subform', subform: 'lineRuns' },
    { name: 'save', label: 'Start the shift', action: 'save' },
  ],
  layout: [
    { panels: [
      { panel: 'Your shift', width: 'half', rows: [['me 6', 'crew 6'], ['startAt 6', 'endAt 6'], ['hours 12'], ['shiftId 12']] },
      { panel: 'Your lines', rows: [['lineList 12'], ['caliper 12'], ['lineRunsBtn 12']] },
    ] },
  ],
}]);

/* ---------- Hourly check ---------- */
forms.push(['hourly', {
  title: 'Hourly check', sites: ALL, launchable: true, refresh: 1, savedMessage: 'Check saved: {run}, {slot}',
  density: 'compact', keyboard: 'always',
  sources: [
    runningSource,
    { name: 'runRec', kind: 'item', structure: 'runs', id: { field: 'run' }, values: { slot: 'write', lineStatus: 'write', lengthAct: 'write', lengthDev: 'write', surface: 'write', colorCheck: 'write', gaugeCheck: 'write', speed: 'write', weight: 'write', surfaceBad: 'write', colorBad: 'write', checkedBy: 'write', checkNote: 'write', line: 'write', part: 'write', profile: 'write', color: 'write' } },
    { name: 'open', kind: 'value', formula: 'SlotsOpen(runRec.startAt, runRec.doneSlots, runRec.shiftEndAt)' },
  ],
  fields: [
    runPick(`FIRST(SORT(${MINE}, ${URGENCY} & "|" & item.line)).$id`),
    { name: 'runs', control: 'value', label: 'Running', formula: 'runRec.part & " " & runRec.customer & " · " & ColorName(runRec.color) & " · " & runRec.lengthNom & " in"' },
    { name: 'slot', control: 'choice', label: 'Hour', required: true, optionsFrom: 'open', optionLabel: 'TEXT(item, "h AM") & IF(item < STARTOF(NOW(), "hour"), " (late)", "")', defaultFrom: 'FIRST(open)', writes: 'runRec.slot',
      rule: 'IN(slot, open)', ruleText: 'That hour has closed: a check can be entered until the end of the next hour', hint: 'Due during its hour, late during the next, then closed' },
    { name: 'upToDate', control: 'badge', label: 'Checks', formula: 'IF(ISBLANK(run), "", SlotNote(runRec.startAt, runRec.doneSlots, runRec.shiftEndAt))', colors: { 'checks up to date': 'good' } },
    { name: 'lineStatus', control: 'choice', label: 'The line this hour', required: true, options: ['Running', 'Start up', 'Scrapping', 'Down'], colors: { Running: 'good', 'Start up': 'warn', Scrapping: 'warn', Down: 'bad' }, writes: 'runRec.lineStatus',
      defaultFrom: 'IF(ISBLANK(run), "", COALESCE(runRec.lineStatus, "Running"))', hint: 'Starts at what the last check said' },
    { name: 'lengthAct', control: 'number', label: 'Actual length', unit: 'in', decimals: 3, required: true, when: 'lineStatus <> "Down"', writes: 'runRec.lengthAct',
      warn: { min: 'runRec.lengthNom - runRec.lengthTol', max: 'runRec.lengthNom + runRec.lengthTol', message: 'Off nominal by more than the tolerance' } },
    { name: 'nominal', control: 'value', label: 'Nominal', formula: 'runRec.lengthNom & " in ± " & runRec.lengthTol', when: 'lineStatus <> "Down"' },
    { name: 'lengthDev', control: 'value', label: 'Off nominal', formula: 'ROUND(lengthAct - runRec.lengthNom, 3)', format: '0.000', snapshot: 'runRec.lengthDev', when: 'lineStatus <> "Down"' },
    Object.assign({ name: 'surface', control: 'choice', label: 'Surface defects', required: true, when: 'lineStatus <> "Down"', writes: 'runRec.surface' }, PASSFAIL),
    Object.assign({ name: 'colorCheck', control: 'choice', label: 'Color check', required: true, when: 'lineStatus <> "Down"', writes: 'runRec.colorCheck' }, PASSFAIL),
    Object.assign({ name: 'gaugeCheck', control: 'choice', label: 'Gauge check', when: 'AND(lineStatus <> "Down", runRec.gauge = TRUE)', writes: 'runRec.gaugeCheck' }, PASSFAIL),
    { name: 'speed', control: 'number', label: 'Line speed', unit: 'ft/min', required: true, when: 'lineStatus <> "Down"', writes: 'runRec.speed', limits: { min: 0 } },
    { name: 'lastSpeed', control: 'value', label: 'Last hour', formula: 'IF(ISBLANK(runRec.speed), "—", runRec.speed & " ft/min")', when: 'lineStatus <> "Down"' },
    { name: 'weight', control: 'number', label: 'Weight', unit: 'lbs/ft', decimals: 3, when: 'lineStatus <> "Down"', writes: 'runRec.weight',
      warn: { min: 'runRec.wtLow', max: 'runRec.wtHigh', message: 'Outside the profile\'s lowest to highest' } },
    { name: 'checkNote', control: 'text', label: 'Note', writes: 'runRec.checkNote' },
    { name: 'surfaceBad', control: 'value', label: 'Surface fail', formula: 'IF(surface = "Fail", 1, 0)', snapshot: 'runRec.surfaceBad', when: 'lineStatus <> "Down"' },
    { name: 'colorBad', control: 'value', label: 'Color fail', formula: 'IF(colorCheck = "Fail", 1, 0)', snapshot: 'runRec.colorBad', when: 'lineStatus <> "Down"' },
    { name: 'by', control: 'value', label: 'Checked by', formula: 'USER()', snapshot: 'runRec.checkedBy' },
    { name: 'cpLine', control: 'value', label: 'Line', formula: 'runRec.line', snapshot: 'runRec.line' },
    { name: 'cpPart', control: 'value', label: 'Part', formula: 'runRec.part', snapshot: 'runRec.part' },
    { name: 'cpProfile', control: 'value', label: 'Profile', formula: 'runRec.profile', snapshot: 'runRec.profile' },
    { name: 'cpColor', control: 'value', label: 'Color', formula: 'runRec.color', snapshot: 'runRec.color' },
    { name: 'history', control: 'records', label: 'This run\'s checks', formula: 'IF(ISBLANK(run), LIST(), RunChecks(run))', sort: 'slot', limit: 24,
      columns: [{ key: 'slot', label: 'Hour', format: 'h AM' }, { key: 'lineStatus', label: 'Line' }, { key: 'lengthAct', label: 'Length', format: '0.000' }, { key: 'lengthDev', label: '±', format: '0.000' }, { key: 'surface', label: 'Surface' }, { key: 'colorCheck', label: 'Color' }, { key: 'speed', label: 'Speed' }, { key: 'weight', label: 'Lbs/ft', format: '0.000' }, { key: 'checkedBy', label: 'By' }] },
  ],
  buttons: [
    { name: 'allPass', label: 'All pass', action: 'set', sets: { surface: 'Pass', colorCheck: 'Pass', gaugeCheck: 'Pass' }, when: 'lineStatus <> "Down"' },
    { name: 'save', label: 'Save check', action: 'save', saveAs: 'hourly', then: 'close' },
  ],
  layout: [
    { panels: [
      { panel: 'The line', width: 'third', rows: [['run 12'], ['runs 12'], ['slot 12'], ['upToDate 12'], ['lineStatus 12']] },
      { panel: 'The check', rows: [['lengthAct 4', 'nominal 4', 'lengthDev 4'],
        ['allPass 12'], ['surface 4', 'colorCheck 4', 'gaugeCheck 4'], ['speed 4', 'lastSpeed 4', 'weight 4'], ['checkNote 12']] },
    ] },
    { section: 'This run\'s checks', fold: 'closed', rows: [['history 12']] },
    { section: 'Saved with the check', fold: 'closed', rows: [['surfaceBad 6', 'colorBad 6'], ['by 6', 'cpLine 6'], ['cpPart 6', 'cpProfile 6'], ['cpColor 6']] },
  ],
}]);

/* ---------- The line board (0.47): the operator's home; each running line a card with its checks and need ---------- */
forms.push(['line-board', {
  title: 'Lines', sites: ALL, launchable: true, home: true, refresh: 1, buttons: [],
  sources: [
    { name: 'onBoard', kind: 'items', structure: 'runs', filter: 'AND(status = "Running", OR(form.everyLine = TRUE, operator = USER()))' },
    { name: 'needs', kind: 'value', formula: 'NeedsAll()' },
  ],
  fields: [
    { name: 'lines', control: 'buttons', label: 'Your lines', formula: `SORT(onBoard, ${URGENCY} & "|" & item.line)`,
      caption: 'item.line & " · " & item.part & " " & item.customer & " · " & ColorName(item.color)',
      detail: 'SlotNote(item.startAt, item.doneSlots, item.shiftEndAt) & " · " & IF(ISBLANK(item.need), COALESCE(item.racks, 0) & " racks", COALESCE(needs[item.need].made, 0) & " of " & needs[item.need].racks & " racks of the need")',
      tone: 'IF(SlotState(item.startAt, item.doneSlots, item.shiftEndAt) = "late", "bad", IF(SlotState(item.startAt, item.doneSlots, item.shiftEndAt) = "due", "warn", "good"))',
      actions: [
        { label: 'Hourly check', form: 'hourly', prefill: { run: 'item.$id' } },
        { label: 'Rack', form: 'rack', prefill: { run: 'item.$id' } },
        { label: 'Changeover', form: 'changeover', prefill: { run: 'item.$id' } },
      ],
      empty: 'No line is running for you: start your shift first (or show every running line).' },
    everyLineField,
  ],
  layout: [['lines 12'], ['everyLine 12']],
}]);

/* ---------- Rack ---------- */
forms.push(['rack', {
  title: 'Rack', sites: ALL, launchable: true, refresh: 1, saveLabel: 'Save rack', savedMessage: 'Rack saved',
  density: 'compact',
  sources: [
    runningSource,
    // Each rack carries its run's details (0.50): one line here instead of a field for each.
    { name: 'runRec', kind: 'item', structure: 'runs', id: { field: 'run' }, values: { racks: 'write', pieces: 'write' },
      carry: [
        { to: 'rack', values: { run: '= run', shift: 'shift', operator: '= USER()', crew: 'crew', date: 'date', line: 'line', machine: 'machine', need: 'need', profile: 'profile', part: 'part', customer: 'customer', color: 'color', madeAt: '= NOW()' } },
        { to: 'rack', when: 'NOT(ISBLANK(runRec.need))', values: { needLine: 'needLine', offLine: '= runRec.offLine = TRUE' } },
        { to: 'rack', when: 'firstWithPartial = TRUE', values: { partial: 'adoptedPartial', partialPieces: 'adoptedPieces' } },
      ] },
    { name: 'needs', kind: 'value', formula: 'NeedsAll()' },
    { name: 'rack', kind: 'item', structure: 'racks', id: { field: 'rackId' }, values: { run: 'write', shift: 'write', operator: 'write', crew: 'write', date: 'write', line: 'write', machine: 'write', need: 'write', needLine: 'write', offLine: 'write', profile: 'write', part: 'write', customer: 'write', color: 'write', pieces: 'write', partial: 'write', partialPieces: 'write', madeAt: 'write', notes: 'write' } },
    { name: 'needItem', kind: 'item', structure: 'needs', id: { field: 'needOf' }, values: { made: 'write', madeOffLine: 'write', madeOn: 'write' } },
  ],
  fields: [
    Object.assign(runPick(ONLY_MINE), { keep: true }),
    { name: 'runs', control: 'value', label: 'Running', formula: 'runRec.part & " " & runRec.customer & " · " & ColorName(runRec.color)' },
    { name: 'rackId', control: 'text', label: 'Rack ID (ERP)', required: true, uppercase: true, enterMovesOn: true, hint: 'Type or scan the ERP tag number',
      rule: 'ISBLANK(rack.$firstAt)', ruleText: 'Rack {value} is already recorded' },
    { name: 'pieces', control: 'number', label: 'Pieces on the rack', required: true, defaultFrom: 'runRec.pcsPerRack', limits: { min: 1 }, writes: 'rack.pieces' },
    { name: 'firstWithPartial', control: 'value', label: 'First rack of the run, on a partial rack', formula: 'AND(COALESCE(runRec.racks, 0) = 0, NOT(ISBLANK(runRec.adoptedPartial)))' },
    { name: 'partialNote', control: 'badge', label: 'Partial rack', formula: 'IF(firstWithPartial, "This rack finishes partial rack " & runRec.adoptedPartial & " (" & runRec.adoptedPieces & " pieces already on it)", "")', colors: {} },
    { name: 'needProgress', control: 'badge', label: 'Need', formula: 'IF(ISBLANK(runRec.need), "Not on the needs list", needs[runRec.need].label & ": this makes " & (COALESCE(needs[runRec.need].made, 0) + 1) & " of " & needs[runRec.need].racks & IF(runRec.offLine = TRUE, " (" & runRec.needLine & "\'s need, made on " & runRec.machine & ")", ""))' },
    { name: 'notes', control: 'text', label: 'Note', writes: 'rack.notes' },
    // Counted on the run and the need; copied onto the rack for tracing.
    { name: 'oneRack', control: 'value', label: 'Racks', formula: '1', snapshot: 'runRec.racks' },
    { name: 'madePieces', control: 'value', label: 'Pieces made on this run', formula: 'pieces - IF(firstWithPartial, runRec.adoptedPieces, 0)', snapshot: 'runRec.pieces' },
    { name: 'needOf', control: 'value', label: 'Need', formula: 'runRec.need', when: 'NOT(ISBLANK(runRec.need))', required: true },
    { name: 'needMade', control: 'value', label: 'Counts toward the need', formula: '1', snapshot: 'needItem.made', when: 'NOT(ISBLANK(runRec.need))' },
    { name: 'needOffLine', control: 'value', label: 'Made off its line', formula: 'IF(runRec.offLine = TRUE, 1, 0)', snapshot: 'needItem.madeOffLine', when: 'NOT(ISBLANK(runRec.need))' },
    { name: 'needMadeOn', control: 'value', label: 'Made on', formula: 'runRec.machine', snapshot: 'needItem.madeOn', when: 'NOT(ISBLANK(runRec.need))' },
  ],
  layout: [
    { section: 'This rack', rows: [['run 6', 'runs 6'], ['rackId 6', 'pieces 6'], ['needProgress 12'], ['partialNote 12'], ['notes 12']] },
    { section: 'Saved with the rack', fold: 'closed', rows: [['firstWithPartial 4', 'oneRack 4', 'madePieces 4'], ['needOf 6', 'needMade 6'], ['needOffLine 6', 'needMadeOn 6']] },
  ],
}]);

/* ---------- Changeover: end the run, leave a partial rack, start the next ---------- */
const NEXT = 'next = "New run"';
forms.push(['changeover', {
  title: 'Changeover', sites: ALL, launchable: true, refresh: 1, saveLabel: 'Save the changeover', savedMessage: 'Changeover saved',
  density: 'compact', keyboard: 'always',
  sources: [
    runningSource,
    { name: 'old', kind: 'item', structure: 'runs', id: { field: 'run' }, values: { endAt: 'write', endReason: 'write', partialLeft: 'write', scrapFt: 'write', pieces: 'write' },
      // What the partial rack and the next run take from the run ending (0.50).
      carry: [
        { to: 'leftover', when: 'partialLeft > 0', values: { profile: 'profile', part: 'part', customer: 'customer', color: 'color', line: 'line', pieces: '= partialLeft', fromRun: '= run' } },
        { to: 'newRun', when: NEXT, values: { shift: 'shift', crew: 'crew', date: 'date', line: 'line', machine: 'machine', shiftEndAt: 'shiftEndAt', operator: '= USER()', startAt: '= NOW()' } },
      ] },
    { name: 'lines', kind: 'value', formula: 'LinesAll()' },
    { name: 'leftover', kind: 'item', structure: 'partials', id: { field: 'partialId' }, values: { profile: 'write', part: 'write', customer: 'write', color: 'write', pieces: 'write', fromRun: 'write', line: 'write', location: 'write' } },
    { name: 'newRun', kind: 'item', structure: 'runs', id: { field: 'newRunId' }, values: { shift: 'write', operator: 'write', crew: 'write', date: 'write', line: 'write', machine: 'write', need: 'write', needLine: 'write', offLine: 'write', profile: 'write', part: 'write', customer: 'write', color: 'write', material: 'write', materialKey: 'write', lengthNom: 'write', lengthTol: 'write', wtNom: 'write', wtLow: 'write', wtHigh: 'write', pcsPerRack: 'write', gauge: 'write', startAt: 'write', shiftEndAt: 'write', adoptedPartial: 'write', adoptedPieces: 'write', weatherStrip: 'write', wsStrands: 'write', wsColor: 'write', wsSize: 'write' } },
  ].concat(newRunSources),
  fields: [
    runPick(ONLY_MINE),
    { name: 'runs', control: 'value', label: 'Running now', formula: 'old.part & " " & old.customer & " · " & ColorName(old.color) & " · " & COALESCE(old.racks, 0) & " racks"' },
    { name: 'partialLeft', control: 'number', label: 'Pieces left on the partial rack', required: true, limits: { min: 0 }, writes: 'old.partialLeft', hint: '0 if the last rack was full. Pieces left wait for the next run of this profile and color.' },
    { name: 'location', control: 'text', label: 'Where the partial rack is', when: 'partialLeft > 0', writes: 'leftover.location', placeholder: 'e.g. end of Line 3' },
    { name: 'scrapFt', control: 'number', label: 'Scrap this run', unit: 'ft', limits: { min: 0 }, writes: 'old.scrapFt' },
    { name: 'next', control: 'choice', label: 'What next', required: true, options: ['New run', 'Line stops'], default: 'New run' },
    { name: 'endAt', control: 'value', label: 'Run ended', formula: 'NOW()', format: 'ddd h:mm AM/PM', snapshot: 'old.endAt' },
    { name: 'endReason', control: 'value', label: 'Why', formula: 'IF(next = "New run", "Changeover", "Line stopped")', snapshot: 'old.endReason' },
    { name: 'leftPieces', control: 'value', label: 'Pieces made (on the partial rack)', formula: 'partialLeft', snapshot: 'old.pieces', when: 'partialLeft > 0' },
    { name: 'partialId', control: 'value', label: 'Partial rack', formula: '"PR " & TEXT(NOW(), "yyMMdd-HHmm") & " " & old.line', required: true, when: 'partialLeft > 0' },
    { name: 'newRunId', control: 'value', label: 'New run', formula: 'TEXT(NOW(), "yyMMdd-HHmm") & " " & old.line', required: true, when: NEXT },
  ].concat(newRunFields('newRun', { when: NEXT, machine: 'old.machine', runId: 'newRunId',
    position: 'old.line', taken: 'LIST()', defaultNeed: 'FIRST(FILTER(OpenNeedsFor(old.machine), item.$id <> old.need)).$id' })),
  layout: [
    { panels: [
      { panel: 'Ending this run', rows: [['run 6', 'runs 6'], ['partialLeft 6', 'scrapFt 6'], ['location 12'], ['next 12']] },
      { panel: 'The next run', width: 'half', when: NEXT, rows: [['noNeeds 12'], ['need 12'], ['needFrom 12'], ['otherProfile 7', 'otherColor 5'], ['runsWhat 12'], ['material 12'],
        ['partialInfo 12'], ['adopt 12'], ['weatherStrip 12'], ['wsStrands 4', 'wsColor 4', 'wsSize 4']] },
    ] },
    { section: 'Saved with the changeover', fold: 'closed', rows: [['endAt 4', 'endReason 4', 'leftPieces 4'], ['partialId 6', 'newRunId 6']].concat(detailRows) },
  ],
}]);

/* ---------- End shift ---------- */
forms.push(['end-shift', {
  title: 'End shift', sites: ALL, launchable: true, saveLabel: 'End the shift', savedMessage: 'Shift ended',
  density: 'compact', keyboard: 'always',
  sources: [
    { name: 'mine', kind: 'items', structure: 'runs', filter: 'AND(status <> "Ended", operator = USER(), shift = form.shiftPick)', values: { scrapFt: 'both', endAt: 'write', endReason: 'write' } },
    { name: 'shifts', kind: 'value', formula: 'ShiftsRecent()' },
    { name: 'shift', kind: 'item', structure: 'shifts', id: { field: 'shiftPick' }, values: { endedAt: 'write', caliperOff: 'write' } },
  ],
  fields: [
    { name: 'shiftPick', control: 'choice', label: 'Your shift', required: true, optionsFrom: 'SORT(FILTER(shifts, AND(item.operator = USER(), item.$status <> "Ended")), item.startAt, "desc")',
      optionLabel: 'TEXT(item.startAt, "ddd h AM") & " to " & TEXT(item.endAt, "h AM") & " · " & JOIN(item.lines, ", ")', defaultFrom: 'FIRST(SORT(FILTER(shifts, AND(item.operator = USER(), item.$status <> "Ended")), item.startAt, "desc")).$id' },
    { name: 'scrap', control: 'table', label: 'Scrap on each line', rowsFrom: 'mine', rowLabel: 'Run', empty: 'No runs of this shift are still open', pinHeader: true, visibleRows: 6,
      columns: [{ name: 'line', label: 'Line' }, { name: 'part', label: 'Part' }, { name: 'color', label: 'Color' }, { name: 'racks', label: 'Racks' }, { name: 'scrapFt', label: 'Scrap (ft)', control: 'number', edit: true }] },
    { name: 'endNow', control: 'datetime', label: 'Ended', required: true, defaultFrom: 'NOW()', writes: 'mine.endAt' },
    { name: 'endReason', control: 'choice', label: 'Why', required: true, options: ['End of shift'], default: 'End of shift', writes: 'mine.endReason' },
    { name: 'caliperOff', control: 'toggle', label: 'Caliper left at the line', required: true, writes: 'shift.caliperOff', rule: 'caliperOff = TRUE', ruleText: 'Leave the caliper at the line for the next operator' },
    { name: 'endedAt', control: 'value', label: 'Shift ended', formula: 'endNow', format: 'ddd h:mm AM/PM', snapshot: 'shift.endedAt' },
    { name: 'missed', control: 'kpi', label: 'Hour checks missed this shift', formula: 'SUM(EACH(mine, item.missed))', target: '0', better: 'lower' },
  ],
  layout: [
    { panels: [
      { panel: 'Ending the shift', width: 'third', rows: [['shiftPick 12'], ['endNow 12'], ['endReason 12'], ['caliperOff 12'], ['missed 6', 'endedAt 6']] },
      { rows: [['scrap 12']] },
    ] },
  ],
}]);

/* ---------- Needs board: read only ---------- */
forms.push(['needs-board', {
  title: 'Needs board', sites: ALL, launchable: true, refresh: 1, buttons: [], density: 'compact',
  sources: [
    { name: 'needs', kind: 'value', formula: 'NeedsAll()' },
    { name: 'runs', kind: 'value', formula: 'RunsRecent()' },
    { name: 'racks', kind: 'value', formula: 'RacksRecent()' },
  ],
  fields: [
    { name: 'openNeeds', control: 'kpi', label: 'Open needs', formula: 'COUNT(FILTER(needs, item.$status = "Open"))' },
    { name: 'racksLeft', control: 'kpi', label: 'Racks still needed', formula: 'SUM(EACH(FILTER(needs, item.$status = "Open"), item.racks - COALESCE(item.made, 0)))' },
    { name: 'racksToday', control: 'kpi', label: 'Racks today', formula: 'COUNT(FILTER(racks, item.$firstAt >= STARTOF(NOW(), "day")))' },
    { name: 'board', control: 'board', label: 'Open needs, by line', formula: 'SORT(FILTER(needs, item.$status = "Open"), item.line & "|" & item.priority & "|" & item.$firstAt)',
      title: 'profile', show: '{line} · {colorName} · priority {priority}{offLineNote}', progress: { done: 'made', of: 'racks' }, sort: 'given', limit: 100 },
    { name: 'now', control: 'records', label: 'Running now', formula: 'FILTER(runs, item.$status = "Running")', sort: 'line', ascending: true,
      columns: [{ key: 'line', label: 'Line' }, { key: 'profile', label: 'Profile' }, { key: 'color', label: 'Color' }, { key: 'needLine', label: 'Need\'s line' }, { key: 'operator', label: 'Operator' }, { key: 'racks', label: 'Racks' }, { key: 'checks', label: 'Checks' }, { key: 'missed', label: 'Missed' }, { key: 'startAt', label: 'Since', format: 'ddd h:mm AM/PM' }] },
    // Two terminals that hadn't synced can make one rack too many for a need (0.49): listed here to sort out.
    { name: 'over', control: 'records', label: 'Needs with more racks than asked for', formula: 'FILTER(needs, COALESCE(item.made, 0) > item.racks)', sort: 'line', ascending: true,
      columns: [{ key: 'line', label: 'Line' }, { key: 'label', label: 'Need' }, { key: 'racks', label: 'Asked for' }, { key: 'made', label: 'Made' }, { key: 'madeOnLines', label: 'Made on' }], empty: 'None' },
    { name: 'done', control: 'records', label: 'Done lately', formula: 'FILTER(needs, item.$status = "Done")', sort: '$at', limit: 20,
      columns: [{ key: 'line', label: 'Line' }, { key: 'label', label: 'Need' }, { key: 'made', label: 'Racks' }, { key: 'madeOffLine', label: 'On other lines' }, { key: 'madeOnLines', label: 'Made on' }, { key: '$at', label: 'Done', format: 'ddd MMM d h:mm AM/PM' }] },
  ],
  layout: [['openNeeds 4', 'racksLeft 4', 'racksToday 4'], ['board 12'], ['now 12'], ['over 12'], ['done 12']],
}]);

/* ---------- Production report: the spreadsheet's pivots, from the runs ---------- */
const SCRAP_PCT = 'SUM(group.scrapLbs) / SUM(group.totalLbs)';
forms.push(['production-report', {
  title: 'Production report', sites: ALL, launchable: true, refresh: 5, buttons: [],
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
    // Summary
    { name: 'kTotal', control: 'kpi', label: 'Total lbs', formula: 'SUM(EACH(runs, item.totalLbs))', decimals: 0 },
    { name: 'kPrime', control: 'kpi', label: 'Prime lbs', formula: 'SUM(EACH(runs, item.primeLbs))', decimals: 0 },
    { name: 'kScrap', control: 'kpi', label: 'Scrap lbs', formula: 'SUM(EACH(runs, item.scrapLbs))', decimals: 0, better: 'lower' },
    { name: 'kPct', control: 'kpi', label: 'Scrap %', formula: 'IF(SUM(EACH(runs, item.totalLbs)) > 0, ROUND(SUM(EACH(runs, item.scrapLbs)) / SUM(EACH(runs, item.totalLbs)) * 100, 1), "")', unit: '%', decimals: 1, better: 'lower' },
    { name: 'kRacks', control: 'kpi', label: 'Racks', formula: 'SUM(EACH(runs, COALESCE(item.racks, 0)))', decimals: 0 },
    { name: 'kMissed', control: 'kpi', label: 'Hour checks missed', formula: 'SUM(EACH(runs, item.missed))', decimals: 0, target: '0', better: 'lower' },
    { name: 'byDay', control: 'summary', label: 'By day', formula: 'runs', rows: ['date'], heading: 'Date', chart: 'bar', totals: true,
      figures: { 'Scrap %': SCRAP_PCT, 'Scrap lbs': 'SUM(group.scrapLbs)', 'Prime lbs': 'SUM(group.primeLbs)', 'Total lbs': 'SUM(group.totalLbs)', Racks: 'SUM(group.racks)', Runs: 'COUNT(group)' },
      formats: { 'Scrap %': '0.0%', 'Scrap lbs': '#,##0', 'Prime lbs': '#,##0', 'Total lbs': '#,##0' } },
    // Day and shift, and material (the spreadsheet's MATERIALS)
    { name: 'byShift', control: 'summary', label: 'By day and crew', formula: 'runs', rows: ['date', 'crew'], heading: 'Date · crew', totals: true,
      figures: { 'Scrap %': SCRAP_PCT, 'Scrap lbs': 'SUM(group.scrapLbs)', 'Prime lbs': 'SUM(group.primeLbs)', 'Total lbs': 'SUM(group.totalLbs)' },
      formats: { 'Scrap %': '0.0%', 'Scrap lbs': '#,##0', 'Prime lbs': '#,##0', 'Total lbs': '#,##0' } },
    { name: 'materials', control: 'summary', label: 'Material used (lbs)', formula: 'runs', rows: ['date', 'crew'], heading: 'Date · crew', across: 'materialKey', totals: true,
      figures: { lbs: 'SUM(group.totalLbs)' }, formats: { lbs: '#,##0' } },
    // Profiles (the spreadsheet's PROFILES)
    { name: 'byProfile', control: 'summary', label: 'By profile', formula: 'runs', rows: ['profile'], heading: 'Profile', totals: true, sort: 'Total lbs', descending: true,
      figures: { 'Scrap %': SCRAP_PCT, 'Scrap lbs': 'SUM(group.scrapLbs)', 'Total lbs': 'SUM(group.totalLbs)', 'Avg lbs/ft': 'AVERAGE(group.wtFt)', Racks: 'SUM(group.racks)', Runs: 'COUNT(group)' },
      formats: { 'Scrap %': '0.0%', 'Scrap lbs': '#,##0', 'Total lbs': '#,##0', 'Avg lbs/ft': '0.000' } },
    // Best line for each profile (the spreadsheet's OPTIMAL LINE)
    { name: 'bestLine', control: 'summary', label: 'Scrap % by profile and line (lowest marked)', formula: 'runs', rows: ['profile'], heading: 'Profile', across: 'line', mark: 'lowest',
      figures: { 'Scrap %': SCRAP_PCT }, formats: { 'Scrap %': '0.0%' } },
    { name: 'bestLineLbs', control: 'summary', label: 'Total lbs by profile and line', formula: 'runs', rows: ['profile'], heading: 'Profile', across: 'line', totals: true,
      figures: { lbs: 'SUM(group.totalLbs)' }, formats: { lbs: '#,##0' } },
    // Last time a profile ran (the spreadsheet's LAST TIME RUN)
    { name: 'lastRun', control: 'value', label: 'Last run', formula: 'IF(ISBLANK(profileF), "Pick a profile above", LAST(SORT(FILTER(all, item.profile = profileF), item.startAt)).date & " on " & LAST(SORT(FILTER(all, item.profile = profileF), item.startAt)).line & " · scrap " & TEXT(LAST(SORT(FILTER(all, item.profile = profileF), item.startAt)).scrapPct, "0.0%"))' },
    { name: 'history', control: 'summary', label: 'Every run of the profile, by day and line', formula: 'IF(ISBLANK(profileF), LIST(), FILTER(all, item.profile = profileF))', rows: ['date'], heading: 'Date', across: 'line', descending: true, limit: 60,
      figures: { 'Scrap %': SCRAP_PCT, 'Total lbs': 'SUM(group.totalLbs)' }, formats: { 'Scrap %': '0.0%', 'Total lbs': '#,##0' } },
    // Quality from the hour checks
    { name: 'quality', control: 'summary', label: 'Hour checks by line', formula: 'checks', rows: ['line'], heading: 'Line', totals: true,
      figures: { Checks: 'COUNT(FILTER(group, item.lineStatus <> "Down"))', 'Surface fails': 'SUM(group.surfaceBad)', 'Color fails': 'SUM(group.colorBad)', 'Avg speed': 'AVERAGE(group.speed)', 'Avg off nominal (in)': 'AVERAGE(group.lengthDev)', 'Hours down': 'COUNT(FILTER(group, item.lineStatus = "Down"))' },
      formats: { 'Avg speed': '0.0', 'Avg off nominal (in)': '0.000' } },
    { name: 'lengthChart', control: 'control-chart', label: 'Length off nominal (in)', formula: 'FILTER(checks, NOT(ISBLANK(item.lengthDev)))', value: 'lengthDev', x: 'slot', last: 60, unit: 'in', decimals: 3 },
    { name: 'speedChart', control: 'chart', label: 'Line speed (ft/min)', formula: 'FILTER(checks, NOT(ISBLANK(item.speed)))', type: 'line', x: 'slot', y: 'speed', series: 'line', unit: 'ft/min' },
    // Every run (the spreadsheet's PRODUCTION DATA)
    { name: 'table', control: 'records', label: 'Every run', formula: 'runs', sort: 'startAt', limit: 500,
      columns: [{ key: 'date', label: 'Date' }, { key: 'line', label: 'Line' }, { key: 'crew', label: 'Shift' }, { key: 'profile', label: 'Profile' }, { key: 'color', label: 'Color' },
        { key: 'wtFt', label: 'Wt/ft', format: '0.000' }, { key: 'primeFt', label: 'Prime ft', format: '#,##0' }, { key: 'primeLbs', label: 'Prime #', format: '#,##0' },
        { key: 'scrapFt', label: 'Scrap ft', format: '#,##0' }, { key: 'scrapLbs', label: 'Scrap #', format: '#,##0' }, { key: 'totalLbs', label: 'Total #', format: '#,##0' }, { key: 'scrapPct', label: 'Scrap %', format: '0.0%' },
        { key: 'materialKey', label: 'Material' }, { key: 'racks', label: 'Racks' }, { key: 'avgSpeed', label: 'Avg speed', format: '0.0' }, { key: 'checks', label: 'Checks' }, { key: 'missed', label: 'Missed' }, { key: 'operator', label: 'Operator' }] },
  ],
  layout: [
    ['fromDate 3', 'toDate 3', 'lineF 2', 'crewF 2', 'profileF 2'],
    { tabs: [
      { tab: 'Summary', rows: [['kTotal 4', 'kPrime 4', 'kScrap 4'], ['kPct 4', 'kRacks 4', 'kMissed 4'], ['byDay 12']] },
      { tab: 'Day & crew', rows: [['byShift 12'], ['materials 12']] },
      { tab: 'Profiles', rows: [['byProfile 12']] },
      { tab: 'Best line', rows: [['bestLine 12'], ['bestLineLbs 12']] },
      { tab: 'Last time run', rows: [['lastRun 12'], ['history 12']] },
      { tab: 'Quality', rows: [['quality 12'], ['lengthChart 12'], ['speedChart 12']] },
      { tab: 'Every run', rows: [['table 12']] },
    ] },
  ],
}]);

module.exports = { functions, structures, forms, COLORS };
