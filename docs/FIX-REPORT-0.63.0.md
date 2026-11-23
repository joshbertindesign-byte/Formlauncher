# Fix report: 0.63.0

The fix pass on the 0.62 work in progress, done by five agents (one per area, each in its own branch) and merged and
verified here. `docs/FIX-LIST.md` is the list it worked from; `docs/REVIEW-0.60-0.62.md` is why.

## Result

- **43 of the 44 fix-list items are done.** The one left is **F20** (the Admin "move a terminal" control), which needs your decision.
- **Regression, from nothing: 83 passed, 0 known failing, 0 failed.** 17 new tests were added, each written to fail on the old code first.
  The lost `snap15b` seed was worked out and is rebuilt by a script, so `l60` and `l78` pass too (`docs/SNAP15B.md`). The 78-passed, 2-known-failing
  result was the run before that.
- **Unit tests:** formula 129/129 (was 90) and lookup 36/36 (was 26), also under four time zones.
- **Update path tested:** `l151` installs the committed 0.60.0 zip, then 0.63.0 over it, as Admin > Updates does. The switch moves, 0.60.0 stays
  as the fallback, and the entry format is 6 in both, so saved data needs no conversion.
- **Downloads built:** `dist/` holds the end-user package (below). The version is 0.63.0.
- The final 83-test run is after every change to the code and tests (the F11 label, the Test pack and `l150`, `l151`, the rebuilt seed and its
  shifted clock). No product code changed after the package in `dist/` was built.

## What each area did

| Area | Fixed | Tests |
|---|---|---|
| **Storage and core** | F2 checkpoints now run (90 s after the first load, then hourly; the per-terminal opt-out is kept); F7 one bad entry no longer blocks other commits; F15 fresh reads see just-saved entries; F39 a correction of a correction resolves to the original; a 256 KB+ last line no longer breaks the hash chain | `l100` |
| **Forms and controls** | F6 drafts keep photos and signatures; F8 optional read-first no longer blocks; F9 locks cover every button and sub-forms; F10 limits and rules that cannot be worked out now block; F17 table cell limits and `minRows` now work; F29 item picker; F30 `warn` colour, `decimals`, `placeholder`, no `Infinity`; F31 record ID in the print margin; F32 drafts are per person | `l110` `l111` `l112` |
| **Formulas, lookups, library** | F1 Restore works; F3 date-only values are a local day; F4 summaries refused unless the return is one container; F21 loop check follows list buttons and sub-forms; F22-F25 rounding, text, `DATEADD`; F26-F28 operator order, optional inputs, blank handling; F39 `readStats` per terminal; `lit()` keeps quotes | `l120` `l121`, unit |
| **Users, launcher, updates, media, packs** | F5 packs carry library entries, tags and files (`l80` passes again); F12 unknown roles fail closed; F13 role changes and deactivation apply within about 30 s; F14 safer installs; F19 Reconnect button; F33 one sign-in gate; F34 `sites.rename` checks; F36 pack items need an admin; F37 `version=` validated; F38 media names and viewer; F40-F43 library checks | `l130`-`l134`, `l80` |
| **Map, visuals, due, alerts** | F16 map counts reads through sources; F18 a save counts for one due slot; F35 charts and Pareto; F44 a stale terminal no longer inflates an alert's miss count; T4 test page lists `fp-kinds` | `l140`-`l143` |
| **Lead (me)** | F41 library read before the check; F11 label; Test pack; package build; PNG fixtures were missing from git (the `.gitignore` excluded `*.png`) | `l150` `l151` |

## Your answers, applied

- **F11 (form time window):** kept, relabelled. The default window is *not* dead: it means "the recent data a structure keeps loaded", every lookup
  without a `window` setting uses it, and `all` (the whole history) is different. What never existed is a form-supplied date filter. The editor
  now says "recent data (what the structure keeps loaded)" instead of "the form's time window", and the code notes that no date filter is applied.
  Nothing was removed, so no existing definition changes.
- **F23:** `SUM` of only text is 0 (as built).
- **F4:** done. Any already-published lookup that uses sum, average, min or max over `*` or several containers will show "Not loaded" until
  its summary is changed; none was found in the test data.

## Still needs your decision

| # | Question | Default taken |
|---|---|---|
| F20 | Add an admin "move a terminal to another site" on the Admin page? Recommended: writes the target site to the terminal registry and the terminal applies it at its next check-in. Needs a rule for whether a central setting overrides a terminal's own site. Otherwise correct the spec. | Not implemented |
| F2 | Checkpoint timing | 90 s after first load, then hourly |
| F10 | A rule or limit that is *Waiting* blocks saving ("Waiting for what its rule needs") | Blocks |
| F9 | While a read-first list waits on a field, only Save and Apply are held, not the other buttons (`l56` relies on it) | Save and Apply only |
| F30 | A number with `decimals` rounds the value it *saves*, not only what it shows | Rounds the saved value |
| F28 | A blank `""` optional lookup input still matches everything | Unchanged |
| F5 | Pack library files up to 2 MB each and 12 MB in all; an existing entry with the same name is reused | As stated |
| F16 | A source whose values are all `write` does not count as a read | As stated |
| — | Entries are filed under the day the outbox flushes, not the day in their `writtenAt`; a flush across a month end can file them in the next month's folder | Unchanged |

## Found and not fixed

- Bar and non-time line charts use `indexOf` per point (slow on very long lists).
- A form with a `due` schedule but no `sources` is refused as "older way"; forms written for tests need `sources: []`.
- `library.putFile` checks for a free name and then writes (a clash errors; it cannot overwrite).
- With a frozen test clock, two entries for one item in the same millisecond do not override each other.
- The 10-minute clash window in `fp-current` is as designed; the spec should say so.
- **The Spec and Guide PDFs were not changed.** They cannot be edited from the repo. The list of what is out of date is at the end of `FIX-LIST.md`.

## The downloadable package (`dist/`)

Built by `kernel/dev/tools/build-package.js`, which runs the platform's own installer on an empty folder and saves what it wrote. No data, no people,
and no person's name in `releases.js`. Opened from disk as a check: the loader found and ran 0.63.0.

| File | For |
|---|---|
| `dist/FormPlatform-0.63.0.zip` | **First install**: unzip and copy the contents into the shared folder (the `READ ME FIRST.txt` inside says how) |
| `dist/kernel-0.63.0.zip` | **Update a folder in use**: save it in the folder's `updates/` folder, then Admin > Updates |
| `dist/0.63.0/` | The same folder, unzipped (`launch.html`, `runtime/`, `packs/Test pack.json`, `READ ME FIRST.txt`) |

Pushing the tag `v0.63.0` makes the release workflow publish the first two on GitHub (it checks the zip against the committed files first).

## The Test pack

`dist/0.63.0/packs/Test pack.json` (built by `kernel/dev/packs/test-pack/build.js`): everything the production pilot packs did, with made-up data, installed from
Admin > Packs on a **test folder**.

- Same functionality as the pilot: 7 structures (profiles, lines, needs, shifts, runs, racks, partial racks), 14 forms (the pilot's 13 and a new Line
  instructions form), 30 functions, a site, a line-terminal group (kiosk, home form the line board) and a QC office group (admin view), and four
  responsibility centers with the escalation ladder on the hourly check.
- Made up: 30 profiles (parts 100 to 250 for customers ACME, NORTHWIND, GLOBEX, INITECH, UMBRELLA), nine lines (the first three on), site "Test Plant", six
  test people (PINs in `READ ME FIRST.txt`), and two library instructions with their files.
- A build guard refuses to write the pack if a plant-specific word is found. `l150` installs it on a fresh folder (everything but the people first, then
  the people once the folder is marked a test folder), checks the counts, terminals, library files and a second install changing nothing, and opens all
  14 forms.
- Not a substitute for the pilot's own scenario tests (`q1`-`q6`), which still use the original data; replacing that data is T3.

## Tooling items

| # | Status |
|---|---|
| T1 regress runner | Done |
| T2 rebuild `snap15b` (`l60`, `l78`) | Done: `docs/SNAP15B.md` |
| T3 replace the pilot's production data in the tests | Open; the Test pack covers deployment, not the old tests |
| T4 `kernel-test.html` lists `fp-kinds` | Done |
| T5 tests for the fixes | Done (17 new) |
| T6 a real person's name in `Forms b/runtime/releases.js` | Open (the new package has none) |
| T7 keep `Forms b/` in step with `kernel/` | `build-package.js` now builds the folder; nothing copies it into `Forms b/` |
