// 0.71 The number pad along the bottom: on a 1200 x 800 screen the pad is docked at the bottom, full width, about 250 px (a 56 px bar and
// three rows of five keys), with no right-hand dock and --fp-kb-right left at 0; every key works (digits, ., ±, ⌫, Clear, Next);
// a keyboard: always form rests as the 56 px bar ("Tap a box to type") and expands to the pad (or the full keyboard) when a box is tapped.
const start = require('./dummies/base.js');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snapPilot.json' });
  await p.setViewportSize({ width: 1200, height: 800 });
  await w(1000);
  const def = always => ({
    title: 'Pad', sites: ['all'], launchable: true, keyboard: always ? 'always' : undefined,
    fields: [
      { name: 'len', control: 'number', label: 'Length', unit: 'in' },
      { name: 'wid', control: 'number', label: 'Width', unit: 'in' },
      { name: 'note', control: 'text', label: 'Note' },
    ],
  });
  const open = (d, id) => p.evaluate(async ([d, id]) => {
    document.querySelectorAll('.kt').forEach(n => n.remove());
    const host = document.createElement('div'); host.className = 'kt'; host.style.cssText = 'position:relative;z-index:7000;background:#f4f6f8;padding:20px;min-height:900px';
    document.body.appendChild(host);
    window.__kt = await FP.forms.open(host, id, { def: d, preview: true, draft: false });
  }, [d, id]);
  const rect = () => p.evaluate(() => { const k = document.querySelector('.fpk'); if (!k) return null; const r = k.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: r.height, vw: innerWidth, vh: innerHeight }; });
  const css = n => p.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), n);
  const val = n => p.$eval(`[data-name="${n}"] input`, x => x.value);

  // A terminal in auto mode: a mouse shows nothing; a finger shows the pad.
  await open(def(false), 'pad-test'); await w(800);
  await p.click('[data-name="len"] input'); await w(300);
  expect('mouse in auto mode shows nothing', await p.evaluate(() => FP.keyboard.showing()) === null, 'shown');
  await p.evaluate(() => { FP.keyboard.setMode('always'); document.activeElement.blur(); });
  await p.click('[data-name="len"] input'); await w(700);
  let r = await rect();
  say('pad', JSON.stringify(r));
  expect('pad is docked at the bottom edge', r && Math.abs(r.bottom - r.vh) < 1.5, r);
  expect('pad is full width', r && Math.abs(r.left) < 1.5 && Math.abs(r.right - r.vw) < 1.5, r);
  expect('pad is about 250 px high', r && r.h >= 240 && r.h <= 260, r);
  expect('no right dock class', await p.evaluate(() => !document.querySelector('.fpk.right')), 'right class found');
  expect('--fp-kb-right stays 0px', (await css('--fp-kb-right')) === '0px', await css('--fp-kb-right'));
  expect('--fp-kb-bottom is the pad height', Math.abs(parseFloat(await css('--fp-kb-bottom')) - r.h) < 1.5, await css('--fp-kb-bottom'));
  const keys = await p.$$eval('.fpk-keys button', bs => bs.map(x => { const q = x.getBoundingClientRect(); return { t: x.textContent, top: Math.round(q.top), left: Math.round(q.left), w: Math.round(q.width), h: q.height }; }));
  expect('fifteen keys', keys.length === 15, keys.length);
  expect('keys are at least 56 px high', keys.every(k => k.h >= 55.5), keys.map(k => k.h));
  const rows = [...new Set(keys.map(k => k.top))].length;
  expect('three rows', rows === 3, rows);
  const order = [...new Set(keys.map(k => k.top))].sort((a, c) => a - c).map(t => keys.filter(k => k.top === t).sort((a, c) => a.left - c.left).map(k => k.t).join(' '));
  say('order', order.join(' / '));
  expect('key order', order.join(' / ') === '7 8 9 ⌫ Clear / 4 5 6 ± . / 1 2 3 0 Next', order);
  expect('the bar names the field', await p.$eval('.fpk-bar b', x => x.textContent) === 'Length', 'label');
  await p.screenshot({ path: 'l188-pad.png' });

  // Every key does its job.
  for (const k of ['1', '7', '9', '.', '2', '5']) await p.click(`.fpk-keys button:text-is("${k}")`);
  expect('digits and point', (await val('len')) === '179.25', await val('len'));
  await p.click('.fpk-keys button:text-is("±")');
  expect('sign on', (await val('len')) === '-179.25', await val('len'));
  await p.click('.fpk-keys button:text-is("±")');
  expect('sign off', (await val('len')) === '179.25', await val('len'));
  await p.click('.fpk-keys button:text-is("⌫")');
  expect('backspace', (await val('len')) === '179.2', await val('len'));
  expect('the form sees it', await p.evaluate(() => window.__kt.values().len) === 179.2, await p.evaluate(() => window.__kt.values().len));
  await p.click('.fpk-keys button:text-is("Clear")');
  expect('clear', (await val('len')) === '', await val('len'));
  await p.click('.fpk-keys button:text-is("0")');
  expect('zero', (await val('len')) === '0', await val('len'));
  await p.click('.fpk-keys button:text-is("Next")'); await w(400);
  expect('next moves to the next number box', await p.evaluate(() => document.activeElement.closest('[data-name]').dataset.name) === 'wid', 'not wid');
  expect('still the pad', await p.evaluate(() => FP.keyboard.showing() && FP.keyboard.showing().kind) === 'numbers', 'kind');
  await p.click('.fpk-keys button:text-is("Next")'); await w(500);
  expect('next to the text box: the full keyboard', await p.evaluate(() => FP.keyboard.showing() && FP.keyboard.showing().kind) === 'text', 'kind');
  expect('full keyboard is 344 px', Math.abs((await rect()).h - 344) < 1.5, await rect());

  // keyboard: always. Between boxes the keyboard rests as the 56 px bar.
  await p.evaluate(() => document.activeElement.blur()); await w(400);
  await p.evaluate(() => FP.keyboard.setMode('auto'));
  await open(def(true), 'pad-always'); await w(900);
  await p.evaluate(() => { if (document.activeElement) document.activeElement.blur(); }); await w(500);   // the form may put the cursor in its first box
  r = await rect();
  say('resting', JSON.stringify(r));
  expect('resting: a bar only', r && Math.abs(r.h - 56) < 1.5 && Math.abs(r.bottom - r.vh) < 1.5, r);
  expect('resting flag', await p.evaluate(() => FP.keyboard.resting()), 'not resting');
  expect('resting words', await p.$eval('.fpk-bar b', x => x.textContent) === 'Tap a box to type', 'words');
  expect('resting: no keys shown', await p.$$eval('.fpk-keys button', bs => bs.every(x => x.offsetParent === null)), 'keys visible');
  expect('resting: --fp-kb-bottom is the bar', (await css('--fp-kb-bottom')) === '56px', await css('--fp-kb-bottom'));
  expect('resting: nothing reserved on the right', (await css('--fp-kb-right')) === '0px', await css('--fp-kb-right'));
  const formW = await p.$eval('.kt', x => x.getBoundingClientRect().width);
  await p.click('[data-name="len"] input'); await w(700);
  r = await rect();
  expect('tapping a number box opens the pad', r && Math.abs(r.h - 250) < 2, r);
  expect('the form did not change width', Math.abs(formW - await p.$eval('.kt', x => x.getBoundingClientRect().width)) < 1, 'width changed');
  await p.click('[data-name="note"] input'); await w(700);
  expect('a text box opens the full keyboard', Math.abs((await rect()).h - 344) < 2, await rect());
  await p.click('.fpk-bar button:text-is("Hide ▾")'); await w(500);
  r = await rect();
  expect('Hide: back to the resting bar', r && Math.abs(r.h - 56) < 1.5 && await p.evaluate(() => FP.keyboard.resting()), r);
  await p.screenshot({ path: 'l188-rest.png' });
  await p.evaluate(() => FP.keyboard.setMode('never')); await w(300);
  expect('never: gone', (await rect()) === null && (await css('--fp-kb-bottom')) === '0px', 'still there');

  errs.forEach(e => bad.push('page error: ' + e));
  say('result', bad.length ? 'FAIL' : 'ok');
  bad.forEach(x => console.log('  BAD', x));
  say('errs', JSON.stringify(errs));
  await b.close();
  if (bad.length) process.exit(1);
})();
