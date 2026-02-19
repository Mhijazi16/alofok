import uuid
from decimal import Decimal

from fastapi import APIRouter
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession, require_sales
from app.core.errors import HorizonException
from app.models.customer import Customer
from app.models.transaction import Currency, Transaction, TransactionType
from app.schemas.transaction import OrderCreate, TransactionOut

router = APIRouter()


@router.post("", response_model=TransactionOut, status_code=201, dependencies=[require_sales])
async def create_order(
    body: OrderCreate,
    current_user: CurrentUser,
    db: DbSession,
) -> TransactionOut:
    result = await db.execute(
        select(Customer).where(Customer.id == body.customer_id, Customer.is_deleted.is_(False))
    )
    customer = result.scalar_one_or_none()
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
        created_by=uuid.UUID(current_user["sub"]),
        type=TransactionType.Order,
        currency=Currency.ILS,
        amount=total,           # positive — increases customer debt
        data={"items": body.items},
        notes=body.notes,
    )
    db.add(txn)
    customer.balance += total

    await db.commit()
    await db.refresh(txn)
    return TransactionOut.model_validate(txn)
