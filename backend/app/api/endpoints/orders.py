import uuid

from fastapi import APIRouter

from app.api.deps import CurrentUser, OrderSvc, require_sales
from app.schemas.transaction import OrderCreate, TransactionOut

router = APIRouter()


@router.post(
    "", response_model=TransactionOut, status_code=201, dependencies=[require_sales]
)
async def create_order(
    body: OrderCreate, current_user: CurrentUser, service: OrderSvc
) -> TransactionOut:
    return await service.create_order(body, uuid.UUID(current_user["sub"]))


@router.put(
    "/{order_id}/confirm",
    response_model=TransactionOut,
    dependencies=[require_sales],
)
async def confirm_draft(
    order_id: uuid.UUID, current_user: CurrentUser, service: OrderSvc
) -> TransactionOut:
    return await service.confirm_draft(order_id, uuid.UUID(current_user["sub"]))


@router.put(
    "/{order_id}/reject",
    response_model=TransactionOut,
    dependencies=[require_sales],
)
async def reject_draft(
    order_id: uuid.UUID, current_user: CurrentUser, service: OrderSvc
) -> TransactionOut:
    return await service.reject_draft(order_id, uuid.UUID(current_user["sub"]))
