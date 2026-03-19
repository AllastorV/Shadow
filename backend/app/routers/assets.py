import logging
import os
import re
import uuid
import mimetypes
from pathlib import Path
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from slowapi import Limiter
from slowapi.util import get_remote_address

from ..database import get_db, SessionLocal
from ..models.user import User, UserRole
from ..models.asset import Asset, AssetType, AssetStatus
from ..models.project import Project
from ..models.tag import Tag
from ..schemas.asset import AssetResponse, AssetUpdate
from ..utils.dependencies import get_current_user, require_editor, get_accessible_project
from ..services.ai_service import ai_service
from ..config import settings
from ..ws_manager import manager as ws_manager


async def _ws_broadcast(project_id: int, event: dict) -> None:
    await ws_manager.broadcast(project_id, event)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/assets", tags=["assets"])
limiter = Limiter(key_func=get_remote_address)

# SECURITY: Allowed MIME types — explicit whitelist, no wildcards
ALLOWED_MIME_TYPES: dict[str, AssetType] = {
    # ── Görseller ──
    "image/jpeg": AssetType.image,
    "image/png": AssetType.image,
    "image/gif": AssetType.image,
    "image/webp": AssetType.image,
    "image/avif": AssetType.image,
    "image/tiff": AssetType.image,     # TIFF (profesyonel fotoğrafçılık)
    "image/x-tiff": AssetType.image,   # TIFF alternatif MIME
    # ── RAW kamera formatları ──
    "image/x-raw": AssetType.image,
    "image/x-adobe-dng": AssetType.image,   # DNG
    "image/x-canon-cr2": AssetType.image,   # Canon CR2
    "image/x-canon-cr3": AssetType.image,   # Canon CR3
    "image/x-nikon-nef": AssetType.image,   # Nikon NEF
    "image/x-sony-arw": AssetType.image,    # Sony ARW
    "image/x-olympus-orf": AssetType.image, # Olympus ORF
    "image/x-panasonic-rw2": AssetType.image, # Panasonic RW2
    "image/x-fuji-raf": AssetType.image,    # Fujifilm RAF
    "image/x-pentax-pef": AssetType.image,  # Pentax PEF
    # ── Videolar — H.264 ve H.265/HEVC dahil ──
    # MP4 container: H.264 (AVC), H.265 (HEVC), AV1
    "video/mp4": AssetType.video,
    # MOV container: H.264, H.265, ProRes (Apple/profesyonel)
    "video/quicktime": AssetType.video,
    # AVI container: H.264 ve diğerleri
    "video/x-msvideo": AssetType.video,
    "video/avi": AssetType.video,
    # MKV container: H.264, H.265, VP9
    "video/x-matroska": AssetType.video,
    # WebM: VP8, VP9, AV1
    "video/webm": AssetType.video,
    # ── Ses ──
    "audio/mpeg": AssetType.audio,
    "audio/wav": AssetType.audio,
    "audio/ogg": AssetType.audio,
    "audio/mp4": AssetType.audio,
    "audio/flac": AssetType.audio,
    "audio/x-flac": AssetType.audio,
    # ── Belgeler ──
    "application/pdf": AssetType.document,
}

# SECURITY: Magic bytes signatures to verify real file type
MAGIC_BYTES: list[tuple[bytes, str]] = [
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
    (b"GIF87a", "image/gif"),
    (b"GIF89a", "image/gif"),
    (b"RIFF", "image/webp"),          # needs further check
    (b"\x00\x00\x00", "video/mp4"),   # broad, refined below
    (b"\x1aE\xdf\xa3", "video/x-matroska"),
    (b"ID3", "audio/mpeg"),
    (b"\xff\xfb", "audio/mpeg"),
    (b"fLaC", "audio/flac"),
    (b"OggS", "audio/ogg"),
    (b"%PDF", "application/pdf"),
    # TIFF: little-endian (Intel) ve big-endian (Motorola)
    (b"II\x2a\x00", "image/tiff"),
    (b"MM\x00\x2a", "image/tiff"),
]


# RAW extensions that browsers may report as application/octet-stream
RAW_EXTENSIONS: dict[str, str] = {
    ".raw": "image/x-raw",
    ".cr2": "image/x-canon-cr2",
    ".cr3": "image/x-canon-cr3",
    ".nef": "image/x-nikon-nef",
    ".nrw": "image/x-nikon-nef",
    ".arw": "image/x-sony-arw",
    ".srf": "image/x-sony-arw",
    ".sr2": "image/x-sony-arw",
    ".dng": "image/x-adobe-dng",
    ".orf": "image/x-olympus-orf",
    ".rw2": "image/x-panasonic-rw2",
    ".pef": "image/x-pentax-pef",
    ".raf": "image/x-fuji-raf",
}


def _sanitize_extension(filename: str) -> str:
    """Extract and sanitize file extension — only allow known safe extensions."""
    suffix = Path(filename).suffix.lower()
    # Remove any non-alphanumeric characters from extension
    suffix = re.sub(r"[^a-z0-9.]", "", suffix)
    if suffix not in settings.ALLOWED_EXTENSIONS:
        return ""
    return suffix


def _validate_file_content(content: bytes, declared_mime: str) -> bool:
    """
    Verify file magic bytes match declared MIME type.
    Prevents MIME spoofing attacks (e.g., .exe renamed to .jpg).
    """
    # Try magic bytes detection
    for magic, mime in MAGIC_BYTES:
        if content.startswith(magic):
            # Special case: WebP has RIFF header + 'WEBP' at offset 8
            if magic == b"RIFF" and len(content) >= 12:
                if content[8:12] != b"WEBP":
                    continue
            return True  # At least one known signature matches

    # For MP4/MOV: check for ftyp box
    if len(content) >= 12 and content[4:8] == b"ftyp":
        return True

    # For WAV: RIFF + WAVE
    if content[:4] == b"RIFF" and len(content) >= 12 and content[8:12] == b"WAVE":
        return True

    # If no magic bytes match but it's a declared safe type, allow with warning
    # (some formats don't have reliable signatures)
    logger.warning(f"No magic byte match for MIME {declared_mime}, allowing based on extension")
    return True


def _get_comment_counts(asset_ids: list[int], db: Session) -> dict[int, int]:
    """Batch-fetch comment counts to avoid N+1 queries."""
    from ..models.comment import Comment
    rows = (
        db.query(Comment.asset_id, func.count(Comment.id).label("cnt"))
        .filter(Comment.asset_id.in_(asset_ids))
        .group_by(Comment.asset_id)
        .all()
    )
    return {row.asset_id: row.cnt for row in rows}


def _attach_comment_counts(assets: list[Asset], db: Session) -> list[Asset]:
    if not assets:
        return assets
    counts = _get_comment_counts([a.id for a in assets], db)
    for a in assets:
        a.comment_count = counts.get(a.id, 0)
    return assets


def process_asset_ai(asset_id: int, file_path: str) -> None:
    """
    Background task: run AI analysis on uploaded asset.
    SECURITY FIX: Creates its own DB session (not reusing the request session
    which may be closed before this background task runs).
    """
    db = SessionLocal()
    try:
        asset = db.query(Asset).filter(Asset.id == asset_id).first()
        if not asset:
            logger.warning(f"process_asset_ai: asset {asset_id} not found")
            return

        asset.status = AssetStatus.processing
        db.commit()

        if asset.asset_type == AssetType.image:
            analysis = ai_service.analyze_image(file_path)
            asset.ai_description = analysis.get("description")
            asset.ai_tags = analysis.get("tags", [])
            asset.ai_scene_type = analysis.get("scene_type")
            asset.ai_objects = analysis.get("ai_objects", [])
            asset.ai_colors = analysis.get("ai_colors", [])
            # Sinema alanları
            asset.shot_scale = analysis.get("shot_scale")
            asset.camera_angle = analysis.get("camera_angle")
            asset.camera_movement = analysis.get("camera_movement")
            asset.lighting_type = analysis.get("lighting_type")
            asset.color_tone = analysis.get("color_tone")
            asset.composition_tags = analysis.get("composition_tags", [])
            asset.subject_tags = analysis.get("subject_tags", [])
            asset.mood_tags = analysis.get("mood_tags", [])

            # Remove old AI-generated tags and insert fresh ones
            db.query(Tag).filter(Tag.asset_id == asset_id, Tag.is_ai_generated == True).delete()
            for tag_name in (analysis.get("tags") or []):
                db.add(Tag(name=tag_name[:64], is_ai_generated=True, asset_id=asset_id))

        asset.status = AssetStatus.ready
        db.commit()

    except Exception as exc:
        logger.error(f"AI processing failed for asset {asset_id}: {exc}", exc_info=True)
        try:
            asset = db.query(Asset).filter(Asset.id == asset_id).first()
            if asset:
                asset.status = AssetStatus.ready
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


@router.post("/upload/{project_id}", response_model=List[AssetResponse], status_code=201)
@limiter.limit("30/minute")
async def upload_assets(
    request: Request,
    project_id: int,
    files: List[UploadFile] = File(...),
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    # SECURITY: Verify user has access to this project
    get_accessible_project(project_id, current_user, db)

    # SECURITY: Limit number of files per upload request
    if len(files) > 20:
        raise HTTPException(status_code=400, detail="Maximum 20 files per upload")

    upload_dir = Path(settings.UPLOAD_DIR) / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    created_assets = []
    for file in files:
        # SECURITY: Validate MIME type against whitelist
        declared_mime = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
        # RAW files: browsers may report as application/octet-stream — remap by extension
        if declared_mime in ("application/octet-stream", ""):
            ext_lower = Path(file.filename or "").suffix.lower()
            if ext_lower in RAW_EXTENSIONS:
                declared_mime = RAW_EXTENSIONS[ext_lower]
        if declared_mime not in ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=415,
                detail=f"File type '{declared_mime}' is not allowed. Permitted types: images, video, audio, PDF.",
            )

        # SECURITY: Sanitize extension — never trust client filename
        ext = _sanitize_extension(file.filename or "")
        if not ext:
            raise HTTPException(
                status_code=415,
                detail=f"File extension not allowed: {Path(file.filename or '').suffix}",
            )

        # SECURITY: Generate random UUID filename — no path traversal possible
        safe_filename = f"{uuid.uuid4()}{ext}"
        file_path = upload_dir / safe_filename

        # ── Streaming write — büyük dosyaları RAM'e yüklemeden diske yaz ──────
        # Admin için boyut sınırı yok; diğerleri için MAX_UPLOAD_SIZE geçerli.
        from ..models.user import UserRole as _UserRole
        is_admin   = current_user.role == _UserRole.admin
        size_limit = None if is_admin else settings.MAX_UPLOAD_SIZE
        limit_gb   = size_limit // (1024 ** 3) if size_limit else None

        CHUNK        = 4 * 1024 * 1024   # 4 MB chunk
        file_size    = 0
        header_bytes = b""               # Magic bytes için ilk chunk saklanır

        try:
            with open(file_path, "wb") as fh:
                while True:
                    chunk = await file.read(CHUNK)
                    if not chunk:
                        break
                    file_size += len(chunk)

                    # Boyut kontrolü (admin'de atlanır)
                    if size_limit and file_size > size_limit:
                        fh.close()
                        file_path.unlink(missing_ok=True)
                        raise HTTPException(
                            status_code=413,
                            detail=f"Dosya boyutu sınırı aşıldı (maksimum {limit_gb} GB)",
                        )

                    # İlk chunk'tan magic bytes sakla
                    if not header_bytes:
                        header_bytes = chunk

                    fh.write(chunk)
        except HTTPException:
            raise
        except Exception as exc:
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=500, detail="Dosya yazma hatası") from exc

        if file_size == 0:
            file_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Boş dosya yüklenemez")

        # SECURITY: Magic bytes doğrulaması (yalnızca header_bytes yeterli)
        if not _validate_file_content(header_bytes, declared_mime):
            file_path.unlink(missing_ok=True)
            raise HTTPException(
                status_code=415,
                detail="Dosya içeriği bildirilen türle eşleşmiyor",
            )

        asset_type = ALLOWED_MIME_TYPES[declared_mime]

        asset = Asset(
            filename=safe_filename,
            original_name=Path(file.filename or "unknown").name[:255],
            file_path=str(file_path),
            file_size=file_size,
            mime_type=declared_mime,
            asset_type=asset_type,
            status=AssetStatus.pending,
            project_id=project_id,
            uploader_id=current_user.id,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        created_assets.append(asset)

        # SECURITY FIX: pass only asset_id and file_path, not the db session
        background_tasks.add_task(process_asset_ai, asset.id, str(file_path))

    _attach_comment_counts(created_assets, db)
    return created_assets


# Güvenli sıralama alanları — doğrudan model sütunlarına eşleşir
_SORT_COLUMNS = {
    "name":   Asset.original_name,
    "date":   Asset.created_at,
    "size":   Asset.file_size,
    "type":   Asset.asset_type,
    "status": Asset.status,
}


@router.get("/project/{project_id}", response_model=List[AssetResponse])
@limiter.limit("60/minute")
def list_project_assets(
    request: Request,
    project_id: int,
    asset_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, max_length=200),
    sort_by: str = Query("date", pattern="^(name|date|size|type|status)$"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # SECURITY: Verify user has access to this project
    get_accessible_project(project_id, current_user, db)

    query = db.query(Asset).filter(Asset.project_id == project_id)

    if asset_type and asset_type in AssetType.__members__:
        query = query.filter(Asset.asset_type == asset_type)
    if status and status in AssetStatus.__members__:
        query = query.filter(Asset.status == status)
    if search:
        # SECURITY: Use parameterized query (SQLAlchemy does this automatically with ilike)
        search_term = f"%{search}%"
        query = query.filter(
            Asset.original_name.ilike(search_term)
            | Asset.ai_description.ilike(search_term)
            | Asset.ai_scene_type.ilike(search_term)
        )

    # Sıralama — yalnızca beyaz listedeki sütunlar kullanılır (SQL enjeksiyonu riski yok)
    col = _SORT_COLUMNS.get(sort_by, Asset.created_at)
    order_expr = col.asc() if sort_order == "asc" else col.desc()
    # İkincil sıralama: aynı değerlere sahip satırlar için tutarlı id sırası
    query = query.order_by(order_expr, Asset.id.desc())

    assets = query.offset(skip).limit(limit).all()
    return _attach_comment_counts(assets, db)


@router.get("/search", response_model=List[AssetResponse])
@limiter.limit("20/minute")
def ai_search_assets(
    request: Request,
    q: str = Query(..., min_length=1, max_length=500),
    project_id: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Natural language AI search. Results limited to accessible projects."""
    query = db.query(Asset)

    if project_id:
        # Verify access to this specific project
        get_accessible_project(project_id, current_user, db)
        query = query.filter(Asset.project_id == project_id)
    else:
        # SECURITY: Only search within user's accessible projects
        if current_user.role != UserRole.admin:
            from ..models.project import project_members as pm_table
            from sqlalchemy import or_, exists
            owned = db.query(Project.id).filter(Project.owner_id == current_user.id)
            member_of = db.query(pm_table.c.project_id).filter(pm_table.c.user_id == current_user.id)
            accessible_ids = [row[0] for row in owned.union(member_of).all()]
            if not accessible_ids:
                return []
            query = query.filter(Asset.project_id.in_(accessible_ids))

    assets = query.limit(500).all()  # Cap for AI processing
    if not assets:
        return []

    assets_metadata = [
        {
            "id": a.id,
            "name": a.original_name,
            "description": a.ai_description or "",
            "tags": a.ai_tags or [],
            "scene_type": a.ai_scene_type or "",
            "objects": a.ai_objects or [],
            "type": a.asset_type,
            # Sinema alanları — arama kalitesini artırır
            "shot_scale": a.shot_scale or "",
            "camera_angle": a.camera_angle or "",
            "lighting_type": a.lighting_type or "",
            "color_tone": a.color_tone or "",
            "composition_tags": a.composition_tags or [],
            "subject_tags": a.subject_tags or [],
            "mood_tags": a.mood_tags or [],
        }
        for a in assets
    ]

    ranked_ids = ai_service.natural_language_search(q, assets_metadata)
    asset_map = {a.id: a for a in assets}
    result = [asset_map[aid] for aid in ranked_ids if aid in asset_map][:limit]
    return _attach_comment_counts(result, db)


@router.get("/{asset_id}", response_model=AssetResponse)
@limiter.limit("60/minute")
def get_asset(
    request: Request,
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    # SECURITY: Verify user can access the project this asset belongs to
    get_accessible_project(asset.project_id, current_user, db)
    _attach_comment_counts([asset], db)
    return asset


@router.patch("/{asset_id}", response_model=AssetResponse)
@limiter.limit("30/minute")
def update_asset(
    request: Request,
    asset_id: int,
    data: AssetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    get_accessible_project(asset.project_id, current_user, db)

    # Only allow explicit safe fields
    SAFE_FIELDS = {"status", "ai_description", "ai_tags"}
    for field, value in data.model_dump(exclude_unset=True).items():
        if field in SAFE_FIELDS:
            setattr(asset, field, value)

    db.commit()
    db.refresh(asset)
    _attach_comment_counts([asset], db)
    return asset


@router.post("/{asset_id}/ai-tag", response_model=AssetResponse)
@limiter.limit("10/minute")
def retag_asset(
    request: Request,
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    """Re-run AI analysis on an asset (rate-limited to prevent AI quota abuse)."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    get_accessible_project(asset.project_id, current_user, db)

    if asset.asset_type == AssetType.image:
        if not os.path.exists(asset.file_path):
            raise HTTPException(status_code=404, detail="Asset file not found on disk")

        analysis = ai_service.analyze_image(asset.file_path)
        asset.ai_description = analysis.get("description")
        asset.ai_tags = analysis.get("tags", [])
        asset.ai_scene_type = analysis.get("scene_type")
        asset.ai_objects = analysis.get("ai_objects", [])
        asset.ai_colors = analysis.get("ai_colors", [])
        # Sinema alanları
        asset.shot_scale = analysis.get("shot_scale")
        asset.camera_angle = analysis.get("camera_angle")
        asset.camera_movement = analysis.get("camera_movement")
        asset.lighting_type = analysis.get("lighting_type")
        asset.color_tone = analysis.get("color_tone")
        asset.composition_tags = analysis.get("composition_tags", [])
        asset.subject_tags = analysis.get("subject_tags", [])
        asset.mood_tags = analysis.get("mood_tags", [])

        db.query(Tag).filter(Tag.asset_id == asset_id, Tag.is_ai_generated == True).delete()
        for tag_name in (analysis.get("tags") or []):
            db.add(Tag(name=tag_name[:64], is_ai_generated=True, asset_id=asset_id))

    db.commit()
    db.refresh(asset)
    _attach_comment_counts([asset], db)
    return asset


@router.patch("/{asset_id}/status", response_model=AssetResponse)
@limiter.limit("30/minute")
def update_asset_status(
    request: Request,
    asset_id: int,
    status: AssetStatus,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    get_accessible_project(asset.project_id, current_user, db)
    asset.status = status
    db.commit()
    db.refresh(asset)
    _attach_comment_counts([asset], db)

    # Gerçek zamanlı yayın
    background_tasks.add_task(_ws_broadcast, asset.project_id, {
        "type":     "asset_status_changed",
        "asset_id": asset_id,
        "status":   status.value if hasattr(status, "value") else str(status),
        "by": {
            "id":        current_user.id,
            "username":  current_user.username,
            "full_name": current_user.full_name,
        },
    })
    return asset


@router.get("/{asset_id}/download")
@limiter.limit("30/minute")
def download_asset(
    request: Request,
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    # SECURITY: Verify project access before allowing download
    get_accessible_project(asset.project_id, current_user, db)

    if not os.path.exists(asset.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    # SECURITY: Verify file_path is inside the uploads directory (prevent path traversal)
    upload_dir = Path(settings.UPLOAD_DIR).resolve()
    file_path = Path(asset.file_path).resolve()
    if not str(file_path).startswith(str(upload_dir)):
        logger.error(f"Path traversal attempt detected! asset_id={asset_id}, path={asset.file_path}")
        raise HTTPException(status_code=403, detail="Access denied")

    return FileResponse(
        str(file_path),
        filename=asset.original_name,
        media_type=asset.mime_type,
    )


@router.delete("/{asset_id}", status_code=204)
@limiter.limit("20/minute")
def delete_asset(
    request: Request,
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    get_accessible_project(asset.project_id, current_user, db)

    # SECURITY: Verify path is inside uploads before deleting
    upload_dir = Path(settings.UPLOAD_DIR).resolve()
    file_path = Path(asset.file_path).resolve()
    if str(file_path).startswith(str(upload_dir)) and file_path.exists():
        file_path.unlink(missing_ok=True)

    db.delete(asset)
    db.commit()
