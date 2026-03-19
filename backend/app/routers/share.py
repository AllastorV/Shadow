import secrets
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..models.share_link import ShareLink, SharePermission
from ..models.asset import Asset
from ..schemas.share_link import ShareLinkCreate, ShareLinkResponse
from ..utils.dependencies import get_current_user, require_editor

router = APIRouter(prefix="/share", tags=["share"])


@router.post("/asset/{asset_id}", response_model=ShareLinkResponse, status_code=201)
def create_share_link(
    asset_id: int,
    data: ShareLinkCreate,
    label: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    password_hash = None
    if data.password:
        from ..services.auth import hash_password
        password_hash = hash_password(data.password)

    link = ShareLink(
        token=secrets.token_urlsafe(24),
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


@router.get("/asset/{asset_id}", response_model=List[ShareLinkResponse])
def list_share_links(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    links = db.query(ShareLink).filter(ShareLink.asset_id == asset_id).all()
    return links


@router.get("/view/{token}")
def view_shared_asset(
    token: str,
    password: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Public endpoint to view a shared asset."""
    link = db.query(ShareLink).filter(ShareLink.token == token, ShareLink.is_active == True).first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found or inactive")

    if link.expires_at and link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Share link has expired")

    if link.password_hash:
        if not password:
            raise HTTPException(status_code=401, detail="Password required")
        from ..services.auth import verify_password
        if not verify_password(password, link.password_hash):
            raise HTTPException(status_code=401, detail="Invalid password")

    # Log activity
    activity_entry = {
        "action": "viewed",
        "timestamp": datetime.utcnow().isoformat(),
        "ip": "anonymous",
    }
    log = link.activity_log or []
    log.append(activity_entry)
    link.activity_log = log
    link.view_count += 1
    db.commit()

    asset = link.asset
    return {
        "asset": {
            "id": asset.id,
            "name": asset.original_name,
            "type": asset.asset_type,
            "mime_type": asset.mime_type,
            "ai_description": asset.ai_description,
            "ai_tags": asset.ai_tags,
        },
        "permission": link.permission,
        "label": link.label,
    }


@router.patch("/{link_id}/revoke", response_model=ShareLinkResponse)
def revoke_share_link(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    link = db.query(ShareLink).filter(ShareLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    link.is_active = False
    db.commit()
    db.refresh(link)
    return link


@router.get("/{link_id}/activity")
def get_link_activity(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    link = db.query(ShareLink).filter(ShareLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")
    return {
        "link_id": link_id,
        "view_count": link.view_count,
        "download_count": link.download_count,
        "activity_log": link.activity_log or [],
    }
