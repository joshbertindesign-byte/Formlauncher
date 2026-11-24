# Form Platform

A forms and data platform that runs in Edge from a shared SharePoint folder: no server, no third-party libraries.

| Folder | What it is |
|---|---|
| `kernel/` | **The source** (`fp-*.js`, `launcher.html`, `editor.html`) plus `dev/tests` (regression suite) and `dev/tools` (`release.py`). Work here. |
| `dist/` | **The download.** `FormPlatform-0.68.0.zip` for a first install, `kernel-0.68.0.zip` to update a folder in use, and the unzipped folder with a `READ ME FIRST.txt` and the Test pack. |
| `Forms b/` | **What is deployed** to the SharePoint folder: `runtime/<version>/`, the Spec and User Guide PDFs, and the WIP zip. |
| `docs/` | Review, fix list, how it works, how to test. Start with `docs/HOW-IT-WORKS.md`. |
| `.github/` | Publishes `kernel-X.Y.Z.zip` as a GitHub Release when you push a `vX.Y.Z` tag. |

- Run the tests: `kernel/dev/tests/regress.sh` (see `docs/TESTING.md`).
- What to fix next: `docs/FIX-LIST.md`. What was found and why: `docs/REVIEW-0.60-0.62.md`.
- Current version **0.68.0**: change the data folder (`docs/CHANGE-DATA-FOLDER.md`), on top of retiring terminals and sites (0.67.0), the new look (0.66.0), retiring definitions (0.65.0), night mode (0.64.0) and the 0.63 fix pass. `Forms b/runtime/0.60.0/` is the previous stable release.
- What changed: `docs/FIX-REPORT-0.63.0.md` (the fix pass) and `docs/UI-REFRESH-RELEASE-A.md` (night mode, 0.64.0) and `docs/RETIRING-DEFINITIONS.md` (0.65.0) and `docs/UI-REFRESH-RELEASE-B.md` (0.66.0, the new look) and `docs/RETIRING-TERMINALS-AND-SITES.md` (0.67.0).
- Try it: copy `dist/0.68.0/` into a *test* folder, then install `packs/Test pack.json` from the editor's Admin > Packs.
