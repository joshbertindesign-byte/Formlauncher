// F35: charts. A line chart of 200,000 points (Math.min(...ys) used to throw past about 100,000), a Pareto whose
// counts are all zero (no NaN widths), and statuses named constructor / __proto__ (they must not hit Object.prototype).
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1500);
  const r = await p.evaluate(async () => {
    const out = {}; const bad = [];
    // Test data comes in through the formula evaluator, standing in for a very long lookup.
    const real = FP.fn.evaluate;
    const N = 200000, t0 = Date.parse('2026-11-01T00:00:00Z');
    const data = {
      'RANGE(1, 11)': () => Array.from({ length: N }, (_, i) => ({ $at: new Date(t0 + i * 1000).toISOString(), v: (i * 7919) % 1000 })),
      'RANGE(1, 12)': () => [{ cat: 'a', n: 0 }, { cat: 'b', n: 0 }, { cat: 'c', n: 0 }],
      'RANGE(1, 13)': () => ['constructor', '__proto__', 'ok', 'toString', 'hasOwnProperty'].map((s, i) => ({ id: 'T' + i, $status: s })),
    };
    FP.fn.evaluate = function (fx, ...rest) { return typeof fx === 'string' && data[fx] ? data[fx]() : real.call(this, fx, ...rest); };
    const open = async (id, field, mark) => {
      const host = document.createElement('div'); host.style.width = '700px'; document.body.appendChild(host);
      try { await FP.forms.open(host, id, { draft: false, def: { title: id, sites: ['all'], sources: [{ name: 'src', kind: 'value', formula: mark }], fields: [field] } }); } catch (e) { bad.push(id + ' open: ' + e.message); }
      await new Promise(r => setTimeout(r, 1500));
      return host;
    };
    try {
      let h = await open('l143-line', { name: 'c', control: 'chart', label: 'Big', formula: 'src', type: 'line', y: 'v', x: '$at', aggregate: 'none' }, 'RANGE(1, 11)');
      out.line = `${h.querySelectorAll('svg path, svg polyline').length} svg lines · ${(h.innerText || '').replace(/\s+/g, ' ').slice(0, 80)}`;
      if (!h.querySelector('svg')) bad.push('200k-point line chart did not draw: ' + out.line);
      h = await open('l143-zero', { name: 'c', control: 'pareto', label: 'Zeros', formula: 'src', category: 'cat', count: 'n' }, 'RANGE(1, 12)');
      const widths = Array.from(h.querySelectorAll('.fpv-pb i')).map(i => i.style.width);
      out.zero = `${widths.length} bars, widths ${widths.join(',')} · ${(h.innerText || '').replace(/\s+/g, ' ').slice(0, 120)}`;
      if (!widths.length || widths.some(x => !x || /NaN/.test(x)) || /NaN/.test(h.innerText)) bad.push('all-zero pareto: ' + out.zero);
      h = await open('l143-board', { name: 'c', control: 'board', label: 'Tiles', formula: 'src', colors: { ok: 'warn' } }, 'RANGE(1, 13)');
      const tiles = h.querySelectorAll('.fpv-tile').length, flags = h.querySelectorAll('.fpv-flag');
      out.board = `${tiles} tiles, ${flags.length} flags (${Array.from(flags).map(f => f.textContent).join('')})`;
      if (tiles !== 5 || flags.length !== 1 || flags[0].textContent !== '!') bad.push('statuses named like Object.prototype members: ' + out.board);
    } catch (e) { bad.push('ERROR ' + e.message); }
    FP.fn.evaluate = real;
    out.bad = bad;
    return out;
  });
  Object.entries(r).forEach(([k, v]) => say(k, v));
  say('errs', JSON.stringify(errs));
  await b.close();
  if (r.bad.length || (errs && errs.length)) { console.log('FAILED'); process.exit(1); }
})();
