@echo off
cd /d "%~dp0"
echo Starting SUITE-A...
echo Current directory: %CD%
npm run dev
pause

