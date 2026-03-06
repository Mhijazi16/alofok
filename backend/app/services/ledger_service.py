import uuid
from collections import defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import HorizonException
from app.models.ledger import CompanyLedger
from app.repositories.ledger_repository import LedgerRepository
from app.schemas.ledger import (
    DailyLedgerReportOut,
    LedgerEntryOut,
    RepLedgerGroup,
)


class LedgerService:
    def __init__(self, db: AsyncSession, ledger_repo: LedgerRepository):
        self._db = db
        self._repo = ledger_repo

    async def create_entry(
        self,
        direction: str,
        payment_method: str,
        amount: Decimal,
        rep_id: uuid.UUID,
        entry_date: date,
        customer_id: uuid.UUID | None = None,
        source_transaction_id: uuid.UUID | None = None,
        category: str | None = None,
        notes: str | None = None,
    ) -> CompanyLedger:
        entry = CompanyLedger(
            direction=direction,
            payment_method=payment_method,
            amount=abs(amount),
            rep_id=rep_id,
            customer_id=customer_id,
            source_transaction_id=source_transaction_id,
            category=category,
            notes=notes,
            date=entry_date,
            status="pending",
        )
        return await self._repo.create(entry)

    async def get_daily_report(self, report_date: date) -> DailyLedgerReportOut:
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

        incoming_map: dict[uuid.UUID, list[LedgerEntryOut]] = defaultdict(list)
        outgoing_map: dict[uuid.UUID, list[LedgerEntryOut]] = defaultdict(list)
        rep_names: dict[uuid.UUID, str] = {}

        for r in rows:
            rep_names[r.rep_id] = r.rep_name
            entry = LedgerEntryOut(
                id=r.id,
                direction=r.direction,
                payment_method=r.payment_method,
                amount=Decimal(str(r.amount)),
                category=r.category,
                notes=r.notes,
                rep_id=r.rep_id,
                rep_name=r.rep_name,
                customer_id=r.customer_id,
                customer_name=r.customer_name,
                source_transaction_id=r.source_transaction_id,
                status=r.status,
                confirmed_at=r.confirmed_at,
                flag_notes=r.flag_notes,
                date=r.date,
                created_at=r.created_at,
            )
            if r.direction == "incoming":
                incoming_map[r.rep_id].append(entry)
            else:
                outgoing_map[r.rep_id].append(entry)

        def build_groups(m: dict) -> list[RepLedgerGroup]:
            return [
                RepLedgerGroup(rep_id=rid, rep_name=rep_names[rid], entries=entries)
                for rid, entries in m.items()
            ]

        return DailyLedgerReportOut(
            report_date=report_date.isoformat(),
            incoming=build_groups(incoming_map),
            outgoing=build_groups(outgoing_map),
        )

    async def update_status(
        self,
        ids: list[uuid.UUID],
        status: str,
        confirmer_id: uuid.UUID,
        flag_notes: str | None = None,
    ) -> int:
        values: dict = {"status": status, "updated_at": datetime.now(timezone.utc)}

        if status == "confirmed":
            values["confirmed_at"] = datetime.now(timezone.utc)
            values["flag_notes"] = None
        elif status == "flagged":
            values["confirmed_at"] = None
            values["flag_notes"] = flag_notes
        else:  # pending
            values["confirmed_at"] = None
            values["flag_notes"] = None

        return await self._repo.bulk_update_status(ids, values)

    async def create_expense(
        self,
        rep_id: uuid.UUID,
        amount: Decimal,
        category: str,
        expense_date: date,
        notes: str | None = None,
        is_admin: bool = False,
    ) -> CompanyLedger:
        entry = CompanyLedger(
            direction="outgoing",
            payment_method="cash",
            amount=abs(amount),
            rep_id=rep_id,
            category=category,
            date=expense_date,
            notes=notes,
            status="confirmed" if is_admin else "pending",
        )
        return await self._repo.create(entry)

    async def get_rep_expenses(
        self, rep_id: uuid.UUID, expense_date: date
    ) -> list[LedgerEntryOut]:
        entries = await self._repo.get_by_rep_and_direction(
            rep_id, "outgoing", expense_date
        )
        return [
            LedgerEntryOut(
                id=e.id,
                direction=e.direction,
                payment_method=e.payment_method,
                amount=Decimal(str(e.amount)),
                category=e.category,
                notes=e.notes,
                rep_id=e.rep_id,
                rep_name=None,
                customer_id=e.customer_id,
                customer_name=None,
                source_transaction_id=e.source_transaction_id,
                status=e.status,
                confirmed_at=e.confirmed_at,
                flag_notes=e.flag_notes,
                date=e.date,
                created_at=e.created_at,
            )
            for e in entries
        ]

    async def delete_expense(self, expense_id: uuid.UUID, caller_id: uuid.UUID) -> None:
        entries = await self._repo.get_by_ids([expense_id])
        if not entries or entries[0].rep_id != caller_id:
            raise HorizonException(404, "Expense not found")
        entry = entries[0]
        if entry.status != "pending":
            raise HorizonException(400, "Only pending expenses can be deleted")
        if entry.direction != "outgoing" or entry.source_transaction_id is not None:
            raise HorizonException(400, "Not a manual expense")
        await self._repo.soft_delete(expense_id)
