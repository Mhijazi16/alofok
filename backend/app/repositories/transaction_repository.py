import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction, TransactionType


class TransactionRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_by_id(self, txn_id: uuid.UUID) -> Transaction | None:
        result = await self._db.execute(
            select(Transaction).where(
                Transaction.id == txn_id, Transaction.is_deleted.is_(False)
            )
        )
        return result.scalar_one_or_none()

    async def get_payments_for_customer(
        self, customer_id: uuid.UUID
    ) -> list[Transaction]:
        result = await self._db.execute(
            select(Transaction)
            .where(
                Transaction.customer_id == customer_id,
                Transaction.type.in_(
                    [TransactionType.Payment_Cash, TransactionType.Payment_Check]
                ),
                Transaction.is_deleted.is_(False),
            )
            .order_by(Transaction.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_for_customer(
        self,
        customer_id: uuid.UUID,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> list[Transaction]:
        query = (
            select(Transaction)
            .where(
                Transaction.customer_id == customer_id,
                Transaction.is_deleted.is_(False),
            )
            .order_by(Transaction.created_at.asc())
        )
        if start:
            query = query.where(Transaction.created_at >= start)
        if end:
            query = query.where(Transaction.created_at < end)

        result = await self._db.execute(query)
        return list(result.scalars().all())

    async def create(self, txn: Transaction) -> Transaction:
        self._db.add(txn)
        await self._db.commit()
        await self._db.refresh(txn)
        return txn

    async def create_many(self, txns: list[Transaction]) -> None:
        """Persist multiple transactions in a single commit."""
        for txn in txns:
            self._db.add(txn)
        await self._db.commit()
        for txn in txns:
            await self._db.refresh(txn)
