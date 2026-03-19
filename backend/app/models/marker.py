from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base


class MarkerColor(str, enum.Enum):
    red = "red"
    green = "green"
    blue = "blue"
    yellow = "yellow"
    purple = "purple"
    orange = "orange"
    cyan = "cyan"


class Marker(Base):
    __tablename__ = "markers"

    id = Column(Integer, primary_key=True, index=True)

    label = Column(String(255), nullable=False)
    note = Column(Text, nullable=True)
    color = Column(Enum(MarkerColor), default=MarkerColor.red, nullable=False)

    # Video markerlari: saniye cinsinden zaman damgasi
    timestamp = Column(Float, nullable=True, index=True)
    # Aralik markerlari icin sure (0 = an marker)
    duration_sec = Column(Float, nullable=True, default=0.0)

    # Gorsel markerlari: yuzde (0-100) bazli konum
    x_pos = Column(Float, nullable=True)
    y_pos = Column(Float, nullable=True)

    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False, index=True)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    asset = relationship("Asset", back_populates="markers")
    created_by = relationship("User")
