"""
AI Servisi — Sinema/Görsel Sektör Odaklı Medya Analizi

Backend öncelik sırası (config.AI_BACKEND'e göre):
  auto      → Ollama (local) → Anthropic API → Mock
  local     → Ollama zorunlu (çalışmıyorsa mock'a düşer, uyarı verir)
  anthropic → Anthropic API zorunlu
  mock      → Her zaman dummy veri
"""

import base64
import json
import logging
from pathlib import Path
from typing import Optional

from ..config import settings

logger = logging.getLogger(__name__)

# ── Geçerli sinema enum değerleri ──────────────────────────────────────────────

VALID_SHOT_SCALES = {
    "extreme_close_up", "close_up", "medium_close_up", "medium_shot",
    "medium_wide", "full_shot", "wide_shot", "extreme_wide",
    "aerial", "insert", "unknown",
}

VALID_CAMERA_ANGLES = {
    "eye_level", "low_angle", "high_angle", "dutch_angle",
    "birds_eye", "worms_eye", "over_shoulder", "pov", "unknown",
}

VALID_CAMERA_MOVEMENTS = {
    "static", "pan", "tilt", "dolly", "tracking",
    "handheld", "aerial_move", "zoom", "crane", "steadicam", "unknown",
}

VALID_LIGHTING_TYPES = {
    "natural", "golden_hour", "blue_hour", "overcast",
    "high_key", "low_key", "backlit", "silhouette",
    "studio", "practical", "mixed", "neon", "night",
}

VALID_COLOR_TONES = {
    "warm", "cool", "neutral", "desaturated",
    "high_contrast", "low_contrast", "teal_orange",
    "black_white", "vintage", "vibrant", "muted",
}

VALID_COMPOSITION_TAGS = {
    "rule_of_thirds", "symmetrical", "leading_lines", "framing",
    "bokeh", "deep_focus", "negative_space", "foreground_depth",
    "center_composition", "diagonal",
}

VALID_SUBJECT_TAGS = {
    "portrait", "group", "crowd", "nature", "urban", "architecture",
    "vehicle", "animal", "product", "food", "abstract", "event",
    "sport", "performance", "interview", "broll", "aerial_view", "underwater",
}

VALID_MOOD_TAGS = {
    "dramatic", "peaceful", "tense", "romantic", "melancholic",
    "epic", "intimate", "mysterious", "energetic", "dark",
    "joyful", "nostalgic", "documentary", "commercial",
}

VALID_SCENE_TYPES = {
    "interior", "exterior", "studio", "location", "green_screen",
}


def _build_cinema_prompt() -> str:
    """Sinematografi odaklı analiz prompt'u — Ollama ve Anthropic için ortak."""
    return f"""Sen deneyimli bir sinematograf ve görsel sanatçısın.
Bu görseli sinema ve görsel prodüksiyon perspektifinden analiz et.

Sadece aşağıdaki JSON formatında yanıt ver. Markdown, açıklama veya başka metin EKLEME.

{{
  "description": "Görselin 2-3 cümlelik sinematografik açıklaması.",
  "tags": ["genel etiket 1", "etiket 2", "5-10 adet"],
  "shot_scale": "değer",
  "camera_angle": "değer",
  "camera_movement": "değer",
  "lighting_type": "değer",
  "color_tone": "değer",
  "composition_tags": ["maks 4"],
  "subject_tags": ["maks 5"],
  "mood_tags": ["maks 3"],
  "scene_type": "değer",
  "ai_colors": ["3-5 baskın renk"],
  "ai_objects": ["sahnedeki ana öğeler, maks 8"]
}}

shot_scale için geçerli değerler: {', '.join(sorted(VALID_SHOT_SCALES))}
camera_angle için geçerli değerler: {', '.join(sorted(VALID_CAMERA_ANGLES))}
camera_movement için geçerli değerler: {', '.join(sorted(VALID_CAMERA_MOVEMENTS))}
lighting_type için geçerli değerler: {', '.join(sorted(VALID_LIGHTING_TYPES))}
color_tone için geçerli değerler: {', '.join(sorted(VALID_COLOR_TONES))}
composition_tags için geçerli değerler: {', '.join(sorted(VALID_COMPOSITION_TAGS))}
subject_tags için geçerli değerler: {', '.join(sorted(VALID_SUBJECT_TAGS))}
mood_tags için geçerli değerler: {', '.join(sorted(VALID_MOOD_TAGS))}
scene_type için geçerli değerler: {', '.join(sorted(VALID_SCENE_TYPES))}

Emin olmadığın alanlarda "unknown" veya boş liste kullan. SADECE JSON döndür."""


def _build_search_prompt(query: str, assets_text: str) -> str:
    return (
        f'Sinema ve görsel prodüksiyon arama motoru olarak çalış.\n'
        f'Arama sorgusu: "{query}"\n\n'
        f'Varlıklar:\n{assets_text}\n\n'
        'Çekim ölçeği, ışık türü, kamera açısı, atmosfer gibi sinema terimlerini anlayarak '
        'en alakalı varlıkların ID\'lerini alaka sırasına göre JSON dizisi olarak döndür.\n'
        'Sadece alakalı olanları dahil et. ÖRNEK: [3, 1, 5]\n'
        'SADECE JSON dizisi döndür, başka hiçbir şey yazma.'
    )


# ── Backend sınıfları ──────────────────────────────────────────────────────────

class OllamaBackend:
    """Ollama ile local model çalıştırma (vision + text)."""

    def __init__(self):
        self._available: Optional[bool] = None

    def is_available(self) -> bool:
        if self._available is None:
            try:
                import ollama
                client = ollama.Client(host=settings.OLLAMA_BASE_URL)
                client.list()
                self._available = True
                logger.info(f"Ollama available at {settings.OLLAMA_BASE_URL}")
            except Exception as e:
                self._available = False
                logger.warning(f"Ollama not available: {e}")
        return self._available

    def _pull_if_missing(self, model: str) -> bool:
        """Model listede yoksa otomatik indir."""
        try:
            import ollama
            client = ollama.Client(host=settings.OLLAMA_BASE_URL)
            models = client.list()
            names = [m.model for m in models.models]
            # Model adı tam eşleşme veya prefix eşleşme
            found = any(name.startswith(model.split(":")[0]) for name in names)
            if not found:
                logger.info(f"Pulling Ollama model '{model}' — bu ilk seferde biraz sürebilir...")
                client.pull(model)
                logger.info(f"Model '{model}' indirildi.")
            return True
        except Exception as e:
            logger.error(f"Ollama model pull hatası ({model}): {e}")
            return False

    def analyze_image(self, file_path: str) -> Optional[dict]:
        if not self.is_available():
            return None
        try:
            import ollama
            client = ollama.Client(host=settings.OLLAMA_BASE_URL)

            if not self._pull_if_missing(settings.OLLAMA_VISION_MODEL):
                return None

            with open(file_path, "rb") as f:
                image_bytes = f.read()
            image_b64 = base64.b64encode(image_bytes).decode()

            response = client.chat(
                model=settings.OLLAMA_VISION_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": _build_cinema_prompt(),
                        "images": [image_b64],
                    }
                ],
                options={"temperature": 0.1},
            )
            raw = response.message.content
            logger.debug(f"Ollama vision raw response: {raw[:300]}")
            return _safe_parse_json(raw)

        except Exception as e:
            logger.error(f"Ollama image analysis error: {e}", exc_info=True)
            return None

    def search_rerank(self, query: str, assets_text: str) -> Optional[list]:
        if not self.is_available():
            return None
        try:
            import ollama
            client = ollama.Client(host=settings.OLLAMA_BASE_URL)

            if not self._pull_if_missing(settings.OLLAMA_TEXT_MODEL):
                return None

            response = client.chat(
                model=settings.OLLAMA_TEXT_MODEL,
                messages=[
                    {
                        "role": "user",
                        "content": _build_search_prompt(query, assets_text),
                    }
                ],
                options={"temperature": 0.0},
            )
            raw = response.message.content.strip()
            return _safe_parse_list(raw)

        except Exception as e:
            logger.error(f"Ollama search error: {e}", exc_info=True)
            return None


class AnthropicBackend:
    """Anthropic Claude API ile bulut analiz."""

    def __init__(self):
        self._client = None
        if settings.ANTHROPIC_API_KEY:
            try:
                import anthropic
                self._client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
                logger.info("Anthropic API client initialized")
            except Exception as e:
                logger.warning(f"Anthropic init error: {e}")

    def is_available(self) -> bool:
        return self._client is not None

    def analyze_image(self, file_path: str) -> Optional[dict]:
        if not self._client:
            return None
        try:
            import anthropic
            path = Path(file_path)
            media_type_map = {
                ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                ".png": "image/png", ".gif": "image/gif",
                ".webp": "image/webp",
            }
            media_type = media_type_map.get(path.suffix.lower(), "image/jpeg")
            with open(file_path, "rb") as f:
                image_b64 = base64.standard_b64encode(f.read()).decode()

            message = self._client.messages.create(
                model="claude-opus-4-6",
                max_tokens=1500,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image",
                                "source": {"type": "base64", "media_type": media_type, "data": image_b64},
                            },
                            {"type": "text", "text": _build_cinema_prompt()},
                        ],
                    }
                ],
            )
            return _safe_parse_json(message.content[0].text)

        except Exception as e:
            logger.error(f"Anthropic image analysis error: {e}", exc_info=True)
            return None

    def search_rerank(self, query: str, assets_text: str) -> Optional[list]:
        if not self._client:
            return None
        try:
            message = self._client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=512,
                messages=[{"role": "user", "content": _build_search_prompt(query, assets_text)}],
            )
            return _safe_parse_list(message.content[0].text)
        except Exception as e:
            logger.error(f"Anthropic search error: {e}", exc_info=True)
            return None


# ── Yardımcı fonksiyonlar ──────────────────────────────────────────────────────

def _safe_parse_json(text: str) -> Optional[dict]:
    text = text.strip()
    # Markdown code block temizle
    if "```" in text:
        import re
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            text = match.group(1).strip()
    # İlk { ... } bloğunu bul
    start = text.find("{")
    end = text.rfind("}") + 1
    if start >= 0 and end > start:
        text = text[start:end]
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning(f"JSON parse failed: {e} | raw={text[:300]}")
    return None


def _safe_parse_list(text: str) -> Optional[list]:
    text = text.strip()
    if "```" in text:
        import re
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            text = match.group(1).strip()
    start = text.find("[")
    end = text.rfind("]") + 1
    if start >= 0 and end > start:
        text = text[start:end]
    try:
        result = json.loads(text)
        if isinstance(result, list):
            return result
    except (json.JSONDecodeError, ValueError):
        pass
    return None


def _validate_analysis(data: dict) -> dict:
    """AI çıktısını doğrula ve sanitize et."""

    def safe_str(v, max_len=2000) -> str:
        return str(v)[:max_len] if v else ""

    def safe_list(v, valid_set: Optional[set], max_items=15, item_max=64) -> list:
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
        "shot_scale": safe_enum(data.get("shot_scale"), VALID_SHOT_SCALES),
        "camera_angle": safe_enum(data.get("camera_angle"), VALID_CAMERA_ANGLES),
        "camera_movement": safe_enum(data.get("camera_movement"), VALID_CAMERA_MOVEMENTS),
        "lighting_type": safe_enum(data.get("lighting_type"), VALID_LIGHTING_TYPES, "natural"),
        "color_tone": safe_enum(data.get("color_tone"), VALID_COLOR_TONES, "neutral"),
        "composition_tags": safe_list(data.get("composition_tags"), VALID_COMPOSITION_TAGS, 6),
        "subject_tags": safe_list(data.get("subject_tags"), VALID_SUBJECT_TAGS, 6),
        "mood_tags": safe_list(data.get("mood_tags"), VALID_MOOD_TAGS, 4),
    }


def _mock_analysis(file_path: str) -> dict:
    name = Path(file_path).stem.replace("_", " ").replace("-", " ")
    return {
        "description": f"Görsel: {name}. Gerçek AI için Ollama veya ANTHROPIC_API_KEY yapılandırın.",
        "tags": ["media", "upload"],
        "scene_type": "exterior",
        "ai_objects": [], "ai_colors": [],
        "shot_scale": "unknown", "camera_angle": "unknown",
        "camera_movement": "unknown", "lighting_type": "natural",
        "color_tone": "neutral", "composition_tags": [],
        "subject_tags": [], "mood_tags": [],
    }


# ── Ana AIService sınıfı ───────────────────────────────────────────────────────

class AIService:
    """
    Hibrit AI servisi.
    AI_BACKEND ayarına göre Ollama (local) → Anthropic → Mock önceliğiyle çalışır.
    """

    def __init__(self):
        self.ollama = OllamaBackend()
        self.anthropic = AnthropicBackend()
        backend = settings.AI_BACKEND.lower()
        logger.info(f"AI backend mode: {backend}")

    def _get_image_backend(self):
        """Aktif backend'i konfigürasyona göre seç."""
        mode = settings.AI_BACKEND.lower()
        if mode == "anthropic":
            return self.anthropic if self.anthropic.is_available() else None
        if mode == "local":
            return self.ollama if self.ollama.is_available() else None
        if mode == "mock":
            return None
        # auto: local önce
        if self.ollama.is_available():
            return self.ollama
        if self.anthropic.is_available():
            return self.anthropic
        return None

    def _get_text_backend(self):
        """Metin işleme için aktif backend."""
        mode = settings.AI_BACKEND.lower()
        if mode == "anthropic":
            return self.anthropic if self.anthropic.is_available() else None
        if mode == "local":
            return self.ollama if self.ollama.is_available() else None
        if mode == "mock":
            return None
        if self.ollama.is_available():
            return self.ollama
        if self.anthropic.is_available():
            return self.anthropic
        return None

    def analyze_image(self, file_path: str) -> dict:
        """Görsel analizi — sinema metadata üret."""
        backend = self._get_image_backend()
        if backend is None:
            logger.warning("No AI backend available, using mock analysis")
            return _mock_analysis(file_path)

        backend_name = "Ollama" if isinstance(backend, OllamaBackend) else "Anthropic"
        logger.info(f"Analyzing image with {backend_name}: {Path(file_path).name}")

        result = backend.analyze_image(file_path)
        if result:
            return _validate_analysis(result)

        # Fallback zinciri: Ollama başarısız → Anthropic dene
        if isinstance(backend, OllamaBackend) and self.anthropic.is_available():
            logger.warning("Ollama failed, falling back to Anthropic API")
            result = self.anthropic.analyze_image(file_path)
            if result:
                return _validate_analysis(result)

        logger.warning("All AI backends failed, using mock")
        return _mock_analysis(file_path)

    def natural_language_search(self, query: str, assets_metadata: list[dict]) -> list[int]:
        """Doğal dil araması — sinema terminolojisini anlayan sıralama."""
        if not assets_metadata:
            return []

        backend = self._get_text_backend()
        if backend is None:
            return [a["id"] for a in assets_metadata]

        try:
            assets_text = json.dumps(assets_metadata[:50], indent=2)
            result = backend.search_rerank(query, assets_text)
            if result is not None:
                valid_ids = {a["id"] for a in assets_metadata}
                ranked = [int(rid) for rid in result if isinstance(rid, (int, float)) and int(rid) in valid_ids]
                if ranked:
                    return ranked

            # Fallback: Ollama başarısız → Anthropic
            if isinstance(backend, OllamaBackend) and self.anthropic.is_available():
                logger.warning("Ollama search failed, falling back to Anthropic")
                result = self.anthropic.search_rerank(query, assets_text)
                if result is not None:
                    valid_ids = {a["id"] for a in assets_metadata}
                    return [int(rid) for rid in result if isinstance(rid, (int, float)) and int(rid) in valid_ids]

        except Exception as e:
            logger.error(f"Search rerank error: {e}", exc_info=True)

        return [a["id"] for a in assets_metadata]

    def get_status(self) -> dict:
        """AI backend durumunu döndür — health check için."""
        return {
            "mode": settings.AI_BACKEND,
            "ollama": {
                "available": self.ollama.is_available(),
                "base_url": settings.OLLAMA_BASE_URL,
                "vision_model": settings.OLLAMA_VISION_MODEL,
                "text_model": settings.OLLAMA_TEXT_MODEL,
            },
            "anthropic": {
                "available": self.anthropic.is_available(),
            },
        }


ai_service = AIService()
