#!/usr/bin/env python3
"""Move the runtime's hard-coded colours onto theme tokens (UI refresh, step 3).

  python3 dev/tools/tokenize.py map                 read every colour in the runtime, write dev/tools/colour-map.json (the token table)
  python3 dev/tools/tokenize.py lookup HEX..        which token(s) a colour became, by role
  python3 dev/tools/tokenize.py night               write the night tokens (by rule) into fp-theme.js
  python3 dev/tools/tokenize.py theme               write the day tokens from the map into fp-theme.js
  python3 dev/tools/tokenize.py apply FILE [FILE..] rewrite the colour literals of those files to var(--token); print what it left
  python3 dev/tools/tokenize.py check [FILE..]      list the colour literals still in the runtime files (default: all) outside the exceptions

A token is (role, family, lightness): `--s-n-100` a surface in the neutral family at lightness 100 (white), `--t-n-35` text,
`--l-n-81` a line (border), `--s-blue-93` a blue tint, `--a-blue-42` the accent. The role comes from the CSS property the colour is
written after (color -> text, background -> surface, border/outline -> line); the same colour in two roles is two tokens that
have the same day value and can differ at night. Colours close to each other (CIE76 distance <= TOL) share a token, named for
the most used one; a rare colour with no core token within NEAR in its role and family gets a token of its own (nothing is
approximated visibly, nothing dropped). Colours that are not in `property: value` form (a JS object key, an attribute, canvas
drawing) are role d, data: they get tokens too (`--d-*`) but are never rewritten automatically; a person replaces each one
(a CSS value with var(), drawing code with FP.theme.token) and `lookup` says which token.
"""
import re, sys, os, json, glob, math, colorsys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
KERNEL = os.path.abspath(os.path.join(HERE, '..', '..'))
MAP = os.path.join(HERE, 'colour-map.json')
FILES = sorted(glob.glob(os.path.join(KERNEL, 'fp-*.js'))) + [os.path.join(KERNEL, f) for f in ('launcher.html', 'editor.html', 'shell-launcher.html', 'shell-editor.html', 'kernel-test.html')]
THEME = os.path.join(KERNEL, 'fp-theme.js')
TOL, NEAR, MIN_CORE = 3.5, 8.0, 4
HEX = re.compile(r'#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b(?![0-9a-fA-F])')

TEXT = ('color', 'caret-color', 'fill', 'text-decoration-color', '-webkit-text-fill-color', 'column-rule-color')
def role_of(prop):
    if not prop: return None
    if prop in TEXT: return 't'
    if prop.startswith('background'): return 's'
    if prop.startswith('border') or prop.startswith('outline') or prop in ('stroke',): return 'l'
    return None

def norm(h):
    h = h.lower()
    return '#' + (''.join(c * 2 for c in h[1:]) if len(h) == 4 else h[1:])
def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
def lab(h):
    f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = [f(c / 255) for c in rgb(h)]
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047; y = 0.2126 * r + 0.7152 * g + 0.0722 * b; z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    t = lambda v: v ** (1 / 3) if v > 0.008856 else 7.787 * v + 16 / 116
    fx, fy, fz = t(x), t(y), t(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))
def dE(a, b): return math.dist(lab(a), lab(b))
def family(h):
    r, g, b = [c / 255 for c in rgb(h)]
    hh, l, s = colorsys.rgb_to_hls(r, g, b); hue = hh * 360
    if s < 0.30 or l > 0.96 or l < 0.06: return 'n'
    if hue < 18 or hue >= 335: return 'red'
    if hue < 48: return 'amber'
    if hue < 70: return 'yellow'
    if hue < 165: return 'green'
    if hue < 200: return 'teal'
    if hue < 252: return 'blue'
    return 'violet' if hue < 320 else 'pink'

def occurrences(text):
    """Every colour literal: (start, end, hex, property or None). The property is the one the colour is written after, in
    `property: value` form (CSS text, also inside JS strings and objects with the same key names)."""
    out = []
    for m in HEX.finditer(text):
        before = text[max(0, m.start() - 80):m.start()]
        pm = re.search(r'(?:^|[\s;{(,"\'`])([a-z][a-z-]*)\s*:\s*[^;{}]*$', before)
        prop = pm.group(1) if pm else None
        # `fill="#abc"` / `stroke='#abc'` attribute forms and JS `.color = '#abc'` are not property: value; leave them
        out.append((m.start(), m.end(), norm(m.group(0)), prop))
    return out

def build_map():
    uses = collections.defaultdict(collections.Counter)   # (role, hex) -> count ; role None = unknown context
    for f in FILES:
        if os.path.abspath(f) == THEME: continue
        for _, _, h, prop in occurrences(open(f).read()): uses[role_of(prop)][h] += 1
    tokens, mapping = {}, {}
    for role in ('t', 's', 'l'):
        byfam = collections.defaultdict(list)
        for h, c in uses[role].items(): byfam[family(h)].append((h, c))
        for fam, lst in byfam.items():
            lst.sort(key=lambda x: -x[1]); clusters = []
            for h, c in lst:
                for k in clusters:
                    if dE(h, k['hex']) <= TOL: k['members'].append(h); k['n'] += c; break
                else: clusters.append({'hex': h, 'n': c, 'members': [h]})
            core = [k for k in clusters if k['n'] >= MIN_CORE]
            for k in core:
                L = round(lab(k['hex'])[0]); name = f'{role}-{fam}-{L}'
                while name in tokens: name += 'b'
                tokens[name] = {'day': k['hex'], 'uses': k['n'], 'role': role, 'family': fam}
                for m in k['members']: mapping[f'{role}:{m}'] = {'token': name, 'dE': round(dE(m, k['hex']), 1)}
            for k in clusters:
                if k in core: continue
                for m in k['members']:
                    best = min(((dE(m, t['day']), n) for n, t in tokens.items() if t['role'] == role and t['family'] == fam), default=None)
                    if best and best[0] <= NEAR: mapping[f'{role}:{m}'] = {'token': best[1], 'dE': round(best[0], 1)}
                    else:
                        L = round(lab(m)[0]); name = f'{role}-{fam}-{L}'
                        while name in tokens: name += 'b'
                        tokens[name] = {'day': m, 'uses': uses[role][m], 'role': role, 'family': fam, 'rare': True}
                        mapping[f'{role}:{m}'] = {'token': name, 'dE': 0.0}
    # role d: colours in drawing code and tables (not property: value form): every colour a token, near ones shared
    byfam = collections.defaultdict(list)
    for h, c in uses[None].items(): byfam[family(h)].append((h, c))
    for fam, lst in byfam.items():
        lst.sort(key=lambda x: -x[1]); clusters = []
        for h, c in lst:
            for k in clusters:
                if dE(h, k['hex']) <= TOL: k['members'].append(h); k['n'] += c; break
            else: clusters.append({'hex': h, 'n': c, 'members': [h]})
        for k in clusters:
            L = round(lab(k['hex'])[0]); name = f'd-{fam}-{L}'
            while name in tokens: name += 'b'
            tokens[name] = {'day': k['hex'], 'uses': k['n'], 'role': 'd', 'family': fam}
            for m in k['members']: mapping[f'd:{m}'] = {'token': name, 'dE': round(dE(m, k['hex']), 1)}
    unknown = {h: c for h, c in uses[None].items()}
    json.dump({'tol': TOL, 'near': NEAR, 'tokens': tokens, 'map': mapping, 'unknownContext': unknown}, open(MAP, 'w'), indent=1, sort_keys=True)
    n_use = sum(sum(c.values()) for r, c in uses.items() if r)
    print(f'{len(tokens)} tokens ({sum(1 for t in tokens.values() if t.get("rare"))} rare, one-colour); {len(mapping)} (role, colour) pairs mapped; colours in drawing code and tables (role d): {sum(unknown.values())} uses, {len(unknown)} distinct')
    print(f'role uses: text {sum(uses["t"].values())}, surface {sum(uses["s"].values())}, line {sum(uses["l"].values())}, other {sum(uses[None].values())}')

def lookup(h):
    mp = load_map()['map']; h = norm(h if h.startswith('#') else '#' + h)
    found = {k.split(':')[0]: v for k, v in mp.items() if k.endswith(':' + h)}
    for r, v in sorted(found.items()): print(f'{h} as {dict(t="text", s="surface", l="line", d="data").get(r, r)}: --{v["token"]}')
    if not found: print(f'{h}: not in the map')

def lab_to_hex(L, a, b):
    fy = (L + 16) / 116; fx = fy + a / 500; fz = fy - b / 200
    inv = lambda t: t ** 3 if t ** 3 > 0.008856 else (t - 16 / 116) / 7.787
    x, y, z = inv(fx) * 0.95047, inv(fy), inv(fz) * 1.08883
    r = 3.2406 * x - 1.5372 * y - 0.4986 * z; g = -0.9689 * x + 1.8758 * y + 0.0415 * z; bl = 0.0557 * x - 0.2040 * y + 1.0570 * z
    enc = lambda c: 12.92 * c if c <= 0.0031308 else 1.055 * max(c, 0) ** (1 / 2.4) - 0.055
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(enc(c) * 255))) for c in (r, g, bl))

def night_of(role, fam, hexv):
    """The night value of a day token, by rule (Lab lightness remapped, hue and most of the chroma kept). See the table in the docs."""
    L, a, b = lab(hexv); chroma_keep = 1.0
    if role == 's':
        if fam == 'n':
            if L >= 95: L2 = 8 + (L - 95) * 1.2                      # the page and card surfaces: dark, the card a step lighter
            elif L >= 80: L2 = 16 + (95 - L) * 0.45                   # shaded surfaces (hover, bands): a little lighter than the cards
            elif L >= 40: L2 = 24 + (80 - L) * 0.15
            else: L2 = L * 0.6                                        # dark chrome (headers, dark buttons) stays dark
        else:
            if L >= 85: L2 = 16 + (100 - L) * 0.6; chroma_keep = 2.4   # tints: a deep tint of the same hue (more chroma: a dark colour needs it to read)
            elif L >= 65: L2 = 28; chroma_keep = 1.2
            else: L2 = L if L >= 30 else L * 0.7                       # strong colours (buttons, bars) stay as they are
    elif role == 't':
        if fam == 'n':
            L2 = L if L >= 55 else max(22, min(95, 103.4 - 0.867 * L))   # light text (white, pale grey) stays: it sits on the dark chrome and strong colours; only dark body text inverts
        else:
            L2 = max(68, min(88, 100 - 0.6 * L)) if L < 75 else 80      # coloured text: lighter, readable on dark
    elif role == 'l':
        if fam == 'n': L2 = 17 + (100 - L) * 0.9 if L >= 60 else L * 0.9
        else: L2 = 30 + (100 - L) * 0.1 if L >= 75 else L; chroma_keep = 0.8 if L >= 75 else 1.0
    else:   # d: drawing colours: lifted a little so they hold on a dark ground
        L2 = L + (68 - L) * 0.3 if L < 68 else L
    if abs(L2 - L) < 0.5 and chroma_keep == 1.0: return hexv
    a2, b2 = a * chroma_keep, b * chroma_keep
    if fam == 'n' and role in ('s', 'l') and math.hypot(a2, b2) < 3: a2, b2 = -0.8, -4.0     # night neutrals share one cool slate cast, so white and slate surfaces agree
    return lab_to_hex(L2, a2, b2)

def night():
    mp = load_map(); text = open(THEME).read()
    rows = []
    for n, t in sorted(mp['tokens'].items()):
        v = night_of(t['role'], t['family'], t['day'])
        if v != t['day']: rows.append(f"  --{n}:{v};")
    text = re.sub(r'(/\*TOKENS-NIGHT\*/\n)(?:[^\n]*\n)*?(/\*END\*/)', lambda m: m.group(1) + '\n'.join(rows) + '\n' + m.group(2), text, count=1, flags=re.S)
    open(THEME, 'w').write(text); print(f'{len(rows)} night tokens written to fp-theme.js (the rest keep their day value)')

def theme():
    """Write the colour tokens into fp-theme.js between its TOKENS markers: day values from the map; the night block is filled by step 4."""
    mp = load_map(); text = open(THEME).read()
    day = '\n'.join(f"  --{n}:{t['day']};" for n, t in sorted(mp['tokens'].items()))
    text = re.sub(r'(/\*TOKENS-DAY\*/\n)(?:[^\n]*\n)*?(/\*END\*/)', lambda m: m.group(1) + day + '\n' + m.group(2), text, count=1, flags=re.S)
    open(THEME, 'w').write(text); print(f'{len(mp["tokens"])} day tokens written to fp-theme.js')

def load_map():
    return json.load(open(MAP))

def apply(path):
    mp = load_map()['map']; text = open(path).read(); out = []; last = 0; done = 0; left = []
    for a, b, h, prop in occurrences(text):
        role = role_of(prop); e = mp.get(f'{role}:{h}') if role else None
        if e: out.append(text[last:a]); out.append(f'var(--{e["token"]})'); last = b; done += 1
        else: left.append((text.count('\n', 0, a) + 1, h, prop))
    out.append(text[last:]); open(path, 'w').write(''.join(out))
    return done, left

def check(paths):
    total = 0
    for f in paths:
        if os.path.abspath(f) == THEME: continue
        occ = occurrences(open(f).read())
        if occ: print(f'{os.path.basename(f):22} {len(occ):4} left'); total += len(occ)
    print(f'{total} colour literals left outside the theme file')
    return total

if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'map': build_map()
    elif cmd == 'theme': theme()
    elif cmd == 'night': night()
    elif cmd == 'lookup':
        for h in sys.argv[2:]: lookup(h)
    elif cmd == 'apply':
        for f in sys.argv[2:]:
            n, left = apply(f)
            print(f'{os.path.basename(f)}: {n} rewritten, {len(left)} left')
            for ln, h, prop in left: print(f'   line {ln}: {h}  ({prop or "not property: value form"})')
    elif cmd == 'check': sys.exit(1 if check([os.path.abspath(f) for f in (sys.argv[2:] or FILES)]) else 0)
    else: print(__doc__)
