// Helpers for the pilot tests at a launcher, with the clock set by the test.
const start = require('./base.js');
const siteStep = require('../site-step.js');
module.exports = async function pilot(o) {
  o = o || {};
  const t = await start({ seed: o.seed || 'snapPilot.json', noSignIn: true, dropKv: ['openSessions'].concat(o.dropKv || []) });
  const { p, w } = t;
  // The clock runs from the time set (so caches expire and timers fire as they would); jumps when set again.
  let installed = false;
  t.at = async iso => {
    if (!installed) { await p.clock.install({ time: new Date(iso) }); await p.clock.resume(); installed = true; } else await p.clock.setSystemTime(new Date(iso));
    // The time jumped while the person was working: a tap now, so the idle sign-out doesn't fire mid-step.
    await p.evaluate(() => { document.dispatchEvent(new PointerEvent('pointerdown')); document.dispatchEvent(new PointerEvent('pointerup')); }).catch(() => {});
  };
  p.on('dialog', d => d.accept().catch(() => {}));
  await p.goto('file:///home/claude/kernel/launcher.html' + (o.query || '')); await w(2500);
  if (await p.waitForSelector('.fp-gate-card', { timeout: 5000 }).catch(() => null)) {
    if (await p.$('text=Save terminal ID')) { await p.fill('.fp-gate-card input', 'T01'); await p.click('text=Save terminal ID'); await w(800); }
    if (await p.waitForSelector('.fp-gate-card h1', { timeout: 3000 }).catch(() => null)) { await siteStep(p, 'ABI', 'Abilene'); await w(2500); }
  }
  // The terminal is set up at the real time; then the clock is set for the test (sign in again at that time).
  if (o.at) { await t.at(o.at); await w(500); }
  t.signIn = async (name, pin) => {
    t.who = [name, pin];
    if (!(await p.$('.fp-u-card'))) { const who = await p.$('#who'); if (who) { await who.click(); await w(800); } }
    await p.click(`.fp-u-card >> text=${name}`); await w(400); await p.keyboard.type(pin); await w(2200);
  };
  t.home = async () => { if (await p.isVisible('#home').catch(() => false)) { await p.click('#home'); await w(1500); } };
  // A clock jump past the idle time signs the terminal out: sign the same person in again first.
  t.open = async form => { await w(300); if (t.who && (await p.isVisible('.fp-u.solid').catch(() => false))) await t.signIn(...t.who); await t.home(); await p.click(`.fpl-tile[data-form="${form}"]`); await w(2500); };
  // The line board on the home screen (0.47): its cards, and a card's button for a line.
  t.board = async () => { await w(300); if (t.who && (await p.isVisible('.fp-u.solid').catch(() => false))) await t.signIn(...t.who); await p.evaluate(() => { FP.current.clearCache(); return FP.launcher.home(); }); await w(1500); return p.$$eval('.fpl-board .fpf-card', l => l.map(c => (c.className.replace('fpf-card', '').trim() || '-') + ':' + c.querySelector('.fpf-card-head b').textContent + ' — ' + ((c.querySelector('.fpf-card-head span') || {}).textContent || '')).join(' || ')); };
  t.act = async (line, label) => { await t.board(); await p.click(`.fpl-board .fpf-card:has(.fpf-card-head b:text-matches("^${line} ·")) .fpf-card-act:text-is("${label}")`); await w(2500); };
  t.text = async sel => p.$eval(sel, x => x.innerText.replace(/\n+/g, ' / ')).catch(e => '(' + e.message.slice(0, 60) + ')');
  t.why = async () => t.text('.fpf-why');
  t.field = name => `[data-name="${name}"]`;
  t.fill = async (name, v) => { await p.fill(`[data-name="${name}"] input`, String(v)); await w(250); };
  t.seg = async (name, label) => { const b = `[data-name="${name}"] .fpf-seg button:text-is("${label}")`; if ((await p.getAttribute(b, 'aria-pressed')) !== 'true') await p.click(b); await w(300); };
  t.pick = async (name, labelPart) => {
    const sel = await p.$(`[data-name="${name}"] select`);
    const opts = await sel.$$eval('option', l => l.map(o => [o.value, o.textContent]));
    const hit = opts.find(([v, tx]) => tx.includes(labelPart));
    if (!hit) throw new Error(`no option "${labelPart}" in ${name}: ${opts.map(x => x[1]).join(' | ')}`);
    await sel.selectOption(hit[0]); await w(400);
  };
  t.options = async name => p.$$eval(`[data-name="${name}"] option`, l => l.map(o => o.textContent)).catch(() => []);
  t.val = async name => p.$eval(`[data-name="${name}"]`, x => (x.querySelector('select') ? x.querySelector('select').selectedOptions[0].textContent : x.querySelector('input') ? x.querySelector('input').value : x.innerText.replace(/\n+/g, ' / '))).catch(e => '(' + e.message.slice(0, 50) + ')');
  t.save = async label => { await p.click(`.fpf-foot button:has-text("${label || 'Save'}"), .fpf button.fpf-save:has-text("${label || 'Save'}")`); await w(2500); };
  t.items = async st => p.evaluate(async s => { FP.current.clearCache(); const r = await FP.current.load(s, { fresh: true }); return Array.from(r.items.values()).map(i => Object.assign({ $id: i.id, $status: i.status }, i.values)); }, st);
  t.formProblems = async () => p.evaluate(() => { const f = window.__fpForm || null; return f ? f.problems() : null; });
  return t;
};
