# Set the kernel's version everywhere it is written: python3 dev/tools/bump.py <kernel dir> <new version>
# The version lives in fp-core.js (FP.version); every module registers the same one so a stale file shows up.
# Only the exact version spots are changed; dates and notes such as "(0.44.5)" in comments are left alone.
import sys, os, re
src, new = sys.argv[1], sys.argv[2]
if not re.match(r'^\d+\.\d+\.\d+$', new):
    sys.exit('A version is three numbers: 0.48.0')
core = open(os.path.join(src, 'fp-core.js')).read()
old = re.search(r"FP\.version = '([0-9.]+)'", core).group(1)
SPOTS = [
    r"(\(window\.FP\.modules = window\.FP\.modules \|\| \{\}\)\['[a-z-]+'\] = ')%s(')",
    r"(FP\.version = ')%s(')",
    r"(const VERSION = ')%s(')",
    r"(const EXPECTED = ')%s(')",
    r"(kernel-)%s(\.zip)",
]
changed = 0
names = [n for n in os.listdir(src) if re.match(r'^(fp-[a-z-]+\.js|[a-z-]+\.html)$', n)]
for n in sorted(names):
    p = os.path.join(src, n)
    s = open(p).read()
    t = s
    for spot in SPOTS:
        t, k = re.subn(spot % re.escape(old), lambda m: m.group(1) + new + m.group(2), t)
        changed += k
    if t != s:
        open(p, 'w').write(t)
pack = os.path.join(src, 'dev', 'tests', 'pilot', 'mkpack.js')
if os.path.exists(pack):
    s = open(pack).read()
    t = s.replace("kernel: '%s'" % old, "kernel: '%s'" % new)
    if t != s:
        open(pack, 'w').write(t); changed += 1
# Every module must now say the new version, and nothing quoted may still say the old one.
left = []
for n in sorted(names):
    s = open(os.path.join(src, n)).read()
    if n.endswith('.js') and "FP.modules || {})['" in s and not re.search(r"\['[a-z-]+'\] = '%s'" % re.escape(new), s):
        left.append(n + ': no module version')
    if re.search(r"= '%s'" % re.escape(old), s):
        left.append(n + ": still '%s'" % old)
if left:
    sys.exit('Not done:\n  ' + '\n  '.join(left))
print('%s -> %s: %d places' % (old, new, changed))
