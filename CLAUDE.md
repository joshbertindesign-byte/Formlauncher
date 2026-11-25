# Form Platform: notes for anyone (human or agent) working in this repository

A no-server, browser-only forms and data platform: HTML and JavaScript run in Edge from a shared folder, with JSON files for storage and no third-party libraries. Source is `kernel/`; the end-user package is `dist/`.

## Deployment (decided, do not relitigate)

The data folder is a **shared Windows folder on an always-on host PC**, mapped as a drive on every terminal. An always-on host and a shared folder are supported and intended; do not argue for avoiding them, and do not propose moving live data back to OneDrive or SharePoint sync (it was unreliable and lost data). "No server" means no application server software. SharePoint is for the off-site backup zip and linked documents only. Full record: `docs/DEPLOYMENT.md`.

## Working rules

- **Version and release:** versions are bumped with `python3 kernel/dev/tools/bump.py kernel X.Y.Z`; the package is built with `cd kernel && node dev/tools/build-package.js ../dist` (replace the old `dist/` version, keep only the current one); `kernel/fp-*.js` must equal `dist/<ver>/runtime/<ver>/`. Do not push tags or open pull requests unless asked.
- **Tests:** the full regression runs on GitHub Actions on every push touching `kernel/` (`.github/workflows/regression.yml`, about 35 minutes; a failed run prints the failing tests' logs). Do not rely on running the whole suite in a cloud session: the container restarts and kills long runs. Locally run single tests with `cd kernel/dev/tests && TZ=America/Chicago ./regress.sh lNN` (never `node lNN.js` directly: it uses the wrong clock and gives false failures). Seeds are git-ignored; see `docs/TESTING.md`.
- **Never claim a state you have not just read.** Say "running", "passed" or "failed" only after reading the live source (the GitHub run, the process list, the file). If something cannot be checked, say so.
- **Colour:** no colour literals outside `kernel/fp-theme.js` (`python3 kernel/dev/tools/tokenize.py check` must report 0); touch targets 48 px or more on operator screens; contrast checked in day and night (`kernel/dev/shots/`).
- **Docs live in `docs/`:** build notes per release, roadmaps in `docs/roadmap/`, the Spec and Guide wording changes in `docs/GUIDE-UPDATES.md`. The Spec and Guide also exist as editable documents (claude.ai docs); keep them in step with the decisions here.
- **Production data and plant-specific names stay out of the repo.** The production pack is built outside the repository, from documents the owner supplies.
- **Plain language for the owner.** The owner is not a programmer: say what happened and what to do next, give exact steps and say where to type them, and be honest about what is untested.
