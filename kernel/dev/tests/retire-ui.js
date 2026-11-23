// Shared by l173 to l175: a fresh folder with the Test pack, then a few definitions that use each other (zz-*), and helpers
// that drive the editor's own buttons. Not a test (the runner only picks up lNN.js).
const fs = require('fs'), path = require('path');
const PACK = fs.readFileSync(path.join(__dirname, '../packs/test-pack/test-pack.json'), 'utf8');
exports.setup = async A => {
  await A.p.evaluate(async text => {
    await FP.packs.install(FP.packs.read(text));
    const pub = (kind, id, def) => FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, def), {});
    const S = (label, extra) => Object.assign({ label, kind: 'records', containers: { a: {} } }, extra);
    const F = (title, st, extra) => Object.assign({ title, sources: [{ name: 'r', kind: 'item', structure: st, id: { generate: true }, values: { a: 'write' } }], fields: [{ name: 'a', control: 'text', writes: 'r.a', required: true }] }, extra);
    const withFields = (title, st, more) => F(title, st, { fields: [{ name: 'a', control: 'text', writes: 'r.a', required: true }].concat(more) });
    const value = (name, formula) => ({ name, control: 'value', label: name, formula });
    const opens = (title, st, target, more) => withFields(title, st, [{ name: 'go', control: 'buttons', label: 'Go', formula: 'SORT(r, "x")', caption: '"Open"', form: target }].concat(more || []));
    const fn = (name, label) => pub('function', name, { label, output: 'number', inputs: [{ name: 'x', type: 'number', required: false }], formula: 'COALESCE(x, 0) * 2' });
    await pub('structure', 'zz-st', S('Zz things'));
    await pub('structure', 'zz-st2', S('Zz other things'));
    await fn('ZzTwice', 'Twice'); await fn('ZzOnly', 'Only the opener');
    await pub('form', 'zz-a', F('Zz A', 'zz-st'));
    await pub('form', 'zz-b', withFields('Zz B', 'zz-st', [value('d', 'ZzTwice(1)')]));
    await pub('form', 'zz-c', F('Zz C', 'zz-st2'));
    await pub('form', 'zz-opener', opens('Zz Opener', 'zz-st', 'zz-a', [value('d', 'ZzTwice(1)'), value('e', 'ZzOnly(1)')]));
    if (FP.outbox) await FP.outbox.flush();
    await FP.editor.refreshMap();
  }, PACK);
};
// Sign in as another person on this page (as l170 does): a publisher who is not an admin, or a supervisor.
exports.signInAs = async (A, name, roles) => {
  await A.p.evaluate(async ([name, roles]) => {
    const josh = (await FP.users.list(true)).find(u => u.name === 'Josh').id;   // an admin makes people
    await FP.users.signOut('test'); await FP.users.signIn(josh, '482913');
    let id = ((await FP.users.list(true)).find(u => u.name === name) || {}).id;
    if (!id) { id = await FP.users.create({ name, roles, tempPin: '918273' }); await FP.users.changePin(id, '918273', '735194'); }
    await FP.users.signOut('test'); await FP.users.signIn(id, '735194');
    await FP.editor.refreshMap();
  }, [name, roles]);
};
exports.signInAdmin = async A => {
  await A.p.evaluate(async () => {
    const josh = (await FP.users.list(true)).find(u => u.name === 'Josh').id;
    await FP.users.signOut('test'); await FP.users.signIn(josh, '482913');
    await FP.editor.refreshMap();
  });
};
// Open a definition's pane as a click on the map row would, and wait for it.
exports.openPane = async (A, kind, id) => {
  await A.p.evaluate(([k, i]) => FP.editor.openDef(k, i, { force: true, fresh: true }), [kind, id]);
  await A.w(900);
};
exports.dlgText = A => A.p.evaluate(() => { const d = document.querySelector('.fpe-dlg'); return d ? d.innerText : null; });
exports.toastText = A => A.p.evaluate(() => Array.from(document.querySelectorAll('.fpe-msg')).map(x => x.textContent).join(' | '));
