from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, Any
from datetime import datetime, timezone
from ..models.share_link import SharePermission


class ShareLinkCreate(BaseModel):
    permission: SharePermission = SharePermission.view
    expires_at: Optional[datetime] = None
    password: Optional[str] = None
    recipient_name: Optional[str] = None
    auto_password: bool = False

    @field_validator("expires_at")
    @classmethod
    def expiry_in_future(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None:
            now = datetime.now(timezone.utc)
            exp = v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v
            if exp <= now:
                raise ValueError("Expiry date must be in the future")
        return v

    @field_validator("password")
    @classmethod
    def password_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if len(v) < 4:
                raise ValueError("Share link password must be at least 4 characters")
            if len(v) > 64:
                raise ValueError("Share link password too long")
        return v

    @field_validator("recipient_name")
    @classmethod
    def recipient_name_length(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if len(v) > 100:
                raise ValueError("Recipient name too long")
        return v or None


class ShareLinkResponse(BaseModel):
    id: int
    token: str
    label: Optional[str] = None
    permission: SharePermission
    is_active: bool
    expires_at: Optional[datetime] = None
    view_count: int
    download_count: int = 0
    asset_id: Optional[int] = None
    created_at: datetime
    has_password: bool = False
    plain_password: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def compute_has_password(cls, data: Any) -> Any:
        # When loading from ORM object, compute has_password from password_hash
        if hasattr(data, "password_hash"):
            data.__dict__.setdefault("has_password", bool(data.password_hash))
        return data

    class Config:
        from_attributes = True
