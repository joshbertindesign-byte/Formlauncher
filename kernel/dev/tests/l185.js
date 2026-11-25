// 0.69 Email, step 1: the approved-domain list and the address check. checkAddress takes exactly one plain address and matches the
// part after the @ against the list whole and case-insensitively: evilcompany.com is not company.com, a subdomain is not its parent,
// several addresses, display names and odd forms are refused, an empty list approves nothing. The list is a built-in structure that
// only an admin changes (every change is an entry), and domains are kept lower-case, validated and unique.
const start = require('./dummies/base.js');
(async () => {
  const bad = [];
  const expect = (what, ok, got) => { if (!ok) bad.push(`${what}: ${typeof got === 'string' ? got : JSON.stringify(got)}`); };
  const A = await start({ seed: 'dummies/snap15b.json', at: '2026-11-24T09:00:00-06:00' });
  const { p, w, errs } = A;
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const ev = (fn, arg) => p.evaluate(fn, arg);

  // The list: empty at first, set by an admin, lower-cased, kept as one entry per change.
  expect('list starts empty', JSON.stringify(await ev(() => FP.email.domains(true))) === '[]', await ev(() => FP.email.domains(true)));
  const set = await ev(async () => FP.email.setDomains(['Company.com', ' plant.company.com ']));
  expect('stored lower-case, trimmed', JSON.stringify(set) === '["company.com","plant.company.com"]', set);
  expect('read back', JSON.stringify(await ev(() => FP.email.domains(true))) === '["company.com","plant.company.com"]', await ev(() => FP.email.domains(true)));
  const entries = () => ev(async () => (await FP.current.load('approved-domains', { fresh: true, history: true })).rows.length);
  const n1 = await entries();
  await ev(() => FP.email.setDomains(['company.com', 'plant.company.com']));
  expect('same list writes nothing', (await entries()) === n1, n1);
  await ev(() => FP.email.setDomains(['company.com', 'plant.company.com', 'partner.org']));
  expect('a change is another entry (history stays)', (await entries()) === n1 + 1, [n1, await entries()]);
  const refuse = list => ev(async l => { try { await FP.email.setDomains(l); return null; } catch (e) { return e.message; } }, list);
  const dup = await refuse(['a.com', 'A.com']);
  expect('twice is refused', /listed twice/.test(dup || ''), dup);
  for (const x of ['x@company.com', 'two words.com', '*.company.com', 'company', '', '.com', 'a..com', '-a.com', 'a.com.', 'http://a.com']) {
    expect(`domain "${x}" is refused`, !!(await refuse([x])), x);
  }
  expect('a refused change left the list alone', JSON.stringify(await ev(() => FP.email.domains(true))) === '["company.com","plant.company.com","partner.org"]', await ev(() => FP.email.domains(true)));
  expect('checkDomain lower-cases', (await ev(() => FP.email.checkDomain(' Company.COM '))).domain === 'company.com', 'x');

  // The address check.
  const L = ['company.com', 'partner.org'];
  const chk = (t, l) => ev(([t, l]) => FP.email.checkAddress(t, l), [t === undefined ? null : t, l === undefined ? L : l]);
  const ok = async (t, want) => { const r = await chk(t); expect(`ok: ${JSON.stringify(t)}`, r.ok && (!want || r.address === want), r); };
  const no = async (t, l) => { const r = await chk(t, l); expect(`refused: ${JSON.stringify(t)}`, r.ok === false && typeof r.problem === 'string' && r.problem.length > 0, r); };
  await ok('maria@company.com', 'maria@company.com');
  await ok('  Maria.Lopez+qa@Company.COM  ', 'Maria.Lopez+qa@company.com');
  await ok('o\'brien@partner.org');
  await ok('maria@company.com\n', 'maria@company.com');   // a trailing newline is only whitespace
  // Exact match on the host: never "ends with".
  await no('x@evilcompany.com'); await no('x@company.com.evil.com'); await no('x@notcompany.com');
  await no('x@plant.company.com');                       // a subdomain is not its parent...
  expect('...unless it is listed', (await chk('x@plant.company.com', ['plant.company.com'])).ok === true, 'no');
  expect('the parent is not its subdomain', (await chk('x@company.com', ['plant.company.com'])).ok === false, 'ok');
  // Several addresses.
  await no('a@company.com;b@evil.com'); await no('a@company.com,b@evil.com'); await no('a@company.com b@company.com'); await no('a@company.com; b@company.com');
  await no('a@company.com@evil.com'); await no('a@evil.com@company.com');
  // Display names and other forms.
  await no('"Maria" <maria@company.com>'); await no('Maria <maria@company.com>'); await no('<maria@company.com>'); await no('maria@company.com (Maria)');
  await no('"a@evil.com"@company.com'); await no('maria@[10.0.0.1]'); await no('mailto:maria@company.com');
  // Things that do not parse.
  for (const t of ['', '   ', 'maria', '@company.com', 'maria@', 'ma..ria@company.com', '.maria@company.com', 'maria.@company.com', 'maria@company', 'maria@-company.com', 'maria@com pany.com', 'a\nb@company.com', 'maria@compañy.com', 'mariá@company.com', 5, null]) await no(t);
  // An empty list approves nothing.
  await no('maria@company.com', []);
  const e = await chk('maria@company.com', []);
  expect('empty list says so', /list is empty/.test(e.problem), e);
  const o = await chk('x@other.com');
  expect('problem names the approved domains', /approved: company\.com, partner\.org/.test(o.problem), o.problem);
  // With no list given, the one last read is used; checkAddressNow reads it.
  await ev(() => FP.email.domains(true));
  expect('default list is the last read', (await ev(() => FP.email.checkAddress('a@partner.org'))).ok === true, 'no');
  expect('checkAddressNow reads the list', (await ev(() => FP.email.checkAddressNow('a@plant.company.com'))).ok === true, 'no');
  // An empty list is allowed.
  expect('an empty list can be saved', JSON.stringify(await ev(() => FP.email.setDomains([]))) === '[]', 'x');
  expect('and reads back empty', JSON.stringify(await ev(() => FP.email.domains(true))) === '[]', await ev(() => FP.email.domains(true)));
  await ev(() => FP.email.setDomains(['company.com', 'plant.company.com', 'partner.org']));

  // Admin only.
  await ev(async () => { const id = await FP.users.create({ name: 'Pat Operator', roles: ['user'], tempPin: '918273' }); await FP.users.changePin(id, '918273', '735194'); await FP.users.signOut(); await FP.users.signIn(id, '735194'); });
  const who = await ev(async () => (await FP.users.current()).name);
  expect('signed in as the plain user', who === 'Pat Operator', who);
  const r = await refuse(['evil.com']);
  expect('a plain user cannot change the list', /Only an admin/.test(r || ''), r);
  expect('list unchanged', JSON.stringify(await ev(() => FP.email.domains(true))) === '["company.com","plant.company.com","partner.org"]', await ev(() => FP.email.domains(true)));
  expect('a plain user can read it', (await ev(() => FP.email.domains())).length === 3, 'x');
  errs.forEach(x => bad.push('page: ' + x));
  console.log('errs      :', JSON.stringify(bad));
  await A.b.close();
  if (bad.length) process.exit(1);
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
