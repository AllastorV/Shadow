@echo off
chcp 65001 >nul
title Shadow DAM — Kurulum

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

:: ── Backend ───────────────────────────────────────────────────────────────────
echo.
echo [3/4] Backend bagimliliklari yukleniyor...
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

:: .env yoksa oluştur
if not exist ".env" (
    echo.
    echo        .env dosyasi olusturuluyor...
    for /f "tokens=*" %%k in ('python -c "import secrets; print(secrets.token_hex(32))"') do set RNDKEY=%%k
    (
        echo SECRET_KEY=%RNDKEY%
        echo ANTHROPIC_API_KEY=
        echo DATABASE_URL=sqlite:///./shadow.db
        echo UPLOAD_DIR=./uploads
        echo AI_BACKEND=auto
    ) > .env
    echo        backend\.env olusturuldu.
    echo        ANTHROPIC_API_KEY degerini doldurun ^(isteğe bagli^).
)

cd /d "%~dp0"

:: ── Frontend ──────────────────────────────────────────────────────────────────
echo.
echo [4/4] Frontend bagimliliklari yukleniyor...
cd /d "%~dp0frontend"
call npm install --loglevel=error
if errorlevel 1 (
    echo  [HATA] npm install basarisiz.
    pause & exit /b 1
)

cd /d "%~dp0"

echo.
echo  ╔══════════════════════════════════════╗
echo  ║    Kurulum tamamlandi!               ║
echo  ║                                      ║
echo  ║  Baslatmak icin:  baslat.bat         ║
echo  ╚══════════════════════════════════════╝
echo.
pause
