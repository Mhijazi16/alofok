"""Idempotency-key tests — a retried offline mutation must not double-apply."""

from decimal import Decimal

import pytest

from app.models.transaction import Currency, TransactionType
from app.schemas.transaction import OrderCreate, OrderItemSchema, PaymentCreate
from tests.conftest import make_customer, make_product, make_user


def _item(product_id, qty, price) -> OrderItemSchema:
    return OrderItemSchema(
        product_id=product_id, quantity=qty, unit_price=Decimal(str(price))
    )


async def _balance(services, cid) -> Decimal:
    return (await services.customers.get_by_id(cid)).balance


@pytest.mark.asyncio
async def test_same_key_creates_one_order(db, services):
    user = await make_user(db)
    cust = await make_customer(db, balance=0, assigned_to=user.id)
    prod = await make_product(db, created_by=user.id)
    body = OrderCreate(customer_id=cust.id, items=[_item(prod.id, 2, "25.00")])

    first = await services.orders.create_order(body, user.id, idempotency_key="k-1")
    second = await services.orders.create_order(body, user.id, idempotency_key="k-1")

    assert first.id == second.id  # same transaction returned
    assert await _balance(services, cust.id) == Decimal("50.00")  # applied once
    orders = await services.transactions.get_orders_for_customer(cust.id)
    assert len(orders) == 1


@pytest.mark.asyncio
async def test_different_keys_create_two_orders(db, services):
    user = await make_user(db)
    cust = await make_customer(db, balance=0, assigned_to=user.id)
    prod = await make_product(db, created_by=user.id)
    body = OrderCreate(customer_id=cust.id, items=[_item(prod.id, 1, "25.00")])

    a = await services.orders.create_order(body, user.id, idempotency_key="a")
    b = await services.orders.create_order(body, user.id, idempotency_key="b")

    assert a.id != b.id
    assert await _balance(services, cust.id) == Decimal("50.00")
    orders = await services.transactions.get_orders_for_customer(cust.id)
    assert len(orders) == 2


@pytest.mark.asyncio
async def test_no_key_always_creates(db, services):
    user = await make_user(db)
    cust = await make_customer(db, balance=0, assigned_to=user.id)
    prod = await make_product(db, created_by=user.id)
    body = OrderCreate(customer_id=cust.id, items=[_item(prod.id, 1, "10.00")])

    a = await services.orders.create_order(body, user.id, idempotency_key=None)
    b = await services.orders.create_order(body, user.id, idempotency_key=None)

    assert a.id != b.id
    assert await _balance(services, cust.id) == Decimal("20.00")


@pytest.mark.asyncio
async def test_same_key_creates_one_payment(db, services):
    user = await make_user(db)
    cust = await make_customer(db, balance="100.00", assigned_to=user.id)
    body = PaymentCreate(
        customer_id=cust.id,
        type=TransactionType.Payment_Cash,
        currency=Currency.ILS,
        amount=Decimal("40.00"),
    )

    first = await services.payments.create_payment(body, user.id, idempotency_key="p-1")
    second = await services.payments.create_payment(
        body, user.id, idempotency_key="p-1"
    )

    assert first.id == second.id
    assert await _balance(services, cust.id) == Decimal("60.00")  # deducted once
    payments = await services.transactions.get_payments_for_customer(cust.id)
    assert len(payments) == 1
