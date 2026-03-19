from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class FolderMount(Base):
    __tablename__ = "folder_mounts"

    id            = Column(Integer, primary_key=True, index=True)
    project_id    = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    path          = Column(String, nullable=False)   # absolute resolved path on server
    label         = Column(String, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    project    = relationship("Project", back_populates="mounts")
    created_by = relationship("User")
