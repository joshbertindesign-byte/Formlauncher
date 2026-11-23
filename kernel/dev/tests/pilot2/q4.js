// Pilot 0.51, step 4, the line terminal through the morning: hourly checks and racks from the board's cards (the
// line and its operator filled in), a changeover that leaves a partial rack, another line's changeover that takes it.
// 
const pilot = require('../dummies/pt.js');
(async () => {
  const t = await pilot({ seed: 'snapQB.json', at: '2026-11-19T06:20:00-06:00' });
  const { p, w, say } = t;
  await t.signIn('Maria Lopez', '135790');
  say('board', await t.board());
  // An hourly check on Line 1: the card fills in the line and Tom Reed.
  await t.act('Line 1', 'Hourly check');
  say('hourly', `${await t.val('run')} · ${await t.val('who')} · ${await t.val('slot')} · ${await t.val('upToDate')}`);
  await t.fill('lengthAct', '179.05'); await p.click('.fpf button:has-text("All pass")'); await w(400);
  await t.fill('speed', 42); await t.fill('weight', '0.240'); await w(600);
  say('why', await t.why());
  await t.save('Save check');
  say('after check', `${await t.text('#title')} · ${await t.board()}`);
  // Ana does the next check on Line 2: change the name.
  await t.act('Line 2', 'Hourly check');
  await p.click('[data-name="who"] .fpc-picked button'); await w(400);
  await p.click('[data-name="who"] .fpc-people button:text-is("Ana Diaz")'); await w(500);
  await t.fill('lengthAct', '192.1'); await p.click('.fpf button:has-text("All pass")'); await w(300); await t.fill('speed', 55); await w(500);
  await t.save('Save check');
  // Racks on Line 1: pieces from what the line runs.
  for (const [at, id] of [['2026-11-19T06:40:00-06:00', 'R10001'], ['2026-11-19T07:30:00-06:00', 'R10002']]) {
    await t.at(at);
    await t.act('Line 1', 'Rack');
    await t.fill('rackId', id); await w(600);
    say('rack ' + id, `${await t.val('run')} · ${await t.val('who')} · pieces ${await t.val('pieces')} · ${await t.val('needProgress')}`);
    await t.save('Save rack');
  }
  say('racks', JSON.stringify((await t.items('racks')).map(x => [x.$id, x.line, x.operator, x.profile, x.color, x.pieces, x.need ? 'need' : '-', x.madeAt ? 'at' : '-'])));
  // Line 1 changes over at 8:10: 40 pieces left on a partial rack; the next need is its own 803 ABI.
  await t.at('2026-11-19T08:10:00-06:00');
  await t.act('Line 1', 'Changeover');
  await t.fill('partialLeft', 40); await w(400); await t.fill('location', 'end of Line 1'); await t.fill('scrapFt', 120); await w(800);
  say('changeover', `${await t.val('runs')} · next need ${await t.val('need')} · makes ${await t.val('makes')}`);
  await p.click('[data-name="material"] button:text-is("Regrind")'); await w(600);
  say('why', await t.why());
  await t.save('Save the changeover');
  say('partials', JSON.stringify((await t.items('partials')).map(x => [x.$id, x.profile, x.color, x.pieces, x.fromRun, x.location, x.$status])));
  // Line 2: a rack, then over to 805 CLAYTON White at 9:00, which takes Line 1's partial rack.
  await t.at('2026-11-19T08:30:00-06:00');
  await t.act('Line 2', 'Rack'); await t.fill('rackId', 'R10003'); await w(500); await t.save('Save rack');
  await t.at('2026-11-19T09:00:00-06:00');
  await t.act('Line 2', 'Changeover');
  await t.fill('partialLeft', 0); await w(500);
  await t.pick('need', '805 CLAYTON White · 2 racks'); await w(1200);
  say('adopt?', `${await t.val('partialInfo')}`);
  await t.seg('adopt', 'Yes, use it'); await p.click('[data-name="material"] button:text-is("Virgin")'); await w(800);
  say('why', await t.why());
  await t.save('Save the changeover');
  await t.at('2026-11-19T09:30:00-06:00');
  await t.act('Line 2', 'Rack'); await t.fill('rackId', 'R10004'); await w(800);
  say('on partial', `${await t.val('partialNote')} · pieces ${await t.val('pieces')}`);
  await t.save('Save rack');
  say('partials', JSON.stringify((await t.items('partials')).map(x => [x.$id, x.adoptedRun, x.adoptedBy, x.$status])));
  say('runs', JSON.stringify((await t.items('runs')).map(x => [x.$id, x.operator, x.profile, x.racks, x.pieces, x.adoptedPartial, x.adoptedPieces, x.endReason, x.$status])));
  say('racks', JSON.stringify((await t.items('racks')).filter(x => x.partial).map(x => [x.$id, x.partial, x.partialPieces])));
  say('needs', JSON.stringify((await t.items('needs')).map(x => [x.label, x.made || 0, x.$status])));
  // Sam does Line 1's 9 AM check on the new run.
  await t.at('2026-11-19T09:35:00-06:00');
  await t.act('Line 1', 'Hourly check');
  await p.click('[data-name="who"] .fpc-picked button'); await w(300); await p.click('[data-name="who"] .fpc-people button:text-is("Sam Cole")'); await w(400);
  say('slots', (await t.options('slot')).join(', '));
  await t.pick('slot', '9 AM');
  await t.fill('lengthAct', '177.2'); await p.click('.fpf button:has-text("All pass")'); await w(300); await t.fill('speed', 38); await w(500);
  await t.save('Save check');
  say('board', await t.board());
  await p.screenshot({ path: 'q4-board.png' });
  await t.snapshot('snapQC.json');
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
