import logging
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from slowapi import Limiter
from slowapi.util import get_remote_address
from ..database import get_db
from ..models.user import User, UserRole
from ..models.comment import Comment
from ..models.asset import Asset
from ..schemas.comment import CommentCreate, CommentResponse
from ..utils.dependencies import get_current_user, get_accessible_project
from ..ws_manager import manager as ws_manager


async def _ws_broadcast(project_id: int, event: dict) -> None:
    await ws_manager.broadcast(project_id, event)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/comments", tags=["comments"])
limiter = Limiter(key_func=get_remote_address)


def _get_asset_and_check_access(asset_id: int, current_user: User, db: Session) -> Asset:
    """Fetch asset and verify user has project access."""
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    get_accessible_project(asset.project_id, current_user, db)
    return asset


@router.get("/asset/{asset_id}", response_model=List[CommentResponse])
@limiter.limit("60/minute")
def get_asset_comments(
    request: Request,
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # SECURITY: Verify user can access the project this asset belongs to
    _get_asset_and_check_access(asset_id, current_user, db)

    comments = (
        db.query(Comment)
        .filter(Comment.asset_id == asset_id, Comment.parent_id == None)
        .order_by(Comment.created_at.asc())
        .limit(500)  # Sınırsız büyümeyi önle — 500'den fazla yorum nadir
        .all()
    )
    return comments


@router.post("/asset/{asset_id}", response_model=CommentResponse, status_code=201)
@limiter.limit("30/minute")
def add_comment(
    request: Request,
    asset_id: int,
    data: CommentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # SECURITY: Verify user can access the project this asset belongs to
    asset = _get_asset_and_check_access(asset_id, current_user, db)

    comment = Comment(
        content=data.content[:2000],  # Cap comment length
        timestamp=data.timestamp,
        x_pos=max(0.0, min(100.0, data.x_pos)) if data.x_pos is not None else None,
        y_pos=max(0.0, min(100.0, data.y_pos)) if data.y_pos is not None else None,
        parent_id=data.parent_id,
        asset_id=asset_id,
        author_id=current_user.id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    # Gerçek zamanlı yayın
    background_tasks.add_task(_ws_broadcast, asset.project_id, {
        "type":     "comment_created",
        "asset_id": asset_id,
        "by": {
            "id":        current_user.id,
            "username":  current_user.username,
            "full_name": current_user.full_name,
        },
    })
    return comment


@router.patch("/{comment_id}/resolve", response_model=CommentResponse)
@limiter.limit("30/minute")
def resolve_comment(
    request: Request,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    # SECURITY: Only author or project owner/admin can resolve a comment
    asset = db.query(Asset).filter(Asset.id == comment.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    from ..models.project import Project
    project = db.query(Project).filter(Project.id == asset.project_id).first()
    is_author = comment.author_id == current_user.id
    is_project_owner = project and project.owner_id == current_user.id
    is_admin = current_user.role == UserRole.admin

    if not (is_author or is_project_owner or is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to resolve this comment")

    comment.is_resolved = not comment.is_resolved
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/{comment_id}", status_code=204)
@limiter.limit("20/minute")
def delete_comment(
    request: Request,
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    # SECURITY: Only author or admin can delete
    if comment.author_id != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Can only delete your own comments")

    db.delete(comment)
    db.commit()
