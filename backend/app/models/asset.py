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
    original_name = Column(String, nullable=False, index=True)  # arama için
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String, nullable=False)
    asset_type = Column(Enum(AssetType), nullable=False, index=True)  # tür filtresi
    status = Column(Enum(AssetStatus), default=AssetStatus.pending, index=True)  # durum filtresi

    # Dimensions (for images/videos)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)  # seconds, for video/audio

    # --- Temel AI metadata ---
    ai_description = Column(Text, nullable=True)
    ai_tags = Column(JSON, nullable=True)           # genel tag listesi
    ai_scene_type = Column(String, nullable=True)   # iç/dış/stüdyo vb.
    ai_objects = Column(JSON, nullable=True)         # tespit edilen nesneler/kişiler
    ai_colors = Column(JSON, nullable=True)          # baskın renkler
    ai_transcript = Column(Text, nullable=True)      # ses/video transkripti

    # --- Sinematografi metadata ---
    # Çekim ölçeği: extreme_close_up, close_up, medium_close_up, medium_shot,
    #               medium_wide, wide_shot, extreme_wide, full_shot, aerial, unknown
    shot_scale = Column(String, nullable=True)

    # Kamera açısı: eye_level, low_angle, high_angle, dutch_angle,
    #               birds_eye, worms_eye, unknown
    camera_angle = Column(String, nullable=True)

    # Kamera hareketi: static, pan, tilt, dolly, tracking,
    #                  handheld, aerial_move, zoom, unknown
    camera_movement = Column(String, nullable=True)

    # Işık türü: natural, golden_hour, blue_hour, high_key, low_key,
    #            backlit, silhouette, studio, practical, mixed
    lighting_type = Column(String, nullable=True)

    # Renk tonu: warm, cool, neutral, desaturated, high_contrast,
    #            low_contrast, teal_orange, black_white, vintage
    color_tone = Column(String, nullable=True)

    # Kompozisyon etiketleri (birden fazla olabilir)
    # Örn: ["rule_of_thirds", "bokeh", "symmetrical", "leading_lines"]
    composition_tags = Column(JSON, nullable=True)

    # Konu/özne etiketleri
    # Örn: ["portrait", "crowd", "vehicle", "architecture", "landscape"]
    subject_tags = Column(JSON, nullable=True)

    # Atmosfer/duygu etiketleri
    # Örn: ["dramatic", "peaceful", "tense", "romantic", "documentary"]
    mood_tags = Column(JSON, nullable=True)

    # Thumbnail
    thumbnail_path = Column(String, nullable=True)

    # Relationships
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)  # liste sorgusu
    uploader_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)  # sıralama
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    project = relationship("Project", back_populates="assets")
    uploader = relationship("User", back_populates="uploaded_assets")
    comments = relationship("Comment", back_populates="asset", cascade="all, delete-orphan")
    tags = relationship("Tag", back_populates="asset", cascade="all, delete-orphan")
    share_links = relationship("ShareLink", back_populates="asset", cascade="all, delete-orphan")
