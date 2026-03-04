import uuid

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import CurrentUser, PaymentSvc, require_admin, require_sales
from app.schemas.transaction import PaymentCreate, TransactionOut

router = APIRouter()


class ReturnCheckBody(BaseModel):
    notes: str | None = None


@router.post(
    "", response_model=TransactionOut, status_code=201, dependencies=[require_sales]
)
async def create_payment(
    body: PaymentCreate, current_user: CurrentUser, service: PaymentSvc
) -> TransactionOut:
    return await service.create_payment(body, uuid.UUID(current_user["sub"]))


@router.put(
    "/checks/{transaction_id}/status",
    response_model=TransactionOut,
    dependencies=[require_admin],
)
async def return_check(
    transaction_id: uuid.UUID, current_user: CurrentUser, service: PaymentSvc
) -> TransactionOut:
    return await service.return_check(transaction_id, uuid.UUID(current_user["sub"]))


@router.put(
    "/checks/{transaction_id}/deposit",
    response_model=TransactionOut,
    dependencies=[require_admin],
)
async def deposit_check(
    transaction_id: uuid.UUID,
    current_user: CurrentUser,
    service: PaymentSvc,
) -> TransactionOut:
    return await service.deposit_check(transaction_id, uuid.UUID(current_user["sub"]))


@router.put(
    "/checks/{transaction_id}/undeposit",
    response_model=TransactionOut,
    dependencies=[require_admin],
)
async def undeposit_check(
    transaction_id: uuid.UUID,
    current_user: CurrentUser,
    service: PaymentSvc,
) -> TransactionOut:
    return await service.undeposit_check(transaction_id, uuid.UUID(current_user["sub"]))


@router.put(
    "/checks/{transaction_id}/return",
    response_model=TransactionOut,
    dependencies=[require_admin],
)
async def return_check_admin(
    transaction_id: uuid.UUID,
    body: ReturnCheckBody,
    current_user: CurrentUser,
    service: PaymentSvc,
) -> TransactionOut:
    return await service.return_check(
        transaction_id, uuid.UUID(current_user["sub"]), body.notes
    )
