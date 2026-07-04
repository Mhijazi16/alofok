"""Payment-check state-machine tests: deposit / undeposit / return + guards."""

from decimal import Decimal

import pytest

from app.core.errors import HorizonException
from app.models.transaction import (
    Currency,
    TransactionStatus,
    TransactionType,
)
from app.schemas.transaction import PaymentCreate
from tests.conftest import make_customer, make_user


async def _make_check(db, services, amount="100.00"):
    user = await make_user(db)
    cust = await make_customer(db, balance="500.00", assigned_to=user.id)
    body = PaymentCreate(
        customer_id=cust.id,
        type=TransactionType.Payment_Check,
        currency=Currency.ILS,
        amount=Decimal(amount),
        data={"bank_number": "01", "branch_number": "02", "account_number": "03"},
    )
    check = await services.payments.create_payment(body, user.id)
    return user, cust, check


async def _status(services, txn_id):
    return (await services.transactions.get_by_id(txn_id)).status


async def _balance(services, cid):
    return (await services.customers.get_by_id(cid)).balance


@pytest.mark.asyncio
async def test_new_check_is_pending(db, services):
    _, _, check = await _make_check(db, services)
    assert check.status == TransactionStatus.Pending


@pytest.mark.asyncio
async def test_deposit_then_undeposit(db, services):
    user, _, check = await _make_check(db, services)

    dep = await services.payments.deposit_check(check.id, user.id)
    assert dep.status == TransactionStatus.Deposited

    undep = await services.payments.undeposit_check(check.id, user.id)
    assert undep.status == TransactionStatus.Pending


@pytest.mark.asyncio
async def test_cannot_deposit_non_pending(db, services):
    user, _, check = await _make_check(db, services)
    await services.payments.deposit_check(check.id, user.id)
    # already Deposited — depositing again is invalid
    with pytest.raises(HorizonException) as e:
        await services.payments.deposit_check(check.id, user.id)
    assert e.value.status_code == 409


@pytest.mark.asyncio
async def test_cannot_undeposit_pending(db, services):
    user, _, check = await _make_check(db, services)
    with pytest.raises(HorizonException) as e:
        await services.payments.undeposit_check(check.id, user.id)
    assert e.value.status_code == 409


@pytest.mark.asyncio
async def test_return_check_sets_status_and_rebalances(db, services):
    user, cust, check = await _make_check(db, services, amount="100.00")
    # check reduced 500 -> 400
    assert await _balance(services, cust.id) == Decimal("400.00")

    ret = await services.payments.return_check(check.id, user.id)

    # original check flips to Returned
    assert await _status(services, check.id) == TransactionStatus.Returned
    # a Check_Return txn re-adds the debt
    assert ret.type == TransactionType.Check_Return
    assert ret.amount == Decimal("100.00")
    assert await _balance(services, cust.id) == Decimal("500.00")


@pytest.mark.asyncio
async def test_return_after_deposit_allowed(db, services):
    user, cust, check = await _make_check(db, services, amount="100.00")
    await services.payments.deposit_check(check.id, user.id)

    ret = await services.payments.return_check(check.id, user.id)
    assert await _status(services, check.id) == TransactionStatus.Returned
    assert await _balance(services, cust.id) == Decimal("500.00")
    assert ret.related_transaction_id == check.id


@pytest.mark.asyncio
async def test_cannot_return_already_returned(db, services):
    user, _, check = await _make_check(db, services)
    await services.payments.return_check(check.id, user.id)
    with pytest.raises(HorizonException) as e:
        await services.payments.return_check(check.id, user.id)
    assert e.value.status_code == 409


@pytest.mark.asyncio
async def test_deposit_missing_check_404(db, services):
    import uuid

    user = await make_user(db)
    with pytest.raises(HorizonException) as e:
        await services.payments.deposit_check(uuid.uuid4(), user.id)
    assert e.value.status_code == 404
