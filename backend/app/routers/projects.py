from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from slowapi import Limiter
from slowapi.util import get_remote_address
from ..database import get_db
from ..models.user import User, UserRole
from ..models.project import Project, project_members
from ..models.asset import Asset
from ..schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from ..utils.dependencies import get_current_user, require_editor, get_accessible_project

router = APIRouter(prefix="/projects", tags=["projects"])
limiter = Limiter(key_func=get_remote_address)


def _attach_asset_counts(projects: list[Project], db: Session) -> list[Project]:
    """Fix N+1: fetch all asset counts in a single query."""
    if not projects:
        return projects
    project_ids = [p.id for p in projects]
    counts = (
        db.query(Asset.project_id, func.count(Asset.id).label("cnt"))
        .filter(Asset.project_id.in_(project_ids))
        .group_by(Asset.project_id)
        .all()
    )
    count_map = {row.project_id: row.cnt for row in counts}
    for p in projects:
        p.asset_count = count_map.get(p.id, 0)
    return projects


@router.get("/", response_model=List[ProjectResponse])
@limiter.limit("60/minute")
def list_projects(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all projects the current user owns or is a member of."""
    if current_user.role == UserRole.admin:
        projects = db.query(Project).all()
    else:
        projects = (
            db.query(Project)
            .filter(
                (Project.owner_id == current_user.id)
                | Project.members.any(id=current_user.id)
            )
            .all()
        )
    return _attach_asset_counts(projects, db)


@router.post("/", response_model=ProjectResponse, status_code=201)
@limiter.limit("20/minute")
def create_project(
    request: Request,
    data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    project = Project(name=data.name, description=data.description, owner_id=current_user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    project.asset_count = 0
    return project


@router.get("/{project_id}", response_model=ProjectResponse)
@limiter.limit("60/minute")
def get_project(
    request: Request,
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = get_accessible_project(project_id, current_user, db)
    _attach_asset_counts([project], db)
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
@limiter.limit("30/minute")
def update_project(
    request: Request,
    project_id: int,
    data: ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    # require_ownership=True: only owner/admin can update
    project = get_accessible_project(project_id, current_user, db, require_ownership=True)

    update_data = data.model_dump(exclude_unset=True)
    # Only allow known safe fields to be updated
    ALLOWED_FIELDS = {"name", "description", "cover_image_url"}
    for field, value in update_data.items():
        if field in ALLOWED_FIELDS:
            setattr(project, field, value)

    db.commit()
    db.refresh(project)
    _attach_asset_counts([project], db)
    return project


@router.delete("/{project_id}", status_code=204)
@limiter.limit("10/minute")
def delete_project(
    request: Request,
    project_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    project = get_accessible_project(project_id, current_user, db, require_ownership=True)
    db.delete(project)
    db.commit()


@router.post("/{project_id}/members/{user_id}", status_code=204)
@limiter.limit("20/minute")
def add_member(
    request: Request,
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    """Add a member to a project (owner/admin only)."""
    project = get_accessible_project(project_id, current_user, db, require_ownership=True)
    new_member = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not new_member:
        raise HTTPException(status_code=404, detail="User not found")
    if any(m.id == user_id for m in project.members):
        raise HTTPException(status_code=400, detail="User is already a member")
    project.members.append(new_member)
    db.commit()


@router.delete("/{project_id}/members/{user_id}", status_code=204)
@limiter.limit("20/minute")
def remove_member(
    request: Request,
    project_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_editor),
):
    """Remove a member from a project (owner/admin only)."""
    project = get_accessible_project(project_id, current_user, db, require_ownership=True)
    project.members = [m for m in project.members if m.id != user_id]
    db.commit()
