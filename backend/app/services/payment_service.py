import uuid
from decimal import Decimal

from sqlalchemy.exc import IntegrityError

from app.core.errors import HorizonException

from app.models.transaction import (
    Currency,
    Transaction,
    TransactionStatus,
    TransactionType,
)
from app.models.ledger import CompanyLedger
from app.repositories.customer_repository import CustomerRepository
from app.repositories.ledger_repository import LedgerRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.admin import CheckOut
from app.schemas.transaction import DiscountCreate, PaymentCreate, TransactionOut
from app.utils.cache import CacheBackend

_PAYMENT_TYPES = {TransactionType.Payment_Cash, TransactionType.Payment_Check}
_CHECK_TYPES = {TransactionType.Payment_Check}
# Transactions a rep is allowed to soft-delete (reverse) themselves.
_REVERSIBLE_TYPES = _PAYMENT_TYPES | {TransactionType.Discount}


class PaymentService:
    def __init__(
        self,
        customer_repo: CustomerRepository,
        transaction_repo: TransactionRepository,
        ledger_repo: LedgerRepository,
        cache: CacheBackend,
    ):
        self._customers = customer_repo
        self._transactions = transaction_repo
        self._ledger = ledger_repo
        self._cache = cache

    async def _invalidate_customer_cache(self, customer_id: uuid.UUID) -> None:
        await self._cache.delete(f"insights:{customer_id}")
        await self._cache.invalidate_prefix("route:")

    async def create_payment(
        self,
        body: PaymentCreate,
        creator_id: uuid.UUID,
        idempotency_key: str | None = None,
    ) -> TransactionOut:
        # Durable dedupe: a retried offline mutation carries the same key.
        if idempotency_key is not None:
            existing = await self._transactions.get_by_idempotency_key(idempotency_key)
            if existing is not None:
                return TransactionOut.model_validate(existing)

        if body.type not in _PAYMENT_TYPES:
            raise HorizonException(400, "type must be Payment_Cash or Payment_Check")
        if body.amount <= 0:
            raise HorizonException(400, "amount must be positive")
        if body.type in _CHECK_TYPES:
            if not body.data:
                raise HorizonException(400, "Check payments require check data")
            if not body.data.bank_number:
                raise HorizonException(
                    400, "bank_number is required for check payments"
                )
            if not body.data.branch_number:
                raise HorizonException(
                    400, "branch_number is required for check payments"
                )
            if not body.data.account_number:
                raise HorizonException(
                    400, "account_number is required for check payments"
                )

        # Validate exchange rate for foreign currencies
        if body.currency != Currency.ILS:
            if not body.exchange_rate or body.exchange_rate <= 0:
                raise HorizonException(
                    400, "exchange_rate is required for non-ILS currencies"
                )

        customer = await self._customers.get_by_id(body.customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")

        # Compute ILS equivalent for balance update
        if body.currency != Currency.ILS and body.exchange_rate:
            ils_amount = abs(body.amount) * body.exchange_rate
        else:
            ils_amount = abs(body.amount)

        # Store exchange rate in data JSONB
        data_dict = body.data.model_dump(exclude_none=True) if body.data else {}
        if body.exchange_rate:
            data_dict["exchange_rate"] = float(body.exchange_rate)

        txn = Transaction(
            customer_id=body.customer_id,
            created_by=creator_id,
            type=body.type,
            currency=body.currency,
            amount=-ils_amount,  # negative ILS equivalent — reduces customer debt
            status=TransactionStatus.Pending if body.type in _CHECK_TYPES else None,
            data=data_dict or None,
            notes=body.notes,
            idempotency_key=idempotency_key,
        )

        # Atomic: flush all three, then commit together
        try:
            txn = await self._transactions.create(txn, auto_commit=False)
            await self._customers.apply_balance_delta(customer, -ils_amount)

            ledger_entry = CompanyLedger(
                direction="incoming",
                payment_method=(
                    "cash" if body.type == TransactionType.Payment_Cash else "check"
                ),
                amount=ils_amount,
                rep_id=creator_id,
                customer_id=body.customer_id,
                source_transaction_id=txn.id,
                date=txn.created_at.date(),
                status="pending",
            )
            await self._ledger.create(ledger_entry)
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

    async def create_discount(
        self,
        body: DiscountCreate,
        creator_id: uuid.UUID,
        idempotency_key: str | None = None,
    ) -> TransactionOut:
        """Forgive part of a customer's outstanding balance (settling / fractions).

        Recorded as a negative ``Discount`` transaction — it reduces the balance
        but is never counted as money collected and writes no ledger entry.
        """
        # Durable dedupe: a retried offline mutation carries the same key.
        if idempotency_key is not None:
            existing = await self._transactions.get_by_idempotency_key(idempotency_key)
            if existing is not None:
                return TransactionOut.model_validate(existing)

        if body.amount <= 0:
            raise HorizonException(400, "amount must be positive")

        customer = await self._customers.get_by_id(body.customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")

        # A discount only settles what's owed — never push the balance into credit.
        if body.amount > customer.balance:
            raise HorizonException(
                400, "Discount cannot exceed the customer's outstanding balance"
            )

        txn = Transaction(
            customer_id=body.customer_id,
            created_by=creator_id,
            type=TransactionType.Discount,
            currency=Currency.ILS,
            amount=-body.amount,  # negative — reduces debt, not a payment
            notes=body.notes,
            idempotency_key=idempotency_key,
        )

        # Atomic: flush txn + balance, then commit together.
        try:
            txn = await self._transactions.create(txn, auto_commit=False)
            await self._customers.apply_balance_delta(customer, -body.amount)
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

    async def delete_payment(
        self, transaction_id: uuid.UUID, user_id: uuid.UUID
    ) -> TransactionOut:
        """Soft-delete a payment or discount the rep entered and reverse its effects."""
        txn = await self._transactions.get_by_id(transaction_id)
        if txn is None or txn.type not in _REVERSIBLE_TYPES:
            raise HorizonException(404, "Payment not found")
        if txn.created_by != user_id:
            raise HorizonException(403, "You can only delete entries you created")
        if (
            txn.type in _CHECK_TYPES
            and txn.status is not None
            and txn.status != TransactionStatus.Pending
        ):
            raise HorizonException(
                409, "This check has already been processed and cannot be deleted"
            )

        # Block deletion once admin has confirmed the money in the daily cash report.
        ledger_entry = await self._ledger.get_by_source_transaction(txn.id)
        if ledger_entry is not None and ledger_entry.status == "confirmed":
            raise HorizonException(
                409, "Payment already confirmed by admin and cannot be deleted"
            )

        customer = await self._customers.get_by_id(txn.customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")

        # Atomic: reverse balance + soft-delete txn, then commit together.
        # txn.amount is negative (a payment), so subtracting it restores the debt.
        await self._customers.apply_balance_delta(customer, -txn.amount)
        txn.is_deleted = True
        txn = await self._transactions.update(txn, auto_commit=False)
        if ledger_entry is not None:
            await self._ledger.soft_delete(ledger_entry.id)
        await self._transactions.update(txn)  # commit
        await self._invalidate_customer_cache(txn.customer_id)
        return TransactionOut.model_validate(txn)

    async def deposit_check(
        self, transaction_id: uuid.UUID, creator_id: uuid.UUID
    ) -> TransactionOut:
        check_txn = await self._transactions.get_by_id(transaction_id)
        if check_txn is None or check_txn.type != TransactionType.Payment_Check:
            raise HorizonException(404, "Check transaction not found")
        if check_txn.status != TransactionStatus.Pending:
            raise HorizonException(409, "Only Pending checks can be deposited")
        check_txn.status = TransactionStatus.Deposited
        check_txn = await self._transactions.update(check_txn)
        return TransactionOut.model_validate(check_txn)

    async def undeposit_check(
        self, transaction_id: uuid.UUID, creator_id: uuid.UUID
    ) -> TransactionOut:
        check_txn = await self._transactions.get_by_id(transaction_id)
        if check_txn is None or check_txn.type != TransactionType.Payment_Check:
            raise HorizonException(404, "Check transaction not found")
        if check_txn.status != TransactionStatus.Deposited:
            raise HorizonException(409, "Only Deposited checks can be undeposited")
        check_txn.status = TransactionStatus.Pending
        check_txn = await self._transactions.update(check_txn)
        return TransactionOut.model_validate(check_txn)

    async def return_check(
        self, transaction_id: uuid.UUID, creator_id: uuid.UUID, notes: str | None = None
    ) -> TransactionOut:
        check_txn = await self._transactions.get_by_id(transaction_id)
        if check_txn is None or check_txn.type != TransactionType.Payment_Check:
            raise HorizonException(404, "Check transaction not found")
        if check_txn.status == TransactionStatus.Returned:
            raise HorizonException(409, "Check is already marked as returned")

        check_txn.status = TransactionStatus.Returned
        await self._transactions.update(check_txn, auto_commit=False)

        original_amount = abs(check_txn.amount)
        return_txn = Transaction(
            customer_id=check_txn.customer_id,
            created_by=creator_id,
            type=TransactionType.Check_Return,
            currency=check_txn.currency,
            amount=original_amount,  # positive — re-debits customer
            related_transaction_id=check_txn.id,
            notes=notes or f"Returned check #{check_txn.id}",
        )

        # Atomic: flush return txn + balance update, then commit together
        customer = await self._customers.get_by_id(check_txn.customer_id)
        await self._customers.apply_balance_delta(customer, original_amount)
        await self._transactions.create(return_txn)
        await self._invalidate_customer_cache(check_txn.customer_id)

        return TransactionOut.model_validate(return_txn)

    async def get_customer_returned_checks(
        self, customer_id: uuid.UUID
    ) -> list[CheckOut]:
        rows = await self._transactions.get_returned_checks_for_customer(customer_id)
        return [
            CheckOut(
                id=row.Transaction.id,
                customer_id=row.Transaction.customer_id,
                customer_name=row.customer_name,
                type=row.Transaction.type,
                currency=row.Transaction.currency,
                amount=row.Transaction.amount,
                status=row.Transaction.status,
                notes=row.Transaction.notes,
                data=row.Transaction.data,
                created_at=row.Transaction.created_at,
                related_transaction_id=row.Transaction.related_transaction_id,
            )
            for row in rows
        ]
