/* Form Platform: loads the running release's files into a page.
 * Lives in the data folder's runtime folder, next to releases.js (which says which release runs).
 * Written by the installer from the release; don't edit.
 *
 * A page sets window.FP_PAGE ('launcher', 'editor' or 'test'), loads releases.js, then this file.
 * The current release is tried first. If its files haven't all arrived on this terminal yet
 * (sync still running), the page falls back to the newest older kept release that is complete, and
 * moves on by itself once the rest has arrived (fp-updates.js watches for that).
 */
(function () {
  var R = window.FP_RELEASES;
  var me = document.currentScript;
  var base = me.src.slice(0, me.src.lastIndexOf('/') + 1);
  var report = function (m) { if (window.__fpReport) window.__fpReport(m); };
  if (!R || !R.current || !R.load) { report('No release of the platform is installed here (runtime/releases.js is missing). An admin installs one from the editor.'); return; }
  var page = window.FP_PAGE || 'launcher';
  // The current release, then the older kept ones, newest first. Never a newer one: after going back
  // from a release, a terminal still syncing must not land on the release that was gone back from.
  var older = function (a, b) { a = a.split('.'); b = b.split('.'); for (var k = 0; k < 3; k++) if (+a[k] !== +b[k]) return +a[k] < +b[k]; return false; };
  var order = [R.current].concat((R.kept || []).filter(function (v) { return older(v, R.current); }));
  var failed = {};
  try { failed = JSON.parse(sessionStorage.getItem('fp-boot-failed') || '{}') || {}; } catch (e) { failed = {}; }
  var ver = null;
  for (var i = 0; i < order.length; i++) if (!failed[order[i]] && R.load[order[i]]) { ver = order[i]; break; }
  if (!ver) ver = R.current;
  var files = (R.load[ver] && (R.load[ver][page] || R.load[ver].launcher)) || [];
  window.FP_BOOT = { version: ver, current: R.current, page: page, base: base, fallback: ver !== R.current };

  /* After the files ran: every one must say this release's version, or try the next release. */
  window.__fpBootCheck = function () {
    var mods = (window.FP && window.FP.modules) || {};
    var bad = files.filter(function (m) { return mods[m] !== ver; });
    if (!bad.length) return;
    var rest = order.filter(function (v) { return v !== ver && !failed[v] && R.load[v]; });
    if (!rest.length) return;   // nothing to fall back on: the page shows what is missing
    failed[ver] = new Date().toISOString();
    try { sessionStorage.setItem('fp-boot-failed', JSON.stringify(failed)); } catch (e) { return; }
    window.__fpBootRetrying = true;
    location.reload();
  };

  var html = '';
  for (var j = 0; j < files.length; j++) html += '<script src="' + base + ver + '/' + files[j] + '.js"><\/script>';
  html += '<script>__fpBootCheck()<\/script>';
  document.write(html);
})();
