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

    model_config = {"from_attributes": True}


class CustomerInsightsOut(BaseModel):
    total_debt: Decimal
    last_payment_date: str | None       # ISO date string
    last_payment_amount: Decimal | None
    avg_payment_interval_days: float | None
    risk_score: str                      # "green" | "yellow" | "red"
