import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from app.core.errors import HorizonException
from app.models.transaction import Currency, Transaction, TransactionType
from app.repositories.customer_repository import CustomerRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import (
    StatementOut,
    TransactionOut,
)
from app.services._statement import build_statement, find_since_zero_index
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

        if since_zero_balance:
            all_txns = await self._transactions.get_for_customer(customer_id)
            txns = [t for t in all_txns if not t.is_draft]
            txns = txns[find_since_zero_index(txns) :]
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
            txns = [t for t in txns if not t.is_draft]

        return build_statement(customer_id, txns)

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
