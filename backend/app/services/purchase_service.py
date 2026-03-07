import uuid
from decimal import Decimal

from sqlalchemy import select

from app.core.errors import HorizonException
from app.models.ledger import CompanyLedger
from app.models.product import Product
from app.models.transaction import Currency, Transaction, TransactionType
from app.repositories.customer_repository import CustomerRepository
from app.repositories.ledger_repository import LedgerRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import PurchaseCreate


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
        self, body: PurchaseCreate, creator_id: uuid.UUID
    ) -> Transaction:
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
        )

        # Credit customer (reduce debt)
        customer.balance -= total
        await self._customers.update_balance(customer)

        txn = await self._transactions.create(txn)

        # Update stock and WAC for each product
        for item in body.items:
            # Use FOR UPDATE to prevent race conditions on concurrent purchases
            result = await self._products._db.execute(
                select(Product)
                .where(Product.id == item.product_id, Product.is_deleted.is_(False))
                .with_for_update()
            )
            product = result.scalar_one_or_none()
            if product is None:
                raise HorizonException(404, f"Product {item.product_id} not found")

            old_qty = product.stock_qty or 0
            old_price = product.purchase_price or Decimal("0")

            product.stock_qty = old_qty + item.quantity

            # Weighted Average Cost recalculation
            new_total_qty = old_qty + item.quantity
            if new_total_qty > 0:
                product.purchase_price = (
                    old_qty * old_price + Decimal(str(item.quantity)) * item.unit_price
                ) / new_total_qty

            await self._products.update(product)

        # Create outgoing ledger entry
        ledger_entry = CompanyLedger(
            direction="outgoing",
            payment_method="cash",
            amount=total,
            rep_id=creator_id,
            customer_id=body.customer_id,
            source_transaction_id=txn.id,
            date=txn.created_at.date(),
            status="pending",
        )
        await self._ledger.create(ledger_entry)

        return txn
