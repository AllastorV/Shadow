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
    # Allowed origins for CORS (comma-separated)
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:4173"
    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    # Allowed file extensions (security whitelist)
    ALLOWED_EXTENSIONS: set = {
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif",
        ".mp4", ".mov", ".avi", ".mkv", ".webm",
        ".mp3", ".wav", ".ogg", ".m4a", ".flac",
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
