/* Form Platform kernel: media (0.42)
 * Load after fp-users.js and fp-lookup.js, before fp-defs.js.
 *
 * Media is plain files in the data folder's media folder. Nothing keeps a list of them but the forms:
 *
 *   A form's media list (def.media): files it uses, picked from media/ (or added there from the editor),
 *   each with tags of your own: [{ path: "setup-sheets/Press 2/D-1047 Rev B.pdf", title, tags: { die: "D-1047" } }].
 *   A Media field or a Read first shows the files of the list whose tags match what the form says
 *   (where: { die: "dieNo" } shows files tagged die = the Die no. field). A file's revision is its
 *   modified time: Read first asks again when the file changes.
 *
 *   Signatures and photos a form captures are saved into media/ with what they belong to in the file name
 *   (the only files named that way), so a report can find them by their data:
 *     media/signatures/2026-11/die-setup_DS-T01-20261118-0830-0032_signature_Dana-Ruiz_2026-11-18-083004.png
 *     media/photos/…, media/files/… (files attached in a form)
 *   form _ record ID _ field _ person _ date-time; FP.media.parseName reads one back.
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.users || !FP.lookup) throw new Error('Load fp-users.js and fp-lookup.js before fp-media.js');

  const ROOT = ['media'];
  const TAG_RE = /^[a-z][a-zA-Z0-9]{0,30}$/;
  const CAPTURE_DIRS = { signature: 'signatures', photo: 'photos', file: 'files' };
  const SKIP = new Set(Object.values(CAPTURE_DIRS));
  const MAX = 25 * 1024 * 1024;

  /* ---------- Names and paths ---------- */
  /* A file name Windows and OneDrive accept, keeping the extension. */
  function safeName(name) {
    let s = String(name || 'file').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\s+/g, ' ').replace(/-{2,}/g, '-').trim();
    const dot = s.lastIndexOf('.');
    let base = dot > 0 ? s.slice(0, dot) : s, ext = dot > 0 ? s.slice(dot).slice(0, 12) : '';
    base = base.replace(/^[.\s-]+|[.\s]+$/g, '').slice(0, 90) || 'file';
    return base + ext;
  }
  /* A path inside media/: "a/b/c.pdf", no .. or empty parts. */
  const split = p => String(p || '').replace(/\\/g, '/').split('/').map(x => x.trim()).filter(x => x && x !== '.' && x !== '..');
  const join = parts => parts.join('/');
  const extOf = n => { const m = String(n || '').match(/\.([A-Za-z0-9]{1,8})$/); return m ? m[1].toLowerCase() : ''; };
  const TYPES = { pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', txt: 'text/plain', htm: 'text/html', html: 'text/html', mp4: 'video/mp4' };
  const typeOf = n => TYPES[extOf(n)] || '';
  const isImage = n => /^image\//.test(typeOf(n));
  /* Files that can carry script (HTML, SVG, XML, anything unknown) are only ever shown sandboxed, scripts off (0.45):
   * nobody, admins included, can run code through the platform. PDFs, pictures, text and video are passive. */
  const PASSIVE = /^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/plain|video\/mp4)$/;
  const isActive = type => !PASSIVE.test(String(type || ''));
  const titleOf = path => { const n = split(path).pop() || ''; return n.replace(/\.[A-Za-z0-9]{1,8}$/, ''); };

  /* ---------- Tags ---------- */
  /* { die: 'D-1047' | ['D-1047', 'D-1052'] } -> { die: ['D-1047', 'D-1052'] }; "all" matches anything. */
  function cleanTags(tags) {
    const out = {};
    for (const [name, raw] of Object.entries(tags || {})) {
      if (!TAG_RE.test(name)) throw new Error(`${name} can't be a tag name: a lowercase letter, then letters and digits (e.g. die, press).`);
      const list = (Array.isArray(raw) ? raw : [raw]).map(v => (v == null ? '' : String(v).trim())).filter(Boolean);
      if (list.length) out[name] = Array.from(new Set(list));
    }
    return out;
  }
  /* "die: D-1047, D-1052; kind: setup sheet" <-> { die: [...], kind: [...] } */
  function parseTags(text) {
    const out = {};
    String(text || '').split(/[;\n]/).map(x => x.trim()).filter(Boolean).forEach(part => {
      const m = /^([A-Za-z][A-Za-z0-9]*)\s*[:=]\s*(.*)$/.exec(part);
      if (!m) throw new Error(`"${part}" isn't a tag: write name: value, e.g. die: D-1047`);
      const name = m[1][0].toLowerCase() + m[1].slice(1);
      out[name] = m[2].split(',').map(v => v.trim()).filter(Boolean);
    });
    return cleanTags(out);
  }
  const tagsText = tags => Object.entries(tags || {}).map(([k, v]) => `${k}: ${[].concat(v).join(', ')}`).join('; ');
  const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
  /* Does a file's tags match every wanted tag? wanted: { die: 'D-1047' | ['D-1047', …] }. A wanted value
   * that is blank matches nothing (the form hasn't said which yet); a file tag "all" matches any value. */
  function matches(tags, wanted) {
    for (const [name, want] of Object.entries(wanted || {})) {
      const wants = [].concat(want).filter(v => v != null && v !== '');
      if (!wants.length) return false;
      const have = [].concat((tags || {})[name] || []);
      if (!have.some(h => same(h, 'all') || wants.some(w => same(h, w)))) return false;
    }
    return true;
  }

  /* ---------- The media folder ---------- */
  async function dirOf(parts, create) { return FP.folder.dir(ROOT.concat(parts), !!create); }
  /* A file of media/: { path, name, size, lastModified, type, image } or null when it isn't there. */
  async function stat(path) {
    const parts = split(path);
    if (!parts.length) return null;
    try {
      const d = await dirOf(parts.slice(0, -1), false);
      const f = await (await d.getFileHandle(parts[parts.length - 1])).getFile();
      return { path: join(parts), name: f.name, size: f.size, lastModified: f.lastModified, type: f.type || typeOf(f.name), image: isImage(f.name) };
    } catch (e) { if (e && (e.name === 'NotFoundError' || e.name === 'TypeMismatchError' || e.name === 'NotAllowedError')) return null; throw e; }
  }
  async function file(path) {
    const parts = split(path);
    if (!parts.length) return null;
    return FP.files.readFile(ROOT.concat(parts.slice(0, -1)), parts[parts.length - 1]).catch(() => null);
  }
  /* One folder of media/: its folders and files. parts: [] for media/ itself. Captured signatures and photos are left out at the top. */
  async function browse(parts) {
    parts = split(join(parts || []));
    const folders = [], files = [];
    let d;
    try { d = await dirOf(parts, false); } catch (e) { if (e && e.name === 'NotFoundError') return { path: join(parts), folders, files }; throw e; }
    for await (const [name, h] of d.entries()) {
      if (name.startsWith('.') || name.startsWith('~$')) continue;
      if (h.kind === 'directory') { if (!(parts.length === 0 && SKIP.has(name))) folders.push(name); continue; }
      const f = await h.getFile().catch(() => null);
      files.push({ path: join(parts.concat(name)), name, size: f ? f.size : null, lastModified: f ? f.lastModified : null, image: isImage(name) });
    }
    folders.sort((a, b) => a.localeCompare(b));
    files.sort((a, b) => a.name.localeCompare(b.name));
    return { path: join(parts), folders, files };
  }
  /* Put a file into media/<folder>/ under its own name (a number is added if that name is taken). Resolves its path. */
  async function add(blob, folder, name) {
    if (!blob) throw new Error('Choose a file.');
    if (blob.size > MAX) throw new Error(`That file is ${Math.round(blob.size / 1048576)} MB; the most is ${Math.round(MAX / 1048576)} MB.`);
    const parts = split(folder);
    if (parts.length && SKIP.has(parts[0])) throw new Error(`media/${parts[0]} is where forms save what they capture; pick another folder.`);
    let n = safeName(name || blob.name || 'file');
    const dot = n.lastIndexOf('.');
    const base = dot > 0 ? n.slice(0, dot) : n, ext = dot > 0 ? n.slice(dot) : '';
    for (let i = 2; await stat(join(parts.concat(n))); i++) n = `${base} (${i})${ext}`;
    await FP.files.writeBlob(ROOT.concat(parts), n, blob);
    return join(parts.concat(n));
  }

  /* ---------- Opening ---------- */
  /* Resolves { path, file, url }; a missing file throws with code 'missing'. */
  async function open(path) {
    const f = await file(path);
    if (!f) { const e = new Error(`Can't find media/${join(split(path))}. It may have been moved, renamed or deleted, or not synced to this computer yet.`); e.code = 'missing'; throw e; }
    const type = f.type || typeOf(f.name);
    const blob = type && f.type !== type ? new Blob([f], { type }) : f;
    return { path: join(split(path)), file: f, url: URL.createObjectURL(blob), type, active: isActive(type) };
  }
  /* In a new tab: the browser's own PDF and image viewer. A file that could carry script opens inside a sandboxed
   * frame in the new tab, and the tab can't reach back to this page. */
  async function view(path) {
    const r = await open(path);
    let w;
    if (!r.active) w = window.open(r.url, '_blank', 'noopener');
    else {
      w = window.open('about:blank', '_blank');
      if (w) {
        w.opener = null;
        const d = w.document;
        d.title = r.path;
        d.body.style.cssText = 'margin:0';
        const fr = d.createElement('iframe');
        fr.setAttribute('sandbox', '');
        fr.src = r.url;
        fr.style.cssText = 'border:0;width:100vw;height:100vh;display:block';
        d.body.appendChild(fr);
      }
    }
    setTimeout(() => URL.revokeObjectURL(r.url), 60000);
    return Object.assign(r, { opened: !!w || !r.active });
  }

  /* ---------- A form's media list ---------- */
  /* def.media, tidied: [{ path, title, tags }] */
  function listOf(def) {
    return (Array.isArray(def && def.media) ? def.media : []).filter(m => m && typeof m.path === 'string' && split(m.path).length)
      .map(m => ({ path: join(split(m.path)), title: m.title || titleOf(m.path), tags: m.tags || {} }));
  }
  /* The files of a form's list that match, each with its file's state now: { path, title, tags, missing, lastModified, image }. */
  async function pick(def, wanted) {
    const out = [];
    for (const m of listOf(def)) {
      if (!matches(m.tags, wanted)) continue;
      const s = await stat(m.path).catch(() => null);
      out.push(Object.assign({}, m, s ? { missing: false, lastModified: s.lastModified, size: s.size, image: s.image } : { missing: true, image: isImage(m.path) }));
    }
    return out;
  }
  /* Problems with a form's media list, for publish. */
  function check(def) {
    const p = [];
    if (def.media == null) return p;
    if (!Array.isArray(def.media)) return ['media is a list of files: [{ path, title, tags }]'];
    const seen = new Set();
    def.media.forEach((m, i) => {
      const w = `Media ${i + 1}`;
      if (!m || typeof m !== 'object' || typeof m.path !== 'string' || !split(m.path).length) { p.push(`${w}: needs the path of a file in the media folder`); return; }
      const path = join(split(m.path));
      if (seen.has(path.toLowerCase())) p.push(`${w}: ${path} is on the list twice`);
      seen.add(path.toLowerCase());
      if (SKIP.has(split(m.path)[0])) p.push(`${w}: media/${split(m.path)[0]} holds what forms capture; attach files from another folder`);
      try { cleanTags(m.tags); } catch (e) { p.push(`${w}: ${e.message}`); }
    });
    return p;
  }

  /* ---------- Captured signatures, photos and files ---------- */
  const part = s => String(s == null || s === '' ? 'none' : s).normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '').replace(/[\s_]+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'none';
  const stamp = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
  /* Save what a form captured: kind signature | photo | file. Resolves its path inside media/. */
  async function capture(kind, blob, info) {
    const dir = CAPTURE_DIRS[kind] || 'files';
    if (blob.size > MAX) throw new Error(`That file is ${Math.round(blob.size / 1048576)} MB; the most is ${Math.round(MAX / 1048576)} MB.`);
    const at = info.at ? new Date(info.at) : new Date();
    const month = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
    const ext = extOf(blob.name) || (/png/.test(blob.type) ? 'png' : /jpe?g/.test(blob.type) ? 'jpg' : /pdf/.test(blob.type) ? 'pdf' : 'bin');
    const base = [part(info.form), part(info.record), part(info.field), part(info.user), stamp(at)].join('_');
    let name = `${base}.${ext}`;
    for (let i = 2; await stat(join([dir, month, name])); i++) name = `${base}-${i}.${ext}`;
    await FP.files.writeBlob(ROOT.concat([dir, month]), name, blob);
    return join([dir, month, name]);
  }
  /* A captured file's name read back: { form, record, field, user, at } (null for other files). */
  function parseName(pathOrName) {
    const n = split(pathOrName).pop() || '';
    const m = /^([^_]+)_([^_]+)_([^_]+)_([^_]+)_(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})(?:-\d+)?\.[A-Za-z0-9]+$/.exec(n);
    if (!m) return null;
    return { form: m[1], record: m[2], field: m[3], user: m[4], at: `${m[5]}-${m[6]}-${m[7]}T${m[8]}:${m[9]}:${m[10]}` };
  }
  const captureKind = f => (f.control === 'draw' ? 'signature' : f.control === 'file' && (f.camera || /image/.test(f.accept || '')) ? 'photo' : 'file');

  FP.media = {
    ROOT, TAG_RE, maxBytes: MAX, CAPTURE_DIRS,
    safeName, split: p => split(p), titleOf, isImage, typeOf,
    cleanTags, parseTags, tagsText, matches,
    stat, file, browse, add, open, view,
    listOf, pick, check,
    capture, parseName, captureKind,
  };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-media'] = '0.60.0';
})();
