@echo off
setlocal EnableExtensions
REM Wrapper to restart the worker and verify cookies using PowerShell
REM Can be run from anywhere; it will cd to repo root automatically.
pushd "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\restart-and-verify-worker.ps1"
set EXITCODE=%ERRORLEVEL%
popd
exit /b %EXITCODE%
