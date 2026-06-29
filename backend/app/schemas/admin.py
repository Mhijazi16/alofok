import uuid
from datetime import date, datetime
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


class OrderItemRead(BaseModel):
    """Lenient read model for order line items stored in JSONB.

    Unlike the strict create-time OrderItemSchema (which enforces gt=0 / a real
    UUID), this never raises on historical or hand-edited rows — a read path must
    not re-apply creation-time business rules, or one bad row 500s the whole list.
    """

    product_id: str | None = None
    name: str | None = None
    image_url: str | None = None
    quantity: int = 0
    unit_price: Decimal = Decimal(0)
    selected_options: list[dict] | None = None

    model_config = {"extra": "ignore"}


class AdminOrderOut(BaseModel):
    """An order (with line items, total, customer + rep) for the admin Orders tab."""

    id: uuid.UUID
    customer_id: uuid.UUID
    customer_name: str
    rep_id: uuid.UUID | None = None
    rep_name: str | None = None
    type: TransactionType
    currency: Currency
    amount: Decimal  # the order total (signed positive for orders)
    status: TransactionStatus | None = None
    notes: str | None = None
    created_at: datetime
    delivery_date: date | None = None
    delivered_date: datetime | None = None
    is_draft: bool = False
    items: list[OrderItemRead] = []
    # Present only when an order-level discount was applied at checkout.
    subtotal: Decimal | None = None
    discount: dict | None = None


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


class DayPaymentRow(BaseModel):
    """A single payment collected on the summary day (cash or check)."""

    customer_name: str
    rep_name: str | None = None
    amount: Decimal  # positive (collected)
    method: str  # "cash" | "check"


class DayExpenseCategory(BaseModel):
    category: str
    amount: Decimal
    count: int


class DaySummaryOut(BaseModel):
    """Everything an admin wants to glance at in the morning about *yesterday*."""

    date: date
    collected_total: Decimal
    collection_count: int
    payments: list[DayPaymentRow]
    orders_total: Decimal
    orders_count: int
    expenses_total: Decimal
    expenses_count: int
    expenses_by_category: list[DayExpenseCategory]
    net: Decimal  # collected_total - expenses_total


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int
    total_pages: int
