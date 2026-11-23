// 0.54–0.56 Due: responsibility centers own duties (0.56). The pilot's Line operators (whoever is signed in on the line
// terminals) owe the hourly check for each run. Checks; where a duty applies (a form, a site, a group, a terminal) and
// what it leaves out (always, or between two dates); away people (vacation mode); a form's own schedule (0.54) still
// counts and moves into a center; packs carry centers; the editor's center pane; the launcher's due cards and excusing.
const start = require('./dummies/base.js');
const pilot = require('./dummies/pt.js');
(async () => {
  const A = await start({ seed: 'pilot2/snapQC.json', at: '2026-11-19T09:40:00-06:00', dropKv: ['openSessions'] });
  const { p, w, say } = A;
  await w(3000);
  if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh').catch(() => {}); await w(300); await p.keyboard.type('482913'); await w(2000); }
  const r = await p.evaluate(async () => {
    const out = {};
    const T01 = await FP.groups.forTerminal('T01');
    const states = list => list.map(x => `${x.title}/${x.item ? x.item.id.replace(/^\d+-\d+ /, '') : x.scopeLabel} ${new Date(x.start).toTimeString().slice(0, 5)} ${x.state}${x.center ? ' · ' + x.center.name : ''}`);
    out.centers = (await FP.centers.list()).map(c => `${c.name} (${c.duties.length})`).join(', ');
    // Refused, each with a message.
    const bad = [
      {}, { name: 'X' },
      { name: 'X', members: { role: 'boss' } },
      { name: 'X', members: { departments: ['Quality'] }, duties: [{ name: 'a', every: 60 }] },
      { name: 'X', members: { departments: ['Quality'] }, duties: [{ name: 'a', every: 60, forms: ['no-such-form'] }] },
      { name: 'X', members: { departments: ['Quality'] }, duties: [{ name: 'a', every: 60, forms: ['hourly'], attach: { kind: 'group', ids: [] } }] },
      { name: 'X', members: { departments: ['Quality'] }, duties: [{ name: 'a', every: 60, forms: ['hourly'], exclude: [{ kind: 'terminal', id: 'T01', from: '2026-12-01', to: '2026-11-01' }] }] },
      { name: 'X', members: { departments: ['Quality'] }, duties: [{ name: 'a', every: 2, forms: ['hourly'] }, { name: 'a', every: 60, forms: ['hourly'] }] },
    ];
    out.refused = [];
    for (const v of bad) out.refused.push(await FP.centers.create(v).then(() => 'TOOK', e => e.message.slice(0, 90)));
    // The pilot's Line operators on T01.
    out.t01 = states(await FP.due.slots({ terminalId: 'T01', place: T01 }));
    // Where a duty applies: wherever its forms run, a site, a group, a terminal; and what it leaves out.
    const qc = (await FP.centers.list()).find(c => c.name === 'Quality techs');
    const tryDuty = async (label, d) => {
      await FP.centers.update(qc.id, { duties: [Object.assign({ name: 'patrol', forms: ['hourly', 'rack'], every: 240, grace: 30 }, d)] });
      const l = (await FP.due.slots({ terminalId: 'T01', place: T01 })).filter(x => x.center && x.center.name === 'Quality techs');
      return `${label}: ${l.length ? l.map(x => `${x.scopeLabel} ${x.state}`).slice(0, 2).join(', ') : 'not owed on T01'}`;
    };
    const groups = await FP.groups.list();
    const line = groups.find(g => g.name === 'Line terminals'), office = groups.find(g => g.name === 'QC office');
    out.attach = [
      await tryDuty('wherever its forms run', {}),
      await tryDuty('at site ABI', { attach: { kind: 'site', ids: ['ABI'] } }),
      await tryDuty('at the QC office group', { attach: { kind: 'group', ids: [office.id] } }),
      await tryDuty('at terminal T01', { attach: { kind: 'terminal', ids: ['T01'] } }),
      await tryDuty('leaving out the line group', { exclude: [{ kind: 'group', id: line.id }] }),
      await tryDuty('leaving out T01 in December', { exclude: [{ kind: 'terminal', id: 'T01', from: '2026-12-01', to: '2026-12-31' }] }),
      await tryDuty('leaving out T01 this week', { exclude: [{ kind: 'terminal', id: 'T01', from: '2026-11-16', to: '2026-11-22' }] }),
    ].join(' | ');
    // Members, and away (vacation mode).
    const users = await FP.users.list(true);
    const kevin = users.find(u => u.name === 'Kevin Hart'), maria = users.find(u => u.name === 'Maria Lopez');
    const ctx = { terminalId: 'T01', site: 'ABI', group: line };
    const lineOps = (await FP.centers.list()).find(c => c.name === 'Line operators');
    out.members = `Kevin in Quality techs ${FP.centers.isMember(qc, kevin, null)}; Maria in Line operators on T01 ${FP.centers.isMember(lineOps, maria, ctx)}, at the office ${FP.centers.isMember(lineOps, maria, { terminalId: 'T02', site: 'ABI', group: office })}`;
    await FP.users.setAway(kevin.id, '2026-11-18', '2026-11-25', 'vacation');
    const k2 = (await FP.users.list(true)).find(u => u.name === 'Kevin Hart');
    out.away = `away now ${FP.users.isAway(k2)}, on Dec 1 ${FP.users.isAway(k2, new Date('2026-12-01T12:00:00'))}; in Quality techs now ${FP.centers.isMember(qc, k2, null)}; members today: ${(await FP.centers.membersOf(qc)).map(u => u.name).join(', ') || 'nobody'}`;
    await FP.users.setAway(kevin.id, null);
    out.back = `back: ${(await FP.centers.membersOf(qc)).map(u => u.name).join(', ')}`;
    await FP.centers.update(qc.id, { duties: [] });
    // Misses recorded once, with the center.
    FP.current.clearCache();
    const list = await FP.due.slots({ terminalId: 'T01', place: T01 });
    out.recorded = await FP.due.recordMisses(list);
    FP.current.clearCache();
    out.recordedAgain = await FP.due.recordMisses(await FP.due.slots({ terminalId: 'T01', place: T01 }));
    // A form's own schedule (0.54) still counts, beside the center's.
    const cur = FP.defs.get('form', 'start-shift');
    await FP.defs.publish('form', 'start-shift', Object.assign({}, cur.def, { due: [{ name: 'shiftStart', at: ['09:00'], window: 120, owner: { signedIn: true } }] }), { basedOn: cur.version });
    out.legacy = states(await FP.due.slots({ terminalId: 'T01', place: T01 })).filter(x => x.startsWith('Start')).join(' · ');
    // A pack carries the centers, with groups and people by name.
    const pack = await FP.packs.make({ only: new Set(['hourly']), setup: true });
    out.pack = (pack.setup.centers || []).map(c => `${c.name} ${JSON.stringify(c.members.signedInAt)}`).join(' | ');
    return out;
  });
  say('centers', r.centers);
  say('refused', r.refused.some(x => x === 'TOOK') ? 'TOOK SOME: ' + r.refused.join(' | ') : `all ${r.refused.length} refused: ${r.refused.join(' | ')}`);
  say('T01', r.t01.join(' · '));
  say('applies', r.attach);
  say('members', r.members);
  say('away', r.away);
  say('back', r.back);
  say('recorded', `${r.recorded} misses, then ${r.recordedAgain} more when worked out again`);
  say('legacy', r.legacy);
  say('pack', r.pack);
  // The editor: the start shift form's Due points to centers and moves its own schedule into one; the center's pane.
  await p.locator('.fpe-mrow:has(span:text-is("Start shift"))').first().click(); await w(2500);
  await p.click('.ffm-r[data-key="form"]').catch(e => say('row', e.message)); await w(1200);
  say('form due', await p.$eval('.ffe-due', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 300)).catch(e => 'FAIL no Due section: ' + e.message.slice(0, 80)));
  await p.click('.ffe-due button:has-text("Move these")').catch(e => say('move', e.message.slice(0, 80))); await w(2500);
  say('moved', await p.evaluate(async () => (await FP.centers.list()).map(c => `${c.name}: ${c.duties.map(d => `${d.name} ${d.at || d.every} by ${d.forms.join(',')}`).join(', ')}`).join(' | ')));
  await p.evaluate(() => FP.editor.refreshMap && FP.editor.refreshMap()).catch(() => {});
  await w(1000);
  await p.evaluate(() => { try { const o = JSON.parse(localStorage.getItem('fpe-map-open') || '{}'); o['head:people'] = true; o.centers = true; localStorage.setItem('fpe-map-open', JSON.stringify(o)); } catch (_) {} });
  await p.locator('.fpe-maphead:has-text("People")').first().click().catch(() => {}); await w(600);
  await p.locator('.fpe-mrow:has(span:text-is("Line operators"))').first().click({ timeout: 5000 }).catch(e => say('center row', e.message.slice(0, 80))); await w(2500);
  const pane = await p.$eval('.fpe-panel', x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '');
  say('center pane', ['Who is in it', 'Whoever is signed in at', 'Duties', 'Done by', 'Item by item', 'Applies', 'Leave out', 'Save'].map(k => `${k} ${pane.includes(k) ? 'shown' : 'MISSING'}`).join(' · '));
  await A.snapshot('pilot2/snapDue.json');
  say('errs', JSON.stringify(A.errs).slice(0, 400));
  await A.b.close();

  // The launcher on T01 at 11:30: Maria Lopez (supervisor) signs in.
  const t = await pilot({ seed: 'pilot2/snapDue.json', at: '2026-11-19T11:30:00-06:00' });
  await t.signIn('Maria Lopez', '135790');
  await t.p.waitForTimeout(4000);
  say('due cards', await t.text('#due'));
  say('badge', await t.p.$$eval('.fpl-tile .fpl-badge, .fpl-side .fpl-badge', l => l.map(x => x.parentElement.dataset.form + ': ' + x.textContent).join(', ')));
  say('who', await t.text('#who'));
  await t.p.click('#due .fpl-dcard.fold button').catch(e => say('fold', e.message.slice(0, 60))); await t.p.waitForTimeout(800);
  const first = await t.p.$('#due .fpl-dcard.missed:not(.fold)');
  if (first) {
    await t.p.fill('#due .fpl-dcard.missed:not(.fold) input', 'line down for a die change');
    await t.p.click('#due .fpl-dcard.missed:not(.fold) button:has-text("Excuse it")'); await t.p.waitForTimeout(2000);
    say('excused', await t.p.evaluate(async () => { FP.current.clearCache(); const m = await FP.due.misses(14); return m.filter(x => x.excusedReason).map(x => `${x.item} (${x.centerName || 'form'}) by ${x.excusedBy}: ${x.excusedReason}`).join(' · '); }));
  } else say('excused', 'FAIL no missed card');
  say('errs', JSON.stringify(t.errs).slice(0, 400));
  await t.b.close();
})();
