@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "PORT=8080"
set "HOST=0.0.0.0"
set "INGEST_WORKER_SECRET=dev_ingest_secret"
set "INGEST_CALLBACK_URL=http://localhost:3005/api/ingest/callback"
set "INGEST_CALLBACK_SECRET=dev_ingest_secret"
set "WORKER_PUBLIC_URL=http://127.0.0.1:8080"

REM Optional: point to yt-dlp binary for reliability on Windows
if not defined YT_DLP_PATH set "YT_DLP_PATH=C:\Tools\yt-dlp\yt-dlp.exe"

REM --- Hard-clear inherited browser mode to avoid surprises
set "YT_DLP_COOKIES_FROM_BROWSER="
set "YT_DLP_COOKIES_FROM_BROWSER_PROFILE="

REM --- Resolve cookie file path and validate (allow running with no cookies)
set "NO_COOKIES=0"
if defined YT_DLP_COOKIES (
  set "COOKIE_FILE=%YT_DLP_COOKIES%"
) else (
  set "COOKIE_FILE=%USERPROFILE%\Downloads\yt-cookies.txt"
)
REM Prefer durable cookies if available and large enough
set "DURABLE_COOKIE=%~dp0data\cookies\yt-cookies.txt"
if exist "%DURABLE_COOKIE%" (
  for %%D in ("%DURABLE_COOKIE%") do if %%~zD geq 1000 (
    set "COOKIE_FILE=%DURABLE_COOKIE%"
  )
)
if not exist "%COOKIE_FILE%" (
  echo [start-worker] WARN: cookies file missing: "%COOKIE_FILE%". Continuing with no cookies.
  set "NO_COOKIES=1"
) else (
  for %%A in ("%COOKIE_FILE%") do if %%~zA lss 1000 (
    echo [start-worker] WARN: cookies file too small (%%~zA bytes). Continuing with no cookies.
    set "NO_COOKIES=1"
  )
)

REM --- Prefer file cookies unequivocally (only if valid)
if "%NO_COOKIES%"=="0" (
  set "YT_DLP_COOKIES=%COOKIE_FILE%"
) else (
  set "YT_DLP_COOKIES="
)

REM Start the worker and append output to shared log files so we can see startup info
set "LOG_OUT=%~dp0..\worker_8080_out_live.txt"
set "LOG_ERR=%~dp0..\worker_8080_err_live.txt"
REM Ensure only one instance is listening on 8080
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /R ":8080 .*LISTENING"') do (
  taskkill /F /PID %%p >nul 2>&1
)
REM Rotate logs (truncate) for a clean startup snapshot
break > "%LOG_OUT%"
break > "%LOG_ERR%"
echo [WRAP] wrapper starting fresh>> "%LOG_OUT%"
echo [START] Starting ingest worker on %HOST%:%PORT% ...>> "%LOG_OUT%"
echo   WORKER_PUBLIC_URL=%WORKER_PUBLIC_URL%>> "%LOG_OUT%"
echo   INGEST_CALLBACK_URL=%INGEST_CALLBACK_URL%>> "%LOG_OUT%"
echo   INGEST_WORKER_SECRET set: YES>> "%LOG_OUT%"
echo   YT_DLP_PATH=%YT_DLP_PATH%>> "%LOG_OUT%"
if defined YT_DLP_COOKIES echo   YT_DLP_COOKIES=%YT_DLP_COOKIES%>> "%LOG_OUT%"
if "%NO_COOKIES%"=="0" (
  echo [start-worker] Cookie mode: file ^{ YT_DLP_COOKIES="%YT_DLP_COOKIES%" ^}>> "%LOG_OUT%"
) else (
  echo [start-worker] Cookie mode: none>> "%LOG_OUT%"
)
node "%~dp0dist\index.js" 1>>"%LOG_OUT%" 2>>"%LOG_ERR%"


