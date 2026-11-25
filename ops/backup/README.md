# Backing up the shared data folder

The platform's data folder lives on a shared drive on one PC (the host). These scripts keep copies of it. Nothing here is part of the kernel; it is for whoever looks after the host PC.

| File | What it does |
|---|---|
| `backup-fp.ps1` | The real backup. Copies the data folder into a dated folder on the host's disk (`C:\FPBackups\<date>_<time>`), optionally puts one zip of that copy into a folder OneDrive syncs to SharePoint, removes copies older than 30 days, and writes each run (and any failure) to `backup-history.txt` in the backup folder. |
| `backup-test.bat` | A one-off test: copies the data folder under your user folder and says which step failed. Proves the copy works; it is on the same disk, so it is not a backup. |

## Set up (on the host PC)

1. Save `backup-fp.ps1` as `C:\Scripts\backup-fp.ps1`. If it was downloaded as `.txt`, turn on File Explorer > View > Show > File name extensions and rename it.
2. Open it in Notepad (right-click > Open with, not double-click). Edit the lines at the top:
   - `$Source`: the shared folder (default `C:\BavarianApps`).
   - `$Destination`: where the dated copies go (default `C:\FPBackups`; a different disk is safer).
   - `$UploadFolder`: a folder that OneDrive syncs to SharePoint, for the off-site zip. Leave `''` to skip it. Stray quote marks from "Copy as path" are removed by the script.
3. Run it once by hand from an **administrator** PowerShell window: `powershell -ExecutionPolicy Bypass -File C:\Scripts\backup-fp.ps1`. Then read the last lines of `backup-history.txt`: **Copy OK**, **Zip placed for upload**, **Done.**
4. Schedule it (administrator PowerShell, one line). Runs at 2 AM as the signed-in user:

   `schtasks /Create /SC DAILY /ST 02:00 /TN "FormPlatformBackup" /TR "powershell -ExecutionPolicy Bypass -File C:\Scripts\backup-fp.ps1"`

   To run as the system account (no one needs to be signed in) add `/RU SYSTEM`; some PCs refuse it ("Access is denied").
5. Test the schedule: `schtasks /Run /TN "FormPlatformBackup"`, then check `backup-history.txt` a minute later.

## Restore

Stop using the platform. Copy a dated folder's contents from `C:\FPBackups\<date>_<time>` (or unzip a zip from SharePoint) back into the shared folder. Let each PC reconnect. Practise this once on a spare folder.

## Things to remember

- The host PC must be on and awake at the scheduled time, and (for the user-account task) signed in.
- A backup on the same disk does not protect against that disk failing; the SharePoint zip is the off-site copy.
- Power Automate cannot see the host's disk. It can watch the SharePoint folder (a flow that mails you when a new zip arrives, and one that mails you when none arrived in 24 hours).
