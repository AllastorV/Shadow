@echo off
chcp 65001 >nul
title Shadow DAM — Docker

echo.
echo  ╔══════════════════════════════════════╗
echo  ║    Shadow DAM  —  Docker Modu        ║
echo  ╚══════════════════════════════════════╝
echo.

:: ── Docker kontrolü ───────────────────────────────────────────────────────────
docker info >nul 2>&1
if errorlevel 1 (
    echo  [HATA] Docker Engine calismiyor veya kurulu degil.
    echo         Docker Desktop'i baslatin ve tekrar deneyin.
    echo.
    pause & exit /b 1
)

cd /d "%~dp0"

echo  Konteynerler baslatiliyor...
echo.
docker compose up -d --build

if errorlevel 1 (
    echo.
    echo  [HATA] Docker Compose basarisiz oldu.
    echo         Yukaridaki hata mesajini inceleyin.
    echo.
    pause & exit /b 1
)

echo.
echo  ╔══════════════════════════════════════╗
echo  ║  Konteynerler hazir!                 ║
echo  ║                                      ║
echo  ║  Uygulama  : http://localhost:5173   ║
echo  ║  API        : http://localhost:8000   ║
echo  ║                                      ║
echo  ║  Durdurmak : docker-stop.bat         ║
echo  ╚══════════════════════════════════════╝
echo.
pause
