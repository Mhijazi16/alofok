from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, LedgerSvc, require_admin
from app.schemas.ledger import DailyLedgerReportOut, LedgerStatusUpdateIn

router = APIRouter(prefix="/ledger", tags=["ledger"])


@router.get(
    "/daily", response_model=DailyLedgerReportOut, dependencies=[require_admin]
)
async def get_daily_ledger(
    service: LedgerSvc,
    report_date: date = Query(..., alias="date"),
):
    return await service.get_daily_report(report_date)


@router.patch("/status", dependencies=[require_admin])
async def update_ledger_status(
    body: LedgerStatusUpdateIn,
    current_user: CurrentUser,
    service: LedgerSvc,
):
    count = await service.update_status(
        ids=body.ids,
        status=body.status,
        confirmer_id=current_user["sub"],
        flag_notes=body.flag_notes,
    )
    return {"updated": count}
