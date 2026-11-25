# Roadmap: Scan import (profile scanner data into the platform)

Status: **Agreed direction (25 Nov 2026), not built.** Reviewed against the platform's decisions on 25 Nov 2026. This is a **sanitised** version: part numbers, scanner names and file paths from the original design handoff are replaced with generic names, because production data stays out of the repository (`CLAUDE.md`). The original handoff is kept outside the repository, in the owner's private workspace.

## What it is

A dedicated scanning and QC PC runs scanning software with a local Access database. Four sets of information are to be sent from that PC to the platform on a schedule, without changing anything on it:

| Set | What | State |
|---|---|---|
| 1. Scan data | New measurement rows and scan rows, as CSV files, one pair per data day | The export script exists (PowerShell, version 1). Run twice on the real database and checked against it |
| 2. Scan files | The image and the companion binary file for each new scan | Specified, not scripted |
| 3. Nominal overlays | About 55 small reference images, one per part or gauge | Specified, not scripted |
| 4. Spec records | Snapshots of the part and option tables, and specs derived from the measurements | Specified, not scripted; one settings file not yet read |

Image processing (drawing overlays, mapping failures) is **future work and not part of this build**. The point of copying files unchanged is to keep what it will need.

## Facts that shape the design (from the handoff)

- About 1.1 million measurement rows in the database and about 55,000 scans; real scans start in November 2023; a weekday is 60 to 230 scans (about 120 after duplicates), roughly 2,400 measurement rows a day.
- Rows have no serial or lot number: a scan is identified only by part and time. The scan's time is the scanning PC's local time, to the second, with no zone; the one hour that repeats when clocks go back is ambiguous.
- Variants: a part can have alternative alignment variants. The export keeps every variant row and drops only variant rows that exactly duplicate a base row.
- A row counts in pass-rate figures only when it is Pass or Fail (`countInStats` 1); Invalid (no feature found) and Saved (overlay marker) rows count 0.
- Each run overlaps the last by a day, so rows repeat; the converter must ignore a repeated row ID. A repeated scan row whose comment was edited later arrives with different text.
- Images are about 15 MB a working day (about 5 GB a year); each scan also has a small binary companion file. The overlays are about 1.6 MB in all. Licence key files and the scanning software's config must never be copied.

## Conflicts found against the platform, and how they are resolved

| # | Conflict | Resolution |
|---|---|---|
| 1 | **Volume.** About 2,400 measurement rows a day as entries would pass the platform's 60,000-entry slow threshold within weeks (a 60-day live window would hold about 145,000). | **Decided: one entry per scan** (about 120 a day, roughly 7,000 in a 60-day window) carrying that scan's measurements inside it. The raw CSVs stay as read-only files for reports and Power BI. |
| 2 | **Who writes entries.** (Revised 25 Nov 2026.) The first review said only a browser page could write entries. That was too strong: a platform entry is one line of plain JSON (`v`, `entryId`, `entry`, `item`, `refs`, `form`, `writtenAt`, `terminalId`, `site`, `values`, optional `prev` = SHA-256 of the previous line) in `data/<structure>/<date>/<terminal>.jsonl`, and the platform skips and logs a line that fails validation. | **Decided: the export script writes the entry lines itself**, as a terminal of its own (for example `SCANPC`, one writer per file, one file per day). No importer page and no one keeping a window open. It also writes the raw CSVs for reports. **Guard against drift:** the entry format is a written contract (`docs/roadmap/scan-import.md` build step 1), and a test on GitHub (which has PowerShell) runs the script's converter on sample CSVs and has the platform's own validator and loader read the output. |
| 3 | **Backup size.** The nightly backup copies the whole data folder into dated copies and a zip for SharePoint. Images would swell it by 5 GB a year, 30 times over. | **Decided: scan files live inside the data folder** (the platform can only read inside the folder the browser was given), **in their own `scans/` folder, not in the media library**, excluded from the nightly backup copy and given their own backup and retention. |
| 4 | **Time.** Imported rows arrive late, with the scanner's local time and no zone. | The entry is stamped at import time. The **scan time is a value on the entry**, never the entry time, and is not compared with the universal clock. A rule is needed for the repeated hour in autumn and for a back-filled history (open question). |
| 5 | **Credentials and network.** The scanning PC must write to the host over file sharing. | A separate account that can **only write to `inbox/` and `scans/`**, kept in the Windows credential store; IT confirms the scanning PC (same network as the host) can reach the host on port 445. IT is told before anything is scheduled on that PC. |

### Why not the media library for the images

The media library is for documents people choose in forms: each file is registered as an item, with fingerprints and tags, and has a 25 MB per-file cap. Tens of thousands of scan images would make thousands of registered items and slow its views and Find, and it sits inside the nightly backup. A plain `scans/` folder, named by a manifest, is read directly by path when a scan is opened.

## Proposed platform design (to settle at build time)

- **Structure `scans`** (published in the editor like any structure; the script writes entries for it as terminal `SCANPC`): one item per scan: scan ID (base part and time), part, variant list, scanner, scan time (a value), the scanner's comment, the measurements as a list inside it (tool, actual, nominal, delta, lower and upper limit, pass or fail, counts-in-stats), the manifest entry (image and companion file names and sizes), and the import batch. A live window and an open rule set so loads stay small.
- **Corrections:** an edited comment arrives as a new version of the scan; the **newest file wins**, recorded as a correction entry (the platform already supports corrections).
- **Spec records:** a structure (or lookup) of part, tool, nominal, lower and upper limit, first and last seen, with a new item when any value changes; snapshots of the part and option tables as read-only data.
- **Health:** the platform's data health report shows "no scan data for yesterday", "export script silent", rows with `countInStats` 0 and Pass or Fail that disagrees with the limits, and a **heartbeat** from the export script. This shares one convention with the email sender (a `heartbeat.json`, status files and job IDs per bridge script) so the health check reads them the same way.

## Build order (revised)

1. **The `scans` structure, the entry-format contract and the script's converter** (CSV to one entry per scan, ignoring repeated IDs, with the optional chain hash), with a test that runs the converter in PowerShell on synthetic CSVs and has the platform validate and load the output (no real part numbers in tests).
2. **Health checks** and the shared bridge heartbeat convention.
3. **Extend the script** to copy scan files and overlays into `scans/` with a manifest; exclude `scans/` from the nightly backup and set up its own retention.
4. **Schedule it** with catch-up, once IT agrees, and the delivery step to the host share.
5. **Spec snapshots** and the derived specs history.
6. **Later, optional:** thumbnails, then pins on the nominal outline. Image processing stays future work. Library rule: no third-party libraries in the kernel; a pinned, listed, fingerprinted classic script is the only allowed exception, and a server-side function is the better home for anything large.

## Open questions

- ~~Which PC runs the importer page?~~ **Dropped (25 Nov 2026):** the script writes the entries, so there is no importer page. The script runs only on the scanning PC, as before.
- Should the script's entries carry the **scan time** as their `writtenAt` (a back-filled history reads as it happened) or the export time? And how is the repeated autumn hour treated? (The scan time is also kept as a value either way.)
- Do image names use a 24-hour or 12-hour hour in the afternoon, and does every scan have an image? Does each variant have its own companion file? (A check script exists and has not been run.)
- What does the settings text file contain (the one not yet read), and should it transfer?
- What do Invalid and Saved mean to the operators? How can a scan be tied to a physical part or lot (nothing in the database does)?
- Retention of copied files in `scans/`, and the backup of the original `Samples` folder, which this process does not back up.
- IT sign-off for a scheduled task on the scanning PC.
