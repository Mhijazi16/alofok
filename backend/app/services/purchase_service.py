import uuid
from decimal import Decimal

from sqlalchemy.exc import IntegrityError

from app.core.errors import HorizonException
from app.models.ledger import CompanyLedger
from app.models.transaction import Currency, Transaction, TransactionType
from app.repositories.customer_repository import CustomerRepository
from app.repositories.ledger_repository import LedgerRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import PurchaseCreate, TransactionOut


class PurchaseService:
    def __init__(
        self,
        customer_repo: CustomerRepository,
        transaction_repo: TransactionRepository,
        product_repo: ProductRepository,
        ledger_repo: LedgerRepository,
    ):
        self._customers = customer_repo
        self._transactions = transaction_repo
        self._products = product_repo
        self._ledger = ledger_repo

    async def create_purchase(
        self,
        body: PurchaseCreate,
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

        total = sum(
            Decimal(str(item.quantity)) * item.unit_price for item in body.items
        )

        # Create transaction with negative amount (credits customer per signed-amount convention)
        txn = Transaction(
            customer_id=body.customer_id,
            created_by=creator_id,
            type=TransactionType.Purchase,
            currency=Currency.ILS,
            amount=-total,
            data={"items": [item.model_dump(mode="json") for item in body.items]},
            notes=body.notes,
            idempotency_key=idempotency_key,
        )

        # Atomic: flush transaction + balance + stock updates, commit via ledger.create
        try:
            txn = await self._transactions.create(txn, auto_commit=False)

            await self._customers.apply_balance_delta(customer, -total)

            # Update stock and WAC for each product
            for item in body.items:
                product = await self._products.get_by_id_for_update(item.product_id)
                if product is None:
                    raise HorizonException(404, f"Product {item.product_id} not found")

                old_qty = product.stock_qty or 0
                old_price = product.purchase_price or Decimal("0")

                product.stock_qty = old_qty + item.quantity

                # Weighted Average Cost recalculation
                new_total_qty = old_qty + item.quantity
                if new_total_qty > 0:
                    product.purchase_price = (
                        old_qty * old_price
                        + Decimal(str(item.quantity)) * item.unit_price
                    ) / new_total_qty

                await self._products.update(product)

            # Create outgoing ledger entry with item summary — this commits everything
            item_summary = ", ".join(
                f"{item.quantity}x {item.name}" for item in body.items
            )
            ledger_entry = CompanyLedger(
                direction="outgoing",
                payment_method="cash",
                amount=total,
                rep_id=creator_id,
                customer_id=body.customer_id,
                source_transaction_id=txn.id,
                date=txn.created_at.date(),
                status="pending",
                notes=item_summary,
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

        return TransactionOut.model_validate(txn)
