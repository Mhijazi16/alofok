import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel

from app.models.transaction import Currency, TransactionStatus, TransactionType


class TransactionOut(BaseModel):
    id: uuid.UUID
    type: TransactionType
    currency: Currency
    amount: Decimal
    status: TransactionStatus | None
    notes: str | None
    data: dict | None
    created_at: datetime
    related_transaction_id: uuid.UUID | None

    model_config = {"from_attributes": True}


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


class PaymentCreate(BaseModel):
    customer_id: uuid.UUID
    type: TransactionType  # Payment_Cash or Payment_Check
    currency: Currency
    amount: Decimal  # positive — will be stored as negative (payment)
    notes: str | None = None
    # Check-only fields
    data: dict | None = None  # {"bank": str, "due_date": str, "image_url": str}
