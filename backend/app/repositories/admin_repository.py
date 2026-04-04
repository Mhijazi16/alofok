from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.customer import Customer
from app.models.transaction import Transaction, TransactionStatus, TransactionType
from app.models.user import User


class AdminRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_sales_stats(self, start_dt: datetime, end_dt: datetime) -> list[dict]:
        rows = await self._db.execute(
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
        return [dict(r._mapping) for r in rows]

    async def get_debt_by_city(self) -> list[dict]:
        city_rows = await self._db.execute(text("""
                SELECT city,
                       SUM(balance)  AS total_debt,
                       COUNT(id)     AS customer_count
                FROM customers
                WHERE is_deleted = false
                GROUP BY city
                ORDER BY total_debt DESC
            """))
        return [dict(r._mapping) for r in city_rows]

    async def get_total_debt(self) -> Decimal:
        result = await self._db.execute(
            select(func.coalesce(func.sum(Customer.balance), 0)).where(
                Customer.is_deleted == False  # noqa: E712
            )
        )
        return result.scalar()

    async def get_overdue_checks(self, today: str) -> list[dict]:
        rows = await self._db.execute(
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
        return [dict(r._mapping) for r in rows]

    async def get_eod_summary(self, start_dt: datetime, end_dt: datetime) -> list[dict]:
        rows = await self._db.execute(
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
        return [dict(r._mapping) for r in rows]

    async def get_all_checks(
        self, status: TransactionStatus | None = None
    ) -> list[tuple]:
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

        result = await self._db.execute(query)
        return list(result.all())

    async def get_daily_breakdown(self, start_date: date) -> list[dict]:
        rows = await self._db.execute(
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
            {"start_date": start_date},
        )
        return [dict(r._mapping) for r in rows]

    async def add_customer(self, customer: Customer) -> None:
        self._db.add(customer)

    async def commit(self) -> None:
        await self._db.commit()
