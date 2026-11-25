// 0.43: pinned table header; the on-screen keyboard (auto / always / never, numbers / text / none); terminals record their screen.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snapPilot.json' });
  await p.setViewportSize({ width: 1600, height: 900 });
  await w(1000);
  const def = {
    title: 'Keys', sites: ['all'], launchable: true,
    fields: [
      { name: 'rack', control: 'text', label: 'Rack ID', keyboard: 'none' },
      { name: 'len', control: 'number', label: 'Length', unit: 'in' },
      { name: 'note', control: 'text', label: 'Note' },
      { name: 'grid', control: 'table', label: 'Readings', addRows: true, startRows: 14, pinHeader: true, visibleRows: 5, pinFirst: true,
        columns: [{ name: 'a', label: 'A', control: 'number' }, { name: 'b', label: 'B' }] },
    ],
  };
  await p.evaluate(async d => {
    const host = document.createElement('div'); host.id = 'kt'; host.style.cssText = 'position:fixed;inset:0;overflow:auto;background:#f4f6f8;z-index:7000;padding:20px';
    document.body.appendChild(host);
    window.__kt = await FP.forms.open(host, 'keys-test', { def: d, preview: true, draft: false });
  }, def);
  await w(1500);
  const pin = await p.$eval('[data-name="grid"] .fpc-pin', x => ({ max: x.style.maxHeight, cls: x.className, sticky: getComputedStyle(x.querySelector('th')).position, scrolls: x.scrollHeight > x.clientHeight }));
  say('pinned', JSON.stringify(pin));
  // auto: a mouse click shows nothing; a finger tap shows the number pad along the bottom (0.71: no right-hand dock any more)
  await p.click('[data-name="len"] input'); await w(300);
  say('mouse', JSON.stringify(await p.evaluate(() => FP.keyboard.showing())));
  await p.evaluate(() => document.activeElement.blur());
  await p.tap('[data-name="len"] input').catch(async () => {
    // no touch emulation in this context: dispatch a touch pointerdown, then focus
    await p.$eval('[data-name="len"] input', x => { x.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })); x.focus(); });
  });
  await w(400);
  say('touch', JSON.stringify(await p.evaluate(() => { const s = FP.keyboard.showing(); return s && { kind: s.kind, cls: document.querySelector('.fpk').className, rect: (r => ({ bottom: r.bottom, w: r.width, h: r.height, vh: innerHeight }))(document.querySelector('.fpk').getBoundingClientRect()), right: getComputedStyle(document.documentElement).getPropertyValue('--fp-kb-right'), inputMode: document.activeElement.inputMode }; })));
  for (const k of ['1', '7', '9', '.', '2', '5']) await p.click(`.fpk-keys button:text-is("${k}")`);
  await p.click('.fpk-keys button:text-is("±")');
  say('typed', await p.$eval('[data-name="len"] input', x => x.value) + ' form sees ' + JSON.stringify(await p.evaluate(() => window.__kt.values().len)));
  const pad = await p.evaluate(() => { const r = document.querySelector('.fpk').getBoundingClientRect(); return { atBottom: Math.abs(r.bottom - innerHeight) < 1.5, full: Math.abs(r.width - innerWidth) < 1.5, h: r.height, right: getComputedStyle(document.documentElement).getPropertyValue('--fp-kb-right').trim(), cls: document.querySelector('.fpk').className }; });
  say('pad', JSON.stringify(pad));
  if (!pad.atBottom || !pad.full || pad.h < 240 || pad.h > 260 || pad.right !== '0px' || /right/.test(pad.cls)) throw new Error('the number pad is not along the bottom: ' + JSON.stringify(pad));
  await p.screenshot({ path: 'l67-numpad.png' });
  await p.click('.fpk-keys button:text-is("Next")'); await w(400);
  say('next', JSON.stringify(await p.evaluate(() => ({ field: document.activeElement.closest('[data-name]').dataset.name, kb: FP.keyboard.showing() && FP.keyboard.showing().kind, cls: document.querySelector('.fpk') && document.querySelector('.fpk').className, bottom: getComputedStyle(document.documentElement).getPropertyValue('--fp-kb-bottom') }))));
  for (const k of ['⇧', 'O', 'k']) await p.click(`.fpk-keys button:text-is("${k}")`);
  await p.click('.fpk-keys button:text-is("space")');
  say('text', await p.$eval('[data-name="note"] input', x => x.value));
  await p.screenshot({ path: 'l67-full.png' });
  // a real key tucks it away (auto)
  await p.keyboard.press('x'); await w(300);
  say('real key', JSON.stringify(await p.evaluate(() => FP.keyboard.showing())) + ' value ' + await p.$eval('[data-name="note"] input', x => x.value));
  // keyboard none on the scanned field; always mode
  await p.evaluate(() => FP.keyboard.setMode('always'));
  await p.click('[data-name="rack"] input'); await w(300);
  say('none field', JSON.stringify(await p.evaluate(() => FP.keyboard.showing())));
  await p.click('[data-name="grid"] tr:nth-child(3) input'); await w(300);
  say('always, table cell', JSON.stringify(await p.evaluate(() => FP.keyboard.showing() && FP.keyboard.showing().kind)));
  await p.evaluate(() => FP.keyboard.setMode('never'));
  await p.click('[data-name="note"] input'); await w(300);
  say('never', JSON.stringify(await p.evaluate(() => FP.keyboard.showing())));
  // the device record: a terminal checks in with its screen
  const reg = await p.evaluate(async () => { FP.identity.editor = false; FP.identity.terminalId = 'T09'; await FP.identity.checkIn(); const e = await FP.identity.lookup('T09'); return [e.screen, FP.identity.describe(e)]; });
  say('device', JSON.stringify(reg));
  say('errs', JSON.stringify(errs));
  await b.close();
})();
