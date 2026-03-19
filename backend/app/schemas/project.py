from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
from .user import UserResponse


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1:
            raise ValueError("Project name cannot be empty")
        if len(v) > 200:
            raise ValueError("Project name too long (max 200 characters)")
        return v

    @field_validator("description")
    @classmethod
    def description_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if len(v) > 1000:
                raise ValueError("Description too long (max 1000 characters)")
            return v or None
        return v


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cover_image_url: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if len(v) < 1 or len(v) > 200:
                raise ValueError("Project name must be 1–200 characters")
        return v

    @field_validator("cover_image_url")
    @classmethod
    def safe_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > 2048:
            raise ValueError("URL too long")
        return v


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    cover_image_url: Optional[str] = None
    owner_id: int
    owner: Optional[UserResponse] = None
    asset_count: Optional[int] = 0
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
