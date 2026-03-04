import datetime as _dt
import enum
import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Numeric,
    String,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, BaseMixin


class TransactionType(str, enum.Enum):
    Order = "Order"
    Payment_Cash = "Payment_Cash"
    Payment_Check = "Payment_Check"
    Check_Return = "Check_Return"


class TransactionStatus(str, enum.Enum):
    Pending = "Pending"
    Deposited = "Deposited"
    Returned = "Returned"
    Cleared = "Cleared"


class Currency(str, enum.Enum):
    ILS = "ILS"
    USD = "USD"
    JOD = "JOD"


class Transaction(BaseMixin, Base):
    __tablename__ = "transactions"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id"), index=True, nullable=False
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    type: Mapped[TransactionType] = mapped_column(
        SAEnum(TransactionType, name="transactiontype"), nullable=False
    )
    currency: Mapped[Currency] = mapped_column(
        SAEnum(Currency, name="currency"), default=Currency.ILS, nullable=False
    )
    # Signed: positive = order / returned check; negative = payment
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # Only used for check transactions
    status: Mapped[TransactionStatus | None] = mapped_column(
        SAEnum(TransactionStatus, name="transactionstatus"), nullable=True
    )
    # Links a Check_Return back to its original Payment_Check
    related_transaction_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("transactions.id"),
        nullable=True,
    )
    # Check details (bank, due_date, image_url) and exchange rates
    data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    is_draft: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    delivery_date: Mapped[_dt.date | None] = mapped_column(
        Date, nullable=True, index=True
    )
    delivered_date: Mapped[_dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    customer: Mapped["Customer"] = relationship(  # type: ignore[name-defined]
        "Customer", foreign_keys=[customer_id]
    )
    creator: Mapped["User | None"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[created_by]
    )
    related_transaction: Mapped["Transaction | None"] = relationship(
        "Transaction",
        foreign_keys=[related_transaction_id],
        remote_side="Transaction.id",
        uselist=False,
    )
