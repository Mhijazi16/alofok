"""Settlement (تسوية) tests — re-anchoring a balance to an agreed figure.

The rep enters the balance he and the customer agreed on face to face. The
service posts the DIFFERENCE as an ``Opening_Balance`` transaction, so the
statement gets a fresh "opening balance" line, the running balance lands
exactly on the agreed figure, and earlier history is untouched.
"""

from decimal import Decimal

import pytest

from app.core.errors import HorizonException
from app.models.transaction import TransactionType
from app.schemas.transaction import SettlementCreate
from app.services._statement import build_statement
from tests.conftest import make_customer, make_user


@pytest.mark.asyncio
async def test_settlement_moves_balance_to_agreed_figure(db, services):
    user = await make_user(db)
    cust = await make_customer(db, balance=Decimal("2847"), assigned_to=user.id)

    txn = await services.payments.create_settlement(
        SettlementCreate(customer_id=cust.id, agreed_balance=Decimal("3000")),
        user.id,
    )

    assert txn.type == TransactionType.Opening_Balance
    assert txn.amount == Decimal("153")  # the delta, not the agreed total
    fresh = await services.customers.get_by_id(cust.id)
    assert fresh.balance == Decimal("3000")


@pytest.mark.asyncio
async def test_settlement_can_reduce_a_balance(db, services):
    user = await make_user(db)
    cust = await make_customer(db, balance=Decimal("5000"), assigned_to=user.id)

    txn = await services.payments.create_settlement(
        SettlementCreate(customer_id=cust.id, agreed_balance=Decimal("4200")),
        user.id,
    )

    assert txn.amount == Decimal("-800")
    fresh = await services.customers.get_by_id(cust.id)
    assert fresh.balance == Decimal("4200")


@pytest.mark.asyncio
async def test_settlement_accepts_a_credit_balance(db, services):
    """Negative == we owe the customer; that must be settleable too."""
    user = await make_user(db)
    cust = await make_customer(db, balance=Decimal("100"), assigned_to=user.id)

    await services.payments.create_settlement(
        SettlementCreate(customer_id=cust.id, agreed_balance=Decimal("-250")),
        user.id,
    )

    fresh = await services.customers.get_by_id(cust.id)
    assert fresh.balance == Decimal("-250")


@pytest.mark.asyncio
async def test_settlement_records_the_agreed_and_previous_figures(db, services):
    user = await make_user(db)
    cust = await make_customer(db, balance=Decimal("2847"), assigned_to=user.id)

    txn = await services.payments.create_settlement(
        SettlementCreate(
            customer_id=cust.id, agreed_balance=Decimal("3000"), notes="تسوية مع العميل"
        ),
        user.id,
    )

    assert txn.data["settlement"] is True
    assert Decimal(txn.data["agreed_balance"]) == Decimal("3000")
    assert Decimal(txn.data["previous_balance"]) == Decimal("2847")
    assert txn.notes == "تسوية مع العميل"


@pytest.mark.asyncio
async def test_settlement_matching_current_balance_is_rejected(db, services):
    user = await make_user(db)
    cust = await make_customer(db, balance=Decimal("3000"), assigned_to=user.id)

    with pytest.raises(HorizonException):
        await services.payments.create_settlement(
            SettlementCreate(customer_id=cust.id, agreed_balance=Decimal("3000")),
            user.id,
        )


@pytest.mark.asyncio
async def test_settlement_is_idempotent(db, services):
    """A retried offline settlement must not move the balance twice."""
    user = await make_user(db)
    cust = await make_customer(db, balance=Decimal("1000"), assigned_to=user.id)

    first = await services.payments.create_settlement(
        SettlementCreate(customer_id=cust.id, agreed_balance=Decimal("1500")),
        user.id,
        "settle-key-1",
    )
    second = await services.payments.create_settlement(
        SettlementCreate(customer_id=cust.id, agreed_balance=Decimal("1500")),
        user.id,
        "settle-key-1",
    )

    assert first.id == second.id
    fresh = await services.customers.get_by_id(cust.id)
    assert fresh.balance == Decimal("1500")


@pytest.mark.asyncio
async def test_statement_running_balance_lands_on_the_agreed_figure(db, services):
    """The whole point: the statement's running total equals what was agreed."""
    user = await make_user(db)
    cust = await make_customer(db, balance=Decimal("2847"), assigned_to=user.id)
    # Stand in for the pre-existing history that produced the 2,847 balance.
    from app.models.transaction import Currency, Transaction

    db.add(
        Transaction(
            customer_id=cust.id,
            created_by=user.id,
            type=TransactionType.Opening_Balance,
            currency=Currency.ILS,
            amount=Decimal("2847"),
        )
    )
    await db.flush()

    await services.payments.create_settlement(
        SettlementCreate(customer_id=cust.id, agreed_balance=Decimal("3000")),
        user.id,
    )

    txns = await services.transactions.get_for_customer(cust.id)
    statement = build_statement(cust.id, txns)
    assert statement.closing_balance == Decimal("3000")
    # History is preserved, not rewritten.
    assert len(statement.entries) == 2
