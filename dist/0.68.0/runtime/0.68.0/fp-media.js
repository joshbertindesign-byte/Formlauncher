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
 *   The media library (0.61): every file a form shows has one entry, with an internal name, tags and a folder of
 *   media/library/, kept in the built-in List media-library (forms can pick from it like any list). New versions
 *   replace the file and keep the old one in the entry's history. Tag names are set once (media-tags), each typed
 *   freely or linked to a List structure whose items in use are its values. A form's media list names entries
 *   ({ entry: 'M-…' }) or every entry with some tags ({ library: { kind: 'setup sheet' } }); the older
 *   { path, title, tags } still works.
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
  const LIBDIR = 'library';   // media/library: the library's own files (0.61)
  const SKIP = new Set(Object.values(CAPTURE_DIRS).concat(LIBDIR));
  const MAX = 25 * 1024 * 1024;
  const RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;
  const isSkip = name => SKIP.has(String(name || '').toLowerCase());   // Windows folder names ignore case

  /* ---------- Names and paths ---------- */
  /* A file name Windows and OneDrive accept, keeping the extension. */
  function safeName(name) {
    let s = String(name || 'file').normalize('NFKC').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/\s+/g, ' ').replace(/-{2,}/g, '-').trim();
    const dot = s.lastIndexOf('.');
    let base = dot > 0 ? s.slice(0, dot) : s, ext = dot > 0 ? s.slice(dot).slice(0, 12) : '';
    base = base.replace(/^[.\s-]+|[.\s]+$/g, '').slice(0, 90) || 'file';
    if (RESERVED.test(base)) base = '_' + base;   // Windows can't have a file called CON, NUL, COM1 ... even with an extension
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
      if (h.kind === 'directory') { if (!(parts.length === 0 && isSkip(name))) folders.push(name); continue; }
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
    if (parts.length && isSkip(parts[0])) throw new Error(`media/${parts[0]} is where forms save what they capture; pick another folder.`);
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
    // The blob URL is not revoked: a viewer that reloads the PDF (or a slow tab) needs it for as long as this page lives.
    return Object.assign(r, { opened: !!w || !r.active });
  }

  /* ---------- A form's media list ---------- */
  /* def.media, worked out: [{ path, title, tags, entry?, revision? }]. Library entries come from the library as last
   * loaded (FP.media.library.load), each once even when two of the list's lines name it. */
  function listOf(def) {
    const out = [], seen = new Set();
    const push = m => { const k = (m.entry || m.path).toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push(m); } };
    const fromEntry = e => ({ path: e.path, title: e.name, tags: e.tags || {}, entry: e.id, revision: e.revision, folder: e.folder });
    (Array.isArray(def && def.media) ? def.media : []).forEach(m => {
      if (!m || typeof m !== 'object') return;
      if (typeof m.entry === 'string') { const e = libCache.byId.get(m.entry); if (e && e.active) push(fromEntry(e)); else push({ path: '', title: e ? `${e.name} (retired)` : m.entry, tags: {}, entry: m.entry, gone: true }); return; }
      if (m.library && typeof m.library === 'object') { libCache.list.filter(e => e.active && matches(e.tags, m.library)).forEach(e => push(fromEntry(e))); return; }
      if (typeof m.path === 'string' && split(m.path).length) push({ path: join(split(m.path)), title: m.title || titleOf(m.path), tags: m.tags || {} });
    });
    return out;
  }
  /* The files of a form's list that match, each with its file's state now: { path, title, tags, missing, lastModified, image }. */
  async function pick(def, wanted) {
    const out = [];
    if ((Array.isArray(def && def.media) ? def.media : []).some(m => m && (m.entry || m.library))) await library.load().catch(() => null);
    for (const m of listOf(def)) {
      if (m.gone) continue;
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
      // From the library (0.61): an entry, or every entry with some tags.
      if (m && typeof m === 'object' && m.entry != null) {
        if (typeof m.entry !== 'string' || !m.entry) p.push(`${w}: say which library entry`);
        else if (seen.has('entry:' + m.entry)) p.push(`${w}: that library entry is on the list twice`);
        else if (!libCache.loaded) { p.push(`${w}: the media library hasn't been read on this terminal yet, so ${m.entry} can't be checked; try again in a moment`); library.load().catch(() => null); }
        else if (!libCache.byId.has(m.entry)) p.push(`${w}: there is no library entry ${m.entry}`);
        else if (!libCache.byId.get(m.entry).active) p.push(`${w}: ${libCache.byId.get(m.entry).name} is retired from the library`);
        seen.add('entry:' + m.entry);
        return;
      }
      if (m && typeof m === 'object' && m.library != null) {
        if (typeof m.library !== 'object' || Array.isArray(m.library)) p.push(`${w}: every library entry tagged … is { tag: value }`);
        else try { cleanTags(m.library); } catch (e) { p.push(`${w}: ${e.message}`); }
        return;
      }
      if (!m || typeof m !== 'object' || typeof m.path !== 'string' || !split(m.path).length) { p.push(`${w}: needs the path of a file in the media folder, or a library entry`); return; }
      const path = join(split(m.path));
      if (seen.has(path.toLowerCase())) p.push(`${w}: ${path} is on the list twice`);
      seen.add(path.toLowerCase());
      if (isSkip(split(m.path)[0])) p.push(split(m.path)[0].toLowerCase() === LIBDIR ? `${w}: a file of the library is named by its entry` : `${w}: media/${split(m.path)[0]} holds what forms capture; attach files from another folder`);
      try { cleanTags(m.tags); } catch (e) { p.push(`${w}: ${e.message}`); }
    });
    return p;
  }


  /* ---------- The media library (0.61) ---------- */
  const LIB = 'media-library', LIBTAGS = 'media-tags';
  FP.structures.define({ id: LIB, version: 1, label: 'Media library', kind: 'list', roles: { active: 'active' }, itemId: { label: 'Entry', made: 'entered' },
    containers: { name: {}, path: {}, folder: {}, tags: {}, type: {}, size: {}, revision: {}, revisedAt: {}, revisedBy: {}, history: {}, note: {}, from: {}, active: {} },
    status: [{ value: 'Retired', when: 'active = FALSE' }, { value: 'Active', when: 'TRUE' }] });
  FP.structures.define({ id: LIBTAGS, version: 1, label: 'Media tag names', containers: { list: {}, active: {} } });
  const libCache = { loaded: false, list: [], byId: new Map(), tags: [] };
  const shapeEntry = it => {
    const v = it.values || {};
    return { id: it.id, name: v.name || it.id, path: v.path || '', folder: v.folder || '', tags: v.tags && typeof v.tags === 'object' ? v.tags : {}, type: v.type || typeOf(v.path || ''),
      size: v.size == null ? null : v.size, revision: v.revision || 1, revisedAt: v.revisedAt || it.firstAt || null, revisedBy: v.revisedBy || null,
      history: Array.isArray(v.history) ? v.history : [], note: v.note || '', from: v.from || '', active: v.active !== false, firstAt: it.firstAt, lastAt: it.lastAt };
  };
  async function mustPublisher() {
    if (!FP.users || !(await FP.users.can('publisher'))) throw new Error('Only a publisher or an admin can change the media library.');
  }
  const recLib = (action, id, values) => FP.entry.record({ entry: `${LIB}.${action}`, item: { structure: LIB, id }, form: { id: 'media-library', version: 1 }, values });
  const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const folderOk = f => split(f).filter(x => !x.startsWith('.')).map(x => safeName(x).replace(/\.[^.]*$/, '') || x);
  // A file of the library: media/library/<folder>/<name><.ext>, a number added when the name is taken.
  async function putFile(blob, folder, base, ext) {
    if (!blob) throw new Error('Choose a file.');
    if (blob.size > MAX) throw new Error(`That file is ${Math.round(blob.size / 1048576)} MB; the most is ${Math.round(MAX / 1048576)} MB.`);
    const parts = [LIBDIR].concat(folderOk(folder));
    const b = safeName(base + ext).replace(/\.[A-Za-z0-9]{1,8}$/, '') || 'file';
    let n = b + ext;
    for (let i = 2; await stat(join(parts.concat(n))); i++) n = `${b} (${i})${ext}`;
    await FP.files.writeBlob(ROOT.concat(parts), n, blob);
    return join(parts.concat(n));
  }
  const extFrom = (blob, fallback) => { const e = extOf(blob && blob.name) || extOf(fallback); return e ? '.' + e : ''; };
  const checkName = (name, exceptId) => {
    const n = String(name || '').trim();
    if (!n) throw new Error('Give it an internal name, e.g. D-1047 setup sheet.');
    if (n.length > 90) throw new Error('A name is at most 90 characters.');
    const clash = libCache.list.find(e => e.active && e.id !== exceptId && sameName(e.name, n));
    if (clash) throw new Error(`${clash.name} is already in the library: give this one another name, or replace that one with a new version.`);
    return n;
  };
  const library = {
    STRUCTURE: LIB, TAGS: LIBTAGS, DIR: LIBDIR,
    /* Every entry (retired ones too, marked), and the tag names; kept for listOf and the editor's map. */
    async load(opts) {
      const fresh = !!(opts && opts.fresh);
      const [r, t] = await Promise.all([FP.current.load(LIB, { fresh }), FP.current.load(LIBTAGS, { fresh })]);
      libCache.list = Array.from(r.items.values()).map(shapeEntry).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      libCache.byId = new Map(libCache.list.map(e => [e.id, e]));
      libCache.tags = Array.from(t.items.values()).filter(it => (it.values || {}).active !== false)
        .map(it => ({ name: it.id, list: (it.values || {}).list || null })).sort((a, b) => a.name.localeCompare(b.name));
      libCache.loaded = true;
      return libCache.list;
    },
    cached: () => libCache.list.slice(),
    loaded: () => libCache.loaded,
    get: id => libCache.byId.get(id) || null,
    tags: () => libCache.tags.slice(),
    folders: () => Array.from(new Set(libCache.list.filter(e => e.active).map(e => e.folder).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    /* The values a tag has been given, and for a tag linked to a list, that list's items in use: [{ value, onList }]. */
    async valuesFor(tag) {
      const t = libCache.tags.find(x => x.name === tag);
      const used = new Set(libCache.list.filter(e => e.active).flatMap(e => [].concat((e.tags || {})[tag] || [])));
      let listed = [];
      if (t && t.list && FP.structures.has(t.list)) {
        const r = await FP.current.load(t.list).catch(() => null);
        listed = r ? Array.from(r.items.values()).filter(it => !FP.kinds || FP.kinds.isOpen(t.list, it)).map(it => it.id) : [];
      }
      const out = listed.map(v => ({ value: v, onList: true }));
      used.forEach(v => { if (!listed.some(x => same(x, v))) out.push({ value: v, onList: !t || !t.list }); });
      return out.sort((a, b) => String(a.value).localeCompare(String(b.value), undefined, { numeric: true }));
    },
    /* A tag name for the whole library, typed freely or linked to a List structure (its items in use are the values). */
    async setTag(name, opts) {
      await mustPublisher();
      if (!TAG_RE.test(name || '')) throw new Error(`${name || 'That'} can't be a tag name: a lowercase letter, then letters and digits (e.g. die, profile).`);
      const list = opts && opts.list ? opts.list : null;
      if (list && !(FP.structures.has(list) && FP.structures.get(list).kind === 'list')) throw new Error(`${list} isn't a List structure.`);
      await FP.entry.record({ entry: `${LIBTAGS}.set`, item: { structure: LIBTAGS, id: name }, form: { id: 'media-library', version: 1 }, values: { list: list || '', active: true } });
      FP.current.clearCache(); await library.load({ fresh: true });
    },
    async removeTag(name) {
      await mustPublisher();
      await FP.entry.record({ entry: `${LIBTAGS}.remove`, item: { structure: LIBTAGS, id: name }, form: { id: 'media-library', version: 1 }, values: { active: false } });
      FP.current.clearCache(); await library.load({ fresh: true });
    },
    /* Bring a file in: { name, tags, folder, note }. Copied into media/library/<folder>/ under its name. Resolves the entry. */
    async add(blob, o) {
      await mustPublisher();
      o = o || {};
      if (!libCache.loaded) await library.load();
      const name = checkName(o.name);
      const tags = cleanTags(o.tags || {});
      const folder = join(folderOk(o.folder || ''));
      const path = await putFile(blob, folder, name, extFrom(blob, o.from));
      const id = 'M-' + await FP.entry.newId();
      const who = FP.users ? await FP.users.current().catch(() => null) : null;
      await recLib('add', id, { name, path, folder, tags, type: (blob && blob.type) || typeOf(path), size: blob ? blob.size : null, revision: 1, revisedAt: new Date().toISOString(), revisedBy: who ? who.name : null,
        history: [], note: o.note ? String(o.note).slice(0, 500) : '', active: true, from: o.from || '' });
      FP.current.clearCache(); await library.load({ fresh: true });
      return libCache.byId.get(id);
    },
    /* An entry that came in a pack (F5): made here under the id it has in the pack, so the forms that name it work as they
     * are. When an active entry with the same internal name is here already, that one is used instead (how: 'remapped',
     * and the pack's forms are pointed at it); one with the same id is left alone (how: 'same'). blob is the file the pack
     * carried, or null; file says whether the entry's file is in this folder afterwards. */
    async importEntry(x, blob) {
      await mustPublisher();
      await library.load({ fresh: true });
      if (!x || !/^M-[A-Za-z0-9-]{1,80}$/.test(String(x.id || ''))) throw new Error('A library entry in the pack has no usable ID.');
      const have = libCache.byId.get(x.id);
      if (have) return { entry: have, how: 'same', file: !!(await stat(have.path)) };
      const dup = libCache.list.find(e => e.active && sameName(e.name, x.name));
      if (dup) return { entry: dup, how: 'remapped', file: !!(await stat(dup.path)) };
      const name = checkName(String(x.name || x.id).slice(0, 90));
      const folder = join(folderOk(x.folder || ''));
      let path = x.path ? join(split(x.path)) : '';
      if (blob) path = await putFile(blob, folder, name, extFrom(blob, x.path));
      await recLib('add', x.id, { name, path, folder, tags: cleanTags(x.tags || {}), type: x.type || typeOf(path), size: x.size == null ? null : x.size, revision: x.revision || 1,
        revisedAt: new Date().toISOString(), revisedBy: null, history: [], note: x.note ? String(x.note).slice(0, 500) : '', active: true, from: 'pack' });
      FP.current.clearCache(); await library.load({ fresh: true });
      return { entry: libCache.byId.get(x.id), how: 'new', file: !!blob || !!(path && await stat(path)) };
    },
    /* A tag name that came in a pack: added when it isn't here; a link to a list is kept only when that list is a structure here. */
    async importTag(name, list) {
      await mustPublisher();
      if (!TAG_RE.test(name || '')) throw new Error(`${name || 'That'} can't be a tag name.`);
      if (!libCache.loaded) await library.load();
      if (libCache.tags.some(t => t.name === name)) return false;
      const ok = list && FP.structures.has(list) && FP.structures.get(list).kind === 'list';
      await FP.entry.record({ entry: `${LIBTAGS}.set`, item: { structure: LIBTAGS, id: name }, form: { id: 'media-library', version: 1 }, values: { list: ok ? list : '', active: true } });
      FP.current.clearCache(); await library.load({ fresh: true });
      return true;
    },
    /* A file already in the media folder, brought into the library (copied; the file stays where it was). */
    async adopt(path, o) {
      const f = await file(path);
      if (!f) throw new Error(`Can't find media/${join(split(path))}.`);
      return library.add(f, Object.assign({ from: join(split(path)) }, o || {}));
    },
    /* Change an entry's name, tags or note (its file and folder stay). */
    async update(id, changes) {
      await mustPublisher();
      if (!libCache.loaded) await library.load();
      const e = libCache.byId.get(id);
      if (!e) throw new Error('That library entry is gone.');
      const values = {};
      if (changes.name != null) values.name = checkName(changes.name, id);
      if (changes.tags != null) values.tags = cleanTags(changes.tags);
      if (changes.note != null) values.note = String(changes.note).slice(0, 500);
      if (!Object.keys(values).length) return e;
      await recLib('update', id, values);
      FP.current.clearCache(); await library.load({ fresh: true });
      return libCache.byId.get(id);
    },
    /* Replace with a new version: the new file goes beside the old one (… r2.pdf); forms show it, Read first asks again,
     * and the old one is kept in the entry's history. */
    async revise(id, blob, note) {
      await mustPublisher();
      await library.load({ fresh: true });   // another terminal may have revised it since this one last read
      const e = libCache.byId.get(id);
      if (!e) throw new Error('That library entry is gone.');
      const rev = (e.revision || 1) + 1;
      const path = await putFile(blob, e.folder, `${e.name} r${rev}`, extFrom(blob, e.path));
      const who = FP.users ? await FP.users.current().catch(() => null) : null;
      const history = e.history.concat([{ revision: e.revision || 1, path: e.path, at: e.revisedAt, by: e.revisedBy, note: e.note || '' }]);
      await recLib('revise', id, { path, revision: rev, type: (blob && blob.type) || typeOf(path), size: blob ? blob.size : null, revisedAt: new Date().toISOString(), revisedBy: who ? who.name : null, history, note: note ? String(note).slice(0, 500) : '' });
      FP.current.clearCache(); await library.load({ fresh: true });
      return libCache.byId.get(id);
    },
    /* Retire (forms stop showing it; the file stays) or bring back. */
    async setActive(id, on) {
      await mustPublisher();
      if (!libCache.loaded) await library.load();
      const e = libCache.byId.get(id);
      if (!e) throw new Error('That library entry is gone.');
      if (on) checkName(e.name, id);
      await recLib(on ? 'restore' : 'retire', id, { active: !!on });
      FP.current.clearCache(); await library.load({ fresh: true });
    },
    /* Files in the media folder that aren't in the library (and aren't captures): to bring in. */
    async loose(parts) {
      const r = await browse(parts || []);
      const inLib = new Set(libCache.list.flatMap(e => [e.from, e.path].concat(e.history.map(h => h.path))).filter(Boolean).map(x => x.toLowerCase()));
      return Object.assign(r, { files: r.files.map(f => Object.assign(f, { inLibrary: inLib.has(f.path.toLowerCase()) })) });
    },
    /* Forms whose media list shows an entry (by name, or by a tag rule that takes it in). */
    usedBy(id) {
      const e = libCache.byId.get(id);
      if (!e || !FP.defs) return [];
      const shows = def => (Array.isArray(def.media) ? def.media : []).some(m => m && typeof m === 'object' && (m.entry === id || (m.library && typeof m.library === 'object' && !Array.isArray(m.library) && matches(e.tags, m.library))));
      return Array.from(new Set(FP.defs.list('form').filter(d => !d.retired && d.def && shows(d.def)).map(d => d.id)));
    },
  };

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
    listOf, pick, check, library,
    capture, parseName, captureKind,
  };

  /* Registered last, so a module that failed partway never reports as loaded. */
  (window.FP.modules = window.FP.modules || {})['fp-media'] = '0.68.0';
})();
