import uuid
from decimal import Decimal

from app.core.errors import HorizonException
from app.models.transaction import (
    Transaction,
    TransactionStatus,
    TransactionType,
)
from app.repositories.customer_repository import CustomerRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import PaymentCreate, TransactionOut

_PAYMENT_TYPES = {TransactionType.Payment_Cash, TransactionType.Payment_Check}
_CHECK_TYPES = {TransactionType.Payment_Check}


class PaymentService:
    def __init__(
        self,
        customer_repo: CustomerRepository,
        transaction_repo: TransactionRepository,
    ):
        self._customers = customer_repo
        self._transactions = transaction_repo

    async def create_payment(
        self, body: PaymentCreate, creator_id: uuid.UUID
    ) -> TransactionOut:
        if body.type not in _PAYMENT_TYPES:
            raise HorizonException(400, "type must be Payment_Cash or Payment_Check")
        if body.amount <= 0:
            raise HorizonException(400, "amount must be positive")
        if body.type in _CHECK_TYPES and not body.data:
            raise HorizonException(400, "Check payments require data (bank, due_date)")

        customer = await self._customers.get_by_id(body.customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")

        txn = Transaction(
            customer_id=body.customer_id,
            created_by=creator_id,
            type=body.type,
            currency=body.currency,
            amount=-abs(body.amount),  # negative — reduces customer debt
            status=TransactionStatus.Pending if body.type in _CHECK_TYPES else None,
            data=body.data,
            notes=body.notes,
        )
        customer.balance -= abs(body.amount)
        await self._customers.update_balance(customer)
        txn = await self._transactions.create(txn)
        return TransactionOut.model_validate(txn)

    async def return_check(
        self, transaction_id: uuid.UUID, creator_id: uuid.UUID
    ) -> TransactionOut:
        check_txn = await self._transactions.get_by_id(transaction_id)
        if check_txn is None or check_txn.type != TransactionType.Payment_Check:
            raise HorizonException(404, "Check transaction not found")
        if check_txn.status == TransactionStatus.Returned:
            raise HorizonException(409, "Check is already marked as returned")

        check_txn.status = TransactionStatus.Returned

        original_amount = abs(check_txn.amount)
        return_txn = Transaction(
            customer_id=check_txn.customer_id,
            created_by=creator_id,
            type=TransactionType.Check_Return,
            currency=check_txn.currency,
            amount=original_amount,  # positive — re-debits customer
            related_transaction_id=check_txn.id,
            notes=f"Returned check #{check_txn.id}",
        )

        customer = await self._customers.get_by_id(check_txn.customer_id)
        customer.balance += original_amount
        await self._customers.update_balance(customer)
        await self._transactions.create_many([return_txn])

        return TransactionOut.model_validate(return_txn)
