import uuid
from datetime import date

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, LedgerSvc, require_admin, require_sales
from app.core.errors import HorizonException
from app.schemas.ledger import (
    DailyLedgerReportOut,
    ExpenseCreateIn,
    LedgerStatusUpdateIn,
)

router = APIRouter(prefix="/ledger", tags=["ledger"])

REP_CATEGORIES = {"Food", "Fuel", "Gifts", "CarWash", "Other"}


@router.get("/daily", response_model=DailyLedgerReportOut, dependencies=[require_admin])
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


@router.post("/expenses", dependencies=[require_sales])
async def create_expense(
    body: ExpenseCreateIn,
    current_user: CurrentUser,
    service: LedgerSvc,
):
    is_admin = current_user.get("role") == "Admin"
    if not is_admin and body.category not in REP_CATEGORIES:
        raise HorizonException(400, "Invalid category for Sales role")
    entry = await service.create_expense(
        rep_id=uuid.UUID(current_user["sub"]),
        amount=body.amount,
        category=body.category,
        expense_date=body.date,
        notes=body.notes,
        is_admin=is_admin,
    )
    return {"id": str(entry.id)}


@router.get("/my-expenses", dependencies=[require_sales])
async def get_my_expenses(
    current_user: CurrentUser,
    service: LedgerSvc,
    expense_date: date = Query(None, alias="date"),
):
    if expense_date is None:
        expense_date = date.today()
    return await service.get_rep_expenses(
        rep_id=uuid.UUID(current_user["sub"]),
        expense_date=expense_date,
    )


@router.delete("/expenses/{expense_id}", dependencies=[require_sales])
async def delete_expense(
    expense_id: uuid.UUID,
    current_user: CurrentUser,
    service: LedgerSvc,
):
    await service.delete_expense(expense_id, uuid.UUID(current_user["sub"]))
    return {"deleted": True}
