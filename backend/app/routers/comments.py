from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from ..database import get_db
from ..models.user import User
from ..models.comment import Comment
from ..models.asset import Asset
from ..schemas.comment import CommentCreate, CommentResponse
from ..utils.dependencies import get_current_user

router = APIRouter(prefix="/comments", tags=["comments"])


@router.get("/asset/{asset_id}", response_model=List[CommentResponse])
def get_asset_comments(
    asset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comments = (
        db.query(Comment)
        .filter(Comment.asset_id == asset_id, Comment.parent_id == None)
        .order_by(Comment.created_at.asc())
        .all()
    )
    return comments


@router.post("/asset/{asset_id}", response_model=CommentResponse, status_code=201)
def add_comment(
    asset_id: int,
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    asset = db.query(Asset).filter(Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    comment = Comment(
        content=data.content,
        timestamp=data.timestamp,
        x_pos=data.x_pos,
        y_pos=data.y_pos,
        parent_id=data.parent_id,
        asset_id=asset_id,
        author_id=current_user.id,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return comment


@router.patch("/{comment_id}/resolve", response_model=CommentResponse)
def resolve_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment.is_resolved = not comment.is_resolved
    db.commit()
    db.refresh(comment)
    return comment


@router.delete("/{comment_id}", status_code=204)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(Comment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete your own comments")
    db.delete(comment)
    db.commit()
