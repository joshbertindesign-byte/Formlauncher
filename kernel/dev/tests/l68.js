// 0.44: touch layout. Size words, panels, compact spacing; terminal screens. 0.58: sized and moved from the settings of a picked field.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snapPilot.json' });
  await p.setViewportSize({ width: 1600, height: 1000 });
  await w(1000);
  // 1. Runtime: checks, the script and the look.
  const def = {
    title: 'Panels', sites: ['all'], density: 'compact',
    fields: [
      { name: 'line', control: 'chips', label: 'Line', options: ['Line 1', 'Line 2'] },
      { name: 'len', control: 'number', label: 'Actual length', unit: 'in', hint: 'Nominal 144.00', warn: { min: 143.75, max: 144.25 } },
      { name: 'speed', control: 'number', label: 'Line speed', hint: 'Feet a minute, read off the puller display at the end of the line' },
      { name: 'notes', control: 'textarea', label: 'Notes' },
    ],
    layout: [{ panels: [{ panel: 'Your lines', width: 'narrow', rows: [['line Full']] }, { panel: 'Readings', rows: [['len M', 'speed m'], ['notes FULL']] }] }],
  };
  say('check', JSON.stringify(await p.evaluate(d => FP.forms.check(d), def)));
  say('bad', JSON.stringify(await p.evaluate(d => FP.forms.check(Object.assign({}, d, { density: 'tight', layout: [{ panels: [{ width: 'wide', rows: [['len XL']] }] }] })), def)));
  await p.evaluate(async d => {
    const host = document.createElement('div'); host.id = 'kt'; host.style.cssText = 'position:fixed;top:0;left:0;width:1300px;bottom:0;overflow:auto;background:#f4f6f8;z-index:7000;padding:12px 16px';
    document.body.appendChild(host);
    window.__kt = await FP.forms.open(host, 'panels', { def: d, preview: true, draft: false });
  }, def);
  await w(800);
  await p.fill('[data-name="len"] input', '145'); await p.press('[data-name="len"] input', 'Tab'); await w(300);
  say('look', JSON.stringify(await p.evaluate(() => ({
    compact: document.querySelector('#kt .fpf').classList.contains('compact'),
    panes: Array.from(document.querySelectorAll('#kt .fpf-pane')).map(x => Math.round(x.getBoundingClientRect().width)),
    spans: ['len', 'speed', 'notes'].map(n => getComputedStyle(document.querySelector(`#kt [data-name="${n}"]`)).gridColumnStart + '/' + document.querySelector(`#kt [data-name="${n}"]`).style.getPropertyValue('--pc')),
    tip: (document.querySelector('#kt [data-name="len"] .fpf-tip') || {}).textContent,
    info: !!document.querySelector('#kt [data-name="speed"] .fpf-info'),
    msg: (() => { const m = document.querySelector('#kt [data-name="len"] .fpf-msg'); return m.className + ' · ' + getComputedStyle(m).position; })(),
    input: Math.round(document.querySelector('#kt [data-name="len"] input').getBoundingClientRect().height),
  }))));
  await p.screenshot({ path: 'l68-compact.png' });
  // narrower than 900: the panels stack
  await p.evaluate(() => { document.getElementById('kt').style.width = '700px'; });
  await w(300);
  say('stacked', JSON.stringify(await p.$$eval('#kt .fpf-pane', xs => xs.map(x => Math.round(x.getBoundingClientRect().width)))));
  await p.evaluate(() => { window.__kt.destroy(); document.getElementById('kt').remove(); });

  // 2. A terminal that has told us its screen: T03, 1366×768, touch, runs the hourly check.
  await p.evaluate(async () => {
    await FP.files.writeJson(['_terminals'], 'T03.json', { terminalId: 'T03', site: 'ABI', deviceKey: 'x', lastSeen: new Date().toISOString(),
      screen: { width: 1366, height: 768, screenWidth: 1366, screenHeight: 768, scale: 1, orientation: 'landscape', touch: true, touchPoints: 10, at: new Date().toISOString() } });
    await FP.groups.setTerminal('T03', { name: 'Line 2 desk', forms: ['hourly'] });
  });
  await p.evaluate(() => FP.editor.openDef('form', 'hourly'));
  await w(3500);
  say('modes', await p.$$eval('.ffa-mode button', bs => bs.map(b => b.textContent + (b.classList.contains('on') ? '*' : '')).join(' ')));
  say('screens', await p.$eval('.ffe3-bar select', s => Array.from(s.options).map(o => o.textContent + (o.selected ? '*' : '')).join(' | ')));
  say('fit', await p.$eval('.ffo-fit', x => x.className + ' · ' + x.textContent));
  say('outline', (await p.$$eval('.ffe3-left .ffm-r, .ffe3-left .ffm-blk', xs => xs.map(x => x.dataset.key || x.textContent).join(' '))).slice(0, 300));
  await p.screenshot({ path: 'l68-editor.png' });
  // Spacing: compact (the settings on the right, with nothing picked, are the form's)
  await p.click('.ffe3-insp .ffo-seg button:text-is("Compact")'); await w(1500);
  say('compact', await p.$eval('.ffo-fit', x => x.textContent) + ' · draft ' + await p.evaluate(() => document.querySelector('.ffe-frame .fpf').classList.contains('compact')));
  // Sizes, new row, order: pick a field on the form, then its place on the right
  const pick = async n => { await p.click(`.ffe-frame .fpf-cell[data-name="${n}"]`); await w(700); };
  const grids = re => p.evaluate(src => Array.from(document.querySelectorAll('.ffe-frame .fpf-grid')).map(g => Array.from(g.children).map(c => c.dataset.name + ':' + c.style.getPropertyValue('--pc')).join(',')).filter(x => new RegExp(src).test(x)), re);
  await pick('speed');
  await p.click('.ffe3-place .ffo-seg button:text-is("L")'); await w(900);
  say('L', JSON.stringify(await grids('speed')));
  await p.click('.ffe3-place .ffo-nr'); await w(900);
  say('newrow', JSON.stringify((await grids('speed|lastSpeed|weight')).map(x => x.replace(/:\d+/g, ''))));
  await p.click('.ffe3-place .ffo-nr'); await w(900);
  say('joined', JSON.stringify((await grids('speed|lastSpeed|weight')).map(x => x.replace(/:\d+/g, ''))));
  await pick('weight');
  for (let k = 0; k < 3; k++) { await p.click('.ffe3-place button[aria-label$="earlier"]'); await w(900); }
  say('moved', JSON.stringify((await grids('speed|lastSpeed|weight|gauge')).map(x => x.replace(/:\d+/g, ''))));
  // Panels: add (nothing picked), then move fields into them
  await p.click('.ffe3-left .ffm-r.on'); await w(700);
  await p.click('.ffe3-insp .ffo-row button:text-is("Panels")'); await w(1200);
  await pick('yourLines').catch(() => {});
  const moveTo = async (n, label) => { await pick(n); await p.selectOption('.ffe3-place select', { label }).catch(async () => say('opts', (await p.$$eval('.ffe3-place select option', os => os.map(o => o.textContent))).join(' ; '))); await w(800); };
  await moveTo('run', 'Panel Panel 1');
  for (const n of ['lengthAct', 'nominal', 'lengthDev', 'surface']) await moveTo(n, 'Panel Panel 2');
  say('panels', JSON.stringify(await p.evaluate(() => Array.from(document.querySelectorAll('.ffe-frame .fpf-pane')).map(x => Math.round(x.getBoundingClientRect().width) + ':' + Array.from(x.querySelectorAll('.fpf-cell')).map(c => c.dataset.name).join(',')))));
  say('fit2', await p.$eval('.ffo-fit', x => x.textContent));
  // tapping a field on the form picks it on the outline and on the right
  await pick('checkNote');
  say('picked', await p.$$eval('.ffm-r.on', xs => xs.map(x => x.dataset.key).join(',')) + ' · ' + await p.$eval('.ffe3-ih b', x => x.textContent));
  // take one off, put it back
  await pick('gaugeCheck');
  await p.selectOption('.ffe3-place select', '__off'); await w(900);
  say('off', await p.$eval('.ffe3-place', x => x.innerText.replace(/\n+/g, ' / ')));
  await p.click('.ffe3-place button:text-is("Put it on the form")'); await w(900);
  say('back', String(!!(await p.$('.ffe-frame .fpf-cell[data-name="gaugeCheck"]'))));
  await p.screenshot({ path: 'l68-editor2.png' });
  // PC: no screen line
  await p.selectOption('.ffe3-bar select', 'pc'); await w(1200);
  say('pc', String(await p.$eval('.ffo-fit', x => x.hidden)) + ' sizer ' + !!(await p.$('.ffo-sizer')));
  // the definition checks and saves
  // Publish: the check measures T03 and warns, and the publish goes ahead when told to.
  const asked = []; p.on('dialog', d => asked.push(d.message()));
  await p.click('.fpe-foot .primary'); await w(4000);
  say('warned', asked.join(' || ').replace(/\n+/g, ' '));
  say('published', JSON.stringify(await p.evaluate(() => { const d = FP.defs.get('form', 'hourly'); return { v: d.version, density: d.def.density, panels: d.def.layout.filter(r => r && r.panels).length }; })));
  const fits = await p.evaluate(async () => (await FP.editor.screenFit(FP.defs.get('form', 'hourly').def, 'hourly')).map(x => `${x.id} ${x.w}x${x.h} pad ${x.pad} used ${x.used} spare ${x.spare}`));
  say('fits', JSON.stringify(fits));
  say('errs', JSON.stringify(errs));
  await b.close();
})();
