/* Form Platform kernel: formulas, functions and summary rules (step 5)
 * Load after fp-core.js. No eval, no new Function: formulas are parsed into a
 * tree and walked by a small interpreter that can only read its inputs and call
 * whitelisted functions.
 *
 * Formula language (Excel-style):
 *   numbers 1.25   text "Pass"   TRUE FALSE   WAITING
 *   + - * / ^   & (join text)   = <> < > <= >=   ( )
 *   inputs by name: measuredOD, spec.min (a field of a record input)
 *   built-ins: IF AND OR NOT ISBLANK COALESCE ROUND ABS MIN MAX SUM AVERAGE COUNT
 *              INRANGE DATEDIFF TODAY NOW LEN UPPER LOWER LEFT RIGHT CONCAT
 *              (0.43) DATEADD STARTOF TEXT USER FIRST LAST INDEX, and more: see HELP below
 *   library functions by their name: InSpec(measuredOD, spec.min, spec.max)
 *
 * Special results:
 *   Waiting  - a required input is blank. Shown gray, never 0 or Fail.
 *   No data  - a summary over no entries (latest, first, average, min, max).
 *   Error    - something is genuinely wrong (divide by zero, wrong type).
 * Blank (null) passes through arithmetic and comparisons as blank.
 *
 * TODAY() and NOW() read the form's as-of time, never the wall clock, so the
 * same inputs always give the same answer.
 */
(function () {
  'use strict';

  const FP = (window.FP = window.FP || {});

  /* ---------- Special values ---------- */
  const WAITING = Object.freeze({ __fp: 'waiting' });
  const NODATA = Object.freeze({ __fp: 'nodata' });
  const err = message => ({ __fp: 'error', message });
  const special = v => v != null && typeof v === 'object' && typeof v.__fp === 'string';
  const isWaiting = v => special(v) && v.__fp === 'waiting';
  const isError = v => special(v) && v.__fp === 'error';
  const isBlank = v => v == null || v === '';
  const waitingFor = names => ({ __fp: 'waiting', missing: names });

  /* ---------- Tokenizer ---------- */
  const OPS = ['<>', '<=', '>=', '+', '-', '*', '/', '^', '&', '=', '<', '>', '(', ')', ',', '[', ']'];

  function tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        const m = src.slice(i).match(/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/);
        out.push({ t: 'num', v: Number(m[0]), at: i }); i += m[0].length; continue;
      }
      if (ch === '"') {
        let j = i + 1, s = '';
        while (j < src.length) {
          if (src[j] === '"' && src[j + 1] === '"') { s += '"'; j += 2; continue; }
          if (src[j] === '"') break;
          s += src[j++];
        }
        if (j >= src.length) throw new SyntaxError(`Text starting at position ${i + 1} is missing its closing "`);
        out.push({ t: 'str', v: s, at: i }); i = j + 1; continue;
      }
      // Names: a field, a source, an item's fact ($status), and what is inside them (rack.qty, rack.$id).
      if (/[A-Za-z_$]/.test(ch)) {
        const m = src.slice(i).match(/^[A-Za-z_$][A-Za-z0-9_]*(\.[A-Za-z_$][A-Za-z0-9_]*)*/);
        out.push({ t: 'name', v: m[0], at: i }); i += m[0].length; continue;
      }
      // A field of a result: CurrentSpec(profile).max, racks["R-1"].qty
      if (ch === '.' && /[A-Za-z_$]/.test(src[i + 1] || '') && out.length && out[out.length - 1].t === 'op' && (out[out.length - 1].v === ')' || out[out.length - 1].v === ']')) {
        out.push({ t: 'op', v: '.', at: i }); i++; continue;
      }
      const op = OPS.find(o => src.startsWith(o, i));
      if (op) { out.push({ t: 'op', v: op, at: i }); i += op.length; continue; }
      throw new SyntaxError(`Unexpected "${ch}" at position ${i + 1}`);
    }
    out.push({ t: 'end', at: src.length });
    return out;
  }

  /* ---------- Parser (precedence climbing) ---------- */
  const BINARY = { '=': 1, '<>': 1, '<': 1, '>': 1, '<=': 1, '>=': 1, '&': 2, '+': 3, '-': 3, '*': 4, '/': 4, '^': 5 };

  /* How deep a formula may nest (0.53, found by the stress test): deeper ones are refused with a message, where
   * they used to run the browser out of stack (a formula of 20,000 terms threw instead of answering). */
  const MAX_NEST = 200;
  const TOO_DEEP = `This formula is nested more than ${MAX_NEST} deep (or is a chain of more than ${MAX_NEST} terms): split it into fields or functions`;
  function depthOf(tree) {
    let deepest = 0;
    const stack = [[tree, 1]];
    while (stack.length) {
      const [n, d] = stack.pop();
      if (!n || typeof n !== 'object') continue;
      if (d > deepest) deepest = d;
      if (deepest > MAX_NEST) return deepest;
      [n.a, n.b, n.key].concat(n.args || []).forEach(x => { if (x) stack.push([x, d + 1]); });
    }
    return deepest;
  }
  function parse(src) {
    let tree;
    try { tree = parseRaw(src); }
    catch (e) { if (e instanceof RangeError) throw new SyntaxError(TOO_DEEP); throw e; }
    if (depthOf(tree) > MAX_NEST) throw new SyntaxError(TOO_DEEP);
    return tree;
  }
  function parseRaw(src) {
    if (typeof src !== 'string' || !src.trim()) throw new SyntaxError('The formula is empty');
    const toks = tokenize(src.trim().replace(/^=/, ''));
    let p = 0;
    const peek = () => toks[p];
    const next = () => toks[p++];
    const expect = (v, what) => {
      const t = next();
      if (t.t !== 'op' || t.v !== v) throw new SyntaxError(`Expected ${what} at position ${t.at + 1}`);
    };

    function primary() {
      const t = next();
      if (t.t === 'num') return { k: 'lit', v: t.v };
      if (t.t === 'str') return { k: 'lit', v: t.v };
      if (t.t === 'op' && t.v === '(') { const e = expr(0); expect(')', 'a closing )'); return e; }
      if (t.t === 'op' && (t.v === '-' || t.v === '+')) return { k: 'neg', sign: t.v, a: unary() };
      if (t.t === 'name') {
        const up = t.v.toUpperCase();
        if (peek().t === 'op' && peek().v === '(') {
          next();
          const args = [];
          if (!(peek().t === 'op' && peek().v === ')')) {
            do { args.push(expr(0)); } while (peek().t === 'op' && peek().v === ',' && next());
          }
          expect(')', `a closing ) for ${t.v}`);
          return { k: 'call', name: t.v, args, at: t.at };
        }
        if (up === 'TRUE') return { k: 'lit', v: true };
        if (up === 'FALSE') return { k: 'lit', v: false };
        if (up === 'WAITING') return { k: 'lit', v: WAITING };
        return { k: 'ref', name: t.v, at: t.at };
      }
      if (t.t === 'end') throw new SyntaxError('The formula ends too early');
      throw new SyntaxError(`Unexpected "${t.v}" at position ${t.at + 1}`);
    }
    function unary() {
      let n = primary();
      for (;;) {
        if (peek().t === 'op' && peek().v === '.') {
          next();
          const f = next();
          if (f.t !== 'name') throw new SyntaxError(`Expected a field name at position ${f.at + 1}`);
          f.v.split('.').forEach(part => { n = { k: 'field', a: n, name: part }; });
        } else if (peek().t === 'op' && peek().v === '[') {
          // One item of a list by its ID: racks["R-1042"], racks[rackId]
          next();
          const key = expr(0);
          expect(']', 'a closing ]');
          n = { k: 'index', a: n, key };
        } else break;
      }
      return n;
    }
    function expr(minPrec) {
      let left = unary();
      for (;;) {
        const t = peek();
        if (t.t !== 'op' || !(t.v in BINARY) || BINARY[t.v] < minPrec) break;
        next();
        const prec = BINARY[t.v];
        const right = expr(t.v === '^' ? prec : prec + 1);
        left = { k: 'bin', op: t.v, a: left, b: right };
      }
      return left;
    }
    const tree = expr(0);
    if (peek().t !== 'end') throw new SyntaxError(`Unexpected "${peek().v}" at position ${peek().at + 1}`);
    return tree;
  }

  /* ---------- Built-in functions ----------
   * lazy: receives unevaluated args and an evaluator (for IF/AND/OR/ISBLANK/COALESCE).
   * out: result type for type checking; min/max: argument count. */
  const num = v => (typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) ? Number(v) : NaN));
  const flat = args => args.reduce((a, v) => a.concat(Array.isArray(v) ? v : [v]), []);
  const numbersOf = args => flat(args).filter(v => !isBlank(v) && !special(v)).map(num);
  const timeOf = v => (v instanceof Date ? v.getTime() : Date.parse(v));

  const LAMBDA = new Set(['FILTER', 'EACH', 'SORT']);
  const BUILTINS = {
    IF: { min: 2, max: 3, lazy: true, out: 'any', fn: (a, ev) => {
      const c = ev(a[0]);
      if (special(c)) return c;
      if (isBlank(c)) return null;
      return c ? ev(a[1]) : (a.length > 2 ? ev(a[2]) : false);
    } },
    AND: { min: 1, max: 99, lazy: true, out: 'boolean', fn: (a, ev) => {
      for (const x of a) { const v = ev(x); if (special(v)) return v; if (isBlank(v)) return null; if (!v) return false; }
      return true;
    } },
    OR: { min: 1, max: 99, lazy: true, out: 'boolean', fn: (a, ev) => {
      let blank = false;
      for (const x of a) { const v = ev(x); if (special(v)) return v; if (isBlank(v)) { blank = true; continue; } if (v) return true; }
      return blank ? null : false;
    } },
    NOT: { min: 1, max: 1, out: 'boolean', fn: a => (isBlank(a[0]) ? null : !a[0]) },
    // No data (a lookup that found nothing, an item not saved yet) counts as blank here, so IF(ISBLANK(x), …) can say so.
    ISBLANK: { min: 1, max: 1, lazy: true, out: 'boolean', fn: (a, ev) => { const v = ev(a[0]); return isBlank(v) || isWaiting(v) || (special(v) && v.__fp === 'nodata'); } },
    COALESCE: { min: 1, max: 99, lazy: true, out: 'any', fn: (a, ev) => {
      for (const x of a) { const v = ev(x); if (!isBlank(v) && !isWaiting(v) && !(special(v) && v.__fp === 'nodata')) return v; }
      return null;
    } },
    ROUND: { min: 1, max: 2, out: 'number', fn: a => {
      if (isBlank(a[0])) return null;
      const d = a.length > 1 ? num(a[1]) : 0, f = Math.pow(10, d), v = num(a[0]);
      return isNaN(v) ? err('ROUND needs a number') : Math.round((v + Number.EPSILON) * f) / f;
    } },
    ABS: { min: 1, max: 1, out: 'number', fn: a => (isBlank(a[0]) ? null : Math.abs(num(a[0]))) },
    MIN: { aggregate: true, min: 1, max: 99, out: 'number', fn: a => { const n = numbersOf(a); return n.length ? Math.min.apply(null, n) : NODATA; } },
    MAX: { aggregate: true, min: 1, max: 99, out: 'number', fn: a => { const n = numbersOf(a); return n.length ? Math.max.apply(null, n) : NODATA; } },
    SUM: { aggregate: true, min: 1, max: 99, out: 'number', fn: a => numbersOf(a).reduce((s, v) => s + v, 0) },
    COUNT: { aggregate: true, min: 1, max: 99, out: 'number', fn: a => flat(a).filter(v => !isBlank(v) && !special(v)).length },
    AVERAGE: { aggregate: true, min: 1, max: 99, out: 'number', fn: a => { const n = numbersOf(a); return n.length ? n.reduce((s, v) => s + v, 0) / n.length : NODATA; } },
    INRANGE: { min: 3, max: 3, out: 'boolean', fn: a => {
      if (a.some(isBlank)) return null;
      const [v, lo, hi] = a.map(num);
      return v >= lo && v <= hi;
    } },
    DATEDIFF: { min: 2, max: 3, out: 'number', fn: a => {
      if (isBlank(a[0]) || isBlank(a[1])) return null;
      const ms = timeOf(a[1]) - timeOf(a[0]);
      if (isNaN(ms)) return err('DATEDIFF needs two dates');
      const unit = String(a[2] || 'days').toLowerCase();
      const per = { days: 864e5, hours: 36e5, minutes: 6e4 }[unit];
      return per ? ms / per : err(`DATEDIFF unit must be "days", "hours" or "minutes"`);
    } },
    TODAY: { min: 0, max: 0, out: 'date', fn: (a, ctx) => FP.util.localDate(ctx.asOf) },
    NOW: { min: 0, max: 0, out: 'date', fn: (a, ctx) => ctx.asOf.toISOString() },
    // The hour (0–23) and weekday (1 = Monday … 7 = Sunday) of a date and time, on this terminal's clock: shifts from save times.
    HOUR: { min: 1, max: 1, out: 'number', fn: a => { if (isBlank(a[0])) return null; const t = timeOf(a[0]); return isNaN(t) ? err('HOUR needs a date and time') : new Date(t).getHours() + new Date(t).getMinutes() / 60; } },
    WEEKDAY: { min: 1, max: 1, out: 'number', fn: a => { if (isBlank(a[0])) return null; const t = timeOf(a[0]); return isNaN(t) ? err('WEEKDAY needs a date') : ((new Date(t).getDay() + 6) % 7) + 1; } },
    // A list of numbers from one to another: RANGE(6, 17) is the hours of a day shift; RANGE(18, 29) a night shift's.
    RANGE: { min: 2, max: 3, out: 'list', fn: a => {
      const from = num(a[0]), to = num(a[1]), step = a.length > 2 ? num(a[2]) : 1;
      if ([from, to, step].some(isNaN) || step <= 0) return err('RANGE needs numbers, and a step above 0');
      const out = [];
      for (let x = from; x <= to + 1e-9 && out.length < 500; x += step) out.push(Math.round(x * 1e9) / 1e9);
      return out;
    } },
    // Is a value in a list? Compared as = does: numbers as numbers, text without caring about capitals.
    IN: { min: 2, max: 2, out: 'boolean', fn: a => (isBlank(a[0]) ? null : (Array.isArray(a[1]) ? a[1] : [a[1]]).some(x => compare('=', a[0], x) === true)) },
    FLOOR: { min: 1, max: 1, out: 'number', fn: a => (isBlank(a[0]) ? null : isNaN(num(a[0])) ? err('FLOOR needs a number') : Math.floor(num(a[0]))) },
    MOD: { min: 2, max: 2, out: 'number', fn: a => { if (isBlank(a[0]) || isBlank(a[1])) return null; const x = num(a[0]), y = num(a[1]); return isNaN(x) || isNaN(y) || y === 0 ? err('MOD needs two numbers, the second not 0') : ((x % y) + y) % y; } },
    LEN: { min: 1, max: 1, out: 'number', fn: a => (isBlank(a[0]) ? 0 : String(a[0]).length) },
    UPPER: { min: 1, max: 1, out: 'text', fn: a => (isBlank(a[0]) ? null : String(a[0]).toUpperCase()) },
    LOWER: { min: 1, max: 1, out: 'text', fn: a => (isBlank(a[0]) ? null : String(a[0]).toLowerCase()) },
    LEFT: { min: 2, max: 2, out: 'text', fn: a => (isBlank(a[0]) ? null : String(a[0]).slice(0, num(a[1]))) },
    RIGHT: { min: 2, max: 2, out: 'text', fn: a => (isBlank(a[0]) ? null : String(a[0]).slice(-num(a[1]))) },
    CONCAT: { aggregate: true, min: 1, max: 99, out: 'text', fn: a => flat(a).map(v => (isBlank(v) ? '' : String(v))).join('') },
    // The site of this terminal: SITE() -> "ABI".
    SITE: { min: 0, max: 0, out: 'text', fn: () => (window.FP.identity && window.FP.identity.site) || null },
    // One column of a table: PLUCK(measurements, "od") -> [1.25, 1.24]; use with SUM, AVERAGE, MIN, MAX, COUNT.
    PLUCK: { min: 2, max: 2, out: 'list', fn: a => (Array.isArray(a[0]) ? a[0].map(r => (r && typeof r === 'object' && r[a[1]] !== undefined ? r[a[1]] : null)) : null) },
    // Lists. In FILTER, EACH and SORT the second input is worked out once per item, with item standing for it:
    // FILTER(racks, item.qty > 0), EACH(racks, item.$id & " " & item.qty), SORT(racks, item.qty, "desc").
    LIST: { aggregate: true, min: 0, max: 99, out: 'list', fn: a => a.slice() },
    FILTER: { min: 2, max: 2, lazy: true, out: 'list', fn: (a, ev, ctx, evWith) => {
      const list = ev(a[0]);
      if (special(list) || isBlank(list)) return isBlank(list) ? [] : list;
      if (!Array.isArray(list)) return err('FILTER needs a list');
      const out = [];
      for (const item of list) {
        const v = evWith(a[1], { item });
        if (isError(v) || isWaiting(v)) return v;
        if (v === true) out.push(item);
      }
      return out;
    } },
    EACH: { min: 2, max: 2, lazy: true, out: 'list', fn: (a, ev, ctx, evWith) => {
      const list = ev(a[0]);
      if (special(list) || isBlank(list)) return isBlank(list) ? [] : list;
      if (!Array.isArray(list)) return err('EACH needs a list');
      const out = [];
      for (const item of list) {
        const v = evWith(a[1], { item });
        if (isError(v) || isWaiting(v)) return v;
        out.push(special(v) ? null : v);
      }
      return out;
    } },
    SORT: { min: 1, max: 3, lazy: true, out: 'list', fn: (a, ev, ctx, evWith) => {
      const list = ev(a[0]);
      if (special(list) || isBlank(list)) return isBlank(list) ? [] : list;
      if (!Array.isArray(list)) return err('SORT needs a list');
      const dir = a[2] ? ev(a[2]) : 'asc';
      if (special(dir)) return dir;
      const down = /^desc/i.test(String(dir));
      const keyed = [];
      for (const item of list) {
        const k = a[1] ? evWith(a[1], { item }) : item;
        if (isError(k) || isWaiting(k)) return k;
        keyed.push({ item, k: special(k) ? null : k });
      }
      const cmp = (x, y) => {
        if (isBlank(x) && isBlank(y)) return 0;
        if (isBlank(x)) return 1;            // blanks last, whichever way
        if (isBlank(y)) return -1;
        const nx = num(x), ny = num(y);
        const r = !isNaN(nx) && !isNaN(ny) ? nx - ny : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' });
        return down ? -r : r;
      };
      return keyed.sort((p, q) => cmp(p.k, q.k)).map(x => x.item);
    } },
    UNIQUE: { min: 1, max: 1, out: 'list', fn: a => {
      if (!Array.isArray(a[0])) return isBlank(a[0]) ? [] : err('UNIQUE needs a list');
      const seen = new Set();
      return a[0].filter(v => { const k = v && typeof v === 'object' ? JSON.stringify(v) : typeof v === 'string' ? 's:' + v.toLowerCase() : 'v:' + String(v); if (seen.has(k)) return false; seen.add(k); return true; });
    } },
    JOIN: { min: 1, max: 2, out: 'text', fn: a => {
      if (isBlank(a[0])) return '';
      const list = Array.isArray(a[0]) ? a[0] : [a[0]];
      const sep = a[1] == null ? ', ' : String(a[1]);
      return list.filter(v => !isBlank(v) && !special(v)).map(v => (v && typeof v === 'object' ? (v.$id || v.id || JSON.stringify(v)) : String(v))).join(sep);
    } },
    // 0.43: dates moved and rounded, values shown as text, the person signed in, one item of a list.
    // DATEADD(NOW(), -1, "hours"); a date alone ("2026-11-18") stays a date alone when moved by days, weeks or months.
    DATEADD: { min: 3, max: 3, out: 'date', fn: a => {
      if (isBlank(a[0]) || isBlank(a[1])) return null;
      const t = timeOf(a[0]), n = num(a[1]);
      if (isNaN(t)) return err('DATEADD needs a date');
      if (isNaN(n)) return err('DATEADD needs a number to add');
      const unit = String(a[2] || '').toLowerCase().replace(/s$/, '');
      const dayOnly = typeof a[0] === 'string' && /^\d{4}-\d\d-\d\d$/.test(a[0]);
      const d = dayOnly ? localDay(a[0]) : new Date(t);
      if (unit === 'minute') d.setTime(d.getTime() + n * 6e4);
      else if (unit === 'hour') d.setTime(d.getTime() + n * 36e5);
      else if (unit === 'day') d.setDate(d.getDate() + n);
      else if (unit === 'week') d.setDate(d.getDate() + n * 7);
      else if (unit === 'month') d.setMonth(d.getMonth() + n);
      else return err('DATEADD unit must be "minutes", "hours", "days", "weeks" or "months"');
      return dayOnly && ['day', 'week', 'month'].includes(unit) ? FP.util.localDate(d) : d.toISOString();
    } },
    // The start of the hour, day, week (Monday) or month a date and time falls in, on this terminal's clock.
    STARTOF: { min: 2, max: 2, out: 'date', fn: a => {
      if (isBlank(a[0])) return null;
      const t = timeOf(a[0]);
      if (isNaN(t)) return err('STARTOF needs a date');
      const d = typeof a[0] === 'string' && /^\d{4}-\d\d-\d\d$/.test(a[0]) ? localDay(a[0]) : new Date(t);
      const unit = String(a[1] || '').toLowerCase();
      if (unit === 'hour') d.setMinutes(0, 0, 0);
      else if (unit === 'day') d.setHours(0, 0, 0, 0);
      else if (unit === 'week') { d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); }
      else if (unit === 'month') { d.setHours(0, 0, 0, 0); d.setDate(1); }
      else return err('STARTOF unit must be "hour", "day", "week" or "month"');
      return d.toISOString();
    } },
    // A value as text: dates with yyyy yy MMMM MMM MM M dddd ddd dd d HH H hh h mm m ss AM/PM, numbers with 0 # , . %.
    TEXT: { min: 1, max: 2, out: 'text', fn: a => (isBlank(a[0]) ? '' : formatText(a[0], a.length > 1 ? a[1] : null)) },
    // The name of the person signed in on this terminal.
    USER: { min: 0, max: 0, out: 'text', fn: () => { const u = window.FP.users && window.FP.users.now ? window.FP.users.now() : null; return u ? u.name : null; } },
    // What this terminal is working on (0.60): the line it is for, or the one picked when it is for several; HERE("all") every one.
    HERE: { min: 0, max: 1, out: 'any', fn: a => {
      const h = window.FP.kinds && window.FP.kinds.here ? window.FP.kinds.here() : null;
      if (a.length && String(a[0]).toLowerCase() === 'all') return h ? h.items.slice() : [];
      return h && h.current ? h.current : null;
    } },
    FIRST: { min: 1, max: 1, out: 'any', fn: a => (Array.isArray(a[0]) ? (a[0].length ? a[0][0] : NODATA) : isBlank(a[0]) ? NODATA : a[0]) },
    LAST: { min: 1, max: 1, out: 'any', fn: a => (Array.isArray(a[0]) ? (a[0].length ? a[0][a[0].length - 1] : NODATA) : isBlank(a[0]) ? NODATA : a[0]) },
    // INDEX(list, 1) is the first; INDEX(list, -1) the last.
    INDEX: { min: 2, max: 2, out: 'any', fn: a => {
      if (!Array.isArray(a[0])) return isBlank(a[0]) ? NODATA : err('INDEX needs a list');
      const n = num(a[1]);
      if (isNaN(n) || n === 0 || Math.floor(n) !== n) return err('INDEX needs a whole number: 1 for the first, -1 for the last');
      const v = n > 0 ? a[0][n - 1] : a[0][a[0].length + n];
      return v === undefined ? NODATA : v;
    } },
  };

  /* A date alone ("2026-11-18") as local midnight, not UTC. */
  function localDay(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  /* TEXT's formatting, shared with visuals (FP.fn.format). */
  function formatText(v, f) {
    if (v && typeof v === 'object') return Array.isArray(v) ? v.map(x => formatText(x, f)).join(', ') : String(v.$id != null ? v.$id : v.id != null ? v.id : '');
    if (f == null || f === '') return typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v);
    const fs = String(f);
    const n = num(v);
    if (typeof v !== 'boolean' && !isNaN(n) && /[0#]/.test(fs) && !(typeof v === 'string' && /^\d{4}-\d\d-\d\d/.test(v))) {
      const m = /^([^0#,.%]*)([#,0]+)(?:\.(0+))?(%?)(.*)$/.exec(fs);
      if (!m) return String(v);
      const pct = m[4] === '%';
      const dec = m[3] ? m[3].length : 0;
      const x = pct ? n * 100 : n;
      const s = Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: m[2].includes(',') });
      const minInt = (m[2].replace(/[#,]/g, '').length) || 0;
      const [ip, fp] = s.split('.');
      const padded = ip.replace(/,/g, '').length < minInt ? ip.padStart(minInt, '0') : ip;
      return (x < 0 && Math.round(Math.abs(x) * Math.pow(10, dec)) !== 0 ? '-' : '') + m[1] + padded + (fp != null ? '.' + fp : '') + (pct ? '%' : '') + m[5];
    }
    if (typeof v !== 'string' && !(v instanceof Date)) return String(v);
    const t = timeOf(v);
    if (isNaN(t) || (typeof v === 'string' && !/^\d{4}-\d\d-\d\d/.test(v))) return String(v);
    const d = typeof v === 'string' && /^\d{4}-\d\d-\d\d$/.test(v) ? localDay(v) : new Date(t);
    const two = x => String(x).padStart(2, '0');
    const h12 = d.getHours() % 12 || 12;
    const map = {
      yyyy: String(d.getFullYear()), yy: two(d.getFullYear() % 100), MMMM: MONTHS[d.getMonth()], MMM: MONTHS[d.getMonth()].slice(0, 3), MM: two(d.getMonth() + 1), M: String(d.getMonth() + 1),
      dddd: DAYS[d.getDay()], ddd: DAYS[d.getDay()].slice(0, 3), dd: two(d.getDate()), d: String(d.getDate()),
      HH: two(d.getHours()), H: String(d.getHours()), hh: two(h12), h: String(h12), mm: two(d.getMinutes()), m: String(d.getMinutes()), ss: two(d.getSeconds()),
      'AM/PM': d.getHours() < 12 ? 'AM' : 'PM', AM: d.getHours() < 12 ? 'AM' : 'PM', PM: d.getHours() < 12 ? 'AM' : 'PM', A: d.getHours() < 12 ? 'AM' : 'PM',
    };
    return fs.replace(/"([^"]*)"|AM\/PM|yyyy|yy|MMMM|MMM|MM|M|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|AM|PM|A/g, (tk, lit) => (lit != null ? lit : map[tk]));
  }

  /* ---------- Evaluation ---------- */
  const MAX_DEPTH = 4;

  const pluckAll = (list, part) => list.map(r => (r && typeof r === 'object' && !Array.isArray(r) && Object.prototype.hasOwnProperty.call(r, part) && r[part] !== undefined ? r[part] : null));
  function resolveRef(name, inputs) {
    const parts = name.split('.');
    let v = inputs;
    let i0 = 0;
    // NAME.selected (0.51): what a list field has selected, which the form hands in on its own.
    if (parts.length > 1 && parts[1] === 'selected' && inputs && Object.prototype.hasOwnProperty.call(inputs, parts[0] + '.selected')) {
      v = inputs[parts[0] + '.selected'];
      if (parts.length === 2) return { found: true, value: v === undefined ? null : v };
      if (special(v) || isBlank(v)) return { found: true, value: v == null ? null : v };
      i0 = 2;
    }
    for (let i = i0; i < parts.length; i++) {
      const part = parts[i];
      // Reading a field of a value that is Waiting, No data, an error or blank gives that value.
      if (i > 0 && (special(v) || isBlank(v))) return { found: true, value: v };
      // A value of a list is that value of every item: tests.speed -> [72, 68, 75].
      if (i > 0 && Array.isArray(v)) { v = pluckAll(v, part); continue; }
      if (v == null || typeof v !== 'object' || !Object.prototype.hasOwnProperty.call(v, part)) {
        // An item (it has an $id) may simply not hold that value yet: blank, not an error.
        if (i > 0 && v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, '$id')) return { found: true, value: null };
        if (i > 0) return { found: true, value: err(`No field ${part}`) };
        return { found: false };
      }
      v = v[part];
    }
    return { found: true, value: v === undefined ? null : v };
  }

  function compare(op, x, y) {
    if (isBlank(x) || isBlank(y)) return null;
    let a = x, b = y;
    const nx = num(x), ny = num(y);
    if (!isNaN(nx) && !isNaN(ny)) { a = nx; b = ny; }
    else if (!isNaN(timeOf(x)) && !isNaN(timeOf(y)) && typeof x === 'string' && typeof y === 'string' && /^\d{4}-\d\d-\d\d/.test(x) && /^\d{4}-\d\d-\d\d/.test(y)) { a = timeOf(x); b = timeOf(y); }
    else { a = String(x).toLowerCase(); b = String(y).toLowerCase(); }
    switch (op) {
      case '=': return a === b;
      case '<>': return a !== b;
      case '<': return a < b;
      case '>': return a > b;
      case '<=': return a <= b;
      default: return a >= b;
    }
  }

  function evaluate(node, inputs, ctx) {
    const ev = n => evaluate(n, inputs, ctx);
    switch (node.k) {
      case 'lit': return node.v;
      case 'ref': {
        const r = resolveRef(node.name, inputs);
        return r.found ? r.value : err(`Unknown name ${node.name}`);
      }
      case 'field': {
        const v = ev(node.a);
        if (special(v) || isBlank(v)) return v;
        if (Array.isArray(v)) return pluckAll(v, node.name);
        // An item (it has an $id) may simply not hold that value yet: blank, not an error.
        if (typeof v === 'object' && !Object.prototype.hasOwnProperty.call(v, node.name) && Object.prototype.hasOwnProperty.call(v, '$id')) return null;
        if (typeof v !== 'object' || !Object.prototype.hasOwnProperty.call(v, node.name)) return err(`No field ${node.name}`);
        return v[node.name] === undefined ? null : v[node.name];
      }
      case 'index': {
        const v = ev(node.a), key = ev(node.key);
        if (special(v) || isBlank(v)) return v;
        if (special(key)) return key;
        if (isBlank(key)) return NODATA;
        if (Array.isArray(v)) {
          const k = String(key);
          const hit = v.find(r => r && typeof r === 'object' && (String(r.$id) === k || String(r.id) === k));
          return hit === undefined ? NODATA : hit;
        }
        if (typeof v === 'object') return Object.prototype.hasOwnProperty.call(v, String(key)) ? (v[String(key)] === undefined ? null : v[String(key)]) : NODATA;
        return err('[ ] picks one item from a list');
      }
      case 'neg': {
        const v = ev(node.a);
        if (special(v) || isBlank(v)) return v;
        const n = num(v);
        return isNaN(n) ? err('A minus sign needs a number') : (node.sign === '-' ? -n : n);
      }
      case 'bin': {
        const a = ev(node.a), b = ev(node.b);
        for (const v of [a, b]) if (isError(v)) return v;
        for (const v of [a, b]) if (special(v)) return v;
        if (node.op === '&') return (isBlank(a) ? '' : String(a)) + (isBlank(b) ? '' : String(b));
        if (['=', '<>', '<', '>', '<=', '>='].includes(node.op)) return compare(node.op, a, b);
        if (isBlank(a) || isBlank(b)) return null;
        const x = num(a), y = num(b);
        if (isNaN(x) || isNaN(y)) return err(`${node.op} needs numbers`);
        switch (node.op) {
          case '+': return x + y;
          case '-': return x - y;
          case '*': return x * y;
          case '/': return y === 0 ? err('Divide by zero') : x / y;
          default: return Math.pow(x, y);
        }
      }
      case 'call': {
        const b = BUILTINS[node.name.toUpperCase()];
        if (b) {
          // Too few or too many inputs: a message, not a crash (0.53: IF(TRUE), SORT() and EACH(xs) used to throw).
          if (node.args.length < b.min || node.args.length > b.max) return err(`${node.name.toUpperCase()} takes ${b.min === b.max ? b.min : `${b.min} to ${b.max}`} input${b.max === 1 ? '' : 's'}, not ${node.args.length}`);
          if (b.lazy) return b.fn(node.args, ev, ctx, (n, extra) => evaluate(n, Object.assign({}, inputs, extra), ctx));
          const args = node.args.map(ev);
          if (!b.aggregate) {
            // Error beats Waiting beats No data: a missing spec gives No data, never a Fail.
            const bad = args.find(isError) || args.find(isWaiting) || args.find(v => special(v) && v.__fp === 'nodata');
            if (bad) return bad;
          } else {
            const bad = args.find(isError) || args.find(isWaiting);
            if (bad) return bad;
          }
          return b.fn(args, ctx);
        }
        const f = find(node.name);
        if (!f) return err(`Unknown function ${node.name}`);
        if ((ctx.depth || 0) >= MAX_DEPTH) return err(`Functions nested more than ${MAX_DEPTH} deep`);
        const args = {};
        f.inputs.forEach((inp, i) => { args[inp.name] = i < node.args.length ? ev(node.args[i]) : null; });
        for (const v of Object.values(args)) if (isError(v)) return v;
        return run(f, args, Object.assign({}, ctx, { depth: (ctx.depth || 0) + 1 }));
      }
    }
    return err('Unknown expression');
  }

  /* ---------- Static checks: names, arity, types ---------- */
  const NUMERIC = new Set(['number', 'any']);

  function typeOfNode(node, inputTypes, problems) {
    const t = n => typeOfNode(n, inputTypes, problems);
    switch (node.k) {
      case 'lit':
        return typeof node.v === 'number' ? 'number' : typeof node.v === 'boolean' ? 'boolean' : typeof node.v === 'string' ? 'text' : 'any';
      case 'ref': {
        const [head, ...rest] = node.name.split('.');
        let ty = inputTypes[head];
        if (!ty) { problems.push(`Unknown name ${node.name}`); return 'any'; }
        for (const part of rest) {
          if (ty === 'list') return 'list';
          // Anything (an item in FILTER, EACH or SORT; a record without its fields listed) may hold any value.
          if (ty === 'any' || ty === 'item' || (ty && typeof ty === 'object' && ty.type === 'record' && !Object.keys(ty.fields || {}).length)) return 'any';
          ty = ty && typeof ty === 'object' && ty.fields ? ty.fields[part] : undefined;
          if (!ty) { problems.push(`${head} has no field ${part}`); return 'any'; }
        }
        return typeof ty === 'object' ? (ty.type || 'any') : ty;
      }
      case 'field': {
        const a = t(node.a);
        if (a !== 'any' && a !== 'record' && a !== 'list') problems.push(`.${node.name} needs a record or a list, not ${a}`);
        return a === 'list' ? 'list' : 'any';
      }
      case 'index': {
        const a = t(node.a); t(node.key);
        if (a !== 'any' && a !== 'list' && a !== 'record') problems.push(`[ ] needs a list, not ${a}`);
        return 'any';
      }
      case 'neg': { const a = t(node.a); if (!NUMERIC.has(a)) problems.push(`A minus sign needs a number, not ${a}`); return 'number'; }
      case 'bin': {
        const a = t(node.a), b = t(node.b);
        if (node.op === '&') return 'text';
        if (['=', '<>', '<', '>', '<=', '>='].includes(node.op)) return 'boolean';
        if (!NUMERIC.has(a)) problems.push(`${node.op} needs numbers, but the left side is ${a}`);
        if (!NUMERIC.has(b)) problems.push(`${node.op} needs numbers, but the right side is ${b}`);
        return 'number';
      }
      case 'call': {
        // FILTER, EACH and SORT work out their second input once per item, with item standing for it.
        const lam = LAMBDA.has(node.name.toUpperCase());
        const argTypes = node.args.map((n, i) => (lam && i === 1 ? typeOfNode(n, Object.assign({}, inputTypes, { item: 'any' }), problems) : t(n)));
        const b = BUILTINS[node.name.toUpperCase()];
        if (b) {
          if (node.args.length < b.min || node.args.length > b.max) {
            problems.push(`${node.name.toUpperCase()} takes ${b.min === b.max ? b.min : `${b.min} to ${b.max}`} input${b.max === 1 ? '' : 's'}, not ${node.args.length}`);
          }
          if (node.name.toUpperCase() === 'IF') {
            const branches = argTypes.slice(1).filter(x => x !== 'any');
            return branches.length && branches.every(x => x === branches[0]) ? branches[0] : 'any';
          }
          return b.out;
        }
        const f = find(node.name);
        if (!f) { problems.push(`Unknown function ${node.name}`); return 'any'; }
        if (node.args.length !== f.inputs.length) problems.push(`${f.name} takes ${f.inputs.length} inputs, not ${node.args.length}`);
        f.inputs.forEach((inp, i) => {
          const a = argTypes[i];
          if (a && a !== 'any' && inp.type !== 'any' && inp.type !== a && !(inp.type === 'date' && a === 'text')) {
            problems.push(`${f.name} input ${inp.name} needs ${inp.type}, not ${a}`);
          }
        });
        return f.output || 'any';
      }
    }
    return 'any';
  }

  const calls = node => node.k === 'call' ? [node.name].concat(...node.args.map(calls))
    : node.k === 'bin' ? calls(node.a).concat(calls(node.b)) : node.k === 'index' ? calls(node.a).concat(calls(node.key)) : (node.k === 'neg' || node.k === 'field') ? calls(node.a) : [];

  // Each call with how many inputs it is given: [{ name, args }].
  const callArgs = node => node.k === 'call' ? [{ name: node.name, args: node.args.length }].concat(...node.args.map(callArgs))
    : node.k === 'bin' ? callArgs(node.a).concat(callArgs(node.b)) : node.k === 'index' ? callArgs(node.a).concat(callArgs(node.key)) : (node.k === 'neg' || node.k === 'field') ? callArgs(node.a) : [];

  // The input names a formula reads (the first part of a.b), each once.
  const refs = node => {
    const out = [];
    (function walk(n, bound) {
      if (!n) return;
      if (n.k === 'ref') { const r = String(n.name).split('.')[0]; if (!out.includes(r) && !(bound && r === 'item')) out.push(r); }
      else if (n.k === 'call') n.args.forEach((x, i) => walk(x, bound || (i === 1 && LAMBDA.has(String(n.name).toUpperCase()))));
      else if (n.k === 'bin') { walk(n.a, bound); walk(n.b, bound); }
      else if (n.k === 'index') { walk(n.a, bound); walk(n.key, bound); }
      else if (n.k === 'neg' || n.k === 'field') walk(n.a, bound);
    })(node, false);
    return out;
  };

  /* ---------- Function library ---------- */
  const library = new Map();
  /* Function names are matched without regard to capitals, like Excel: inSpec finds InSpec.
   * Publishing refuses two names that differ only by capitals, so this is never ambiguous. */
  const keyFor = (map, name) => {
    if (!name) return undefined;
    if (map.has(name)) return name;
    const low = String(name).toLowerCase();
    for (const k of map.keys()) if (k.toLowerCase() === low) return k;
    return undefined;
  };
  const find = name => { const k = keyFor(library, name); return k === undefined ? undefined : library.get(k); };
  const KINDS = ['calculation', 'lookup', 'summary'];
  const TYPES = ['number', 'text', 'date', 'boolean', 'item', 'record', 'list', 'any'];

  function run(f, args, ctx) {
    const missing = f.inputs.filter(i => i.required !== false && (isBlank(args[i.name]) || isWaiting(args[i.name]))).map(i => i.label || i.name);
    if (missing.length) return waitingFor(missing);
    // A required input with No data (e.g. no spec found) makes the result No data;
    // an optional one is treated as blank.
    const isND = v => special(v) && v.__fp === 'nodata';
    if (f.inputs.some(i => i.required !== false && isND(args[i.name]))) return NODATA;
    f.inputs.forEach(i => { if (isND(args[i.name])) args[i.name] = null; });
    // Inputs must match their declared type: text typed into a number field is an error, never a Fail.
    for (const i of f.inputs) {
      const v = args[i.name];
      if (isBlank(v) || special(v)) continue;
      if (i.type === 'number' && isNaN(num(v))) return err(`${i.label || i.name} needs a number`);
      if (i.type === 'date' && isNaN(timeOf(v))) return err(`${i.label || i.name} needs a date`);
      if (i.type === 'boolean' && typeof v !== 'boolean') return err(`${i.label || i.name} needs yes or no`);
      if (i.type === 'list' && !Array.isArray(v)) return err(`${i.label || i.name} needs a list`);
    }
    if (f.kind === 'lookup') {
      if (!lookupHooks.run) return err('Lookups need fp-lookup.js');
      return lookupHooks.run(f, args, ctx);
    }
    const v = evaluate(f.tree, args, ctx);
    return v === undefined ? null : v;
  }

  /* fp-lookup.js plugs in here: how a lookup reads loaded data, and how its definition is checked. */
  const lookupHooks = { run: null, check: null };

  /* Check one definition against the library as it would be with it added. */
  function check(def) {
    const problems = [];
    if (!def.name || !/^[A-Za-z][A-Za-z0-9_]*$/.test(def.name)) problems.push('A function name uses letters, digits and _ and starts with a letter');
    if (def.name && BUILTINS[def.name.toUpperCase()]) problems.push(`${def.name} is a built-in function name`);
    if (!KINDS.includes(def.kind || 'calculation')) problems.push(`Kind must be ${KINDS.join(', ')}`);
    const inputTypes = {};
    (def.inputs || []).forEach(inp => {
      if (!inp.name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(inp.name)) problems.push(`Bad input name ${inp.name}`);
      if (!TYPES.includes(inp.type || 'any')) problems.push(`Input ${inp.name}: type must be ${TYPES.join(', ')}`);
      inputTypes[inp.name] = inp.type === 'record' ? { type: 'record', fields: inp.fields || {} } : (inp.type || 'any');
    });
    if ((def.kind || 'calculation') === 'lookup') {
      // A lookup is set up by picking (structure, match, return), not by a formula.
      if (!lookupHooks.check) problems.push('Lookups need fp-lookup.js');
      else problems.push(...lookupHooks.check(def, inputTypes));
      return { problems, tree: { k: 'lit', v: null } };
    }
    let tree = null;
    try { tree = parse(def.formula); } catch (e) { problems.push(e.message); }
    if (tree) {
      const out = typeOfNode(tree, inputTypes, problems);
      if (def.output && def.output !== 'any' && out !== 'any' && out !== def.output) problems.push(`The formula gives ${out}, but the output is declared ${def.output}`);
    }
    return { problems, tree };
  }

  /* Loops and depth across the whole library (a = calls b = calls a). */
  function graphProblems(lib) {
    const problems = [];
    const edges = new Map(Array.from(lib.values()).map(f => [f.name, calls(f.tree).map(n => keyFor(lib, n)).filter(n => n !== undefined)]));
    const depthOf = new Map();
    function visit(name, path) {
      if (path.includes(name)) { problems.push(`Loop: ${path.slice(path.indexOf(name)).concat(name).join(' → ')}`); return Infinity; }
      if (depthOf.has(name)) return depthOf.get(name);
      const d = 1 + Math.max(0, ...(edges.get(name) || []).map(n => visit(n, path.concat(name))));
      depthOf.set(name, d);
      return d;
    }
    for (const name of edges.keys()) {
      const d = visit(name, []);
      if (d !== Infinity && d > MAX_DEPTH) problems.push(`${name} nests functions ${d} deep; the limit is ${MAX_DEPTH}`);
    }
    return Array.from(new Set(problems));
  }

  FP.fn = {
    WAITING, NODATA,
    isWaiting, isError, isBlank,
    isNoData: v => special(v) && v.__fp === 'nodata',
    builtins: () => Object.keys(BUILTINS),

    /* Define or replace a library function. Throws with every problem found.
     * def: { name, label, kind, inputs: [{ name, label, type, required, fields }], output, formula, version } */
    define(def) {
      const { problems, tree } = check(def);
      if (!problems.length) {
        const trial = new Map(library);
        const t = keyFor(trial, def.name);
        if (t !== undefined && t !== def.name) trial.delete(t);
        trial.set(def.name, Object.assign({}, def, { tree }));
        problems.push(...graphProblems(trial));
      }
      if (problems.length) { const e = new Error(problems.join('; ')); e.problems = problems; throw e; }
      const twin = keyFor(library, def.name);
      if (twin !== undefined && twin !== def.name) library.delete(twin);
      const f = Object.assign({ kind: 'calculation', output: 'any', version: 1 }, def, { inputs: def.inputs || [], tree });
      library.set(def.name, f);
      return f;
    },
    get: name => find(name),
    list: () => Array.from(library.values()),
    remove: name => library.delete(name),
    check: def => check(def).problems,
    /* A formula's syntax error (or null), the functions it calls and the names it reads, without running it. */
    syntax(formula) {
      try { const tree = parse(formula); return { error: null, calls: calls(tree), callArgs: callArgs(tree), refs: refs(tree) }; }
      catch (e) { return { error: e.message, calls: [], callArgs: [], refs: [] }; }
    },
    setLookupHooks(hooks) { Object.assign(lookupHooks, hooks); },

    /* Every lookup a function or formula reaches, directly or through other
     * functions: [{ structure, current }] so the data can be loaded first. */
    needs(target) {
      let tree;
      if (find(target)) tree = { k: 'call', name: target, args: [] };
      else { try { tree = parse(target); } catch (_) { return []; } }
      const seen = new Set(), out = new Map();
      (function walk(names) {
        for (const n of names) {
          const f = find(n);
          if (!f || seen.has(f.name)) continue;
          seen.add(f.name);
          if (f.kind === 'lookup' && f.reads) {
            const current = f.reads.window === 'always-current';
            const k = f.reads.structure + (current ? '@now' : '');
            const need = out.get(k) || { structure: f.reads.structure, current, reach: [] };
            // How far back the lookup reads: a structure's live window may need widening.
            const w = f.reads.window == null ? 'form' : f.reads.window;
            need.reach.push(w && typeof w === 'object' ? { days: w.days } : w === 'all' && f.reads.from === 'entries' ? 'history' : w === 'form' ? 'form' : 'live');
            out.set(k, need);
          } else walk(calls(f.tree));
        }
      })(calls(tree));
      return Array.from(out.values());
    },

    /* Run a library function with named inputs. ctx: { asOf } (defaults to now). */
    call(name, args, ctx) {
      const f = find(name);
      if (!f) return err(`Unknown function ${name}`);
      return run(f, args || {}, Object.assign({ asOf: new Date(), depth: 0 }, ctx));
    },

    /* Evaluate a one-off formula (an inline "=..." field) against named inputs. */
    evaluate(formula, inputs, ctx) {
      let tree;
      try { tree = parse(formula); } catch (e) { return err(e.message); }
      try { return evaluate(tree, inputs || {}, Object.assign({ asOf: new Date(), depth: 0 }, ctx)); }
      catch (e) { if (e instanceof RangeError) return err(TOO_DEEP); throw e; }
    },

    /* What a display field shows: { state: 'value'|'blank'|'waiting'|'nodata'|'error', text }.
     * format: { decimals, unit, yes, no } — formatting never changes the stored value. */
    describe(v, format) {
      format = format || {};
      if (isWaiting(v)) return { state: 'waiting', text: v.missing && v.missing.length ? `Waiting for ${v.missing.join(', ')}` : 'Waiting' };
      if (special(v) && v.__fp === 'nodata') return { state: 'nodata', text: 'No data' };
      if (isError(v)) return { state: 'error', text: v.message };
      if (isBlank(v)) return { state: 'blank', text: '—' };
      if (typeof v === 'boolean') return { state: 'value', text: v ? (format.yes || 'Yes') : (format.no || 'No') };
      if (typeof v === 'number') {
        const s = format.decimals != null ? v.toFixed(format.decimals) : String(Math.round(v * 1e9) / 1e9);
        return { state: 'value', text: format.unit ? `${s} ${format.unit}` : s };
      }
      return { state: 'value', text: String(v) };
    },
  };

  /* ---------- Summary rules (shared with current values, step 6) ----------
   * rows: [{ value, at }] where at is an ISO time; corrections are applied before this. */
  /* ---------- Help for the editor and the reference ----------
   * What goes in each built-in's brackets, what it gives, and an example. The editor shows it while
   * the cursor is inside the brackets; the reference is made from the same table, so they agree. */
  const HELP = {
    IF: ['test, if true, if false', 'One value when the test is true, the other when it isn\'t (blank if left out)', 'IF(result = "Fail", "Re-test", "OK")'],
    AND: ['test, test, …', 'True when every test is true', 'AND(qty > 0, status <> "Shipped")'],
    OR: ['test, test, …', 'True when any of the tests is true', 'OR(line = "L05", line = "L07")'],
    NOT: ['test', 'The opposite: true becomes false', 'NOT(ISBLANK(profile))'],
    ISBLANK: ['value', 'True when the value is empty', 'ISBLANK(profile)'],
    COALESCE: ['value, value, …', 'The first value that isn\'t empty', 'COALESCE(override, spec.max)'],
    ROUND: ['number, decimals', 'The number rounded to that many decimals (0 if left out)', 'ROUND(measuredOD, 3)'],
    ABS: ['number', 'The number without its sign', 'ABS(measuredOD - 1.25)'],
    MIN: ['numbers or lists, …', 'The smallest', 'MIN(checks.measuredOD)'],
    MAX: ['numbers or lists, …', 'The largest', 'MAX(reading1, reading2, reading3)'],
    SUM: ['numbers or lists, …', 'Everything added up (0 for nothing)', 'SUM(stocked.qty)'],
    COUNT: ['values or lists, …', 'How many values aren\'t empty', 'COUNT(openRacks)'],
    AVERAGE: ['numbers or lists, …', 'The average', 'AVERAGE(reading1, reading2, reading3)'],
    INRANGE: ['value, min, max', 'True when the value is between min and max (both included)', 'INRANGE(measuredOD, spec.min, spec.max)'],
    DATEDIFF: ['start, end, unit', 'The time from start to end, in "days" (if left out), "hours" or "minutes"', 'DATEDIFF(rack.$firstAt, NOW(), "hours")'],
    TODAY: ['', 'The record\'s date: today while filling it in', 'TODAY()'],
    NOW: ['', 'The record\'s date and time: now while filling it in', 'NOW()'],
    HOUR: ['date and time', 'The hour of the day, 0 to 24 (6:30 is 6.5), on this terminal\'s clock', 'IF(AND(HOUR(at) >= 6, HOUR(at) < 18), "Day", "Night")'],
    WEEKDAY: ['date', 'The day of the week: 1 is Monday, 7 is Sunday', 'WEEKDAY(TODAY()) >= 6'],
    RANGE: ['from, to, step', 'A list of numbers from one to the other (step 1 if left out)', 'RANGE(6, 17)'],
    IN: ['value, list', 'True when the value is in the list', 'IN(item, done.hour)'],
    FLOOR: ['number', 'The whole number at or below it: 9.75 gives 9', 'FLOOR(HOUR(NOW()))'],
    MOD: ['number, divisor', 'What is left over after dividing: MOD(25, 24) is 1, for hours past midnight', 'MOD(item, 24)'],
    LEN: ['text', 'How many characters', 'LEN(rackId)'],
    UPPER: ['text', 'In capitals', 'UPPER(profile)'],
    LOWER: ['text', 'In small letters', 'LOWER(profile)'],
    LEFT: ['text, count', 'The first characters', 'LEFT(rackId, 2)'],
    RIGHT: ['text, count', 'The last characters', 'RIGHT(rackId, 4)'],
    CONCAT: ['value, value, …', 'Everything joined into one text (the same as &)', 'CONCAT(line, "-", profile)'],
    SITE: ['', 'This terminal\'s site code', 'SITE()'],
    PLUCK: ['list, "value name"', 'One value from every item of a list, as a list (the same as stocked.qty)', 'PLUCK(stocked, "qty")'],
    LIST: ['value, value, …', 'A list of the values', 'LIST("L01", "L02", "L05")'],
    FILTER: ['list, test using item', 'The items the test is true for; item is each one in turn', 'FILTER(racks, item.qty > 0)'],
    EACH: ['list, formula using item', 'The formula worked out for each item, as a list', 'EACH(racks, item.$id & " (" & item.qty & ")")'],
    SORT: ['list, by (using item), "desc"', 'The list in order: by the values themselves, or by a formula of item; "desc" for largest first; blanks last', 'SORT(racks, item.qty, "desc")'],
    UNIQUE: ['list', 'The list with repeats taken out (text ignores capitals)', 'UNIQUE(checks.profile)'],
    JOIN: ['list, separator', 'The list as one text, ", " between unless you say otherwise; blanks left out', 'JOIN(UNIQUE(checks.profile), " / ")'],
    DATEADD: ['date, amount, unit', 'The date moved by an amount of "minutes", "hours", "days", "weeks" or "months" (minus goes back)', 'DATEADD(STARTOF(NOW(), "hour"), -1, "hours")'],
    STARTOF: ['date, unit', 'The start of the "hour", "day", "week" (Monday) or "month" the date falls in, on this terminal\'s clock', 'STARTOF(NOW(), "hour")'],
    TEXT: ['value, format', 'The value as text. Dates: yyyy MMM MM dd ddd HH h mm AM/PM (MM is the month, mm the minutes). Numbers: 0, 0.0, #,##0, 0.0%', 'TEXT(slot, "h AM") & " check"'],
    USER: ['', 'The name of the person signed in on this terminal', 'USER()'],
    HERE: ['"all"', 'What this terminal is working on: the line (or other list item) its group or it is for, or the one picked at the top of the launcher when it is for several. HERE("all"): every one it is for. Blank in the editor', 'FILTER(running, item.line = HERE())'],
    FIRST: ['list', 'The first item of a list (No data when it is empty)', 'FIRST(SORT(openNeeds, item.priority))'],
    LAST: ['list', 'The last item of a list (No data when it is empty)', 'LAST(run.doneSlots)'],
    INDEX: ['list, number', 'One item of a list by its place: 1 is the first, -1 the last', 'INDEX(readings, 2)'],
  };
  /* { name, args: [..], text, example, library } for a built-in or a library function; null if neither. */
  function help(name) {
    if (!name) return null;
    const up = String(name).toUpperCase();
    if (HELP[up]) { const h = HELP[up]; return { name: up, args: h[0] ? h[0].split(', ') : [], text: h[1], example: h[2], library: false }; }
    const f = find(name);
    if (!f) return null;
    const args = (f.inputs || []).map(i => (i.label || i.name) + (i.required === false ? ' (optional)' : ''));
    const what = f.kind === 'lookup' && f.reads ? `reads ${f.reads.structure}` : null;
    return { name: f.name, args, text: [f.label && f.label !== f.name ? f.label : null, what, f.output && f.output !== 'any' ? `gives ${f.output === 'record' ? 'a record' : f.output === 'list' ? 'a list' : `a ${f.output}`}` : null].filter(Boolean).join(' · '), example: null, library: true };
  }
  /* The formula's pieces with where they sit, never throwing (for colouring as you type):
   * [{ type: num|str|name|op|space|bad, text, start, end }]. An unclosed text runs to the end, marked bad. */
  function scan(src) {
    const out = [];
    src = String(src == null ? '' : src);
    let i = 0;
    const push = (type, start, end) => out.push({ type, text: src.slice(start, end), start, end });
    while (i < src.length) {
      const ch = src[i];
      let m;
      if (/\s/.test(ch)) { m = /^\s+/.exec(src.slice(i)); push('space', i, i + m[0].length); i += m[0].length; continue; }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) { m = src.slice(i).match(/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/); push('num', i, i + m[0].length); i += m[0].length; continue; }
      if (ch === '"') {
        let j = i + 1;
        while (j < src.length && !(src[j] === '"' && src[j + 1] !== '"')) j += src[j] === '"' ? 2 : 1;
        if (j >= src.length) { push('bad', i, src.length); break; }
        push('str', i, j + 1); i = j + 1; continue;
      }
      if (/[A-Za-z_$]/.test(ch)) { m = src.slice(i).match(/^[A-Za-z_$][A-Za-z0-9_]*(\.[A-Za-z_$][A-Za-z0-9_]*)*/); push('name', i, i + m[0].length); i += m[0].length; continue; }
      if (ch === '.' && /[A-Za-z_$]/.test(src[i + 1] || '')) { push('op', i, i + 1); i++; continue; }
      const op = OPS.find(o => src.startsWith(o, i));
      if (op) { push('op', i, i + op.length); i += op.length; continue; }
      push('bad', i, i + 1); i++;
    }
    return out;
  }
  FP.fn.help = help;
  /* TEXT's formatting, for visuals that take a format: FP.fn.format(0.123, "0.0%") -> "12.3%". */
  FP.fn.format = (v, f) => (isBlank(v) ? '' : formatText(v, f));
  /* How many inputs a built-in takes: { min, max } (max 99 = as many as you like). */
  FP.fn.argLimits = name => { const b = BUILTINS[String(name).toUpperCase()]; return b ? { min: b.min, max: b.max } : null; };
  FP.fn.scan = scan;
  FP.fn.HELP_NAMES = Object.keys(HELP);

  FP.summary = {
    rules: ['latest', 'first', 'sum', 'count', 'average', 'min', 'max', 'list'],
    apply(rule, rows) {
      const present = (rows || []).filter(r => !isBlank(r.value) && !special(r.value));
      const byTime = present.slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
      const nums = present.map(r => num(r.value)).filter(n => !isNaN(n));
      switch (rule || 'latest') {
        case 'latest': return byTime.length ? byTime[byTime.length - 1].value : NODATA;
        case 'first': return byTime.length ? byTime[0].value : NODATA;
        case 'sum': return nums.reduce((s, v) => s + v, 0);
        case 'count': return present.length;
        case 'average': return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : NODATA;
        case 'min': return nums.length ? Math.min.apply(null, nums) : NODATA;
        case 'max': return nums.length ? Math.max.apply(null, nums) : NODATA;
        case 'list': return byTime.map(r => r.value);
        default: return err(`Unknown summary rule ${rule}`);
      }
    },
  };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-formula'] = '0.62.0';
})();
