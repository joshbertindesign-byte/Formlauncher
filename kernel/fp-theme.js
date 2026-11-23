/* Form Platform: theme (UI refresh, step 2)
 * Every colour, size and radius the screens use is a token defined here once, as a CSS variable on :root. Day values are the
 * defaults; night values are set under [data-theme="night"]. The pages only ever say var(--token).
 *
 * Colour tokens are named for what they are: --s-* a surface (a background), --t-* text, --l-* a line (a border), then the family
 * (n neutral, blue, red, green, amber, teal, violet) and the lightness 0 to 100 of the day value: --t-n-42 is neutral text at
 * lightness 42. The same colour in two roles is two tokens with the same day value, so night mode can treat them differently
 * (white text on a dark button stays white; a white surface goes dark). The colour tokens are made by dev/tools/tokenize.py.
 *
 * The chosen mode is a per-terminal preference (localStorage "fp-theme", best effort like the others): the lighting belongs to the
 * place, not the person. It is applied here, at load, before the page paints.
 *
 *   FP.theme.get()          'day' or 'night'
 *   FP.theme.set(mode)      save and apply; returns the mode
 *   FP.theme.token('t-n-42')  the computed value, for code that draws (canvas, SVG) and can't use var()
 *   FP.theme.onChange(fn)   fn(mode) whenever the mode changes
 *
 * Load right after fp-config in every page and release list.
 */
(function () {
  'use strict';

  const CSS = `
:root{
  --font-sans:Inter,system-ui,"Segoe UI",sans-serif;
  --font-mono:Consolas,"Cascadia Mono",monospace;
  /* type scale (px) */
  --fs-xs:12px;--fs-sm:13px;--fs-md:14px;--fs-base:16px;--fs-entry:17px;--fs-lg:18px;--fs-xl:20px;
  /* radius, spacing, touch targets, shadow */
  --r-sm:6px;--r:9px;--r-lg:12px;--r-pill:999px;
  --sp-1:4px;--sp-2:8px;--sp-3:12px;--sp-4:16px;--sp-5:24px;--sp-6:32px;
  --touch:48px;--touch-lg:56px;
  --shadow:0 1px 2px rgba(20,25,30,.06),0 4px 14px rgba(20,25,30,.06);
  /* the six kinds of data (used by the new look; Runs green, Inventory amber, Records blue, Cases red, Orders violet, Lists grey) */
  --k-runs:#1f7a4d;--k-runs-t:#e1f2e8;--k-inv:#9a5600;--k-inv-t:#fbedd6;--k-rec:#1f5fbf;--k-rec-t:#e4edfb;
  --k-case:#b3261e;--k-case-t:#fbe5e3;--k-ord:#6b3fc0;--k-ord-t:#ece5fa;--k-list:#4b5663;--k-list-t:#e8e9ec;
/*TOKENS-DAY*/
  --l-blue-15:#1b2633;
  --l-blue-42:#1f5fbf;
  --l-blue-50:#2a78d6;
  --l-blue-85:#c7d7ef;
  --l-n-68:#9aa6b5;
  --l-n-79:#b9c6d8;
  --l-n-83:#c9d0d9;
  --l-n-88:#d9dee5;
  --l-n-95:#eef1f5;
  --l-red-40:#b42318;
  --l-red-78:#f3b0a8;
  --s-amber-97:#fff7e6;
  --s-blue-15:#1b2633;
  --s-blue-22:#26364a;
  --s-blue-42:#1f5fbf;
  --s-blue-93:#e3edfb;
  --s-green-47:#1a7f37;
  --s-green-94:#dcf3e2;
  --s-green-96:#eaf6ec;
  --s-n-100:#ffffff;
  --s-n-88:#d9dee5;
  --s-n-95:#eef1f5;
  --s-n-98:#fff6f5;
  --s-red-94:#fde8e6;
  --t-amber-42:#8a5a00;
  --t-blue-15:#1b2633;
  --t-blue-42:#1f5fbf;
  --t-green-47:#1a7f37;
  --t-n-100:#ffffff;
  --t-n-12:#1b1f24;
  --t-n-29:#3b4552;
  --t-n-29b:#444444;
  --t-n-31:#3d4a5c;
  --t-n-42:#5b6573;
  --t-n-43:#666666;
  --t-n-61:#8a94a3;
  --t-n-83:#c6d0dc;
  --t-red-27:#7a1a12;
  --t-red-40:#b42318;
  --t-teal-30:#0b4f5c;
  --t-violet-31:#5b21b6;
/*END*/
}
@media print{:root{--r:0}}
`;
  const style = document.createElement('style');
  style.id = 'fp-theme';
  style.textContent = CSS;
  (document.head || document.documentElement).appendChild(style);

  const KEY = 'fp-theme';
  const listeners = [];
  const get = () => { try { return localStorage.getItem(KEY) === 'night' ? 'night' : 'day'; } catch (_) { return 'day'; } };
  const apply = mode => { document.documentElement.setAttribute('data-theme', mode); };
  const set = mode => {
    mode = mode === 'night' ? 'night' : 'day';
    try { localStorage.setItem(KEY, mode); } catch (_) { /* best effort: this page only */ }
    apply(mode);
    listeners.slice().forEach(fn => { try { fn(mode); } catch (_) { /* a listener must not stop the others */ } });
    return mode;
  };
  const token = name => getComputedStyle(document.documentElement).getPropertyValue('--' + String(name).replace(/^--/, '')).trim();
  const FP = (window.FP = window.FP || {});
  FP.theme = { get, set, token, onChange: fn => { listeners.push(fn); }, modes: ['day', 'night'] };
  apply(get());   // before first paint: this script is in the head, ahead of the page's own styles

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-theme'] = '0.63.1';
})();
