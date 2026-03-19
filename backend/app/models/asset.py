from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Enum, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base


class AssetType(str, enum.Enum):
    image = "image"
    video = "video"
    audio = "audio"
    document = "document"
    other = "other"


class AssetStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    ready = "ready"
    approved = "approved"
    rejected = "rejected"


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)  # bytes
    mime_type = Column(String, nullable=False)
    asset_type = Column(Enum(AssetType), nullable=False)
    status = Column(Enum(AssetStatus), default=AssetStatus.pending)

    # Dimensions (for images/videos)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)  # seconds, for video/audio

    # AI-generated metadata
    ai_description = Column(Text, nullable=True)
    ai_tags = Column(JSON, nullable=True)  # list of strings
    ai_scene_type = Column(String, nullable=True)
    ai_objects = Column(JSON, nullable=True)  # detected objects
    ai_colors = Column(JSON, nullable=True)  # dominant colors
    ai_transcript = Column(Text, nullable=True)  # for audio/video

    # Thumbnail
    thumbnail_path = Column(String, nullable=True)

    # Relationships
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    uploader_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="assets")
    uploader = relationship("User", back_populates="uploaded_assets")
    comments = relationship("Comment", back_populates="asset", cascade="all, delete-orphan")
    tags = relationship("Tag", back_populates="asset", cascade="all, delete-orphan")
    share_links = relationship("ShareLink", back_populates="asset", cascade="all, delete-orphan")
