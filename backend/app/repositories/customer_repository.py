import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import AssignedDay, Customer


class CustomerRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_by_id(self, customer_id: uuid.UUID) -> Customer | None:
        result = await self._db.execute(
            select(Customer).where(
                Customer.id == customer_id, Customer.is_deleted.is_(False)
            )
        )
        return result.scalar_one_or_none()

    async def get_by_day(self, day: AssignedDay) -> list[Customer]:
        result = await self._db.execute(
            select(Customer)
            .where(Customer.assigned_day == day, Customer.is_deleted.is_(False))
            .order_by(Customer.name)
        )
        return list(result.scalars().all())

    async def update_balance(self, customer: Customer) -> None:
        await self._db.flush()  # persist balance change within the current transaction
