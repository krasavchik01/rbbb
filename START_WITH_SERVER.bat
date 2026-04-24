@echo off
chcp 65001 > nul
cls
echo.
echo ================================================
echo    🚀 SUITE-A - Full Stack Start
echo ================================================
echo.
echo 1. Launching Backend Server (Port 3000)...
start "RBBB Backend" cmd /k "npm run dev:server"

echo 2. Launching Frontend (Port 8080)...
start "RBBB Frontend" cmd /k "npm run dev"

echo.
echo ✅ Done! Both services are starting in separate windows.
echo 🌐 App: http://localhost:8080
echo 🔌 API: http://localhost:3000/api/health
echo.
echo ================================================
pause
