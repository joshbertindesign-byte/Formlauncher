// 0.46 Faster checks: how long a terminal stays signed in (group or terminal), the set button (checks,
// editor), the saved message's {field} names.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1200);
  // O1: signed in for.
  const s = await p.evaluate(async () => {
    const terms = await FP.identity.all();
    const t = 'T01';
    const out = { before: (await FP.groups.forTerminal(t)).signedInFor };
    await FP.groups.setTerminal(t, { signedInFor: 120 }); if (FP.outbox) await FP.outbox.flush(); FP.current.clearCache();
    const ft = await FP.groups.forTerminal(t); out.own = ft.signedInFor; out.group = ft.group && ft.group.name;
    out.bad = await FP.groups.setTerminal(t, { signedInFor: 3 }).then(() => 'took 3?!', e => e.message);
    return out;
  });
  say('signed in', JSON.stringify(s));
  // O3: the set button's checks.
  const fields = [{ name: 'a', control: 'choice', options: ['Pass', 'Fail'] }, { name: 'n', control: 'number' }, { name: 'v', control: 'value', formula: '1' }];
  const chk = await p.evaluate(fields => [
    FP.forms.check({ title: 'S', fields, buttons: [{ name: 'ok', label: 'All pass', action: 'set', sets: { a: 'Pass', n: 3 } }] }),
    FP.forms.check({ title: 'S', fields, buttons: [{ name: 'x', label: 'X', action: 'set' }] }),
    FP.forms.check({ title: 'S', fields, buttons: [{ name: 'x', label: 'X', action: 'set', sets: { zz: 1, v: 2, a: { no: 1 } } }] }),
    FP.forms.check({ title: 'S', fields: fields.concat([{ name: 'cards', control: 'buttons', formula: 'LIST(1, 2)', detail: '"#" & item', actions: [{ label: 'Open', form: 'die-setup', prefill: { dieNo: 'item' } }, { form: 'Bad Name' }, { label: 'X', form: 'x', prefill: { a: 'IF(' } }] }]) }),
    FP.forms.check({ title: 'S', fields, savedMessage: 'Saved {a} {nope}', buttons: [{ name: 's', label: 'Save', action: 'save', savedMessage: '{n} {bad}' }] }),
  ].map(r => r.join(' / ') || 'ok'), fields);
  chk.forEach((c, i) => say('check ' + i, c));
  // Pressed in a preview: fills the fields that show, saves nothing.
  const pr = await p.evaluate(async fields => {
    const host = document.createElement('div'); document.body.appendChild(host);
    const f = await FP.forms.open(host, 'set-t', { def: { title: 'S', fields, buttons: [{ name: 'ok', label: 'All pass', action: 'set', sets: { a: 'Pass', n: 3 } }, { name: 's', label: 'Save', action: 'save' }] }, preview: true, draft: false });
    await new Promise(r => setTimeout(r, 800));
    await f.press('ok'); await new Promise(r => setTimeout(r, 400));
    return { a: f.values ? f.values().a : host.querySelector('[data-name="a"] button[aria-pressed="true"]')?.textContent, n: host.querySelector('[data-name="n"] input').value };
  }, fields);
  say('pressed', JSON.stringify(pr));
  // The editor's button pane offers it.
  await p.click('.fpe-mrow:has-text("Add or change a die")'); await w(1500);
  await p.click('.ffm-r[data-key="b:__one"]'); await w(300);
  await p.click('.ffm-props button:has-text("Set up buttons")'); await w(600);
  const bt = await p.$('.ffm-r[data-key^="b:"]:not([data-key="b:__one"])');
  if (bt) {
    if (!(await p.$('.ffm-props label.ffe-set:has-text("What it does")'))) { await bt.click(); await w(400); }
    const sel = await p.$('.ffm-props label.ffe-set:has-text("What it does") select');
    await sel.selectOption('set'); await w(500);
    say('editor', await p.$eval('.ffm-props', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 260)));
    const add = await p.$('.ffm-props .ffe-set select:has(option:text-is("+ Add a field…"))');
    const opt = await add.$$eval('option', l => l.map(o => o.value).filter(Boolean)[0]);
    await add.selectOption(opt); await w(500);
    say('editor+', await p.$eval('.ffm-props', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 300)));
  } else say('editor', 'no button row');
  say('errs', JSON.stringify(errs));
  await b.close();
})();
