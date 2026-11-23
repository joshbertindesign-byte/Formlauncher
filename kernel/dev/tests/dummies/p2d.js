const start = require('./base.js');
(async () => {
  const t = await start({ seed: 'snapPilot.json', noSignIn: true });
  const { p, w } = t; await p.clock.setFixedTime(new Date('2026-11-19T05:50:00-06:00'));
  await p.goto('file:///home/claude/kernel/launcher.html'); await p.waitForSelector('.fp-gate-card');
  await p.fill('.fp-gate-card input', 'T01'); await p.click('text=Save terminal ID'); await w(1500);
  console.log('1:', await p.$eval('.fp-gate-card', x => x.innerText));
  const ins = await p.$$('.fp-gate-card input'); console.log('inputs', ins.length);
  await ins[0].fill('ABI'); await ins[1].fill('Abilene'); await p.click('.fp-gate-card button'); await w(2000);
  console.log('2:', await p.$eval('.fp-gate-card', x => x.innerText).catch(() => 'no gate'));
  console.log('body:', (await p.evaluate(() => document.body.innerText)).slice(0, 500));
  console.log(t.errs);
  await t.b.close();
})();
