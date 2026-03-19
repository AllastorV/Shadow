from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    timestamp = Column(Float, nullable=True)  # video/audio timestamp in seconds
    x_pos = Column(Float, nullable=True)  # annotation x position (0-100%)
    y_pos = Column(Float, nullable=True)  # annotation y position (0-100%)
    is_resolved = Column(Boolean, default=False)
    parent_id = Column(Integer, ForeignKey("comments.id"), nullable=True)

    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    asset = relationship("Asset", back_populates="comments")
    author = relationship("User", back_populates="comments")
    replies = relationship("Comment", backref=ForeignKey("comments.parent_id"))
