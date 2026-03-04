from datetime import date
import uuid

from fastapi import APIRouter, File, UploadFile

from app.api.deps import AdminSvc, CurrentUser, CustomerSvc, UserRepo, require_admin
from app.models.transaction import TransactionStatus
from app.schemas.admin import CheckOut, DebtStatsOut, ImportResult, SalesStatsOut
from app.schemas.customer import (
    AdminCustomerCreate,
    CustomerOut,
    CustomerUpdate,
    SalesRepOut,
)

router = APIRouter()


@router.get("/stats/sales", response_model=SalesStatsOut, dependencies=[require_admin])
async def sales_stats(
    start_date: date,
    end_date: date,
    service: AdminSvc,
) -> SalesStatsOut:
    return await service.get_sales_stats(start_date, end_date)


@router.get("/stats/debt", response_model=DebtStatsOut, dependencies=[require_admin])
async def debt_stats(service: AdminSvc) -> DebtStatsOut:
    return await service.get_debt_stats()


@router.post(
    "/customers/import",
    response_model=ImportResult,
    dependencies=[require_admin],
)
async def import_customers(
    service: AdminSvc,
    file: UploadFile = File(...),
) -> ImportResult:
    content = (await file.read()).decode("utf-8")
    return await service.import_customers(content)


@router.post("/reports/eod", dependencies=[require_admin])
async def eod_report(
    service: AdminSvc,
    report_date: date | None = None,
) -> dict:
    return await service.trigger_eod_report(report_date)


@router.get(
    "/customers", response_model=list[CustomerOut], dependencies=[require_admin]
)
async def list_all_customers(service: CustomerSvc) -> list[CustomerOut]:
    return await service.get_all_customers_admin()


@router.post(
    "/customers",
    response_model=CustomerOut,
    status_code=201,
    dependencies=[require_admin],
)
async def create_customer_for_rep(
    body: AdminCustomerCreate, service: CustomerSvc
) -> CustomerOut:
    return await service.create_customer_for_rep(body)


@router.put(
    "/customers/{customer_id}", response_model=CustomerOut, dependencies=[require_admin]
)
async def update_customer(
    customer_id: uuid.UUID,
    body: CustomerUpdate,
    current_user: CurrentUser,
    service: CustomerSvc,
) -> CustomerOut:
    return await service.update_customer(
        customer_id, body, uuid.UUID(current_user["sub"]), current_user["role"]
    )


@router.get(
    "/users/sales-reps", response_model=list[SalesRepOut], dependencies=[require_admin]
)
async def list_sales_reps(repo: UserRepo) -> list[SalesRepOut]:
    reps = await repo.get_sales_reps()
    return [SalesRepOut.model_validate(r) for r in reps]


@router.get("/checks", response_model=list[CheckOut], dependencies=[require_admin])
async def list_checks(
    service: AdminSvc,
    status: TransactionStatus | None = None,
) -> list[CheckOut]:
    return await service.get_all_checks(status)
