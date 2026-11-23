/* Form Platform: bootstrap settings
 * Load before fp-core.js.
 *
 * The only hard-coded settings: where the platform's data lives. Everything
 * else (shifts, users, lines, schedules, contexts) comes from published
 * definitions and reference forms.
 */
(function () {
  'use strict';
  const FP = (window.FP = window.FP || {});
  FP.config = Object.assign(FP.config || {}, {
    dataRoot: ['data'],
  });

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-config'] = '0.63.0';
})();
