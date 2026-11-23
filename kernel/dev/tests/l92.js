// 0.61 The media library: entries with an internal name, tags and a folder, in the built-in List media-library; tag
// names typed or linked to a list; bringing files in (from this computer, or already in the media folder), one at a time
// in the maker; a new version keeps the old one; retire; forms show entries by name or every entry with some tags.
const start = require('./dummies/base.js');
const path = require('path');
const D = path.join(__dirname, 'fixtures', 'l92');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const r = await p.evaluate(async () => {
    const out = {};
    const L = FP.media.library;
    const pub = (kind, id, def) => { const cur = FP.defs.get(kind, id); return FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, def), { basedOn: cur ? cur.version : null, note: 'l92' }); };
    await pub('structure', 'zz-lines', { label: 'Lines', kind: 'list', roles: { active: 'active' }, itemId: { label: 'Line', made: 'entered' }, containers: { active: {} } });
    for (const [id, on] of [['L1', true], ['L2', true], ['L9', false]]) await FP.entry.record({ entry: 'zz-lines.save', item: { structure: 'zz-lines', id }, form: { id: 't', version: 1 }, values: { active: on } });
    await FP.outbox.flush(); FP.current.clearCache();
    out.builtIn = `${FP.structures.get('media-library').kind} · can't be published over: ${await FP.defs.publish('structure', 'media-library', { sites: ['all'], kind: 'list', containers: {} }).then(() => 'TOOK', e => /built into the kernel/.test(e.message))}`;
    // Tag names: one typed, one from a list; a bad one refused.
    await L.setTag('kind', {}); await L.setTag('line', { list: 'zz-lines' });
    out.tagNames = L.tags().map(t => `${t.name}${t.list ? ' ← ' + t.list : ''}`).join(', ');
    out.badTag = await L.setTag('Bad name', {}).then(() => 'TOOK', e => e.message.slice(0, 60));
    out.badList = await L.setTag('die', { list: 'dies' }).then(() => 'TOOK', e => e.message);
    // In, from this computer and from the media folder.
    const txt = new File(['Line 1 start-up sheet, Rev A'], 'startup.txt', { type: 'text/plain' });
    const a = await L.add(txt, { name: 'Line 1 start-up', tags: { kind: 'setup sheet', line: 'L1' }, folder: 'setup sheets', note: 'Rev A' });
    out.added = `${a.id.slice(0, 2)}… ${a.name} · ${a.path} · v${a.revision} · ${FP.media.tagsText(a.tags)}`;
    out.dupe = await L.add(txt, { name: 'line 1 START-UP' }).then(() => 'TOOK', e => e.message.slice(0, 60));
    out.noName = await L.add(txt, { name: '  ' }).then(() => 'TOOK', e => e.message.slice(0, 40));
    await FP.media.add(new File(['old'], 'Line 2 start-up.txt', { type: 'text/plain' }), 'old docs');
    out.loose = (await L.loose(['old docs'])).files.map(f => `${f.name}${f.inLibrary ? ' (in)' : ''}`).join(', ');
    const b2 = await L.adopt('old docs/Line 2 start-up.txt', { name: 'Line 2 start-up', tags: { kind: 'setup sheet', line: 'L2' }, folder: 'setup sheets' });
    out.adopted = `${b2.path} · from ${b2.from} · original still there: ${!!(await FP.media.stat('old docs/Line 2 start-up.txt'))} · loose now: ${(await L.loose(['old docs'])).files.map(f => `${f.name}${f.inLibrary ? ' (in)' : ''}`).join(', ')}`;
    out.values = (await L.valuesFor('line')).map(v => `${v.value}${v.onList ? '' : ' (not on the list)'}`).join(', ');
    await L.update(a.id, { tags: { kind: 'setup sheet', line: ['L1', 'L7'] } });
    out.values2 = (await L.valuesFor('line')).map(v => `${v.value}${v.onList ? '' : ' (not on the list)'}`).join(', ');
    // A new version: beside the old one, which stays in the history.
    const v2 = await L.revise(a.id, new File(['Line 1 start-up sheet, Rev B'], 'startup-b.txt', { type: 'text/plain' }), 'Rev B');
    out.revised = `v${v2.revision} · ${v2.path} · history ${v2.history.map(h => `v${h.revision} ${h.path} (${h.note})`).join('; ')} · old file still there: ${!!(await FP.media.stat(v2.history[0].path))}`;
    out.rename = await L.update(a.id, { name: 'Line 2 start-up' }).then(() => 'TOOK', e => e.message.slice(0, 50));
    // Forms: an entry by name, and every entry with some tags.
    const formDef = { title: 'Start-up', sites: ['all'], sources: [], media: [{ entry: b2.id }, { library: { kind: 'setup sheet' } }],
      fields: [{ name: 'line', control: 'choice', label: 'Line', options: ['L1', 'L2'] }, { name: 'sheet', control: 'media', label: 'Start-up sheet', where: { line: 'line' } }], layout: [['line 6'], ['sheet 12']] };
    out.list = FP.media.listOf(formDef).map(m => `${m.title} v${m.revision}`).join(', ');
    out.check = JSON.stringify(FP.forms.check(formDef));
    out.badRef = FP.forms.check(Object.assign({}, formDef, { media: [{ entry: 'M-nope' }, { library: { Bad: 'x' } }, { path: 'library/setup sheets/x.txt' }] })).filter(x => /Media/.test(x)).join(' | ');
    out.pick = (await FP.media.pick(formDef, { line: 'L1' })).map(m => `${m.title} (${m.path})`).join(', ');
    await pub('form', 'zz-startup', formDef);
    out.usedBy = `${L.usedBy(a.id).join(',')} · ${L.usedBy(b2.id).join(',')}`;
    // Retired: forms stop showing it.
    await L.setActive(b2.id, false);
    out.retired = `${FP.media.listOf(formDef).map(m => m.title).join(', ')} · check: ${FP.forms.check(formDef).filter(x => /Media/.test(x)).join(' | ')}`;
    await L.setActive(b2.id, true);
    out.picked = FP.kinds.form({ title: 'x', sites: ['all'], sources: [], fields: [{ name: 'doc', control: 'choice', pick: 'media-library' }] }).sources.map(s => `${s.structure} open:${s.open}`).join('');
    return out;
  });
  Object.entries(r).forEach(([k, v]) => say(k, v));

  // The editor: the map row, the pane, and the maker.
  await p.evaluate(() => FP.editor.refreshMap()); await w(1200);
  say('map row', await p.$eval('.fpe-mrow:has(span:text-is("Media library"))', x => x.innerText.replace(/\s+/g, ' ')).catch(e => 'MISSING ' + e.message.slice(0, 60)));
  await p.click('.fpe-mrow:has(span:text-is("Media library"))'); await w(1500);
  say('pane', await p.$eval('.fpa-place', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 260)));
  say('rows', await p.$$eval('.fpa-lib-row', l => l.map(x => x.innerText.replace(/\s+/g, ' ')).join(' | ')));
  await p.setInputFiles('.fpa-place input[type=file]', [path.join(D, 'D-1047 setup.txt'), path.join(D, 'D-1052 drawing.png')]); await w(1500);
  say('maker 1', await p.$eval('.fpa-place', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 200)));
  const nameIn = '.fpa-lib-make input:not([type])';
  await p.fill(nameIn, 'D-1047 setup sheet');
  await p.click('.fpa-lib-tags button:has-text("+ tag")'); await w(200);
  await p.selectOption('.fpa-lib-tags select', 'kind'); await w(300);
  await p.fill('.fpa-lib-tags input', 'setup sheet'); await w(300);
  await p.click('.fpa-lib-tags button:has-text("+ tag")'); await w(200);
  await p.selectOption('.fpa-lib-tags .fpa-row:nth-of-type(2) select', 'line').catch(async () => { const s = await p.$$('.fpa-lib-tags select'); await s[1].selectOption('line'); }); await w(400);
  const ins = await p.$$('.fpa-lib-tags input'); await ins[1].fill('L3'); await w(600);
  say('not on list', await p.$$eval('.fpa-lib-warn', l => l.map(x => x.textContent).filter(Boolean).join(' | ')));
  await ins[1].fill('L1'); await w(300);
  say('folder', await p.$eval('.fpa-lib-make input[list="fpa-lib-folders"]', x => x.value));
  await p.screenshot({ path: './out/l92-maker.png' });
  await p.click('.fpa-place button:has-text("Add and next")'); await w(2500);
  say('maker 2', await p.$eval('.fpa-place', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 160)));
  await p.fill(nameIn, 'D-1052 drawing');
  await p.click('.fpa-place button:has-text("Same tags as the last one")'); await w(600);
  say('same tags', JSON.stringify(await p.$$eval('.fpa-lib-tags input', l => l.map(x => x.value))));
  await p.screenshot({ path: './out/l92-maker2.png' });
  await p.click('.fpa-place button:has-text("Add and finish")'); await w(2500);
  say('summary', await p.$eval('.fpa-place', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 260)));
  await p.click('.fpa-place button:has-text("Done")'); await w(1500);
  say('rows after', await p.$$eval('.fpa-lib-row', l => l.map(x => x.innerText.replace(/\s+/g, ' ')).join(' | ')));
  // An entry: its details, then a new version through the pane.
  await p.click('.fpa-lib-row:has-text("D-1052 drawing")'); await w(1500);
  say('entry', await p.$eval('.fpa-place', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 300)));
  await p.setInputFiles('.fpa-place input[type=file]', path.join(D, 'D-1047 rev B.png'));
  await p.fill('.fpa-place input[placeholder^="what changed"]', 'Rev B');
  await p.click('.fpa-place button:has-text("Replace with a new version")'); await w(2500);
  say('versions', await p.$$eval('.fpa-place table tr', l => l.map(x => x.innerText.replace(/\s+/g, ' ')).join(' | ')));
  await p.screenshot({ path: './out/l92-entry.png' });
  await p.click('.fpa-place button:has-text("‹ Every entry")'); await w(1200);
  await p.screenshot({ path: './out/l92-list.png' });
  // The form's map: Media from the library.
  await p.evaluate(() => FP.editor.openDef('form', 'zz-startup')); await w(2500);
  await p.click('.ffe3-tab[data-tab="form"]').catch(() => {}); await w(600);
  say('form media', await p.$$eval('.ffm-r', l => l.map(x => x.innerText.replace(/\s+/g, ' ')).filter(t => /entry|Every|start-up|library/i.test(t)).join(' | ')));
  say('form problems', await p.$$eval('.ffm-errs, .ffe3-errs, .ffe3-tab.bad', l => l.map(x => x.innerText.replace(/\s+/g, ' ')).join(' | ')) || 'none');
  say('errs', JSON.stringify(errs).slice(0, 400));
  await b.close();
})();
