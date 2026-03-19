import os
import uuid
import mimetypes
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..models.asset import Asset, AssetType, AssetStatus
from ..models.project import Project
from ..models.tag import Tag
from ..schemas.asset import AssetResponse, AssetUpdate
from ..utils.dependencies import get_current_user, require_editor
from ..services.ai_service import ai_service
from ..config import settings

router = APIRouter(prefix="/assets", tags=["assets"])

MIME_TO_TYPE = {
    "image/": AssetType.image,
    "video/": AssetType.video,
    "audio/": AssetType.audio,
    "application/pdf": AssetType.document,
    "text/": AssetType.document,
}


def get_asset_type(mime_type: str) -> AssetType:
    for prefix, asset_type in MIME_TO_TYPE.items():
        if mime_type.startswith(prefix):
            return asset_type
    return AssetType.other


def process_asset_ai(asset_id: int, file_path: str, db: Session):
    """Background task: run AI analysis on uploaded asset."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        return

    asset.status = AssetStatus.processing
    db.commit()

    try:
        if asset.asset_type == AssetType.image:
            analysis = ai_service.analyze_image(file_path)
            asset.ai_description = analysis.get("description")
            asset.ai_tags = analysis.get("tags", [])
            asset.ai_scene_type = analysis.get("scene_type")
            asset.ai_objects = analysis.get("objects", [])
            asset.ai_colors = analysis.get("colors", [])

            # Save tags to Tag table
            for tag_name in (analysis.get("tags") or []):
                tag = Tag(name=tag_name, is_ai_generated=True, asset_id=asset_id)
                db.add(tag)

        asset.status = AssetStatus.ready
    except Exception as e:
        print(f"AI processing error for asset {asset_id}: {e}")
        asset.status = AssetStatus.ready

    db.commit()


@router.post("/upload/{project_id}", response_model=List[AssetResponse], status_code=201)
async def upload_assets(
    project_id: int,
    files: List[UploadFile] = File(...),
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    upload_dir = Path(settings.UPLOAD_DIR) / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    created_assets = []
    for file in files:
        ext = Path(file.filename).suffix
        filename = f"{uuid.uuid4()}{ext}"
        file_path = upload_dir / filename

        content = await file.read()
        if len(content) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(status_code=413, detail=f"File {file.filename} too large")

        with open(file_path, "wb") as f:
            f.write(content)

        mime_type = file.content_type or mimetypes.guess_type(file.filename)[0] or "application/octet-stream"
        asset_type = get_asset_type(mime_type)

        asset = Asset(
            filename=filename,
            original_name=file.filename,
            file_path=str(file_path),
            file_size=len(content),
            mime_type=mime_type,
            asset_type=asset_type,
            status=AssetStatus.pending,
            project_id=project_id,
            uploader_id=current_user.id,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        created_assets.append(asset)

        background_tasks.add_task(process_asset_ai, asset.id, str(file_path), db)

    for a in created_assets:
        a.comment_count = len(a.comments)
    return created_assets


@router.get("/project/{project_id}", response_model=List[AssetResponse])
def list_project_assets(
    project_id: int,
    asset_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Asset).filter(Asset.project_id == project_id)

    if asset_type:
        query = query.filter(Asset.asset_type == asset_type)
    if status:
        query = query.filter(Asset.status == status)
    if search:
        query = query.filter(
            Asset.original_name.ilike(f"%{search}%") |
            Asset.ai_description.ilike(f"%{search}%") |
            Asset.ai_scene_type.ilike(f"%{search}%")
        )

    assets = query.order_by(Asset.created_at.desc()).all()
    for a in assets:
        a.comment_count = len(a.comments)
    return assets


@router.get("/search", response_model=List[AssetResponse])
def ai_search_assets(
    q: str = Query(..., min_length=1),
    project_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Natural language AI search across all accessible assets."""
    query = db.query(Asset)
    if project_id:
        query = query.filter(Asset.project_id == project_id)

    assets = query.all()
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
        }
        for a in assets
    ]

    ranked_ids = ai_service.natural_language_search(q, assets_metadata)
    asset_map = {a.id: a for a in assets}
    result = [asset_map[aid] for aid in ranked_ids if aid in asset_map]

    for a in result:
        a.comment_count = len(a.comments)
    return result


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    asset.comment_count = len(asset.comments)
    return asset


@router.patch("/{asset_id}", response_model=AssetResponse)
def update_asset(
    asset_id: int,
    data: AssetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    db.commit()
    db.refresh(asset)
    asset.comment_count = len(asset.comments)
    return asset


@router.post("/{asset_id}/ai-tag", response_model=AssetResponse)
def retag_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    """Re-run AI analysis on an asset."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if asset.asset_type == AssetType.image:
        analysis = ai_service.analyze_image(asset.file_path)
        asset.ai_description = analysis.get("description")
        asset.ai_tags = analysis.get("tags", [])
        asset.ai_scene_type = analysis.get("scene_type")
        asset.ai_objects = analysis.get("objects", [])
        asset.ai_colors = analysis.get("colors", [])

        # Remove old AI tags and add new ones
        db.query(Tag).filter(Tag.asset_id == asset_id, Tag.is_ai_generated == True).delete()
        for tag_name in (analysis.get("tags") or []):
            db.add(Tag(name=tag_name, is_ai_generated=True, asset_id=asset_id))

    db.commit()
    db.refresh(asset)
    asset.comment_count = len(asset.comments)
    return asset


@router.patch("/{asset_id}/status", response_model=AssetResponse)
def update_asset_status(
    asset_id: int,
    status: AssetStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    asset.status = status
    db.commit()
    db.refresh(asset)
    asset.comment_count = len(asset.comments)
    return asset


@router.get("/{asset_id}/download")
def download_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    if not os.path.exists(asset.file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    return FileResponse(asset.file_path, filename=asset.original_name, media_type=asset.mime_type)


@router.delete("/{asset_id}", status_code=204)
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    if os.path.exists(asset.file_path):
        os.remove(asset.file_path)

    db.delete(asset)
    db.commit()
