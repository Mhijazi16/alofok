from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(
    subject: str,
    role: str,
    user_type: str = "staff",
    customer_id: str | None = None,
) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload: dict = {
        "sub": subject,
        "role": role,
        "user_type": user_type,
        "exp": expire,
    }
    if customer_id:
        payload["customer_id"] = customer_id
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Returns the decoded payload or raises JWTError."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
