// Builds the 0.51 pilot pack from defs.js, the profiles from the Profiles workbook and the lines of the schedule.
const fs = require('fs');
const d = require('./defs.js');
const profiles = JSON.parse(fs.readFileSync(__dirname + '/profiles.json', 'utf8'));
// The schedule's lines: Line 1 to Line 9, off until a supervisor turns them on (Line 3 runs two strands, A and B).
const lines = Array.from({ length: 9 }, (_, i) => ({ id: `Line ${i + 1}`, values: { line: `Line ${i + 1}`, active: false } }));
const definitions = []
  .concat(d.functions.map(([id, def]) => ({ kind: 'function', id, def: Object.assign({ sites: ['all'] }, def) })))
  .concat(d.structures.map(([id, def]) => ({ kind: 'structure', id, def })))
  .concat(d.forms.map(([id, def]) => ({ kind: 'form', id, def })));
const kernel = (fs.readFileSync(__dirname + '/../../../fp-launcher.js', 'utf8').match(/const VERSION = '([^']+)'/) || [])[1];
// Where the forms go (0.52): the site, the two groups with their settings, and (test folders only) the people.
const setup = { sites: d.SITES, groups: Object.values(d.TERMINALS), terminals: [], people: d.PEOPLE, centers: d.CENTERS };
const pack = { fp: 'pack', v: 1, name: 'Production pilot', note: 'Shared line terminals and a QC office PC: profiles, lines, needs, shifts, runs, hour checks, racks, partial racks, the needs board and the production report.', madeAt: new Date().toISOString(), kernel, definitions, items: { profiles, lines }, setup };
fs.writeFileSync(__dirname + '/production-pilot.json', JSON.stringify(pack, null, 1));
console.log('definitions', definitions.length, 'profiles', profiles.length, 'lines', lines.length, 'kernel', kernel);
