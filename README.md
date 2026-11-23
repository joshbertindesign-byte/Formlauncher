# Form Platform

A forms and data platform that runs in Edge from a shared SharePoint folder: no server, no third-party libraries.

| Folder | What it is |
|---|---|
| `kernel/` | **The source** (`fp-*.js`, `launcher.html`, `editor.html`) plus `dev/tests` (regression suite) and `dev/tools` (`release.py`). Work here. |
| `Forms b/` | **What is deployed** to the SharePoint folder: `runtime/<version>/`, the Spec and User Guide PDFs, and the WIP zip. |
| `docs/` | Review, fix list, how it works, how to test. Start with `docs/HOW-IT-WORKS.md`. |
| `.github/` | Publishes `kernel-X.Y.Z.zip` as a GitHub Release when you push a `vX.Y.Z` tag. |

- Run the tests: `kernel/dev/tests/regress.sh` (see `docs/TESTING.md`).
- What to fix next: `docs/FIX-LIST.md`. What was found and why: `docs/REVIEW-0.60-0.62.md`.
- `kernel/` is the work in progress (0.62.0); `Forms b/runtime/0.60.0/` is the last stable release.
