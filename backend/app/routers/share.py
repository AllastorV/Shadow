import logging
import secrets
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from ..database import get_db
from ..models.user import User, UserRole
from ..models.share_link import ShareLink, SharePermission
from ..models.asset import Asset
from ..schemas.share_link import ShareLinkCreate, ShareLinkResponse
from ..utils.dependencies import get_current_user, require_editor, get_accessible_project

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/share", tags=["share"])
limiter = Limiter(key_func=get_remote_address)


def _check_share_link_owner(link: ShareLink, current_user: User) -> None:
    """Ensure only the link creator or admin can manage this link."""
    if link.created_by_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=404, detail="Share link not found")


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
    # SECURITY: Verify user has access to the project
    get_accessible_project(asset.project_id, current_user, db)

    password_hash = None
    if data.password:
        from ..services.auth import hash_password
        password_hash = hash_password(data.password)

    link = ShareLink(
        token=secrets.token_urlsafe(32),  # 32 bytes = 256-bit entropy
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
    # SECURITY: Verify user can access the project
    get_accessible_project(asset.project_id, current_user, db)

    # Regular users only see their own links; admins see all
    query = db.query(ShareLink).filter(ShareLink.asset_id == asset_id)
    if current_user.role != UserRole.admin:
        query = query.filter(ShareLink.created_by_id == current_user.id)

    return query.all()


@router.get("/view/{token}")
@limiter.limit("30/minute")
def view_shared_asset(
    request: Request,
    token: str,
    password: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """
    Public endpoint to view a shared asset.
    No authentication required — access controlled by token + optional password.
    """
    # SECURITY: Validate token format to prevent injection
    if not token or len(token) > 64 or not token.replace("-", "").replace("_", "").isalnum():
        raise HTTPException(status_code=404, detail="Invalid token")

    link = db.query(ShareLink).filter(
        ShareLink.token == token,
        ShareLink.is_active == True,
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found or inactive")

    # SECURITY: Check expiry
    if link.expires_at:
        now = datetime.now(timezone.utc)
        exp = link.expires_at.replace(tzinfo=timezone.utc) if link.expires_at.tzinfo is None else link.expires_at
        if now > exp:
            raise HTTPException(status_code=410, detail="Share link has expired")

    # SECURITY: Password check
    if link.password_hash:
        if not password:
            raise HTTPException(status_code=401, detail="Password required")
        from ..services.auth import verify_password
        if not verify_password(password, link.password_hash):
            # Generic error — don't indicate whether password is wrong vs not provided
            raise HTTPException(status_code=401, detail="Invalid password")

    # Log activity (store IP hash, not raw IP for privacy)
    import hashlib
    client_ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]

    activity_entry = {
        "action": "viewed",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ip_hash": ip_hash,
    }
    log = link.activity_log or []
    # Cap log at 1000 entries to prevent unbounded growth
    if len(log) < 1000:
        log.append(activity_entry)
    link.activity_log = log
    link.view_count = (link.view_count or 0) + 1
    db.commit()

    asset = link.asset
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

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
    # SECURITY: Only the link creator or an admin can revoke
    _check_share_link_owner(link, current_user)

    link.is_active = False
    db.commit()
    db.refresh(link)
    return link


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
    # SECURITY: Only the creator or admin can view activity
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
