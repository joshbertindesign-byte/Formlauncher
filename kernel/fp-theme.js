/* Form Platform: theme (UI refresh, step 2)
 * Every colour, size and radius the screens use is a token defined here once, as a CSS variable on :root. Day values are the
 * defaults; night values are set under [data-theme="night"]. The pages only ever say var(--token).
 *
 * Colour tokens are named for what they are: --s-* a surface (a background), --t-* text, --l-* a line (a border), then the family
 * (n neutral, blue, red, green, amber, teal, violet) and the lightness 0 to 100 of the day value: --t-n-42 is neutral text at
 * lightness 42. The same colour in two roles is two tokens with the same day value, so night mode can treat them differently
 * (white text on a dark button stays white; a white surface goes dark). The colour tokens are made by dev/tools/tokenize.py.
 *
 * Printing always uses the day values (a printed record is identical in both modes), whatever mode the screen is in.
 *
 * The chosen mode is a per-terminal preference (localStorage "fp-theme", best effort like the others): the lighting belongs to the
 * place, not the person. It is applied here, at load, before the page paints.
 *
 *   FP.theme.get()          'day' or 'night'
 *   FP.theme.set(mode)      save and apply; returns the mode
 *   FP.theme.token('t-n-42')  the computed value, for code that draws (canvas, SVG) and can't use var()
 *   FP.theme.toggle(btn)    make a <button> the Day / Night switch (labels itself, flips on a tap)
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
  /* the drawing pad is the same in both modes: a white writing surface and a dark pen, so saved signatures and sketches stay legible */
  --pad-bg:#ffffff;--pad-ink:#111111;
  /* the six kinds of data (used by the new look; Runs green, Inventory amber, Records blue, Cases red, Orders violet, Lists grey) */
  --k-runs:#1f7a4d;--k-runs-t:#e1f2e8;--k-inv:#9a5600;--k-inv-t:#fbedd6;--k-rec:#1f5fbf;--k-rec-t:#e4edfb;
  --k-case:#b3261e;--k-case-t:#fbe5e3;--k-ord:#6b3fc0;--k-ord-t:#ece5fa;--k-list:#4b5663;--k-list-t:#e8e9ec;
/*TOKENS-DAY*/
  --d-amber-42:#8a5a00;
  --d-amber-47:#b45309;
  --d-amber-48:#9a6700;
  --d-amber-61:#c98500;
  --d-amber-72:#eda100;
  --d-amber-77:#fab219;
  --d-amber-83:#f6c3a8;
  --d-amber-93:#fde9c8;
  --d-amber-96:#fff3d6;
  --d-amber-96b:#fff1e6;
  --d-blue-15:#1b2633;
  --d-blue-42:#1f5fbf;
  --d-blue-43:#6250d6;
  --d-blue-50:#2a78d6;
  --d-blue-73:#86b6ef;
  --d-blue-85:#c7d7ef;
  --d-green-36:#006300;
  --d-green-45:#1f7a3a;
  --d-green-47:#1a7f37;
  --d-green-47b:#008300;
  --d-green-57:#1f9d55;
  --d-green-58:#0e9f6e;
  --d-green-58b:#0ca30c;
  --d-green-64:#1baf7a;
  --d-green-79:#9ccfb0;
  --d-green-95:#e5f4e4;
  --d-n-12:#1b1f24;
  --d-n-3:#0b0b0b;
  --d-n-34:#52514e;
  --d-n-36:#475569;
  --d-n-42:#5b6573;
  --d-n-48:#64748b;
  --d-n-48b:#6b7280;
  --d-n-56:#898781;
  --d-n-66:#94a3b8;
  --d-n-77:#b8c0ca;
  --d-n-78:#c3c2b7;
  --d-n-83:#c9d0d9;
  --d-n-88:#d9dee5;
  --d-n-89:#e1e0d9;
  --d-n-95:#eef1f5;
  --d-n-99:#fcfcfb;
  --d-red-40:#b42318;
  --d-red-48:#d03b3b;
  --d-red-54:#e5484d;
  --d-red-60:#eb6834;
  --d-red-65:#e87ba4;
  --d-red-92:#fde3e0;
  --d-teal-45:#0e7490;
  --d-teal-46:#0b7a75;
  --d-teal-52:#0f8b8d;
  --d-teal-56:#0891b2;
  --d-teal-81:#9fd3dc;
  --d-teal-88:#c7e3ea;
  --d-violet-43:#7c3aed;
  --d-violet-45:#9333ea;
  --d-violet-65:#a78bfa;
  --d-violet-84:#d6ccfb;
  --l-amber-39:#9a3f06;
  --l-amber-47:#b45309;
  --l-amber-60:#d97706;
  --l-amber-69:#c9a24a;
  --l-amber-71:#d4a72c;
  --l-amber-77:#e7b56b;
  --l-amber-78:#f0b48a;
  --l-amber-81:#ebc66a;
  --l-amber-86:#f0d58a;
  --l-amber-86b:#f1d39a;
  --l-amber-88:#f0d9b0;
  --l-blue-15:#1b2633;
  --l-blue-42:#1f5fbf;
  --l-blue-50:#2a78d6;
  --l-blue-75:#9ebce8;
  --l-blue-75b:#b9b0f0;
  --l-blue-85:#c7d7ef;
  --l-green-47:#1a7f37;
  --l-green-79:#9fd19c;
  --l-green-84:#b5dcbc;
  --l-n-0:#000000;
  --l-n-21:#333333;
  --l-n-38:#4a5a6c;
  --l-n-43:#666666;
  --l-n-48:#64748b;
  --l-n-63:#999999;
  --l-n-68:#9aa6b5;
  --l-n-78:#c3c2b7;
  --l-n-79:#b9c6d8;
  --l-n-83:#c9d0d9;
  --l-n-88:#d9dee5;
  --l-n-95:#eef1f5;
  --l-red-40:#b42318;
  --l-red-45:#cf222e;
  --l-red-78:#f3b0a8;
  --l-teal-45:#0e7490;
  --l-violet-89:#e1dafc;
  --s-amber-39:#9a3f06;
  --s-amber-39b:#8a4b00;
  --s-amber-70:#e0a100;
  --s-amber-82:#f2c94c;
  --s-amber-95:#fdf0d0;
  --s-amber-97:#fff7e6;
  --s-blue-15:#1b2633;
  --s-blue-22:#26364a;
  --s-blue-42:#1f5fbf;
  --s-blue-50:#2a78d6;
  --s-blue-93:#e3edfb;
  --s-green-47:#1a7f37;
  --s-green-68:#2fbf5b;
  --s-green-94:#dcf3e2;
  --s-green-96:#eaf6ec;
  --s-n-0:#000000;
  --s-n-100:#ffffff;
  --s-n-19:#2a2f36;
  --s-n-68:#9aa6b5;
  --s-n-88:#d9dee5;
  --s-n-95:#eef1f5;
  --s-n-98:#fff6f5;
  --s-red-40:#b42318;
  --s-red-54:#e5484d;
  --s-red-94:#fde8e6;
  --s-teal-95:#e6f3f5;
  --s-violet-86:#ddd3fb;
  --s-yellow-95:#fff3b0;
  --t-amber-30:#5a4300;
  --t-amber-35:#8a3c06;
  --t-amber-39:#8a4b00;
  --t-amber-42:#8a5a00;
  --t-amber-47:#b45309;
  --t-amber-70:#e0a100;
  --t-blue-15:#1b2633;
  --t-blue-27:#1d3f73;
  --t-blue-28:#163a9c;
  --t-blue-42:#1f5fbf;
  --t-green-34:#1a5c1a;
  --t-green-36:#006300;
  --t-green-45:#18794e;
  --t-green-47:#1a7f37;
  --t-n-0:#000000;
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
  --t-red-36:#a1261c;
  --t-red-40:#b42318;
  --t-red-46:#c2410c;
  --t-teal-30:#0b4f5c;
  --t-teal-45:#0e7490;
  --t-violet-31:#5b21b6;
  --t-violet-43:#7c3aed;
/*END*/
}
:root[data-theme="night"]{
  color-scheme:dark;
/*TOKENS-NIGHT*/
  --d-amber-42:#e9ac59;
  --d-amber-47:#c8631d;
  --d-amber-48:#ac7617;
  --d-amber-61:#cf8a0c;
  --d-amber-93:#442d00;
  --d-amber-96:#382c00;
  --d-amber-96b:#3d2915;
  --d-blue-15:#d2deef;
  --d-blue-42:#91b4ff;
  --d-blue-43:#bea0ff;
  --d-blue-50:#4085e5;
  --d-blue-85:#003e6c;
  --d-green-36:#86d572;
  --d-green-45:#70c67f;
  --d-green-47:#319046;
  --d-green-47b:#259419;
  --d-green-57:#2ca65d;
  --d-green-58:#20a776;
  --d-green-58b:#20ab19;
  --d-green-64:#22b37d;
  --d-green-95:#163519;
  --d-n-12:#e7edf4;
  --d-n-3:#f1f1f1;
  --d-n-34:#b6b5b1;
  --d-n-36:#a4b3ca;
  --d-n-42:#99a3b2;
  --d-n-48:#8696ae;
  --d-n-48b:#8f96a5;
  --d-n-56:#85837d;
  --d-n-66:#5f6e81;
  --d-n-77:#515961;
  --d-n-78:#57574d;
  --d-n-83:#464c54;
  --d-n-88:#2b2f34;
  --d-n-89:#2e2e28;
  --d-n-95:#16181b;
  --d-n-99:#212120;
  --d-red-40:#ff8d6f;
  --d-red-48:#e34d49;
  --d-red-54:#f25457;
  --d-red-60:#f36f3a;
  --d-red-65:#eb7da6;
  --d-red-92:#512522;
  --d-teal-45:#2d86a2;
  --d-teal-46:#298b86;
  --d-teal-52:#279799;
  --d-teal-56:#239bbc;
  --d-teal-88:#003f4e;
  --d-violet-43:#d98dff;
  --d-violet-45:#e883ff;
  --d-violet-65:#aa8efd;
  --l-amber-77:#654610;
  --l-amber-78:#694326;
  --l-amber-81:#5d4901;
  --l-amber-86:#574914;
  --l-amber-86b:#594821;
  --l-amber-88:#55482d;
  --l-blue-75:#364e6c;
  --l-blue-85:#3f4b5b;
  --l-green-79:#305430;
  --l-green-84:#36503b;
  --l-n-21:#2a2f34;
  --l-n-38:#415163;
  --l-n-43:#575c62;
  --l-n-48:#58687f;
  --l-n-63:#72787e;
  --l-n-68:#636e7c;
  --l-n-78:#57574d;
  --l-n-79:#495564;
  --l-n-83:#464c54;
  --l-n-88:#3d4147;
  --l-n-95:#2f3439;
  --l-red-78:#6c403b;
  --l-violet-89:#4b475d;
  --s-amber-70:#6a3700;
  --s-amber-82:#593f00;
  --s-amber-95:#3a2d00;
  --s-amber-97:#342a08;
  --s-blue-15:#121d29;
  --s-blue-22:#17283b;
  --s-blue-93:#14324c;
  --s-green-68:#005500;
  --s-green-94:#00381b;
  --s-green-96:#1b3221;
  --s-n-100:#1f2429;
  --s-n-19:#1a1f26;
  --s-n-68:#333e4b;
  --s-n-88:#2b2f34;
  --s-n-95:#13181d;
  --s-n-98:#221c1c;
  --s-red-94:#492624;
  --s-teal-95:#163236;
  --s-violet-86:#332e7c;
  --s-yellow-95:#373100;
  --t-amber-30:#ebc883;
  --t-amber-35:#ffab73;
  --t-amber-39:#fcac65;
  --t-amber-42:#e9ac59;
  --t-amber-47:#ff944d;
  --t-amber-70:#d99b00;
  --t-blue-15:#d2deef;
  --t-blue-27:#bad0ff;
  --t-blue-28:#c2c3ff;
  --t-blue-42:#91b4ff;
  --t-green-34:#95d68a;
  --t-green-36:#86d572;
  --t-green-45:#6cc595;
  --t-green-47:#68c476;
  --t-n-0:#f1f1f1;
  --t-n-12:#e7edf4;
  --t-n-29:#b8c3d3;
  --t-n-29b:#c2c2c2;
  --t-n-31:#b0bed3;
  --t-n-42:#99a3b2;
  --t-n-43:#a0a0a0;
  --t-red-27:#ffb29b;
  --t-red-36:#ff9a80;
  --t-red-40:#ff8d6f;
  --t-red-46:#ff8850;
  --t-teal-30:#9bd4e3;
  --t-teal-45:#6ebedc;
  --t-violet-31:#efa7ff;
  --t-violet-43:#d98dff;
/*END*/
}
@media print{:root[data-theme="night"]{
  color-scheme:light;
/*TOKENS-PRINT*/
  --d-amber-42:#8a5a00;
  --d-amber-47:#b45309;
  --d-amber-48:#9a6700;
  --d-amber-61:#c98500;
  --d-amber-93:#fde9c8;
  --d-amber-96:#fff3d6;
  --d-amber-96b:#fff1e6;
  --d-blue-15:#1b2633;
  --d-blue-42:#1f5fbf;
  --d-blue-43:#6250d6;
  --d-blue-50:#2a78d6;
  --d-blue-85:#c7d7ef;
  --d-green-36:#006300;
  --d-green-45:#1f7a3a;
  --d-green-47:#1a7f37;
  --d-green-47b:#008300;
  --d-green-57:#1f9d55;
  --d-green-58:#0e9f6e;
  --d-green-58b:#0ca30c;
  --d-green-64:#1baf7a;
  --d-green-95:#e5f4e4;
  --d-n-12:#1b1f24;
  --d-n-3:#0b0b0b;
  --d-n-34:#52514e;
  --d-n-36:#475569;
  --d-n-42:#5b6573;
  --d-n-48:#64748b;
  --d-n-48b:#6b7280;
  --d-n-56:#898781;
  --d-n-66:#94a3b8;
  --d-n-77:#b8c0ca;
  --d-n-78:#c3c2b7;
  --d-n-83:#c9d0d9;
  --d-n-88:#d9dee5;
  --d-n-89:#e1e0d9;
  --d-n-95:#eef1f5;
  --d-n-99:#fcfcfb;
  --d-red-40:#b42318;
  --d-red-48:#d03b3b;
  --d-red-54:#e5484d;
  --d-red-60:#eb6834;
  --d-red-65:#e87ba4;
  --d-red-92:#fde3e0;
  --d-teal-45:#0e7490;
  --d-teal-46:#0b7a75;
  --d-teal-52:#0f8b8d;
  --d-teal-56:#0891b2;
  --d-teal-88:#c7e3ea;
  --d-violet-43:#7c3aed;
  --d-violet-45:#9333ea;
  --d-violet-65:#a78bfa;
  --l-amber-77:#e7b56b;
  --l-amber-78:#f0b48a;
  --l-amber-81:#ebc66a;
  --l-amber-86:#f0d58a;
  --l-amber-86b:#f1d39a;
  --l-amber-88:#f0d9b0;
  --l-blue-75:#9ebce8;
  --l-blue-85:#c7d7ef;
  --l-green-79:#9fd19c;
  --l-green-84:#b5dcbc;
  --l-n-21:#333333;
  --l-n-38:#4a5a6c;
  --l-n-43:#666666;
  --l-n-48:#64748b;
  --l-n-63:#999999;
  --l-n-68:#9aa6b5;
  --l-n-78:#c3c2b7;
  --l-n-79:#b9c6d8;
  --l-n-83:#c9d0d9;
  --l-n-88:#d9dee5;
  --l-n-95:#eef1f5;
  --l-red-78:#f3b0a8;
  --l-violet-89:#e1dafc;
  --s-amber-70:#e0a100;
  --s-amber-82:#f2c94c;
  --s-amber-95:#fdf0d0;
  --s-amber-97:#fff7e6;
  --s-blue-15:#1b2633;
  --s-blue-22:#26364a;
  --s-blue-93:#e3edfb;
  --s-green-68:#2fbf5b;
  --s-green-94:#dcf3e2;
  --s-green-96:#eaf6ec;
  --s-n-100:#ffffff;
  --s-n-19:#2a2f36;
  --s-n-68:#9aa6b5;
  --s-n-88:#d9dee5;
  --s-n-95:#eef1f5;
  --s-n-98:#fff6f5;
  --s-red-94:#fde8e6;
  --s-teal-95:#e6f3f5;
  --s-violet-86:#ddd3fb;
  --s-yellow-95:#fff3b0;
  --t-amber-30:#5a4300;
  --t-amber-35:#8a3c06;
  --t-amber-39:#8a4b00;
  --t-amber-42:#8a5a00;
  --t-amber-47:#b45309;
  --t-amber-70:#e0a100;
  --t-blue-15:#1b2633;
  --t-blue-27:#1d3f73;
  --t-blue-28:#163a9c;
  --t-blue-42:#1f5fbf;
  --t-green-34:#1a5c1a;
  --t-green-36:#006300;
  --t-green-45:#18794e;
  --t-green-47:#1a7f37;
  --t-n-0:#000000;
  --t-n-12:#1b1f24;
  --t-n-29:#3b4552;
  --t-n-29b:#444444;
  --t-n-31:#3d4a5c;
  --t-n-42:#5b6573;
  --t-n-43:#666666;
  --t-red-27:#7a1a12;
  --t-red-36:#a1261c;
  --t-red-40:#b42318;
  --t-red-46:#c2410c;
  --t-teal-30:#0b4f5c;
  --t-teal-45:#0e7490;
  --t-violet-31:#5b21b6;
  --t-violet-43:#7c3aed;
/*END*/
}}
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
  /* The Day / Night switch for a page's header: give it a <button>; it labels itself, flips the mode on a tap and follows changes. */
  const toggle = btn => {
    const paint = () => {
      const night = get() === 'night';
      btn.textContent = night ? '\u2600 Day' : '\u263E Night';
      btn.title = night ? 'Switch this terminal to day mode' : 'Switch this terminal to night mode';
      btn.setAttribute('aria-pressed', String(night));
    };
    btn.type = 'button';
    btn.onclick = () => { set(get() === 'night' ? 'day' : 'night'); };
    listeners.push(paint); paint();
    return btn;
  };
  FP.theme = { get, set, token, toggle, onChange: fn => { listeners.push(fn); }, modes: ['day', 'night'] };
  apply(get());   // before first paint: this script is in the head, ahead of the page's own styles

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-theme'] = '0.64.0';
})();
