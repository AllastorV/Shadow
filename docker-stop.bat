@echo off
chcp 65001 >nul
title Shadow DAM — Docker Durdur

echo.
echo  ╔══════════════════════════════════════╗
echo  ║    Shadow DAM  —  Durdur             ║
echo  ╚══════════════════════════════════════╝
echo.

cd /d "%~dp0"

docker compose down

echo.
echo  Konteynerler durduruldu.
echo.
pause
