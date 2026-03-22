import csv
import io
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import AssignedDay, Customer
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.admin import (
    CheckOut,
    CityDebtOut,
    DailyBreakdownItem,
    DailyBreakdownOut,
    DebtStatsOut,
    ImportResult,
    OverdueCheckOut,
    SalesRepStatsOut,
    SalesStatsOut,
)
from app.utils.slack import send_eod_alert


class AdminService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Sales stats ─────────────────────────────────────────────────────────

    async def get_sales_stats(self, start_date: date, end_date: date) -> SalesStatsOut:
        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)

        rows = await self.db.execute(
            text("""
                SELECT
                    u.id          AS user_id,
                    u.username,
                    COALESCE(SUM(CASE WHEN t.type = 'Order' THEN t.amount ELSE 0 END), 0)
                                  AS total_orders,
                    COUNT(CASE WHEN t.type = 'Order' THEN 1 END)
                                  AS order_count,
                    COALESCE(SUM(CASE WHEN t.type IN ('Payment_Cash','Payment_Check')
                                      THEN ABS(t.amount) ELSE 0 END), 0)
                                  AS total_collected,
                    COUNT(CASE WHEN t.type IN ('Payment_Cash','Payment_Check') THEN 1 END)
                                  AS collection_count
                FROM transactions t
                JOIN users u ON t.created_by = u.id
                WHERE t.is_deleted = false
                  AND t.created_at >= :start
                  AND t.created_at <= :end
                GROUP BY u.id, u.username
                ORDER BY total_orders DESC
            """),
            {"start": start_dt, "end": end_dt},
        )

        reps = [
            SalesRepStatsOut(
                user_id=r.user_id,
                username=r.username,
                total_orders=r.total_orders,
                order_count=r.order_count,
                total_collected=r.total_collected,
                collection_count=r.collection_count,
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
        # Total + by city
        city_rows = await self.db.execute(text("""
                SELECT city,
                       SUM(balance)  AS total_debt,
                       COUNT(id)     AS customer_count
                FROM customers
                WHERE is_deleted = false
                GROUP BY city
                ORDER BY total_debt DESC
            """))
        by_city = [
            CityDebtOut(
                city=r.city,
                total_debt=r.total_debt,
                customer_count=r.customer_count,
            )
            for r in city_rows
        ]

        total_result = await self.db.execute(
            select(func.coalesce(func.sum(Customer.balance), 0)).where(
                Customer.is_deleted == False  # noqa: E712
            )
        )
        total_debt: Decimal = total_result.scalar()  # type: ignore[assignment]

        # Overdue checks (due_date in past, still Pending)
        today = date.today().isoformat()
        overdue_rows = await self.db.execute(
            text("""
                SELECT
                    t.id              AS transaction_id,
                    c.name            AS customer_name,
                    t.amount,
                    t.currency,
                    t.data->>'bank'   AS bank,
                    t.data->>'due_date' AS due_date
                FROM transactions t
                JOIN customers c ON t.customer_id = c.id
                WHERE t.type = 'Payment_Check'
                  AND t.status = 'Pending'
                  AND t.is_deleted = false
                  AND t.data->>'due_date' IS NOT NULL
                  AND t.data->>'due_date' < :today
                ORDER BY t.data->>'due_date'
            """),
            {"today": today},
        )
        overdue = [
            OverdueCheckOut(
                transaction_id=r.transaction_id,
                customer_name=r.customer_name,
                amount=r.amount,
                currency=r.currency,
                bank=r.bank,
                due_date=r.due_date,
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

        rows = await self.db.execute(
            text("""
                SELECT
                    u.username,
                    t.type,
                    t.currency,
                    SUM(ABS(t.amount)) AS total,
                    COUNT(t.id)        AS cnt
                FROM transactions t
                JOIN users u ON t.created_by = u.id
                WHERE t.is_deleted = false
                  AND t.created_at >= :start
                  AND t.created_at <= :end
                  AND t.type IN ('Order','Payment_Cash','Payment_Check')
                GROUP BY u.username, t.type, t.currency
                ORDER BY u.username, t.type
            """),
            {"start": start_dt, "end": end_dt},
        )
        summary = [dict(r._mapping) for r in rows]
        await send_eod_alert(target, summary)
        return {"date": target.isoformat(), "rows": len(summary)}

    # ── Check list ───────────────────────────────────────────────────────────

    async def get_all_checks(
        self, status: TransactionStatus | None = None
    ) -> list[CheckOut]:
        query = (
            select(Transaction, Customer.name.label("customer_name"))
            .join(Customer, Transaction.customer_id == Customer.id)
            .where(
                Transaction.type == TransactionType.Payment_Check,
                Transaction.is_deleted.is_(False),
            )
            .order_by(Transaction.created_at.desc())
        )
        if status is not None:
            query = query.where(Transaction.status == status)

        result = await self.db.execute(query)
        rows = result.all()
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

    # ── Daily breakdown ─────────────────────────────────────────────────────

    async def get_daily_breakdown(self, days: int = 7) -> DailyBreakdownOut:
        start = date.today() - timedelta(days=days - 1)

        rows = await self.db.execute(
            text("""
                SELECT
                    DATE(created_at) as d,
                    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) as total_orders,
                    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) as total_collected,
                    COUNT(CASE WHEN amount > 0 THEN 1 END) as order_count,
                    COUNT(CASE WHEN amount < 0 THEN 1 END) as collection_count
                FROM transactions
                WHERE is_deleted = false
                  AND DATE(created_at) >= :start_date
                GROUP BY DATE(created_at)
                ORDER BY d
            """),
            {"start_date": start},
        )

        # Build complete date range (fill gaps with zeros)
        result = []
        for i in range(days):
            d = start + timedelta(days=i)
            result.append(
                DailyBreakdownItem(
                    date=d.isoformat(),
                    total_orders=Decimal(0),
                    total_collected=Decimal(0),
                    order_count=0,
                    collection_count=0,
                )
            )

        for row in rows:
            for item in result:
                if item.date == str(row.d):
                    item.total_orders = row.total_orders
                    item.total_collected = row.total_collected
                    item.order_count = row.order_count
                    item.collection_count = row.collection_count
                    break

        return DailyBreakdownOut(days=result)

    # ── Customer import ──────────────────────────────────────────────────────

    async def import_customers(
        self, csv_content: str, user_repo: UserRepository
    ) -> ImportResult:
        reader = csv.DictReader(io.StringIO(csv_content))
        created = 0
        errors: list[str] = []

        for i, row in enumerate(reader, start=2):
            try:
                rep = await user_repo.get_by_username(row["username"].strip())
                if not rep:
                    errors.append(f"Row {i}: user '{row['username']}' not found")
                    continue

                self.db.add(
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

        await self.db.commit()
        return ImportResult(created=created, errors=errors)
