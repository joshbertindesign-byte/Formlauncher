// 0.51 NAME.selected: a choice's item, chips' items, the row tapped in records and the tile tapped on a board;
// rows show all their values only when the form asks (details); data under charts only with showData.
const start = require('./dummies/base.js');
(async () => {
  const { b, p, w, errs, say } = await start({ seed: 'dummies/snap15b.json', at: '2026-11-18T13:00:00-06:00' });
  p.on('dialog', d => d.accept().catch(() => {}));
  await w(1200);
  const def = {
    title: 'Selected', sites: ['all'],
    sources: [{ name: 'dies', kind: 'items', structure: 'dies', values: { press: 'read', description: 'read' } }],
    fields: [
      { name: 'die', control: 'choice', label: 'Die', optionsFrom: 'dies', optionLabel: 'item.$id & " " & item.description' },
      { name: 'diePress', control: 'value', label: 'Press of that die', formula: 'die.selected.press' },
      { name: 'pick', control: 'chips', label: 'Several', optionsFrom: 'dies' },
      { name: 'howMany', control: 'value', label: 'Picked', formula: 'COUNT(pick.selected)' },
      { name: 'plain', control: 'choice', label: 'Plain', options: ['Red', 'Blue'] },
      { name: 'plainSel', control: 'value', label: 'Plain picked', formula: 'plain.selected' },
      { name: 'list', control: 'records', label: 'Dies', formula: 'dies', sort: '$id', ascending: true, select: true, limit: 10 },
      { name: 'rowPress', control: 'value', label: 'Row press', formula: 'IF(ISBLANK(list.selected), "none", list.selected.press)' },
      { name: 'plainList', control: 'records', label: 'No tap', formula: 'dies', sort: '$id', ascending: true, limit: 3 },
      { name: 'moreList', control: 'records', label: 'Details', formula: 'dies', sort: '$id', ascending: true, limit: 3, details: true },
      { name: 'tiles', control: 'board', label: 'Tiles', formula: 'dies', title: '$id', show: '{press}', select: true, limit: 4 },
      { name: 'tilePick', control: 'value', label: 'Tile', formula: 'IF(ISBLANK(tiles.selected), "none", tiles.selected.$id)' },
    ],
    buttons: [{ name: 'save', label: 'Save', action: 'save' }],
  };
  say('check', JSON.stringify(await p.evaluate(d => FP.forms.check(d), def)));
  await p.evaluate(async d => {
    const host = document.createElement('div'); host.id = 'host'; document.body.replaceChildren(host);
    window.__f = await FP.forms.open(host, 'sel-t', { def: d, draft: false });
  }, def);
  await w(1500);
  const out = n => p.$eval(`[data-name="${n}"]`, x => x.innerText.replace(/\n+/g, ' / ')).catch(() => '?');
  const opts = await p.$$eval('[data-name="die"] option', l => l.map(o => o.textContent));
  say('options', opts.slice(0, 3).join(' | '));
  say('before', [await out('diePress'), await out('howMany'), await out('rowPress'), await out('tilePick')].join(' ‖ '));
  await p.selectOption('[data-name="die"] select', { index: 1 }); await w(900);
  say('die', await out('diePress'));
  const chips = await p.$$('[data-name="pick"] .fpc-chips button');
  if (chips[0]) await chips[0].click(); if (chips[1]) await chips[1].click(); await w(900);
  say('chips', await out('howMany'));
  await p.click('[data-name="plain"] >> text=Blue').catch(() => p.selectOption('[data-name="plain"] select', 'Blue').catch(() => {})); await w(800);
  say('plain', await out('plainSel'));
  const rows = await p.$$('[data-name="list"] tr:not(:first-child)');
  await rows[1].click(); await w(900);
  say('row', `${await out('rowPress')} · marked ${await p.$$eval('[data-name="list"] tr.sel', l => l.length)}`);
  await (await p.$$('[data-name="list"] tr:not(:first-child)'))[1].click(); await w(900);
  say('row again', `${await out('rowPress')} · marked ${await p.$$eval('[data-name="list"] tr.sel', l => l.length)}`);
  await (await p.$$('[data-name="plainList"] tr:not(:first-child)'))[0].click(); await w(400);
  say('no details', `${await p.$$eval('[data-name="plainList"] tr.more', l => l.length)} more rows`);
  await (await p.$$('[data-name="moreList"] tr:not(:first-child)'))[0].click(); await w(400);
  say('details', `${await p.$$eval('[data-name="moreList"] tr.more', l => l.length)} more rows`);
  const tiles = await p.$$('[data-name="tiles"] .fpv-tile');
  await tiles[tiles.length - 1].click(); await w(900);
  say('tile', `${await out('tilePick')} · marked ${await p.$$eval('[data-name="tiles"] .fpv-tile.sel', l => l.length)}`);
  // Charts: no table under them unless the form asks.
  const charts = await p.evaluate(async () => {
    const mk = async showData => {
      const host = document.createElement('div'); document.body.appendChild(host);
      await FP.forms.open(host, 'ch-t', { draft: false, def: { title: 'C', sites: ['all'], sources: [{ name: 'dies', kind: 'items', structure: 'dies', values: { press: 'read' } }], fields: [{ name: 'c', control: 'chart', label: 'Chart', formula: 'dies', type: 'bar', x: 'press', showData }] } });
      await new Promise(r => setTimeout(r, 800));
      return host.querySelectorAll('table, details').length;
    };
    return { off: await mk(undefined), on: await mk(true) };
  });
  say('chart data', JSON.stringify(charts));
  say('errs', JSON.stringify(errs));
  await b.close();
})();
