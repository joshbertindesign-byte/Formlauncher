// Startup gate site step (kernel 0.18): create the first site, or pick the first one listed.
module.exports = async function siteStep(p, code, name) {
  const h = await p.waitForSelector('.fp-gate-card h1:has-text("site")', { timeout: 5000 }).catch(() => null);
  if (!h) return;
  if (/first site/.test(await h.textContent())) {
    const ins = await p.$$('.fp-gate-card input');
    await ins[0].fill(code || 'ABI'); await ins[1].fill(name || 'Abilene');
    await p.click('text=Create site');
  } else {
    const want = code ? `.fp-gate-card button:has-text("(${code})")` : '.fp-gate-card button.fp-secondary';
    await p.click(want);
  }
  await p.waitForSelector('.fp-gate-card h1:has-text("site")', { state: 'detached', timeout: 5000 }).catch(() => {});
};
