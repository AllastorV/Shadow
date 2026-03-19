@echo off
chcp 65001 >nul
title Shadow DAM — Baslatılıyor

echo.
echo  ╔══════════════════════════════════════╗
echo  ║       Shadow DAM  —  Baslatılıyor    ║
echo  ╚══════════════════════════════════════╝
echo.

:: ── Docker varsa Docker ile, yoksa doğrudan çalıştır ─────────────────────────
docker info >nul 2>&1
if not errorlevel 1 (
    echo  Docker bulundu — konteynerler baslatiliyor...
    echo.
    cd /d "%~dp0"
    docker compose up -d --build
    if errorlevel 1 (
        echo  [HATA] Docker baslatma basarisiz — dogrudan mod deneniyor...
        goto DIRECT
    )
    echo.
    echo  ╔══════════════════════════════════════╗
    echo  ║  Uygulama hazir!                     ║
    echo  ║                                      ║
    echo  ║  Adres : http://localhost:5173        ║
    echo  ║  API   : http://localhost:8000/docs   ║
    echo  ║                                      ║
    echo  ║  Durdurmak icin bu pencereyi kapatın ║
    echo  ║  ve su komutu calistirin:            ║
    echo  ║    docker compose down               ║
    echo  ╚══════════════════════════════════════╝
    echo.
    pause
    exit /b 0
)

:DIRECT
:: ── Docker yok veya başarısız — doğrudan çalıştır ───────────────────────────
echo  Docker bulunamadi — dogrudan mod kullaniliyor.
echo.

if not exist "%~dp0backend\venv\Scripts\activate.bat" (
    echo  [HATA] Sanal ortam bulunamadi. Once  kur.bat  dosyasini calistirin.
    pause & exit /b 1
)

if not exist "%~dp0backend\.env" (
    echo  [HATA] backend\.env bulunamadi. Once  kur.bat  dosyasini calistirin.
    pause & exit /b 1
)

echo  [1/2] Backend baslatiliyor  (http://localhost:8000)...
start "Shadow — Backend" cmd /k "cd /d "%~dp0backend" && call venv\Scripts\activate.bat && uvicorn app.main:app --reload --port 8000 --host 0.0.0.0"

timeout /t 3 /nobreak >nul

echo  [2/2] Frontend baslatiliyor  (http://localhost:5173)...
start "Shadow — Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo  ╔══════════════════════════════════════╗
echo  ║  Uygulama hazir!                     ║
echo  ║                                      ║
echo  ║  Adres : http://localhost:5173        ║
echo  ║  API   : http://localhost:8000/docs   ║
echo  ║                                      ║
echo  ║  Durdurmak icin Backend ve Frontend  ║
echo  ║  pencerelerini kapatmaniz yeterli.   ║
echo  ╚══════════════════════════════════════╝
echo.
pause
