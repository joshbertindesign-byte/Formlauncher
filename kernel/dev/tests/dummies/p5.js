// Pilot scenario C: racks, a changeover leaving a partial rack, adopting it, needs closing, ending the shift.
const pilot = require('./pt.js');
(async () => {
  const t = await pilot({ seed: 'snapPilotB.json', at: '2026-11-19T09:10:00-06:00' });
  const { p, w, say } = t;
  await t.signIn('Josh', '482913');
  const rack = async (line, id, pieces) => {
    if (line) await t.act(line, 'Rack'); else await t.open('rack');
    say('  opts', (await t.options('run')).join(' | '));
    say('  picked', await t.val('run'));
    await t.fill('rackId', id); await w(600);
    say('  picked2', await t.val('run'));
    if (pieces != null) await t.fill('pieces', pieces);
    await w(800);
    say(`rack ${id}`, `pieces=${await t.val('pieces')} | ${await t.text('[data-name="partialNote"]')} | ${await t.text('[data-name="needProgress"]')} | ${await t.why()}`);
    const ok = await p.$eval('.fpf-foot button.fpf-save', b => !b.disabled);
    if (ok) await t.save('Save rack');
    return ok;
  };
  say('rack tiles', await t.board());
  await rack('Line 1', 'r1001');
  await rack('Line 1', 'R1002');
  await rack('Line 1', 'R1001');          // already recorded: refused
  await p.screenshot({ path: '../pilot/c-rack-dup.png', fullPage: true });
  // Changeover on Line 1 at 10:30: 120 pieces left on a partial rack.
  await t.at('2026-11-19T10:30:00-06:00');
  await t.open('changeover');
  await t.pick('run', 'Line 1');
  await t.fill('partialLeft', 120); await t.fill('location', 'end of Line 1'); await t.fill('scrapFt', 80);
  await w(800);
  say('co need', `${await t.val('need')} | ${await t.text('[data-name="runsWhat"]')}`);
  await t.seg('material', 'Regrind'); await w(800);
  say('co why', await t.why());
  await p.screenshot({ path: '../pilot/c-changeover.png', fullPage: true });
  await t.save('Save the changeover');
  say('partials', JSON.stringify(await t.items('partials')));
  // Line 2 changes over to 805 CLAYTON White at 11:00: the partial rack is offered.
  await t.at('2026-11-19T11:00:00-06:00');
  await t.open('changeover');
  await t.pick('run', 'Line 2');
  await t.fill('partialLeft', 0); await t.fill('scrapFt', 40);
  await t.pick('need', '805 CLAYTON White · 2 racks'); await w(1200);
  say('adopt?', `${await t.text('[data-name="partialInfo"]')} | ${await t.text('[data-name="adopt"]')}`);
  await t.seg('adopt', 'Yes, use it'); await t.seg('material', 'Virgin'); await w(800);
  say('co2 why', await t.why());
  await p.screenshot({ path: '../pilot/c-adopt.png', fullPage: true });
  await t.save('Save the changeover');
  say('partials2', JSON.stringify((await t.items('partials')).map(x => [x.$id, x.$status, x.pieces, x.adoptedRun, x.adoptedBy])));
  // First rack on Line 2's new run finishes the partial rack.
  await t.at('2026-11-19T11:40:00-06:00');
  say('runs@11:40', JSON.stringify((await t.items('runs')).map(r => [r.$id, r.$status, r.endAt])));
  await rack('Line 2', 'R2001');
  await rack('Line 2', 'R2002');
  say('racks', JSON.stringify((await t.items('racks')).map(r => [r.$id, r.line, r.profile, r.color, r.pieces, r.partial, r.partialPieces, r.need && r.need.slice(-4), r.operator, r.crew])));
  // Line 1's first need: 2 of 3 done; change it to 2 racks, and it closes.
  await t.open('change-need');
  await t.pick('pick', '805 CLAYTON White · 3 racks');
  await w(800);
  say('change', `${await t.val('done')} racks=${await t.val('racks')}`);
  await t.fill('racks', 2); await w(600);
  await t.save('Save the change');
  say('needs', JSON.stringify((await t.items('needs')).map(x => [x.line, x.label, x.made || 0, x.racks, x.$status])));
  await t.snapshot('snapPilotC.json');
  // End the shift at 18:05.
  await t.at('2026-11-19T18:05:00-06:00');
  await t.open('end-shift');
  say('end', await t.text('#form'));
  await p.$$eval('[data-name="scrap"] input', (l) => l.forEach((x, i) => { x.value = String(25 + i * 5); x.dispatchEvent(new Event('input', { bubbles: true })); }));
  await t.seg('caliperOff', 'Yes'); await w(1000);
  say('end why', await t.why());
  await p.screenshot({ path: '../pilot/c-endshift.png', fullPage: true });
  await t.save('End the shift');
  say('runs', JSON.stringify((await t.items('runs')).map(r => [r.$id, r.$status, r.endReason, r.racks, r.pieces, r.scrapFt, Math.round(r.primeFt), Math.round(r.totalLbs), r.scrapPct && Math.round(r.scrapPct * 1000) / 10, r.checks, r.missed, r.hours])));
  say('shift', JSON.stringify((await t.items('shifts')).map(s => [s.$id, s.$status, s.endedAt, s.caliperOff])));
  await t.snapshot('snapPilotD.json');
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
