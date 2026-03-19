import secrets
import sys
from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./shadow.db"
    # SECRET_KEY MUST be set via environment variable in production.
    # A random key is generated for development/testing ONLY.
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    UPLOAD_DIR: str = str(Path(__file__).parent.parent / "uploads")
    MAX_UPLOAD_SIZE: int = 500 * 1024 * 1024  # 500MB
    ANTHROPIC_API_KEY: str = ""

    # ── Local AI (Ollama) ayarları ────────────────────────────────────────────
    # AI backend: "auto" | "local" | "anthropic" | "mock"
    #   auto   → Ollama varsa local, yoksa Anthropic, ikisi de yoksa mock
    #   local  → Sadece Ollama kullan (Ollama çalışmıyorsa hata ver)
    #   anthropic → Sadece Anthropic API kullan
    #   mock   → Gerçek AI yok, dummy veri döndür (test/geliştirme)
    AI_BACKEND: str = "auto"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    # Ollama vision modeli — görsel analiz için (LLaVA tabanlı)
    # Öneriler (küçükten büyüğe):
    #   moondream   ~1.7GB  — en hızlı, temel analiz
    #   llava:7b    ~4.1GB  — iyi denge
    #   llava:13b   ~7.4GB  — yüksek kalite (16GB+ RAM)
    #   llava-phi3  ~2.9GB  — Phi-3 tabanlı, hızlı ve iyi
    OLLAMA_VISION_MODEL: str = "moondream"
    # Ollama text modeli — AI arama reranking için
    # Öneriler:
    #   gemma2:2b    ~1.6GB  — hızlı
    #   llama3.2:3b  ~2.0GB  — çok iyi küçük model
    #   mistral:7b   ~4.1GB  — güçlü
    OLLAMA_TEXT_MODEL: str = "llama3.2:3b"

    # Allowed origins for CORS (comma-separated)
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:4173"
    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    # Allowed file extensions (security whitelist)
    ALLOWED_EXTENSIONS: set = {
        # Görseller
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif",
        ".tif", ".tiff",           # TIFF — profesyonel fotoğrafçılık
        # RAW kamera formatları (sadece metadata; preview için sidecar JPEG beklenir)
        ".raw",                    # Generic RAW
        ".cr2", ".cr3",            # Canon RAW
        ".nef", ".nrw",            # Nikon RAW
        ".arw", ".srf", ".sr2",   # Sony RAW
        ".dng",                    # Adobe DNG (evrensel RAW)
        ".orf",                    # Olympus RAW
        ".rw2",                    # Panasonic RAW
        ".pef",                    # Pentax RAW
        ".raf",                    # Fujifilm RAW
        # Videolar (H.264/H.265 MP4/MOV container dahil)
        ".mp4", ".mov", ".avi", ".mkv", ".webm",
        # Ses
        ".mp3", ".wav", ".ogg", ".m4a", ".flac",
        # Belgeler
        ".pdf",
    }

    def __init__(self, **data):
        super().__init__(**data)
        # Generate a temporary key if not set (warn loudly)
        if not self.SECRET_KEY:
            self.SECRET_KEY = secrets.token_hex(32)
            print(
                "WARNING: SECRET_KEY not set in environment. "
                "A random key was generated — all sessions will be invalidated on restart. "
                "Set SECRET_KEY in your .env file for production.",
                file=sys.stderr,
            )

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
