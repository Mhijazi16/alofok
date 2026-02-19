import uuid
from decimal import Decimal

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_sales
from app.core.errors import HorizonException
from app.models.customer import Customer
from app.models.transaction import (
    Currency,
    Transaction,
    TransactionStatus,
    TransactionType,
)
from app.schemas.transaction import PaymentCreate, TransactionOut

router = APIRouter()

_PAYMENT_TYPES = {TransactionType.Payment_Cash, TransactionType.Payment_Check}
_CHECK_TYPES = {TransactionType.Payment_Check}


@router.post("", response_model=TransactionOut, status_code=201, dependencies=[require_sales])
async def create_payment(
    body: PaymentCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> TransactionOut:
    if body.type not in _PAYMENT_TYPES:
        raise HorizonException(400, "type must be Payment_Cash or Payment_Check")

    if body.amount <= 0:
        raise HorizonException(400, "amount must be positive")

    result = await db.execute(
        select(Customer).where(Customer.id == body.customer_id, Customer.is_deleted.is_(False))
    )
    customer = result.scalar_one_or_none()
    if customer is None:
        raise HorizonException(404, "Customer not found")

    if body.type in _CHECK_TYPES and not body.data:
        raise HorizonException(400, "Check payments require data (bank, due_date)")

    txn = Transaction(
        customer_id=body.customer_id,
        created_by=uuid.UUID(current_user["sub"]),
        type=body.type,
        currency=body.currency,
        amount=-abs(body.amount),   # negative — reduces customer debt
        status=TransactionStatus.Pending if body.type in _CHECK_TYPES else None,
        data=body.data,
        notes=body.notes,
    )
    db.add(txn)
    customer.balance -= abs(body.amount)

    await db.commit()
    await db.refresh(txn)
    return TransactionOut.model_validate(txn)


@router.put("/checks/{transaction_id}/status", response_model=TransactionOut)
async def return_check(
    transaction_id: uuid.UUID,
    current_user: CurrentUser,
    db: DbSession,
) -> TransactionOut:
    """
    Mark a check as Returned.
    Creates a Check_Return transaction that re-debits the customer for the original amount,
    and links it back via related_transaction_id.
    """
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.type == TransactionType.Payment_Check,
            Transaction.is_deleted.is_(False),
        )
    )
    check_txn = result.scalar_one_or_none()
    if check_txn is None:
        raise HorizonException(404, "Check transaction not found")

    if check_txn.status == TransactionStatus.Returned:
        raise HorizonException(409, "Check is already marked as returned")

    # Mark original check as returned
    check_txn.status = TransactionStatus.Returned

    # Re-debit the customer (positive amount = increases debt)
    original_amount = abs(check_txn.amount)
    return_txn = Transaction(
        customer_id=check_txn.customer_id,
        created_by=uuid.UUID(current_user["sub"]),
        type=TransactionType.Check_Return,
        currency=check_txn.currency,
        amount=original_amount,
        related_transaction_id=check_txn.id,
        notes=f"Returned check #{check_txn.id}",
    )
    db.add(return_txn)

    # Update customer balance
    cust_result = await db.execute(
        select(Customer).where(Customer.id == check_txn.customer_id)
    )
    customer = cust_result.scalar_one()
    customer.balance += original_amount

    await db.commit()
    await db.refresh(return_txn)
    return TransactionOut.model_validate(return_txn)
