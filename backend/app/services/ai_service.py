import base64
import json
import logging
from pathlib import Path
from typing import Optional
import anthropic
from ..config import settings

logger = logging.getLogger(__name__)


class AIService:
    def __init__(self):
        self.client = (
            anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            if settings.ANTHROPIC_API_KEY
            else None
        )

    def _encode_image(self, file_path: str) -> tuple[str, str]:
        """Encode image to base64 for Claude vision."""
        path = Path(file_path)
        suffix = path.suffix.lower()
        media_type_map = {
            ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".png": "image/png", ".gif": "image/gif",
            ".webp": "image/webp",
        }
        media_type = media_type_map.get(suffix, "image/jpeg")
        with open(file_path, "rb") as f:
            data = base64.standard_b64encode(f.read()).decode("utf-8")
        return data, media_type

    def _safe_parse_json(self, text: str) -> Optional[dict]:
        """Safely parse JSON from AI response, handling markdown code blocks."""
        text = text.strip()
        # Strip markdown code block wrappers if present
        if text.startswith("```"):
            lines = text.split("\n")
            text = "\n".join(lines[1:-1]) if len(lines) > 2 else text
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"AI returned non-JSON response: {e} | raw={text[:200]}")
        return None

    def analyze_image(self, file_path: str) -> dict:
        """Use Claude vision to analyze an image and generate metadata."""
        if not self.client:
            return self._mock_analysis(file_path)

        try:
            image_data, media_type = self._encode_image(file_path)
            message = self.client.messages.create(
                model="claude-opus-4-6",
                max_tokens=1024,
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
                                "text": (
                                    "Analyze this image and provide metadata as valid JSON with these fields:\n"
                                    "- description: 2-3 sentence description\n"
                                    "- tags: list of 5-10 lowercase tags\n"
                                    "- scene_type: one of: portrait, landscape, product, abstract, "
                                    "documentary, event, architecture, nature, food, sports, other\n"
                                    "- objects: list of main objects (up to 10)\n"
                                    "- colors: list of 3-5 dominant color names\n\n"
                                    "Respond ONLY with valid JSON. No markdown, no explanation."
                                ),
                            },
                        ],
                    }
                ],
            )
            raw = message.content[0].text
            parsed = self._safe_parse_json(raw)
            if parsed:
                return self._validate_analysis(parsed)

            logger.warning("Could not parse AI analysis response, using mock")
            return self._mock_analysis(file_path)

        except anthropic.APIError as e:
            logger.error(f"Anthropic API error during image analysis: {e}")
            return self._mock_analysis(file_path)
        except Exception as e:
            logger.error(f"Unexpected error during image analysis: {e}", exc_info=True)
            return self._mock_analysis(file_path)

    def natural_language_search(self, query: str, assets_metadata: list[dict]) -> list[int]:
        """Use Claude to rank assets by relevance to a natural language query."""
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
                            f'Search query: "{query}"\n\n'
                            f"Assets:\n{assets_text}\n\n"
                            "Return ONLY a JSON array of relevant asset IDs sorted by relevance "
                            "(most relevant first). Example: [3, 1, 5]\n"
                            "Include only relevant IDs. No markdown, no explanation."
                        ),
                    }
                ],
            )
            raw = message.content[0].text.strip()
            # Strip markdown if present
            if raw.startswith("```"):
                lines = raw.split("\n")
                raw = "\n".join(lines[1:-1])

            try:
                result = json.loads(raw)
                if isinstance(result, list):
                    # SECURITY: Only return IDs that exist in our dataset
                    valid_ids = {a["id"] for a in assets_metadata}
                    return [int(rid) for rid in result if isinstance(rid, (int, float)) and int(rid) in valid_ids]
            except (json.JSONDecodeError, ValueError) as e:
                logger.warning(f"AI search returned non-JSON: {e} | raw={raw[:200]}")

        except anthropic.APIError as e:
            logger.error(f"Anthropic API error during search: {e}")
        except Exception as e:
            logger.error(f"Unexpected error during AI search: {e}", exc_info=True)

        return [a["id"] for a in assets_metadata]

    def _validate_analysis(self, data: dict) -> dict:
        """Sanitize and validate AI-generated analysis fields."""
        def safe_str(v, max_len=2000) -> str:
            return str(v)[:max_len] if v else ""

        def safe_list(v, max_items=20, item_max=64) -> list[str]:
            if not isinstance(v, list):
                return []
            return [str(item)[:item_max] for item in v if item][:max_items]

        VALID_SCENE_TYPES = {
            "portrait", "landscape", "product", "abstract", "documentary",
            "event", "architecture", "nature", "food", "sports", "other",
        }
        scene = str(data.get("scene_type", "other")).lower()
        if scene not in VALID_SCENE_TYPES:
            scene = "other"

        return {
            "description": safe_str(data.get("description"), 2000),
            "tags": safe_list(data.get("tags"), 20, 64),
            "scene_type": scene,
            "objects": safe_list(data.get("objects"), 20, 64),
            "colors": safe_list(data.get("colors"), 10, 32),
        }

    def _mock_analysis(self, file_path: str) -> dict:
        """Return mock analysis when AI is not configured."""
        name = Path(file_path).stem.replace("_", " ").replace("-", " ")
        return {
            "description": f"Media file: {name}. Configure ANTHROPIC_API_KEY to enable AI analysis.",
            "tags": ["media", "upload", "asset"],
            "scene_type": "other",
            "objects": [],
            "colors": [],
        }


ai_service = AIService()
