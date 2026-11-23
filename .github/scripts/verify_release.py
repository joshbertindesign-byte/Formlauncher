"""Check a release before it is published: python3 verify_release.py <version> <runtime dir>

The release zip kernel-<version>.zip is the one file an admin downloads and drops in the data
folder's updates/ folder (Admin > Updates installs it). It must be exactly what the loose files
in runtime/<version>/ say they are, or an install on a terminal would differ from what is reviewed here.
Exits non-zero, listing every problem, if anything is off. Prints the zip's path when it is fine.
"""
import sys, os, json, hashlib, zipfile

version, runtime = sys.argv[1], sys.argv[2]
folder = os.path.join(runtime, version)
zpath = os.path.join(folder, 'kernel-%s.zip' % version)
bad = []

if not os.path.isfile(zpath):
    sys.exit('Missing %s: build the release (release.py) and commit its zip before tagging v%s.' % (zpath, version))

with zipfile.ZipFile(zpath) as z:
    names = set(z.namelist())
    if 'release.json' not in names:
        sys.exit('%s has no release.json.' % zpath)
    manifest = json.loads(z.read('release.json'))
    if manifest.get('version') != version:
        bad.append('the zip is release %s, but the tag is v%s' % (manifest.get('version'), version))
    files = manifest.get('files', {})
    for name, want in sorted(files.items()):
        if name not in names:
            bad.append('%s is listed in release.json but missing from the zip' % name)
            continue
        data = z.read(name)
        if hashlib.sha256(data).hexdigest() != want:
            bad.append('%s in the zip does not match its hash in release.json' % name)
        # The loose copy committed beside the zip (fp-*.js only: the shell pages are written by the installer).
        loose = os.path.join(folder, name)
        if name.startswith('fp-') and name.endswith('.js'):
            if not os.path.isfile(loose):
                bad.append('%s is in the zip but not committed in runtime/%s/' % (name, version))
            elif open(loose, 'rb').read() != data:
                bad.append('%s differs between the zip and the committed runtime/%s/ copy' % (name, version))
    for name in sorted(names - set(files) - {'release.json'}):
        bad.append('%s is in the zip but not listed (and hashed) in release.json' % name)
    loaded = {m for page in manifest.get('load', {}).values() for m in page}
    for m in sorted(loaded):
        if m + '.js' not in names:
            bad.append('release.json loads %s but the zip has no %s.js' % (m, m))


if bad:
    sys.exit('Release v%s refused:\n  ' % version + '\n  '.join(bad))
print(zpath)
