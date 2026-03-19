# Shadow — AI-Powered Media Asset Management

> Medya ekipleri için AI destekli Dijital Varlık Yönetim (DAM) platformu.
> FastAPI + React/TypeScript ile inşa edilmiş, karanlık/aydınlık mod destekli modern arayüz.

---

## Özellikler

| Özellik | Açıklama |
|---------|----------|
| 🧠 **AI Arama** | Doğal dil ile arama — "ormanda dondurma yiyen sahneler", "sıcak ışıklı portre" gibi sorgular |
| 🏷️ **Otomatik Etiketleme** | Claude Vision ile sahne tipi, nesneler, renkler, ruh hali ve açıklama üretimi |
| ✅ **Review & Onay** | Approve / Reject iş akışı, tek tıkla durum güncelleme |
| 💬 **Yorum Sistemi** | Zaman damgalı yorumlar, çözümleme (resolve) desteği |
| 📍 **Marker Sistemi** | Tüm oturum üyeleri video/görsel marker ekleyip silebilir; otomatik XMP + FCPXML sidecar yazımı |
| 🎬 **NLE Entegrasyonu** | Premiere Pro (.xmp), DaVinci Resolve / Final Cut Pro (.fcpxml) marker export |
| 🔗 **Paylaşım Linkleri** | İzin tabanlı (View / Comment / Download), şifre koruması, son kullanma tarihi, aktivite logu |
| 📁 **Proje Yönetimi** | Çoklu proje, grid/liste görünümü, tür ve durum filtreleri, debounced arama |
| 🌓 **Karanlık/Aydınlık Mod** | Sistem tercihine bağımsız toggle, localStorage kalıcı tercih |
| 🔐 **RBAC** | Admin / Editor / Viewer rolleri, JWT kimlik doğrulama |

---

## Desteklenen Formatlar

| Tür | Formatlar |
|-----|-----------|
| **Video** | MP4, MOV, AVI, MKV, WebM (H.264 / H.265 / HEVC dahil) |
| **Görsel** | PNG, JPG/JPEG, TIFF/TIF |
| **Ses** | MP3, WAV, AAC, FLAC, OGG |
| **Belge** | PDF |

---

## Teknoloji Yığını

### Backend
- **Python 3.12** + **FastAPI**
- **SQLAlchemy ORM** + SQLite (production için PostgreSQL önerilir)
- **Anthropic Claude API** — Vision analizi + doğal dil arama
- **Pillow** — PNG/TIFF içi XMP gömme
- **JWT** (HS256) kimlik doğrulama
- **slowapi** hız sınırlama, **GZipMiddleware** sıkıştırma
- **SQLite WAL modu** + PRAGMA performans optimizasyonları

### Frontend
- **React 18** + **TypeScript**
- **Tailwind CSS** — CSS custom properties ile otomatik dark/light theming
- **Plus Jakarta Sans** (UI) + **JetBrains Mono** (teknik veriler)
- **TanStack Query** — 5 dk staleTime, akıllı polling, Visibility API entegrasyonu
- **Zustand** — auth state yönetimi
- **Vite** — manuel vendor chunk code splitting, ES2020 target
- **React.memo / useMemo / useCallback** — render optimizasyonları

---

## Kurulum

### 1. Bağımlılıkları Yükle

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### 2. Ortam Değişkenleri

```bash
# backend/.env
ANTHROPIC_API_KEY=sk-ant-...     # Claude API anahtarı (AI özellikleri için)
SECRET_KEY=guclu-rastgele-bir-anahtar
DATABASE_URL=sqlite:///./shadow.db
UPLOAD_DIR=./uploads
```

### 3. Çalıştır

```bash
# Backend (terminal 1)
cd backend
uvicorn app.main:app --reload --port 8000

# Frontend (terminal 2)
cd frontend
npm run dev
```

- Uygulama: http://localhost:5173
- API Docs: http://localhost:8000/docs

### Docker ile Çalıştırma

```bash
cp backend/.env.example backend/.env
# .env dosyasında ANTHROPIC_API_KEY'i ayarlayın
docker-compose up -d
```

---

## API Endpoint'leri

### Auth
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/v1/auth/register` | Kayıt |
| `POST` | `/api/v1/auth/login` | Giriş |
| `GET`  | `/api/v1/auth/me` | Profil |

### Projects
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET`  | `/api/v1/projects/` | Proje listesi |
| `POST` | `/api/v1/projects/` | Yeni proje |
| `DELETE` | `/api/v1/projects/{id}` | Proje sil |

### Assets
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/v1/assets/upload/{project_id}` | Dosya yükle |
| `GET`  | `/api/v1/assets/project/{project_id}` | Proje varlıkları |
| `GET`  | `/api/v1/assets/search?q=...` | AI doğal dil araması |
| `POST` | `/api/v1/assets/{id}/ai-tag` | AI etiketleme tetikle |
| `PATCH`| `/api/v1/assets/{id}/status` | Durum güncelle |

### Markers
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `GET`  | `/api/v1/markers/asset/{asset_id}` | Marker listesi |
| `POST` | `/api/v1/markers/asset/{asset_id}` | Marker ekle |
| `PATCH`| `/api/v1/markers/{marker_id}` | Marker güncelle |
| `DELETE`| `/api/v1/markers/{marker_id}` | Marker sil |
| `GET`  | `/api/v1/markers/asset/{asset_id}/export/xmp` | Premiere Pro export |
| `GET`  | `/api/v1/markers/asset/{asset_id}/export/fcpxml` | DaVinci / FCP export |

### Share
| Method | Endpoint | Açıklama |
|--------|----------|----------|
| `POST` | `/api/v1/share/asset/{id}` | Paylaşım linki oluştur |
| `GET`  | `/api/v1/share/view/{token}` | Paylaşılan varlığı görüntüle (public) |
| `GET`  | `/api/v1/share/file/{token}` | Dosya sun (token bazlı, yol açığı korumalı) |
| `PATCH`| `/api/v1/share/{id}/revoke` | Linki iptal et |
| `GET`  | `/api/v1/share/{id}/activity` | Aktivite logu |

---

## Marker Sistemi

Marker'lar tüm proje üyeleri tarafından eklenip silinebilir. Her mutasyonda dosyalar otomatik güncellenir:

| Format | Dosya | Uyumluluk |
|--------|-------|-----------|
| **XMP Sidecar** | `dosyaadi.xmp` | Adobe Premiere Pro, After Effects, Bridge |
| **FCPXML** | `dosyaadi.fcpxml` | DaVinci Resolve, Final Cut Pro |
| **Gömülü XMP** | PNG / TIFF içine | Pillow ile kayıpsız gömme (JPEG sidecar alır) |

Video marker'ları: timestamp (saniye) + süre + renk + etiket + not
Görsel marker'ları: yüzde bazlı koordinatlar (0–100%) + renk + etiket + not

---

## Güvenlik

- **Path traversal koruması** — Dosya sunucusunda yol doğrulama
- **Magic bytes doğrulaması** — MIME tip sahteciliğine karşı
- **Hız sınırlama** — slowapi ile endpoint bazlı limit
- **CSP başlıkları** — `frame-ancestors` ile clickjacking koruması
- **Bcrypt** — Paylaşım linki şifreleri için
- **256-bit entropi** — Paylaşım token'ları

---

## Mimari

```
Shadow/
├── backend/
│   └── app/
│       ├── models/          # SQLAlchemy ORM (Asset, Project, User, Marker, ShareLink…)
│       ├── schemas/         # Pydantic şemaları + validasyonlar
│       ├── routers/         # FastAPI router'ları (assets, markers, share, auth…)
│       ├── services/        # AI servisi, marker_service (XMP/FCPXML)
│       ├── utils/           # Bağımlılıklar, EXISTS bazlı N+1 koruması
│       ├── config.py        # Ayarlar, izin verilen uzantılar
│       ├── database.py      # WAL modu, PostgreSQL connection pool
│       └── main.py          # GZipMiddleware, güvenlik başlıkları
└── frontend/
    └── src/
        ├── pages/           # DashboardPage, ProjectPage, AssetDetailPage, SearchPage…
        ├── components/
        │   ├── layout/      # Sidebar (dark/light toggle), AppLayout
        │   └── assets/      # AssetCard, UploadZone
        ├── utils/
        │   ├── theme.tsx    # ThemeProvider + useTheme hook
        │   ├── useDebounce.ts
        │   └── api.ts
        ├── store/           # Zustand auth store
        └── types/           # TypeScript arayüzleri (Asset, Marker, ShareLink…)
```

---

## Özellik Durumu

| Özellik | Durum | Notlar |
|---------|-------|--------|
| AI Arama | ✅ | Claude API doğal dil araması |
| Otomatik Etiketleme | ✅ | Claude Vision — sahne, nesne, renk, ruh hali |
| Review & Onay | ✅ | Approve / Reject akışı |
| Paylaşım Linkleri | ✅ | Şifre, expiry, izin seviyeleri |
| Marker Sistemi | ✅ | XMP + FCPXML otomatik sidecar, 7 renk |
| TIFF Desteği | ✅ | Hem upload hem XMP gömme |
| Karanlık/Aydınlık Mod | ✅ | CSS variables, localStorage kalıcı |
| N+1 Koruması | ✅ | SQL EXISTS sorgusu |
| Görünürlük Bazlı Polling | ✅ | Visibility API, 5 dk interval |
| Cloud NAS | ❌ | Şu an lokal depolama; gelecek versiyonda |
| Yüz Tespiti | ❌ | Gelecek versiyonda planlanıyor |
