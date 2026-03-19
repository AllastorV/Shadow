import logging
from pathlib import Path
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from .database import Base, engine
from .routers import auth, projects, assets, comments, share, markers, collab
from .config import settings

# Tablo oluştur
Base.metadata.create_all(bind=engine)

# Upload dizinini oluştur
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)

# ── Hafif başlangıç migrasyonu ────────────────────────────────────────────────
def _run_migrations() -> None:
    """Mevcut tablolara yeni nullable sütunlar ekler (varsa atlar)."""
    from sqlalchemy import text
    stmts = [
        "ALTER TABLE comments ADD COLUMN guest_name VARCHAR(100)",
        "ALTER TABLE markers  ADD COLUMN guest_name VARCHAR(100)",
        # Brute-force koruması (yeni sütunlar)
        "ALTER TABLE users ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN locked_until DATETIME",
    ]
    with engine.connect() as conn:
        for stmt in stmts:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass  # Sütun zaten var


def _ensure_guest_user() -> None:
    """Share link misafirleri için sistem kullanıcısı oluşturur (gerekirse)."""
    from .database import SessionLocal
    from .models.user import User, UserRole
    from .services.auth import hash_password
    db = SessionLocal()
    try:
        exists = db.query(User).filter(User.email == "_guest@shadow.internal").first()
        if not exists:
            db.add(User(
                email="_guest@shadow.internal",
                username="_guest",
                full_name="Misafir",
                hashed_password=hash_password("!"),  # Giriş yapılamaz
                role=UserRole.viewer,
                is_active=False,
            ))
            db.commit()
    finally:
        db.close()


_run_migrations()
_ensure_guest_user()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(
    title="Shadow — AI Media Asset Management",
    description="AI-powered Digital Asset Management platform",
    version="1.0.0",
    # SECURITY: Prodüksiyonda /docs ve /redoc kapat:
    # docs_url=None, redoc_url=None,
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# GZip sıkıştırma — JSON yanıtları %60-80 daha küçük
# minimum_size=1000: küçük yanıtları sıkıştırma (CPU vs bandwidth tradeoff)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS — yalnızca yapılandırılmış kaynaklara izin ver
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Her yanıta güvenlik başlıkları ekle."""
    response: Response = await call_next(request)

    # XSS / clickjacking / sniff koruması
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"

    # CSP: medya (img/video/audio) hem API hem static /files/'den yüklenebilir
    # connect-src: ws:// ve wss:// aynı origin'e izin ver (gerçek zamanlı işbirliği)
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "img-src 'self' data: blob:; "
        "media-src 'self' blob:; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "connect-src 'self' ws: wss:; "
        "frame-ancestors 'none';"
    )

    # HSTS: HTTPS zorunlu (1 yıl, alt alan adları dahil)
    # X-Forwarded-Proto: https → Caddy/nginx arkasında çalışırken HTTPS bağlantı var
    is_https = (
        request.headers.get("X-Forwarded-Proto") == "https"
        or request.url.scheme == "https"
    )
    if is_https:
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains; preload"
        )

    # Server parmak izi gizle (MutableHeaders.pop yok — del kullan)
    try:
        del response.headers["Server"]
    except (KeyError, AttributeError):
        pass
    try:
        del response.headers["X-Powered-By"]
    except (KeyError, AttributeError):
        pass
    return response


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Global hata yöneticisi — istemciye stack trace sızdırma."""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred"},
    )


# SECURITY NOTE: /files/ static mount UUID dosya adları kullanır (256-bit entropi).
# Dosya yolu tahmin etmek pratikte imkansız. Ancak prodüksiyonda tüm dosya
# erişimini /api/v1/assets/{id}/download veya /api/v1/share/file/{token}
# üzerinden yönetmek daha güvenlidir.
# Şu an: Kimlik doğrulamalı assetler bu yolla yükleniyor (video/audio streaming için gerekli).
# Paylaşım linkleri: /api/v1/share/file/{token} kullanır (token doğrulama + path traversal koruması).
uploads_path = Path(settings.UPLOAD_DIR)
if uploads_path.exists():
    app.mount("/files", StaticFiles(directory=str(uploads_path)), name="files")

app.include_router(auth.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(assets.router, prefix="/api/v1")
app.include_router(comments.router, prefix="/api/v1")
app.include_router(share.router, prefix="/api/v1")
app.include_router(markers.router, prefix="/api/v1")
app.include_router(collab.router)  # WebSocket: /ws/{project_id}


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "app": "Shadow DAM"}


@app.get("/api/v1/ai/status")
def ai_status():
    """AI backend durumunu döndür (Ollama / Anthropic)."""
    from .services.ai_service import ai_service
    return ai_service.get_status()


@app.get("/.well-known/security.txt", include_in_schema=False)
def security_txt():
    """RFC 9116 — güvenlik açığı bildirim politikası."""
    from fastapi.responses import PlainTextResponse
    content = (
        "# Shadow DAM — Güvenlik Açığı Bildirim Politikası\n"
        "Contact: mailto:security@shadow.internal\n"
        "Preferred-Languages: tr, en\n"
        "Policy: https://shadow.internal/security-policy\n"
        "Canonical: https://shadow.internal/.well-known/security.txt\n"
        "Expires: 2026-12-31T23:59:59Z\n"
    )
    return PlainTextResponse(content, headers={"Cache-Control": "max-age=86400"})
