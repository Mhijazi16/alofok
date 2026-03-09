import uuid
from datetime import date, datetime
from enum import Enum as PyEnum

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, BaseMixin


class LedgerDirection(str, PyEnum):
    incoming = "incoming"
    outgoing = "outgoing"


class LedgerPaymentMethod(str, PyEnum):
    cash = "cash"
    check = "check"


class LedgerStatus(str, PyEnum):
    pending = "pending"
    confirmed = "confirmed"
    flagged = "flagged"


class CompanyLedger(Base, BaseMixin):
    __tablename__ = "company_ledger"

    direction: Mapped[str] = mapped_column(
        sa.Enum(
            LedgerDirection,
            name="ledgerdirection",
            create_constraint=True,
            native_enum=True,
        ),
        nullable=False,
    )
    payment_method: Mapped[str] = mapped_column(
        sa.Enum(
            LedgerPaymentMethod,
            name="ledgerpaymentmethod",
            create_constraint=True,
            native_enum=True,
        ),
        nullable=False,
    )
    amount: Mapped[float] = mapped_column(sa.Numeric(12, 2), nullable=False)
    category: Mapped[str | None] = mapped_column(sa.String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    rep_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
    )
    customer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("customers.id"), nullable=True
    )
    source_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), sa.ForeignKey("transactions.id"), nullable=True, unique=True
    )

    status: Mapped[str] = mapped_column(
        sa.Enum(
            LedgerStatus, name="ledgerstatus", create_constraint=True, native_enum=True
        ),
        nullable=False,
        server_default="pending",
    )
    confirmed_at: Mapped[datetime | None] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    flag_notes: Mapped[str | None] = mapped_column(sa.Text, nullable=True)

    date: Mapped[date] = mapped_column(sa.Date, nullable=False)

    __table_args__ = (
        sa.Index("ix_company_ledger_date", "date"),
        sa.Index("ix_company_ledger_rep_id", "rep_id"),
        sa.Index("ix_company_ledger_direction", "direction"),
        sa.Index("ix_company_ledger_status", "status"),
    )
