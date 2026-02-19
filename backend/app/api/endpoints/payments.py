import uuid

from fastapi import APIRouter

from app.api.deps import CurrentUser, PaymentSvc, require_sales
from app.schemas.transaction import PaymentCreate, TransactionOut

router = APIRouter()


@router.post(
    "", response_model=TransactionOut, status_code=201, dependencies=[require_sales]
)
async def create_payment(
    body: PaymentCreate, current_user: CurrentUser, service: PaymentSvc
) -> TransactionOut:
    return await service.create_payment(body, uuid.UUID(current_user["sub"]))


@router.put("/checks/{transaction_id}/status", response_model=TransactionOut)
async def return_check(
    transaction_id: uuid.UUID, current_user: CurrentUser, service: PaymentSvc
) -> TransactionOut:
    return await service.return_check(transaction_id, uuid.UUID(current_user["sub"]))
