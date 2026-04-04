import uuid
from datetime import datetime, timezone
from decimal import Decimal

from app.core.errors import HorizonException
from app.models.transaction import Currency, Transaction, TransactionType
from app.repositories.customer_repository import CustomerRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import OrderCreate, OrderUpdate, TransactionOut
from app.utils.cache import CacheBackend


class OrderService:
    def __init__(
        self,
        customer_repo: CustomerRepository,
        transaction_repo: TransactionRepository,
        cache: CacheBackend,
    ):
        self._customers = customer_repo
        self._transactions = transaction_repo
        self._cache = cache

    async def _invalidate_customer_cache(self, customer_id: uuid.UUID) -> None:
        await self._cache.delete(f"insights:{customer_id}")
        await self._cache.invalidate_prefix("route:")

    async def confirm_draft(
        self, order_id: uuid.UUID, confirmer_id: uuid.UUID
    ) -> TransactionOut:
        txn = await self._transactions.get_by_id(order_id)
        if txn is None:
            raise HorizonException(404, "Order not found")
        if not txn.is_draft:
            raise HorizonException(400, "Order is not a draft")

        txn.is_draft = False
        txn.created_by = confirmer_id

        customer = await self._customers.get_by_id(txn.customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")
        customer.balance += txn.amount
        await self._customers.update_balance(customer)
        txn = await self._transactions.update(txn)
        await self._invalidate_customer_cache(txn.customer_id)
        return TransactionOut.model_validate(txn)

    async def reject_draft(
        self, order_id: uuid.UUID, rejecter_id: uuid.UUID
    ) -> TransactionOut:
        txn = await self._transactions.get_by_id(order_id)
        if txn is None:
            raise HorizonException(404, "Order not found")
        if not txn.is_draft:
            raise HorizonException(400, "Order is not a draft")

        txn.is_deleted = True
        txn = await self._transactions.update(txn)
        return TransactionOut.model_validate(txn)

    async def create_order(
        self, body: OrderCreate, creator_id: uuid.UUID
    ) -> TransactionOut:
        customer = await self._customers.get_by_id(body.customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")

        if not body.items:
            raise HorizonException(400, "Order must contain at least one item")

        total = sum(
            Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
            for item in body.items
        )

        txn = Transaction(
            customer_id=body.customer_id,
            created_by=creator_id,
            type=TransactionType.Order,
            currency=Currency.ILS,
            amount=total,  # positive — increases customer debt
            data={"items": [item.model_dump(mode="json") for item in body.items]},
            notes=body.notes,
            delivery_date=body.delivery_date,
        )

        # Atomic: flush both, then commit together
        txn = await self._transactions.create(txn, auto_commit=False)
        customer.balance += total
        await self._customers.update_balance(customer)
        await self._customers.commit()
        await self._invalidate_customer_cache(body.customer_id)
        return TransactionOut.model_validate(txn)

    async def update_order(
        self,
        order_id: uuid.UUID,
        updater_id: uuid.UUID,
        body: OrderUpdate,
    ) -> TransactionOut:
        """Update an existing order (items, customer, delivery_date, notes).
        Only undelivered orders can be updated."""
        txn = await self._transactions.get_by_id(order_id)
        if txn is None:
            raise HorizonException(404, "Order not found")
        if txn.delivered_date is not None:
            raise HorizonException(400, "Cannot edit delivered orders")
        if txn.type != TransactionType.Order:
            raise HorizonException(400, "Can only update orders")

        # Get old customer for balance adjustment
        old_customer = await self._customers.get_by_id(txn.customer_id)
        if old_customer is None:
            raise HorizonException(404, "Customer not found")

        old_amount = txn.amount

        # Update customer if provided
        if body.customer_id:
            new_customer = await self._customers.get_by_id(body.customer_id)
            if new_customer is None:
                raise HorizonException(404, "New customer not found")
            txn.customer_id = body.customer_id
        else:
            new_customer = old_customer

        # Update items and recalculate amount
        if body.items:
            total = sum(
                Decimal(str(item.quantity)) * Decimal(str(item.unit_price))
                for item in body.items
            )
            txn.amount = total
            txn.data = {"items": [item.model_dump(mode="json") for item in body.items]}

        # Update other fields
        if body.delivery_date is not None:
            txn.delivery_date = body.delivery_date
        if body.notes is not None:
            txn.notes = body.notes

        # Adjust balances
        balance_diff = txn.amount - old_amount

        # If customer changed
        if txn.customer_id != old_customer.id:
            old_customer.balance -= old_amount
            new_customer.balance += txn.amount
            await self._customers.update_balance(old_customer)
            await self._customers.update_balance(new_customer)
        else:
            # Same customer, just adjust the difference
            new_customer.balance += balance_diff
            await self._customers.update_balance(new_customer)

        txn = await self._transactions.update(txn)
        await self._invalidate_customer_cache(txn.customer_id)
        if txn.customer_id != old_customer.id:
            await self._invalidate_customer_cache(old_customer.id)
        return TransactionOut.model_validate(txn)

    async def confirm_delivery(
        self, order_id: uuid.UUID, confirmer_id: uuid.UUID
    ) -> TransactionOut:
        """Mark an order as delivered (locks it from editing)."""
        txn = await self._transactions.get_by_id(order_id)
        if txn is None:
            raise HorizonException(404, "Order not found")
        if txn.type != TransactionType.Order:
            raise HorizonException(400, "Can only confirm order delivery")
        if txn.delivered_date is not None:
            raise HorizonException(400, "Order already marked as delivered")

        txn.delivered_date = datetime.now(timezone.utc)
        txn = await self._transactions.update(txn)
        return TransactionOut.model_validate(txn)

    async def delete_order(
        self, order_id: uuid.UUID, user_id: uuid.UUID
    ) -> TransactionOut:
        """Soft-delete an order and reverse the customer balance."""
        txn = await self._transactions.get_by_id(order_id)
        if txn is None:
            raise HorizonException(404, "Order not found")
        if txn.type != TransactionType.Order:
            raise HorizonException(400, "Can only delete orders")

        customer = await self._customers.get_by_id(txn.customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")

        # Atomic: flush balance + soft-delete, then commit together
        customer.balance -= txn.amount
        await self._customers.update_balance(customer)
        txn.is_deleted = True
        txn = await self._transactions.update(txn)
        await self._invalidate_customer_cache(txn.customer_id)
        return TransactionOut.model_validate(txn)

    async def undeliver_order(
        self, order_id: uuid.UUID, user_id: uuid.UUID
    ) -> TransactionOut:
        """Clear delivered_date so the order can be edited again."""
        txn = await self._transactions.get_by_id(order_id)
        if txn is None:
            raise HorizonException(404, "Order not found")
        if txn.type != TransactionType.Order:
            raise HorizonException(400, "Can only undeliver orders")
        if txn.delivered_date is None:
            raise HorizonException(400, "Order is not delivered")

        txn.delivered_date = None
        txn = await self._transactions.update(txn)
        return TransactionOut.model_validate(txn)
