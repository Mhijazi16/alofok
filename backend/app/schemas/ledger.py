import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator


class LedgerEntryOut(BaseModel):
    id: uuid.UUID
    direction: str
    payment_method: str
    amount: Decimal
    category: str | None = None
    notes: str | None = None
    rep_id: uuid.UUID
    rep_name: str | None = None
    customer_id: uuid.UUID | None = None
    customer_name: str | None = None
    source_transaction_id: uuid.UUID | None = None
    status: str
    confirmed_at: datetime | None = None
    flag_notes: str | None = None
    date: date
    created_at: datetime

    model_config = {"from_attributes": True}


class RepLedgerGroup(BaseModel):
    rep_id: uuid.UUID
    rep_name: str
    entries: list[LedgerEntryOut]


class DailyLedgerReportOut(BaseModel):
    report_date: str
    incoming: list[RepLedgerGroup]
    outgoing: list[RepLedgerGroup]


ALLOWED_EXPENSE_CATEGORIES = {
    "Food",
    "Fuel",
    "Gifts",
    "CarWash",
    "Other",
    "Electricity",
    "Internet",
    "CarRepair",
    "Salaries",
}


class ExpenseCreateIn(BaseModel):
    amount: Decimal
    category: str
    date: date
    notes: str | None = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in ALLOWED_EXPENSE_CATEGORIES:
            raise ValueError(
                f"category must be one of: {', '.join(sorted(ALLOWED_EXPENSE_CATEGORIES))}"
            )
        return v

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("amount must be greater than 0")
        return v


class LedgerStatusUpdateIn(BaseModel):
    ids: list[uuid.UUID]
    status: str
    flag_notes: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("pending", "confirmed", "flagged"):
            raise ValueError("status must be pending, confirmed, or flagged")
        return v

    @field_validator("flag_notes")
    @classmethod
    def require_notes_for_flag(cls, v: str | None, info) -> str | None:
        if info.data.get("status") == "flagged" and not v:
            raise ValueError("flag_notes required when status is flagged")
        return v
