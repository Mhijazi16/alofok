import uuid
from decimal import Decimal

from pydantic import BaseModel

from app.models.customer import AssignedDay


class CustomerOut(BaseModel):
    id: uuid.UUID
    name: str
    city: str
    assigned_day: AssignedDay
    balance: Decimal
    phone: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    avatar_url: str | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


class CustomerCreate(BaseModel):
    name: str
    phone: str | None = None
    city: str
    address: str | None = None
    assigned_day: str
    latitude: float | None = None
    longitude: float | None = None
    avatar_url: str | None = None
    notes: str | None = None


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    city: str | None = None
    address: str | None = None
    assigned_day: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    avatar_url: str | None = None
    notes: str | None = None


class CustomerInsightsOut(BaseModel):
    total_debt: Decimal
    last_payment_date: str | None  # ISO date string
    last_payment_amount: Decimal | None
    avg_payment_interval_days: float | None
    risk_score: str  # "green" | "yellow" | "red"
