import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole


class UserRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_by_username(self, username: str) -> User | None:
        result = await self._db.execute(
            select(User).where(
                User.username == username,
                User.is_active.is_(True),
                User.is_deleted.is_(False),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self._db.execute(
            select(User).where(User.id == user_id, User.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def get_sales_reps(self) -> list[User]:
        result = await self._db.execute(
            select(User).where(
                User.role == UserRole.Sales, User.is_active.is_(True), User.is_deleted.is_(False)
            )
        )
        return list(result.scalars().all())
