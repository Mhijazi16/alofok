import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from app.core.errors import HorizonException
from app.models.customer import AssignedDay
from app.repositories.customer_repository import CustomerRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.customer import CustomerInsightsOut, CustomerOut
from app.schemas.transaction import StatementEntryOut, StatementOut, TransactionOut
from app.utils.cache import CacheBackend, TTL_INSIGHTS, TTL_ROUTE

# Python weekday() → AssignedDay  (Mon=0 … Sun=6; Fri/Sat have no route)
_WEEKDAY_MAP: dict[int, AssignedDay] = {
    6: AssignedDay.Sun,
    0: AssignedDay.Mon,
    1: AssignedDay.Tue,
    2: AssignedDay.Wed,
    3: AssignedDay.Thu,
}


class CustomerService:
    def __init__(
        self,
        customer_repo: CustomerRepository,
        transaction_repo: TransactionRepository,
        cache: CacheBackend,
    ):
        self._customers = customer_repo
        self._transactions = transaction_repo
        self._cache = cache

    async def get_route(self, user_id: str) -> list[CustomerOut]:
        cache_key = f"route:{user_id}"
        cached = await self._cache.get(cache_key)
        if cached is not None:
            return [CustomerOut.model_validate(c) for c in cached]

        today = datetime.now(timezone.utc).weekday()
        assigned_day = _WEEKDAY_MAP.get(today)
        if assigned_day is None:
            return []  # Friday / Saturday — no route

        customers = await self._customers.get_by_day(assigned_day)
        out = [CustomerOut.model_validate(c) for c in customers]
        await self._cache.set(cache_key, [c.model_dump(mode="json") for c in out], ttl=TTL_ROUTE)
        return out

    async def get_insights(self, customer_id: uuid.UUID) -> CustomerInsightsOut:
        cache_key = f"insights:{customer_id}"
        cached = await self._cache.get(cache_key)
        if cached is not None:
            return CustomerInsightsOut(**cached)

        customer = await self._customers.get_by_id(customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")

        payments = await self._transactions.get_payments_for_customer(customer_id)

        last_payment_date: str | None = None
        last_payment_amount: Decimal | None = None
        avg_interval: float | None = None

        if payments:
            last = payments[0]
            last_payment_date = last.created_at.date().isoformat()
            last_payment_amount = abs(last.amount)

            if len(payments) >= 2:
                dates = [p.created_at.date() for p in payments]
                intervals = [(dates[i] - dates[i + 1]).days for i in range(len(dates) - 1)]
                avg_interval = sum(intervals) / len(intervals)

        out = CustomerInsightsOut(
            total_debt=customer.balance,
            last_payment_date=last_payment_date,
            last_payment_amount=last_payment_amount,
            avg_payment_interval_days=avg_interval,
            risk_score=_compute_risk(customer.balance, last_payment_date),
        )
        await self._cache.set(cache_key, out.model_dump(mode="json"), ttl=TTL_INSIGHTS)
        return out

    async def get_statement(
        self,
        customer_id: uuid.UUID,
        start_date: date | None,
        end_date: date | None,
        since_zero_balance: bool,
    ) -> StatementOut:
        customer = await self._customers.get_by_id(customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")

        if since_zero_balance:
            all_txns = await self._transactions.get_for_customer(customer_id)
            txns = all_txns[_find_since_zero_index(all_txns):]
        else:
            start_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc) if start_date else None
            end_dt = datetime(end_date.year, end_date.month, end_date.day + 1, tzinfo=timezone.utc) if end_date else None
            txns = await self._transactions.get_for_customer(customer_id, start=start_dt, end=end_dt)

        running = Decimal("0")
        entries: list[StatementEntryOut] = []
        for txn in txns:
            running += txn.amount
            entries.append(StatementEntryOut(
                transaction=TransactionOut.model_validate(txn),
                running_balance=running,
            ))

        return StatementOut(customer_id=customer_id, entries=entries, closing_balance=running)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _compute_risk(balance: Decimal, last_payment_date: str | None) -> str:
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
    """Return the index of the first transaction after the last zero-or-credit balance."""
    running = Decimal("0")
    last_zero_index = 0
    for i, txn in enumerate(txns):
        running += txn.amount
        if running <= 0:
            last_zero_index = i + 1
    return last_zero_index
