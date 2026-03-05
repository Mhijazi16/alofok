import datetime
import uuid

from sqlalchemy import func as sa_func, select, union
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import AssignedDay, Customer
from app.models.transaction import Transaction, TransactionStatus, TransactionType


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

    async def get_by_day_and_rep(
        self,
        day: AssignedDay,
        rep_id: uuid.UUID,
        delivery_date: datetime.date | None = None,
    ) -> list[Customer]:
        # Customers assigned to this day
        assigned_ids = select(Customer.id).where(
            Customer.assigned_day == day,
            Customer.assigned_to == rep_id,
            Customer.is_deleted.is_(False),
        )

        if delivery_date is None:
            result = await self._db.execute(
                select(Customer)
                .where(Customer.id.in_(assigned_ids))
                .order_by(Customer.name)
            )
            return list(result.scalars().all())

        # Customers who have orders on this delivery date (for this rep)
        order_customer_ids = select(Transaction.customer_id).where(
            Transaction.delivery_date == delivery_date,
            Transaction.type == TransactionType.Order,
            Transaction.created_by == rep_id,
            Transaction.is_deleted.is_(False),
        )

        combined = union(assigned_ids, order_customer_ids).subquery()

        result = await self._db.execute(
            select(Customer)
            .where(
                Customer.id.in_(select(combined.c.id)),
                Customer.is_deleted.is_(False),
            )
            .order_by(Customer.name)
        )
        return list(result.scalars().all())

    async def get_all_by_rep(self, rep_id: uuid.UUID) -> list[Customer]:
        result = await self._db.execute(
            select(Customer)
            .where(
                Customer.assigned_to == rep_id,
                Customer.is_deleted.is_(False),
            )
            .order_by(Customer.name)
        )
        return list(result.scalars().all())

    async def get_all(self) -> list[Customer]:
        result = await self._db.execute(
            select(Customer)
            .where(Customer.is_deleted.is_(False))
            .order_by(Customer.name)
        )
        return list(result.scalars().all())

    async def create(self, data: dict) -> Customer:
        customer = Customer(**data)
        self._db.add(customer)
        await self._db.commit()
        await self._db.refresh(customer)
        return customer

    async def update(self, customer_id, data: dict) -> Customer | None:
        stmt = select(Customer).where(
            Customer.id == customer_id, Customer.is_deleted.is_(False)
        )
        result = await self._db.execute(stmt)
        customer = result.scalar_one_or_none()
        if not customer:
            return None
        for k, v in data.items():
            setattr(customer, k, v)
        await self._db.commit()
        await self._db.refresh(customer)
        return customer

    async def get_returned_checks_counts(
        self, customer_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, int]:
        """Return {customer_id: count} of returned Payment_Check transactions."""
        if not customer_ids:
            return {}
        result = await self._db.execute(
            select(
                Transaction.customer_id,
                sa_func.count().label("cnt"),
            )
            .where(
                Transaction.customer_id.in_(customer_ids),
                Transaction.type == TransactionType.Payment_Check,
                Transaction.status == TransactionStatus.Returned,
                Transaction.is_deleted.is_(False),
            )
            .group_by(Transaction.customer_id)
        )
        return {row.customer_id: row.cnt for row in result.all()}

    async def archive(self, customer_id: uuid.UUID) -> Customer | None:
        stmt = select(Customer).where(
            Customer.id == customer_id, Customer.is_deleted.is_(False)
        )
        result = await self._db.execute(stmt)
        customer = result.scalar_one_or_none()
        if not customer:
            return None
        customer.is_deleted = True
        await self._db.commit()
        await self._db.refresh(customer)
        return customer

    async def update_balance(self, customer: Customer) -> None:
        await self._db.flush()  # persist balance change within the current transaction
