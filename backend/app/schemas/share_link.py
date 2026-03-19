from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..models.share_link import SharePermission


class ShareLinkCreate(BaseModel):
    permission: SharePermission = SharePermission.view
    expires_at: Optional[datetime] = None
    password: Optional[str] = None


class ShareLinkResponse(BaseModel):
    id: int
    token: str
    permission: SharePermission
    is_active: bool
    expires_at: Optional[datetime] = None
    view_count: int
    asset_id: int
    created_at: datetime

    class Config:
        from_attributes = True
