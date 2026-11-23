// 0.66 Retiring definitions, launcher: a retired form opened by address or by shortcut goes to the form that replaced it
// (with a one-line notice), or shows a "retired" notice card when nothing replaced it (or the shortcut is pinned);
// records saved with a retired form still open on the Records screen.
const start = require('./dummies/base.js');
const fs = require('fs'), path = require('path');
const PACK = fs.readFileSync(path.join(__dirname, '../packs/test-pack/test-pack.json'), 'utf8');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const A = await start({ at: '2026-11-19T08:00:00-06:00' });
  A.p.on('dialog', d => d.accept().catch(() => {}));
  await A.p.evaluate(async text => {
    await FP.sites.create('HOU', 'Houston').catch(() => {});
    await FP.folder.handle.getFileHandle('THIS IS A TEST FOLDER.txt', { create: true });
    await FP.packs.install(FP.packs.read(text));
    const pub = (kind, id, def) => FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, def), { note: 'l178' });
    const form = (t, more) => Object.assign({ title: t, launchable: true, sources: [], fields: [{ name: 'x', control: 'text', label: 'X' }], layout: [['x 6']] }, more || {});
    await pub('structure', 'zz-lots', { label: 'Zz lots', kind: 'list', roles: { active: 'active' }, itemId: { label: 'Lot', made: 'entered' }, containers: { note: {}, active: {} } });
    await pub('form', 'zz-new', form('Zz new'));
    await pub('form', 'zz-old', form('Zz old'));
    await pub('form', 'zz-solo', form('Zz solo'));
    await pub('form', 'zz-lotf', form('Zz lot form', { sources: [{ name: 'lot', kind: 'item', structure: 'zz-lots', id: { field: 'lotId' }, values: { note: 'write' } }],
      fields: [{ name: 'lotId', control: 'text', label: 'Lot', required: true }, { name: 'note', control: 'text', label: 'Note', writes: 'lot.note' }], layout: [['lotId 6', 'note 6']] }));
    const lot = FP.defs.get('form', 'zz-lotf');
    await FP.entry.record({ entry: 'zz-lots.save', item: { structure: 'zz-lots', id: 'LOT-77' }, form: { id: 'zz-lotf', version: lot.version }, values: { note: 'kept for audit' } });
    await FP.launchers.make('zz-old', { name: 'sc-old' });
    await FP.launchers.make('zz-solo', { name: 'sc-solo' });
    await FP.launchers.make('zz-old', { name: 'sc-pin', version: 1 });
    await FP.defs.retire('form', 'zz-old', { note: 'replaced', supersededBy: 'zz-new' });
    await FP.defs.retire('form', 'zz-solo', { note: 'no longer made' });
    await FP.defs.retire('form', 'zz-lotf', { note: 'old way' });
    if (FP.outbox) await FP.outbox.flush();
  }, PACK).catch(e => { bad.push('setup: ' + e.message); console.log('setup:', e.message); });
  await A.snapshot('out/l178snap.json'); await A.b.close();

  const visit = async (query, what, check) => {
    const { b, p, w, errs } = await start({ seed: 'out/l178snap.json', at: '2026-11-19T08:30:00-06:00', noSignIn: true, dropKv: ['openSessions'] });
    p.on('dialog', d => d.accept().catch(() => {}));
    await p.goto('file:///home/claude/kernel/launcher.html' + query); await w(3000);
    if (await p.$('text=Save terminal ID')) { await p.fill('.fp-gate-card input', 'T02'); await p.click('text=Save terminal ID'); await require('./site-step.js')(p, 'TST', 'Test Plant'); await w(2500); }
    await w(1500);
    if (await p.$('.fp-u-card')) { await p.click('.fp-u-card >> text=Josh').catch(() => {}); await w(300); await p.keyboard.type('482913'); await w(3000); }
    await w(4000);
    try { await check(p, w); } catch (e) { bad.push(`${what}: ${e.message}`); }
    await b.close(); errs.forEach(e => bad.push(`${what}: ${e}`));
  };
  const seen = p => p.evaluate(() => ({ card: (document.querySelector('#retired-card') || {}).innerText || null, redirect: (document.querySelector('#retired-redirect') || {}).innerText || null,
    title: (document.querySelector('#title') || {}).textContent || '', url: location.search, err: (document.querySelector('.fpl-err') || {}).innerText || null, form: !!(FP.launcher.current && FP.launcher.current()) }));

  await visit('?form=zz-old', 'by address, replaced', async p => {
    const s = await seen(p);
    expect('replaced: redirected', s.form && /Zz new/.test(s.title) && /form=zz-new/.test(s.url), s);
    expect('replaced: notice', s.redirect && /Zz old was replaced by Zz new/.test(s.redirect) && /Back to home/.test(s.redirect), s);
    expect('replaced: no card, no error', !s.card && !s.err, s);
    await p.click('#retired-redirect button'); await new Promise(r => setTimeout(r, 2500));
    expect('replaced: back to home', await p.evaluate(() => !location.search && !document.querySelector('#retired-redirect')), 'still there');
  });
  await visit('?form=zz-solo', 'by address, no replacement', async p => {
    const s = await seen(p);
    expect('solo: card', s.card && /Zz solo was retired/.test(s.card) && /retired on November 19, 2026 and has no replacement\. Ask a supervisor\./.test(s.card) && /forms/.test(s.card), s);
    expect('solo: no instance, no error', !s.form && !s.err, s);
  });
  await visit('?launcher=sc-old', 'shortcut, replaced', async p => {
    const s = await seen(p);
    expect('shortcut replaced: redirected with notice', s.form && /Zz new/.test(s.title) && /replaced by Zz new/.test(s.redirect || ''), s);
  });
  await visit('?launcher=sc-solo', 'shortcut, no replacement', async p => {
    const s = await seen(p);
    expect('shortcut solo: card', s.card && /has no replacement/.test(s.card) && !s.form && !s.err, s);
  });
  await visit('?launcher=sc-pin', 'pinned shortcut', async p => {
    const s = await seen(p);
    expect('pinned: stops launching with the card', s.card && /retired/.test(s.card) && !s.form && !s.err, s);
  });
  await visit('', 'home and records', async (p, w) => {
    const tiles = await p.evaluate(() => Array.from(document.querySelectorAll('.fpl-tile, #side button')).map(x => x.dataset.form).filter(Boolean));
    expect('retired forms are off the home screen', !tiles.some(t => /^zz-(old|solo|lotf)$/.test(t)), tiles);
    await p.click('#side button:has-text("Records")'); await w(2500);
    await p.selectOption('.fpl-rlist ~ * select, .fpl-row select', 'zz-lots').catch(() => {});
    await w(2000);
    await p.click('.fpl-rlist button:has-text("LOT-77")'); await w(2500);
    const t = await p.evaluate(() => document.body.innerText);
    expect('record of a retired form opens', /LOT-77/.test(t) && /kept for audit/.test(t), t.slice(-600));
  });
  console.log('errs      :', JSON.stringify(bad));
  if (bad.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
