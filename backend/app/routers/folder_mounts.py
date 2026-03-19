"""
Klasör Bağlama (Folder Mount) — sunucu dosya sistemindeki klasörleri projeye bağlar.
Bağlanan klasördeki dosyalar kopyalanmadan Asset olarak içe aktarılabilir.
"""
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.folder_mount import FolderMount
from ..models.asset import Asset, AssetType, AssetStatus
from ..models.project import Project
from ..models.user import User, UserRole
from ..utils.dependencies import get_current_user
from ..config import settings

router = APIRouter(prefix="/mounts", tags=["mounts"])

# ── Uzantıdan MIME + AssetType tablosu ───────────────────────────────────────

_EXT_MIME: dict[str, str] = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif",  ".webp": "image/webp",  ".avif": "image/avif",
    ".tif": "image/tiff", ".tiff": "image/tiff",
    ".raw": "image/x-raw",
    ".cr2": "image/x-canon-cr2",  ".cr3": "image/x-canon-cr3",
    ".nef": "image/x-nikon-nef",  ".nrw": "image/x-nikon-nef",
    ".arw": "image/x-sony-arw",   ".srf": "image/x-sony-arw",   ".sr2": "image/x-sony-arw",
    ".dng": "image/x-adobe-dng",
    ".orf": "image/x-olympus-orf",
    ".rw2": "image/x-panasonic-rw2",
    ".pef": "image/x-pentax-pef",
    ".raf": "image/x-fuji-raf",
    ".mp4": "video/mp4",  ".mov": "video/quicktime", ".avi": "video/avi",
    ".mkv": "video/x-matroska", ".webm": "video/webm",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",  ".flac": "audio/flac",
    ".pdf": "application/pdf",
}

_EXT_TYPE: dict[str, AssetType] = {
    ".jpg": AssetType.image, ".jpeg": AssetType.image, ".png": AssetType.image,
    ".gif": AssetType.image, ".webp": AssetType.image, ".avif": AssetType.image,
    ".tif": AssetType.image, ".tiff": AssetType.image,
    ".raw": AssetType.image, ".cr2": AssetType.image, ".cr3": AssetType.image,
    ".nef": AssetType.image, ".nrw": AssetType.image, ".arw": AssetType.image,
    ".srf": AssetType.image, ".sr2": AssetType.image, ".dng": AssetType.image,
    ".orf": AssetType.image, ".rw2": AssetType.image, ".pef": AssetType.image, ".raf": AssetType.image,
    ".mp4": AssetType.video,  ".mov": AssetType.video, ".avi": AssetType.video,
    ".mkv": AssetType.video,  ".webm": AssetType.video,
    ".mp3": AssetType.audio,  ".wav": AssetType.audio, ".ogg": AssetType.audio,
    ".m4a": AssetType.audio,  ".flac": AssetType.audio,
    ".pdf": AssetType.document,
}


# ── Yardımcılar ───────────────────────────────────────────────────────────────

def _get_mount_or_404(mount_id: int, db: Session) -> FolderMount:
    mount = db.query(FolderMount).filter(FolderMount.id == mount_id).first()
    if not mount:
        raise HTTPException(404, "Mount bulunamadı")
    return mount


def _assert_can_manage(project_id: int, user: User, db: Session) -> Project:
    """Proje sahibi veya admin olmasını zorunlu kılar."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Proje bulunamadı")
    if user.role != UserRole.admin and project.owner_id != user.id:
        raise HTTPException(403, "Bu işlem için proje sahibi veya admin yetkisi gerekiyor")
    return project


def _safe_subpath(mount: FolderMount, sub: str) -> Path:
    """sub'ı mount root'una göre çözer; path traversal saldırısını engeller."""
    root = Path(mount.path).resolve()
    target = (root / sub).resolve() if sub else root
    try:
        target.relative_to(root)
    except ValueError:
        raise HTTPException(400, "Geçersiz yol: mount dışına çıkma girişimi")
    return target


# ── Proje mount yönetimi ──────────────────────────────────────────────────────

@router.post("/projects/{project_id}")
def add_mount(
    project_id: int,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Projeye yeni bir klasör bağlantısı ekler."""
    _assert_can_manage(project_id, current_user, db)

    raw_path = (body.get("path") or "").strip()
    label    = (body.get("label") or "").strip() or raw_path

    if not raw_path:
        raise HTTPException(400, "Yol boş olamaz")

    folder = Path(raw_path).resolve()
    if not folder.exists():
        raise HTTPException(404, f"Klasör bulunamadı: {raw_path}")
    if not folder.is_dir():
        raise HTTPException(400, "Belirtilen yol bir klasör değil")

    mount = FolderMount(
        project_id=project_id,
        path=str(folder),
        label=label,
        created_by_id=current_user.id,
    )
    db.add(mount)
    db.commit()
    db.refresh(mount)
    return _mount_dict(mount)


@router.get("/projects/{project_id}")
def list_mounts(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    """Proje mountlarını listeler."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Proje bulunamadı")
    mounts = db.query(FolderMount).filter(FolderMount.project_id == project_id).all()
    return [_mount_dict(m) for m in mounts]


@router.delete("/projects/{project_id}/{mount_id}", status_code=204)
def delete_mount(
    project_id: int,
    mount_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Mount'u kaldırır (içe aktarılmış Asset kayıtlarına dokunmaz)."""
    _assert_can_manage(project_id, current_user, db)
    mount = db.query(FolderMount).filter(
        FolderMount.id == mount_id, FolderMount.project_id == project_id
    ).first()
    if not mount:
        raise HTTPException(404, "Mount bulunamadı")
    db.delete(mount)
    db.commit()


# ── Klasör tarama ─────────────────────────────────────────────────────────────

@router.get("/{mount_id}/browse")
def browse(
    mount_id: int,
    sub: str = Query("", description="Mount root'a göreli alt klasör yolu"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Bağlı klasörün içeriğini listeler."""
    mount  = _get_mount_or_404(mount_id, db)
    target = _safe_subpath(mount, sub)

    if not target.exists() or not target.is_dir():
        raise HTTPException(404, "Klasör bulunamadı")

    entries = []
    allowed = settings.ALLOWED_EXTENSIONS

    for entry in sorted(target.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower())):
        if entry.name.startswith("."):
            continue
        rel = str(entry.relative_to(Path(mount.path).resolve()))

        if entry.is_dir():
            entries.append({"name": entry.name, "type": "dir", "path": rel,
                            "size": None, "extension": None,
                            "modified": entry.stat().st_mtime})
        elif entry.is_file():
            ext = entry.suffix.lower()
            if ext not in allowed:
                continue
            st = entry.stat()
            entries.append({"name": entry.name, "type": "file", "path": rel,
                            "size": st.st_size, "extension": ext,
                            "modified": st.st_mtime})

    return {
        "mount_id":    mount_id,
        "mount_label": mount.label,
        "root_path":   mount.path,
        "current_sub": sub,
        "entries":     entries,
    }


# ── Dosya içe aktarma ─────────────────────────────────────────────────────────

@router.post("/{mount_id}/import")
def import_files(
    mount_id: int,
    body: dict[str, Any],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Seçilen dosyaları kopyalamadan Asset olarak içe aktarır.
    body = {"files": ["relative/path/video.mp4", ...]}
    """
    mount = _get_mount_or_404(mount_id, db)

    files: list[str] = body.get("files", [])
    if not files:
        raise HTTPException(400, "En az bir dosya seçin")
    if len(files) > 200:
        raise HTTPException(400, "Tek seferde en fazla 200 dosya aktarılabilir")

    allowed = settings.ALLOWED_EXTENSIONS
    created: list[Asset] = []

    for rel in files:
        try:
            abs_path = _safe_subpath(mount, rel)
        except HTTPException:
            continue

        if not abs_path.is_file():
            continue

        ext = abs_path.suffix.lower()
        if ext not in allowed:
            continue

        mime_type  = _EXT_MIME.get(ext, "application/octet-stream")
        asset_type = _EXT_TYPE.get(ext, AssetType.other)
        file_size  = abs_path.stat().st_size

        asset = Asset(
            filename=f"linked-{uuid.uuid4()}{ext}",
            original_name=abs_path.name[:255],
            file_path=str(abs_path),
            file_size=file_size,
            mime_type=mime_type,
            asset_type=asset_type,
            status=AssetStatus.pending,
            project_id=mount.project_id,
            uploader_id=current_user.id,
            storage_type="linked",
            linked_path=str(abs_path),
        )
        db.add(asset)
        created.append(asset)

    db.commit()
    for a in created:
        db.refresh(a)

    return {"imported": len(created), "asset_ids": [a.id for a in created]}


# ── Bağlı dosya sunma ─────────────────────────────────────────────────────────

@router.get("/stream/{asset_id}")
def stream_linked(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Bağlı (linked) bir asset'i orijinal konumundan sunar."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(404, "Asset bulunamadı")
    if asset.storage_type != "linked" or not asset.linked_path:
        raise HTTPException(400, "Bu asset bağlantılı değil")

    path = Path(asset.linked_path)
    if not path.is_file():
        raise HTTPException(404, f"Kaynak dosya bulunamadı: {asset.linked_path}")

    return FileResponse(
        str(path),
        media_type=asset.mime_type,
        filename=asset.original_name,
    )


# ── Yardımcı fonksiyonlar ─────────────────────────────────────────────────────

def _mount_dict(m: FolderMount) -> dict:
    return {
        "id":         m.id,
        "project_id": m.project_id,
        "path":       m.path,
        "label":      m.label,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }
