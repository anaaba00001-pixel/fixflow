@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.12 or newer LTS, then try again.
  pause
  exit /b 1
)

node -e "const [a,b]=process.versions.node.split('.').map(Number);process.exit((a===20&&b>=19)||(a===22&&b>=12)||a>=24?0:1)"
if errorlevel 1 (
  echo Please install Node.js 22.12 or newer LTS.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\vite.cmd" (
  call npm ci --no-audit --no-fund
  if errorlevel 1 (
    echo Installation failed. Check your internet connection.
    pause
    exit /b 1
  )
)

echo Starting FixFlow. Keep this window open.
call npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --open

if errorlevel 1 pause
