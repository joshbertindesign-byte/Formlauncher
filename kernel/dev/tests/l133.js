// F37 a launcher's version= must be a positive whole number, otherwise it is ignored with a message (not "no version NaN");
// F19 the launcher offers Reconnect when folder permission lapses: it asks again and saves what waited.
// Fails on a non-empty errs list.
const start = require('./dummies/base.js');
(async () => {
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); };
  const A = await start({ seed: 'dummies/snap15.json', at: '2026-11-18T13:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  const { p, w } = A;
  const open = async q => {
    await p.goto('file:///home/claude/kernel/launcher.html' + q); await w(3500);
    if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh'); await w(300); await p.keyboard.type('482913'); await w(3000); }
  };
  const text = sel => p.$eval(sel, x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '(none)');

  // F37
  for (const v of ['abc', '0', '-2', '1.5', '2e3']) {
    await open('?form=die-register&version=' + encodeURIComponent(v));
    const n = await text('#notice'), t = await text('#title'), f = await p.$('#form .fpf, #form [data-name]');
    console.log('version', v, '|', n.slice(0, 120), '|', t);
    ok(!/NaN/.test(n + t), `F37 version=${v} shows NaN: ${n} ${t}`);
    ok(/isn't a version number/.test(n), `F37 version=${v} has no message: ${n}`);
    ok(!!f, `F37 version=${v}: the form did not open`);
  }
  await open('?form=die-register&version=1');
  const good = await text('#notice');
  ok(!/isn't a version number/.test(good), 'F37 a good version gets no message: ' + good);

  // F19
  await open('?form=die-register');
  const r = await p.evaluate(async () => {
    const h = FP.folder.handle; let granted = false;
    h.queryPermission = async () => (granted ? 'granted' : 'prompt');
    h.requestPermission = async () => { granted = true; window.__asked = (window.__asked || 0) + 1; return 'granted'; };
    await FP.entry.record({ entry: 'dies.update', item: { structure: 'dies', id: 'D-1047' }, form: { id: 'test', version: 1 }, values: { notes: 'while locked' } }).catch(() => null);
    await FP.outbox.flush().catch(() => null);
    return FP.outbox.status();
  });
  await w(500);
  const shown = await p.$eval('#reconnect', x => !x.hidden).catch(() => false);
  console.log('waiting', JSON.stringify(r), 'button', shown);
  ok(r.pending > 0 && r.state === 'waiting', 'F19 setup: ' + JSON.stringify(r));
  ok(shown, 'F19 no Reconnect button when permission lapsed');
  if (shown) {
    await p.click('#reconnect'); await w(1500);
    const after = await p.evaluate(() => ({ asked: window.__asked, st: FP.outbox.status() }));
    console.log('after', JSON.stringify(after), await text('#outbox'));
    ok(after.asked === 1 && after.st.pending === 0, 'F19 Reconnect did not ask and save: ' + JSON.stringify(after));
    ok(await p.$eval('#reconnect', x => x.hidden), 'F19 the button stays after reconnecting');
  }
  await A.b.close();
  const all = fails.concat(A.errs);
  console.log('errs      :', JSON.stringify(all));
  process.exit(all.length ? 1 : 0);
})();
