import uuid
from decimal import Decimal

from pydantic import BaseModel

from app.models.customer import AssignedDay
from app.schemas.transaction import OrderItemSchema


class CustomerLoginRequest(BaseModel):
    phone: str
    password: str


class CustomerTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CustomerProfileOut(BaseModel):
    id: uuid.UUID
    name: str
    city: str
    balance: Decimal
    phone: str | None = None
    address: str | None = None
    avatar_url: str | None = None
    assigned_day: AssignedDay

    model_config = {"from_attributes": True}


class DraftOrderCreate(BaseModel):
    items: list[OrderItemSchema]
    notes: str | None = None
