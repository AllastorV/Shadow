from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from ..models.user import User, MAX_FAILED_LOGINS, LOCKOUT_MINUTES
from ..schemas.user import TokenData
from ..config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[TokenData]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return TokenData(user_id=int(user_id))
    except (JWTError, ValueError):
        return None


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """
    Kimlik doğrulama + brute-force koruması.
    Dönüş değerleri:
      • User      → başarılı
      • None      → geçersiz kimlik bilgileri (kullanıcı yok / şifre yanlış)
      • "locked"  → hesap geçici olarak kilitlendi
    """
    user = db.query(User).filter(User.email == email).first()

    # Kullanıcı yoksa zamanlama saldırısını önlemek için sahte doğrulama yap
    if not user:
        pwd_context.verify("dummy", "$2b$12$invalidhashpadding.......................invalid.hash....")
        return None

    now = datetime.now(timezone.utc)

    # Kilit kontrolü
    if user.locked_until:
        locked = (
            user.locked_until
            if user.locked_until.tzinfo
            else user.locked_until.replace(tzinfo=timezone.utc)
        )
        if now < locked:
            return "locked"  # type: ignore[return-value]
        # Kilit süresi geçti — sıfırla
        user.failed_login_count = 0
        user.locked_until = None

    if not verify_password(password, user.hashed_password):
        # Başarısız giriş sayacını artır
        user.failed_login_count = (user.failed_login_count or 0) + 1
        if user.failed_login_count >= MAX_FAILED_LOGINS:
            user.locked_until = now + timedelta(minutes=LOCKOUT_MINUTES)
            user.failed_login_count = 0
        db.commit()
        return None

    # Başarılı giriş — sayacı sıfırla
    if user.failed_login_count:
        user.failed_login_count = 0
        user.locked_until = None
        db.commit()

    return user
