<div align="center">

# Shadow DAM

**Dijital Varlık Yönetim Platformu**

Medya ekipleri için gerçek zamanlı işbirliği, akıllı arama, yerel klasör entegrasyonu ve NLE uyumluluğu.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python)](https://python.org)

</div>

---

## Özellikler

| Özellik | Açıklama |
|---------|----------|
| 🧠 **Akıllı Arama** | Doğal dil ile arama — "ormanda dondurma yiyen sahneler", "sıcak ışıklı portre" |
| 🏷️ **Otomatik Etiketleme** | Claude Vision: sahne tipi, nesneler, renkler, ruh hali, sinematografi analizi |
| ✅ **Review & Onay** | Approve / Reject / In Review iş akışı |
| 🗂️ **Klasör Bağlama** | PC'deki klasörü projeye bağla — dosyalar kopyalanmadan doğrudan listelenir ve erişilebilir |
| 🎞️ **Video Proxy Sistemi** | Büyük videolar için 720p H.264 proxy oluşturma; çalışmalar ana dosyaya yansır |
| ⌨️ **Klavye Kısayolları** | Adobe tarzı kısayollar (J/K/L, frame step), tam özelleştirme |
| 💬 **Yorum Sistemi** | Zaman damgalı yorumlar, resolve desteği, gerçek zamanlı güncelleme |
| 📍 **Marker Sistemi** | Video + görsel marker, 7 renk, XMP + FCPXML otomatik sidecar |
| 🎬 **NLE Entegrasyonu** | Premiere Pro (.xmp) · DaVinci Resolve / Final Cut Pro (.fcpxml) |
| 🤝 **Gerçek Zamanlı İşbirliği** | WebSocket ile oda başına 10 kullanıcı, canlı avatar gösterimi |
| 🔗 **Kişisel Davet Sistemi** | Her davetliye özel link, yetki seviyesi, isteğe bağlı şifre |
| 👤 **Misafir Erişimi** | Kayıt gerektirmez — link ile yorum ve marker ekle |
| 🎥 **Özel Video Oynatıcı** | Premiere tarzı transport, marker timeline, hız kontrolü |
| 📁 **Proje Yönetimi** | Grid/liste, tür/durum/tarih/boyut filtresi, akıllı arama |
| 🌓 **Karanlık / Aydınlık Mod** | Sistem tercihine bağımsız toggle |
| 🔐 **RBAC + Brute-force Koruması** | Admin / Editor / Viewer, hesap kilitleme |
| 🔒 **HTTPS Desteği** | Caddy ile otomatik TLS, HSTS, Let's Encrypt |
| 📦 **Büyük Dosya Desteği** | Tek dosyada 150 GB'a kadar (Admin: sınırsız) — streaming yükleme |

---

## Desteklenen Formatlar

| Tür | Formatlar |
|-----|-----------|
| **Video** | MP4, MOV, AVI, MKV, WebM |
| **Görsel** | PNG, JPG/JPEG, WebP, TIFF/TIF, AVIF, GIF |
| **RAW Kamera** | CR2, CR3 (Canon) · NEF, NRW (Nikon) · ARW, SRF, SR2 (Sony) · DNG (Adobe) · ORF (Olympus) · RW2 (Panasonic) · PEF (Pentax) · RAF (Fujifilm) |
| **Ses** | MP3, WAV, AAC, FLAC, OGG, M4A |
| **Belge** | PDF |

---

## Klasör Bağlama

PC'nizdeki veya sunucudaki bir klasörü projeye bağlayarak dosyaları kopyalamadan doğrudan kullanabilirsiniz.

### Nasıl Çalışır

1. Proje sayfasında **Klasör Bağla** butonuna tıklayın
2. Sunucuda erişilebilir klasör yolunu girin (ör. `/home/user/Videos`)
3. Klasör ağacını gözatarak dosyaları seçin
4. **Aktar** — dosyalar kopyalanmaz, orijinal konumdan stream edilir
5. Tüm DAM özellikleri çalışır: yorum, marker, etiket, AI analizi

```
Proje sayfası → [Klasör Bağla] → Yol gir → Gözat → Seç → Aktar
```

### Docker Kullanıcıları

Docker'da çalıştırıyorsanız klasörü container'a monte etmeniz gerekir:

```yaml
# docker-compose.yml
services:
  backend:
    volumes:
      - /home/user/Videos:/data/videos   # yerel:container
```

Ardından `/data/videos` yolunu kullanın.

---

## Video Proxy Sistemi

4K/8K gibi büyük videolarda akıcı önizleme için 720p H.264 proxy oluşturulabilir. Proxy üzerinde yapılan tüm çalışmalar (marker, yorum, etiket) orijinal dosyaya kaydedilir.

### Nasıl Çalışır

| Adım | İşlem |
|------|-------|
| 1 | Asset detay sayfasında **Proxy Oluştur** butonuna tıklayın |
| 2 | ffmpeg arka planda 720p proxy üretir (`pending` → `ready`) |
| 3 | **HD** butonu **PROXY** olur — tıklayarak geçiş yapın |
| 4 | Proxy modunda tüm marker ve yorumlar orijinal dosyaya yazılır |

> **Gereksinim:** `ffmpeg` kurulu olmalı.
> Docker kullanıyorsanız image'a ekleyin: `apt-get install -y ffmpeg`

---

## Teknoloji Yığını

### Backend
- **Python 3.12** + **FastAPI** — async, tip güvenli API
- **SQLAlchemy ORM** + SQLite (production → PostgreSQL)
- **Anthropic Claude API** — Vision analizi, doğal dil arama
- **ffmpeg** — video proxy üretimi (opsiyonel)
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

# AI backend seçimi (opsiyonel)
# auto | local | anthropic | mock
AI_BACKEND=auto
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

Yerel bir klasörü bağlamak için `docker-compose.yml`'e volume ekleyin:

```yaml
services:
  backend:
    volumes:
      - ./uploads:/app/uploads
      - /path/to/media:/media    # yerel medya klasörü
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
| 80   | HTTP → HTTPS yönlendirme |
| 443  | HTTPS (Caddy + Let's Encrypt) |

---

## Güvenlik

### Mevcut Korumalar

| Alan | Önlem |
|------|-------|
| **Kimlik Doğrulama** | JWT (HS256) · bcrypt şifre hash · rol tabanlı erişim (RBAC) |
| **Brute-force** | 5 başarısız giriş → 15 dakika hesap kilidi · hız sınırlama (slowapi) |
| **Şifre Politikası** | Min. 10 karakter · büyük/küçük harf · rakam · özel karakter zorunlu |
| **Dosya Yükleme** | Magic bytes doğrulaması · uzantı beyaz listesi · yol geçişi koruması · streaming (RAM'e yüklemez) |
| **Klasör Bağlama** | Path traversal koruması — alt yollar `relative_to()` ile mount root'a kilitlenir |
| **Yükleme Limiti** | Editor: 150 GB / dosya · Admin: sınırsız (sunucu taraflı kontrol) |
| **HTTP Başlıkları** | CSP · X-Frame-Options · X-Content-Type-Options · Referrer-Policy · Permissions-Policy |
| **HTTPS** | HSTS (1 yıl, preload) · Caddy otomatik TLS · X-Forwarded-Proto koşullu |
| **Paylaşım Linkleri** | 256-bit token · bcrypt şifre hash · 22-karakter otomatik şifre (~96-bit) |
| **WebSocket** | JWT doğrulama · proje erişim kontrolü · oda başına 10 kullanıcı limiti |
| **Veri Doğrulama** | Pydantic v2 şemalar · field validator'lar · SQL enjeksiyonu yok (ORM) |
| **Gizlilik** | Sunucu parmak izi gizleme · generic hata mesajları · IP hash aktivite logu |
| **CORS** | Explicit origin listesi · wildcard (\*) başlangıç uyarısı |
| **Denetim** | Admin rol değişiklikleri loglama · `shadow.audit` logger |
| **RFC 9116** | `/.well-known/security.txt` güvenlik açığı bildirim politikası |

### Önerilen Prodüksiyon Adımları

> Aşağıdaki önlemler mimari değişiklik gerektirir; uygulamaya alınması önerilir.

- **Refresh token pattern** — Erişim token'ı süresini 1 saate indirin, yenileme için refresh endpoint ekleyin
- **httpOnly cookie** — JWT'yi sessionStorage yerine httpOnly Secure cookie'de saklayın (XSS koruması)
- **PostgreSQL** — SQLite yerine şifreli bağlantı destekli PostgreSQL kullanın
- **Bağımlılık tarama** — CI pipeline'a `pip-audit` + `npm audit` ekleyin

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
| `POST` | `/api/v1/assets/upload/{project_id}` | Dosya yükle — streaming, magic bytes doğrulaması |
| `GET`  | `/api/v1/assets/project/{project_id}` | Proje varlıkları (filtreli, sıralanmış) |
| `GET`  | `/api/v1/assets/search?q=` | Doğal dil araması |
| `POST` | `/api/v1/assets/{id}/ai-tag` | AI etiketleme tetikle |
| `PATCH`| `/api/v1/assets/{id}/status` | Durum güncelle (WS yayını) |
| `GET`  | `/api/v1/assets/{id}/download` | Kimlik doğrulamalı indirme (linked + uploaded) |
| `POST` | `/api/v1/assets/{id}/proxy` | Video proxy oluşturmayı başlat (ffmpeg) |
| `GET`  | `/api/v1/assets/{id}/proxy-file` | Hazır proxy dosyasını sun |
| `DELETE`| `/api/v1/assets/{id}/proxy` | Proxy dosyasını sil |

### Klasör Bağlama
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/v1/mounts/projects/{project_id}` | Klasör bağlantısı ekle |
| `GET`  | `/api/v1/mounts/projects/{project_id}` | Proje bağlantılarını listele |
| `DELETE`| `/api/v1/mounts/projects/{project_id}/{mount_id}` | Bağlantıyı kaldır |
| `GET`  | `/api/v1/mounts/{mount_id}/browse?sub=` | Klasör içeriğini gözat |
| `POST` | `/api/v1/mounts/{mount_id}/import` | Seçili dosyaları linked asset olarak aktar |
| `GET`  | `/api/v1/mounts/stream/{asset_id}` | Linked asset'i orijinal konumdan sun |

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
| `POST` | `/api/v1/share/guest/{token}/markers` | Misafir marker ekle (edit izni) |

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
│       ├── models/        # SQLAlchemy ORM — User, Asset, Project, Marker, ShareLink, FolderMount
│       ├── schemas/       # Pydantic v2 — doğrulama + serileştirme
│       ├── routers/       # FastAPI — auth, assets, markers, share, collab, folder_mounts
│       ├── services/      # ai_service (Claude), marker_service (XMP/FCPXML), auth
│       ├── utils/         # dependencies, N+1 koruması
│       ├── ws_manager.py  # WebSocket ConnectionManager (oda başına maks 10)
│       ├── config.py      # Ayarlar, CORS origin doğrulaması
│       ├── database.py    # WAL modu, PRAGMA optimizasyonları
│       └── main.py        # Middleware yığını, migration, startup
├── frontend/
│   └── src/
│       ├── pages/         # Dashboard, Project, AssetDetail, ShareView, Search
│       ├── components/    # VideoPlayer, AssetCard, UploadZone, FolderMountModal
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
| Akıllı Arama + Etiketleme | ✅ |
| Review & Onay İş Akışı | ✅ |
| Marker Sistemi (video + görsel) | ✅ |
| NLE Export (XMP + FCPXML) | ✅ |
| Özel Video Oynatıcı (J/K/L) | ✅ |
| Gerçek Zamanlı İşbirliği (WS) | ✅ |
| Kişisel Davet + Misafir Erişimi | ✅ |
| HTTPS / Caddy Otomatik TLS | ✅ |
| Brute-force / Hesap Kilitleme | ✅ |
| Klasör Bağlama (Local Path) | ✅ |
| Video Proxy Sistemi (ffmpeg) | ✅ |
| 150 GB Streaming Yükleme | ✅ |
| Dosya Sıralama Filtreleri | ✅ |
| Karanlık / Aydınlık Mod | ✅ |
| Cloud NAS / S3 Depolama | ❌ Planlanıyor |
| Yüz / Nesne Tespiti | ❌ Planlanıyor |
| Refresh Token | ❌ Planlanıyor |
