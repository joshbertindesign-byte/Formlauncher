# Running the tests

The regression suite lives in `kernel/dev/tests/`. It runs the real platform pages in a headless Chromium (Playwright,
already installed in the Claude Code cloud sessions) against a **fake in-memory data folder**, so it needs no SharePoint,
no real PCs and no stored data. It builds every starting point it needs.

```bash
kernel/dev/tests/regress.sh                 # everything, about 40 minutes
kernel/dev/tests/regress.sh l92 l93         # only those tests
kernel/dev/tests/regress.sh --fresh         # discard the made seeds and rebuild them
```

Results go to `kernel/dev/tests/out/results.txt`; each test's full output is `out/<name>.log`. Lines say:

| Line | Meaning |
|---|---|
| `PASS name` | exited 0 and printed no page errors |
| `FAIL name` | new failure: fix it (exit code 1) |
| `KNOWN-FAIL name  reason` | listed in `known-failing.txt`; does not fail the run |
| `UNEXPECTED-PASS name` | it is in the known list but now passes: delete its line |

A test counts as failed if it crashes, times out, prints `pageerror`, or prints a non-empty `errs : [...]`.

## How it works

- **Fake folder.** `dummies/base.js` (used by almost every test) opens the page with `fake3.js` injected: an in-memory
  directory that stands in for the data folder and for the browser's IndexedDB. It can add delay (`window.__latency`) and
  random "file busy / changed under you" failures (`window.__flaky`), like a synced OneDrive folder.
- **Seeds.** A *seed* is a saved copy of the fake folder at some point, as JSON (`snap*.json`). Tests start from one so they
  do not repeat setup. `regress.sh` makes them in this order, then reuses them:
  1. `dummies/build.js` (the **chain**, 14 parts, each building on the last: structures, forms, users, launcher…) saves `snap1…snap14`.
  2. `l59.js` saves `snap15`.
  3. `snap15b` is made by `dummies/mkseed15b.js` from `snap15` (T01 in its group with one form, approval on for one form; see `docs/SNAP15B.md`).
  4. `dummies/p1.js` saves `snapPilot`; `pilot2/q1…q4` save `snapQ…snapQC` (the production pilot, shared line terminals).
  5. The `lNN` tests (one per feature, from 0.40 on) start from those and check behaviour; some save their own seeds. Tests added in the 0.63 fix
     pass are `l100` (storage), `l110`-`l112` (forms), `l120`-`l121` (formulas, library), `l130`-`l134` (users, updates, media, packs),
     `l140`-`l143` (map, visuals, due, alerts), `l150` (the Test pack), `l180`-`l182` (retiring terminals and sites), `l183` (change the data folder), `l184` (full screen), `l185`-`l187` (email groundwork), `l151` (updating a 0.60.0 folder to this kernel) and `l152` (the pack's forms are offered on the terminals, on any site).
- **Unit tests.** `kt28.js` runs `fp-formula-tests.js` (129 cases) and `fp-lookup-tests.js` (36) without a browser.
- **Time.** The clock is fixed per test (`at:`) and `TZ=America/Chicago`, so results do not depend on the day it runs.
- **Where it looks.** Tests ask for `file:///home/claude/kernel/launcher.html`; `base.js` rewrites that to this `kernel/` folder.

## Test data

- **Everything above is synthetic** except the pilot data below. People in the tests (Josh, Dana Ruiz…) and the PINs
  (482913, 864201) are made up. Screenshots and snapshots are git-ignored.
- **Pilot data is real production data** (part numbers, customers, weights, in `pilot/profiles.json` and
  `production-pilot.json`). It is **not committed**; `prepare-data.sh` reads it out of
  `Forms b/form-platform-repo-wip-0.61-0.62.zip` into git-ignored files (override with `PILOT_DATA_ZIP=…`). The tests assert on
  these names ("805 CLAYTON White"), so replacing them with made-up data means editing the tests too (T3 in `FIX-LIST.md`).
- **`snap15b` is rebuilt.** The original was made by hand and lost; `docs/SNAP15B.md` explains how it was worked out from the tests, and
  `dummies/mkseed15b.js` makes it.
- **One shifted clock.** `regress.sh` runs everything on a page clock that starts at 12:30 on 2026-11-18 and moves forward (`FP_SEED_OFFSET_MS`,
  read by `dummies/base.js`; kept in `dummies/.seed-clock` so later runs carry on from it). The tests freeze their own clocks at 13:00 that day, so
  seeds must be older than that, and tests with no clock must see seeds that are minutes old. A seed stamped with today's date makes a test's writes
  look older than the seed's, and they lose.

## The Test pack and packaging

- `dev/packs/test-pack/build.js` builds `test-pack.json`: the pilot's functionality with made-up data (a guard refuses plant-specific words). `l150` installs it.
- `dev/tools/build-package.js <out dir>` builds the end-user package with the platform's own installer and opens the result from disk; it is the
  last step of a release (`node dev/tools/build-package.js ../dist`). `l151` tests the update path (an installed 0.60.0 folder updated by this kernel's zip).
- Last full run (0.66.0, on GitHub Actions, commit 768243b): every step passed, including the whole suite from freshly built seeds. Release B also adds a touch-target audit (`dev/shots/shots.js`: no interactive element under 48 px on the operator screens). Two test fixes on the way: `l60` waits for Save to enable, and the sign-in watcher no longer reopens a form after a sign-in made on the page itself.
- **The regression runs on GitHub** (`.github/workflows/regression.yml`) on every push and pull request that touches `kernel/`, and by hand from the Actions tab; GitHub emails whoever pushed if it fails. Running it in a cloud session is unreliable (the container restarts about every 45 minutes, killing a 40 minute run).

## Screenshots, colours and night mode

`kernel/dev/shots/` is the visual safety net for the UI refresh: `node dev/shots/shots.js out [day|night]` opens thirteen key screens (editor, form editor, structure editor,
Admin, Help, the launcher on a line terminal and the QC office, a form, the dashboard, Find, the Retire dialog and a retired form) against the Test pack's demo data, saves a PNG of each and measures text contrast
(4.5:1; 3:1 for large text and symbols). `node dev/shots/compare.js baseline out 0.05` reports the pixels that changed per screen. The baselines for both modes are
committed (`baseline/`, `baseline-night/`); take new ones when a change to the look is intended. `python3 dev/tools/tokenize.py check` must report 0 colour literals.
See `docs/UI-REFRESH-RELEASE-A.md`. `l160` tests the Day/Night switch.

## Adding or changing a test

1. Copy a short existing test (`l92.js` is a good model: start from a seed, drive the page, `say(...)` what you saw).
2. Use `start({ seed: 'dummies/snap15.json', at: '2026-11-18T13:00:00-06:00' })`. Write files only under `./out/`.
3. A test must exit non-zero, throw or print `errs` on failure; add its name to the list in `regress.sh`.
4. For a bug fix: write the failing test first, see it fail, fix, see it pass, then run the whole suite.

## Not covered

Real SharePoint/OneDrive timing, Edge, touch screens, printing, camera and scanner hardware, and Power Automate. Test those
on a terminal. The checks in `release.py` and `.github/scripts/verify_release.py` cover packaging, not behaviour.
