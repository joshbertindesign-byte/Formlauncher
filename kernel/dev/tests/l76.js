// 0.50.1 Shared terminals: only supervisors sign in and stay responsible; people tap their name on a Who did it
// field, a supervisor confirms with their PIN; the terminal shows only its own forms, whoever is signed in.
const start = require('./dummies/base.js');
(async () => {
  const A = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  await A.w(1200);
  const setup = await A.p.evaluate(async () => {
    const g = (await FP.groups.list())[0];
    await FP.defs.publish('form', 'kiosk-check', { title: 'Kiosk check', sites: ['all'], launchable: true,
      sources: [{ name: 'setup', kind: 'item', structure: 'die-setups', id: { generate: true, prefix: 'DS' }, values: { die: 'write', notes: 'write' } }],
      fields: [{ name: 'die', control: 'text', label: 'Die', required: true, writes: 'setup.die' }, { name: 'doneBy', control: 'person', label: 'Who did it', required: true, writes: 'setup.notes' }],
      buttons: [{ name: 'save', label: 'Save', action: 'save', then: 'stay' }] });
    await FP.groups.update(g.id, { forms: g.forms.concat('kiosk-check'), signIn: 'supervisors' });
    if (FP.outbox) await FP.outbox.flush();
    const check = FP.forms.check({ title: 'P', sites: ['all'], fields: [{ name: 'p', control: 'person', pin: 'everyone' }, { name: 'q', control: 'person', pin: 'nobody' }] });
    const bad = await FP.groups.update(g.id, { signIn: 'operators' }).then(() => 'took it?!', e => e.message);
    return { group: g.name, check, bad, ft: (await FP.groups.forTerminal('T01')).signIn };
  });
  A.say('setup', JSON.stringify(setup));
  await A.snapshot('l76snap.json'); await A.b.close();

  const { b, p, w, errs, say } = await start({ seed: 'l76snap.json', at: '2026-11-18T13:05:00-06:00', noSignIn: true, dropKv: ['openSessions'] });
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto('file:///home/claude/kernel/launcher.html'); await w(3000);
  say('picker', (await p.$eval('.fp-u-card', x => x.innerText.replace(/\n+/g, ' / '))).slice(0, 200));
  await p.click('.fp-u-card >> text=Josh'); await w(300); await p.keyboard.type('482913'); await w(3000);
  say('home', `${(await p.$eval('.fpl-home', x => x.innerText.replace(/\n+/g, ' / '))).slice(0, 300)} · tiles ${await p.$$eval('.fpl-tile', l => l.map(x => x.dataset.form).join(','))} · editor ${await p.isVisible('#editor')}`);
  await p.click('.fpl-tile[data-form="kiosk-check"]'); await w(2500);
  say('people', await p.$$eval('[data-name="doneBy"] .fpc-people button', l => l.map(x => x.textContent).join(', ')));
  say('foot', await p.$eval('.fpf-as', x => x.innerText.replace(/\n+/g, ' ')).catch(() => '?'));
  const rec = async () => p.evaluate(async () => { await FP.outbox.flush(); FP.current.clearCache(); const r = await FP.current.load('die-setups', { fresh: true, history: true }); const row = r.rows.slice().sort((a, b) => String(b.writtenAt).localeCompare(String(a.writtenAt)))[0]; return { die: row.values.die, notes: row.values.notes, doneBy: row.refs.doneBy, user: row.refs.user && row.refs.user.name }; });
  // A person taps their name.
  await p.fill('[data-name="die"] input', 'D-1047');
  await p.click('[data-name="doneBy"] .fpc-people button:text-is("Dana Ruiz")'); await w(500);
  say('picked', await p.$eval('[data-name="doneBy"] .fpc-picked', x => x.innerText.replace(/\n+/g, ' · ')));
  await p.click('.fpf-foot button:has-text("Save")'); await w(2500);
  say('saved 1', JSON.stringify(await rec()));
  // A supervisor confirms with their PIN.
  await p.fill('[data-name="die"] input', 'D-1052'); await w(300);
  if (await p.isVisible('[data-name="doneBy"] .fpc-picked')) { await p.click('[data-name="doneBy"] .fpc-picked button'); await w(400); }
  await p.click('[data-name="doneBy"] .fpc-people button:text-is("I am a supervisor")'); await w(800);
  say('approve', (await p.$eval('.fp-u-card', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '?')).slice(0, 160));
  await p.click('.fp-u-card >> text=Josh'); await w(300); await p.keyboard.type('482913'); await w(2000);
  say('picked 2', await p.$eval('[data-name="doneBy"] .fpc-picked', x => x.innerText.replace(/\n+/g, ' · ')));
  await p.click('.fpf-foot button:has-text("Save")'); await w(2500);
  say('saved 2', JSON.stringify(await rec()));
  // A form not on this terminal doesn't open, admin or not.
  await p.goto('file:///home/claude/kernel/launcher.html?form=die-setup'); await w(3500);
  say('before sign-in', String(await p.$('[data-name="dieNo"]') ? 'the form is open behind the sign-in' : 'nothing open'));
  if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh'); await w(300); await p.keyboard.type('482913'); await w(3000); }
  say('other form', (await p.$eval('#form', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '?')).slice(0, 120));
  say('errs', JSON.stringify(errs.concat(A.errs)));
  await b.close();
})();
