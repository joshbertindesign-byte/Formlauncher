module.exports = async ({ p, w, say, add, row, useValue }) => {
  await add('A form', 'probe-reg');
  await row('+s'); await p.click('.ffm-props button:has-text("A structure")'); await w(500);
  await p.selectOption('.ffm-props select', 'dies'); await w(600);
  await useValue('die', 'press', true);
  await row('f:press'); await w(300);
  await p.locator('.ffm-props label', { hasText: /^\s*Kind of field/ }).locator('select').selectOption('choice'); await w(800);
  await p.fill('.ffm-props textarea[placeholder^="One option"]', 'Press 1, Press 2, Press 3, Press 13'); await w(800);

  say('hint', await p.$eval('.ffm-props label:has(textarea) .fpe-hint', x => x.textContent));
  await w(1500); say('preview', (await p.innerText('.ffe-prev')).replace(/\n+/g, ' / ').slice(0, 200));
  await row('f:dieNo').catch(() => {}); await w(300); await row('f:press'); await w(400);
  say('reopened', JSON.stringify(await p.$eval('.ffm-props textarea[placeholder^="One option"]', x => x.value)));
};
module.exports.more = 1;
