from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from .user import UserResponse


class CommentCreate(BaseModel):
    content: str
    timestamp: Optional[float] = None
    x_pos: Optional[float] = None
    y_pos: Optional[float] = None
    parent_id: Optional[int] = None


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
    created_at: datetime

    class Config:
        from_attributes = True
