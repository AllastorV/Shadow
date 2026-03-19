# Shadow — AI-Powered Media Asset Management

> Medya ekipleri için AI destekli Dijital Varlık Yönetim (DAM) platformu.

## Özellikler

| Özellik | Açıklama |
|---------|----------|
| 🔍 **AI Arama** | Claude API ile doğal dil araması — "sinematik hava çekimleri", "ürün fotoğrafları" gibi sorgular |
| 🏷️ **Otomatik Etiketleme** | Yüklenen görselleri Claude Vision ile analiz ederek sahne tipi, nesneler, renkler ve açıklama üretir |
| ✅ **Review & Onay** | Approve / Reject / In Review iş akışı, tek tıkla durum güncelleme |
| 💬 **Yorum Sistemi** | Zaman damgalı yorumlar, çözümleme (resolve) desteği |
| 🔗 **Client Delivery** | İzin tabanlı paylaşım linkleri (View / Comment / Download), şifre koruması, son kullanma tarihi, aktivite logu |
| 📁 **Proje Yönetimi** | Çoklu proje, grid/liste görünümü, tür ve durum filtreleri |
| 🔐 **RBAC** | Admin / Editor / Viewer rolleri |

## Teknoloji Yığını

**Backend:**
- Python 3.12 + FastAPI
- SQLAlchemy + SQLite (production için PostgreSQL önerilir)
- Anthropic Claude API (Vision + AI arama)
- JWT kimlik doğrulama

**Frontend:**
- React 18 + TypeScript
- Tailwind CSS
- TanStack Query (React Query)
- Zustand (state yönetimi)
- React Dropzone (dosya yükleme)
- Vite

## Kurulum

### 1. Gereksinimler

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
SECRET_KEY=guclu-bir-gizli-anahtar
DATABASE_URL=sqlite:///./shadow.db
UPLOAD_DIR=./uploads
```

### 3. Çalıştırma

```bash
# Backend (terminal 1)
cd backend
uvicorn app.main:app --reload --port 8000

# Frontend (terminal 2)
cd frontend
npm run dev
```

Uygulama: http://localhost:5173
API Docs: http://localhost:8000/docs

### Docker ile Çalıştırma

```bash
cp backend/.env.example backend/.env
# .env dosyasında ANTHROPIC_API_KEY'i ayarlayın

docker-compose up -d
```

## API Endpoint'leri

### Auth
- `POST /api/v1/auth/register` — Kayıt
- `POST /api/v1/auth/login` — Giriş
- `GET /api/v1/auth/me` — Profil

### Projects
- `GET /api/v1/projects/` — Proje listesi
- `POST /api/v1/projects/` — Yeni proje
- `DELETE /api/v1/projects/{id}` — Proje sil

### Assets
- `POST /api/v1/assets/upload/{project_id}` — Dosya yükle
- `GET /api/v1/assets/project/{project_id}` — Proje varlıkları
- `GET /api/v1/assets/search?q=...` — **AI araması**
- `POST /api/v1/assets/{id}/ai-tag` — **AI etiketleme**
- `PATCH /api/v1/assets/{id}/status` — Durum güncelle (approve/reject)

### Share
- `POST /api/v1/share/asset/{id}` — Paylaşım linki oluştur
- `GET /api/v1/share/view/{token}` — Paylaşılan varlığı görüntüle (public)
- `PATCH /api/v1/share/{id}/revoke` — Linki iptal et
- `GET /api/v1/share/{id}/activity` — Aktivite logu

## Özellik Durumu

| Özellik | Durum | Notlar |
|---------|-------|--------|
| AI Arama | ✅ | Claude API ile doğal dil araması |
| Otomatik Etiketleme | ✅ | Claude Vision ile sahne, nesne, renk analizi |
| Review & Onay | ✅ | Approve / Reject / In Review akışı |
| Client Delivery | ✅ | İzin seviyeleri, şifre koruması, expiry |
| Aktivite Logu | ✅ | View / download sayacı |
| Cloud NAS | ❌ | Şu an lokal depolama; gelecek versiyonda |
| Yüz Tespiti | ❌ | Gelecek versiyonda planlanıyor |

## Mimari

```
shadow/
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy ORM modelleri
│   │   ├── schemas/         # Pydantic şemaları
│   │   ├── routers/         # FastAPI router'ları
│   │   ├── services/        # AI servisi, auth
│   │   └── utils/           # Bağımlılıklar
│   └── uploads/             # Yüklenen dosyalar
└── frontend/
    └── src/
        ├── pages/           # Sayfa bileşenleri
        ├── components/      # Paylaşılan bileşenler
        ├── store/           # Zustand store
        └── utils/           # API client, formatters
```
