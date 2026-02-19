from typing import Annotated

from fastapi import Depends, Header
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.errors import HorizonException
from app.core.security import decode_access_token
from app.utils.cache import CacheBackend, get_cache

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


DbSession = Annotated[AsyncSession, Depends(get_db)]

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

Cache = Annotated[CacheBackend, Depends(get_cache)]

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


async def get_current_user(authorization: str = Header(...)) -> dict:
    """
    Extracts and validates the Bearer token from the Authorization header.
    Returns the decoded payload: {"sub": user_id, "role": role}.
    """
    if not authorization.startswith("Bearer "):
        raise HorizonException(401, "Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise HorizonException(401, "Invalid or expired token")
    return payload


CurrentUser = Annotated[dict, Depends(get_current_user)]


def _require_role(*roles: str):
    async def guard(user: CurrentUser) -> dict:
        if user.get("role") not in roles:
            raise HorizonException(403, "Insufficient permissions")
        return user

    return guard


require_admin = Depends(_require_role("Admin"))
require_designer = Depends(_require_role("Designer", "Admin"))
require_sales = Depends(_require_role("Sales", "Admin"))
