// Builds the Die setup check from nothing through the editor's UI, part by part. node build.js <lastPart> [probe.js]
const start = require('./base.js');
const LAST = +process.argv[2] || 99; const PROBE = process.argv[3];
(async () => {
  const FROM = process.env.FROM ? +process.env.FROM : 0;
  const T = await start({ scale: process.env.SCALE ? +process.env.SCALE : 1, seed: FROM ? `snap${FROM}.json` : null });
  const { b, p, w, errs, rows, props, say, add } = T;
  const shot = async n => { if (process.env.SHOTS) await p.screenshot({ path: n + '.png' }); };
  const row = async k => { const on = await p.$eval(`.ffm-r[data-key="${k}"]`, r => r.classList.contains('on')).catch(() => false); if (!on || k[0] === '+') await p.click(`.ffm-r[data-key="${k}"]`); await w(350); };
  const val = async n => { await row('+v'); await p.fill('.ffm-props input', n); await p.click('.ffm-props button:has-text("Add a value forms save to")'); await w(400); };
  const publish = async note => { await p.fill('input[placeholder^="What changed"]', note); await p.click('.fpe-foot button:has-text("Publish"), button.primary:has-text("Publish")'); await w(1600); const t = await p.$eval('.fpe-head', x => x.innerText.replace(/\n/g, ' ')).catch(() => '?'); say('published', t); return t; };
  T.row = row; T.val = val; T.publish = publish; T.shot = shot;
  const parts = [];
  // 1. dies (0.41: first the site, from the map)
  parts.push(async () => {
    if (!(await p.evaluate(async () => (await FP.sites.list()).length))) {
      await p.click('.fpe-mrow.add:has-text("+ site")'); await w(800);
      const ins = await p.$$('.fpa-place input'); await ins[0].fill('HOU'); await ins[1].fill('Houston');
      await p.getByRole('button', { name: 'Add site', exact: true }).click(); await w(1500);
    }
    await add('A structure', 'dies');
    await p.click('.ffe-kinds button[data-kind="list"]'); await w(500);
    await row('top'); await p.fill('.ffm-props input >> nth=0', 'Dies');
    await row('id'); await p.fill('.ffm-props input >> nth=0', 'Die no.'); await w(300);
    for (const n of ['description', 'press', 'lowTemp', 'highTemp']) await val(n);
    await shot('g-dies');
    await publish('Die list: description, press, oven range');
  });
  // 2. die-setups
  parts.push(async () => {
    await add('A structure', 'die-setups');
    await p.click('.ffe-kinds button[data-kind="records"]'); await w(500);
    await row('top'); await p.fill('.ffm-props input >> nth=0', 'Die setups');
    await row('id'); await p.fill('.ffm-props input >> nth=0', 'Setup no.'); await w(300);
    await p.fill('.ffm-props input >> nth=1', 'DS'); await w(300);
    for (const n of ['die', 'press', 'ovenTemp', 'result', 'notes']) await val(n);
    await row('+st'); await p.fill('.ffm-props input >> nth=0', 'Out of range'); await p.fill('.ffm-props input >> nth=1', 'result <> "OK"'); await w(400);
    await row('+st'); await p.fill('.ffm-props input >> nth=0', 'OK'); await p.fill('.ffm-props input >> nth=1', 'TRUE'); await w(400);
    say('setups', '\n  ' + await rows());
    await shot('g-setups');
    await publish('One item per setup check');
  });
  // 3. collection: setup sheets
  parts.push(async () => {
    // The PDF is put in Forms b\media\setup-sheets\Press 2\ (copied there, or a OneDrive shortcut to the SharePoint library).
    await p.evaluate(async () => { let d = window.__root; for (const x of ['media', 'setup-sheets', 'Press 2']) d = await d.getDirectoryHandle(x, { create: true }); const fh = await d.getFileHandle('D-1047 setup sheet Rev B.pdf', { create: true }); const wr = await fh.createWritable(); await wr.write('%PDF-1.4 setup sheet'); await wr.close(); });
    // 0.42: no collection; the form lists the file itself (part 8).
    say('media', JSON.stringify(await p.evaluate(async () => (await FP.media.browse(['setup-sheets', 'Press 2'])).files.map(f => f.path))));
  });
  // 4. functions
  parts.push(async () => {
    await add('A function', 'CrewAt');
    await row('top'); await p.fill('.ffm-props input >> nth=0', 'Crew at a time');
    await row('+in'); await p.fill('.ffm-props input >> nth=0', 'at'); await p.selectOption('.ffm-props select', 'date');
    await row('fx'); await p.fill('.ffm-props input >> nth=0', 'IF(AND(HOUR(at) >= 6, HOUR(at) < 18), "A crew", "B crew")'); await p.selectOption('.ffm-props select', 'text'); await w(400);
    await p.fill('.ffe-prev input', '2026-11-17 14:30'); await w(800);
    say('try A', await p.$eval('.ffe-prev', x => x.innerText.replace(/\s+/g, ' ')));
    await p.fill('.ffe-prev input', '2026-11-17 22:15'); await w(800);
    say('try B', await p.$eval('.ffe-prev', x => x.innerText.replace(/\s+/g, ' ')));
    await shot('g-crew');
    await publish('A crew 6:00 to 18:00, B crew the rest');
    await add('A function', 'TempCheck');
    await row('top'); await p.fill('.ffm-props input >> nth=0', 'Temperature check');
    for (const n of ['temp', 'low', 'high']) { await row('+in'); await p.fill('.ffm-props input >> nth=0', n); await p.selectOption('.ffm-props select', 'number'); }
    await row('fx'); await p.fill('.ffm-props input >> nth=0', 'IF(temp < low, "Too cold", IF(temp > high, "Too hot", "OK"))'); await p.selectOption('.ffm-props select', 'text'); await w(400);
    const ins = await p.$$('.ffe-prev input');
    for (const [i, v] of [[0, '905'], [1, '880'], [2, '930']]) await ins[i].fill(v);
    await w(800);
    say('try ok', await p.$eval('.ffe-prev', x => x.innerText.replace(/\s+/g, ' ')));
    await ins[0].fill('860'); await w(800);
    say('try cold', await p.$eval('.ffe-prev', x => x.innerText.replace(/\s+/g, ' ')));
    say('fn', '\n  ' + await rows());
    await shot('g-temp');
    await publish('OK, Too cold or Too hot against a range');
  });
  // 5. back to die-setups: the crew
  parts.push(async () => {
    await p.click('.fpe-item:has-text("Die setups")'); await w(1500);
    await row('+v'); await p.fill('.ffm-props input', 'crew'); await p.click('.ffm-props button:has-text("calculated")'); await w(400);
    await p.selectOption('.ffm-props select >> nth=0', 'CrewAt'); await w(400);
    await p.selectOption('.ffm-props select >> nth=1', '$firstAt'); await w(400);
    say('crew', await p.$eval('.ffm-r[data-key="v:crew"]', r => r.textContent));
    await shot('g-crew-value');
    await publish('Crew worked out from when it was first saved');
  });
  // 6. lookups
  const match = async (key, how, value) => {
    await row('+m'); await w(300);
    await p.selectOption('.ffm-props select >> nth=0', key); await w(300);
    if (how === 'const') { await p.selectOption('.ffm-props select >> nth=1', '__const'); await w(300); await p.fill('.ffm-props input', value); }
    else { await p.selectOption('.ffm-props select >> nth=1', how); }
    await w(300);
  };
  T.match = match;
  parts.push(async () => {
    await add('A function', 'LastSetupOf');
    await row('top'); await p.fill('.ffm-props input >> nth=0', 'Last setup of a die'); await p.selectOption('.ffm-props select', 'lookup'); await w(400);
    await row('+in'); await p.fill('.ffm-props input >> nth=0', 'die'); await p.selectOption('.ffm-props select', 'text');
    await row('rd'); await p.selectOption('.ffm-props select', 'die-setups'); await w(400);
    await match('die', 'die');
    await row('win'); await p.selectOption('.ffm-props select', 'all'); await w(300);
    say('last', '\n  ' + await rows());
    await publish('The latest setup check of a die');
  });
  // 7. form: die register
  const dumpProps = async k => { say(k, await props()); say(k + ' in', await p.$$eval('.ffm-props input, .ffm-props select, .ffm-props button, .ffm-props label', l => l.map(x => x.tagName + ':' + (x.placeholder || '') + ':' + (x.tagName === 'SELECT' ? [...x.options].map(o => o.value).join(',') : (x.type === 'checkbox' ? x.checked : (x.value || x.textContent)))).join(' | '))); };
  T.dumpProps = dumpProps;
  const field = async (name, set) => { await row('f:' + name); for (const [label, v] of set) { const loc = p.locator('.ffm-props label', { hasText: new RegExp('^\\s*' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).first().locator('input, select, textarea').first(); const tag = await loc.evaluate(x => x.tagName + ':' + x.type); if (tag === 'SELECT:select-one') await loc.selectOption(v); else if (tag === 'INPUT:checkbox') await loc.setChecked(v); else await loc.fill(v); await w(350); } };
  T.field = field;
  const useValue = async (src, v, write) => {
    await row('+v:' + src); await p.click(`.ffm-props button:text-is("${v}")`); await w(400);
    await row(`v:${src}:${v}`);
    if (write) { await p.locator('.ffm-props label', { hasText: 'This form saves to it' }).locator('input').check(); await w(400); await p.click('.ffm-props button:has-text("+ Make a field for this")'); }
    else await p.click('.ffm-props button:has-text("+ Show it in a field")');
    await w(500);
  };
  T.useValue = useValue;
  parts.push(async () => {
    await add('A form', 'die-register');
    await row('form'); await p.fill('.ffm-props input >> nth=0', 'Add or change a die'); await w(300);
    await p.locator('.ffm-props label', { hasText: 'Has its own launcher' }).locator('input').check(); await w(300);
    await row('+s'); await p.click('.ffm-props button:has-text("A structure")'); await w(500);
    await p.selectOption('.ffm-props select', 'dies'); await w(600);
    await row('id:die'); await p.click('.ffm-props label:has-text("Typed or scanned in a field")'); await w(400);
    await p.click('.ffm-props button:has-text("+ Make a Die no. field")'); await w(600);
    for (const v of ['description', 'press', 'lowTemp', 'highTemp']) await useValue('die', v, true);
    say('reg', '\n  ' + await rows());
    await field('dieNo', [['Capital letters', true], ['Hint', 'As stamped on the die, e.g. D-1047']]);
    await field('press', [['Kind of field', 'choice']]);
    await field('press', [['Options', 'Press 1\nPress 2\nPress 3'], ['Required', true]]);
    await field('description', [['Required', true], ['Hint', 'What it makes, e.g. 2.5 in. angle']]);
    await field('lowTemp', [['Label', 'Lowest oven temperature (°F)'], ['Required', true]]);
    await field('highTemp', [['Label', 'Highest oven temperature (°F)'], ['Required', true]]);
    await row('f:notes'); await p.click('.ffm-props button:has-text("Delete field")'); await w(500);
    say('reg', '\n  ' + await rows());
    say('layout', await p.$$eval('.ffe-prev [data-name]', l => l.map(x => x.dataset.name + ':' + (x.dataset.col || '')).join(' ')));
    await shot('g-register');
    await publish('Dies: what it makes, its press and oven range');
  });
  // 8. form: die setup check
  parts.push(async () => {
    await add('A form', 'die-setup');
    await row('form'); await p.fill('.ffm-props input >> nth=0', 'Die setup check');
    await p.locator('.ffm-props label', { hasText: 'Has its own launcher' }).locator('input').check(); await w(300);
    await row('+s'); await p.click('.ffm-props button:has-text("A structure")'); await w(500);
    await p.selectOption('.ffm-props select', 'dies'); await w(600);
    await row('id:die'); await p.click('.ffm-props label:has-text("Typed or scanned in a field")'); await w(400);
    await p.click('.ffm-props button:has-text("+ Make a Die no. field")'); await w(600);
    await useValue('die', 'description', false);
    await useValue('die', 'press', false);
    for (const v of ['lowTemp', 'highTemp']) { await row('+v:die'); await p.click(`.ffm-props button:text-is("${v}")`); await w(400); }
    await row('+s'); await p.click('.ffm-props button:has-text("A structure")'); await w(500);
    await p.selectOption('.ffm-props select', 'die-setups'); await w(600);
    const writeVal = async (v, how) => {
      await row('+v:dieSetup'); await p.click(`.ffm-props button:text-is("${v}")`); await w(400);
      await row('v:dieSetup:' + v);
      await p.locator('.ffm-props label', { hasText: 'This form saves to it' }).locator('input').check(); await w(400);
      if (how === 'make') await p.click('.ffm-props button:has-text("+ Make a field for this")');
      else if (how) { await p.selectOption('.ffm-props select', how); }
      await w(500);
    };
    await writeVal('die', 'dieNo');
    await writeVal('ovenTemp', 'make');
    await writeVal('notes', 'notes');
    await writeVal('press', null);
    await writeVal('result', null);
    await field('press', [['Saves its value to', 'dieSetup']]);
    await p.selectOption('.ffm-props label:has-text("Saves its value to") select >> nth=1', 'press'); await w(400);
    await field('ovenTemp', [['Label', 'Oven temperature (°F)'], ['Required', true]]);
    await row('+f'); await p.click('.ffm-props button:has-text("Badge")'); await w(600);
    await field('badge', [['Label', 'Result'], ['Formula', 'TempCheck(ovenTemp, die.lowTemp, die.highTemp)'], ['Saves its value to', 'dieSetup']]);
    await p.selectOption('.ffm-props label:has-text("Saves its value to") select >> nth=1', 'result'); await w(400);
    for (const [v, c] of [['OK', 'good'], ['Too cold', 'bad'], ['Too hot', 'bad']]) {
      await p.click('.ffm-props label:has-text("Colours") > div > button:has-text("Add")'); await w(300);
      const r = p.locator('.ffm-props label:has-text("Colours") .fpe-row').last();
      await r.locator('input').fill(v); await r.locator('select').selectOption(c); await w(300);
    }
    // two formula sources
    for (const [name, fx] of [['lastSetup', 'LastSetupOf(dieNo)']]) {
      await row('+s'); await p.click('.ffm-props button:has-text("A formula")'); await w(500);
      say('fsrc', await props());
      await p.fill('.ffm-props input >> nth=0', name); await p.fill('.ffm-props input >> nth=1', fx); await w(500);
    }
    const newField = async (kind, set) => {
      await row('+f'); await p.click(`.ffm-props button:text-matches("^${kind}")`); await w(500);
      const k = await p.$$eval('.ffm-r.on', l => l.map(r => r.dataset.key)[0]);
      await field(k.slice(2), set);
    };
    T.newField = newField;
    // 0.42: the setup sheet on the form's media list, tagged with its die
    // 0.61: it goes into the media library first (named and tagged once), then onto the form from the library.
    await p.evaluate(async () => { const L = FP.media.library; await L.setTag('die', {}); await L.setTag('kind', {});
      await L.adopt('setup-sheets/Press 2/D-1047 setup sheet Rev B.pdf', { name: 'D-1047 setup sheet Rev B', tags: { die: 'D-1047', kind: 'setup sheet' }, folder: 'setup sheets' }); });
    await row('+md'); await w(800);
    await p.click('.ffm-props .fpe-row:has-text("D-1047 setup sheet Rev B") button:has-text("Add")'); await w(800);
    say('media row', await props());
    const whereTag = async (tag, from) => {
      await p.click('.ffm-props button:has-text("+ only the ones tagged")'); await w(400);
      const r = p.locator('.ffm-props .ffe-group .fpe-row').last();
      await r.locator('select >> nth=0').selectOption(tag); await r.locator('select >> nth=1').selectOption(from); await w(500);
    };
    T.whereTag = whereTag;
    await newField('Media', [['Label', 'Setup sheet']]);
    await p.keyboard.press('Tab'); await w(500);
    await whereTag('die', 'dieNo');
    await field('setupSheet', [['When there is none', 'No setup sheet for this die yet']]);
    say('media field', await props());
    await shot('g-media-field');
    await newField('Value', [['Label', 'Last setup of this die'], ['Formula', 'IF(ISBLANK(lastSetup), "None yet", lastSetup.$id & ": " & lastSetup.ovenTemp & " °F, " & lastSetup.result & ", " & lastSetup.crew)']]);
    await row('+a'); await w(400);
    await p.fill('.ffm-props label:has-text("Name") input', 'sheet');
    await p.fill('.ffm-props label:has-text("Label") input', 'Setup sheet for this die');
    await p.selectOption('.ffm-props label:has-text("What") select', 'media'); await w(300);
    await whereTag('die', 'dieNo');
    await p.fill('.ffm-props label:has-text("Confirmation") input', 'I have read {title}');
    await p.selectOption('.ffm-props label:has-text("How often") select', 'revision'); await w(400);
    for (let i = 0; i < 8; i++) { const b = await p.$('.ffm-r[data-key="f:notes"] button:has-text("↓")'); if (!b) break; await b.click(); await w(250); }
    await row('form'); await w(500);
    say('rows', '\n  ' + await rows());
    say('form errs', await p.$$eval('.ffm-errs', l => l.map(x => x.innerText).filter(Boolean).join(' | ')));
    await shot('g-setup-map');
    await publish('Setup check: oven temperature against the die, setup sheet read first');
  });
  // 9. admin: people and launcher files
  parts.push(async () => {
    // 0.41: people are on the map, for admins
    for (const [n, d, role, pin] of [['Dana Ruiz', 'Extrusion', 'user', '135790'], ['Lee Carter', 'Extrusion', 'supervisor', '246802']]) {
      if (await p.$('.fpe-maphead[aria-expanded="false"]:has-text("People")')) { await p.click('.fpe-maphead:has-text("People")'); await w(400); }   // People folds away (0.51.1)
      await p.click('.fpe-mrow.add:has-text("+ person")'); await w(1000);
      await p.fill('.fpa-place input[placeholder="e.g. Maria Lopez"]', n); await p.fill('.fpa-place input[placeholder="e.g. Extrusion"]', d);
      await p.selectOption('.fpa-place select', role);
      await p.fill('.fpa-place input[placeholder="6 digits"]', pin); await p.getByRole('button', { name: 'Add this person' }).click(); await w(1500);
    }
    say('users', await p.$$eval('.fpe-mrow', l => l.slice(0, 8).map(x => x.innerText.replace(/\n+/g, ' ')).join(' | ')));
    await shot('g-users');
    await p.click('.fpe-adminbtn:not(.fpe-helpbtn)'); await w(1500);
    await p.click('.fpa-tabs button:has-text("Launchers")'); await w(1000);
    await row('+all'); await w(1500);
    say('launchers', '\n  ' + await rows());
    await shot('g-launchers');
  });
  // 10. run: add two dies
  parts.push(async () => {
    await p.goto('file:///home/claude/kernel/launcher.html?form=die-register'); await w(2500);
    // 0.41: the first launcher on this computer sets up the terminal (the editor never does)
    if (await p.$('text=Save terminal ID')) { await p.fill('.fp-gate-card input', 'T01'); await p.click('text=Save terminal ID'); await require('../site-step.js')(p, 'HOU', 'Houston'); await w(1500); }
    for (const [no, desc, press, lo, hi] of [['d-1047', '2.5 in. equal angle', 'Press 2', '880', '930'], ['D-1052', '1.75 in. square tube', 'Press 1', '860', '910']]) {
      await p.fill('[data-name="dieNo"] input', no); await p.fill('[data-name="description"] input', desc);
      await p.click(`[data-name="press"] button:has-text("${press}")`);
      await p.fill('[data-name="lowTemp"] input', lo); await p.fill('[data-name="highTemp"] input', hi); await w(400);
      if (no === 'd-1047') await shot('g-run-register');
      await p.click('button:has-text("Save")'); await w(1800);
      say('saved', (await p.innerText('body')).replace(/\n+/g, ' / ').slice(0, 200));
    }
  });
  // 11. the map: the form opened up, its media row
  parts.push(async () => {
    await p.goto('file:///home/claude/kernel/editor.html'); await w(3000);
    await p.click('.fpe-mrow:has-text("Die setup check")'); await w(2500);
    say('map', await p.$$eval('.fpe-mrow', l => l.map(x => x.innerText.replace(/\n+/g, ' ')).join(' | ')));
    await p.click('.fpe-mrow.part:has-text("D-1047 setup sheet")'); await w(2000);
    say('media', await props());
    await shot('g-coll-members');
  });
  // 12. run: Dana's first setup check
  parts.push(async () => {
    await p.goto('file:///home/claude/kernel/launcher.html?form=die-setup'); await w(2500);
    await p.click('.fp-top >> text=Josh').catch(async () => p.click('text=Josh')); await w(800);
    await p.click('.fp-u-card >> text=Dana Ruiz'); await w(500);
    await p.keyboard.type('135790'); await w(1500); await p.keyboard.type('864201'); await w(900); await p.keyboard.type('864201'); await w(1500);
    await shot('g-run-start');
    await p.fill('[data-name="dieNo"] input', 'D-1047'); await p.keyboard.press('Tab'); await w(2000);
    say('ack', await p.$eval('.fpf-ack', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '?'));
    await shot('g-run-ack');
    const pop = p.context().waitForEvent('page', { timeout: 3000 }).catch(() => null);
    await p.click('.fpf-ack button:has-text("Open")'); const pg = await pop; if (pg) { say('opened', pg.url()); await pg.close(); }
    await w(500); await p.click('.fpf-ack button.ok'); await w(1200);
    say('ack done', await p.$eval('.fpf-acks', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '?'));
    await p.fill('[data-name="ovenTemp"] input', '905'); await p.keyboard.press('Tab'); await w(1500);
    await p.fill('[data-name="notes"] textarea', 'New heater band on zone 2'); await w(800);
    say('form', (await p.innerText('.fpf, form, main').catch(() => p.innerText('body'))).replace(/\n+/g, ' / ').slice(0, 600));
    await shot('g-run-filled');
    await p.click('button:has-text("Save")'); await w(2000);
    say('after save', (await p.innerText('body')).replace(/\n+/g, ' / ').slice(0, 200));
    // a second check, too cold
    await p.fill('[data-name="dieNo"] input', 'D-1047'); await p.keyboard.press('Tab'); await w(1800);
    say('ack again', await p.$eval('.fpf-acks', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '?'));
    say('last', await p.$eval('[data-name="lastSetupOfThisDie"]', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '?'));
    await p.fill('[data-name="ovenTemp"] input', '868'); await p.keyboard.press('Tab'); await w(1500);
    say('result', await p.$eval('[data-name="result"]', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '?'));
    await shot('g-run-cold');
    await p.click('button:has-text("Save")'); await w(2000);
    say('setups', JSON.stringify(await p.evaluate(async () => { const r = await FP.current.load('die-setups'); return Array.from(r.items.values()).map(i => [i.id, i.values, i.status]); })));
  });
  // 13. a die with no setup sheet yet, then the records
  parts.push(async () => {
    await p.goto('file:///home/claude/kernel/launcher.html?form=die-setup'); await w(2500);
    await p.fill('[data-name="dieNo"] input', 'D-1052'); await p.keyboard.press('Tab'); await w(2000);
    say('ack 1052', await p.$eval('.fpf-acks', x => x.hidden ? '(hidden)' : x.innerText.replace(/\n+/g, ' / ')).catch(() => '?'));
    say('sheet', await p.$eval('[data-name="setupSheet"]', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '?'));
    await p.fill('[data-name="ovenTemp"] input', '940'); await p.keyboard.press('Tab'); await w(1500);
    say('result', await p.$eval('[data-name="result"]', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '?'));
    await shot('g-run-hot');
    await p.click('button:has-text("Save")'); await w(2000);
    say('msg', (await p.innerText('body')).replace(/\n+/g, ' / ').slice(0, 120));
  });
  parts.push(async () => {
    await p.goto('file:///home/claude/kernel/editor.html?admin=records'); await w(3000);
    await p.click('button:has-text("Dana Ruiz")'); await w(800);
    say('after click', (await p.innerText('body')).replace(/\n+/g, ' / ').slice(0, 200));
    await p.click('.fp-u-card >> text=Josh').catch(() => {}); await w(300); await p.keyboard.type('482913'); await w(2000);
    await p.click('.fpe-adminbtn:not(.fpe-helpbtn)'); await w(1500);
    await p.click('.fpa-tabs button:has-text("Records")'); await w(1200);
    say('rec page', (await p.innerText('.fpa, main, body')).replace(/\n+/g, ' / ').slice(0, 600));
    say('rows', '\n  ' + await rows());
    const first = await p.$$eval('.ffm-r', l => l.map(r => r.dataset.key).find(k => /^r:/.test(k)));
    if (first) { await row(first); await w(800); say('record', await props()); }
    await shot('g-records');
    await shot('g-records0');
  });
  //PARTS-END
  for (let i = FROM; i < Math.min(LAST, parts.length); i++) { say('part', i + 1); await parts[i](); if (process.env.SNAP) await T.snapshot(`snap${i + 1}.json`); }
  if (PROBE) await require('./' + PROBE)(T);
  say('errors', errs);
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
