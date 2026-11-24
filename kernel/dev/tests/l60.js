// 0.41: the one launcher: home screen by role, refusing a form, approvals.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json' });
  // The seed's kv (its open sign-in included) comes back on every page load; keep the clock near when it was made.
  await p.clock.install({ time: new Date('2026-11-18T13:00:00-06:00') }); await p.clock.resume();
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto('file:///home/claude/kernel/launcher.html'); await w(3000);
  if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh').catch(() => {}); await w(300); await p.keyboard.type('482913'); await w(1800); }
  // Dana, a user
  const signIn = async (name, pin) => { if (!(await p.isVisible('.fp-u.solid'))) await p.click('#who'); await w(800); await p.click(`.fp-u-card >> text=${name}`); await w(400); await p.keyboard.type(pin); await w(2000); };
  await signIn('Dana Ruiz', '864201');
  say('dana bar', await p.$eval('.fpl-bar', x => x.innerText.replace(/\n+/g, ' | ')));
  say('dana home', await p.$eval('#form', x => x.innerText.replace(/\n+/g, ' / ')));
  await p.screenshot({ path: 'l60-user.png' });
  // a form not on this terminal
  await p.goto('file:///home/claude/kernel/launcher.html?form=die-setup'); await w(3000);
  await signIn('Dana Ruiz', '864201');
  say('refused', await p.$eval('#form', x => x.innerText.replace(/\n+/g, ' / ')));
  await p.screenshot({ path: 'l60-refused.png' });
  await p.click('#form button:has-text("Go to this terminal")'); await w(1500);
  say('went home', await p.$eval('#form', x => x.innerText.replace(/\n+/g, ' / ')));
  // fill in a die: held for approval
  const addDie = async (no, desc, press, lo, hi) => {
    if (await p.isVisible('#home')) { await p.click('#home'); await w(1200); }
    await p.click('.fpl-tile[data-form="die-register"]'); await w(1500);
    await p.fill('[data-name="dieNo"] input', no); await p.fill('[data-name="description"] input', desc);
    await p.click(`[data-name="press"] button:has-text("${press}")`);
    await p.fill('[data-name="lowTemp"] input', lo); await p.fill('[data-name="highTemp"] input', hi); await w(400);
    for (let k = 0; k < 10 && await p.$eval('#form button.fpf-save', x => x.disabled); k++) await w(300);   // the page clock is ours: let it tick until validation has enabled Save
     await p.click('#form button:has-text("Save")'); await w(1800);
    say('toast', await p.$$eval('.fpf-toast, .toast, [class*="toast"]', l => l.map(x => x.innerText).join(' | ')).catch(() => '?'));
  };
  await addDie('D-2001', '3 in. channel', 'Press 1', '870', '920');
  say('held', JSON.stringify(await p.evaluate(async () => ({ waiting: (await FP.approvals.list()).map(a => [a.title, a.userName, a.summary, a.entries.length]), dies: Array.from((await FP.current.load('dies')).items.keys()) }))));
  await addDie('D-2002', '2 in. tube', 'Press 2', '860', '900');
  await p.click('#home'); await w(1500);
  say('dana home2', await p.$eval('#form', x => x.innerText.replace(/\n+/g, ' / ')));
  // a supervisor: approvals first
  await signIn('Josh', '482913');
  say('sup home', await p.$eval('#form', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 600)));
  await p.screenshot({ path: 'l60-approvals.png' });
  await p.locator('.fpl-appr').first().getByRole('button', { name: 'Approve', exact: true }).click(); await w(2000);
  await p.locator('.fpl-appr').first().locator('input').fill('Wrong press');
  await p.locator('.fpl-appr').first().getByRole('button', { name: 'Not approved', exact: true }).click(); await w(2000);
  say('notice', await p.$eval('#notice', x => x.innerText));
  say('after', JSON.stringify(await p.evaluate(async () => {
    const dies = await FP.current.load('dies'); const d = dies.items.get('D-2001');
    const ap = await FP.current.load('approvals');
    return { waiting: (await FP.approvals.list()).length, dies: Array.from(dies.items.keys()), d2001: d && d.values, decisions: Array.from(ap.items.values()).map(i => [i.id.slice(0, 6), i.values.decision, i.values.from, i.values.note]) };
  })));
  const raw = await p.evaluate(async () => { const out = []; const walk = async (dir, path) => { for await (const [n, h] of dir.entries()) { if (h.kind === 'file') { if (/D-2001/.test(await (await h.getFile()).text()) && /dies/.test(path)) out.push(path + '/' + n); } else await walk(h, path + '/' + n); } }; await walk(window.__root, ''); return out; });
  say('files', raw.join(' '));
  const line = await p.evaluate(async () => { const r = await FP.current.load('dies'); const it = r.items.get('D-2001'); return it ? JSON.stringify({ by: it.lastUserId, t: it.lastTerminalId }) : null; });
  say('item', line);
  say('errs', JSON.stringify(errs));
  await b.close();
})();
