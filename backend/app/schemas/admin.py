import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, field_validator

from app.models.transaction import Currency, TransactionStatus, TransactionType
from app.schemas.transaction import CheckData


class SalesRepStatsOut(BaseModel):
    user_id: uuid.UUID
    username: str
    total_orders: Decimal
    order_count: int
    total_collected: Decimal
    collection_count: int


class SalesStatsOut(BaseModel):
    period_start: str
    period_end: str
    reps: list[SalesRepStatsOut]
    grand_total_orders: Decimal
    grand_total_collected: Decimal


class CityDebtOut(BaseModel):
    city: str
    total_debt: Decimal
    customer_count: int


class OverdueCheckOut(BaseModel):
    transaction_id: uuid.UUID
    customer_name: str
    amount: Decimal
    currency: str
    bank: str | None
    due_date: str | None


class DebtStatsOut(BaseModel):
    total_debt: Decimal
    by_city: list[CityDebtOut]
    overdue_checks: list[OverdueCheckOut]


class ImportResult(BaseModel):
    created: int
    errors: list[str]


class CheckOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: str
    type: TransactionType
    currency: Currency
    amount: Decimal
    status: TransactionStatus | None
    notes: str | None
    data: CheckData | None
    created_at: datetime
    related_transaction_id: uuid.UUID | None

    model_config = {"from_attributes": True}


# ── Daily Cash Report ────────────────────────────────────────────────────────


class RepConfirmationOut(BaseModel):
    handed_over_amount: Decimal
    confirmed_at: datetime | None
    confirmer_name: str | None
    is_flagged: bool
    flag_notes: str | None


class RepCashSummaryOut(BaseModel):
    rep_id: uuid.UUID
    rep_name: str
    cash_total: Decimal
    check_total: Decimal
    expense_total: Decimal
    computed_net: Decimal
    payment_count: int
    expense_count: int
    confirmation: RepConfirmationOut | None


class DailyCashReportOut(BaseModel):
    report_date: str
    grand_cash: Decimal
    grand_checks: Decimal
    grand_expenses: Decimal
    grand_net: Decimal
    reps: list[RepCashSummaryOut]


class RepPaymentDetail(BaseModel):
    transaction_id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: str
    type: str  # Payment_Cash or Payment_Check
    amount: Decimal
    created_at: datetime


class RepPaymentsOut(BaseModel):
    rep_id: uuid.UUID
    rep_name: str
    report_date: str
    payments: list[RepPaymentDetail]


class ConfirmHandoverIn(BaseModel):
    rep_id: uuid.UUID
    report_date: date
    handed_over_amount: Decimal


class FlagHandoverIn(BaseModel):
    rep_id: uuid.UUID
    report_date: date
    handed_over_amount: Decimal
    flag_notes: str

    @field_validator("flag_notes")
    @classmethod
    def flag_notes_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("flag_notes must not be empty")
        return v
