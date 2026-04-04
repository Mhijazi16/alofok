import datetime as _dt
import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, BaseMixin


class DailyCashConfirmation(BaseMixin, Base):
    __tablename__ = "daily_cash_confirmations"
    __table_args__ = (
        UniqueConstraint("rep_id", "date", name="uq_daily_cash_rep_date"),
    )

    rep_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    date: Mapped[_dt.date] = mapped_column(Date, nullable=False, index=True)
    handed_over_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    confirmed_at: Mapped[_dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    flag_notes: Mapped[str | None] = mapped_column(String, nullable=True)

    rep: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[rep_id], lazy="selectin"
    )
    confirmer: Mapped["User | None"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[confirmed_by], lazy="selectin"
    )
