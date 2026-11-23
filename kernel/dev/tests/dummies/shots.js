// Screens of the pilot's terminal forms, as a terminal shows them: 1366×768 with the number pad open, and 1920×1080.
const pilot = require('./pt.js');
(async () => {
  const t = await pilot({ seed: process.argv[2] || 'snapPilotA.json', at: process.argv[3] || '2026-11-19T07:20:00-06:00' });
  const { p, w, say } = t;
  await t.signIn('Josh', '482913');
  const forms = (process.argv[4] || 'start-shift,hourly,rack,changeover,end-shift,needs-board').split(',');
  for (const [vw, vh] of [[1366, 768], [1920, 1080]]) {
    await p.setViewportSize({ width: vw, height: vh }); await w(600);
    for (const f of forms) {
      await t.open(f); await w(1500);
      // Each form as it is being filled in, the keyboard up where it would be.
      const focus = async name => { const x = await p.$(`[data-name="${name}"] input`); if (x) { await x.focus(); await w(600); } };
      if (f === 'hourly') { await t.pick('run', 'Line 1').catch(() => {}); await t.seg('lineStatus', 'Running'); await focus('lengthAct'); }
      if (f === 'rack') { await t.pick('run', 'Line 1').catch(() => {}); await focus('rackId'); }
      if (f === 'changeover') { await t.pick('run', 'Line 1').catch(() => {}); await focus('partialLeft'); }
      if (f === 'start-shift') { for (const l of ['Line 1', 'Line 2']) await p.click(`[data-name="lineList"] button:text-is("${l}")`).catch(() => {}); await w(600); }
      if (f === 'end-shift') { const x = await p.$('[data-name="scrap"] input'); if (x) { await x.focus(); await w(600); } }
      const m = await p.evaluate(() => ({ h: document.scrollingElement.scrollHeight, vh: innerHeight, pad: FP.keyboard.showing() ? FP.keyboard.showing().kind : null }));
      say(`${f} ${vw}`, `content ${m.h} of ${m.vh}${m.h > m.vh ? ` · scrolls ${m.h - m.vh}` : ' · fits'} · pad ${m.pad}`);
      await p.screenshot({ path: `../pilot/f-${f}-${vw}.png` });
      if (f === 'start-shift') {
        await p.click('.fpf button:has-text("What runs on each line")'); await w(2500);
        await focus('wsSize').catch(() => {});
        const m2 = await p.evaluate(() => { const s = document.querySelector('.fpf-sheet:last-of-type'); return { h: s ? s.scrollHeight : 0, vh: innerHeight }; });
        say(`  line sheet ${vw}`, `content ${m2.h} of ${m2.vh}${m2.h > m2.vh ? ` · scrolls ${m2.h - m2.vh}` : ' · fits'}`);
        await p.screenshot({ path: `../pilot/f-lineRuns-${vw}.png` });
        await p.click('.fpf-sheet .fpf-crumbs button.back').catch(() => {}); await w(800);
      }
      await p.evaluate(() => document.activeElement && document.activeElement.blur()); await w(300);
    }
  }
  say('errs', JSON.stringify(t.errs));
  await t.b.close();
})();
