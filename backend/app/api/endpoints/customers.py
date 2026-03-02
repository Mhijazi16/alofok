import uuid
from datetime import date
from pathlib import Path
from uuid import UUID

import aiofiles
from fastapi import APIRouter, Query, UploadFile

from app.api.deps import CurrentUser, CustomerSvc, require_sales
from app.schemas.customer import (
    CustomerCreate,
    CustomerInsightsOut,
    CustomerOut,
    CustomerUpdate,
)
from app.schemas.transaction import StatementOut

router = APIRouter()


@router.post("/upload-avatar", response_model=dict, dependencies=[require_sales])
async def upload_avatar(file: UploadFile):
    ext = Path(file.filename).suffix or ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    path = Path("static/avatars") / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    async with aiofiles.open(path, "wb") as f:
        await f.write(await file.read())
    return {"url": f"/static/avatars/{filename}"}


@router.post(
    "/", response_model=CustomerOut, status_code=201, dependencies=[require_sales]
)
async def create_customer(
    body: CustomerCreate, current_user: CurrentUser, service: CustomerSvc
):
    return await service.create_customer(body, UUID(current_user["sub"]))


@router.put("/{customer_id}", response_model=CustomerOut, dependencies=[require_sales])
async def update_customer(
    customer_id: UUID,
    body: CustomerUpdate,
    current_user: CurrentUser,
    service: CustomerSvc,
):
    return await service.update_customer(
        customer_id, body, UUID(current_user["sub"]), current_user["role"]
    )


@router.get("/my-route", response_model=list[CustomerOut])
async def my_route(
    current_user: CurrentUser, service: CustomerSvc
) -> list[CustomerOut]:
    return await service.get_route(current_user["sub"])


@router.get("/{customer_id}/insights", response_model=CustomerInsightsOut)
async def customer_insights(
    customer_id: uuid.UUID, service: CustomerSvc
) -> CustomerInsightsOut:
    return await service.get_insights(customer_id)


@router.get("/{customer_id}/statement", response_model=StatementOut)
async def customer_statement(
    customer_id: uuid.UUID,
    service: CustomerSvc,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    since_zero_balance: bool = Query(False),
) -> StatementOut:
    return await service.get_statement(
        customer_id, start_date, end_date, since_zero_balance
    )
