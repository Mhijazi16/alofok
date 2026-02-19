import uuid
from decimal import Decimal

from pydantic import BaseModel


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
