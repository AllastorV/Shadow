from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from ..models.asset import AssetType, AssetStatus


class AssetUpdate(BaseModel):
    status: Optional[AssetStatus] = None
    ai_description: Optional[str] = None
    ai_tags: Optional[List[str]] = None


class TagResponse(BaseModel):
    id: int
    name: str
    is_ai_generated: bool

    class Config:
        from_attributes = True


class AssetResponse(BaseModel):
    id: int
    filename: str
    original_name: str
    file_size: int
    mime_type: str
    asset_type: AssetType
    status: AssetStatus
    width: Optional[int] = None
    height: Optional[int] = None
    duration: Optional[float] = None
    ai_description: Optional[str] = None
    ai_tags: Optional[List[str]] = None
    ai_scene_type: Optional[str] = None
    ai_objects: Optional[List[str]] = None
    ai_colors: Optional[List[str]] = None
    ai_transcript: Optional[str] = None
    thumbnail_path: Optional[str] = None
    project_id: int
    uploader_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    tags: Optional[List[TagResponse]] = []
    comment_count: Optional[int] = 0

    class Config:
        from_attributes = True
