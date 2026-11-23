module.exports = async ({ p, w, say, add, row, props }) => {
  await add('A structure', 'probe-st'); await row('top'); say('st top', await props());
  await add('A media rule', 'probe-rule');
  for (const k of ['top', 'w:library', 'w:ext', 'kind']) { await row(k); say(k, await props()); }
  say('right', await p.$eval('.ffe-prev', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 300)));
  await add('A function', 'ProbeFn'); await row('top'); say('fn top', await props());
  await row('+in'); say('fn in', await props()); await row('fx'); say('fx', await props());
  say('fn right', await p.$eval('.ffe-prev', x => x.innerText.replace(/\n+/g, ' / ').slice(0, 300)));
};
