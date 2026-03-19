from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Enum, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base


class SharePermission(str, enum.Enum):
    view = "view"
    comment = "comment"
    edit = "edit"        # yorum + marker ekleyebilir (giriş gerektirmez)
    download = "download"


class ShareLink(Base):
    __tablename__ = "share_links"

    id = Column(Integer, primary_key=True, index=True)
    token = Column(String, unique=True, index=True, nullable=False)
    label = Column(String, nullable=True)
    permission = Column(Enum(SharePermission), default=SharePermission.view)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    password_hash = Column(String, nullable=True)
    view_count = Column(Integer, default=0)
    download_count = Column(Integer, default=0)

    # Activity log — use None + runtime init to avoid mutable default
    activity_log = Column(JSON, nullable=True)

    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    asset = relationship("Asset", back_populates="share_links")
    created_by = relationship("User")
