// 0.57 The script is gone. Everything it could set has a control: a field's starting value typed the way the
// field takes it, options as lines ("P = Pass"), a table's fixed rows and a card's buttons as lists of settings,
// a source's carried values; no paper layout. Help has no script chapter; Media is its own.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  await w(1500);
  const r = await p.evaluate(async () => {
    const pub = (kind, id, def) => { const cur = FP.defs.get(kind, id); return FP.defs.publish(kind, id, Object.assign({ sites: ['all'] }, kind === 'form' ? { sources: [] } : {}, def), { basedOn: cur ? cur.version : null, note: 'l87' }); };
    const out = {};
    out.gone = `FP.script ${typeof FP.script}; help chapters ${FP.help.chapters().map(c => c.id).join(', ')}`;
    await pub('structure', 'zz-runs', { label: 'Runs', kind: 'runs', roles: { ended: 'endAt' }, itemId: { made: 'entered' }, containers: { line: {}, endAt: {} } });
    await pub('structure', 'zz-racks', { label: 'Racks', kind: 'records', itemId: { made: 'new' }, containers: { line: {}, pieces: {}, made: {} } });
    const base = {
      title: 'Edit test',
      sources: [
        { name: 'run', kind: 'item', structure: 'zz-runs', id: { field: 'runId' }, values: { line: 'read' }, carry: { to: 'rack', values: ['line'] } },
        { name: 'rack', kind: 'item', structure: 'zz-racks', id: { generate: true }, values: { line: 'write', pieces: 'write', made: 'write' } }],
      fields: [
        { name: 'runId', control: 'text', label: 'Run' },
        { name: 'n', control: 'number', label: 'Pieces', writes: 'rack.pieces', default: 12 },
        { name: 'c', control: 'choice', label: 'Result', options: ['P', 'F'], default: 'P' },
        { name: 't', control: 'toggle', label: 'Gauge ok' },
        { name: 'tbl', control: 'table', label: 'Walls', rows: ['top', { key: 'side', label: 'Side wall' }], columns: [{ name: 'v', control: 'number' }] }],
      buttons: [{ name: 'save', label: 'Save', action: 'save' }] };
    await pub('form', 'zz-edit', base);
    // Refused now: a paper layout, script comments, a card button that isn't a set of settings, a fixed row that isn't.
    const refuse = async (what, d) => FP.forms.check(d).filter(x => /print|comments|actions|rows/i.test(x)).slice(0, 1).join('') || `${what}: TOOK`;
    out.refused = [
      await refuse('paper layout', Object.assign({}, base, { print: { layout: [['n 6']] } })),
      await refuse('comments', Object.assign({}, base, { comments: { 1: '# hi' } })),
      await refuse('card button', Object.assign({}, base, { fields: base.fields.concat([{ name: 'cards', control: 'buttons', label: 'Cards', formula: 'LIST(1)', detail: 'item', actions: ['open it'] }]) })),
      await refuse('fixed row', Object.assign({}, base, { fields: base.fields.map(f => (f.name === 'tbl' ? Object.assign({}, f, { rows: [5] }) : f)) })),
    ].join(' | ');
    out.cardsOk = FP.forms.check(Object.assign({}, base, { fields: base.fields.concat([{ name: 'cards', control: 'buttons', label: 'Cards', formula: 'LIST(1)', detail: 'item', actions: [{ label: 'Open', form: 'zz-edit', prefill: { runId: 'item' } }] }]) })).join(' | ') || 'card buttons as settings: ok';
    return out;
  });
  say('gone', r.gone);
  say('refused', r.refused);
  say('cards', r.cardsOk);
  // The editor: no Script tab or { } icon; each setting a proper control.
  await p.locator('.fpe-mrow:has(span:text-is("Edit test"))').first().click({ timeout: 5000 }).catch(e => say('row', e.message.slice(0, 60))); await w(2500);
  say('tabs', await p.evaluate(() => Array.from(document.querySelectorAll('.fpe-panel button')).map(x => x.textContent.trim()).filter(t => /^(Script|\{ \}|Edit|History)$/.test(t)).join(', ') || 'none'));
  const props = async key => { await p.click(`.ffm-r[data-key="${key}"]`).catch(e => say('row ' + key, e.message.slice(0, 60))); await w(900); };
  const startInput = () => p.evaluate(() => { const l = Array.from(document.querySelectorAll('.ffm-props label.ffe-set')).find(x => /^Starting value\b/.test(x.textContent)); if (!l) return 'none'; const i = l.querySelector('input, select, textarea'); return i ? `${i.tagName.toLowerCase()}${i.type ? ' ' + i.type : ''} = ${i.value}` + (i.tagName === 'SELECT' ? ` [${Array.from(i.options).map(o => o.textContent).join(', ')}]` : '') : 'no input'; });
  await props('f:n'); say('start: number', await startInput());
  await props('f:c'); say('start: choice', await startInput());
  // Options as lines: "P = Pass" gives a value with its own label.
  await p.evaluate(() => { const l = Array.from(document.querySelectorAll('.ffm-props label.ffe-set')).find(x => /^Options\b/.test(x.textContent)); const t = l.querySelector('textarea'); t.value = 'P = Pass\nF = Fail\nRetest'; t.dispatchEvent(new Event('input', { bubbles: true })); });
  await w(600);
  await p.evaluate(() => { const l = Array.from(document.querySelectorAll('.ffm-props label.ffe-set')).find(x => /^Starting value\b/.test(x.textContent)); l.querySelector('select').dispatchEvent(new Event('focus')); });
  say('start: choice after', await startInput());
  await props('f:t'); say('start: toggle', await startInput());
  await props('f:tbl');
  say('fixed rows', await p.evaluate(() => { const l = Array.from(document.querySelectorAll('.ffm-props .ffe-set')).find(x => /^Fixed rows\b/.test(x.textContent)); if (!l) return 'none'; const cards = l.querySelectorAll('.ffe-li'); return `${cards.length} cards: ` + Array.from(cards).map(c => Array.from(c.querySelectorAll('input')).map(i => i.value).filter(Boolean).join('/')).join(', ') + (l.querySelector('textarea') ? ' · JSON box' : ''); }));
  await props('s:run');
  say('carry', await p.evaluate(() => { const l = Array.from(document.querySelectorAll('.ffm-props .ffe-set')).find(x => /^Carries onto the record\b/.test(x.textContent)); if (!l) return 'none'; const c = l.querySelector('.ffe-li'); if (!c) return 'no cards'; const onto = c.querySelector('select'); const ins = Array.from(c.querySelectorAll('input')).map(i => i.value); return `onto ${onto && onto.value} · values ${ins.join(' ← ')}` + (l.querySelector('textarea') ? ' · JSON box' : ''); }));
  // Change it: carry the line, and made as a formula, onto the rack.
  await p.evaluate(() => { const l = Array.from(document.querySelectorAll('.ffm-props .ffe-set')).find(x => /^Carries onto the record\b/.test(x.textContent)); const add = Array.from(l.querySelectorAll('.ffe-li button')).find(x => x.textContent.trim() === 'Add'); if (add) add.click(); });
  await w(400);
  await p.evaluate(() => { const l = Array.from(document.querySelectorAll('.ffm-props .ffe-set')).find(x => /^Carries onto the record\b/.test(x.textContent)); const rows = l.querySelectorAll('.ffe-li .fpe-row'); const last = rows[rows.length - 1]; const [k, v] = last.querySelectorAll('input'); k.value = 'made'; k.dispatchEvent(new Event('input', { bubbles: true })); v.value = '= 10 + 5'; v.dispatchEvent(new Event('input', { bubbles: true })); });
  await w(2500);
  const draft = await p.evaluate(async () => { const d = await FP.defs.drafts.get('form', 'zz-edit'); return d ? d.def : null; });
  say('draft', draft ? `options ${JSON.stringify(draft.fields.find(f => f.name === 'c').options)} · rows ${JSON.stringify(draft.fields.find(f => f.name === 'tbl').rows)} · carry ${JSON.stringify(draft.sources[0].carry)}` : 'FAIL no draft');
  say('draft check', await p.evaluate(async () => { const d = await FP.defs.drafts.get('form', 'zz-edit'); return FP.forms.check(d.def).join(' | ') || 'no problems'; }));
  // Publish it, and save one: the rack gets the run's line and the carried formula.
  await p.click('.fpe-foot button:has-text("Publish"), button.primary:has-text("Publish")').catch(e => say('publish', e.message.slice(0, 60))); await w(2500);
  say('saved', await p.evaluate(async () => {
    await FP.entry.record({ entry: 'zz-runs.start', item: { structure: 'zz-runs', id: 'R1' }, form: { id: 'test', version: 1 }, values: { line: 'L4' } });
    await FP.outbox.flush(); FP.current.clearCache();
    document.body.innerHTML = '<div id="bench"></div>';
    const f = await FP.forms.open(document.getElementById('bench'), 'zz-edit', { draft: false });
    f.set('runId', 'R1'); await new Promise(r => setTimeout(r, 1500));
    await f.press('save'); await FP.outbox.flush(); FP.current.clearCache();
    const racks = await FP.current.load('zz-racks', { fresh: true });
    const it = Array.from(racks.items.values())[0];
    return it ? `rack line ${it.values.line}, pieces ${it.values.pieces}, made ${it.values.made}` : 'FAIL no rack';
  }));
  // Help: Media is its own chapter, no script.
  say('help', await p.evaluate(() => { const html = FP.help.exportHtml(); return `media chapter ${/<h2[^>]*>Media/.test(html) || html.includes('Media')} · mentions the script ${/the script/i.test(html)}`; }));
  say('errs', JSON.stringify(errs).slice(0, 400));
  await b.close();
})();
