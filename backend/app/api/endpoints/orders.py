import uuid

from fastapi import APIRouter

from app.api.deps import Cache, CurrentUser, OrderSvc, require_sales
from app.schemas.transaction import OrderCreate, OrderUpdate, TransactionOut

router = APIRouter()


@router.post(
    "", response_model=TransactionOut, status_code=201, dependencies=[require_sales]
)
async def create_order(
    body: OrderCreate, current_user: CurrentUser, service: OrderSvc, cache: Cache
) -> TransactionOut:
    result = await service.create_order(body, uuid.UUID(current_user["sub"]))
    await cache.delete(f"insights:{body.customer_id}")
    return result


@router.put("/{order_id}", response_model=TransactionOut, dependencies=[require_sales])
async def update_order(
    order_id: uuid.UUID,
    body: OrderUpdate,
    current_user: CurrentUser,
    service: OrderSvc,
) -> TransactionOut:
    return await service.update_order(order_id, uuid.UUID(current_user["sub"]), body)


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


@router.put(
    "/{order_id}/deliver",
    response_model=TransactionOut,
    dependencies=[require_sales],
)
async def deliver_order(
    order_id: uuid.UUID, current_user: CurrentUser, service: OrderSvc
) -> TransactionOut:
    return await service.confirm_delivery(order_id, uuid.UUID(current_user["sub"]))


@router.delete(
    "/{order_id}",
    response_model=TransactionOut,
    dependencies=[require_sales],
)
async def delete_order(
    order_id: uuid.UUID, current_user: CurrentUser, service: OrderSvc
) -> TransactionOut:
    return await service.delete_order(order_id, uuid.UUID(current_user["sub"]))


@router.put(
    "/{order_id}/undeliver",
    response_model=TransactionOut,
    dependencies=[require_sales],
)
async def undeliver_order(
    order_id: uuid.UUID, current_user: CurrentUser, service: OrderSvc
) -> TransactionOut:
    return await service.undeliver_order(order_id, uuid.UUID(current_user["sub"]))
