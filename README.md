<div align="center">

# Shadow DAM

**AI destekli Dijital Varlık Yönetim platformu**

Medya ekipleri için gerçek zamanlı işbirliği, akıllı arama ve NLE entegrasyonu.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python)](https://python.org)

</div>

---

## Özellikler

| Özellik | Açıklama |
|---------|----------|
| 🧠 **AI Arama** | Doğal dil ile arama — "ormanda dondurma yiyen sahneler", "sıcak ışıklı portre" |
| 🏷️ **Otomatik Etiketleme** | Claude Vision: sahne tipi, nesneler, renkler, ruh hali, açıklama |
| ✅ **Review & Onay** | Approve / Reject / In Review iş akışı |
| ⌨️ **Klavye Kısayolları** | Adobe tarzı kısayollar (J/K/L, frame step), tam özelleştirme |
| 💬 **Yorum Sistemi** | Zaman damgalı yorumlar, resolve desteği, gerçek zamanlı güncelleme |
| 📍 **Marker Sistemi** | Video + görsel marker, 7 renk, XMP + FCPXML otomatik sidecar |
| 🎬 **NLE Entegrasyonu** | Premiere Pro (.xmp) · DaVinci Resolve / Final Cut Pro (.fcpxml) |
| 🤝 **Gerçek Zamanlı İşbirliği** | WebSocket ile oda başına 10 kullanıcı, canlı avatar gösterimi |
| 🔗 **Kişisel Davet Sistemi** | Her davetliye özel link, yetki seviyesi, isteğe bağlı şifre |
| 👤 **Misafir Erişimi** | Kayıt gerektirmez — link ile yorum ve marker ekle |
| 🎥 **Özel Video Oynatıcı** | Premiere tarzı transport, marker timeline, hız kontrolü |
| 📁 **Proje Yönetimi** | Grid/liste, tür/durum filtresi, AI destekli arama |
| 🌓 **Karanlık / Aydınlık Mod** | Sistem tercihine bağımsız toggle |
| 🔐 **RBAC + Brute-force Koruması** | Admin / Editor / Viewer, hesap kilitleme |
| 🔒 **HTTPS Desteği** | Caddy ile otomatik TLS, HSTS, Let's Encrypt |

---

## Desteklenen Formatlar

| Tür | Formatlar |
|-----|-----------|
| **Video** | MP4, MOV, AVI, MKV, WebM |
| **Görsel** | PNG, JPG/JPEG, WebP, TIFF/TIF, AVIF, GIF |
| **RAW Kamera** | CR2, CR3 (Canon) · NEF, NRW (Nikon) · ARW, SRF (Sony) · DNG (Adobe) · ORF (Olympus) · RW2 (Panasonic) · PEF (Pentax) · RAF (Fujifilm) |
| **Ses** | MP3, WAV, AAC, FLAC, OGG, M4A |
| **Belge** | PDF |

---

## Teknoloji Yığını

### Backend
- **Python 3.12** + **FastAPI** — async, tip güvenli API
- **SQLAlchemy ORM** + SQLite (production → PostgreSQL)
- **Anthropic Claude API** — Vision analizi, doğal dil arama
- **JWT** (HS256) + **bcrypt** kimlik doğrulama
- **slowapi** hız sınırlama · **GZipMiddleware** sıkıştırma
- **WebSocket** gerçek zamanlı işbirliği (ConnectionManager)

### Frontend
- **React 18** + **TypeScript**
- **Tailwind CSS** — CSS custom properties ile dark/light theming
- **TanStack Query** — akıllı cache, staleTime, invalidation
- **Zustand** — auth state yönetimi
- **Vite** — code splitting, ES2020 target
- **Plus Jakarta Sans** + **JetBrains Mono**

### Prodüksiyon
- **Caddy** — otomatik HTTPS / Let's Encrypt
- **Docker Compose** — geliştirme + prodüksiyon profilleri
- **nginx** — SPA sunumu, WebSocket proxy

---

## Kurulum

### Geliştirme Ortamı

**1. Bağımlılıklar**

```bash
# Backend
cd backend && pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

**2. Ortam Değişkenleri**

```bash
# backend/.env
SECRET_KEY=cok-guclu-rastgele-bir-anahtar-min-32-karakter
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=sqlite:///./shadow.db
UPLOAD_DIR=./uploads
```

**3. Çalıştır**

```bash
# Terminal 1 — Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

| Servis | URL |
|--------|-----|
| Uygulama | http://localhost:5173 |
| API Docs | http://localhost:8000/docs |

---

### Docker ile Geliştirme

```bash
docker compose up -d
```

---

### Prodüksiyon (HTTPS)

Caddy otomatik olarak Let's Encrypt üzerinden TLS sertifikası alır ve yeniler:

```bash
DOMAIN=shadow.example.com \
SECRET_KEY=$(openssl rand -hex 32) \
ANTHROPIC_API_KEY=sk-ant-... \
docker compose -f docker-compose.prod.yml up -d
```

| Port | Servis |
|------|--------|
| 80 | HTTP → HTTPS yönlendirme |
| 443 | HTTPS (Caddy + Let's Encrypt) |

---

## Güvenlik

### Mevcut Korumalar

| Alan | Önlem |
|------|-------|
| **Kimlik Doğrulama** | JWT (HS256) · bcrypt şifre hash · rol tabanlı erişim (RBAC) |
| **Brute-force** | 5 başarısız giriş → 15 dakika hesap kilidi · hız sınırlama (slowapi) |
| **Şifre Politikası** | Min. 10 karakter · büyük/küçük harf · rakam · özel karakter zorunlu |
| **Dosya Yükleme** | Magic bytes doğrulaması · uzantı beyaz listesi · yol geçişi koruması · 500 MB limit |
| **HTTP Başlıkları** | CSP · X-Frame-Options · X-Content-Type-Options · Referrer-Policy · Permissions-Policy |
| **HTTPS** | HSTS (1 yıl, preload) · Caddy otomatik TLS · X-Forwarded-Proto koşullu |
| **Paylaşım Linkleri** | 256-bit token · bcrypt şifre hash · 22-karakter otomatik şifre (~96-bit) |
| **WebSocket** | JWT doğrulama · proje erişim kontrolü · oda başına 10 kullanıcı limiti |
| **Veri Doğrulama** | Pydantic v2 şemalar · field validator'lar · SQL enjeksiyonu yok (ORM) |
| **Gizlilik** | Sunucu parmak izi gizleme · generic hata mesajları · IP hash aktivite logu |
| **CORS** | Explicit origin listesi · wildcard (*) başlangıç uyarısı |
| **Denetim** | Admin rol değişiklikleri loglama · `shadow.audit` logger |
| **RFC 9116** | `/.well-known/security.txt` güvenlik açığı bildirim politikası |

### Önerilen Prodüksiyon Adımları

> Aşağıdaki önlemler mimari değişiklik gerektirir; uygulamaya alınması önerilir.

- **Refresh token pattern** — Erişim token'ı süresini 1 saate indirin, yenileme için refresh endpoint ekleyin
- **httpOnly cookie** — JWT'yi sessionStorage yerine httpOnly Secure cookie'de saklayın (XSS koruması)
- **PostgreSQL** — SQLite yerine şifreli bağlantı destekli PostgreSQL kullanın
- **Bağımlılık tarama** — CI pipeline'a `pip-audit` + `npm audit` ekleyin
- **WebSocket token** — `?token=` query param yerine handshake sırasında header tabanlı doğrulamaya geçin

---

## API Endpoint'leri

### Auth
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/v1/auth/register` | Kayıt (şifre politikası uygulanır) |
| `POST` | `/api/v1/auth/login` | Giriş · brute-force korumalı · `Cache-Control: no-store` |
| `GET`  | `/api/v1/auth/me` | Mevcut kullanıcı profili |
| `PATCH`| `/api/v1/auth/users/{id}/role` | Rol güncelle (yalnızca admin, denetim kaydı) |

### Projects
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET`  | `/api/v1/projects/` | Proje listesi |
| `POST` | `/api/v1/projects/` | Yeni proje |
| `DELETE` | `/api/v1/projects/{id}` | Proje sil |

### Assets
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/v1/assets/upload/{project_id}` | Dosya yükle (magic bytes doğrulaması) |
| `GET`  | `/api/v1/assets/project/{project_id}` | Proje varlıkları |
| `GET`  | `/api/v1/assets/search?q=` | AI doğal dil araması |
| `POST` | `/api/v1/assets/{id}/ai-tag` | AI etiketleme tetikle |
| `PATCH`| `/api/v1/assets/{id}/status` | Durum güncelle (WS yayını) |
| `GET`  | `/api/v1/assets/{id}/download` | Kimlik doğrulamalı indirme |

### Markers
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET`  | `/api/v1/markers/asset/{asset_id}` | Marker listesi |
| `POST` | `/api/v1/markers/asset/{asset_id}` | Marker ekle (WS yayını) |
| `PATCH`| `/api/v1/markers/{id}` | Güncelle |
| `DELETE`| `/api/v1/markers/{id}` | Sil — yalnızca oluşturan / proje sahibi / admin |
| `GET`  | `/api/v1/markers/asset/{asset_id}/export/xmp` | Premiere Pro export |
| `GET`  | `/api/v1/markers/asset/{asset_id}/export/fcpxml` | DaVinci / FCP export |

### Share
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/v1/share/asset/{id}` | Kişisel davet linki oluştur |
| `GET`  | `/api/v1/share/asset/{id}` | Asset'in davet listesi |
| `GET`  | `/api/v1/share/view/{token}` | Paylaşılan asset meta verisi (public) |
| `GET`  | `/api/v1/share/file/{token}` | Dosya sun (token + path traversal korumalı) |
| `PATCH`| `/api/v1/share/{id}/revoke` | Linki iptal et |
| `POST` | `/api/v1/share/guest/{token}/comments` | Misafir yorum ekle |
| `GET`  | `/api/v1/share/guest/{token}/comments` | Misafir yorum listesi |
| `POST` | `/api/v1/share/guest/{token}/markers` | Misafir marker ekle (edit izni) |
| `GET`  | `/api/v1/share/guest/{token}/markers` | Misafir marker listesi |

### WebSocket
| Endpoint | Açıklama |
|----------|----------|
| `WS /ws/{project_id}?token=<jwt>` | Gerçek zamanlı işbirliği odası |

---

## Marker Sistemi

| Format | Dosya | Uyumluluk |
|--------|-------|-----------|
| **XMP Sidecar** | `dosyaadi.xmp` | Adobe Premiere Pro, After Effects, Bridge |
| **FCPXML** | `dosyaadi.fcpxml` | DaVinci Resolve, Final Cut Pro |
| **Gömülü XMP** | PNG / TIFF içine | Pillow ile kayıpsız gömme |

- **Video marker:** timestamp (saniye) + süre + renk + etiket + not
- **Görsel marker:** yüzde bazlı koordinatlar (0–100%) + renk + etiket + not

Marker silme yalnızca **oluşturana**, **proje sahibine** veya **admin**'e açıktır.

---

## Mimari

```
Shadow/
├── backend/
│   └── app/
│       ├── models/        # SQLAlchemy ORM — User, Asset, Project, Marker, ShareLink
│       ├── schemas/       # Pydantic v2 — doğrulama + serileştirme
│       ├── routers/       # FastAPI router'ları — auth, assets, markers, share, collab
│       ├── services/      # ai_service (Claude), marker_service (XMP/FCPXML), auth
│       ├── utils/         # dependencies, EXISTS bazlı N+1 koruması
│       ├── ws_manager.py  # WebSocket ConnectionManager (oda başına maks 10)
│       ├── config.py      # Ayarlar, CORS origin doğrulaması
│       ├── database.py    # WAL modu, PRAGMA optimizasyonları
│       └── main.py        # Middleware yığını, migration, startup
├── frontend/
│   └── src/
│       ├── pages/         # Dashboard, Project, AssetDetail, ShareView, Search
│       ├── components/    # VideoPlayer, layout, assets
│       ├── hooks/         # useCollaboration (WebSocket), useShortcutAction
│       ├── utils/         # api.ts, shortcuts, format
│       ├── store/         # Zustand auth store
│       └── types/         # TypeScript arayüzleri
├── Caddyfile              # HTTPS prodüksiyon reverse proxy
├── docker-compose.yml     # Geliştirme
└── docker-compose.prod.yml # Prodüksiyon (Caddy + HTTPS)
```

---

## Özellik Durumu

| Özellik | Durum |
|---------|-------|
| AI Arama + Etiketleme | ✅ |
| Review & Onay İş Akışı | ✅ |
| Marker Sistemi (video + görsel) | ✅ |
| NLE Export (XMP + FCPXML) | ✅ |
| Özel Video Oynatıcı (J/K/L) | ✅ |
| Gerçek Zamanlı İşbirliği (WS) | ✅ |
| Kişisel Davet + Misafir Erişimi | ✅ |
| HTTPS / Caddy Otomatik TLS | ✅ |
| Brute-force / Hesap Kilitleme | ✅ |
| Karanlık / Aydınlık Mod | ✅ |
| Cloud NAS / S3 Depolama | ❌ Planlanıyor |
| Yüz / Nesne Tespiti | ❌ Planlanıyor |
| Refresh Token | ❌ Planlanıyor |
