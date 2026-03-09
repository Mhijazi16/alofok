import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from app.core.errors import HorizonException
from app.core.security import hash_password
from app.models.customer import AssignedDay
from app.models.transaction import Currency, Transaction, TransactionType
from app.repositories.customer_auth_repository import CustomerAuthRepository
from app.repositories.customer_repository import CustomerRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.customer import (
    AdminCustomerCreate,
    CustomerCreate,
    CustomerInsightsOut,
    CustomerOut,
    CustomerUpdate,
)
from app.schemas.transaction import (
    OrderWithCustomerOut,
    StatementOut,
    TransactionOut,
)
from app.services._statement import build_statement, find_since_zero_index
from app.utils.cache import CacheBackend, TTL_INSIGHTS, TTL_ROUTE

# Python weekday() → AssignedDay  (Mon=0 … Sun=6; Fri has no route)
_WEEKDAY_MAP: dict[int, AssignedDay] = {
    6: AssignedDay.Sun,
    0: AssignedDay.Mon,
    1: AssignedDay.Tue,
    2: AssignedDay.Wed,
    3: AssignedDay.Thu,
    5: AssignedDay.Sat,
}


class CustomerService:
    def __init__(
        self,
        customer_repo: CustomerRepository,
        transaction_repo: TransactionRepository,
        cache: CacheBackend,
        auth_repo: CustomerAuthRepository,
    ):
        self._customers = customer_repo
        self._transactions = transaction_repo
        self._cache = cache
        self._auth = auth_repo

    async def create_customer(self, data: CustomerCreate, user_id: uuid.UUID) -> CustomerOut:
        portal_password = (
            data.portal_password if hasattr(data, "portal_password") else None
        )
        initial_balance = (
            data.initial_balance if hasattr(data, "initial_balance") else None
        )
        customer_dict = data.model_dump(exclude={"portal_password", "initial_balance"})
        customer_dict["assigned_to"] = user_id
        customer = await self._customers.create(customer_dict)

        if initial_balance is not None and initial_balance != 0:
            txn = Transaction(
                customer_id=customer.id,
                created_by=user_id,
                type=TransactionType.Opening_Balance,
                currency=Currency.ILS,
                amount=Decimal(str(initial_balance)),
                notes="Opening balance",
            )
            await self._transactions.create(txn)
            customer = await self._customers.update(
                customer.id, {"balance": initial_balance}
            )

        if portal_password and customer_dict.get("phone"):
            await self._auth.create(
                {
                    "customer_id": customer.id,
                    "phone": customer_dict["phone"],
                    "password_hash": hash_password(portal_password),
                }
            )

        return CustomerOut.model_validate(customer)

    async def get_draft_orders(self, customer_id: uuid.UUID) -> list[TransactionOut]:
        drafts = await self._transactions.get_drafts_for_customer(customer_id)
        return [TransactionOut.model_validate(d) for d in drafts]

    async def update_customer(
        self, customer_id: uuid.UUID, data: CustomerUpdate, user_id: uuid.UUID, role: str
    ) -> CustomerOut:
        if role == "Sales":
            customer = await self._customers.get_by_id(customer_id)
            if not customer or customer.assigned_to != user_id:
                raise HorizonException(403, "Cannot edit this customer")
        updated = await self._customers.update(
            customer_id, data.model_dump(exclude_none=True)
        )
        if not updated:
            raise HorizonException(404, "Customer not found")
        await self._cache.invalidate_prefix("route:")
        return CustomerOut.model_validate(updated)

    async def _enrich_with_returned_checks(self, customers: list) -> list[CustomerOut]:
        """Validate customer models and attach returned_checks_count."""
        if not customers:
            return []
        out = [CustomerOut.model_validate(c) for c in customers]
        ids = [c.id for c in out]
        counts = await self._customers.get_returned_checks_counts(ids)
        for c in out:
            c.returned_checks_count = counts.get(c.id, 0)
        return out

    async def get_route_by_day(
        self, user_id: uuid.UUID, day: AssignedDay, delivery_date: date | None = None
    ) -> list[CustomerOut]:
        customers = await self._customers.get_by_day_and_rep(
            day, user_id, delivery_date
        )
        return await self._enrich_with_returned_checks(customers)

    async def get_all_customers(self, user_id: uuid.UUID) -> list[CustomerOut]:
        customers = await self._customers.get_all_by_rep(user_id)
        return await self._enrich_with_returned_checks(customers)

    async def get_my_orders_today(
        self, user_id: uuid.UUID
    ) -> list[OrderWithCustomerOut]:
        now = datetime.now(timezone.utc)
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = start + timedelta(days=1)
        rows = await self._transactions.get_orders_by_rep_with_customer(
            user_id, start, end
        )
        return [
            OrderWithCustomerOut(
                **TransactionOut.model_validate(txn).model_dump(),
                customer_name=name,
            )
            for txn, name in rows
        ]

    async def get_delivery_orders(
        self, user_id: uuid.UUID, delivery: date, assigned_day: str
    ) -> list[OrderWithCustomerOut]:
        rows = await self._transactions.get_delivery_orders(
            user_id, delivery, assigned_day
        )
        return [
            OrderWithCustomerOut(
                **TransactionOut.model_validate(txn).model_dump(),
                customer_name=name,
                is_route=is_route,
            )
            for txn, name, is_route in rows
        ]

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
        out = await self._enrich_with_returned_checks(customers)
        await self._cache.set(
            cache_key, [c.model_dump(mode="json") for c in out], ttl=TTL_ROUTE
        )
        return out

    async def get_collections_for_date(self, user_id: uuid.UUID, d: date) -> float:
        start = datetime(d.year, d.month, d.day, tzinfo=timezone.utc)
        end = start + timedelta(days=1)
        return await self._transactions.get_collections_total(user_id, start, end)

    async def get_insights(self, customer_id: uuid.UUID) -> CustomerInsightsOut:
        cache_key = f"insights:{customer_id}"
        cached = await self._cache.get(cache_key)
        if cached is not None:
            return CustomerInsightsOut(**cached)

        customer = await self._customers.get_by_id(customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")

        # Compute total_debt from actual transaction sum (source of truth)
        all_txns = await self._transactions.get_for_customer(customer_id)
        computed_balance = sum((t.amount for t in all_txns), Decimal("0"))

        # Self-heal: reconcile customer.balance if it drifted
        if customer.balance != computed_balance:
            await self._customers.update(customer_id, {"balance": computed_balance})
            await self._cache.invalidate_prefix("route:")

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
                intervals = [
                    (dates[i] - dates[i + 1]).days for i in range(len(dates) - 1)
                ]
                avg_interval = sum(intervals) / len(intervals)

        out = CustomerInsightsOut(
            total_debt=computed_balance,
            last_payment_date=last_payment_date,
            last_payment_amount=last_payment_amount,
            avg_payment_interval_days=avg_interval,
            risk_score=_compute_risk(computed_balance, last_payment_date),
        )
        await self._cache.set(cache_key, out.model_dump(mode="json"), ttl=TTL_INSIGHTS)
        return out

    async def get_statement(
        self,
        customer_id: uuid.UUID,
        start_date: date | None,
        end_date: date | None,
        since_zero_balance: bool,
        exclude_drafts: bool = False,
    ) -> StatementOut:
        customer = await self._customers.get_by_id(customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")

        if since_zero_balance:
            all_txns = await self._transactions.get_for_customer(customer_id)
            if exclude_drafts:
                all_txns = [t for t in all_txns if not t.is_draft]
            txns = all_txns[find_since_zero_index(all_txns) :]
        else:
            start_dt = (
                datetime(
                    start_date.year,
                    start_date.month,
                    start_date.day,
                    tzinfo=timezone.utc,
                )
                if start_date
                else None
            )
            end_dt = (
                datetime(
                    end_date.year, end_date.month, end_date.day + 1, tzinfo=timezone.utc
                )
                if end_date
                else None
            )
            txns = await self._transactions.get_for_customer(
                customer_id, start=start_dt, end=end_dt
            )
            if exclude_drafts:
                txns = [t for t in txns if not t.is_draft]

        return build_statement(customer_id, txns)

    async def get_all_customers_admin(self) -> list[CustomerOut]:
        customers = await self._customers.get_all()
        return await self._enrich_with_returned_checks(customers)

    async def archive_customer(
        self, customer_id: uuid.UUID, user_id: uuid.UUID, role: str
    ) -> None:
        if role == "Sales":
            customer = await self._customers.get_by_id(customer_id)
            if not customer or customer.assigned_to != user_id:
                raise HorizonException(403, "Cannot archive this customer")
        archived = await self._customers.archive(customer_id)
        if not archived:
            raise HorizonException(404, "Customer not found")
        await self._cache.invalidate_prefix("route:")
        await self._cache.invalidate_prefix("insights:")

    async def create_customer_for_rep(self, data: AdminCustomerCreate) -> CustomerOut:
        initial_balance = data.initial_balance
        payload = data.model_dump(exclude={"initial_balance"})
        customer = await self._customers.create(payload)
        if initial_balance is not None and initial_balance != 0:
            txn = Transaction(
                customer_id=customer.id,
                created_by=None,
                type=TransactionType.Opening_Balance,
                currency=Currency.ILS,
                amount=Decimal(str(initial_balance)),
                notes="Opening balance",
            )
            await self._transactions.create(txn)
            customer = await self._customers.update(
                customer.id, {"balance": initial_balance}
            )
        await self._cache.invalidate_prefix("route:")
        return CustomerOut.model_validate(customer)


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


