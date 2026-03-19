from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base

# Giriş başarısız sayısı bu değere ulaşınca hesap kilitlenir
MAX_FAILED_LOGINS = 5
# Kilit süresi (dakika)
LOCKOUT_MINUTES   = 15


class UserRole(str, enum.Enum):
    admin = "admin"
    editor = "editor"
    viewer = "viewer"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.editor, nullable=False)
    is_active = Column(Boolean, default=True)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Brute-force koruması
    failed_login_count = Column(Integer, default=0, nullable=False)
    locked_until       = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    owned_projects = relationship("Project", back_populates="owner", foreign_keys="Project.owner_id")
    uploaded_assets = relationship("Asset", back_populates="uploader")
    comments = relationship("Comment", back_populates="author")
