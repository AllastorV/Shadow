@echo off
chcp 65001 >nul
title Shadow DAM — Geliştirme

echo.
echo  ╔══════════════════════════════════════╗
echo  ║    Shadow DAM  —  Gelistirme Modu    ║
echo  ╚══════════════════════════════════════╝
echo.

:: ── Sanal ortam kontrolü ─────────────────────────────────────────────────────
if not exist "%~dp0backend\venv\Scripts\activate.bat" (
    echo  [HATA] Sanal ortam bulunamadi.
    echo         Once  install.bat  dosyasini calistirin.
    echo.
    pause & exit /b 1
)

:: ── .env kontrolü ─────────────────────────────────────────────────────────────
if not exist "%~dp0backend\.env" (
    echo  [UYARI] backend\.env bulunamadi.
    echo          install.bat calistirarak ornek dosya olusturun.
    echo.
    pause & exit /b 1
)

:: ── Backend — yeni pencerede başlat ─────────────────────────────────────────
echo  [1/2] Backend baslatiliyor  (port 8000)...
start "Shadow — Backend" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000 --host 0.0.0.0"

:: Kısa bekleme — backend başlasın
timeout /t 2 /nobreak >nul

:: ── Frontend — yeni pencerede başlat ────────────────────────────────────────
echo  [2/2] Frontend baslatiliyor  (port 5173)...
start "Shadow — Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: ── Bilgi ekranı ─────────────────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════╗
echo  ║  Servisler baslatildi!               ║
echo  ║                                      ║
echo  ║  Uygulama  : http://localhost:5173   ║
echo  ║  API Docs  : http://localhost:8000/docs ║
echo  ║                                      ║
echo  ║  Durdurmak icin her iki pencereyi    ║
echo  ║  kapatmaniz yeterli.                 ║
echo  ╚══════════════════════════════════════╝
echo.
pause
