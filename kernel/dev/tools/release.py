# Build a release zip: python3 release.py <kernel dir> <out dir> [version override for tests]
import sys, os, re, json, hashlib, zipfile
src, out = sys.argv[1], sys.argv[2]
override = sys.argv[3] if len(sys.argv) > 3 else None
files = {}
for n in sorted(os.listdir(src)):
    if re.match(r'^fp-[a-z-]+\.js$', n) or n in ('launcher.html', 'editor.html', 'kernel-test.html', 'boot.js', 'shell-launcher.html', 'shell-editor.html'):
        files[n] = open(os.path.join(src, n), 'rb').read()
# Nobody, admins included, may run code through the platform (0.45): no eval or new Function anywhere, and HTML built
# from strings only where it has been reviewed and escapes what it shows. A new innerHTML fails the build until reviewed.
REVIEWED_INNERHTML = {'fp-editor.js': 2, 'fp-help.js': 1}
bad = []
for n, b in files.items():
    if not n.endswith('.js'):
        continue
    code = [l for l in b.decode().split('\n') if not re.match(r'\s*(\*|//|/\*)', l)]
    for i, l in enumerate(code):
        if re.search(r'(?<![\w.])eval\s*\(|new\s+Function\s*\(|set(Timeout|Interval)\s*\(\s*[\'"`]', l):
            bad.append('%s: %s' % (n, l.strip()[:80]))
    count = sum(len(re.findall(r'\.(innerHTML|outerHTML)\s*\+?=|insertAdjacentHTML\s*\(', l)) for l in code)
    if count > REVIEWED_INNERHTML.get(n, 0):
        bad.append('%s: %d HTML-from-string assignments, %d reviewed' % (n, count, REVIEWED_INNERHTML.get(n, 0)))
if bad:
    sys.exit('Refused, code could run from data:\n  ' + '\n  '.join(bad))
lt = files['fp-launcher.js'].decode()
version = re.search(r"const VERSION = '([0-9.]+)'", lt).group(1)
kernel = re.findall(r"'(fp-[a-z-]+)'", re.search(r"const KERNEL = \[([^\]]+)\]", lt).group(1))
if override:
    for n in list(files):
        if n.endswith('.js'):
            files[n] = files[n].replace(("= '%s'" % version).encode(), ("= '%s'" % override).encode())
        if n == 'kernel-test.html':
            files[n] = files[n].replace(("EXPECTED = '%s'" % version).encode(), ("EXPECTED = '%s'" % override).encode())
    version = override
# The test page, as a shell that loads the running release through boot.js like the other pages.
kt = files['kernel-test.html'].decode()
block = re.search(r'(<script src="fp-[a-z-]+\.js"></script>\n)+', kt)
test_load = re.findall(r'<script src="(fp-[a-z-]+)\.js"></script>', block.group(0))
files['shell-kernel-test.html'] = (kt[:block.start()] + '<!-- Written by the installer: it loads whichever release runs (releases.js) through boot.js. Don\'t edit. -->\n'
    + "<script>window.FP_PAGE = 'test';</script>\n<script src=\"releases.js\"></script>\n<script src=\"boot.js\"></script>\n" + kt[block.end():]).encode()
for m in set(kernel + ['fp-map', 'fp-editor', 'fp-form-editor', 'fp-help', 'fp-stress', 'fp-admin'] + test_load):
    assert ("['%s'] = '%s'" % (m, version)).encode() in files[m + '.js'], m
manifest = {
    'version': version,
    'load': {'launcher': kernel, 'editor': kernel + ['fp-map', 'fp-editor', 'fp-form-editor', 'fp-help', 'fp-stress', 'fp-admin'], 'test': test_load},
    'data': {'entry': int(re.search(r'FP.ENTRY_VERSION = (\d+)', files['fp-entry.js'].decode()).group(1))},
    'files': {n: hashlib.sha256(b).hexdigest() for n, b in files.items()},
}
os.makedirs(out, exist_ok=True)
path = os.path.join(out, 'kernel-%s.zip' % version)
with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('release.json', json.dumps(manifest, indent=1))
    for n, b in files.items():
        z.writestr(n, b)
print(path)
