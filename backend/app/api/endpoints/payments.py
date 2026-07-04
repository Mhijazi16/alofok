import os
import uuid

import aiofiles
from fastapi import APIRouter, File, Header, UploadFile
from pydantic import BaseModel

from app.api.deps import CurrentUser, PaymentSvc, require_admin, require_sales
from app.schemas.transaction import DiscountCreate, PaymentCreate, TransactionOut

router = APIRouter()

CHECKS_UPLOAD_DIR = "static/checks"


class ReturnCheckBody(BaseModel):
    notes: str | None = None


@router.post(
    "/checks/upload-image",
    response_model=dict,
    status_code=201,
    dependencies=[require_sales],
)
async def upload_check_image(file: UploadFile = File(...)) -> dict:
    os.makedirs(CHECKS_UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1] or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    path = os.path.join(CHECKS_UPLOAD_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        content = await file.read()
        await f.write(content)
    return {"url": f"/static/checks/{filename}"}


@router.post(
    "", response_model=TransactionOut, status_code=201, dependencies=[require_sales]
)
async def create_payment(
    body: PaymentCreate,
    current_user: CurrentUser,
    service: PaymentSvc,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> TransactionOut:
    return await service.create_payment(
        body, uuid.UUID(current_user["sub"]), idempotency_key
    )


@router.post(
    "/discount",
    response_model=TransactionOut,
    status_code=201,
    dependencies=[require_sales],
)
async def create_discount(
    body: DiscountCreate,
    current_user: CurrentUser,
    service: PaymentSvc,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> TransactionOut:
    return await service.create_discount(
        body, uuid.UUID(current_user["sub"]), idempotency_key
    )


@router.delete(
    "/{transaction_id}",
    response_model=TransactionOut,
    dependencies=[require_sales],
)
async def delete_payment(
    transaction_id: uuid.UUID, current_user: CurrentUser, service: PaymentSvc
) -> TransactionOut:
    return await service.delete_payment(transaction_id, uuid.UUID(current_user["sub"]))


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
