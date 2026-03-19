@echo off
chcp 65001 >nul
title Shadow DAM — Bağımlılık Kurulumu

echo.
echo  ╔══════════════════════════════════════╗
echo  ║       Shadow DAM  —  Kurulum         ║
echo  ╚══════════════════════════════════════╝
echo.

:: ── Python kontrolü ──────────────────────────────────────────────────────────
echo [1/4] Python kontrol ediliyor...
python --version >nul 2>&1
if errorlevel 1 (
    echo  [HATA] Python bulunamadi. https://python.org adresinden indirin.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo        %%v bulundu.

:: ── Node.js kontrolü ─────────────────────────────────────────────────────────
echo [2/4] Node.js kontrol ediliyor...
node --version >nul 2>&1
if errorlevel 1 (
    echo  [HATA] Node.js bulunamadi. https://nodejs.org adresinden indirin.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo        Node %%v bulundu.

:: ── Backend bağımlılıkları ────────────────────────────────────────────────────
echo.
echo [3/4] Backend bagimliliklari yukleniyor  (pip)...
cd /d "%~dp0backend"

if not exist "venv" (
    echo        Sanal ortam olusturuluyor...
    python -m venv venv
)

call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet --no-warn-script-location
if errorlevel 1 (
    echo  [HATA] pip kurulumu basarisiz.
    pause & exit /b 1
)
echo        Backend bagimliliklari hazir.

:: .env dosyası yoksa örnek oluştur
if not exist ".env" (
    echo.
    echo        .env dosyasi bulunamadi — ornek olusturuluyor...
    (
        echo # Shadow DAM — Backend Ayarlari
        echo SECRET_KEY=BURAYA-EN-AZ-32-KARAKTERLIK-RASTGELE-BIR-ANAHTAR-GIRIN
        echo ANTHROPIC_API_KEY=
        echo DATABASE_URL=sqlite:///./shadow.db
        echo UPLOAD_DIR=./uploads
        echo AI_BACKEND=auto
    ) > .env
    echo        backend\.env olusturuldu — SECRET_KEY degerini doldurun!
)

cd /d "%~dp0"

:: ── Frontend bağımlılıkları ───────────────────────────────────────────────────
echo.
echo [4/4] Frontend bagimliliklari yukleniyor  (npm)...
cd /d "%~dp0frontend"
call npm install --loglevel=error
if errorlevel 1 (
    echo  [HATA] npm install basarisiz.
    pause & exit /b 1
)
echo        Frontend bagimliliklari hazir.

cd /d "%~dp0"

:: ── Tamamlandı ────────────────────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════╗
echo  ║    Kurulum tamamlandi!               ║
echo  ║                                      ║
echo  ║  Baslatmak icin:  dev.bat            ║
echo  ║  Docker ile:      docker-start.bat   ║
echo  ╚══════════════════════════════════════╝
echo.
echo  ONEMLI: backend\.env dosyasindaki SECRET_KEY degerini ayarlayin.
echo.
pause
