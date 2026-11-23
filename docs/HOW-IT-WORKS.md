# How the Form Platform works (a short orientation)

Source of truth for detail is the **Architecture Spec** and **User Guide** PDFs in `Forms b/`. They are partly out of date
(see `FIX-LIST.md`, last section), so this page says what the code does today. Where I only read it in the spec and did
not see it in the code, I say so.

## The idea

One platform replaces a family of separate apps (production terminal, QC, holding, returns). Everything is a **form** that
saves **entries** into **structures**, and any form can be published as its own **launcher**. There is **no server**: it
is HTML and JavaScript running in Edge from a shared Windows folder (a SharePoint library synced by OneDrive), with JSON
files for storage and no third-party libraries.

## The pieces

| Piece | What it is |
|---|---|
| **Structure** | A kind of thing you keep records about (Racks, Dies, Users…). Has an item ID (e.g. the Rack ID), containers (its values), and a *kind* (list, orders, runs, inventory, cases, records) that decides how items open, close and show status. |
| **Item** | One thing in a structure (rack R12345). |
| **Entry** | One saved change to an item. **Entries are only ever added, never edited.** Corrections are new entries. The *current value* of an item is worked out by folding its entries in time order. |
| **Form** | A screen that fills in values and saves them. Built in the editor (`editor.html`), with fields, layout, buttons, sub-forms, print and "read first" acknowledgments. One save is one all-or-nothing submission. |
| **Function / formula** | A calculation in a form: `IF`, `SUM`, `ROUND`, `TODAY`, lookups into other structures. Can be *Waiting* (an input is empty) or *No data*; it never shows Fail or 0 for those. |
| **Lookup** | A formula that reads another structure's current values or history. |
| **Site / terminal** | A terminal is one PC; each is at one site (e.g. ABI, DAL). Entries are stamped with both. Definitions say which sites they are for. |
| **User / PIN / role** | Six-digit PINs (stored as PBKDF2 hashes). Roles rank user < supervisor < publisher < admin. Publishing needs publisher. |
| **Responsibility center, due, alert** | A center has members and duties ("check X every hour"). Missed duties are recorded; in 0.62 a miss can climb an escalation ladder (an alert) until someone acknowledges it or the check is done again. |
| **Media library** (0.61) | Files forms show (setup sheets…), each with an internal name, tags, a folder and versions. |
| **Pack** | A bundle of definitions (and, on a test folder, people) installed in one go. |

## The folder (what is on SharePoint)

```
launch.html                  the home page (opens launchers)
runtime/                     the platform itself
  boot.js  releases.js       which release runs; boot.js loads its files
  launcher.html editor.html  small pages that load the running release
  0.60.0/                    one folder per release: fp-*.js, release.json, kernel-0.60.0.zip
data/<structure>/<date>/<terminal>.jsonl     entries, one file per terminal per day
library/  drafts/  launchers/  media/        definitions, saved drafts, launcher list, files
updates/                     drop a release zip here; an admin installs it
_terminals/ _stats/          each terminal checks in; health numbers
```

**Terminals never overwrite each other's files**: each appends only to its own `<terminal>.jsonl`. Because of that, SharePoint
sync can merge safely. Reading means reading every terminal's files and folding them. Monthly **checkpoints** keep that
fast (F2: currently never triggered).

## Releases and updating

`runtime/releases.js` names the running release (`current`) and the ones kept to fall back on. Every page loads `boot.js`,
which loads `runtime/<current>/fp-*.js` (the lists are in that release's `release.json`) and falls back to an older complete
release if sync has not finished. **To update:** save `kernel-X.Y.Z.zip` into `updates/`; an admin opens
Admin > Updates; the installer checks every file's SHA-256, writes the release folder, then the pages, then `releases.js`
last (that is the switch). The three newest releases are kept. The GitHub release workflow publishes exactly that zip.

## Where the code is

```
kernel/            the source: fp-*.js, launcher.html, editor.html, boot.js, ...
  dev/tests/       the regression suite (docs/TESTING.md)
  dev/tools/       release.py builds kernel-X.Y.Z.zip; bump.py sets the version; build-package.js makes the end-user folder
  dev/packs/       the Test pack (made-up data, every pilot feature)
dist/              the latest end-user package: FormPlatform-X.Y.Z.zip (first install), kernel-X.Y.Z.zip (update), the unzipped folder
Forms b/           the repo's copy of a deployed test folder: runtime/0.60.0, the PDFs, the WIP zip
.github/           the release workflow
```

Each `fp-*.js` is one module on a global `FP` (classic scripts, not ES modules, because Edge blocks modules from `file://`):
`fp-core` (folder access, file locks), `fp-entry` (entries, outbox), `fp-current` (folding, checkpoints), `fp-formula`,
`fp-lookup`, `fp-defs` (definitions library and publishing), `fp-forms` and `fp-controls` (the form runtime),
`fp-launcher`, `fp-editor` / `fp-form-editor` / `fp-map` / `fp-admin` (the editor), `fp-users`, `fp-media`, `fp-due`,
`fp-visuals`, `fp-updates`, and others.

**Rules the build enforces** (`release.py`): no `eval` or `new Function`, and no new HTML-from-string assignments beyond
a reviewed count, so definitions can never run code.

## Test folders

A folder can be marked a **test folder** (a marker file `THIS IS A TEST FOLDER.txt`, made from Admin > Test folder by
an admin). Only then are Purge, the stress test, simulated terminals (`launch.html?terminal=T02`) and a pack's people allowed.
`Forms b/` in this repo is such a folder.
