# Review of the Form Platform, 0.60 with the 0.61 and 0.62 work in progress

Written 23 Nov 2026. This is the "what we found" report. The numbered to-do list is `docs/FIX-LIST.md`; how to run the
tests is `docs/TESTING.md`; how the platform works is `docs/HOW-IT-WORKS.md`.

## What was done

1. **Spec against code.** The Architecture Spec (98 pages) and User Guide (43 pages) were read against the 0.60.0 code
   by five reviewers, each taking one slice: storage and core; forms and controls; formulas, lookups and library; launchers,
   users, media and packaging; editor, Admin and visuals. Reviewers read the code and did not edit it.
2. **Regression run.** The test suite from the WIP zip (`form-platform-repo-wip-0.61-0.62.zip`: your own `regress.sh`,
   tests `l42` to `l93`, a chain build and the pilot packs) was run headless in Chromium on 0.60.0, 0.61.0 and 0.62.0.
3. **0.61 and 0.62 read.** The media library (0.61) and escalation alerts (0.62) changes were read; only `l92` and `l93` test them.

How sure each finding is, in `FIX-LIST.md`: **Verified** (I read the code and confirmed, or a test fails), **Reported** (a
reviewer traced it; I did not re-check), **Suspected** (not traced end to end).

## Headline

- The core is sound. Entry writing (append-only, all-or-nothing commit, per-file locks, clock handling), the formula
  engine, PIN storage (PBKDF2, 300,000 rounds), the packaging (`kernel-0.60.0.zip` matches the loose files byte for
  byte, every hash matches), and the destructive-action gates (purge, stress test and simulated terminals need the test
  marker plus an admin) all held up. No reviewer found `innerHTML` used on user-typed text.
- Seven real problems, four of them confirmed by reading the code: **Restore fails (F1)**, **checkpoints are never
  written (F2)**, **date-only values read in the wrong time zone (F3)**, **multi-column lookup summaries are ignored (F4)**,
  and (from 0.61) **packs cannot carry media-library entries (F5)**; plus drafts losing photos (F6) and one bad entry
  blocking commits (F7).
- **The spec and Guide are well behind the code.** Whole sections describe features removed in 0.36 to 0.57
  (sessions, library, script authoring, the old media library). Treat the changelog inside the spec, not its body, as
  the truth until the text is revised.

## Regression results

| Run | Result |
|---|---|
| Unit tests (formula 90, lookup 26) | pass on 0.60, 0.61, 0.62; also under `TZ` America/Chicago, Australia/Sydney, Asia/Kolkata |
| Chain build (14 parts, from nothing) | pass on all three |
| l-tests, 0.60 | 41 of 42 ran clean |
| l-tests, 0.62 | 41 of 44 clean (includes the new `l92`, `l93`) |
| **New `regress.sh`, from an empty checkout** (no seeds, no pilot data) | **62 passed, 3 known failing (`l60`, `l78`, `l80`), 0 failed**; about 25 minutes |

Failures:

- **`l80` (real, new in 0.61):** installing the pilot pack on another folder fails because its `die-setup` form names a
  media-library entry the pack does not carry. Passes on 0.60. = F5.
- **`l60` and `l78`:** fail identically on 0.60 and 0.62, so 0.61/0.62 did not break them. They start from `snap15b`, a seed made by hand
  and not available; `snap15` was used as a stand-in. They stayed known failures until the seed was rebuilt (done in 0.63.0: `docs/SNAP15B.md`).
- **`l92`** only failed at first because it looked for fixtures on the original author's machine. Fixed: synthetic
  fixtures are now in the repo; it passes.
- **Gaps in the old script (now fixed):** `l93` was not in `regress.sh`; `regress.sh` printed only error lines so a test
  that never ran looked like one that passed; about 30 tests could not start because their (git-ignored) seed files were
  not in the zip. The new runner builds every seed itself.

## Findings by area

Detail and fixes are in `FIX-LIST.md`; this is the shape of it.

**Storage and core.** Matches the spec on entry format, rules 1 to 4 (all-or-nothing, retry, file naming, locked appends),
read rules, clocks, folding, site stamping and coverage. Gaps: checkpoints never triggered (F2); one failing entry blocks
every commit on a device (F7); a fresh read can miss just-saved entries for ~30 s (F15); no Reconnect button (F19);
Admin cannot move another terminal (F20); correction chains, clash window and a few size limits (F39).

**Forms and controls.** Field kinds, layout (12 columns, steps, tabs), snapshots, one submission per save, and print
all match. Gaps: drafts lose files (F6); optional read-first items still block (F8); locks have gaps (F9); limits and
rules fail open when they cannot be worked out (F10); table cell limits are dead code (F17); several settings declared and
ignored (F30); print omits the record ID (F31).

**Formulas, lookups, library.** Every spec-named function exists; Waiting / No data rules, loop and depth checks, the
parser limits, hidden values and lookup matching are right. Gaps: time zone (F3); summaries ignored (F4); form window
never applied (F11); rounding, text and date edge cases (F22 to F25); precedence (F26).

**Launchers, users, media, packaging.** Release load lists, hashes and the zip are consistent; version pinning, the
update order (folder, pages, `releases.js` last) and the entry-format guard work. Gaps: role changes slow to apply
(F13); fail-open role names (F12); update edge cases (F14); media viewer and file-name edge cases (F38); a possible
double sign-in gate (F33).

**Editor, Admin, visuals.** Destructive actions are correctly gated; site rules (code is permanent, never deleted,
turn-off lists dependents) are right; visuals build text safely. Gaps: Restore (F1); the form map ignores sources
(F16); minor chart and API issues (F34, F35, F36).

**0.61 media library and 0.62 alerts.** Read only. The library design is coherent (internal names, tags, folders,
versions that keep the old file). Concerns are in F40 to F44. Escalation ladders pass their test (`l93`); the
"repeat misses add to the open alert" path the commit calls untested still has no test (F44).

## What is not covered

- **Not run:** the real SharePoint folder, Edge, a real touch terminal, OneDrive sync delays beyond the fake folder's
  simulated flakiness, Power Automate (spec steps 22 and later are "Later" and have no code).
- **Reviewers read; they did not run.** Most "Reported" findings have not been reproduced. Fix them with a failing test first.
- **0.61 and 0.62 are work in progress.** Several 0.62 behaviours (the test clock, rehearsal, quick sign-in) have one
  test each.
- **Pilot data** is production data. It is kept out of git and read from the zip for tests only (T3).
