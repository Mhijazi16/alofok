import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.api.deps import Cache, CurrentUser, DbSession
from app.core.errors import HorizonException
from app.models.customer import AssignedDay, Customer
from app.models.transaction import Currency, Transaction, TransactionStatus, TransactionType
from app.schemas.customer import CustomerInsightsOut, CustomerOut
from app.schemas.transaction import StatementEntryOut, StatementOut, TransactionOut
from app.utils.cache import TTL_INSIGHTS, TTL_ROUTE

router = APIRouter()

# Day-of-week mapping: Python weekday() → AssignedDay (Mon=0 ... Sun=6)
_WEEKDAY_TO_DAY: dict[int, AssignedDay] = {
    6: AssignedDay.Sun,
    0: AssignedDay.Mon,
    1: AssignedDay.Tue,
    2: AssignedDay.Wed,
    3: AssignedDay.Thu,
}


@router.get("/my-route", response_model=list[CustomerOut])
async def my_route(current_user: CurrentUser, db: DbSession, cache: Cache) -> list[CustomerOut]:
    user_id = current_user["sub"]
    cache_key = f"route:{user_id}"

    cached = await cache.get(cache_key)
    if cached is not None:
        return [CustomerOut.model_validate(c) for c in cached]

    today = datetime.now(timezone.utc).weekday()
    assigned_day = _WEEKDAY_TO_DAY.get(today)

    # Friday/Saturday have no assigned route
    if assigned_day is None:
        return []

    result = await db.execute(
        select(Customer).where(
            Customer.assigned_day == assigned_day,
            Customer.is_deleted.is_(False),
        ).order_by(Customer.name)
    )
    customers = result.scalars().all()
    out = [CustomerOut.model_validate(c) for c in customers]

    await cache.set(cache_key, [c.model_dump(mode="json") for c in out], ttl=TTL_ROUTE)
    return out


@router.get("/{customer_id}/insights", response_model=CustomerInsightsOut)
async def customer_insights(
    customer_id: uuid.UUID, db: DbSession, cache: Cache
) -> CustomerInsightsOut:
    cache_key = f"insights:{customer_id}"
    cached = await cache.get(cache_key)
    if cached is not None:
        return CustomerInsightsOut(**cached)

    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.is_deleted.is_(False))
    )
    customer = result.scalar_one_or_none()
    if customer is None:
        raise HorizonException(404, "Customer not found")

    # Fetch all payment transactions for interval/last-payment calculation
    pay_result = await db.execute(
        select(Transaction)
        .where(
            Transaction.customer_id == customer_id,
            Transaction.type.in_([TransactionType.Payment_Cash, TransactionType.Payment_Check]),
            Transaction.is_deleted.is_(False),
        )
        .order_by(Transaction.created_at.desc())
    )
    payments = pay_result.scalars().all()

    last_payment_date: str | None = None
    last_payment_amount = None
    avg_interval: float | None = None

    if payments:
        last = payments[0]
        last_payment_date = last.created_at.date().isoformat()
        last_payment_amount = abs(last.amount)

        if len(payments) >= 2:
            dates = [p.created_at.date() for p in payments]
            intervals = [(dates[i] - dates[i + 1]).days for i in range(len(dates) - 1)]
            avg_interval = sum(intervals) / len(intervals)

    # Risk score based on balance and days since last payment
    risk = _compute_risk(customer.balance, last_payment_date)

    out = CustomerInsightsOut(
        total_debt=customer.balance,
        last_payment_date=last_payment_date,
        last_payment_amount=last_payment_amount,
        avg_payment_interval_days=avg_interval,
        risk_score=risk,
    )
    await cache.set(cache_key, out.model_dump(mode="json"), ttl=TTL_INSIGHTS)
    return out


@router.get("/{customer_id}/statement", response_model=StatementOut)
async def customer_statement(
    customer_id: uuid.UUID,
    db: DbSession,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    since_zero_balance: bool = Query(False),
) -> StatementOut:
    result = await db.execute(
        select(Customer).where(Customer.id == customer_id, Customer.is_deleted.is_(False))
    )
    if result.scalar_one_or_none() is None:
        raise HorizonException(404, "Customer not found")

    query = (
        select(Transaction)
        .where(Transaction.customer_id == customer_id, Transaction.is_deleted.is_(False))
        .order_by(Transaction.created_at.asc())
    )

    if since_zero_balance:
        # Find the most recent point where the running balance crossed zero;
        # fall back to all transactions if no such point exists.
        all_result = await db.execute(query)
        all_txns = all_result.scalars().all()
        cutoff_index = _find_since_zero_index(all_txns)
        txns = all_txns[cutoff_index:]
    else:
        if start_date:
            query = query.where(Transaction.created_at >= datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc))
        if end_date:
            query = query.where(Transaction.created_at < datetime(end_date.year, end_date.month, end_date.day + 1, tzinfo=timezone.utc))
        result = await db.execute(query)
        txns = result.scalars().all()

    # Build running balance
    from decimal import Decimal
    running = Decimal("0")
    entries: list[StatementEntryOut] = []
    for txn in txns:
        running += txn.amount
        entries.append(StatementEntryOut(
            transaction=TransactionOut.model_validate(txn),
            running_balance=running,
        ))

    return StatementOut(
        customer_id=customer_id,
        entries=entries,
        closing_balance=running,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_risk(balance, last_payment_date: str | None) -> str:
    """Green / Yellow / Red based on debt size and days since last payment."""
    from decimal import Decimal
    if balance <= 0:
        return "green"
    days_since = 9999
    if last_payment_date:
        days_since = (date.today() - date.fromisoformat(last_payment_date)).days

    if balance < Decimal("1000") and days_since < 30:
        return "green"
    if balance < Decimal("5000") and days_since < 60:
        return "yellow"
    return "red"


def _find_since_zero_index(txns) -> int:
    """Return the index after which the running balance was last ≤ 0."""
    from decimal import Decimal
    running = Decimal("0")
    last_zero_index = 0
    for i, txn in enumerate(txns):
        running += txn.amount
        if running <= 0:
            last_zero_index = i + 1
    return last_zero_index
