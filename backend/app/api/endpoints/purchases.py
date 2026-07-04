import uuid

from fastapi import APIRouter, Header

from app.api.deps import CurrentUser, PurchaseSvc, require_sales
from app.schemas.transaction import PurchaseCreate, TransactionOut

router = APIRouter()


@router.post(
    "", response_model=TransactionOut, status_code=201, dependencies=[require_sales]
)
async def create_purchase(
    body: PurchaseCreate,
    current_user: CurrentUser,
    service: PurchaseSvc,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> TransactionOut:
    txn = await service.create_purchase(
        body, uuid.UUID(current_user["sub"]), idempotency_key
    )
    return TransactionOut.model_validate(txn)
