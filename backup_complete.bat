@echo off
setlocal ENABLEDELAYEDEXPANSION

REM ==============================================
REM  Backup Script: backup_complete.bat
REM  Creates a timestamped ZIP archive of the repo
REM  Excludes: node_modules, dist, backups, .git
REM  Output:  backups\backup_YYYYMMDD_HHMMSS.zip
REM  Also writes a SHA256 hash (if certutil available)
REM ==============================================

REM Move to the directory where this script resides (repo root)
pushd "%~dp0"

REM Ensure backups directory exists
if not exist "backups" mkdir "backups"

REM Generate timestamp via PowerShell (locale-independent)
for /f %%I in ('powershell -NoLogo -NoProfile -Command "(Get-Date).ToString('yyyyMMdd_HHmmss')"') do set "TS=%%I"

set "ARCHIVE=backups\backup_%TS%.zip"

echo Creating backup: %ARCHIVE%

REM Prefer tar (built into modern Windows). Fallback to PowerShell Compress-Archive.
where tar >NUL 2>&1
if %ERRORLEVEL%==0 (
  echo Using tar utility...
  REM -a chooses archive type based on extension (.zip)
  tar -a -c -f "%ARCHIVE%" --exclude=node_modules --exclude=dist --exclude=backups --exclude=.git .
) else (
  echo tar not found. Falling back to PowerShell Compress-Archive...
  powershell -NoLogo -NoProfile -Command ^
    "$items = Get-ChildItem -Recurse -File | Where-Object { $_.FullName -notmatch '\\node_modules\\|\\dist\\|\\backups\\|\\\.git\\' }; ^
     if(-not $items){ Write-Host 'No files found to archive (after exclusions).'; exit 0 } ^
     $paths = $items | ForEach-Object { $_.FullName }; ^
     Compress-Archive -Path $paths -DestinationPath '%ARCHIVE%' -Force"
)

IF NOT EXIST "%ARCHIVE%" (
  echo ERROR: Archive not created.
  popd
  endlocal
  exit /b 1
)

echo Backup archive created successfully.

REM Create SHA256 hash file if certutil exists
where certutil >NUL 2>&1
if %ERRORLEVEL%==0 (
  certutil -hashfile "%ARCHIVE%" SHA256 > "%ARCHIVE%.sha256.txt"
  echo SHA256 hash written to %ARCHIVE%.sha256.txt
) else (
  echo certutil not found; skipping hash generation.
)

REM Optional: Retention policy (uncomment to keep only last 10 backups)
REM for /f "skip=10 delims=" %%F in ('dir /b /o-d backups\backup_*.zip') do (
REM   echo Deleting old backup %%F
REM   del "backups\%%F" 2>NUL
REM   del "backups\%%F.sha256.txt" 2>NUL
REM )

echo Done.

popd
endlocal
exit /b 0
