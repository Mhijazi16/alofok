import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from app.core.errors import HorizonException
from app.models.transaction import Currency, Transaction, TransactionType
from app.repositories.customer_repository import CustomerRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import (
    StatementEntryOut,
    StatementOut,
    TransactionOut,
)
from app.utils.cache import CacheBackend


class CustomerPortalService:
    def __init__(
        self,
        customer_repo: CustomerRepository,
        transaction_repo: TransactionRepository,
        cache: CacheBackend,
    ):
        self._customers = customer_repo
        self._transactions = transaction_repo
        self._cache = cache

    async def get_statement(
        self,
        customer_id: uuid.UUID,
        start_date: date | None = None,
        end_date: date | None = None,
        since_zero_balance: bool = False,
    ) -> StatementOut:
        customer = await self._customers.get_by_id(customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")

        all_txns = await self._transactions.get_for_customer(customer_id)
        # Filter out drafts for statement
        txns = [t for t in all_txns if not t.is_draft]

        if since_zero_balance:
            txns = txns[_find_since_zero_index(txns) :]
        else:
            if start_date:
                start_dt = datetime(
                    start_date.year,
                    start_date.month,
                    start_date.day,
                    tzinfo=timezone.utc,
                )
                txns = [t for t in txns if t.created_at >= start_dt]
            if end_date:
                end_dt = datetime(
                    end_date.year, end_date.month, end_date.day + 1, tzinfo=timezone.utc
                )
                txns = [t for t in txns if t.created_at < end_dt]

        running = Decimal("0")
        entries: list[StatementEntryOut] = []
        for txn in txns:
            running += txn.amount
            entries.append(
                StatementEntryOut(
                    transaction=TransactionOut.model_validate(txn),
                    running_balance=running,
                )
            )

        return StatementOut(
            customer_id=customer_id, entries=entries, closing_balance=running
        )

    async def get_orders(self, customer_id: uuid.UUID) -> list[TransactionOut]:
        txns = await self._transactions.get_orders_for_customer(customer_id)
        return [TransactionOut.model_validate(t) for t in txns]

    async def create_draft_order(
        self,
        customer_id: uuid.UUID,
        items: list,
        notes: str | None,
    ) -> TransactionOut:
        from app.schemas.transaction import OrderItemSchema

        customer = await self._customers.get_by_id(customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")

        if not items:
            raise HorizonException(400, "Order must contain at least one item")

        total = sum(
            Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
            for item in items
        )

        txn = Transaction(
            customer_id=customer_id,
            created_by=None,
            type=TransactionType.Order,
            currency=Currency.ILS,
            amount=total,
            data={
                "items": [item.model_dump(mode="json") for item in items],
                "source": "customer_portal",
                "created_by_customer": str(customer_id),
            },
            notes=notes,
            is_draft=True,
        )
        # Draft does NOT update balance
        txn = await self._transactions.create(txn)
        return TransactionOut.model_validate(txn)


def _find_since_zero_index(txns) -> int:
    running = Decimal("0")
    last_zero_index = 0
    for i, txn in enumerate(txns):
        running += txn.amount
        if running <= 0:
            last_zero_index = i + 1
    return last_zero_index
