// 0.69 Email in Admin: the Email tab (an admin adds and removes approved domains, history kept; a non-admin sees the admin page refused and
// cannot change the list), a person's email is checked against the list when added or edited and shows quietly in the person's row, and the
// read-only queue list shows a job with its state.
const start = require('./dummies/base.js');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const A = await start({ seed: 'dummies/snap15b.json', at: '2026-11-24T09:00:00-06:00' });
  const { p, w, errs } = A;
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const text = sel => p.$eval(sel, x => x.innerText.replace(/\s+/g, ' ')).catch(() => null);
  const toast = () => p.$$eval('.fpe-msg', l => (l.length ? l[l.length - 1].innerText : ''));
  const domains = () => p.evaluate(() => FP.email.domains(true));

  // The Email tab, as an admin.
  await p.click('.fpe-adminbtn:not(.fpe-helpbtn)'); await w(1500);
  await p.locator('.fpa-tabs button:text-is("Email")').click(); await w(1500);
  let t = await text('.fpa');
  expect('says nothing sends yet', /Nothing sends yet: a sender script on the host delivers these \(not built yet\)/.test(t), t);
  expect('empty list is explained', /list is empty, so no email can be sent/.test(t), t);
  expect('queue shows nothing yet', /email queue: 0/i.test(t) && /Nothing is queued/.test(t), t);
  // Adding.
  await p.fill('#fpa-email-domain', 'Company.com'); await p.click('.fpa button:has-text("Add domain")'); await w(1500);
  expect('domain added, lower-case', JSON.stringify(await domains()) === '["company.com"]', await domains());
  expect('shows it with who and when', /company\.com/.test(await text('.fpa')) && /Last changed .* by Josh/.test(await text('.fpa')), await text('.fpa'));
  await p.fill('#fpa-email-domain', 'plant.company.com'); await p.keyboard.press('Enter'); await w(1500);
  expect('Enter adds too', JSON.stringify(await domains()) === '["company.com","plant.company.com"]', await domains());
  for (const bad1 of ['a@company.com', '*.company.com', 'two words.com', 'company.com']) {
    await p.fill('#fpa-email-domain', bad1); await p.click('.fpa button:has-text("Add domain")'); await w(600);
    expect(`"${bad1}" is refused with a reason`, (await toast() || '').length > 5 && JSON.stringify(await domains()) === '["company.com","plant.company.com"]', [await toast(), await domains()]);
  }
  const h = await p.$eval('.fpa button:has-text("Add domain")', x => x.getBoundingClientRect().height);
  const hr = await p.$eval('.fpa button:has-text("Remove")', x => x.getBoundingClientRect().height);
  expect('buttons are 48 px targets', h >= 47.5 && hr >= 47.5, [h, hr]);
  // Removing.
  await p.locator('.fpa-card:has-text("plant.company.com") button:has-text("Remove")').click(); await w(1500);
  expect('domain removed', JSON.stringify(await domains()) === '["company.com"]', await domains());
  const kept = await p.evaluate(async () => (await FP.current.load('approved-domains', { fresh: true, history: true })).rows.length);
  expect('every change is an entry', kept === 3, kept);
  await p.screenshot({ path: './out/l187-email.png' });

  // A person's email.
  const pid = await p.evaluate(async () => { const id = await FP.users.create({ name: 'Maria Lopez', department: 'Extrusion', roles: ['user'], tempPin: '918273', email: 'Maria@Company.com' }); return id; });
  expect('saved lower-cased domain', (await p.evaluate(async id => (await FP.users.list(true)).find(u => u.id === id).email, pid)) === 'Maria@company.com', 'x');
  const e1 = await p.evaluate(async () => { try { await FP.users.create({ name: 'X Y', roles: ['user'], tempPin: '918273', email: 'x@evilcompany.com' }); return null; } catch (e) { return e.message; } });
  expect('create refuses an address outside the list', /not an approved domain/.test(e1 || ''), e1);
  const e2 = await p.evaluate(async () => { try { await FP.users.create({ name: 'X Y', roles: ['user'], tempPin: '918273', email: 'a@company.com;b@company.com' }); return null; } catch (e) { return e.message; } });
  expect('create refuses several addresses', !!e2, e2);
  expect('and wrote nobody', !(await p.evaluate(async () => (await FP.users.list(true)).some(u => u.name === 'X Y'))), 'written');
  await p.evaluate(() => FP.editor.refreshMap()); await w(1000);
  await p.evaluate(id => FP.editor.openPlace('person', id), pid); await w(1500);
  const ei = '.fpa-place input[placeholder="e.g. maria@company.com"]';
  expect('the edit form has the email, filled in', (await p.$eval(ei, x => x.value)) === 'Maria@company.com', await p.$eval(ei, x => x.value));
  await p.fill(ei, 'maria@evil.com'); await p.click('.fpa-place button:has-text("Save")'); await w(1500);
  expect('a bad address is refused in the toast', /not an approved domain/.test(await toast() || ''), await toast());
  expect('and not saved', (await p.evaluate(async id => (await FP.users.list(true)).find(u => u.id === id).email, pid)) === 'Maria@company.com', 'changed');
  await p.fill(ei, 'maria.lopez@company.com'); await p.click('.fpa-place button:has-text("Save")'); await w(1500);
  expect('a good one is saved', (await p.evaluate(async id => (await FP.users.list(true)).find(u => u.id === id).email, pid)) === 'maria.lopez@company.com', 'x');
  await p.evaluate(id => FP.editor.openPlace('person', id), pid); await w(1500);
  await p.fill(ei, ''); await p.click('.fpa-place button:has-text("Save")'); await w(1500);
  expect('empty clears it', (await p.evaluate(async id => (await FP.users.list(true)).find(u => u.id === id).email, pid)) === '', 'x');
  await p.evaluate(id => FP.users.setEmail(id, 'maria.lopez@company.com'), pid);
  await p.evaluate(() => FP.editor.refreshMap()); await w(1500);
  const rowOf = () => p.$$eval('.fpe-map .fpe-mrow', l => l.map(x => x.innerText.replace(/\s+/g, ' ').trim()).find(t => /Maria Lopez/.test(t)) || null);
  const open = re => p.evaluate(src => { const r = new RegExp(src, 'i'), t = x => (x.innerText || '').replace(/^\s*[▸▾]\s*/, '').trim(); const all = Array.from(document.querySelectorAll('.fpe-map *')).filter(x => r.test(t(x))); const deep = all.filter(x => !Array.from(x.children).some(c => r.test(t(c)))); const el = deep[0]; if (el) el.click(); return !!el; }, re);
  for (const head of ['^People', '^Users']) { if (await rowOf()) break; await open(head); await w(700); }
  const row = await p.$$eval('.fpe-map .fpe-mrow', l => { const r = l.find(x => /Maria Lopez/.test(x.innerText)); return r ? r.innerText.replace(/\s+/g, ' ').trim() + ' | title: ' + r.title : null; });
  expect('the person row holds the email quietly (its tooltip, after the department; not as a chip)', row && /^Maria Lopez EXTRUSION \| title: Extrusion · maria\.lopez@company\.com$/.test(row), row);
  // A plain new person form has an optional email: adding without one still works.
  await p.evaluate(() => FP.editor.openPlace('new-person', null)); await w(1200);
  expect('the new person form has an optional email', !!(await p.$(ei)), 'missing');
  // Never on the sign-in screen.
  const gate = await p.evaluate(async () => { await FP.users.signOut(); FP.users.gate({ mode: 'signin' }); await new Promise(r => setTimeout(r, 1200)); const g = document.querySelector('.fp-u'); const t = g ? g.innerText : null; if (g) g.remove(); return t; });
  expect('sign-in lists names but no email', gate && /Maria Lopez/.test(gate) && !/@/.test(gate), gate);

  // The queue shows a job, read-only.
  const josh = await p.evaluate(async () => (await FP.users.list()).find(u => u.name === 'Josh').id);
  await p.evaluate(async id => { await FP.users.signIn(id, '482913'); }, josh).catch(() => {});
  await w(500);
  const q = await p.evaluate(async () => FP.email.queue({ mailbox: 'forms-notifications', to: ['maria.lopez@company.com', 'x@evil.com'], subject: 'OD check failed: P-1042 on Line 3', bodyText: 'Failed' }));
  expect('queued from code', q.ok && q.dropped.length === 1, q);
  await p.evaluate(async j => { await FP.files.writeJson(['status'], `${j}.json`, { state: 'sent', at: '2026-11-24T15:00:05Z', attempts: 1, detail: 'ok' }); const x = await FP.files.readJson(['outbox', 'email'], `${j}.json`); await FP.files.writeJson(['outbox', 'done'], `${j}.json`, x); await FP.files.remove(['outbox', 'email'], `${j}.json`); }, q.jobId);
  const q2 = await p.evaluate(async () => FP.email.queue({ mailbox: 'forms-notifications', to: ['maria.lopez@company.com'], cc: ['a@company.com'], subject: 'Second', bodyText: 'Hi' }));
  await p.click('.fpe-adminbtn:not(.fpe-helpbtn)').catch(() => {}); await w(1200);
  await p.locator('.fpa-tabs button:text-is("Email")').click(); await w(1500);
  const rows = await p.$$eval('.fpa-table tr[data-job]', l => l.map(x => x.innerText.replace(/\s+/g, ' ')));
  expect('queue lists both jobs', /email queue: 2/i.test(await text('.fpa')) && rows.length === 2, rows);
  expect('with ID, recipient count, subject and state', rows.some(r => r.includes(q.jobId) && /1 recipient /.test(r) && /OD check failed/.test(r) && /sent/.test(r)) && rows.some(r => r.includes(q2.jobId) && /2 recipients/.test(r) && /Second/.test(r) && /queued/.test(r)), rows);
  expect('the queue has no buttons', !(await p.$('.fpa-table button')), 'buttons');
  await p.screenshot({ path: './out/l187-queue.png' });
  await A.snapshot('out/l187snap.json'); await A.b.close();

  // A plain user: the admin page is refused and the list cannot be changed.
  const { b, p: u, w: w2, errs: e3 } = await start({ seed: 'out/l187snap.json', at: '2026-11-24T10:00:00-06:00' });
  u.on('dialog', d => d.accept().catch(() => {}));
  await w2(1500);
  await u.evaluate(async () => { const id = await FP.users.create({ name: 'Pat Operator', roles: ['user'], tempPin: '918273' }); await FP.users.changePin(id, '918273', '735194'); await FP.users.signOut(); await FP.users.signIn(id, '735194'); });
  const r = await u.evaluate(async () => { try { await FP.email.setDomains(['evil.com']); return null; } catch (e) { return e.message; } });
  expect('a plain user cannot change the list', /Only an admin/.test(r || ''), r);
  const r2 = await u.evaluate(async () => { try { await FP.users.setEmail((await FP.users.list()).find(x => x.name === 'Maria Lopez').id, 'a@company.com'); return null; } catch (e) { return e.message; } });
  expect('nor a person\'s email', /Only an admin/.test(r2 || ''), r2);
  const page = await u.evaluate(async () => { const h = document.createElement('div'); document.body.appendChild(h); await FP.editor.admin(h, { section: 'email' }); return h.innerText; });
  expect('the admin page is refused', /This page is for admins/.test(page) && !/Add domain/.test(page), page);
  expect('the list is as it was', JSON.stringify(await u.evaluate(() => FP.email.domains(true))) === '["company.com"]', await u.evaluate(() => FP.email.domains(true)));
  e3.forEach(x => bad.push('plain user: ' + x));
  await b.close();
  errs.forEach(x => bad.push('page: ' + x));
  console.log('errs      :', JSON.stringify(bad));
  if (bad.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
