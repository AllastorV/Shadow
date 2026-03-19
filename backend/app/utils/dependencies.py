from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User, UserRole
from ..models.project import Project
from ..services.auth import decode_token

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    token_data = decode_token(token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.id == token_data.user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user


def require_editor(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in (UserRole.admin, UserRole.editor):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Editor role or higher required",
        )
    return current_user


def get_accessible_project(
    project_id: int,
    current_user: User,
    db: Session,
    require_ownership: bool = False,
) -> Project:
    """
    Return project if the current user owns it or is a member.
    Raises 404 if project doesn't exist, 403 if not authorized.
    Using 404 even for 'found but no access' prevents enumeration attacks.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project.owner_id == current_user.id
    is_member = any(m.id == current_user.id for m in project.members)
    is_admin = current_user.role == UserRole.admin

    if require_ownership:
        if not (is_owner or is_admin):
            raise HTTPException(status_code=404, detail="Project not found")
    else:
        if not (is_owner or is_member or is_admin):
            raise HTTPException(status_code=404, detail="Project not found")

    return project
