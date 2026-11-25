/* Form Platform: email jobs and the approved-domain list (0.69, roadmap: responsibility-center email, steps 1 and 2)
 * Load after fp-due.js, before fp-launcher.js.
 *
 * NOTHING SENDS YET. This file decides who email may go to and writes finished jobs as files; a sender script on the
 * always-on host (not built yet) picks them up and delivers them.
 *
 * Approved domains: the built-in structure approved-domains, one item (domains) holding { domains: [lower-case names] }.
 * Every change is an entry, so history and revert come for free; only an admin can change it. An empty list is allowed
 * and means "no email may be sent". A domain is matched exactly (the part after the last @, any case): evilcompany.com
 * never matches company.com, and a subdomain matches only when it is listed itself.
 *
 * An email job (version 1) is one JSON file, written whole in one write, at outbox/email/<jobId>.json in the data folder:
 *   { version: 1, action: 'email', jobId, createdAt, mailbox, to: [], cc: [], subject, bodyHtml, bodyText,
 *     attachments: [{ path: 'media/…', name }], runAfter: null | ISO time, source: { rule, center, entryId } | null }
 * The sender moves it to outbox/processing/, then outbox/done/ or outbox/failed/, and writes status/<jobId>.json:
 *   { state: 'sent' | 'failed' | 'rejected', at, attempts, detail }
 *
 *   FP.email.domains(fresh)                the approved list now
 *   FP.email.setDomains(list)              admin only: replace the list (every change is an entry)
 *   FP.email.checkDomain(text)             { ok, domain, problem }: one plausible, lower-cased host name
 *   FP.email.checkAddress(text, domains?)  { ok, address, problem }: one plain address in an approved domain. Synchronous:
 *                                          with no list given it uses the one last read (so read it first), or use
 *                                          FP.email.checkAddressNow(text), which reads the list.
 *   FP.email.queue({ mailbox, to, cc, subject, bodyHtml, bodyText, attachments, runAfter, source })
 *   FP.email.status(jobId)                 { state, at, attempts, detail, folder }
 *   FP.email.list()                        the newest 200 jobs, with their states
 */
(function () {
  'use strict';

  const FP = window.FP;
  if (!FP || !FP.current || !FP.entry || !FP.users || !FP.files) throw new Error('Load fp-users.js and fp-due.js before fp-email.js');

  const STRUCTURE = 'approved-domains';
  const ITEM = 'domains';
  FP.structures.define({ id: STRUCTURE, version: 1, containers: {} });

  const MAX_DOMAINS = 50;
  const MAX_SUBJECT = 200;
  const MAX_BODY = 1000000;            // characters, each of bodyHtml and bodyText
  const MAX_RECIPIENTS = 50;
  const MAX_ATTACHMENTS = 10;
  const MAX_ATTACH_BYTES = 10 * 1024 * 1024;   // all attachments of one email, until IT confirms the mail system's limit
  const LIST_CAP = 200;
  const OUTBOX = ['outbox', 'email'], PROCESSING = ['outbox', 'processing'], DONE = ['outbox', 'done'], FAILED = ['outbox', 'failed'], STATUS = ['status'];
  const FOLDERS = [['queued', OUTBOX], ['queued', PROCESSING], ['done', DONE], ['failed', FAILED]];

  /* ---------- Domains and addresses ---------- */
  const LABEL_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  const LOCAL_ATOM = /^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~-]+$/;

  /* One plausible host name: letters, digits, dashes and dots, at least two labels, no @, spaces or wildcard. */
  function checkDomain(text) {
    if (typeof text !== 'string') return { ok: false, domain: null, problem: 'A domain is text, e.g. company.com.' };
    const d = text.trim().toLowerCase();
    if (!d) return { ok: false, domain: null, problem: 'Type a domain, e.g. company.com.' };
    if (d.includes('@')) return { ok: false, domain: d, problem: `${d}: leave out the @ and what is before it; a domain looks like company.com.` };
    if (/\s/.test(d)) return { ok: false, domain: d, problem: `${d}: no spaces in a domain.` };
    if (d.includes('*')) return { ok: false, domain: d, problem: `${d}: no wildcards; list each domain by name.` };
    if (d.length > 253) return { ok: false, domain: d, problem: 'That domain is too long.' };
    const labels = d.split('.');
    if (labels.length < 2 || !labels.every(l => LABEL_RE.test(l)) || /^\d+$/.test(labels[labels.length - 1])) {
      return { ok: false, domain: d, problem: `${d} is not a domain name (letters, digits and dashes, with dots, e.g. company.com).` };
    }
    return { ok: true, domain: d, problem: null };
  }

  /* One plain address, exactly. Several addresses, a display name ("Name" <a@x.com>), comments, groups, quotes and
   * anything that doesn't parse as local@host are refused. The host is matched whole, case-insensitively, against
   * the list: never by how it ends. */
  function checkAddress(text, domains) {
    const no = problem => ({ ok: false, address: typeof text === 'string' ? text.trim() : null, problem });
    if (typeof text !== 'string') return no('An email address is text, e.g. maria@company.com.');
    const t = text.trim();
    if (!t) return no('Type an email address.');
    if (/[;,]/.test(t)) return no(`${t}: one address only, with no ; or , between several.`);
    if (/\s/.test(t)) return no(`${t}: a plain address has no spaces (no name in front, no second address).`);
    if (/[<>"()\[\]\\:]/.test(t)) return no(`${t}: only a plain address like maria@company.com, with no name or brackets around it.`);
    const parts = t.split('@');
    if (parts.length !== 2) return no(`${t}: an address has one @, like maria@company.com.`);
    const [local, host] = parts;
    if (!local || local.length > 64 || local.split('.').some(a => !a || !LOCAL_ATOM.test(a))) return no(`${t}: the part before the @ is not a plain address.`);
    const dc = checkDomain(host);
    if (!dc.ok) return no(`${t}: the part after the @ is not a domain name.`);
    const list = Array.isArray(domains) ? domains : lastKnown;
    const address = `${local}@${dc.domain}`;
    if (!list.some(d => String(d).toLowerCase() === dc.domain)) {
      return { ok: false, address, problem: `${dc.domain} is not an approved domain${list.length ? ` (approved: ${list.join(', ')})` : '; the list is empty, so no email can be sent'}.` };
    }
    return { ok: true, address, problem: null };
  }

  /* ---------- The approved list ---------- */
  let lastKnown = [];
  const clean = list => Array.from(new Set((Array.isArray(list) ? list : []).filter(d => typeof d === 'string').map(d => d.trim().toLowerCase()).filter(d => checkDomain(d).ok)));
  async function domains(fresh) {
    const it = await FP.current.item(STRUCTURE, ITEM, fresh ? { fresh: true } : {}).catch(() => null);
    lastKnown = it && it.values ? clean(it.values.domains) : [];
    return lastKnown.slice();
  }
  async function setDomains(list) {
    if (!(await FP.users.can('admin'))) throw new Error('Only an admin can change the approved email domains.');
    if (!Array.isArray(list)) throw new Error('The approved domains are a list.');
    if (list.length > MAX_DOMAINS) throw new Error(`At most ${MAX_DOMAINS} approved domains.`);
    const out = [];
    for (const raw of list) {
      const c = checkDomain(raw);
      if (!c.ok) throw new Error(c.problem);
      if (out.includes(c.domain)) throw new Error(`${c.domain} is listed twice.`);
      out.push(c.domain);
    }
    const now = await domains(true);
    if (JSON.stringify(now) === JSON.stringify(out)) return out;
    await FP.entry.record({ entry: `${STRUCTURE}.update`, item: { structure: STRUCTURE, id: ITEM }, form: { id: STRUCTURE, version: 1 }, values: { domains: out } });
    FP.current.clearCache();
    lastKnown = out.slice();
    return out;
  }
  async function checkAddressNow(text) { return checkAddress(text, await domains(true)); }

  /* ---------- Jobs ---------- */
  const MAILBOX_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,39}$/;
  const JOB_RE = /^[A-Za-z0-9][A-Za-z0-9-]{0,99}$/;
  const pad = n => String(n).padStart(2, '0');
  function randomChars(n) {
    const b = new Uint8Array(n);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
    return Array.from(b, x => (x % 36).toString(36)).join('');
  }
  async function exists(id) {
    for (const [, parts] of FOLDERS) if ((await FP.files.size(parts, `${id}.json`)) != null) return true;
    return (await FP.files.size(STATUS, `${id}.json`)) != null;
  }
  async function newJobId(at) {
    const t = String(FP.identity.terminalId || 'X').replace(/[^A-Za-z0-9-]/g, '') || 'X';
    const day = `${at.getUTCFullYear()}${pad(at.getUTCMonth() + 1)}${pad(at.getUTCDate())}`;
    for (let i = 0; i < 20; i++) {
      const id = `${day}-${t}-${randomChars(6)}`;
      if (!(await exists(id))) return id;
    }
    throw new Error('Could not make an unused email job ID.');
  }

  /* Attachment paths stay inside the media folder: relative, forward slashes, no .., nothing odd. */
  function pathProblem(p) {
    if (typeof p !== 'string' || !p) return 'an attachment needs a path';
    if (p.includes('\\')) return `${p}: use / in an attachment path, not \\`;
    if (/[\u0000-\u001f]/.test(p)) return `${p}: odd characters in an attachment path`;
    if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return `${p}: an attachment path is inside the media folder, not absolute`;
    const segs = p.split('/');
    if (segs.some(s => s === '..' || s === '.' || s === '')) return `${p}: no .. or empty parts in an attachment path`;
    if (segs[0] !== 'media' || segs.length < 2) return `${p}: an attachment must be inside the media folder`;
    return null;
  }
  async function checkAttachments(list) {
    if (list == null) return { ok: true, list: [] };
    if (!Array.isArray(list)) return { ok: false, reason: 'Attachments are a list.' };
    if (list.length > MAX_ATTACHMENTS) return { ok: false, reason: `At most ${MAX_ATTACHMENTS} attachments.` };
    const out = [];
    let total = 0;
    for (const a of list) {
      const path = a && typeof a === 'object' ? a.path : a;
      const bad = pathProblem(path);
      if (bad) return { ok: false, reason: `Attachment: ${bad}.` };
      let size = a && typeof a === 'object' && a.size != null ? a.size : null;
      if (size != null && !(Number.isFinite(size) && size >= 0)) return { ok: false, reason: `Attachment ${path}: the size is a number of bytes.` };
      if (size == null) {
        const segs = path.split('/');
        size = await FP.files.size(segs.slice(0, -1), segs[segs.length - 1]).catch(() => null);
        if (size == null) return { ok: false, reason: `Attachment ${path} is not in the media folder yet; save it there before queuing the email.` };
      }
      total += size;
      const nm = String((a && typeof a === 'object' && a.name) || path.split('/').pop()).replace(/[\\/\u0000-\u001f]/g, '_').slice(0, 120);
      out.push({ path, name: nm });
    }
    if (total > MAX_ATTACH_BYTES) return { ok: false, reason: `The attachments come to ${(total / 1048576).toFixed(1)} MB; the most for one email is ${MAX_ATTACH_BYTES / 1048576} MB (send a link instead).` };
    return { ok: true, list: out };
  }

  async function queue(spec) {
    spec = spec || {};
    const no = reason => ({ ok: false, reason, dropped: dropped.slice() });
    const dropped = [];
    if (typeof spec.mailbox !== 'string' || !MAILBOX_RE.test(spec.mailbox)) return no('The mailbox is a short name: letters, digits and dashes (e.g. forms-notifications).');
    if (typeof spec.subject !== 'string' || !spec.subject.trim()) return no('An email needs a subject.');
    const bodyHtml = spec.bodyHtml == null ? '' : spec.bodyHtml, bodyText = spec.bodyText == null ? '' : spec.bodyText;
    if (typeof bodyHtml !== 'string' || typeof bodyText !== 'string') return no('The message body is text.');
    if (!bodyHtml.trim() && !bodyText.trim()) return no('An email needs a message.');
    if (bodyHtml.length > MAX_BODY || bodyText.length > MAX_BODY) return no('The message is too long.');
    let runAfter = null;
    if (spec.runAfter != null) {
      if (typeof spec.runAfter !== 'string' || isNaN(Date.parse(spec.runAfter))) return no('Send after is a date and time.');
      runAfter = new Date(spec.runAfter).toISOString().replace(/\.\d{3}Z$/, 'Z');
    }
    const as = (v, what) => (v == null ? [] : Array.isArray(v) ? v : typeof v === 'string' ? [v] : (dropped.push({ address: String(v), problem: `${what} is a list of addresses` }), []));
    const toIn = as(spec.to, 'To'), ccIn = as(spec.cc, 'Cc');
    if (toIn.length + ccIn.length > MAX_RECIPIENTS) return no(`At most ${MAX_RECIPIENTS} recipients in one email.`);
    const list = await domains(true);
    const seen = new Set();
    const keep = src => {
      const out = [];
      src.forEach(a => {
        const c = checkAddress(a, list);
        if (!c.ok) { dropped.push({ address: c.address == null ? String(a) : c.address, problem: c.problem }); return; }
        const k = c.address.toLowerCase();
        if (seen.has(k)) return;
        seen.add(k); out.push(c.address);
      });
      return out;
    };
    const to = keep(toIn), cc = keep(ccIn);
    if (!to.length && !cc.length) return no(dropped.length ? 'No recipient is left: every address was refused.' : 'An email needs at least one recipient.');
    const at = await checkAttachments(spec.attachments);
    if (!at.ok) return no(at.reason);
    let source = null;
    if (spec.source != null) {
      if (typeof spec.source !== 'object' || Array.isArray(spec.source)) return no('The source is { rule, center, entryId }.');
      source = JSON.parse(JSON.stringify(spec.source));
    }
    const now = new Date();
    const jobId = await newJobId(now);
    const job = {
      version: 1, action: 'email', jobId, createdAt: now.toISOString().replace(/\.\d{3}Z$/, 'Z'), mailbox: spec.mailbox,
      to, cc, subject: spec.subject.replace(/[\r\n]+/g, ' ').trim().slice(0, MAX_SUBJECT), bodyHtml, bodyText, attachments: at.list, runAfter, source,
    };
    await FP.files.writeJson(OUTBOX, `${jobId}.json`, job);   // whole, in one write: the sender waits for the size to stop changing
    return { ok: true, jobId, dropped };
  }

  /* ---------- Status ---------- */
  async function status(jobId) {
    if (typeof jobId !== 'string' || !JOB_RE.test(jobId)) return { jobId, state: 'unknown', folder: null };
    const s = await FP.files.readJson(STATUS, `${jobId}.json`).catch(() => null);
    let folder = null;
    for (const [, parts] of FOLDERS) { if ((await FP.files.size(parts, `${jobId}.json`)) != null) { folder = parts[1] === 'email' ? 'outbox' : parts[1]; break; } }
    if (s && typeof s === 'object' && s.state) return { jobId, state: s.state, at: s.at || null, attempts: s.attempts != null ? s.attempts : null, detail: s.detail || '', folder };
    if (folder === 'outbox' || folder === 'processing') return { jobId, state: 'queued', folder };
    if (folder === 'done') return { jobId, state: 'done', folder };
    if (folder === 'failed') return { jobId, state: 'failed', folder };
    return { jobId, state: 'unknown', folder: null };
  }

  /* The newest jobs (by ID, which starts with the date), across the folders, with what is known of each. */
  async function list() {
    const names = [];
    for (const [, parts] of FOLDERS) {
      const folder = parts[1] === 'email' ? 'outbox' : parts[1];
      (await FP.files.list(parts).catch(() => [])).filter(n => /\.json$/.test(n)).forEach(n => names.push({ id: n.replace(/\.json$/, ''), parts, folder }));
    }
    const byId = new Map();
    names.forEach(n => { const o = byId.get(n.id); if (!o || n.folder === 'done' || n.folder === 'failed') byId.set(n.id, n); });   // a job caught mid-move is listed once
    const newest = Array.from(byId.values()).sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)).slice(0, LIST_CAP);
    const rows = [];
    for (const n of newest) {
      const job = await FP.files.readJson(n.parts, `${n.id}.json`).catch(() => null);
      const st = await status(n.id);
      rows.push({
        jobId: n.id, folder: n.folder, state: st.state, at: st.at || null, attempts: st.attempts != null ? st.attempts : null, detail: st.detail || '',
        to: job && Array.isArray(job.to) ? job.to : [], cc: job && Array.isArray(job.cc) ? job.cc : [], subject: job && typeof job.subject === 'string' ? job.subject : '',
        mailbox: job ? job.mailbox || null : null, createdAt: job ? job.createdAt || null : null, runAfter: job ? job.runAfter || null : null, readable: !!job,
      });
    }
    return rows;
  }

  FP.email = {
    STRUCTURE, MAX_DOMAINS, MAX_SUBJECT, MAX_ATTACH_BYTES, LIST_CAP,
    domains, setDomains, checkDomain, checkAddress, checkAddressNow, queue, status, list,
  };

  (window.FP.modules = window.FP.modules || {})['fp-email'] = '0.70.0';
})();
