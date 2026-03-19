@echo off
chcp 65001 >nul
title Shadow DAM — Prodüksiyon (HTTPS)

echo.
echo  ╔══════════════════════════════════════╗
echo  ║  Shadow DAM  —  Produksiyon (HTTPS)  ║
echo  ╚══════════════════════════════════════╝
echo.

:: ── Docker kontrolü ───────────────────────────────────────────────────────────
docker info >nul 2>&1
if errorlevel 1 (
    echo  [HATA] Docker Engine calismiyor.
    pause & exit /b 1
)

cd /d "%~dp0"

:: ── Gerekli ortam değişkenleri ────────────────────────────────────────────────
if "%DOMAIN%"=="" (
    set /p DOMAIN="Alan adi (orn. shadow.example.com): "
)
if "%DOMAIN%"=="" (
    echo  [HATA] Alan adi bos olamaz.
    pause & exit /b 1
)

if "%SECRET_KEY%"=="" (
    echo  SECRET_KEY ayarlanmamis — rastgele uretiliyor...
    for /f "tokens=*" %%k in ('python -c "import secrets; print(secrets.token_hex(32))"') do set SECRET_KEY=%%k
    echo  SECRET_KEY: %SECRET_KEY%
    echo  Bu anahtari guvenli bir yerde saklayin!
    echo.
)

if "%ANTHROPIC_API_KEY%"=="" (
    set /p ANTHROPIC_API_KEY="Anthropic API Key (bos birakilabilir): "
)

:: ── Prodüksiyon compose başlat ────────────────────────────────────────────────
echo.
echo  Domain    : %DOMAIN%
echo  Baslatiliyor...
echo.

set DOMAIN=%DOMAIN%
set SECRET_KEY=%SECRET_KEY%
set ANTHROPIC_API_KEY=%ANTHROPIC_API_KEY%

docker compose -f docker-compose.prod.yml up -d --build

if errorlevel 1 (
    echo.
    echo  [HATA] Produksiyon baslatma basarisiz.
    pause & exit /b 1
)

echo.
echo  ╔══════════════════════════════════════╗
echo  ║  Produksiyon aktif!                  ║
echo  ║                                      ║
echo  ║  HTTPS : https://%DOMAIN%
echo  ║                                      ║
echo  ║  TLS sertifikasi Caddy tarafindan    ║
echo  ║  otomatik alinacak (Let's Encrypt).  ║
echo  ╚══════════════════════════════════════╝
echo.
pause
