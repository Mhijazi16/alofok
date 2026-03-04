import enum
import uuid
from decimal import Decimal

from sqlalchemy import Enum as SAEnum, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, BaseMixin


class AssignedDay(str, enum.Enum):
    Sun = "Sun"
    Mon = "Mon"
    Tue = "Tue"
    Wed = "Wed"
    Thu = "Thu"
    Fri = "Fri"
    Sat = "Sat"


class Customer(BaseMixin, Base):
    __tablename__ = "customers"

    name: Mapped[str] = mapped_column(String, index=True, nullable=False)
    city: Mapped[str] = mapped_column(String, nullable=False)
    assigned_day: Mapped[AssignedDay] = mapped_column(
        SAEnum(AssignedDay, name="assignedday"), nullable=False
    )
    balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    sales_rep: Mapped["User | None"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[assigned_to]
    )
