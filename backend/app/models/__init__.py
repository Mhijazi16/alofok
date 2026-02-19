import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class BaseMixin:
    """
    Shared columns for every model.
    - id: UUID primary key
    - created_at / updated_at: UTC timestamps
    - is_deleted: soft-delete flag (never hard-delete)
    """

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


# Import all models here so that:
# 1. Alembic autogenerate can detect all tables via Base.metadata
# 2. Consumers can do: from app.models import User, Product, etc.
from app.models.user import User, UserRole  # noqa: E402, F401
from app.models.product import Product  # noqa: E402, F401
from app.models.customer import Customer, AssignedDay  # noqa: E402, F401
from app.models.transaction import (  # noqa: E402, F401
    Transaction,
    TransactionType,
    TransactionStatus,
    Currency,
)
