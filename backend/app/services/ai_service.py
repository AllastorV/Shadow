import base64
import json
import logging
from pathlib import Path
from typing import Optional
import anthropic
from ..config import settings

logger = logging.getLogger(__name__)

# --- Geçerli değer kümeleri (validasyon için) ---

VALID_SHOT_SCALES = {
    "extreme_close_up",   # Aşırı Yakın Plan — göz, dudak, detay
    "close_up",           # Yakın Plan — yüz/nesne
    "medium_close_up",    # Orta Yakın Plan — omuz üstü
    "medium_shot",        # Orta Plan — belden yukarı
    "medium_wide",        # Orta Geniş Plan — diz üstü
    "full_shot",          # Tam Plan — ayaktan başa
    "wide_shot",          # Geniş Plan — kişi + ortam
    "extreme_wide",       # Aşırı Geniş Plan — manzara, epic
    "aerial",             # Hava Çekimi / Drone
    "insert",             # Detay/Ekleme Çekimi
    "unknown",
}

VALID_CAMERA_ANGLES = {
    "eye_level",    # Göz Hizası
    "low_angle",    # Alçak Açı (yukarı bakış)
    "high_angle",   # Yüksek Açı (aşağı bakış)
    "dutch_angle",  # Hollanda Açısı (eğik)
    "birds_eye",    # Kuş Bakışı (tam yukarıdan)
    "worms_eye",    # Böcek Bakışı (tam aşağıdan)
    "over_shoulder", # Omuz Üstü
    "pov",          # Point of View
    "unknown",
}

VALID_CAMERA_MOVEMENTS = {
    "static",       # Sabit
    "pan",          # Panoramik (yatay döndürme)
    "tilt",         # Dikey döndürme
    "dolly",        # İleri/Geri hareket
    "tracking",     # Nesneyi takip
    "handheld",     # El kamerası (sarsıntılı)
    "aerial_move",  # Drone hareketi
    "zoom",         # Zoom
    "crane",        # Vinç çekimi
    "steadicam",    # Steadicam
    "unknown",
}

VALID_LIGHTING_TYPES = {
    "natural",       # Doğal ışık
    "golden_hour",   # Altın Saat (gün batımı/doğumu)
    "blue_hour",     # Mavi Saat (alacakaranlık)
    "overcast",      # Bulutlu, yumuşak ışık
    "high_key",      # Yüksek Anahtar (parlak, az gölge)
    "low_key",       # Alçak Anahtar (dramatik, çok gölge)
    "backlit",       # Arka Işık
    "silhouette",    # Siluet
    "studio",        # Stüdyo ışığı
    "practical",     # Sahne içi ışık kaynakları
    "mixed",         # Karma
    "neon",          # Neon/renkli yapay ışık
    "night",         # Gece çekimi
}

VALID_COLOR_TONES = {
    "warm",          # Sıcak (turuncu, sarı)
    "cool",          # Soğuk (mavi, yeşil)
    "neutral",       # Nötr
    "desaturated",   # Renksizleştirilmiş, soluk
    "high_contrast", # Yüksek Kontrast
    "low_contrast",  # Düşük Kontrast
    "teal_orange",   # Teal & Orange (sinema klasiği)
    "black_white",   # Siyah Beyaz
    "vintage",       # Vintage/Filmic
    "vibrant",       # Canlı renkler
    "muted",         # Pastel/sönük tonlar
}

VALID_COMPOSITION_TAGS = {
    "rule_of_thirds",    # Üçler kuralı
    "symmetrical",       # Simetri
    "leading_lines",     # Yönlendirici çizgiler
    "framing",           # Çerçeveleme
    "bokeh",             # Sığ alan derinliği (arka plan blur)
    "deep_focus",        # Derin odak
    "negative_space",    # Negatif alan
    "foreground_depth",  # Ön plan derinliği
    "center_composition", # Merkez kompozisyon
    "diagonal",          # Diagonal çizgi/hareket
}

VALID_SUBJECT_TAGS = {
    "portrait",       # Portre / kişi
    "group",          # Grup / kalabalık
    "crowd",          # Kalabalık sahne
    "nature",         # Doğa
    "urban",          # Kentsel
    "architecture",   # Mimari
    "vehicle",        # Araç
    "animal",         # Hayvan
    "product",        # Ürün
    "food",           # Yiyecek
    "abstract",       # Soyut
    "event",          # Etkinlik
    "sport",          # Spor
    "performance",    # Sahne / performans
    "interview",      # Röportaj
    "broll",          # B-Roll / atmosfer çekimi
    "aerial_view",    # Hava görüntüsü
    "underwater",     # Su altı
}

VALID_MOOD_TAGS = {
    "dramatic",    # Dramatik
    "peaceful",    # Sakin / huzurlu
    "tense",       # Gerilimli
    "romantic",    # Romantik
    "melancholic", # Melankolik
    "epic",        # Epik / büyük
    "intimate",    # İçten / samimi
    "mysterious",  # Gizemli
    "energetic",   # Enerjik
    "dark",        # Karanlık
    "joyful",      # Neşeli
    "nostalgic",   # Nostaljik
    "documentary", # Belgesel tarzı
    "commercial",  # Reklam/ticari tarz
}

VALID_SCENE_TYPES = {
    "interior",    # İç mekan
    "exterior",    # Dış mekan
    "studio",      # Stüdyo
    "location",    # Dış çekim lokasyonu
    "green_screen", # Yeşil perde
}


class AIService:
    def __init__(self):
        self.client = (
            anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            if settings.ANTHROPIC_API_KEY
            else None
        )

    def _encode_image(self, file_path: str) -> tuple[str, str]:
        path = Path(file_path)
        media_type_map = {
            ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".png": "image/png", ".gif": "image/gif",
            ".webp": "image/webp",
        }
        media_type = media_type_map.get(path.suffix.lower(), "image/jpeg")
        with open(file_path, "rb") as f:
            data = base64.standard_b64encode(f.read()).decode("utf-8")
        return data, media_type

    def _safe_parse_json(self, text: str) -> Optional[dict]:
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"AI returned non-JSON: {e} | raw={text[:200]}")
        return None

    def analyze_image(self, file_path: str) -> dict:
        """Claude Vision ile görsel analizi — sinema/görsel sektör odaklı metadata."""
        if not self.client:
            return self._mock_analysis(file_path)

        try:
            image_data, media_type = self._encode_image(file_path)
            message = self.client.messages.create(
                model="claude-opus-4-6",
                max_tokens=1500,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": media_type,
                                    "data": image_data,
                                },
                            },
                            {
                                "type": "text",
                                "text": self._build_cinema_prompt(),
                            },
                        ],
                    }
                ],
            )
            raw = message.content[0].text
            parsed = self._safe_parse_json(raw)
            if parsed:
                return self._validate_analysis(parsed)
            logger.warning("Could not parse AI analysis, using mock")
            return self._mock_analysis(file_path)

        except anthropic.APIError as e:
            logger.error(f"Anthropic API error: {e}")
            return self._mock_analysis(file_path)
        except Exception as e:
            logger.error(f"Image analysis error: {e}", exc_info=True)
            return self._mock_analysis(file_path)

    def _build_cinema_prompt(self) -> str:
        return f"""Sen deneyimli bir sinematograf ve görsel sanatçısın.
Bu görseli sinema ve görsel prodüksiyon perspektifinden analiz et.

Aşağıdaki JSON formatında yanıt ver. SADECE geçerli JSON döndür, açıklama ekleme.

{{
  "description": "Görselin 2-3 cümlelik sinematografik açıklaması. Sahneyi, atmosferi ve teknik unsurları tanımla.",
  "tags": ["genel etiketler", "5-10 adet", "lowercase", "türkçe veya ingilizce"],

  "shot_scale": "<bir değer seç>",
  "camera_angle": "<bir değer seç>",
  "camera_movement": "<bir değer seç>",
  "lighting_type": "<bir değer seç>",
  "color_tone": "<bir değer seç>",

  "composition_tags": ["maks 4 adet"],
  "subject_tags": ["maks 5 adet"],
  "mood_tags": ["maks 3 adet"],

  "scene_type": "<bir değer seç>",
  "ai_colors": ["3-5 baskın renk adı"],
  "ai_objects": ["sahnedeki ana nesneler/kişiler, maks 8"]
}}

Geçerli shot_scale değerleri: {', '.join(sorted(VALID_SHOT_SCALES))}
Geçerli camera_angle değerleri: {', '.join(sorted(VALID_CAMERA_ANGLES))}
Geçerli camera_movement değerleri: {', '.join(sorted(VALID_CAMERA_MOVEMENTS))}
Geçerli lighting_type değerleri: {', '.join(sorted(VALID_LIGHTING_TYPES))}
Geçerli color_tone değerleri: {', '.join(sorted(VALID_COLOR_TONES))}
Geçerli composition_tags değerleri: {', '.join(sorted(VALID_COMPOSITION_TAGS))}
Geçerli subject_tags değerleri: {', '.join(sorted(VALID_SUBJECT_TAGS))}
Geçerli mood_tags değerleri: {', '.join(sorted(VALID_MOOD_TAGS))}
Geçerli scene_type değerleri: {', '.join(sorted(VALID_SCENE_TYPES))}

Emin olmadığın alanlarda "unknown" veya boş liste kullan.
Sadece geçerli JSON döndür."""

    def natural_language_search(self, query: str, assets_metadata: list[dict]) -> list[int]:
        """Doğal dil araması — sinema terminolojisini de anlayan akıllı sıralama."""
        if not self.client or not assets_metadata:
            return [a["id"] for a in assets_metadata]

        try:
            assets_text = json.dumps(assets_metadata[:50], indent=2)
            message = self.client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                messages=[
                    {
                        "role": "user",
                        "content": (
                            f'Sinema ve görsel prodüksiyon arama motoru olarak çalış.\n'
                            f'Arama sorgusu: "{query}"\n\n'
                            f'Varlıklar:\n{assets_text}\n\n'
                            'Sinema terminolojisini dikkate alarak (çekim ölçekleri, ışık türleri, '
                            'kamera açıları vb.) en alakalı varlıkların ID\'lerini '
                            'alaka sırasına göre JSON dizisi olarak döndür.\n'
                            'Sadece alakalı olanları dahil et. Örnek: [3, 1, 5]\n'
                            'Sadece JSON dizisi döndür, açıklama ekleme.'
                        ),
                    }
                ],
            )
            raw = message.content[0].text.strip()
            if raw.startswith("```"):
                lines = raw.split("\n")
                raw = "\n".join(lines[1:-1])
            result = json.loads(raw)
            if isinstance(result, list):
                valid_ids = {a["id"] for a in assets_metadata}
                return [int(rid) for rid in result if isinstance(rid, (int, float)) and int(rid) in valid_ids]
        except Exception as e:
            logger.error(f"AI search error: {e}", exc_info=True)

        return [a["id"] for a in assets_metadata]

    def _validate_analysis(self, data: dict) -> dict:
        """AI çıktısını doğrula ve sanitize et."""

        def safe_str(v, max_len=2000) -> str:
            return str(v)[:max_len] if v else ""

        def safe_list(v, valid_set: set | None, max_items=10, item_max=64) -> list[str]:
            if not isinstance(v, list):
                return []
            items = [str(item).lower().strip()[:item_max] for item in v if item]
            if valid_set:
                items = [i for i in items if i in valid_set]
            return items[:max_items]

        def safe_enum(v, valid_set: set, fallback="unknown") -> str:
            val = str(v).lower().strip() if v else fallback
            return val if val in valid_set else fallback

        return {
            "description": safe_str(data.get("description"), 2000),
            "tags": safe_list(data.get("tags"), None, 15, 64),
            "scene_type": safe_enum(data.get("scene_type"), VALID_SCENE_TYPES, "exterior"),
            "ai_objects": safe_list(data.get("ai_objects"), None, 10, 64),
            "ai_colors": safe_list(data.get("ai_colors"), None, 8, 32),
            # Sinema alanları
            "shot_scale": safe_enum(data.get("shot_scale"), VALID_SHOT_SCALES),
            "camera_angle": safe_enum(data.get("camera_angle"), VALID_CAMERA_ANGLES),
            "camera_movement": safe_enum(data.get("camera_movement"), VALID_CAMERA_MOVEMENTS),
            "lighting_type": safe_enum(data.get("lighting_type"), VALID_LIGHTING_TYPES, "natural"),
            "color_tone": safe_enum(data.get("color_tone"), VALID_COLOR_TONES, "neutral"),
            "composition_tags": safe_list(data.get("composition_tags"), VALID_COMPOSITION_TAGS, 6),
            "subject_tags": safe_list(data.get("subject_tags"), VALID_SUBJECT_TAGS, 6),
            "mood_tags": safe_list(data.get("mood_tags"), VALID_MOOD_TAGS, 4),
        }

    def _mock_analysis(self, file_path: str) -> dict:
        name = Path(file_path).stem.replace("_", " ").replace("-", " ")
        return {
            "description": f"Görsel: {name}. AI analizi için ANTHROPIC_API_KEY ayarlayın.",
            "tags": ["media", "upload"],
            "scene_type": "exterior",
            "ai_objects": [],
            "ai_colors": [],
            "shot_scale": "unknown",
            "camera_angle": "unknown",
            "camera_movement": "unknown",
            "lighting_type": "natural",
            "color_tone": "neutral",
            "composition_tags": [],
            "subject_tags": [],
            "mood_tags": [],
        }


ai_service = AIService()
