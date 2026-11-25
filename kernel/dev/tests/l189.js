// 0.71 The keyboard and a field that may be hidden, on a 1200 x 800 screen:
//  - a long form scrolled down, a text box near the bottom tapped: the 344 px keyboard opens and the box is scrolled into the FREE area
//    (below the tinted head, above the keyboard and the save bar), FP.keyboard.hidden() says not hidden, and there is NO typing card;
//  - a squeezed screen (1200 x 420) and a device keyboard that reports itself (navigator.virtualKeyboard): hidden() says hidden and the
//    bar becomes a typing card with the label, the value as keys are pressed, the unit, the message, and Back / Next;
//  - the card goes away by itself when the box is in view again.
const start = require('./dummies/base.js');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snapPilot.json' });
  await p.setViewportSize({ width: 1200, height: 800 });
  await w(1000);
  const fields = [];
  for (let i = 0; i < 30; i++) fields.push(i % 2 ? { name: 'f' + i, control: 'number', label: 'Reading ' + i, unit: 'degF', warn: { min: 50 }, hint: 'Check the dial' } : { name: 'f' + i, control: 'text', label: 'Note ' + i });
  const def = { title: 'Long', sites: ['all'], launchable: true, fields };
  await p.evaluate(async d => {
    FP.keyboard.setMode('always');
    const head = document.createElement('div'); head.className = 'fpl-formhead'; head.textContent = 'Form head'; head.style.cssText = 'height:70px;background:#dde7f0;position:relative;z-index:7000';
    document.body.appendChild(head);
    const host = document.createElement('div'); host.className = 'kt'; host.style.cssText = 'position:relative;z-index:7000;background:#f4f6f8;padding:20px';
    document.body.appendChild(host);
    window.__kt = await FP.forms.open(host, 'long-test', { def: d, preview: true, draft: false });
  }, def);
  await w(1200);
  await p.evaluate(() => { if (document.activeElement) document.activeElement.blur(); }); await w(400);
  const geo = n => p.evaluate(n => {
    const q = document.querySelector(`[data-name="${n}"]`), i = q.querySelector('input'), l = q.querySelector('.fpf-label'), k = document.querySelector('.fpk'), h = document.querySelector('.fpl-formhead');
    const f = document.querySelector('.fpf-foot'), r = x => x.getBoundingClientRect();
    return { input: { t: r(i).top, b: r(i).bottom }, label: { t: r(l).top, b: r(l).bottom }, kb: k ? { t: r(k).top, h: r(k).height } : null, headB: Math.max(0, r(h).bottom), foot: f ? { t: r(f).top, b: r(f).bottom, h: r(f).height } : null, vh: innerHeight };
  }, n);
  const inFree = g => { const top = g.headB, bottom = Math.min(g.kb ? g.kb.t : g.vh, g.foot && g.foot.t > g.input.t ? g.foot.t : 1e9); return { top, bottom, ok: g.label.t >= top - 1 && g.input.b <= bottom + 1 }; };
  const card = () => p.evaluate(() => { const k = document.querySelector('.fpk'); return { on: !!(k && k.classList.contains('focus')), h: k ? k.getBoundingClientRect().height : 0, label: k && k.querySelector('.fpk-bar b').textContent, val: k && k.querySelector('.fpk-val').textContent, unit: k && k.querySelector('.fpk-unit').textContent, sub: k && k.querySelector('.fpk-sub').textContent, err: k && k.querySelector('.fpk-err').textContent, live: k && k.querySelector('.fpk-val').getAttribute('aria-live'), active: document.activeElement.closest('[data-name]') && document.activeElement.closest('[data-name]').dataset.name }; });
  const hid = () => p.evaluate(() => FP.keyboard.hidden());
  const press = async k => { await p.click(`.fpk-keys button:text-is("${k}")`); await w(150); };

  // 1. A long form scrolled to the bottom, a text box near the bottom tapped.
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await w(500);
  await p.click('[data-name="f28"] input'); await w(1500);
  let g = await geo('f28'), fr = inFree(g);
  say('text kb', JSON.stringify({ kb: g.kb, free: fr, input: g.input, label: g.label, foot: g.foot }));
  expect('the text keyboard is 344 px', g.kb && Math.abs(g.kb.h - 344) < 1.5, g.kb);
  expect('the box and its label are inside the free area', fr.ok, { g, fr });
  const mid = (g.label.t + g.input.b) / 2, freeMid = (fr.top + fr.bottom) / 2;
  expect('the box sits near the middle of the free area, not of the window', Math.abs(mid - freeMid) < 45, { mid, freeMid, windowMid: g.vh / 2 });
  let h = await hid();
  expect('hidden() is false', h.hidden === false && h.free > 120, h);
  expect('hidden() reports the free height', Math.abs(h.free - (fr.bottom - fr.top)) < 3, { h, fr });
  let c = await card();
  expect('no typing card', c.on === false && Math.abs(c.h - 344) < 1.5, c);
  await p.screenshot({ path: 'l189-text-bottom.png' });

  // 2. A number box in the same place: the pad.
  await p.click('[data-name="f27"] input'); await w(1200);
  g = await geo('f27'); fr = inFree(g); c = await card(); h = await hid();
  expect('number box: pad 250 px, box in the free area, not hidden, no card', Math.abs(g.kb.h - 250) < 1.5 && fr.ok && !h.hidden && !c.on, { g, fr, h, c });
  await p.screenshot({ path: 'l189-number-bottom.png' });

  // 3. A squeezed screen: 1200 x 420 leaves 76 px above the keyboard. Hidden: the bar is a typing card.
  await p.setViewportSize({ width: 1200, height: 420 }); await w(900);
  h = await hid(); c = await card();
  say('squeezed', JSON.stringify({ h, c }));
  expect('1200 x 420: hidden() is true', h.hidden === true && h.free < 120, h);
  expect('the card shows', c.on === true, c);
  expect('the card names the box', c.label === 'Reading 27', c.label);
  expect('the card shows the unit and the hint', c.unit === 'degF' && /Check the dial/.test(c.sub), c);
  expect('the card is in a live region', c.live === 'polite', c);
  expect('the keyboard grew by at most 70 px', c.h <= 250 + 70 && c.h >= 250 + 50, c.h);
  expect('the real box still holds focus', c.active === 'f27', c.active);
  const sz = await p.$eval('.fpk-val', x => parseFloat(getComputedStyle(x).fontSize));
  expect('the value is at least 28 px', sz >= 28, sz);
  await p.click('.fpk-keys button:text-is("Clear")'); await w(100);
  await press('4'); await press('2');
  c = await card();
  expect('the value follows the keys, with the caret', /^42/.test(c.val) && /\|/.test(c.val), c.val);
  await w(300);
  expect('a message line shows for a value under the minimum', /outside the usual/i.test((await card()).err), (await card()).err);
  await p.screenshot({ path: 'l189-card.png' });
  await press('⌫'); await press('.'); await press('5');
  expect('backspace and point show on the card', /^4\.5/.test((await card()).val), (await card()).val);
  // Back and Next
  await p.click('.fpk-bar .fpk-cardkey:text-is("Back")'); await w(500);
  c = await card();
  expect('Back goes to the box before', c.active === 'f26' && c.label === 'Note 26', c);
  await press('x'); await w(150);
  expect('the card follows a text box too', /^x/.test((await card()).val), (await card()).val);
  await p.click('.fpk-bar .fpk-cardkey:text-is("Next")'); await w(500);
  expect('Next goes to the box after', (await card()).active === 'f27', await card());
  await p.click('.fpk-bar .fpk-cardkey:text-is("Next")'); await w(500);
  expect('Next again', (await card()).active === 'f28' && (await card()).label === 'Note 28', await card());
  expect('the box under the card is in the free area now (or the card is the safety net)', inFree(await geo('f28')).ok || (await card()).on, await geo('f28'));

  // 4. Back to a tall screen: the box is in view, the card goes away by itself.
  await p.setViewportSize({ width: 1200, height: 800 }); await w(1500);
  h = await hid(); c = await card();
  say('tall again', JSON.stringify({ h, c }));
  expect('1200 x 800: not hidden', h.hidden === false, h);
  expect('the card is off again', c.on === false && Math.abs(c.h - 344) < 1.5, c);

  // 5. A device keyboard that reports its rectangle (navigator.virtualKeyboard) covering the box.
  const hasVk = await p.evaluate(() => !!navigator.virtualKeyboard);
  if (hasVk) {
    await p.click('[data-name="f25"] input'); await w(1200);
    expect('before: not hidden', (await hid()).hidden === false, await hid());
    await p.evaluate(() => {
      const t = 60;   // leaves 60 px, so no scrolling can help
      Object.defineProperty(navigator.virtualKeyboard, 'boundingRect', { configurable: true, get: () => ({ top: t, height: innerHeight - t, left: 0, width: innerWidth }) });
      navigator.virtualKeyboard.dispatchEvent(new Event('geometrychange'));
    });
    await w(900);
    h = await hid(); c = await card();
    say('device kb', JSON.stringify({ h, c: c.on }));
    expect('a device keyboard over the box: hidden() is true and the card shows', h.hidden === true && c.on === true, { h, c });
    await p.evaluate(() => { delete navigator.virtualKeyboard.boundingRect; navigator.virtualKeyboard.dispatchEvent(new Event('geometrychange')); });
    await w(1500);
    expect('the device keyboard gone: the card goes away', (await card()).on === false && (await hid()).hidden === false, { c: await card(), h: await hid() });
  } else say('device kb', 'navigator.virtualKeyboard not in this browser: skipped');

  errs.forEach(e => bad.push('page error: ' + e));
  say('result', bad.length ? 'FAIL' : 'ok');
  bad.forEach(x => console.log('  BAD', x));
  say('errs', JSON.stringify(errs));
  await b.close();
  if (bad.length) process.exit(1);
})();
