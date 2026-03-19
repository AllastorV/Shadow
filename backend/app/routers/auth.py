from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address
from ..database import get_db
from ..models.user import User, UserRole
from ..schemas.user import UserCreate, UserResponse, Token, UserRoleUpdate
from ..services.auth import hash_password, authenticate_user, create_access_token
from ..utils.dependencies import get_current_user, require_admin

router = APIRouter(prefix="/auth", tags=["auth"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/register", response_model=UserResponse, status_code=201)
@limiter.limit("10/minute")
def register(request: Request, user_data: UserCreate, db: Session = Depends(get_db)):
    """Register a new user. All users start as 'editor' — role cannot be set by client."""
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == user_data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        email=user_data.email,
        username=user_data.username,
        full_name=user_data.full_name,
        hashed_password=hash_password(user_data.password),
        # SECURITY: role is always forced to editor on registration.
        # Never trust the client-supplied role.
        role=UserRole.editor,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
@limiter.limit("20/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Login with email and password. Rate-limited to prevent brute force."""
    result = authenticate_user(db, form_data.username, form_data.password)

    if result == "locked":
        from ..models.user import LOCKOUT_MINUTES
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Hesap geçici olarak kilitlendi. {LOCKOUT_MINUTES} dakika sonra tekrar deneyin.",
        )

    if not result:
        # Generic message — don't reveal whether email exists
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Geçersiz kimlik bilgileri",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = result
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Hesap devre dışı bırakıldı")

    token = create_access_token({"sub": str(user.id)})
    from fastapi.responses import JSONResponse
    from ..schemas.user import UserResponse
    content = {
        "access_token": token,
        "token_type":   "bearer",
        "user":         UserResponse.model_validate(user).model_dump(mode="json"),
    }
    response = JSONResponse(content=content)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return response


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    request: Request,
    user_id: int,
    data: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Admin-only: update a user's role."""
    import logging
    audit_log = logging.getLogger("shadow.audit")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = user.role
    user.role = data.role
    db.commit()
    db.refresh(user)

    # Denetim kaydı — kimin, neyi, ne zaman değiştirdiğini takip et
    audit_log.info(
        "ROLE_CHANGE admin=%s(%d) target=%s(%d) %s→%s ip=%s",
        current_user.username, current_user.id,
        user.username, user.id,
        old_role.value, data.role.value,
        request.client.host if request.client else "unknown",
    )

    return user
