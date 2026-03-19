from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
from .user import UserResponse


class CommentCreate(BaseModel):
    content: str
    timestamp: Optional[float] = None
    x_pos: Optional[float] = None
    y_pos: Optional[float] = None
    parent_id: Optional[int] = None

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Comment cannot be empty")
        if len(v) > 2000:
            raise ValueError("Comment too long (max 2000 characters)")
        return v

    @field_validator("timestamp")
    @classmethod
    def timestamp_non_negative(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Timestamp must be non-negative")
        return v

    @field_validator("x_pos", "y_pos")
    @classmethod
    def position_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (0.0 <= v <= 100.0):
            raise ValueError("Position must be between 0 and 100")
        return v


class CommentResponse(BaseModel):
    id: int
    content: str
    timestamp: Optional[float] = None
    x_pos: Optional[float] = None
    y_pos: Optional[float] = None
    is_resolved: bool
    parent_id: Optional[int] = None
    asset_id: int
    author_id: int
    author: Optional[UserResponse] = None
    guest_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
