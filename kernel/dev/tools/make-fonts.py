#!/usr/bin/env python3
"""Make fp-fonts.js: Inter (Latin subset, regular to bold) embedded as data, with its licence.
   python3 dev/tools/make-fonts.py <dir holding inter-latin-{400,500,600,700}-normal.woff2 and LICENSE>
Why embedded: the installer only writes .js files from a release zip, and the pages run from file:// with no network, so a font that is
part of a .js file is installed, hash-checked and rolled back with the release like any other file. Source: the @fontsource/inter package
(Inter 4, SIL Open Font License 1.1)."""
import sys, os, base64
src = sys.argv[1]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'fp-fonts.js')
lic = open(os.path.join(src, 'LICENSE')).read().strip().replace('*/', '* /')
faces = []
for w in (400, 500, 600, 700):
    b = base64.b64encode(open(os.path.join(src, f'inter-latin-{w}-normal.woff2'), 'rb').read()).decode()
    faces.append(f"@font-face{{font-family:Inter;font-style:normal;font-weight:{w};font-display:swap;src:url(data:font/woff2;base64,{b}) format('woff2')}}")
js = f"""/* Form Platform: the Inter typeface (Latin, 400 to 700), embedded so it loads from file:// and installs with the release.
 * Made by dev/tools/make-fonts.py; don't edit by hand.
 *
 * Inter is used under the SIL Open Font License, Version 1.1. Its licence:
 *
{chr(10).join(' * ' + l if l else ' *' for l in lic.split(chr(10)))}
 */
(function () {{
  'use strict';
  const css = {repr(chr(10).join(faces))};
  const style = document.createElement('style');
  style.id = 'fp-fonts';
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  (window.FP = window.FP || {{}});
  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {{}})['fp-fonts'] = '0.63.1';
}})();
"""
open(out, 'w').write(js)
print(f'fp-fonts.js: {len(js)//1024} KB')
