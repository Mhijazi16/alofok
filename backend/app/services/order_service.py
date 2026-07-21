import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.exc import IntegrityError

from app.core.errors import HorizonException
from app.models.customer import AssignedDay, Customer
from app.models.transaction import Currency, Transaction, TransactionType
from app.repositories.customer_repository import CustomerRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import (
    DiscountType,
    OrderCreate,
    OrderItemSchema,
    OrderUpdate,
    TransactionOut,
)
from app.utils.cache import CacheBackend

_CENTS = Decimal("0.01")

# Python's date.weekday(): Mon=0 … Sun=6.
_DAY_TO_WEEKDAY = {
    AssignedDay.Mon: 0,
    AssignedDay.Tue: 1,
    AssignedDay.Wed: 2,
    AssignedDay.Thu: 3,
    AssignedDay.Fri: 4,
    AssignedDay.Sat: 5,
    AssignedDay.Sun: 6,
}


def default_delivery_date(customer: Customer, today: date | None = None) -> date:
    """Next occurrence of the customer's route day (today if that's their day).

    Every route/delivery view filters orders by ``delivery_date``, so an order
    with a NULL date is invisible everywhere except the customer statement.
    Clients are supposed to always send one, but a client bug (or an old build)
    must not be able to create an unroutable order — mirror the app's
    auto-date logic server-side instead of storing NULL.
    """
    today = today or date.today()
    target = _DAY_TO_WEEKDAY.get(customer.assigned_day)
    if target is None:
        return today
    return today + timedelta(days=(target - today.weekday()) % 7)


def _subtotal(items: list[OrderItemSchema]) -> Decimal:
    return sum(
        (Decimal(str(i.quantity)) * Decimal(str(i.unit_price)) for i in items),
        Decimal(0),
    )


def _discount_amount(
    subtotal: Decimal, dtype: DiscountType | None, dvalue: Decimal | None
) -> Decimal:
    """Resolve an order-level discount to a shekel amount, clamped to [0, subtotal]."""
    if not dtype or dvalue is None or dvalue <= 0:
        return Decimal(0)
    if dtype == "percent":
        pct = min(max(dvalue, Decimal(0)), Decimal(100))
        amt = subtotal * pct / Decimal(100)
    else:  # fixed
        amt = dvalue
    amt = amt.quantize(_CENTS)
    return min(max(amt, Decimal(0)), subtotal)


def _order_data(
    items: list[OrderItemSchema],
    subtotal: Decimal,
    dtype: DiscountType | None,
    dvalue: Decimal | None,
    discount: Decimal,
) -> dict:
    """Build the order's JSONB payload — items plus an optional discount breakdown."""
    data: dict = {"items": [i.model_dump(mode="json") for i in items]}
    if discount > 0:
        data["subtotal"] = float(subtotal)
        data["discount"] = {
            "type": dtype,
            "value": float(dvalue) if dvalue is not None else None,
            "amount": float(discount),
        }
    return data


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
        await self._customers.apply_balance_delta(customer, txn.amount)
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
        self,
        body: OrderCreate,
        creator_id: uuid.UUID,
        idempotency_key: str | None = None,
    ) -> TransactionOut:
        # Durable dedupe: a retried offline mutation carries the same key.
        if idempotency_key is not None:
            existing = await self._transactions.get_by_idempotency_key(idempotency_key)
            if existing is not None:
                return TransactionOut.model_validate(existing)

        customer = await self._customers.get_by_id(body.customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")

        if not body.items:
            raise HorizonException(400, "Order must contain at least one item")

        subtotal = _subtotal(body.items)
        discount = _discount_amount(subtotal, body.discount_type, body.discount_value)
        total = subtotal - discount  # positive — what the customer actually owes

        txn = Transaction(
            customer_id=body.customer_id,
            created_by=creator_id,
            type=TransactionType.Order,
            currency=Currency.ILS,
            amount=total,  # positive — increases customer debt
            data=_order_data(
                body.items, subtotal, body.discount_type, body.discount_value, discount
            ),
            notes=body.notes,
            delivery_date=body.delivery_date or default_delivery_date(customer),
            idempotency_key=idempotency_key,
        )

        # Atomic: flush both, then commit together
        try:
            txn = await self._transactions.create(txn, auto_commit=False)
            await self._customers.apply_balance_delta(customer, total)
            await self._customers.commit()
        except IntegrityError:
            # Concurrent request with the same key won the unique constraint.
            if idempotency_key is None:
                raise
            await self._transactions.rollback()
            existing = await self._transactions.get_by_idempotency_key(idempotency_key)
            if existing is not None:
                return TransactionOut.model_validate(existing)
            raise
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

        # Recalculate the amount whenever items OR the discount change. Either may
        # be omitted, so fall back to whatever the order already has.
        discount_touched = (
            body.discount_type is not None or body.discount_value is not None
        )
        if body.items is not None or discount_touched:
            existing = txn.data or {}
            items = (
                body.items
                if body.items is not None
                else [OrderItemSchema(**i) for i in existing.get("items", [])]
            )
            if discount_touched:
                dtype, dvalue = body.discount_type, body.discount_value
            else:
                prev = existing.get("discount") or {}
                dtype = prev.get("type")
                dvalue = (
                    Decimal(str(prev["value"]))
                    if prev.get("value") is not None
                    else None
                )
            subtotal = _subtotal(items)
            discount = _discount_amount(subtotal, dtype, dvalue)
            txn.amount = subtotal - discount
            txn.data = _order_data(items, subtotal, dtype, dvalue, discount)

        # Update other fields
        if body.delivery_date is not None:
            txn.delivery_date = body.delivery_date
        if body.notes is not None:
            txn.notes = body.notes

        # Adjust balances
        balance_diff = txn.amount - old_amount

        # If customer changed
        if txn.customer_id != old_customer.id:
            await self._customers.apply_balance_delta(old_customer, -old_amount)
            await self._customers.apply_balance_delta(new_customer, txn.amount)
        else:
            # Same customer, just adjust the difference
            await self._customers.apply_balance_delta(new_customer, balance_diff)

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
        await self._customers.apply_balance_delta(customer, -txn.amount)
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
