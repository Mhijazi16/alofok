import uuid
from datetime import date

from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ledger import CompanyLedger


class LedgerRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def create(self, entry: CompanyLedger) -> CompanyLedger:
        self._db.add(entry)
        await self._db.commit()
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

    async def get_by_rep_and_direction(
        self, rep_id: uuid.UUID, direction: str, target_date: date
    ) -> list[CompanyLedger]:
        result = await self._db.execute(
            select(CompanyLedger)
            .where(
                CompanyLedger.rep_id == rep_id,
                CompanyLedger.direction == direction,
                CompanyLedger.date == target_date,
                CompanyLedger.is_deleted.is_(False),
                CompanyLedger.source_transaction_id.is_(None),
            )
            .order_by(CompanyLedger.created_at.desc())
        )
        return list(result.scalars().all())

    async def soft_delete(self, entry_id: uuid.UUID) -> bool:
        result = await self._db.execute(
            update(CompanyLedger)
            .where(
                CompanyLedger.id == entry_id,
                CompanyLedger.is_deleted.is_(False),
            )
            .values(is_deleted=True)
        )
        await self._db.commit()
        return result.rowcount > 0

    async def bulk_update_status(self, ids: list[uuid.UUID], values: dict) -> int:
        result = await self._db.execute(
            update(CompanyLedger)
            .where(CompanyLedger.id.in_(ids), CompanyLedger.is_deleted.is_(False))
            .values(**values)
        )
        await self._db.commit()
        return result.rowcount

    async def get_daily_report_rows(self, report_date: date) -> list[dict]:
        rows = await self._db.execute(
            text("""
                SELECT
                    cl.id, cl.direction, cl.payment_method, cl.amount,
                    cl.category, cl.notes, cl.rep_id, cl.customer_id,
                    cl.source_transaction_id, cl.status, cl.confirmed_at,
                    cl.flag_notes, cl.date, cl.created_at,
                    u.username AS rep_name,
                    c.name AS customer_name
                FROM company_ledger cl
                JOIN users u ON u.id = cl.rep_id
                LEFT JOIN customers c ON c.id = cl.customer_id
                WHERE cl.date = :report_date
                  AND cl.is_deleted = false
                ORDER BY u.username, cl.created_at ASC
            """),
            {"report_date": report_date},
        )
        return list(rows)
