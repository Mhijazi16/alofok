import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer_auth import CustomerAuth


class CustomerAuthRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_by_phone(self, phone: str) -> CustomerAuth | None:
        result = await self._db.execute(
            select(CustomerAuth).where(
                CustomerAuth.phone == phone,
                CustomerAuth.is_active.is_(True),
                CustomerAuth.is_deleted.is_(False),
            )
        )
        return result.scalar_one_or_none()

    async def get_by_customer_id(self, customer_id: uuid.UUID) -> CustomerAuth | None:
        result = await self._db.execute(
            select(CustomerAuth).where(
                CustomerAuth.customer_id == customer_id,
                CustomerAuth.is_deleted.is_(False),
            )
        )
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> CustomerAuth:
        auth = CustomerAuth(**data)
        self._db.add(auth)
        await self._db.commit()
        await self._db.refresh(auth)
        return auth
