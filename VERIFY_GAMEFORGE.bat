@echo off
setlocal
cd /d "%~dp0"

echo.
echo ================================================
echo   GameForge AI - Full Verification
echo ================================================
echo.

if not exist package.json (
  echo ERROR: package.json was not found in this folder.
  pause
  exit /b 1
)

if not exist node_modules (
  call npm.cmd install
  if errorlevel 1 goto :failed
)

call npm.cmd run verify:experience
if errorlevel 1 goto :failed

call npm.cmd run typecheck
if errorlevel 1 goto :failed

call npm.cmd run build
if errorlevel 1 goto :failed

echo.
echo SUCCESS: GameForge passed the route, TypeScript, and production-build checks.
pause
exit /b 0

:failed
echo.
echo VERIFICATION FAILED. The command above shows the exact remaining problem.
pause
exit /b 1
