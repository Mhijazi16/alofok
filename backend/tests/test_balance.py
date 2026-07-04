"""Balance-math tests — the highest-risk, previously-untested money logic.

Sign convention (see CLAUDE.md / apply_balance_delta):
- orders / returned checks  -> POSITIVE  (increase customer debt)
- payments / discounts / purchases -> NEGATIVE (decrease debt)
``Transaction.amount`` is signed and ``customer.balance`` is the running sum.
"""

import uuid
from decimal import Decimal

import pytest

from app.models.transaction import Currency, TransactionType
from app.schemas.transaction import (
    OrderCreate,
    OrderItemSchema,
    PaymentCreate,
    PurchaseCreate,
    PurchaseItem,
)
from tests.conftest import make_customer, make_product, make_user


async def _fresh_balance(services, customer_id) -> Decimal:
    c = await services.customers.get_by_id(customer_id)
    return c.balance


def _item(product_id, qty, price) -> OrderItemSchema:
    return OrderItemSchema(
        product_id=product_id, quantity=qty, unit_price=Decimal(str(price))
    )


@pytest.mark.asyncio
async def test_create_order_increases_balance(db, services):
    user = await make_user(db)
    cust = await make_customer(db, balance=0, assigned_to=user.id)
    prod = await make_product(db, created_by=user.id)

    body = OrderCreate(customer_id=cust.id, items=[_item(prod.id, 3, "10.00")])
    out = await services.orders.create_order(body, user.id)

    assert out.amount == Decimal("30.00")
    assert out.type == TransactionType.Order
    assert await _fresh_balance(services, cust.id) == Decimal("30.00")


@pytest.mark.asyncio
async def test_order_with_percent_discount(db, services):
    user = await make_user(db)
    cust = await make_customer(db, balance=0, assigned_to=user.id)
    prod = await make_product(db, created_by=user.id)

    body = OrderCreate(
        customer_id=cust.id,
        items=[_item(prod.id, 2, "50.00")],  # subtotal 100
        discount_type="percent",
        discount_value=Decimal("10"),  # 10% off -> 90
    )
    out = await services.orders.create_order(body, user.id)

    assert out.amount == Decimal("90.00")
    assert await _fresh_balance(services, cust.id) == Decimal("90.00")


@pytest.mark.asyncio
async def test_cash_payment_decreases_balance(db, services):
    user = await make_user(db)
    cust = await make_customer(db, balance="100.00", assigned_to=user.id)

    body = PaymentCreate(
        customer_id=cust.id,
        type=TransactionType.Payment_Cash,
        currency=Currency.ILS,
        amount=Decimal("40.00"),
    )
    out = await services.payments.create_payment(body, user.id)

    assert out.amount == Decimal("-40.00")  # stored negative
    assert await _fresh_balance(services, cust.id) == Decimal("60.00")


@pytest.mark.asyncio
async def test_delete_order_reverses_balance(db, services):
    user = await make_user(db)
    cust = await make_customer(db, balance=0, assigned_to=user.id)
    prod = await make_product(db, created_by=user.id)

    body = OrderCreate(customer_id=cust.id, items=[_item(prod.id, 5, "10.00")])
    out = await services.orders.create_order(body, user.id)
    assert await _fresh_balance(services, cust.id) == Decimal("50.00")

    await services.orders.delete_order(out.id, user.id)
    assert await _fresh_balance(services, cust.id) == Decimal("0.00")


@pytest.mark.asyncio
async def test_purchase_decreases_balance(db, services):
    user = await make_user(db)
    cust = await make_customer(db, balance="200.00", assigned_to=user.id)
    prod = await make_product(db, created_by=user.id, stock_qty=10)

    body = PurchaseCreate(
        customer_id=cust.id,
        items=[
            PurchaseItem(
                product_id=prod.id,
                name="Product",
                quantity=4,
                unit_price=Decimal("15.00"),
            )
        ],
    )
    out = await services.purchases.create_purchase(body, user.id)

    assert out.amount == Decimal("-60.00")
    assert out.type == TransactionType.Purchase
    assert await _fresh_balance(services, cust.id) == Decimal("140.00")


@pytest.mark.asyncio
async def test_returned_check_readds_debt(db, services):
    """A check payment lowers debt; returning that check re-adds it."""
    user = await make_user(db)
    cust = await make_customer(db, balance="500.00", assigned_to=user.id)

    pay = PaymentCreate(
        customer_id=cust.id,
        type=TransactionType.Payment_Check,
        currency=Currency.ILS,
        amount=Decimal("120.00"),
        data={
            "bank_number": "01",
            "branch_number": "02",
            "account_number": "03",
        },
    )
    check = await services.payments.create_payment(pay, user.id)
    assert await _fresh_balance(services, cust.id) == Decimal("380.00")

    ret = await services.payments.return_check(check.id, user.id)
    assert ret.type == TransactionType.Check_Return
    assert ret.amount == Decimal("120.00")  # positive — re-debits
    assert ret.related_transaction_id == check.id
    # 380 + 120 back = 500 again
    assert await _fresh_balance(services, cust.id) == Decimal("500.00")


@pytest.mark.asyncio
async def test_full_lifecycle_running_balance(db, services):
    """Order, partial payment, purchase — running balance stays exact."""
    user = await make_user(db)
    cust = await make_customer(db, balance=0, assigned_to=user.id)
    prod = await make_product(db, created_by=user.id, stock_qty=100)

    await services.orders.create_order(
        OrderCreate(customer_id=cust.id, items=[_item(prod.id, 10, "10.00")]),
        user.id,
    )
    assert await _fresh_balance(services, cust.id) == Decimal("100.00")

    await services.payments.create_payment(
        PaymentCreate(
            customer_id=cust.id,
            type=TransactionType.Payment_Cash,
            currency=Currency.ILS,
            amount=Decimal("30.00"),
        ),
        user.id,
    )
    assert await _fresh_balance(services, cust.id) == Decimal("70.00")

    await services.purchases.create_purchase(
        PurchaseCreate(
            customer_id=cust.id,
            items=[
                PurchaseItem(
                    product_id=prod.id,
                    name="Product",
                    quantity=2,
                    unit_price=Decimal("10.00"),
                )
            ],
        ),
        user.id,
    )
    assert await _fresh_balance(services, cust.id) == Decimal("50.00")
