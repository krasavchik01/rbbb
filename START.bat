@echo off
chcp 65001 > nul
cls
echo.
echo ================================================
echo    🚀 SUITE-A - Запуск сервера
echo ================================================
echo.
echo 📁 Текущая директория: %CD%
echo.
cd /d "%~dp0"
echo ✅ Переход в папку проекта...
echo.
echo 🔍 Проверка package.json...
if not exist "package.json" (
    echo ❌ ОШИБКА: package.json не найден!
    echo    Убедитесь что вы в правильной папке.
    pause
    exit /b 1
)
echo ✅ package.json найден
echo.
echo 🚀 Запуск сервера...
echo.
echo ⚠️  НЕ ЗАКРЫВАЙТЕ ЭТО ОКНО!
echo.
echo 🌐 После запуска откройте в браузере:
echo    http://localhost:8080
echo.
echo ================================================
echo.
npm run dev
pause

