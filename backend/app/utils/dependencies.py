from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import exists, select
from ..database import get_db
from ..models.user import User, UserRole
from ..models.project import Project, project_members
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
    Kullanıcının projeye sahip veya üye olup olmadığını kontrol eder.
    Proje yoksa 404, yetkisiz ise de 404 döner (enumeration saldırısını önler).

    PERFORMANCE: Üyelik kontrolü için Python'da döngü yerine EXISTS subquery
    kullanılır — büyük ekiplerde O(1) DB sorgusu, O(n) Python döngüsü değil.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    is_owner = project.owner_id == current_user.id
    is_admin = current_user.role == UserRole.admin

    if require_ownership:
        if not (is_owner or is_admin):
            raise HTTPException(status_code=404, detail="Project not found")
        return project

    if is_owner or is_admin:
        return project

    # PERFORMANCE FIX: Python döngüsü yerine DB'de EXISTS sorgusu
    # Eski kod: any(m.id == current_user.id for m in project.members)
    # → tüm üyeleri belleğe yüklüyordu, O(n) Python karşılaştırması
    # Yeni kod: tek satır SQL EXISTS — indeksli, O(log n)
    is_member = db.query(
        exists().where(
            (project_members.c.project_id == project_id) &
            (project_members.c.user_id == current_user.id)
        )
    ).scalar()

    if not is_member:
        raise HTTPException(status_code=404, detail="Project not found")

    return project
