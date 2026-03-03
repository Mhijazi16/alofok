import uuid
from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import CatalogSvc, CurrentCustomer, CustomerPortalSvc
from app.schemas.customer_auth import DraftOrderCreate
from app.schemas.product import ProductOut
from app.schemas.transaction import StatementOut, TransactionOut

router = APIRouter()


@router.get("/statement", response_model=StatementOut)
async def portal_statement(
    current_customer: CurrentCustomer,
    service: CustomerPortalSvc,
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    since_zero_balance: bool = Query(False),
) -> StatementOut:
    customer_id = uuid.UUID(current_customer["customer_id"])
    return await service.get_statement(
        customer_id, start_date, end_date, since_zero_balance
    )


@router.get("/orders", response_model=list[TransactionOut])
async def portal_orders(
    current_customer: CurrentCustomer,
    service: CustomerPortalSvc,
) -> list[TransactionOut]:
    customer_id = uuid.UUID(current_customer["customer_id"])
    return await service.get_orders(customer_id)


@router.get("/catalog", response_model=list[ProductOut])
async def portal_catalog(catalog_service: CatalogSvc) -> list[ProductOut]:
    return await catalog_service.list_products()


@router.post("/orders", response_model=TransactionOut, status_code=201)
async def portal_create_draft(
    body: DraftOrderCreate,
    current_customer: CurrentCustomer,
    service: CustomerPortalSvc,
) -> TransactionOut:
    customer_id = uuid.UUID(current_customer["customer_id"])
    return await service.create_draft_order(customer_id, body.items, body.notes)
