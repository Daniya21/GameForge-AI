@echo off
setlocal
cd /d "%~dp0"

echo.
echo ================================================
echo   GameForge AI - Simplified Production Studio
echo ================================================
echo.

if not exist package.json (
  echo ERROR: package.json was not found.
  echo Extract the complete ZIP first and run this file from the project root.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing project dependencies...
  call npm.cmd install
  if errorlevel 1 goto :failed
)

echo Checking the simplified production workflow...
call npm.cmd run verify:experience
if errorlevel 1 goto :failed

echo.
echo Starting GameForge at http://localhost:3000
call npm.cmd run dev
exit /b %errorlevel%

:failed
echo.
echo GameForge could not start. Read the error above.
pause
exit /b 1
