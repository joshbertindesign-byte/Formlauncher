# Roadmap: Data health check and restore from backup

Status: **Proposed (not agreed or built).** Raised after the SharePoint folder lost data and the platform moved to a shared drive with nightly backups (`ops/backup/`).

## Problem

Today a damaged or incomplete data folder is found by accident: a terminal shows no people, a form is missing, a day's file is half written. There is no one place that says "this folder is healthy" or "this is what is wrong", and putting a backup back is a manual copy that nothing checks.

## Can the editor do it? (feasibility, checked against the code)

| Need | Answer |
|---|---|
| Read a backup folder | **Yes.** The browser's folder picker (`showDirectoryPicker`) gives read access to any folder the admin picks, one grant per session. The platform already reads the data folder this way. |
| Copy files into the data folder | **Yes.** The platform already has write access to the data folder (that is how it saves). Reading a file from the backup and writing it to the same path is ordinary use of the same API. |
| Unzip a backup zip | **Yes.** `FP.updates.readZip` already unzips kernel zips in the browser (the browser's built-in `DecompressionStream`, no library). A zip is chosen with the file picker (`showOpenFilePicker`). It works in memory, which is fine at today's size (about 4 MB per backup) and would need streaming if backups grow to hundreds of MB. |
| Re-read and check afterwards | **Yes.** Loading, the per-file fingerprint chain check (Admin > Records, 0.49) and the library load already exist; the health check reuses them. |
| Move or rename a folder aside | **No.** The folder API has no move or rename for ordinary folders (only copy then delete). So "keep the damaged folder aside" means copying it, or restoring into a *new empty folder* (below). |
| Pick any folder | Not quite: the browser refuses some folders (Desktop, Documents, Downloads, system folders). Backups in `C:\FPBackups` or a OneDrive subfolder are fine. |

## What is proposed

### 1. Health check (read-only, admin, in the editor)

Admin > **Health** (or inside Clean-up): one button, **Check the data folder**. It reads everything and reports **Good / Warning / Problem**, each line naming the file and what to do. It writes nothing except a small report (`_health/<date>.json`). Checks:

- **Folder layout:** the expected folders exist (`data`, `library`, `runtime`, `_terminals`, `_changes`).
- **Runtime release:** the installed release's files are all there and match `release.json` (the installer's own check).
- **Daily files:** each `.jsonl` parses; count half-written last lines (allowed, one per file); the fingerprint chain holds; no empty (0 byte) files, which is what a failed sync leaves behind.
- **Library:** each definition's versions are contiguous and parse; the highest version is the one in force; `_changes` stamps point at files that exist.
- **People and sites:** at least one active admin; no duplicate IDs; every terminal's site exists; users file readable.
- **References:** forms name structures and functions that exist; entries name a structure that is registered (or retired).
- **Sync damage:** files that look like conflict copies (`name-HOSTNAME.json`, `name (1).json`) and files dated in the future.
- **Backups:** the newest file in the backup folder (if one is configured) is recent. (Optional.)

Terminals only need a one-line note: "The data check found a problem" on the admin's home, never a block on saving.

### 2. Restore from a backup (admin, in the editor, offered when the check fails or on demand)

Admin > Health > **Restore from a backup**. The admin points the editor at a dated backup **folder** (or a **zip**). The editor first shows what it found, comparing backup and live: files only in the backup, files only in the live folder, files that differ, and the newest entry time on each side. Then three ways, safest first:

1. **Restore into a new empty folder (recommended).** The admin makes an empty folder on the shared drive and picks it. The editor copies the backup into it and checks it. Nothing is deleted or overwritten. Then **Change data folder** (0.68.0) points every PC at the new folder, or the admin points the share at it. The damaged folder is left untouched for inspection.
2. **Fill the gaps in place.** Copy only files that are missing or damaged in the live folder (empty, unparseable, failed chain). Never overwrites a good file, so entries saved after the backup survive. Good for "yesterday's file went missing".
3. **Replace from the backup in place.** For when the live folder is beyond use. Needs a typed confirmation. Because folders cannot be moved aside, it first copies the current folder to `_before-restore-<time>/` inside the data folder, then overwrites. Entries saved after the backup are lost; the report says how many.

Common rules: admin only; the editor tells the admin to close launchers on other computers first (as Purge does) and says the platform may need a reload; every restore ends by re-running the health check and writing a restore report; nothing is deleted without being copied first.

## Build order

1. The health check engine (`FP.health`), pure reads, with a test folder of deliberately damaged data.
2. The Health pane and the report file; the one-line notice on the admin home.
3. Backup reading: folder picker and zip picker, the comparison and the plan view (still read-only).
4. Restore into a new folder; then fill the gaps; then replace in place.
5. Tests with the fake folder (damaged copies, a zip, a missing day), Help, the Guide and Spec wording.

## Open questions for the owner

- Is **restore into a new empty folder** the right default, given it needs a spare folder and a Change data folder step on each PC?
- Should the editor run the health check by itself when it opens (and say so), or only on request?
- Should "Restore from a backup" also be reachable from a terminal when the folder is found empty (an admin signs in), or editor only?
- A backup zip may be large later. Is streaming needed now, or can it wait until a backup passes about 100 MB?

## Not in scope

- Restoring one structure or one day's entries from a backup ("point in time", partial restore): later.
- Running the backup itself from the editor (it is a scheduled script on the host, `ops/backup/`; a browser page cannot schedule anything).
- Repairing a damaged file by hand-editing it: the check reports it, the restore replaces it.
