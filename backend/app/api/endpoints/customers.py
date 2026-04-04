import uuid
from datetime import date
from pathlib import Path
from uuid import UUID

import aiofiles
from fastapi import APIRouter, Query, UploadFile

from app.api.deps import CurrentUser, CustomerSvc, PaymentSvc, require_sales
from app.schemas.customer import (
    CustomerCreate,
    CustomerInsightsOut,
    CustomerOut,
    CustomerUpdate,
)
from app.models.customer import AssignedDay
from app.schemas.admin import CheckOut
from app.schemas.transaction import OrderWithCustomerOut, StatementOut, TransactionOut

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
    "", response_model=CustomerOut, status_code=201, dependencies=[require_sales]
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


@router.patch(
    "/{customer_id}/archive",
    status_code=204,
    dependencies=[require_sales],
)
async def archive_customer(
    customer_id: UUID,
    current_user: CurrentUser,
    service: CustomerSvc,
):
    await service.archive_customer(
        customer_id, UUID(current_user["sub"]), current_user["role"]
    )


@router.get("/my-route", response_model=list[CustomerOut])
async def my_route(
    current_user: CurrentUser, service: CustomerSvc
) -> list[CustomerOut]:
    return await service.get_route(current_user["sub"])


@router.get(
    "/by-day/{day}",
    response_model=list[CustomerOut],
    dependencies=[require_sales],
)
async def customers_by_day(
    day: AssignedDay,
    current_user: CurrentUser,
    service: CustomerSvc,
    delivery_date: date | None = Query(None),
) -> list[CustomerOut]:
    return await service.get_route_by_day(UUID(current_user["sub"]), day, delivery_date)


@router.get(
    "/my-customers",
    response_model=list[CustomerOut],
    dependencies=[require_sales],
)
async def my_customers(
    current_user: CurrentUser, service: CustomerSvc
) -> list[CustomerOut]:
    return await service.get_all_customers(UUID(current_user["sub"]))


@router.get(
    "/my-orders-today",
    response_model=list[OrderWithCustomerOut],
    dependencies=[require_sales],
)
async def my_orders_today(
    current_user: CurrentUser, service: CustomerSvc
) -> list[OrderWithCustomerOut]:
    return await service.get_my_orders_today(UUID(current_user["sub"]))


@router.get(
    "/delivery-orders",
    response_model=list[OrderWithCustomerOut],
    dependencies=[require_sales],
)
async def delivery_orders(
    current_user: CurrentUser,
    service: CustomerSvc,
    delivery_date: date = Query(...),
    assigned_day: str = Query(...),
) -> list[OrderWithCustomerOut]:
    return await service.get_delivery_orders(
        UUID(current_user["sub"]), delivery_date, assigned_day
    )


@router.get(
    "/collections",
    dependencies=[require_sales],
)
async def collections(
    current_user: CurrentUser,
    service: CustomerSvc,
    date: date = Query(...),
) -> dict:
    total = await service.get_collections_for_date(UUID(current_user["sub"]), date)
    return {"total": total}


@router.get(
    "/{customer_id}/insights",
    response_model=CustomerInsightsOut,
    dependencies=[require_sales],
)
async def customer_insights(
    customer_id: uuid.UUID, current_user: CurrentUser, service: CustomerSvc
) -> CustomerInsightsOut:
    await service.verify_customer_access(
        customer_id, uuid.UUID(current_user["sub"]), current_user["role"]
    )
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


@router.get(
    "/{customer_id}/returned-checks",
    response_model=list[CheckOut],
    dependencies=[require_sales],
)
async def customer_returned_checks(
    customer_id: uuid.UUID,
    current_user: CurrentUser,
    service: PaymentSvc,
    customer_svc: CustomerSvc,
) -> list[CheckOut]:
    await customer_svc.verify_customer_access(
        customer_id, uuid.UUID(current_user["sub"]), current_user["role"]
    )
    return await service.get_customer_returned_checks(customer_id)


@router.get(
    "/{customer_id}/drafts",
    response_model=list[TransactionOut],
    dependencies=[require_sales],
)
async def customer_drafts(
    customer_id: uuid.UUID, service: CustomerSvc
) -> list[TransactionOut]:
    return await service.get_draft_orders(customer_id)
