// 0.64 Day / Night: the switch in the editor header flips the mode and says which it is; the choice is saved on this terminal and is
// applied before the page paints after a reload; a terminal with storage blocked still works (in Day); the generated launch.html
// carries the same early script; printing always uses day colours; the drawing pad does not change with the mode.
const start = require('./dummies/base.js');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${JSON.stringify(got)}`); };
  const A = await start({ at: '2026-11-19T08:30:00-06:00' });
  const p = A.p;
  const state = () => p.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), stored: (() => { try { return localStorage.getItem('fp-theme'); } catch (_) { return 'blocked'; } })(),
    btn: (document.querySelector('.fpe-themebtn') || {}).textContent, pressed: (document.querySelector('.fpe-themebtn') || { getAttribute: () => null }).getAttribute('aria-pressed'), surface: FP.theme.token('s-n-100'), text: FP.theme.token('t-n-12') }));
  const s0 = await state();
  A.say('start', JSON.stringify(s0));
  expect('starts in Day', s0.attr === 'day' && s0.btn && /Night/.test(s0.btn) && s0.pressed === 'false' && s0.surface === '#ffffff', s0);

  await p.click('.fpe-themebtn'); await A.w(300);
  const s1 = await state();
  A.say('after tap', JSON.stringify(s1));
  expect('one tap: Night, saved, button says Day', s1.attr === 'night' && s1.stored === 'night' && /Day/.test(s1.btn) && s1.pressed === 'true' && s1.surface !== '#ffffff' && s1.text !== '#1b1f24', s1);

  // the drawing pad is the same in both modes
  const pad = await p.evaluate(() => ({ bg: FP.theme.token('pad-bg'), ink: FP.theme.token('pad-ink') }));
  expect('the pad is white with a dark pen in Night', pad.bg === '#ffffff' && pad.ink === '#111111', pad);

  // printing: day colours while the screen is Night
  await p.emulateMedia({ media: 'print' }); await A.w(100);
  const printing = await p.evaluate(() => ({ surface: FP.theme.token('s-n-100'), text: FP.theme.token('t-n-12'), accent: FP.theme.token('t-blue-42') }));
  await p.emulateMedia({ media: 'screen' });
  A.say('print', JSON.stringify(printing));
  expect('print uses day values', printing.surface === '#ffffff' && printing.text === '#1b1f24' && printing.accent === '#1f5fbf', printing);

  // a reload keeps the choice, applied before the page runs its scripts
  const early = await p.evaluate(async () => {
    const html = FP.launchers.homeHtml();
    return { homeHasEarly: html.includes("localStorage.getItem('fp-theme')==='night'"), homeEarlyFirst: html.indexOf("fp-theme") < html.indexOf('<script src="runtime/releases.js">') };
  });
  expect('launch.html carries the early script', early.homeHasEarly && early.homeEarlyFirst, early);
  await p.reload(); await A.w(1200);
  const attrAfter = await p.evaluate(() => ({ attr: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.documentElement).backgroundColor }));
  A.say('after reload', JSON.stringify(attrAfter));
  expect('Night survives a reload', attrAfter.attr === 'night', attrAfter);

  // storage blocked: the page still works, in Day, and the switch does not throw
  await A.b.close();
  const B = await start({ at: '2026-11-19T08:30:00-06:00' });
  await B.p.evaluate(() => { try { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); } catch (_) { /* already blocked */ } });
  const blocked = await B.p.evaluate(() => { let threw = null; let mode = null; try { mode = FP.theme.get(); FP.theme.set('night'); } catch (e) { threw = e.message; } return { mode, threw, attr: document.documentElement.getAttribute('data-theme') }; });
  A.say('blocked storage', JSON.stringify(blocked));
  expect('storage blocked: Day, no error, the switch still applies for the session', blocked.mode === 'day' && !blocked.threw && blocked.attr === 'night', blocked);
  await B.b.close();

  console.log('errs      :', JSON.stringify(bad.concat(A.errs, B.errs)));
  if (bad.length || A.errs.length || B.errs.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
