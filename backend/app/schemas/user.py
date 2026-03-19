from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime
from ..models.user import UserRole
import re


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    password: str
    # NOTE: role is intentionally NOT accepted from clients during registration.
    # All new users are created as 'editor'. Admins can change roles separately.

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 32:
            raise ValueError("Username must be 3–32 characters")
        if not re.match(r"^[a-zA-Z0-9_\-]+$", v):
            raise ValueError("Username may only contain letters, numbers, _ and -")
        return v

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2 or len(v) > 100:
            raise ValueError("Full name must be 2–100 characters")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v) > 128:
            raise ValueError("Password too long (max 128 characters)")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def full_name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if len(v) < 2 or len(v) > 100:
                raise ValueError("Full name must be 2–100 characters")
        return v


class UserRoleUpdate(BaseModel):
    """Admin-only: change a user's role."""
    role: UserRole


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    full_name: str
    role: UserRole
    is_active: bool
    avatar_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


class TokenData(BaseModel):
    user_id: Optional[int] = None
