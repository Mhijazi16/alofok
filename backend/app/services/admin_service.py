import csv
import io
import uuid
from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import AssignedDay, Customer
from app.models.daily_cash_confirmation import DailyCashConfirmation
from app.models.expense import Expense
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.admin import (
    CheckOut,
    CityDebtOut,
    ConfirmHandoverIn,
    DailyCashReportOut,
    DebtStatsOut,
    FlagHandoverIn,
    ImportResult,
    OverdueCheckOut,
    RepCashSummaryOut,
    RepConfirmationOut,
    RepPaymentDetail,
    RepPaymentsOut,
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

    # ── Daily cash report ────────────────────────────────────────────────────

    async def get_daily_cash_report(self, report_date: date) -> DailyCashReportOut:
        # Query 1: All active Sales reps with their cash/check totals for the day
        payment_rows = await self.db.execute(
            text("""
                SELECT
                    u.id                  AS rep_id,
                    u.username            AS rep_name,
                    COALESCE(SUM(CASE WHEN t.type = 'Payment_Cash'
                                      THEN ABS(t.amount) ELSE 0 END), 0)
                                          AS cash_total,
                    COALESCE(SUM(CASE WHEN t.type = 'Payment_Check'
                                      THEN ABS(t.amount) ELSE 0 END), 0)
                                          AS check_total,
                    COUNT(CASE WHEN t.type IN ('Payment_Cash', 'Payment_Check')
                               THEN 1 END)
                                          AS payment_count
                FROM users u
                LEFT JOIN transactions t
                    ON t.created_by = u.id
                    AND t.is_deleted = false
                    AND t.created_at::date = :report_date
                    AND t.type IN ('Payment_Cash', 'Payment_Check')
                WHERE u.role = 'Sales'
                  AND u.is_deleted = false
                GROUP BY u.id, u.username
                ORDER BY u.username
            """),
            {"report_date": report_date},
        )
        payment_map: dict[uuid.UUID, dict] = {}
        for r in payment_rows:
            payment_map[r.rep_id] = {
                "rep_name": r.rep_name,
                "cash_total": Decimal(r.cash_total),
                "check_total": Decimal(r.check_total),
                "payment_count": int(r.payment_count),
            }

        # Query 2: Expense totals per rep for the day
        expense_rows = await self.db.execute(
            text("""
                SELECT
                    created_by            AS rep_id,
                    COALESCE(SUM(amount), 0) AS expense_total,
                    COUNT(id)             AS expense_count
                FROM expenses
                WHERE is_deleted = false
                  AND date = :report_date
                GROUP BY created_by
            """),
            {"report_date": report_date},
        )
        expense_map: dict[uuid.UUID, dict] = {}
        for r in expense_rows:
            expense_map[r.rep_id] = {
                "expense_total": Decimal(r.expense_total),
                "expense_count": int(r.expense_count),
            }

        # Query 3: Confirmation records with confirmer names
        confirmation_rows = await self.db.execute(
            text("""
                SELECT
                    dc.rep_id,
                    dc.handed_over_amount,
                    dc.confirmed_at,
                    dc.is_flagged,
                    dc.flag_notes,
                    u.username            AS confirmer_name
                FROM daily_cash_confirmations dc
                LEFT JOIN users u ON dc.confirmed_by = u.id
                WHERE dc.date = :report_date
                  AND dc.is_deleted = false
            """),
            {"report_date": report_date},
        )
        confirmation_map: dict[uuid.UUID, RepConfirmationOut] = {}
        for r in confirmation_rows:
            confirmation_map[r.rep_id] = RepConfirmationOut(
                handed_over_amount=Decimal(r.handed_over_amount),
                confirmed_at=r.confirmed_at,
                confirmer_name=r.confirmer_name,
                is_flagged=r.is_flagged,
                flag_notes=r.flag_notes,
            )

        # Merge by rep_id
        reps: list[RepCashSummaryOut] = []
        for rep_id, p in payment_map.items():
            exp = expense_map.get(
                rep_id, {"expense_total": Decimal(0), "expense_count": 0}
            )
            cash_total = p["cash_total"]
            expense_total = exp["expense_total"]
            reps.append(
                RepCashSummaryOut(
                    rep_id=rep_id,
                    rep_name=p["rep_name"],
                    cash_total=cash_total,
                    check_total=p["check_total"],
                    expense_total=expense_total,
                    computed_net=cash_total - expense_total,
                    payment_count=p["payment_count"],
                    expense_count=exp["expense_count"],
                    confirmation=confirmation_map.get(rep_id),
                )
            )

        grand_cash = sum(r.cash_total for r in reps) or Decimal(0)
        grand_checks = sum(r.check_total for r in reps) or Decimal(0)
        grand_expenses = sum(r.expense_total for r in reps) or Decimal(0)
        grand_net = grand_cash - grand_expenses

        return DailyCashReportOut(
            report_date=report_date.isoformat(),
            grand_cash=grand_cash,
            grand_checks=grand_checks,
            grand_expenses=grand_expenses,
            grand_net=grand_net,
            reps=reps,
        )

    async def confirm_handover(
        self,
        rep_id: uuid.UUID,
        report_date: date,
        handed_over_amount: Decimal,
        confirmer_id: uuid.UUID,
    ) -> None:
        stmt = (
            pg_insert(DailyCashConfirmation)
            .values(
                rep_id=rep_id,
                date=report_date,
                handed_over_amount=handed_over_amount,
                confirmed_by=confirmer_id,
                confirmed_at=datetime.now(timezone.utc),
                is_flagged=False,
                flag_notes=None,
            )
            .on_conflict_do_update(
                constraint="uq_daily_cash_rep_date",
                set_={
                    "handed_over_amount": handed_over_amount,
                    "confirmed_by": confirmer_id,
                    "confirmed_at": datetime.now(timezone.utc),
                    "is_flagged": False,
                    "flag_notes": None,
                    "updated_at": datetime.now(timezone.utc),
                },
            )
        )
        await self.db.execute(stmt)
        await self.db.commit()

    async def flag_handover(
        self,
        rep_id: uuid.UUID,
        report_date: date,
        handed_over_amount: Decimal,
        flag_notes: str,
        confirmer_id: uuid.UUID,
    ) -> None:
        stmt = (
            pg_insert(DailyCashConfirmation)
            .values(
                rep_id=rep_id,
                date=report_date,
                handed_over_amount=handed_over_amount,
                confirmed_by=confirmer_id,
                confirmed_at=datetime.now(timezone.utc),
                is_flagged=True,
                flag_notes=flag_notes,
            )
            .on_conflict_do_update(
                constraint="uq_daily_cash_rep_date",
                set_={
                    "handed_over_amount": handed_over_amount,
                    "confirmed_by": confirmer_id,
                    "confirmed_at": datetime.now(timezone.utc),
                    "is_flagged": True,
                    "flag_notes": flag_notes,
                    "updated_at": datetime.now(timezone.utc),
                },
            )
        )
        await self.db.execute(stmt)
        await self.db.commit()

    async def get_rep_payment_details(
        self, rep_id: uuid.UUID, report_date: date
    ) -> RepPaymentsOut:
        # Get rep name
        rep_row = await self.db.execute(
            text("SELECT username FROM users WHERE id = :rep_id"),
            {"rep_id": rep_id},
        )
        rep = rep_row.first()
        rep_name = rep.username if rep else "Unknown"

        # Get individual payment transactions with customer names
        rows = await self.db.execute(
            text("""
                SELECT
                    t.id            AS transaction_id,
                    t.customer_id,
                    c.name          AS customer_name,
                    t.type,
                    ABS(t.amount)   AS amount,
                    t.created_at
                FROM transactions t
                JOIN customers c ON c.id = t.customer_id
                WHERE t.created_by = :rep_id
                  AND t.is_deleted = false
                  AND t.created_at::date = :report_date
                  AND t.type IN ('Payment_Cash', 'Payment_Check')
                ORDER BY t.created_at DESC
            """),
            {"rep_id": rep_id, "report_date": report_date},
        )
        payments = [
            RepPaymentDetail(
                transaction_id=r.transaction_id,
                customer_id=r.customer_id,
                customer_name=r.customer_name,
                type=r.type,
                amount=Decimal(r.amount),
                created_at=r.created_at,
            )
            for r in rows
        ]
        return RepPaymentsOut(
            rep_id=rep_id,
            rep_name=rep_name,
            report_date=report_date.isoformat(),
            payments=payments,
        )

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
