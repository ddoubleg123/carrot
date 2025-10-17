@echo off
echo 🚀 Starting Stable Diffusion Tunnel Manager...
echo.
echo This will keep your SSH tunnel alive and automatically reconnect if it drops.
echo Press Ctrl+C to stop.
echo.

powershell -ExecutionPolicy Bypass -File "keep-tunnel-alive.ps1"

pause
