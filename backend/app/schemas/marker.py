from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
from ..models.marker import MarkerColor


class MarkerCreate(BaseModel):
    label: str
    note: Optional[str] = None
    color: MarkerColor = MarkerColor.red
    # Video: saniye (None = gorsel marker)
    timestamp: Optional[float] = None
    duration_sec: Optional[float] = 0.0
    # Gorsel: yuzde konum (None = video marker)
    x_pos: Optional[float] = None
    y_pos: Optional[float] = None

    @field_validator("label")
    @classmethod
    def label_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Label cannot be empty")
        return v[:255]

    @field_validator("timestamp")
    @classmethod
    def timestamp_non_negative(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Timestamp must be non-negative")
        return v

    @field_validator("x_pos", "y_pos")
    @classmethod
    def position_range(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and not (0.0 <= v <= 100.0):
            raise ValueError("Position must be between 0 and 100")
        return v


class MarkerUpdate(BaseModel):
    label: Optional[str] = None
    note: Optional[str] = None
    color: Optional[MarkerColor] = None
    duration_sec: Optional[float] = None

    @field_validator("label")
    @classmethod
    def label_not_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Label cannot be empty")
            return v[:255]
        return v


class MarkerResponse(BaseModel):
    id: int
    label: str
    note: Optional[str] = None
    color: MarkerColor
    timestamp: Optional[float] = None
    duration_sec: Optional[float] = None
    x_pos: Optional[float] = None
    y_pos: Optional[float] = None
    asset_id: int
    created_by_id: int
    created_at: datetime

    class Config:
        from_attributes = True
