import csv
import io
import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from app.models.customer import AssignedDay, Customer
from app.models.transaction import TransactionStatus
from app.repositories.admin_repository import AdminRepository
from app.repositories.user_repository import UserRepository
from app.schemas.admin import (
    AdminOrderOut,
    CheckOut,
    CityDebtOut,
    DailyBreakdownItem,
    DailyBreakdownOut,
    DayExpenseCategory,
    DayPaymentRow,
    DaySummaryOut,
    DebtStatsOut,
    ImportResult,
    OverdueCheckOut,
    SalesRepStatsOut,
    SalesStatsOut,
)
from app.utils.slack import send_eod_alert


class AdminService:
    def __init__(self, admin_repo: AdminRepository, user_repo: UserRepository) -> None:
        self._repo = admin_repo
        self._user_repo = user_repo

    # ── Sales stats ─────────────────────────────────────────────────────────

    async def get_sales_stats(self, start_date: date, end_date: date) -> SalesStatsOut:
        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)

        rows = await self._repo.get_sales_stats(start_dt, end_dt)

        reps = [
            SalesRepStatsOut(
                user_id=r["user_id"],
                username=r["username"],
                total_orders=r["total_orders"],
                order_count=r["order_count"],
                total_collected=r["total_collected"],
                collection_count=r["collection_count"],
            )
            for r in rows
        ]

        grand_orders = sum(r.total_orders for r in reps) or Decimal(0)
        grand_collected = sum(r.total_collected for r in reps) or Decimal(0)

        return SalesStatsOut(
            period_start=start_date.isoformat(),
            period_end=end_date.isoformat(),
            reps=reps,
            grand_total_orders=grand_orders,
            grand_total_collected=grand_collected,
        )

    # ── Debt stats ───────────────────────────────────────────────────────────

    async def get_debt_stats(self) -> DebtStatsOut:
        city_rows = await self._repo.get_debt_by_city()
        by_city = [
            CityDebtOut(
                city=r["city"],
                total_debt=r["total_debt"],
                customer_count=r["customer_count"],
            )
            for r in city_rows
        ]

        total_debt = await self._repo.get_total_debt()

        today = date.today().isoformat()
        overdue_rows = await self._repo.get_overdue_checks(today)
        overdue = [
            OverdueCheckOut(
                transaction_id=r["transaction_id"],
                customer_name=r["customer_name"],
                amount=r["amount"],
                currency=r["currency"],
                bank=r["bank"],
                due_date=r["due_date"],
            )
            for r in overdue_rows
        ]

        return DebtStatsOut(
            total_debt=total_debt,
            by_city=by_city,
            overdue_checks=overdue,
        )

    # ── EOD report ───────────────────────────────────────────────────────────

    async def trigger_eod_report(self, report_date: date | None = None) -> dict:
        target = report_date or date.today()
        start_dt = datetime.combine(target, time.min)
        end_dt = datetime.combine(target, time.max)

        summary = await self._repo.get_eod_summary(start_dt, end_dt)
        await send_eod_alert(target, summary)
        return {"date": target.isoformat(), "rows": len(summary)}

    # ── Check list ───────────────────────────────────────────────────────────

    async def get_all_checks(
        self, status: TransactionStatus | None = None
    ) -> list[CheckOut]:
        rows = await self._repo.get_all_checks(status)
        return [
            CheckOut(
                id=row.Transaction.id,
                customer_id=row.Transaction.customer_id,
                customer_name=row.customer_name,
                type=row.Transaction.type,
                currency=row.Transaction.currency,
                amount=row.Transaction.amount,
                status=row.Transaction.status,
                notes=row.Transaction.notes,
                data=row.Transaction.data,
                created_at=row.Transaction.created_at,
                related_transaction_id=row.Transaction.related_transaction_id,
            )
            for row in rows
        ]

    # ── Orders (admin oversight of all reps' orders) ─────────────────────────

    async def get_orders(
        self,
        start_date: date | None = None,
        end_date: date | None = None,
        rep_id: uuid.UUID | None = None,
        customer_id: uuid.UUID | None = None,
        limit: int | None = None,
    ) -> list[AdminOrderOut]:
        start = datetime.combine(start_date, time.min) if start_date else None
        # end is exclusive in the repo, so use the start of the day after end_date
        end = (
            datetime.combine(end_date + timedelta(days=1), time.min)
            if end_date
            else None
        )
        rows = await self._repo.get_all_orders(start, end, rep_id, customer_id)
        if limit is not None:
            rows = rows[:limit]
        return [
            AdminOrderOut(
                id=row.Transaction.id,
                customer_id=row.Transaction.customer_id,
                customer_name=row.customer_name,
                rep_id=row.Transaction.created_by,
                rep_name=row.rep_name,
                type=row.Transaction.type,
                currency=row.Transaction.currency,
                amount=row.Transaction.amount,
                status=row.Transaction.status,
                notes=row.Transaction.notes,
                created_at=row.Transaction.created_at,
                delivery_date=row.Transaction.delivery_date,
                delivered_date=row.Transaction.delivered_date,
                is_draft=row.Transaction.is_draft,
                items=(row.Transaction.data or {}).get("items", []),
                subtotal=(row.Transaction.data or {}).get("subtotal"),
                discount=(row.Transaction.data or {}).get("discount"),
            )
            for row in rows
        ]

    # ── Day summary (admin morning briefing) ─────────────────────────────────

    async def get_day_summary(self, target: date) -> DaySummaryOut:
        start_dt = datetime.combine(target, time.min)
        end_dt = datetime.combine(target, time.max)

        pay_rows = await self._repo.get_day_payments(start_dt, end_dt)
        orders = await self._repo.get_day_orders_total(start_dt, end_dt)
        exp_rows = await self._repo.get_day_expenses(target)

        payments = [
            DayPaymentRow(
                customer_name=r["customer_name"],
                rep_name=r["rep_name"],
                amount=r["amount"],
                method="cash" if r["type"] == "Payment_Cash" else "check",
            )
            for r in pay_rows
        ]
        collected_total = sum((p.amount for p in payments), Decimal(0))

        expenses_by_category = [
            DayExpenseCategory(
                category=r["category"], amount=r["amount"], count=r["count"]
            )
            for r in exp_rows
        ]
        expenses_total = sum((e.amount for e in expenses_by_category), Decimal(0))
        expenses_count = sum(e.count for e in expenses_by_category)

        return DaySummaryOut(
            date=target,
            collected_total=collected_total,
            collection_count=len(payments),
            payments=payments,
            orders_total=orders["total"],
            orders_count=orders["cnt"],
            expenses_total=expenses_total,
            expenses_count=expenses_count,
            expenses_by_category=expenses_by_category,
            net=collected_total - expenses_total,
        )

    # ── Daily breakdown ─────────────────────────────────────────────────────

    async def get_daily_breakdown(self, days: int = 7) -> DailyBreakdownOut:
        start = date.today() - timedelta(days=days - 1)
        rows = await self._repo.get_daily_breakdown(start)

        # Build lookup for O(1) matching instead of O(n²)
        row_map = {str(r["d"]): r for r in rows}

        result = []
        for i in range(days):
            d = start + timedelta(days=i)
            key = d.isoformat()
            if key in row_map:
                r = row_map[key]
                result.append(
                    DailyBreakdownItem(
                        date=key,
                        total_orders=r["total_orders"],
                        total_collected=r["total_collected"],
                        order_count=r["order_count"],
                        collection_count=r["collection_count"],
                    )
                )
            else:
                result.append(
                    DailyBreakdownItem(
                        date=key,
                        total_orders=Decimal(0),
                        total_collected=Decimal(0),
                        order_count=0,
                        collection_count=0,
                    )
                )

        return DailyBreakdownOut(days=result)

    # ── Customer import ──────────────────────────────────────────────────────

    async def import_customers(self, csv_content: str) -> ImportResult:
        reader = csv.DictReader(io.StringIO(csv_content))
        created = 0
        errors: list[str] = []

        for i, row in enumerate(reader, start=2):
            try:
                rep = await self._user_repo.get_by_username(row["username"].strip())
                if not rep:
                    errors.append(f"Row {i}: user '{row['username']}' not found")
                    continue

                await self._repo.add_customer(
                    Customer(
                        name=row["name"].strip(),
                        city=row["city"].strip(),
                        assigned_day=AssignedDay(row["assigned_day"].strip()),
                        assigned_to=rep.id,
                        balance=Decimal("0"),
                    )
                )
                created += 1
            except Exception as exc:
                errors.append(f"Row {i}: {exc}")

        await self._repo.commit()
        return ImportResult(created=created, errors=errors)
