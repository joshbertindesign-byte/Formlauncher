// 0.69 Full screen: a setting on terminal groups and terminals (like View): "Full screen on the first tap"; the launcher goes full screen on
// the first tap, a Full screen / Exit full screen button shows the real state, hidden where the browser has no Fullscreen API, never in the editor.
// (Headless Chromium may refuse real full screen: requestFullscreen, exitFullscreen and fullscreenElement are stubbed and counted.)
const start = require('./dummies/base.js');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const A = await start({ seed: 'dummies/snap15b.json', at: '2026-11-24T09:00:00-06:00' });
  const { p, w } = A;
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  await p.evaluate(async () => { await FP.kv.set('terminalId', 'T01'); await FP.kv.set('siteId', 'HOU'); });

  // Settings layer: default false; a terminal's own value; a group's value wins; bad values refused. (T01 is in a group in this seed; T77 is in none.)
  const ft = id => p.evaluate(async id => { const r = await FP.groups.forTerminal(id); return { fs: r.fullscreen, view: r.view, g: !!r.group }; }, id);
  const grp = await p.evaluate(async () => { const g = (await FP.groups.list()).find(x => x.terminals.includes('T01')); return { id: g.id, name: g.name }; });
  const gid = grp.id;
  expect('unset is false (own and grouped)', (await ft('T77')).fs === false && (await ft('T01')).fs === false && (await ft('T01')).view === 'kiosk', await ft('T01'));
  await p.evaluate(() => FP.groups.setTerminal('T77', { fullscreen: true }));
  expect('terminal own setting on', (await ft('T77')).fs === true, await ft('T77'));
  await p.evaluate(() => FP.groups.setTerminal('T77', { fullscreen: false }));
  expect('terminal own setting off', (await ft('T77')).fs === false, await ft('T77'));
  const refused = await p.evaluate(async () => { try { await FP.groups.setTerminal('T77', { fullscreen: 'yes' }); return false; } catch (e) { return e.message; } });
  expect('a non-boolean is refused', /on or off/.test(refused), refused);
  await p.evaluate(id => FP.groups.update(id, { fullscreen: true }), gid);
  const r = await ft('T01');
  expect('group on for its terminal, view untouched', r.fs === true && r.g && r.view === 'kiosk', r);
  await p.evaluate(() => FP.groups.setTerminal('T01', { fullscreen: false }));
  expect('group wins over the terminal\'s own', (await ft('T01')).fs === true, await ft('T01'));
  expect('another terminal is not changed', (await ft('T77')).fs === false, await ft('T77'));
  await p.evaluate(id => FP.groups.update(id, { fullscreen: false }), gid);
  expect('group off', (await ft('T01')).fs === false, await ft('T01'));
  await p.evaluate(id => FP.groups.update(id, { fullscreen: true }), gid);

  // Admin: the Full screen choice sits with View (looked for on the Terminals page, then on the terminal's card).
  const hasChoice = () => p.evaluate(() => Array.from(document.querySelectorAll('select')).some(s => Array.from(s.options).some(o => /Full screen on the first tap/.test(o.text))));
  await p.click('.fpe-adminbtn:not(.fpe-helpbtn)'); await w(1500);
  await p.locator(`text=${grp.name}`).first().click().catch(() => {}); await w(1500);
  expect('Admin has the Full screen choice', await hasChoice(), 'no select');
  await A.snapshot('out/l184snap.json');
  await A.b.close();

  // The launcher, with the fullscreen API stubbed and counted.
  const stub = () => {
    window.__fs = { enter: 0, exit: 0, el: null };
    if (!window.__supported) return;
    Element.prototype.requestFullscreen = function () { window.__fs.enter++; window.__fs.el = this; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
    document.exitFullscreen = function () { window.__fs.exit++; window.__fs.el = null; document.dispatchEvent(new Event('fullscreenchange')); return Promise.resolve(); };
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => window.__fs.el });
  };
  const visit = async (what, o, check) => {
    const { b, p: q, w: w2, errs } = await start({ seed: 'out/l184snap.json', at: '2026-11-24T10:00:00-06:00', noSignIn: true, dropKv: ['openSessions'] });
    await q.addInitScript(`window.__supported = ${o.supported !== false}; (${stub.toString()})();`);
    if (o.unsupported) await q.addInitScript(() => { delete Element.prototype.requestFullscreen; delete Element.prototype.webkitRequestFullscreen; });
    q.on('dialog', d => d.accept().catch(() => {}));
    await q.goto('file:///home/claude/kernel/' + (o.page || 'launcher.html')); await w2(4000);
    try { await check(q, w2); } catch (e) { bad.push(`${what}: ${e.message}`); }
    errs.forEach(e => bad.push(`${what}: ${e}`));
    await b.close();
  };
  const fsn = q => q.evaluate(() => Object.assign({}, window.__fs, { el: !!window.__fs.el }));
  const btn = q => q.$eval('#fullscreen-toggle', x => ({ hidden: x.hidden || x.offsetParent === null, text: x.textContent, pressed: x.getAttribute('aria-pressed') })).catch(() => null);

  await visit('setting on', {}, async (q, w2) => {
    let s = await fsn(q);
    expect('no full screen before a tap', s.enter === 0, s);
    let bt = await btn(q);
    expect('button visible, Full screen', bt && !bt.hidden && bt.text === 'Full screen' && bt.pressed === 'false', bt);
    await q.mouse.click(600, 400); await w2(400);
    s = await fsn(q);
    expect('first tap requests full screen once', s.enter === 1 && s.el, s);
    bt = await btn(q);
    expect('button reads Exit full screen', bt && bt.text === 'Exit full screen' && bt.pressed === 'true', bt);
    await q.mouse.click(620, 420); await w2(300);
    expect('more taps do not request again', (await fsn(q)).enter === 1, await fsn(q));
    const bh = await q.$eval('#fullscreen-toggle', x => x.getBoundingClientRect().height);
    expect('button is a 48 px target', bh >= 47.5, String(bh));
    await q.evaluate(() => document.getElementById('fullscreen-toggle').click()); await w2(300);
    s = await fsn(q); bt = await btn(q);
    expect('Exit leaves full screen, label back', s.exit === 1 && !s.el && bt.text === 'Full screen', { s, bt });
    // The user left: a key press does not re-enter; the next tap does.
    await q.keyboard.press('Shift'); await w2(200);
    expect('a key press does not re-enter', (await fsn(q)).enter === 1, await fsn(q));
    await q.mouse.click(600, 400); await w2(300);
    expect('the next tap re-enters', (await fsn(q)).enter === 2, await fsn(q));
  });
  await visit('first key counts too', {}, async (q, w2) => {
    await q.keyboard.press('Shift'); await w2(300);
    expect('the first key press requests full screen', (await fsn(q)).enter === 1, await fsn(q));
  });
  await visit('unsupported', { unsupported: true, supported: false }, async (q, w2) => {
    expect('button hidden when unsupported', (await btn(q)).hidden, await btn(q));
    await q.mouse.click(600, 400); await w2(200);
  });
  await visit('editor', { page: 'editor.html' }, async (q, w2) => {
    await q.mouse.click(600, 400); await w2(300);
    expect('the editor never goes full screen', (await fsn(q)).enter === 0, await fsn(q));
  });

  // Setting off: no request on a tap; the button still toggles.
  const B = await start({ seed: 'out/l184snap.json', at: '2026-11-24T09:30:00-06:00' });
  await B.w(1500);
  await B.p.evaluate(async () => { const g = (await FP.groups.list()).find(x => x.terminals.includes('T01')); await FP.groups.update(g.id, { fullscreen: false }); });
  await B.snapshot('out/l184snap.json'); await B.b.close();
  await visit('setting off', {}, async (q, w2) => {
    await q.mouse.click(600, 400); await w2(300);
    expect('a tap does nothing when the setting is off', (await fsn(q)).enter === 0, await fsn(q));
    await q.evaluate(() => document.getElementById('fullscreen-toggle').click()); await w2(300);
    expect('the button still goes full screen', (await fsn(q)).enter === 1, await fsn(q));
  });

  if (bad.length) { console.log('FAIL\n' + bad.join('\n')); process.exit(1); }
  console.log('l184 ok');
})().catch(e => { console.log('FAIL', e.stack || e); process.exit(1); });
