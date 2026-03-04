import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.transaction import Currency, TransactionStatus, TransactionType


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
    data: CheckData | None
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
    items: list[dict]  # [{"product_id": uuid, "quantity": int, "unit_price": Decimal}]
    notes: str | None = None
    delivery_date: date | None = None


class OrderUpdate(BaseModel):
    customer_id: uuid.UUID | None = None
    items: list[dict] | None = None
    delivery_date: date | None = None
    notes: str | None = None


class PaymentCreate(BaseModel):
    customer_id: uuid.UUID
    type: TransactionType  # Payment_Cash or Payment_Check
    currency: Currency
    amount: Decimal  # positive — will be stored as negative (payment)
    notes: str | None = None
    # Check-only fields
    data: CheckData | None = None
