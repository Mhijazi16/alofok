import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.models.transaction import Currency, TransactionStatus, TransactionType


class OrderItemSchema(BaseModel):
    """Typed schema for order line items — replaces untyped list[dict]."""

    product_id: uuid.UUID
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(gt=0)
    name: str | None = None  # optional product name for display


class CheckData(BaseModel):
    bank: str | None = None  # existing: free-text bank name
    bank_number: str | None = None  # CHK-01
    branch_number: str | None = None  # CHK-02
    account_number: str | None = None  # CHK-03
    holder_name: str | None = None  # CHK-04
    due_date: str | None = None  # existing
    image_url: str | None = None  # existing


class TransactionOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    type: TransactionType
    currency: Currency
    amount: Decimal
    status: TransactionStatus | None
    notes: str | None
    data: dict | None
    created_at: datetime
    related_transaction_id: uuid.UUID | None
    is_draft: bool = False
    delivery_date: date | None = None
    delivered_date: datetime | None = None

    model_config = {"from_attributes": True}


class OrderWithCustomerOut(TransactionOut):
    """Order with inline customer name for list views."""

    customer_name: str
    is_route: bool = True


class StatementEntryOut(BaseModel):
    transaction: TransactionOut
    running_balance: Decimal


class StatementOut(BaseModel):
    customer_id: uuid.UUID
    entries: list[StatementEntryOut]
    closing_balance: Decimal


class OrderCreate(BaseModel):
    customer_id: uuid.UUID
    items: list[OrderItemSchema]
    notes: str | None = None
    delivery_date: date | None = None


class OrderUpdate(BaseModel):
    customer_id: uuid.UUID | None = None
    items: list[OrderItemSchema] | None = None
    delivery_date: date | None = None
    notes: str | None = None


class PaymentCreate(BaseModel):
    customer_id: uuid.UUID
    type: TransactionType  # Payment_Cash or Payment_Check
    currency: Currency
    amount: Decimal  # positive — will be stored as negative (payment)
    exchange_rate: Decimal | None = None  # required when currency != ILS
    notes: str | None = None
    # Check-only fields
    data: CheckData | None = None


# ---------------------------------------------------------------------------
# Purchase from Customer
# ---------------------------------------------------------------------------


class PurchaseItem(BaseModel):
    product_id: uuid.UUID
    name: str
    quantity: int = Field(gt=0)
    unit_price: Decimal = Field(gt=0)


class PurchaseCreate(BaseModel):
    customer_id: uuid.UUID
    items: list[PurchaseItem] = Field(min_length=1)
    notes: str | None = None
