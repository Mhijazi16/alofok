import uuid

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.core.errors import HorizonException
from app.core.security import create_access_token, verify_password
from app.models.user import User
from app.schemas.user import TokenOut, UserOut

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login", response_model=TokenOut)
async def login(body: LoginRequest, db: DbSession) -> TokenOut:
    result = await db.execute(
        select(User).where(
            User.username == body.username,
            User.is_active.is_(True),
            User.is_deleted.is_(False),
        )
    )
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.password_hash):
        raise HorizonException(401, "Invalid credentials")

    token = create_access_token(subject=str(user.id), role=user.role.value)
    return TokenOut(access_token=token)


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser, db: DbSession) -> UserOut:
    user_id = uuid.UUID(current_user["sub"])
    result = await db.execute(
        select(User).where(User.id == user_id, User.is_deleted.is_(False))
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HorizonException(404, "User not found")

    return UserOut.model_validate(user)
