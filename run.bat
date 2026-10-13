@echo off
setlocal
cd /d "%~dp0"

echo =======================================================
echo   Launching Chess Intelligent Training Web Application
echo   Opening URL: http://localhost:3000
echo =======================================================

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

start "" "http://localhost:3000"
call npm run dev
