import datetime as _dt
import enum
import uuid
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Numeric,
    String,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, BaseMixin


class ExpenseType(str, enum.Enum):
    Field = "Field"
    Business = "Business"


class ExpenseCategory(str, enum.Enum):
    Fuel = "Fuel"
    Food = "Food"
    Accommodation = "Accommodation"
    Supplies = "Supplies"
    Transport = "Transport"
    Maintenance = "Maintenance"
    Marketing = "Marketing"
    Utilities = "Utilities"
    Other = "Other"
    Gifts = "Gifts"
    CarWash = "CarWash"
    Electricity = "Electricity"
    Internet = "Internet"
    CarRepair = "CarRepair"
    Salaries = "Salaries"


class ExpenseStatus(str, enum.Enum):
    Pending = "Pending"
    Confirmed = "Confirmed"
    Flagged = "Flagged"


class Expense(BaseMixin, Base):
    __tablename__ = "expenses"
    __table_args__ = (CheckConstraint("amount > 0", name="ck_expense_amount_positive"),)

    expense_type: Mapped[ExpenseType] = mapped_column(
        SAEnum(ExpenseType, name="expensetype"), nullable=False
    )
    category: Mapped[ExpenseCategory] = mapped_column(
        SAEnum(ExpenseCategory, name="expensecategory"), nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    date: Mapped[_dt.date] = mapped_column(Date, nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[ExpenseStatus] = mapped_column(
        SAEnum(ExpenseStatus, name="expensestatus"),
        default=ExpenseStatus.Pending,
        nullable=False,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    confirmed_at: Mapped[_dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    flag_notes: Mapped[str | None] = mapped_column(String, nullable=True)

    creator: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[created_by], lazy="selectin"
    )
    confirmer: Mapped["User | None"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[confirmed_by], lazy="selectin"
    )
