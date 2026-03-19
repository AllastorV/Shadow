import base64
import json
from pathlib import Path
from typing import Optional
import anthropic
from ..config import settings


class AIService:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY) if settings.ANTHROPIC_API_KEY else None

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
                                "text": """Analyze this image and provide metadata in JSON format with these fields:
- description: A detailed 2-3 sentence description of the image
- tags: List of 5-10 relevant tags (lowercase, single words or short phrases)
- scene_type: One of: portrait, landscape, product, abstract, documentary, event, architecture, nature, food, sports, other
- objects: List of main objects/subjects detected (up to 10)
- colors: List of 3-5 dominant colors (as color names)

Respond with ONLY valid JSON, no other text."""
                            }
                        ],
                    }
                ],
            )
            return json.loads(message.content[0].text)
        except Exception as e:
            print(f"AI analysis error: {e}")
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
                        "content": f"""Given this search query: "{query}"

And these media assets with their metadata:
{assets_text}

Return a JSON array of asset IDs sorted by relevance to the query (most relevant first).
Only include assets that are relevant. Return ONLY a JSON array like [1, 5, 3], no other text."""
                    }
                ],
            )
            result = json.loads(message.content[0].text)
            if isinstance(result, list):
                return result
            return [a["id"] for a in assets_metadata]
        except Exception as e:
            print(f"Search AI error: {e}")
            return [a["id"] for a in assets_metadata]

    def generate_asset_summary(self, assets: list[dict]) -> str:
        """Generate a natural language summary of a collection of assets."""
        if not self.client:
            return f"Collection of {len(assets)} media assets."

        try:
            message = self.client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=256,
                messages=[
                    {
                        "role": "user",
                        "content": f"Summarize this media collection in 1-2 sentences: {json.dumps(assets[:20])}"
                    }
                ],
            )
            return message.content[0].text
        except Exception:
            return f"Collection of {len(assets)} media assets."

    def _mock_analysis(self, file_path: str) -> dict:
        """Return mock analysis when AI is not configured."""
        name = Path(file_path).stem.replace("_", " ").replace("-", " ")
        return {
            "description": f"Media file: {name}. AI analysis unavailable - configure ANTHROPIC_API_KEY.",
            "tags": ["media", "upload", "asset"],
            "scene_type": "other",
            "objects": [],
            "colors": []
        }


ai_service = AIService()
