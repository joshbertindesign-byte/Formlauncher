# Deployment: where the data folder lives (decided, November 2026)

**The data folder is a shared Windows folder on an always-on host PC, mapped as a drive on every terminal and on the editor PC (for example `Z:\`, pointing at `\\HOST\Share`).**
Every PC chooses the same folder in the browser's folder picker. This is the supported, intended deployment.

## Why

The platform was first run from a SharePoint library synced by OneDrive. In use, sync was slow and unreliable for live data (changes took minutes or never arrived, files were lost
or went stale). A shared folder gives every PC the same files at once. The Spec had already planned this ("a shared Windows folder ... removes sync delay and changes nothing in the code").

## What this means (rules for anyone, human or agent, working on this project)

- **An always-on host PC and a shared folder are normal and supported.** Do not treat them as something to avoid, work around or argue against. Do not propose moving live data back to OneDrive or SharePoint sync.
- **"No server" means no application server software** (no database, no web server, no API). A file share on a host PC is not a server in that sense and is allowed.
- **SharePoint is no longer the live store.** It is used for the off-site backup zip (see `ops/backup/`), and may still hold documents that media entries link to.
- **Power Automate cloud flows cannot see the host's disk.** The flows in the Spec (weekly tables for Power BI, email intake, SharePoint documents, outgoing email) work only if their folders are reachable, for example through a one-way copy host to SharePoint or a data gateway. They are optional integrations, not part of the core. Do not break them knowingly; do say when a change affects them.
- **Backups matter more now.** The host's disk is the only live copy. Nightly backups are `ops/backup/backup-fp.ps1` (a dated local copy and a zip into a folder that OneDrive uploads). The roadmap `docs/roadmap/data-health-and-restore.md` adds a health check and a restore from a backup.
- **The host must be on, awake and reachable.** Terminals keep what they cannot save in the outbox and write it when the folder returns. Anything that assumes the folder is always reachable is wrong; anything that assumes it is synced and slow is also wrong.
- **Choosing the folder:** use **Choose data folder** (first start) or **Change data folder** (launcher, for supervisors and above; editor Admin > Test folder > Data folder). Pick the folder that holds `data`, `library` and `runtime`. The browser refuses Desktop, Documents, Downloads and drive roots, so use a subfolder of the share.

## Older documents

Documents written before this decision (the Spec and Guide PDFs, `docs/FIX-LIST.md`, `docs/REVIEW-0.60-0.62.md`, older notes in `docs/`) describe a OneDrive-synced SharePoint folder. Treat those passages as history. Where a current document and an older one disagree about where the data lives, this document wins.

## Status of the wording

- Updated for this decision: `README.md`, `docs/HOW-IT-WORKS.md`, `kernel/dev/tools/PACKAGE-README.txt` (the "READ ME FIRST" in the package, from the next package build), `CLAUDE.md`, the Spec and Guide as editable docs.
- Left as written on purpose, because they describe what the code does and not where the folder is: the code comments in `kernel/fp-core.js` (they say "a OneDrive-synced folder today, possibly a mapped drive later"; reword in the next release) and the sync-delay handling (retry on a busy or changed file), which is still correct and harmless on a share.
