import uuid
from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, CustomerSvc
from app.schemas.customer import CustomerInsightsOut, CustomerOut
from app.schemas.transaction import StatementOut

router = APIRouter()


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
