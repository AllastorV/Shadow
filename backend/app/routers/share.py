import logging
import os
import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from pydantic import BaseModel, field_validator
from ..config import settings
from ..database import get_db
from ..models.asset import Asset
from ..models.comment import Comment
from ..models.marker import Marker, MarkerColor
from ..models.share_link import ShareLink, SharePermission
from ..models.user import User, UserRole
from ..schemas.share_link import ShareLinkCreate, ShareLinkResponse
from ..utils.dependencies import get_current_user, require_editor, get_accessible_project


# ── Misafir istek şemaları ────────────────────────────────────────────────────

class GuestCommentCreate(BaseModel):
    guest_name: str = "Misafir"
    content: str
    timestamp: Optional[float] = None

    @field_validator("guest_name")
    @classmethod
    def name_ok(cls, v: str) -> str:
        return v.strip()[:100] or "Misafir"

    @field_validator("content")
    @classmethod
    def content_ok(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Boş yorum gönderilemez")
        return v[:2000]

    @field_validator("timestamp")
    @classmethod
    def ts_ok(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Negatif zaman damgası")
        return v


class GuestMarkerCreate(BaseModel):
    guest_name: str = "Misafir"
    label: str
    note: Optional[str] = None
    color: str = "red"
    timestamp: Optional[float] = None

    @field_validator("guest_name")
    @classmethod
    def name_ok(cls, v: str) -> str:
        return v.strip()[:100] or "Misafir"

    @field_validator("label")
    @classmethod
    def label_ok(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Etiket boş olamaz")
        return v[:255]

    @field_validator("timestamp")
    @classmethod
    def ts_ok(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Negatif zaman damgası")
        return v


# ── Yardımcı: sistem misafir kullanıcısı ──────────────────────────────────────

def _get_guest_user(db: Session) -> User:
    return db.query(User).filter(User.email == "_guest@shadow.internal").first()

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/share", tags=["share"])
limiter = Limiter(key_func=get_remote_address)


# ── Yardımcı ──────────────────────────────────────────────────────────────────

def _check_share_link_owner(link: ShareLink, current_user: User) -> None:
    """Sadece link sahibi veya admin yönetebilir."""
    if link.created_by_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=404, detail="Share link not found")


def _validate_token_format(token: str) -> None:
    """Token formatını doğrula — enjeksiyon saldırılarını engelle."""
    if not token or len(token) > 64:
        raise HTTPException(status_code=404, detail="Invalid token")
    # URL-safe base64: yalnızca harf, rakam, -, _
    allowed = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
    if not all(c in allowed for c in token):
        raise HTTPException(status_code=404, detail="Invalid token")


def _resolve_and_validate_link(
    token: str,
    db: Session,
    password: Optional[str] = None,
) -> tuple[ShareLink, Asset]:
    """
    Token'ı doğrula, aktiflik/süre/parola kontrolü yap.
    Başarılıysa (link, asset) döndür.
    SECURITY: Tüm hata mesajları jenerik — token/parola varlığını sızdırmaz.
    """
    _validate_token_format(token)

    link = db.query(ShareLink).filter(
        ShareLink.token == token,
        ShareLink.is_active == True,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found or inactive")

    # Süre kontrolü
    if link.expires_at:
        now = datetime.now(timezone.utc)
        exp = (
            link.expires_at.replace(tzinfo=timezone.utc)
            if link.expires_at.tzinfo is None
            else link.expires_at
        )
        if now > exp:
            raise HTTPException(status_code=410, detail="Share link has expired")

    # Parola kontrolü
    if link.password_hash:
        if not password:
            raise HTTPException(status_code=401, detail="Password required")
        from ..services.auth import verify_password
        if not verify_password(password, link.password_hash):
            raise HTTPException(status_code=401, detail="Authentication failed")

    asset = link.asset
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    return link, asset


def _log_activity(link: ShareLink, action: str, request: Request, db: Session) -> None:
    """IP hash ile aktivite kaydı — ham IP saklanmaz (gizlilik)."""
    import hashlib
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]
    entry = {
        "action": action,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ip_hash": ip_hash,
    }
    log = list(link.activity_log or [])
    if len(log) < 1000:  # Sınırsız büyümeyi önle
        log.append(entry)
    link.activity_log = log


# ── Paylaşım linki oluştur ────────────────────────────────────────────────────

@router.post("/asset/{asset_id}", response_model=ShareLinkResponse, status_code=201)
@limiter.limit("20/minute")
def create_share_link(
    request: Request,
    asset_id: int,
    data: ShareLinkCreate,
    label: Optional[str] = Query(None, max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    # SECURITY: Projeye erişim doğrula
    get_accessible_project(asset.project_id, current_user, db)

    password_hash = None
    if data.password:
        from ..services.auth import hash_password
        password_hash = hash_password(data.password)

    link = ShareLink(
        token=secrets.token_urlsafe(32),  # 256-bit entropi
        label=label,
        permission=data.permission,
        expires_at=data.expires_at,
        password_hash=password_hash,
        asset_id=asset_id,
        project_id=asset.project_id,
        created_by_id=current_user.id,
        activity_log=[],
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


# ── Asset'in paylaşım linklerini listele ─────────────────────────────────────

@router.get("/asset/{asset_id}", response_model=List[ShareLinkResponse])
@limiter.limit("60/minute")
def list_share_links(
    request: Request,
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    get_accessible_project(asset.project_id, current_user, db)

    query = db.query(ShareLink).filter(ShareLink.asset_id == asset_id)
    if current_user.role != UserRole.admin:
        query = query.filter(ShareLink.created_by_id == current_user.id)

    return query.order_by(ShareLink.created_at.desc()).all()


# ── Paylaşılan asset meta verisi ─────────────────────────────────────────────

@router.get("/view/{token}")
@limiter.limit("20/minute")
def view_shared_asset(
    request: Request,
    token: str,
    password: Optional[str] = Query(None, max_length=128),
    db: Session = Depends(get_db),
):
    """
    Herkese açık — token + isteğe bağlı parola ile erişim.
    Kimlik doğrulama gerektirmez.
    """
    link, asset = _resolve_and_validate_link(token, db, password)

    # Aktivite kaydet + görüntülenme sayacı
    _log_activity(link, "viewed", request, db)
    link.view_count = (link.view_count or 0) + 1
    db.commit()

    # Parola parametresini dosya URL'lerine ekle
    pw_suffix = f"?password={password}" if password else ""

    return {
        "asset": {
            "id": asset.id,
            "name": asset.original_name,
            "type": asset.asset_type,
            "mime_type": asset.mime_type,
            "file_size": asset.file_size,
            "width": asset.width,
            "height": asset.height,
            "duration": asset.duration,
            # AI metadata
            "ai_description": asset.ai_description,
            "ai_tags": asset.ai_tags or [],
            "ai_colors": asset.ai_colors or [],
            "ai_scene_type": asset.ai_scene_type,
            # Sinema metadata
            "shot_scale": asset.shot_scale,
            "camera_angle": asset.camera_angle,
            "camera_movement": asset.camera_movement,
            "lighting_type": asset.lighting_type,
            "color_tone": asset.color_tone,
            "composition_tags": asset.composition_tags or [],
            "subject_tags": asset.subject_tags or [],
            "mood_tags": asset.mood_tags or [],
        },
        "permission": link.permission,
        "label": link.label,
        "has_password": bool(link.password_hash),
        "expires_at": link.expires_at.isoformat() if link.expires_at else None,
        # Dosya URL'leri — token ile güvenli erişim
        "file_url": f"/api/v1/share/file/{token}{pw_suffix}",
        "download_url": f"/api/v1/share/file/{token}?dl=1{('&password=' + password) if password else ''}",
    }


# ── Token tabanlı dosya sunumu ────────────────────────────────────────────────

@router.get("/file/{token}")
@limiter.limit("60/minute")
async def serve_shared_file(
    request: Request,
    token: str,
    password: Optional[str] = Query(None, max_length=128),
    dl: int = Query(0),  # 1 = indirme (Content-Disposition: attachment)
    db: Session = Depends(get_db),
):
    """
    Token tabanlı dosya sunumu — kimlik doğrulama gerektirmez.
    Görsel önizleme (inline) ve dosya indirme (dl=1) için kullanılır.

    SECURITY:
    - Token formatı doğrulandı
    - Aktiflik/süre/parola kontrolü
    - Path traversal koruması (uploads dizini dışına çıkamaz)
    - İndirme sayacı güncelleniyor
    """
    link, asset = _resolve_and_validate_link(token, db, password)

    # PATH TRAVERSAL KORUMASI
    upload_dir = Path(settings.UPLOAD_DIR).resolve()
    file_path = Path(asset.file_path).resolve()
    if not str(file_path).startswith(str(upload_dir)):
        logger.error(
            f"Path traversal attempt! token={token[:8]}... path={asset.file_path}"
        )
        raise HTTPException(status_code=403, detail="Access denied")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    # İndirme izni kontrolü
    if dl and link.permission not in (SharePermission.download,):
        raise HTTPException(status_code=403, detail="Download not permitted for this link")

    # Aktivite ve sayaç
    action = "downloaded" if dl else "file_viewed"
    _log_activity(link, action, request, db)
    if dl:
        link.download_count = (link.download_count or 0) + 1
    db.commit()

    disposition = "attachment" if dl else "inline"
    # Dosya adını RFC 5987 uyumlu kodla
    safe_name = asset.original_name.encode("ascii", "ignore").decode()

    return FileResponse(
        str(file_path),
        media_type=asset.mime_type,
        headers={
            "Content-Disposition": f'{disposition}; filename="{safe_name}"',
            # Cache: 5 dakika (token geçerli olduğu sürece)
            "Cache-Control": "private, max-age=300",
        },
    )


# ── Link iptal et ─────────────────────────────────────────────────────────────

@router.patch("/{link_id}/revoke", response_model=ShareLinkResponse)
@limiter.limit("20/minute")
def revoke_share_link(
    request: Request,
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    link = db.query(ShareLink).filter(ShareLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    _check_share_link_owner(link, current_user)

    link.is_active = False
    db.commit()
    db.refresh(link)
    return link


# ── Aktivite logu ─────────────────────────────────────────────────────────────

@router.get("/{link_id}/activity")
@limiter.limit("30/minute")
def get_link_activity(
    request: Request,
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = db.query(ShareLink).filter(ShareLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    _check_share_link_owner(link, current_user)

    return {
        "link_id": link_id,
        "label": link.label,
        "is_active": link.is_active,
        "permission": link.permission,
        "view_count": link.view_count,
        "download_count": link.download_count,
        "expires_at": link.expires_at,
        "activity_log": link.activity_log or [],
    }


# ── Misafir yorum & marker endpointleri ───────────────────────────────────────
# Giriş gerektirmez — token ile erişim, izin kontrolü yapılır.

@router.get("/guest/{token}/comments")
@limiter.limit("60/minute")
def guest_list_comments(
    request: Request,
    token: str,
    password: Optional[str] = Query(None, max_length=128),
    db: Session = Depends(get_db),
):
    """Asset'e ait tüm yorumları listele (misafir)."""
    link, asset = _resolve_and_validate_link(token, db, password)
    comments = (
        db.query(Comment)
        .filter(Comment.asset_id == asset.id, Comment.parent_id == None)
        .order_by(Comment.created_at.asc())
        .limit(200)
        .all()
    )
    return [
        {
            "id":         c.id,
            "content":    c.content,
            "timestamp":  c.timestamp,
            "guest_name": c.guest_name or (c.author.full_name if c.author else "Kullanıcı"),
            "is_resolved": c.is_resolved,
            "created_at": c.created_at.isoformat(),
        }
        for c in comments
    ]


@router.post("/guest/{token}/comments", status_code=201)
@limiter.limit("20/minute")
def guest_add_comment(
    request: Request,
    token: str,
    data: GuestCommentCreate,
    password: Optional[str] = Query(None, max_length=128),
    db: Session = Depends(get_db),
):
    """Misafir yorum ekle. İzin: comment veya edit."""
    link, asset = _resolve_and_validate_link(token, db, password)

    if link.permission not in (SharePermission.comment, SharePermission.edit):
        raise HTTPException(status_code=403, detail="Bu link yorum eklemeye izin vermiyor")

    guest = _get_guest_user(db)
    if not guest:
        raise HTTPException(status_code=500, detail="Misafir kullanıcı bulunamadı")

    comment = Comment(
        content=data.content,
        timestamp=data.timestamp,
        asset_id=asset.id,
        author_id=guest.id,
        guest_name=data.guest_name,
    )
    db.add(comment)
    _log_activity(link, "guest_comment", request, db)
    db.commit()
    db.refresh(comment)

    return {
        "id":         comment.id,
        "content":    comment.content,
        "timestamp":  comment.timestamp,
        "guest_name": comment.guest_name,
        "is_resolved": comment.is_resolved,
        "created_at": comment.created_at.isoformat(),
    }


@router.get("/guest/{token}/markers")
@limiter.limit("60/minute")
def guest_list_markers(
    request: Request,
    token: str,
    password: Optional[str] = Query(None, max_length=128),
    db: Session = Depends(get_db),
):
    """Asset'e ait tüm markerları listele (misafir)."""
    link, asset = _resolve_and_validate_link(token, db, password)
    markers = (
        db.query(Marker)
        .filter(Marker.asset_id == asset.id)
        .order_by(Marker.timestamp.asc().nullsfirst(), Marker.created_at.asc())
        .all()
    )
    return [
        {
            "id":         m.id,
            "label":      m.label,
            "note":       m.note,
            "color":      m.color if isinstance(m.color, str) else m.color.value,
            "timestamp":  m.timestamp,
            "x_pos":      m.x_pos,
            "y_pos":      m.y_pos,
            "guest_name": m.guest_name or (m.created_by.full_name if m.created_by else "Kullanıcı"),
            "created_at": m.created_at.isoformat(),
        }
        for m in markers
    ]


@router.post("/guest/{token}/markers", status_code=201)
@limiter.limit("30/minute")
def guest_add_marker(
    request: Request,
    token: str,
    data: GuestMarkerCreate,
    password: Optional[str] = Query(None, max_length=128),
    db: Session = Depends(get_db),
):
    """Misafir marker ekle. İzin: edit."""
    link, asset = _resolve_and_validate_link(token, db, password)

    if link.permission != SharePermission.edit:
        raise HTTPException(status_code=403, detail="Bu link marker eklemeye izin vermiyor")

    guest = _get_guest_user(db)
    if not guest:
        raise HTTPException(status_code=500, detail="Misafir kullanıcı bulunamadı")

    try:
        color_enum = MarkerColor(data.color)
    except ValueError:
        color_enum = MarkerColor.red

    marker = Marker(
        label=data.label,
        note=(data.note or "").strip() or None,
        color=color_enum,
        timestamp=data.timestamp,
        asset_id=asset.id,
        created_by_id=guest.id,
        guest_name=data.guest_name,
    )
    db.add(marker)
    _log_activity(link, "guest_marker", request, db)
    db.commit()
    db.refresh(marker)

    return {
        "id":         marker.id,
        "label":      marker.label,
        "note":       marker.note,
        "color":      marker.color if isinstance(marker.color, str) else marker.color.value,
        "timestamp":  marker.timestamp,
        "guest_name": marker.guest_name,
        "created_at": marker.created_at.isoformat(),
    }
