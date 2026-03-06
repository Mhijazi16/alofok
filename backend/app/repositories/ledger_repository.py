import uuid
from datetime import date

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ledger import CompanyLedger


class LedgerRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def create(self, entry: CompanyLedger) -> CompanyLedger:
        self._db.add(entry)
        await self._db.flush()
        await self._db.refresh(entry)
        return entry

    async def get_by_date(self, report_date: date) -> list[CompanyLedger]:
        result = await self._db.execute(
            select(CompanyLedger)
            .where(
                CompanyLedger.date == report_date,
                CompanyLedger.is_deleted.is_(False),
            )
            .order_by(CompanyLedger.created_at.asc())
        )
        return list(result.scalars().all())

    async def get_by_ids(self, ids: list[uuid.UUID]) -> list[CompanyLedger]:
        result = await self._db.execute(
            select(CompanyLedger).where(
                CompanyLedger.id.in_(ids),
                CompanyLedger.is_deleted.is_(False),
            )
        )
        return list(result.scalars().all())

    async def bulk_update_status(
        self, ids: list[uuid.UUID], values: dict
    ) -> int:
        result = await self._db.execute(
            update(CompanyLedger)
            .where(CompanyLedger.id.in_(ids), CompanyLedger.is_deleted.is_(False))
            .values(**values)
        )
        await self._db.commit()
        return result.rowcount
