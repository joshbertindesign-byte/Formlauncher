// 0.41: the master map, place panes, groups, people.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say, snapshot } = await start({ seed: 'dummies/snap14.json' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const info = await p.evaluate(async () => ({
    forms: FP.defs.list('form').filter(d => !d.retired).map(d => `${d.id}${d.def.launchable ? '*' : ''}:${(d.def.sites || []).join('/')}`),
    users: (await FP.users.list(true)).map(u => `${u.name}:${u.roles.join('/')}`),
    reg: (await FP.identity.all()).map(t => `${t.terminalId}@${t.site}`),
    me: FP.identity.terminalId, label: FP.identity.label(FP.identity.terminalId), editor: FP.identity.editor,
  }));
  say('info', JSON.stringify(info));
  // a group, from the map
  await p.click('.fpe-mrow.add:has-text("+ terminal group")'); await w(800);
  await p.fill('.fpa-place input', 'Production presses'); 
  await p.getByRole('button', { name: 'Make the group', exact: true }).click(); await w(1500);
  say('group pane', await p.$eval('.fpa-place', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 400)));
  // add T01 and two forms
  await p.selectOption('.fpa-place .fpp-chips select', 'T01'); await w(1500);
  const forms = info.forms.filter(f => f.includes('*')).map(f => f.split(/[*:]/)[0]);
  await p.selectOption('.fpa-place .fpp-list select', forms[0]); await w(1500);
  await p.selectOption('.fpa-place .fpp-list select', forms[1]); await w(1500);
  say('group pane2', await p.$eval('.fpa-place', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 500)));
  // move the second form up
  await p.getByRole('button', { name: `Move ${await p.evaluate(id => FP.defs.get('form', id).def.title, forms[1])} up` }).click(); await w(1500);
  say('order', JSON.stringify(await p.evaluate(async () => (await FP.groups.list()).map(g => [g.name, g.site, g.terminals, g.forms]))));
  say('map', await p.$$eval('.fpe-mrow, .fpe-mterms', l => l.map(x => x.innerText.replace(/\n+/g, ' ')).join(' || ')));
  await p.screenshot({ path: 'l59-group.png' });
  // terminal pane via chip
  await p.click('.fpe-tchip'); await w(1200);
  say('term pane', await p.$eval('.fpa-place', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 500)));
  await p.screenshot({ path: 'l59-term.png' });
  // take it out of the group: keeps a copy
  await p.getByRole('button', { name: 'Take it out of the group' }).click(); await w(1500);
  say('after leave', JSON.stringify(await p.evaluate(async () => ({ g: (await FP.groups.list()).map(g => g.terminals), t: await FP.groups.forTerminal('T01') }))));
  // put it back
  await p.selectOption('.fpa-place select >> nth=0', { index: 1 }).catch(e => say('sel', e.message)); await w(1500);
  say('back in', JSON.stringify(await p.evaluate(async () => (await FP.groups.forTerminal('T01')).group?.name)));
  // a person (People folds away, 0.51.1: open it first)
  if (await p.$('.fpe-maphead[aria-expanded="false"]:has-text("People")')) { await p.click('.fpe-maphead:has-text("People")'); await w(400); }
  await p.click('.fpe-mrow:has-text("Users")'); await w(500);
  const pr = await p.$$eval('.fpe-mrow', l => l.map(x => x.innerText.replace(/\n+/g, ' ')));
  say('people', pr.slice(0, 10).join(' | '));
  await p.click('.fpe-mrow:has-text("Dana Ruiz")'); await w(1200);
  say('person', await p.$eval('.fpa-place', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 400)));
  await p.selectOption('.fpa-place select', 'supervisor'); await p.getByRole('button', { name: 'Save', exact: true }).click(); await w(1500);
  say('roles', JSON.stringify(await p.evaluate(async () => (await FP.users.list(true)).map(u => `${u.name}:${u.roles.join('/')}`))));
  await p.screenshot({ path: 'l59-person.png' });
  await p.selectOption('.fpa-place select', 'user'); await p.getByRole('button', { name: 'Save', exact: true }).click(); await w(1500);
  // new person
  await p.click('.fpe-mrow.add:has-text("+ person")'); await w(1000);
  const ins = await p.$$('.fpa-place input');
  await ins[0].fill('Sam Ortiz'); await ins[2].fill('135792');
  await p.getByRole('button', { name: 'Add this person' }).click(); await w(1500);
  say('new person', await p.$eval('.fpa-place', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 200)));
  // site pane
  await p.click('.fpe-mrow:has-text("Houston")'); await w(1200);
  say('site', await p.$eval('.fpa-place', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 300)));
  // Admin sections
  await p.click('text=⚙ Admin'); await w(1200);
  say('admin tabs', await p.$eval('.fpa-tabs', x => x.innerText.replace(/\n+/g, ' | ')));
  await p.click('.fpa-tabs >> text=Launchers'); await w(1200);
  say('launchers', await p.$eval('.fpe', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 300)));
  await snapshot('dummies/snap15.json');
  say('errs', JSON.stringify(errs));
  await b.close();
})();
