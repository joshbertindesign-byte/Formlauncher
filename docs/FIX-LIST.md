# Fix list: Form Platform 0.60 to 0.62

Ordered by what matters most. Every item says how sure we are:

- **Verified**: I read the code and confirmed it (and for F5, a test fails on it).
- **Reported**: a reviewer traced it through the code and gave file and line. I have not re-checked it.
- **Suspected**: a reviewer thinks it is wrong but did not trace it end to end.

Line numbers are for `kernel/` at 0.62.0 and move as code changes; search the function name if a line is off.
`docs/REVIEW-0.60-0.62.md` has the reasoning behind each. Work through P0, then P1. Each fix should come with a test
(a new `lNN.js`, or a line in an existing one) and a run of `dev/tests/regress.sh`.

> **Status at 0.63.0 (see `docs/FIX-REPORT-0.63.0.md`):** every item below is done; **F20** was resolved by a decision to correct the spec rather than add a control. **F11** was resolved
> by relabelling (the default window is real; there is no form date filter). F44's repeat-miss count was a real bug and is fixed; the
> two-terminal climb was not a bug. T1, T2, T4 and T5 are done; T3, T6 and T7 are open. The text below is the list as it was written, so
> "Sure?" and "Where" describe the code before the fixes.

---

## P0: broken, or data at risk

| # | What is wrong | Where | Sure? | Fix |
|---|---|---|---|---|
| F1 | **History > Restore always fails** with "already exists… Open it and publish your change from there". `restore()` calls `publish()` without `basedOn`; `promote()` passes it, so only Restore is broken. | `fp-defs.js` `restore` (~817), button in `fp-editor.js` ~610 | Verified | Pass `basedOn: current.get(docKey(kind,id))?.version` as `promote()` does. Add a test: publish v1, v2, Restore v1, expect v3. |
| F2 | **Checkpoints are never written.** `FP.current.autoCheckpoint` is defined and never called; only the stress test and `kernel-test.html` call `checkpoint()`. Real launchers never write monthly checkpoints, so busy structures read their whole history, and the per-terminal opt-out (`checkpoints:false`) does nothing because `checkIn` never writes it. | `fp-current.js` ~709, `fp-identity.js` `checkIn` ~138 | Verified | Call `autoCheckpoint(structuresUsed)` after launcher start-up (and on a timer). Preserve or set `checkpoints` in `checkIn`. Test: a simulated month, expect checkpoint files after start-up. |
| F3 | **Date-only values are read in the wrong time zone.** `TODAY()` gives `"2026-11-18"`; `timeOf` uses `Date.parse`, which reads it as UTC midnight, but `HOUR`, `WEEKDAY`, `STARTOF`, `TEXT` and `DATEDIFF` use the local clock. In US zones `WEEKDAY(TODAY())` is a day off and `HOUR(TODAY())` is 19, which breaks shift logic. The shipped Help even suggests `WEEKDAY(TODAY()) >= 6`. | `fp-formula.js` `timeOf` ~179, uses at ~228, 235-236, 343, 448 | Verified | Make `timeOf` treat `/^\d{4}-\d\d-\d\d$/` as a local day (as `DATEADD` and `STARTOF` already do). Add a time-zone test to `fp-formula-tests.js` run under `TZ=America/Chicago` and `Australia/Sydney`. |
| F4 | **Lookup summaries are ignored** when a lookup returns `*` or several containers: `sum`, `average`, `min`, `max` pass the publish check, then silently return the latest row. | `fp-lookup.js` ~157-167 and `check()` ~60 (editor offers them at `fp-form-editor.js` ~3510) | Verified | In `check()`, reject sum/average/min/max unless the return is one container; offer only latest/first/count/list otherwise. |
| F5 | **Installing a pack fails when its form uses a media-library entry** ("Installed 6 of 7 definitions… there is no library entry M-EDITOR-…"). Packs carry forms but not library entries, tags or files, so a pack cannot install on a folder with an empty library. Test `l80` fails; introduced in 0.61. | `fp-admin.js` `installPack` ~772; `fp-media.js` library | Verified by test | Decide: packs carry the library entries (and files), or a form's media list may name entries that are not there yet. Then update `l80` (and remove it from `known-failing.txt`). |
| F6 | **Drafts lose photos and signatures.** A draft stores file names (or the string `'drawn'`), not the files; restoring drops them, and `'drawn'` marks the form as changed. Re-opening a held sub-form run drops an optional photo the same way. | `fp-forms.js` `saveDraft` ~2328, `entryValues` ~1307; `fp-controls.js` ~351, 402 | Reported | Store the actual value (`c.get()`) for drafts and for held records. |
| F7 | **One entry that always fails stops every other commit** on that device: any failure in `flush`'s first pass skips the commit pass for all submissions. | `fp-entry.js` ~364-376 | Reported | Commit each submission only when its own entries succeeded. Test with one bad structure name. |

## P1: wrong behaviour users will notice

| # | What is wrong | Where | Sure? | Fix |
|---|---|---|---|---|
| F8 | Optional "Read first" items still block Save/Apply; the Guide says unticking them never locks anything. | `fp-forms.js` `ackPending` ~2094-2212 | Reported | Filter `optional`; give text items an `optional` flag. |
| F9 | Acknowledgment locks have gaps: footer, `set` and `subform` buttons are never locked, so a sub-form with its own saves can write while a read-first is unconfirmed. | `fp-forms.js` ~1652, 2220 | Reported | Make `blockedBy` return `ackPending()` for every non-apply action; pass the lock into sub-form runs. |
| F10 | A number's hard limit, or a `rule`, that errors or is Waiting counts as passing, so the value saves. | `fp-forms.js` ~1599, 1861-1871 | Reported | Treat an unevaluable limit or rule as a blocking problem. |
| F11 | The "form's time window" for lookups is never applied: nothing passes `ctx.window`, so `window: form` reads all live history. | `fp-lookup.js` ~129; `fp-forms.js` ~1778, 2244, 2655 | Reported | Pass the form's date filter as `ctx.window`, or drop the claim in the editor and docs. Decide how item lookups behave. |
| F12 | `hasRole` returns true for any role name it does not know (`rank` is -1), so a typo in `can()` / `requireRole` fails open. | `fp-users.js` ~160 | Verified | Return false when `rank(role) < 0`. |
| F13 | A demoted or deactivated person keeps their old role for up to 12 hours on terminals where they are signed in; role checks use the snapshot stored with the sign-in. | `fp-users.js` ~155-166 | Reported | Close that person's sessions in `setRoles` / `setActive`, or re-read roles in `hasRole`. |
| F14 | Updates: if `releases.js` is unreadable or half-synced, `install` treats it as a first install and deletes the other release folders; a missing `crypto.subtle` silently skips the hash check; every `.js` in the zip is written, listed or not. | `fp-updates.js` ~83-105, 169-199 | Suspected | Fail the install when `releases.js` exists but cannot be parsed; refuse without `crypto.subtle`; write only names in `manifest.files`. |
| F15 | A fresh read right after a multi-structure save can drop the new entries for up to ~30 s ("uncommitted"): `committedIds` has its own cache and ignores `fresh`. | `fp-current.js` ~289-296, 458-465 | Reported | Pass `fresh` through to `committedIds`. |
| F16 | The form map ignores reads through a form's `sources`: `usedBy('structure')` understates a removal's reach, and a structure only read via a source gets a false "Nothing reads X". | `fp-map.js` ~229-238, 290-300 | Reported | Include `via.source` in `usedBy` and source structures in `readersOfStructures`. |
| F17 | Table `limits` (per cell) and `minRows` are dead code: publish refuses them as "not a setting here". | `fp-controls.js` ~813-820 vs ~677-686 | Reported | Declare the settings, or delete the code and the spec line. |
| F18 | One save can count for two adjacent due slots (one "late", one "done") because slots overlap by the grace period. | `fp-due.js` ~447-449 | Reported | Claim each save for one slot only (the earliest unmet). |
| F19 | The launcher has no Reconnect button if folder permission lapses mid-session. | `fp-launcher.js` ~225-230 | Reported | Add a button: `FP.folder.reauthorize()` then `FP.outbox.flush()`. |
| F20 | The Admin page cannot move another terminal to a site (spec says it can); the move exists only on that terminal's own launcher. | `fp-admin.js` ~1396-1430 | Reported | Add a registry-driven move, or correct the spec. |
| F21 | The form map and publish loop-check miss forms opened from a "buttons from a list" field. | `fp-defs.js` `formLinks` ~653-669 | Suspected | Include those fields. |

## P2: smaller bugs

| # | What is wrong | Where | Sure? |
|---|---|---|---|
| F22 | `ROUND(-2.5)` gives -2 (Excel: -3). Round the absolute value, restore the sign. | `fp-formula.js` ~208 | Reported (reproduced in node) |
| F23 | `SUM("abc")`, `MIN`, `MAX`, `AVERAGE` return NaN. | `fp-formula.js` ~214-218 | Reported (reproduced) |
| F24 | `RIGHT("abc", 0)` returns `"abc"`. | `fp-formula.js` ~253 | Reported (reproduced) |
| F25 | `DATEADD` months overflows: Jan 31 + 1 month = Mar 3 (Excel: Feb 28). | `fp-formula.js` ~334 | Reported (reproduced) |
| F26 | Waiting / No data precedence depends on operand order in operators; built-ins use Error > Waiting > No data. | `fp-formula.js` ~498-522 | Suspected |
| F27 | A function's optional input can never be left out in a formula (the static check demands all inputs). | `fp-formula.js` ~599 | Suspected |
| F28 | A blank optional lookup input holding Waiting is not treated as blank; `""` matches 0. | `fp-lookup.js` ~92-99 | Suspected |
| F29 | Item picker: Enter on an empty search picks the most recent item; the item list is cached for the control's life. | `fp-controls.js` ~539 | Reported |
| F30 | Choice colour `warn` has no CSS; `decimals` and `placeholder` are declared and ignored; `Infinity` / `1e999` are accepted as numbers. | `fp-forms.js` ~762, 161-164, 905-917; `fp-controls.js` ~915 | Reported |
| F31 | `print()` leaves the record ID out of the margin (only `printRecord` has it). | `fp-forms.js` ~2291 | Reported |
| F32 | Drafts are saved per form, not per user; the next person on a shared terminal inherits typed values. | `fp-forms.js` ~1255, 3085 | Suspected |
| F33 | Two PIN gates can stack after an idle sign-out or a user switch. | `fp-users.js` ~305-319, `fp-launcher.js` ~822-912 | Suspected |
| F34 | `FP.sites.rename` does not check the site exists (an unknown ID creates one). | `fp-sites.js` ~73 | Reported |
| F35 | Charts: `Math.min(...ys)` throws past ~100k points. Pareto with all zeros gives NaN widths. A status named `constructor` / `__proto__` mis-colours. | `fp-visuals.js` | Suspected |
| F36 | Pack `items` can target built-in structures (users, sites) with no role check beyond the Admin page. | `fp-admin.js` ~716-740 | Suspected |
| F37 | `version=abc` in a launcher URL becomes "no version NaN". | `fp-launcher.js` ~208, 812 | Reported |
| F38 | The viewer revokes a media blob URL after 60 s (a reloading PDF viewer fails); capture-folder skip is case-sensitive; Windows reserved names (CON, NUL) pass `safeName`. | `fp-media.js` ~146-166, 33, 126, 196 | Suspected |
| F39 | A correction of a correction does nothing and raises no warning; a clash is flagged only inside 10 minutes; a 256 KB+ last line breaks the hash chain; `readStats` checks only the slowest terminal's entry count. | `fp-current.js` ~362-417; `fp-core.js` ~206; `fp-defs.js` ~395 | Suspected / Reported |

## P2: 0.61 media library and 0.62 alerts (read, not yet tested)

| # | What is wrong | Where | Sure? |
|---|---|---|---|
| F40 | `library.usedBy` counts only entries named directly, not forms that show an entry through a tag rule (`library: {…}`), so retiring an entry does not warn. It also listed the same form twice in `l92`. | `fp-media.js` `usedBy` | Verified by reading |
| F41 | The publish check for media entries is skipped silently when the library has not been loaded. | `fp-media.js` check | Verified by reading |
| F42 | `library.revise` builds the new revision and history from the cached entry; two terminals revising at once lose one history record. `putFile` checks then writes (a name clash errors rather than overwrites). | `fp-media.js` `revise`, `putFile` | Verified by reading |
| F43 | `mustPublisher` is skipped if `FP.users` is not loaded (fails open). | `fp-media.js` | Verified by reading |
| F44 | 0.62 commit says "untested: repeat misses add to the open alert"; `l93` passes but does not target this. Add a case: two misses of the same check while an alert is open. Also check that two terminals running `climb` once a minute do not double-count `misses`. | `fp-due.js` `recordMisses`, `climb` | Not tested |

---

## Tests and tooling

| # | What | Status |
|---|---|---|
| T1 | `regress.sh` now builds its own seeds, includes `l93`, and reports PASS / FAIL / KNOWN-FAIL. The old script printed only error lines, so a test that died and a test that passed looked the same. | Done (this change) |
| T2 | `snap15b.json`, the seed `l60`, `l64`, `l78` and others start from, was made by hand and lost. Worked out and rebuilt by `dev/tests/dummies/mkseed15b.js`; `l60` and `l78` pass. See `docs/SNAP15B.md`. | Done |
| T3 | The pilot data (`profiles.json`, `production-pilot.json`) is real production data. It is kept out of git and read from the WIP zip. Replace it with synthetic data (the tests assert on its part names, e.g. "805 CLAYTON White"), then the zip is no longer needed for tests. | Open |
| T4 | `kernel-test.html` leaves `fp-kinds` out of its `NEEDED` list, and loads no `fp-updates` / `fp-launcher`. | Open |
| T5 | There are no tests for the P0 and P1 items above. Add one with each fix. | Open |
| T6 | `runtime/releases.js` (committed) carries a real person's name in `by`. Decide whether to blank it before sharing the repo. | Open |
| T7 | No automated check that `Forms b/runtime/<version>/` matches `kernel/`. Add a step to `release.py` (or CI) that builds the zip from `kernel/` and writes it into `Forms b/runtime/<version>/`. | Open |

## Spec and Guide: text that no longer matches the code

The code is ahead of the documents. These are edits to the PDFs' source, not code bugs:

- **Removed features still described:** Authoring in script (removed 0.57); Library, saved fields and groups (0.48); Sessions and linking (0.36); the Media library as written (built-in `media` structure, IDs, fingerprints, health check, `media/inbox/`, media rules and SharePoint address parsing: removed 0.42; 0.61 builds a different library); per-device `pc:` / `tablet:` / `phone:` widths (ignored since 0.49); open and apply buttons (refused at publish, sub-forms replace them); the separate print layout; media IDs and tags on file/draw fields.
- **Changed:** roles are user, supervisor, publisher, admin (not operator, QC tech…); sign-out is idle time, Switch user, or the 12-hour cap (no "at shift end"); launchers are `launch.html?launcher=NAME` + `launchers/launchers.json`, not `window.LAUNCH`; folder layout is `data/{structure}/{date}/{terminal}.jsonl` plus `approvals`, `drafts`, `launchers`, `archive`; `sites.rename`, the Admin "move a terminal" line (F20); `FP.version` and build-plan statuses (steps 17, 20, 27, 40 still say "Built, testing").
- **Not there:** histogram and heatmap visuals; "every visual has Show data" (it is `showData`, off by default, chart / control chart / Pareto only); the guided function builder ("add, subtract, in range", "Save to library").
- **Counts:** "44 engine tests" and "22 lookup tests" are now 90 and 26. Admin has ten parts (the Guide says five), and the Guide never mentions Test folder, Stress test or `?terminal=`.
- **The Guide:** says "as of kernel 0.27"; describes a media library "(0.61)" at `media\library\` while 0.60 does not have it; says publishing needs an admin (it is publisher).
- **Built-in structures:** the code also has approvals, terminal-groups, terminal-settings, dues, centers, alerts, media-library and media-tags.
