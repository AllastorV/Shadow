from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# SQLite ve PostgreSQL için ayrı engine ayarları
if "sqlite" in settings.DATABASE_URL:
    engine = create_engine(
        settings.DATABASE_URL,
        # SQLite: multi-thread erişime izin ver (FastAPI birden fazla thread kullanır)
        connect_args={"check_same_thread": False},
        # SQLite pool: basit StaticPool yerine varsayılan QueuePool
        pool_pre_ping=True,  # Bağlantı kopukluklarını otomatik tespit et
    )

    # SQLite performans optimizasyonları
    @event.listens_for(engine, "connect")
    def set_sqlite_pragmas(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")     # Write-Ahead Logging — eşzamanlı okuma/yazma
        cursor.execute("PRAGMA synchronous=NORMAL")   # Flush frekansını azalt (güvenli)
        cursor.execute("PRAGMA cache_size=-64000")    # 64MB bellek cache
        cursor.execute("PRAGMA temp_store=MEMORY")    # Geçici tabloları RAM'de tut
        cursor.execute("PRAGMA mmap_size=268435456")  # 256MB memory-mapped I/O
        cursor.close()
else:
    # PostgreSQL: bağlantı havuzu optimizasyonları
    engine = create_engine(
        settings.DATABASE_URL,
        pool_size=10,          # Daima açık bağlantı sayısı
        max_overflow=20,       # Yoğun yük altında ek bağlantı
        pool_pre_ping=True,    # Bağlantı kopuklarını otomatik yakala
        pool_recycle=1800,     # 30 dk'da bir bağlantıyı yenile (firewall timeout'u önler)
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
