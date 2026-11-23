// 0.51.1 The editor's map: every heading folds away (People closed to start). 0.53.1: forms show under the sites where
// a terminal runs them, and once under Forms with where. 0.60: Plant · Data · Forms · People; Data each structure once,
// its kind as its tag; Formulas inside Forms; every row one line.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(2000);
  // As a person sees it the first time (the test harness opens these three): close them.
  for (const h of ['Data', 'Forms']) if (await p.$(`.fpe-maphead[aria-expanded="true"]:has-text("${h}")`)) { await p.click(`.fpe-maphead:has-text("${h}")`); await w(300); }
  const heads = () => p.$$eval('.fpe-maphead', l => l.map(x => x.innerText.replace(/\s+/g, ' ').trim()).join(' | '));
  const rows = () => p.$$eval('.fpe-map .fpe-mrow', l => l.length);
  say('heads', await heads());
  say('people rows', String(await p.$$eval('.fpe-mrow', l => l.filter(x => /Admins|Supervisors|Users/.test(x.textContent)).length)));
  await p.click('.fpe-maphead:has-text("Data")'); await w(500);
  say('structures', (await p.$$eval('.fpe-map .fpe-mrow', l => l.map(x => x.innerText.replace(/\s+/g, ' ')).filter(t => /form|on no form/.test(t)))).slice(0, 6).join(' | '));
  await p.click('.fpe-maphead:has-text("Forms")'); await w(500);
  say('heads open', `${await heads()} · formulas row: ${await p.$$eval('.fpe-mrow', l => l.filter(x => /^\W*Formulas/.test(x.innerText.trim())).length)}`);
  await p.click('.fpe-maphead:has-text("Forms")'); await w(300);
  await p.click('.fpe-maphead:has-text("People")'); await w(500);
  say('people open', String(await p.$$eval('.fpe-mrow', l => l.filter(x => /Admins|Supervisors|Users/.test(x.textContent)).length)));
  await p.click('.fpe-maphead:has-text("Plant")'); await w(400);
  const before = await rows();
  await p.click('button:has-text("Collapse all")'); await w(500);
  say('collapse all', `${before} rows → ${await rows()} · ${await heads()}`);
  await p.click('button:has-text("Collapse to forms")'); await w(500);
  say('to forms', await heads());
  await p.fill('.fpe-libtop input', 'die'); await w(600);
  say('search', `${await heads()} · ${await rows()} rows`);
  // Forms: each once, with where it runs (on no terminal in amber), unfolding to what it is made of.
  await p.fill('.fpe-libtop input', ''); await w(400);
  await p.click('.fpe-maphead:has-text("Forms")'); await w(400);
  say('forms', (await p.$$eval('.fpe-map .fpe-mrow', l => l.map(x => x.innerText.replace(/\s+/g, ' ') + (x.classList.contains('warn') ? ' [amber]' : '')).filter(t => /Production presses|on no terminal/.test(t)))).join(' | '));
  await p.click('.fpe-maphead:has-text("Data")'); await w(400);
  say('one line each', String(await p.$$eval('.fpe-msub', l => l.length)));
  say('structure rows', (await p.$$eval('.fpe-map .fpe-mrow.fpe-item:has(small.k)', l => l.map(x => x.innerText.replace(/\s+/g, ' ') + (x.querySelector('.cv').textContent ? ' (unfolds)' : '')))).slice(0, 4).join(' | '));
  say('errs', JSON.stringify(errs));
  await p.screenshot({ path: 'l79.png' });
  await b.close();
})();
