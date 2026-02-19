from datetime import date

from fastapi import APIRouter, File, UploadFile

from app.api.deps import AdminSvc, require_admin
from app.schemas.admin import DebtStatsOut, ImportResult, SalesStatsOut

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
