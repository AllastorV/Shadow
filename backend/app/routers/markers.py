import logging
from pathlib import Path
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from ..database import SessionLocal, get_db
from ..models.asset import Asset
from ..models.marker import Marker
from ..models.user import User
from ..schemas.marker import MarkerCreate, MarkerResponse, MarkerUpdate
from ..utils.dependencies import get_accessible_project, get_current_user
from ..ws_manager import manager as ws_manager


async def _ws_broadcast(project_id: int, event: dict) -> None:
    await ws_manager.broadcast(project_id, event)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/markers", tags=["markers"])
limiter = Limiter(key_func=get_remote_address)


# ── Yardımcılar ───────────────────────────────────────────────────────────────

def _get_asset_checked(asset_id: int, current_user: User, db: Session) -> Asset:
    """Asset'i getir, proje erişimini doğrula."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    get_accessible_project(asset.project_id, current_user, db)
    return asset


def _markers_as_dicts(markers: list[Marker]) -> list[dict]:
    return [
        {
            "id": m.id,
            "label": m.label,
            "note": m.note,
            "color": m.color,
            "timestamp": m.timestamp,
            "duration_sec": m.duration_sec,
            "x_pos": m.x_pos,
            "y_pos": m.y_pos,
        }
        for m in markers
    ]


def _sync_bg(asset_id: int) -> None:
    """Arka planda sidecar + dosya içi XMP güncelle."""
    from ..services.marker_service import sync_markers_to_files
    db = SessionLocal()
    try:
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            return
        markers = db.query(Marker).filter(Marker.asset_id == asset_id).order_by(
            Marker.timestamp.asc().nullsfirst(), Marker.created_at.asc()
        ).all()
        sync_markers_to_files(
            file_path=asset.file_path,
            markers=_markers_as_dicts(markers),
            asset_name=asset.original_name,
            asset_type=str(asset.asset_type),
            duration=asset.duration or 0.0,
        )
    except Exception as exc:
        logger.error(f"Marker sync failed for asset {asset_id}: {exc}", exc_info=True)
    finally:
        db.close()


# ── Endpointler ───────────────────────────────────────────────────────────────

@router.get("/asset/{asset_id}", response_model=List[MarkerResponse])
@limiter.limit("120/minute")
def list_markers(
    request: Request,
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Asset'e ait tüm marker'ları listele."""
    _get_asset_checked(asset_id, current_user, db)
    return (
        db.query(Marker)
        .filter(Marker.asset_id == asset_id)
        .order_by(Marker.timestamp.asc().nullsfirst(), Marker.created_at.asc())
        .all()
    )


@router.post("/asset/{asset_id}", response_model=MarkerResponse, status_code=201)
@limiter.limit("60/minute")
def create_marker(
    request: Request,
    asset_id: int,
    data: MarkerCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Yeni marker ekle. Tüm proje üyeleri ekleyebilir."""
    asset = _get_asset_checked(asset_id, current_user, db)

    marker = Marker(
        label=data.label.strip()[:255],
        note=(data.note or "").strip()[:2000] or None,
        color=data.color,
        timestamp=data.timestamp,
        duration_sec=max(0.0, data.duration_sec or 0.0),
        x_pos=round(max(0.0, min(100.0, data.x_pos)), 4) if data.x_pos is not None else None,
        y_pos=round(max(0.0, min(100.0, data.y_pos)), 4) if data.y_pos is not None else None,
        asset_id=asset_id,
        created_by_id=current_user.id,
    )
    db.add(marker)
    db.commit()
    db.refresh(marker)

    # Sidecar dosyalarını arka planda güncelle
    background_tasks.add_task(_sync_bg, asset_id)

    # Proje odasına gerçek zamanlı yayın
    background_tasks.add_task(_ws_broadcast, asset.project_id, {
        "type":      "marker_created",
        "asset_id":  asset_id,
        "marker": {
            "id":           marker.id,
            "label":        marker.label,
            "note":         marker.note,
            "color":        marker.color if isinstance(marker.color, str) else marker.color.value,
            "timestamp":    marker.timestamp,
            "x_pos":        marker.x_pos,
            "y_pos":        marker.y_pos,
            "asset_id":     marker.asset_id,
            "created_by_id": marker.created_by_id,
        },
        "by": {
            "id":        current_user.id,
            "username":  current_user.username,
            "full_name": current_user.full_name,
        },
    })
    return marker


@router.patch("/{marker_id}", response_model=MarkerResponse)
@limiter.limit("60/minute")
def update_marker(
    request: Request,
    marker_id: int,
    data: MarkerUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marker'ı güncelle. Tüm proje üyeleri güncelleyebilir."""
    marker = db.query(Marker).filter(Marker.id == marker_id).first()
    if not marker:
        raise HTTPException(status_code=404, detail="Marker not found")

    _get_asset_checked(marker.asset_id, current_user, db)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(marker, field, value)
    db.commit()
    db.refresh(marker)

    background_tasks.add_task(_sync_bg, marker.asset_id)
    return marker


@router.delete("/{marker_id}", status_code=204)
@limiter.limit("60/minute")
def delete_marker(
    request: Request,
    marker_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marker sil. Yalnızca oluşturan, proje sahibi veya admin silebilir."""
    marker = db.query(Marker).filter(Marker.id == marker_id).first()
    if not marker:
        raise HTTPException(status_code=404, detail="Marker not found")

    del_asset  = _get_asset_checked(marker.asset_id, current_user, db)
    asset_id   = marker.asset_id
    project_id = del_asset.project_id

    # Yetki: yalnızca oluşturan, proje sahibi veya admin
    from ..models.user import UserRole
    from ..models.project import Project
    is_creator      = marker.created_by_id == current_user.id
    is_admin        = current_user.role == UserRole.admin
    project         = db.query(Project).filter(Project.id == project_id).first()
    is_project_owner = project and project.owner_id == current_user.id
    if not (is_creator or is_admin or is_project_owner):
        raise HTTPException(status_code=403, detail="Bu marker'ı silme yetkiniz yok")
    mid        = marker.id
    db.delete(marker)
    db.commit()
    background_tasks.add_task(_sync_bg, asset_id)

    # Gerçek zamanlı yayın
    background_tasks.add_task(_ws_broadcast, project_id, {
        "type":      "marker_deleted",
        "asset_id":  asset_id,
        "marker_id": mid,
        "by": {
            "id":        current_user.id,
            "username":  current_user.username,
            "full_name": current_user.full_name,
        },
    })


# ── Export Endpointleri ───────────────────────────────────────────────────────

@router.get("/asset/{asset_id}/export/xmp")
@limiter.limit("30/minute")
def export_xmp(
    request: Request,
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    XMP sidecar dosyasını indir — Premiere Pro için.
    Dosyayı medya dosyasıyla aynı dizine <aynı_ad>.xmp olarak kaydedin.
    """
    asset = _get_asset_checked(asset_id, current_user, db)
    markers = (
        db.query(Marker)
        .filter(Marker.asset_id == asset_id)
        .order_by(Marker.timestamp.asc().nullsfirst())
        .all()
    )
    from ..services.marker_service import generate_xmp
    xmp = generate_xmp(_markers_as_dicts(markers), asset.original_name)
    stem = Path(asset.original_name).stem
    return Response(
        content=xmp.encode("utf-8"),
        media_type="application/rdf+xml",
        headers={"Content-Disposition": f'attachment; filename="{stem}.xmp"'},
    )


@router.get("/asset/{asset_id}/export/fcpxml")
@limiter.limit("30/minute")
def export_fcpxml(
    request: Request,
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    FCPXML sidecar dosyasını indir — DaVinci Resolve ve Final Cut Pro için.
    Resolve'da: File → Import → Timeline veya File → Import → Markers
    """
    asset = _get_asset_checked(asset_id, current_user, db)
    markers = (
        db.query(Marker)
        .filter(Marker.asset_id == asset_id)
        .order_by(Marker.timestamp.asc().nullsfirst())
        .all()
    )
    from ..services.marker_service import generate_fcpxml
    fcpxml = generate_fcpxml(
        _markers_as_dicts(markers),
        asset.original_name,
        asset.file_path,
        asset.duration or 0.0,
    )
    stem = Path(asset.original_name).stem
    return Response(
        content=fcpxml.encode("utf-8"),
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{stem}.fcpxml"'},
    )
