@echo off
rem Form Platform: backup test (version 2). Copies C:\BavarianApps into a dated folder under your own user folder.
rem This is only a test of the copy. For real protection the copy must go to a different disk (see backup-fp.ps1).
setlocal
set SRC=C:\BavarianApps
set DEST=%USERPROFILE%\FPBackupTest

echo Running as: %USERNAME% on %COMPUTERNAME%
echo Source:      %SRC%
echo Destination: %DEST%
echo.

if not exist "%SRC%" (
  echo STEP 1 FAILED: the source folder is not found: %SRC%
  echo Run this on the host PC, the one that holds the shared folder.
  pause
  exit /b 1
)
echo STEP 1 OK: source folder found.

for /f "tokens=*" %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set STAMP=%%t
set TARGET=%DEST%\%STAMP%
mkdir "%TARGET%"
if not exist "%TARGET%" (
  echo STEP 2 FAILED: could not create %TARGET%
  echo Windows refused to create the destination folder. Try Run as administrator, or tell Claude this line.
  pause
  exit /b 2
)
echo STEP 2 OK: destination folder created.

echo.
echo STEP 3: copying ...
robocopy "%SRC%" "%TARGET%" /E /R:2 /W:5 /NP /LOG:"%DEST%\last-test.log" /TEE
set CODE=%ERRORLEVEL%

echo.
if %CODE% GEQ 8 (
  echo STEP 3 FAILED (robocopy code %CODE%). Look above for the line starting with ERROR, it names the file or folder.
  echo The full log is %DEST%\last-test.log
) else (
  echo BACKUP OK. Robocopy code %CODE% (0 to 7 means success).
  echo Files are in %TARGET%
  start "" "%TARGET%"
)
echo.
pause
exit /b %CODE%
