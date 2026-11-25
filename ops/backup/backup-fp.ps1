# Form Platform backup (version 2).
#  1. Copies the whole data folder into a dated folder on this PC's disk.
#  2. Optionally also puts ONE zip of that copy into a folder that OneDrive syncs up to SharePoint.
#  3. Removes copies older than the keep time.
# Edit the lines marked CHANGE, run it once by hand, then schedule it (see the instructions).

$Source       = 'C:\BavarianApps'        # the shared folder on the host
$Destination  = 'C:\FPBackups'           # CHANGE if you want it elsewhere; a different disk is safer
$UploadFolder = ''                       # CHANGE: a folder that OneDrive syncs to SharePoint, e.g. the shortcut folder. Leave '' to skip the upload
$KeepDays     = 30

$ErrorActionPreference = 'Stop'
# Stray quote marks around a pasted path (from Copy as path) are removed, so the path works either way.
$Source = $Source.Trim().Trim('"').Trim("'"); $Destination = $Destination.Trim().Trim('"').Trim("'"); $UploadFolder = $UploadFolder.Trim().Trim('"').Trim("'")
$log = Join-Path $Destination 'backup-history.txt'
function Note($m) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm') $m" | Out-File -Append -Encoding utf8 $log }

try {
  if (-not (Test-Path $Source)) { throw "Source not found: $Source" }
  New-Item -ItemType Directory -Force -Path $Destination | Out-Null

  $stamp  = Get-Date -Format 'yyyy-MM-dd_HHmm'
  $target = Join-Path $Destination $stamp
  New-Item -ItemType Directory -Force -Path $target | Out-Null

  # /E all subfolders, retry a busy file twice. Exit codes 0 to 7 are success.
  robocopy $Source $target /E /R:2 /W:5 /NFL /NDL /NP /LOG:"$Destination\last-backup.log" | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "The copy had errors (robocopy exit $LASTEXITCODE). See $Destination\last-backup.log" }
  Note "Copy OK: $target"

  if ($UploadFolder -ne '') {
    if (-not (Test-Path $UploadFolder)) { throw "Upload folder not found: $UploadFolder" }
    $zip = Join-Path $UploadFolder "FormPlatform_$stamp.zip"
    Compress-Archive -Path "$target\*" -DestinationPath $zip -CompressionLevel Optimal
    Note "Zip placed for upload: $zip"
    Get-ChildItem $UploadFolder -Filter 'FormPlatform_*.zip' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } | Remove-Item -Force
  }

  Get-ChildItem $Destination -Directory | Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{4}$' -and $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } | Remove-Item -Recurse -Force
  Note 'Done.'
}
catch {
  try { Note "FAILED: $($_.Exception.Message)" } catch {}
  throw
}
