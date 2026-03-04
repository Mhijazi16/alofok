import uuid
from decimal import Decimal

from pydantic import BaseModel, field_validator

from app.models.customer import AssignedDay

# Map full day names (lowercase) → AssignedDay enum values
_DAY_ALIASES: dict[str, AssignedDay] = {
    "sunday": AssignedDay.Sun,
    "monday": AssignedDay.Mon,
    "tuesday": AssignedDay.Tue,
    "wednesday": AssignedDay.Wed,
    "thursday": AssignedDay.Thu,
    "saturday": AssignedDay.Sat,
}


def _parse_day(v: str) -> AssignedDay:
    """Accept enum value ('Sun'), full name ('sunday'), or abbreviation ('tue')."""
    s = v.strip()
    # Direct enum match (e.g. "Sun", "Mon")
    try:
        return AssignedDay(s)
    except ValueError:
        pass
    # Full or abbreviated name, case-insensitive
    low = s.lower()
    if low in _DAY_ALIASES:
        return _DAY_ALIASES[low]
    # 3-letter abbreviation (e.g. "tue", "sun")
    for alias, day in _DAY_ALIASES.items():
        if alias[:3] == low[:3]:
            return day
    raise ValueError(
        f"Invalid day: {v!r}. Expected one of: {', '.join(d.value for d in AssignedDay)}"
    )


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
    assigned_to: uuid.UUID | None = None

    model_config = {"from_attributes": True}


class CustomerCreate(BaseModel):
    name: str
    phone: str | None = None
    city: str
    address: str | None = None
    assigned_day: AssignedDay
    latitude: float | None = None
    longitude: float | None = None
    avatar_url: str | None = None
    notes: str | None = None
    portal_password: str | None = None

    @field_validator("assigned_day", mode="before")
    @classmethod
    def normalize_day(cls, v: str) -> AssignedDay:
        return _parse_day(v)


class CustomerUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    city: str | None = None
    address: str | None = None
    assigned_day: AssignedDay | None = None
    latitude: float | None = None
    longitude: float | None = None
    avatar_url: str | None = None
    notes: str | None = None
    assigned_to: uuid.UUID | None = None

    @field_validator("assigned_day", mode="before")
    @classmethod
    def normalize_day(cls, v: str | None) -> AssignedDay | None:
        if v is None:
            return None
        return _parse_day(v)


class CustomerInsightsOut(BaseModel):
    total_debt: Decimal
    last_payment_date: str | None  # ISO date string
    last_payment_amount: Decimal | None
    avg_payment_interval_days: float | None
    risk_score: str  # "green" | "yellow" | "red"


class AdminCustomerCreate(CustomerCreate):
    assigned_to: uuid.UUID


class SalesRepOut(BaseModel):
    id: uuid.UUID
    username: str

    model_config = {"from_attributes": True}
