// Builds the pilot pack file from defs.js and the starting items.
const fs = require('fs');
const d = require('./defs.js');
const profiles = JSON.parse(fs.readFileSync(__dirname + '/profiles.json', 'utf8'));
const lines = Array.from({ length: 9 }, (_, i) => ({ id: `Line ${i + 1}`, values: { line: `Line ${i + 1}`, active: false } }));
const definitions = []
  .concat(d.functions.map(([id, def]) => ({ kind: 'function', id, def: Object.assign({ sites: ['all'] }, def) })))
  .concat(d.structures.map(([id, def]) => ({ kind: 'structure', id, def })))
  .concat(d.forms.map(([id, def]) => ({ kind: 'form', id, def })));
const pack = { fp: 'pack', v: 1, name: 'Production pilot', note: 'Profiles, lines, needs, shifts, runs, hour checks, racks, partial racks, the needs board and the production report.', madeAt: new Date().toISOString(), kernel: '0.65.0', definitions, items: { profiles, lines } };
fs.writeFileSync(__dirname + '/production-pilot.json', JSON.stringify(pack, null, 1));
console.log('definitions', definitions.length, 'profiles', profiles.length, 'lines', lines.length);
