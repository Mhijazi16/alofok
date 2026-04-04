import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

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


class DailyBreakdownItem(BaseModel):
    date: str
    total_orders: Decimal
    total_collected: Decimal
    order_count: int
    collection_count: int


class DailyBreakdownOut(BaseModel):
    days: list[DailyBreakdownItem]


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
