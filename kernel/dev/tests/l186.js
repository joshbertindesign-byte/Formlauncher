// 0.69 Email, step 2: FP.email.queue writes a version 1 job whole to outbox/email/<jobId>.json; addresses outside the approved list are
// dropped and reported (nothing is written when none is left); mailbox, subject, body and attachment paths are checked; status() and list()
// follow a job a simulated sender moves to outbox/processing/ then outbox/done/ (or failed/) and writes status/<jobId>.json for.
const start = require('./dummies/base.js');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const A = await start({ seed: 'dummies/snap15b.json', at: '2026-11-24T09:00:00-06:00' });
  const { p, w, errs } = A;
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const ev = (fn, arg) => p.evaluate(fn, arg);
  await ev(async () => { await FP.kv.set('terminalId', 'T05'); FP.identity.terminalId = 'T05'; await FP.email.setDomains(['company.com', 'partner.org']); });
  const names = async parts => ev(p2 => FP.files.list(p2), parts);
  const q = spec => ev(s => FP.email.queue(s), spec);
  const base = { mailbox: 'forms-notifications', to: ['maria@company.com'], subject: 'OD check failed: P-1042 on Line 3', bodyHtml: '<p>Failed</p>', bodyText: 'Failed' };

  // A good job: the exact version 1 shape, in the right folder, one file.
  const r = await q(Object.assign({}, base, { cc: ['Lee@Partner.org'], source: { rule: 'od-fail', center: 'molding', entryId: 'E1' } }));
  expect('queued', r.ok === true && Array.isArray(r.dropped) && r.dropped.length === 0, r);
  expect('job ID format YYYYMMDD-<terminal>-<6 base-36>', /^20261124-T05-[a-z0-9]{6}$/.test(r.jobId), r.jobId);
  expect('one file in outbox/email', JSON.stringify(await names(['outbox', 'email'])) === JSON.stringify([`${r.jobId}.json`]), await names(['outbox', 'email']));
  const job = await ev(id => FP.files.readJson(['outbox', 'email'], `${id}.json`), r.jobId);
  expect('keys are exactly the version 1 shape', JSON.stringify(Object.keys(job)) === JSON.stringify(['version', 'action', 'jobId', 'createdAt', 'mailbox', 'to', 'cc', 'subject', 'bodyHtml', 'bodyText', 'attachments', 'runAfter', 'source']), Object.keys(job));
  expect('values', job.version === 1 && job.action === 'email' && job.jobId === r.jobId && job.mailbox === 'forms-notifications' && JSON.stringify(job.to) === '["maria@company.com"]'
    && JSON.stringify(job.cc) === '["Lee@partner.org"]' && job.subject === base.subject && job.bodyHtml === '<p>Failed</p>' && job.bodyText === 'Failed' && JSON.stringify(job.attachments) === '[]' && job.runAfter === null
    && JSON.stringify(job.source) === '{"rule":"od-fail","center":"molding","entryId":"E1"}', job);
  expect('createdAt is a UTC time to the second', /^2026-11-24T1[45]:\d\d:\d\dZ$/.test(job.createdAt), job.createdAt);
  // Unique IDs.
  const ids = new Set([r.jobId]);
  for (let i = 0; i < 5; i++) ids.add((await q(base)).jobId);
  expect('six queued, six different IDs', ids.size === 6, [...ids]);

  // Dropped addresses: reported, not in the job.
  const d = await q(Object.assign({}, base, { to: ['maria@company.com', 'bob@evilcompany.com', 'a@company.com;b@evil.com'], cc: ['"Pat" <pat@company.com>', 'sub@x.company.com', 'maria@COMPANY.com'] }));
  expect('queued with the good one', d.ok === true, d);
  expect('three dropped with a reason each', d.dropped.length === 4 && d.dropped.every(x => x.address && x.problem), d.dropped);
  expect('the dropped are named', ['bob@evilcompany.com', 'a@company.com;b@evil.com', '"Pat" <pat@company.com>', 'sub@x.company.com'].every(a => d.dropped.some(x => x.address === a)), d.dropped);
  const dj = await ev(id => FP.files.readJson(['outbox', 'email'], `${id}.json`), d.jobId);
  expect('the job holds only the approved, once', JSON.stringify(dj.to) === '["maria@company.com"]' && dj.cc.length === 0, dj);

  // Nothing written when no valid recipient is left.
  const before = (await names(['outbox', 'email'])).length;
  const n = await q(Object.assign({}, base, { to: ['x@evil.com'], cc: ['y@evil.com'] }));
  expect('no recipient left: refused with a reason and the dropped list', n.ok === false && /No recipient/.test(n.reason) && n.dropped.length === 2, n);
  expect('and nothing was written', (await names(['outbox', 'email'])).length === before, await names(['outbox', 'email']));
  const e2 = await q(Object.assign({}, base, { to: [] }));
  expect('no recipients at all', e2.ok === false && /at least one recipient/.test(e2.reason), e2);
  await ev(() => FP.email.setDomains([]));
  const e3 = await q(base);
  expect('an empty approved list sends nothing', e3.ok === false && e3.dropped.length === 1, e3);
  await ev(() => FP.email.setDomains(['company.com', 'partner.org']));

  // The other checks.
  const refuse = async (what, spec, re) => { const x = await q(Object.assign({}, base, spec)); expect(what, x.ok === false && re.test(x.reason), x); };
  await refuse('mailbox with a slash', { mailbox: '../x' }, /mailbox/); await refuse('mailbox with a space', { mailbox: 'a b' }, /mailbox/);
  await refuse('no mailbox', { mailbox: null }, /mailbox/); await refuse('mailbox too long', { mailbox: 'a'.repeat(60) }, /mailbox/);
  await refuse('subject not text', { subject: 5 }, /subject/); await refuse('subject blank', { subject: '  ' }, /subject/);
  await refuse('body not text', { bodyHtml: { a: 1 } }, /body/); await refuse('no message', { bodyHtml: '', bodyText: '' }, /message/);
  await refuse('runAfter not a date', { runAfter: 'next week' }, /date/);
  const long = await q(Object.assign({}, base, { subject: 'S'.repeat(500) + '\r\nBcc: x@evil.com' }));
  const lj = await ev(id => FP.files.readJson(['outbox', 'email'], `${id}.json`), long.jobId);
  expect('subject is capped and has no line breaks', long.ok && lj.subject.length === 200 && !/[\r\n]/.test(lj.subject), lj.subject.length);
  const ra = await q(Object.assign({}, base, { runAfter: '2026-11-25T08:00:00-06:00' }));
  expect('runAfter is kept as a UTC time', (await ev(id => FP.files.readJson(['outbox', 'email'], `${id}.json`), ra.jobId)).runAfter === '2026-11-25T14:00:00Z', 'x');
  const onlyText = await q(Object.assign({}, base, { bodyHtml: undefined }));
  expect('text only is fine', onlyText.ok === true, onlyText);

  // Attachments: paths stay inside media; sizes are summed.
  await ev(async () => { await FP.files.writeText(['media', 'files', '2026-11'], 'a.txt', 'hello'); });
  for (const path of ['../secret.txt', 'media/../secret.txt', '/etc/passwd', 'C:/Windows/x.txt', 'media\\files\\a.txt', 'other/a.txt', 'media', 'media//a.txt', 'media/./a.txt', 'media/files/']) {
    const x = await q(Object.assign({}, base, { attachments: [{ path, name: 'x' }] }));
    expect(`attachment path ${path} refused`, x.ok === false && /Attachment/.test(x.reason), x);
  }
  const miss = await q(Object.assign({}, base, { attachments: [{ path: 'media/files/2026-11/none.txt' }] }));
  expect('a file that is not there is refused', miss.ok === false && /not in the media folder/.test(miss.reason), miss);
  const big = await q(Object.assign({}, base, { attachments: [{ path: 'media/files/2026-11/a.txt', size: 6 * 1048576 }, { path: 'media/files/2026-11/a.txt', size: 5 * 1048576 }] }));
  expect('sizes are summed against the cap', big.ok === false && /MB/.test(big.reason), big);
  const many = await q(Object.assign({}, base, { attachments: Array.from({ length: 11 }, () => ({ path: 'media/files/2026-11/a.txt' })) }));
  expect('too many attachments', many.ok === false && /At most 10/.test(many.reason), many);
  const good = await q(Object.assign({}, base, { attachments: [{ path: 'media/files/2026-11/a.txt', name: 'Report.txt' }, { path: 'media/files/2026-11/a.txt', size: 100 }] }));
  const gj = await ev(id => FP.files.readJson(['outbox', 'email'], `${id}.json`), good.jobId);
  expect('good attachments are kept as path and name', good.ok && JSON.stringify(gj.attachments) === '[{"path":"media/files/2026-11/a.txt","name":"Report.txt"},{"path":"media/files/2026-11/a.txt","name":"a.txt"}]', gj.attachments);

  // Status and list: a simulated sender.
  const st0 = await ev(id => FP.email.status(id), r.jobId);
  expect('queued while in outbox/email', st0.state === 'queued' && st0.folder === 'outbox', st0);
  expect('unknown job', (await ev(() => FP.email.status('20260101-T01-zzzzzz'))).state === 'unknown', 'x');
  expect('a bad ID is unknown, not a path', (await ev(() => FP.email.status('../x'))).state === 'unknown', 'x');
  const move = (id, from, to) => ev(async ([id, from, to]) => { const j = await FP.files.readJson(from, `${id}.json`); await FP.files.writeJson(to, `${id}.json`, j); await FP.files.remove(from, `${id}.json`); }, [id, from, to]);
  await move(r.jobId, ['outbox', 'email'], ['outbox', 'processing']);
  expect('queued while processing', (await ev(id => FP.email.status(id), r.jobId)).state === 'queued', await ev(id => FP.email.status(id), r.jobId));
  expect('gone from outbox/email', !(await names(['outbox', 'email'])).includes(`${r.jobId}.json`), 'still there');
  await ev(id => FP.files.writeJson(['status'], `${id}.json`, { state: 'sent', at: '2026-11-24T15:00:05Z', attempts: 1, detail: 'accepted by the mail system' }), r.jobId);
  await move(r.jobId, ['outbox', 'processing'], ['outbox', 'done']);
  const st1 = await ev(id => FP.email.status(id), r.jobId);
  expect('sent, with when, attempts and detail', st1.state === 'sent' && st1.at === '2026-11-24T15:00:05Z' && st1.attempts === 1 && st1.detail === 'accepted by the mail system' && st1.folder === 'done', st1);
  // Done with no status file: done. Failed with a rejected status.
  await move(d.jobId, ['outbox', 'email'], ['outbox', 'done']);
  expect('done folder alone says done', (await ev(id => FP.email.status(id), d.jobId)).state === 'done', await ev(id => FP.email.status(id), d.jobId));
  await move(long.jobId, ['outbox', 'email'], ['outbox', 'failed']);
  expect('failed folder alone says failed', (await ev(id => FP.email.status(id), long.jobId)).state === 'failed', await ev(id => FP.email.status(id), long.jobId));
  await ev(id => FP.files.writeJson(['status'], `${id}.json`, { state: 'rejected', at: '2026-11-24T15:01:00Z', attempts: 0, detail: 'domain not approved on the host' }), ra.jobId);
  await move(ra.jobId, ['outbox', 'email'], ['outbox', 'failed']);
  expect('a rejected status wins', (await ev(id => FP.email.status(id), ra.jobId)).state === 'rejected', await ev(id => FP.email.status(id), ra.jobId));

  const rows = await ev(() => FP.email.list());
  const by = id => rows.find(x => x.jobId === id);
  expect('list has every job once, newest first', rows.length === new Set(rows.map(x => x.jobId)).size && rows.every((x, i) => i === 0 || rows[i - 1].jobId >= x.jobId), rows.map(x => x.jobId));
  expect('list rows say sent / queued / failed / rejected', by(r.jobId).state === 'sent' && by(d.jobId).state === 'done' && by(long.jobId).state === 'failed' && by(ra.jobId).state === 'rejected' && by(good.jobId).state === 'queued', rows.map(x => [x.jobId, x.state]));
  expect('list rows carry subject and recipients', by(r.jobId).subject === base.subject && by(r.jobId).to.length === 1 && by(r.jobId).cc.length === 1 && by(r.jobId).folder === 'done', by(r.jobId));
  // The cap: the newest 200.
  await ev(async () => { for (let i = 0; i < 205; i++) await FP.files.writeJson(['outbox', 'done'], `20260101-T09-${String(i).padStart(6, '0')}.json`, { version: 1, action: 'email', to: [], subject: 'old ' + i }); });
  const capped = await ev(() => FP.email.list());
  expect('list is capped at 200, newest kept', capped.length === 200 && capped[0].jobId.startsWith('20261124') && !capped.some(x => x.jobId === '20260101-T09-000000'), [capped.length, capped[0].jobId]);
  errs.forEach(x => bad.push('page: ' + x));
  console.log('errs      :', JSON.stringify(bad));
  await A.b.close();
  if (bad.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
