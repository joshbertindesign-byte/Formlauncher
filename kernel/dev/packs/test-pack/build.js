// Builds the Test pack: everything the production pilot packs did, with made-up data, so it can be installed on any
// test folder (Admin > Packs > Install). Run: node dev/packs/test-pack/build.js   (writes test-pack.json beside this file)
//
// What it keeps from the pilot (kernel/dev/tests/pilot2/defs.js): the 7 structures (profiles, lines, needs, shifts, runs,
// racks, partial racks), the 13 forms (profiles, lines, needs, change need, start shift, line board, hourly check, rack,
// changeover, end shift, needs board, trace a rack, production report), the 30 functions, the site, the two terminal
// groups (line terminals in kiosk view, a QC office in admin view), and the four responsibility centers with the
// escalation ladder on the hourly check.
// What is made up: the 30 profiles (part numbers, customers, sizes, weights), the site, the six people (test PINs), and
// two media-library entries with a form that shows them (the 0.61 library, which the pilot pack did not have).
// A guard at the end refuses to write the pack if any plant-specific word got through.
const fs = require('fs'), path = require('path');
const d = require(path.join(__dirname, '../../tests/pilot2/defs.js'));
const clone = x => JSON.parse(JSON.stringify(x));

// ---- Made-up profiles: deterministic, so the pack is the same every time it is built ----
let seed = 20261123;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const CUSTOMERS = ['ACME', 'NORTHWIND', 'GLOBEX', 'INITECH', 'UMBRELLA'];
const profiles = Array.from({ length: 30 }, (_, i) => {
  const part = String(100 + i * 5 + Math.floor(rnd() * 4));
  const customer = CUSTOMERS[i % CUSTOMERS.length];
  const nom = Math.round((0.35 + rnd() * 0.6) * 1000) / 1000;
  return { id: `${part} ${customer}`, values: { part, customer, lengthIn: 120 + Math.floor(rnd() * 12) * 10, lengthTol: 0.25, pcsPerRack: 40 + Math.floor(rnd() * 14) * 5,
    wtLow: Math.round(nom * 0.9 * 1000) / 1000, wtNom: nom, wtHigh: Math.round(nom * 1.1 * 1000) / 1000, pattern: `${3 + Math.floor(rnd() * 5)} / ${8 + Math.floor(rnd() * 8)}`, gauge: rnd() > 0.4, active: true } };
});
// Lines 1 to 9; the first three are on so the forms have something to show (the pilot starts them all off).
const lines = Array.from({ length: 9 }, (_, i) => ({ id: `Line ${i + 1}`, values: { line: `Line ${i + 1}`, active: i < 3 } }));

// ---- The definitions, with the pilot's example wording made generic ----
const GENERIC = [['e.g. ABI, CLAYTON, MI WINDOWS', 'e.g. ACME, NORTHWIND, GLOBEX']];
const generic = x => { let s = JSON.stringify(x); for (const [a, b] of GENERIC) s = s.split(a).join(b); return JSON.parse(s); };

const definitions = []
  .concat(d.functions.map(([id, def]) => ({ kind: 'function', id, def: Object.assign({ sites: ['all'] }, generic(def)) })))
  .concat(d.structures.map(([id, def]) => ({ kind: 'structure', id, def: generic(def) })));

// The new form: shows the library entries tagged as instructions for the chosen line.
const instructions = { title: 'Line instructions', sites: ['all'], launchable: true, sources: [], media: [{ library: { kind: 'instruction' } }],
  fields: [{ name: 'line', control: 'choice', label: 'Line', options: ['Line 1', 'Line 2', 'Line 3'] }, { name: 'doc', control: 'media', label: 'Instructions', where: { line: 'line' } }],
  layout: [['line 6'], ['doc 12']] };
d.forms.forEach(([id, def]) => definitions.push({ kind: 'form', id, def: generic(def) }));
definitions.push({ kind: 'form', id: 'line-instructions', def: instructions });

// ---- Where the forms go ----
const SITES = [{ id: 'TST', name: 'Test Plant' }];
const groups = Object.values(clone(d.TERMINALS)).map(g => Object.assign(g, { site: 'TST', forms: g.forms.concat('line-instructions') }));
const PEOPLE = [
  { name: 'Sam Supervisor', roles: ['supervisor'], pin: '135790' },
  { name: 'Quinn Quality', department: 'Quality', roles: ['supervisor'], pin: '975310' },
  { name: 'Olive Operator', roles: ['user'], pin: '246802' },
  { name: 'Omar Operator', roles: ['user'], pin: '357913' },
  { name: 'Pat Packer', roles: ['user'], pin: '468024' },
  { name: 'Mo Manager', department: 'Management', roles: ['supervisor'], pin: '579135' },
];
const setup = { sites: SITES, groups, terminals: [], people: PEOPLE, centers: clone(d.CENTERS) };

// ---- The media library: two small text files the instructions form shows ----
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const doc = (id, name, text) => ({ id, name, path: `library/instructions/${name}.txt`, folder: 'instructions', tags: { kind: 'instruction', line: ['Line 1', 'Line 2', 'Line 3'] },
  type: 'text/plain', size: Buffer.byteLength(text), revision: 1, note: 'Made-up text for the test pack.', file: b64(text) });
const library = {
  entries: [
    doc('M-TESTPACK-0001', 'Line start-up checklist', 'LINE START-UP CHECKLIST (test pack)\n1. Check the line is clear.\n2. Confirm the profile and colour on the needs board.\n3. Start the run and log the first rack.\n'),
    doc('M-TESTPACK-0002', 'Rack labelling guide', 'RACK LABELLING GUIDE (test pack)\nEvery rack gets a label with its rack ID, profile, colour and piece count.\nScan the label at the next station; a rack without a label is held.\n'),
  ],
  tags: [{ name: 'kind', list: '' }, { name: 'line', list: '' }],
};

const kernel = (fs.readFileSync(path.join(__dirname, '../../../fp-launcher.js'), 'utf8').match(/const VERSION = '([^']+)'/) || [])[1];
const pack = { fp: 'pack', v: 1, name: 'Test pack', note: 'A complete example with made-up data: profiles, lines, needs, shifts, runs, hour checks, racks, partial racks, the needs board, trace and production report, two terminal groups, four responsibility centers with an escalation ladder, six test people, and two media-library instructions. Install on a test folder.',
  madeAt: new Date(0).toISOString(), kernel, definitions, items: { profiles, lines }, setup, library };

// ---- Guard: nothing from the plant may have come through ----
const text = JSON.stringify(pack);
const FORBIDDEN = ['ABI', 'ABILENE', 'CLAYTON', 'MI WINDOWS', 'MARIA LOPEZ', 'KEVIN HART', 'TOM REED', 'ANA DIAZ', 'SAM COLE', 'ED MOORE'];
const hit = FORBIDDEN.filter(w => new RegExp('(^|[^A-Za-z])' + w.replace(/ /g, '\\s') + '([^A-Za-z]|$)', 'i').test(text));
if (hit.length) { console.error('Refused: plant-specific words in the test pack:', hit.join(', ')); process.exit(1); }

const out = path.join(__dirname, 'test-pack.json');
fs.writeFileSync(out, JSON.stringify(pack, null, 1));
console.log(`Test pack for kernel ${kernel}: ${definitions.length} definitions (${definitions.filter(x => x.kind === 'structure').length} structures, ${definitions.filter(x => x.kind === 'form').length} forms, ${definitions.filter(x => x.kind === 'function').length} functions), ${profiles.length} profiles, ${lines.length} lines, ${PEOPLE.length} people, ${library.entries.length} library entries -> ${path.relative(process.cwd(), out)}`);
