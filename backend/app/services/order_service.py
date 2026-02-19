import uuid
from decimal import Decimal

from app.core.errors import HorizonException
from app.models.transaction import Currency, Transaction, TransactionType
from app.repositories.customer_repository import CustomerRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.transaction import OrderCreate, TransactionOut


class OrderService:
    def __init__(
        self,
        customer_repo: CustomerRepository,
        transaction_repo: TransactionRepository,
    ):
        self._customers = customer_repo
        self._transactions = transaction_repo

    async def create_order(self, body: OrderCreate, creator_id: uuid.UUID) -> TransactionOut:
        customer = await self._customers.get_by_id(body.customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")

        if not body.items:
            raise HorizonException(400, "Order must contain at least one item")

        total = sum(
            Decimal(str(item.get("quantity", 1))) * Decimal(str(item.get("unit_price", "0")))
            for item in body.items
        )

        txn = Transaction(
            customer_id=body.customer_id,
            created_by=creator_id,
            type=TransactionType.Order,
            currency=Currency.ILS,
            amount=total,           # positive — increases customer debt
            data={"items": body.items},
            notes=body.notes,
        )
        customer.balance += total
        await self._customers.update_balance(customer)
        txn = await self._transactions.create(txn)
        return TransactionOut.model_validate(txn)
