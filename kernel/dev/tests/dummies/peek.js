const start = require('./base.js');
(async () => { const T = await start({ seed: 'snap7.json', noSignIn: true }); await T.w(2500); console.log(await T.p.innerText('body')); await T.p.screenshot({ path: 'peek.png' }); await T.b.close(); })();
