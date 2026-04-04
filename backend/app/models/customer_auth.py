import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, BaseMixin


class CustomerAuth(BaseMixin, Base):
    __tablename__ = "customer_auth"

    customer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id"), unique=True, nullable=False
    )
    phone: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    customer: Mapped["Customer"] = relationship(  # type: ignore[name-defined]
        "Customer", foreign_keys=[customer_id], lazy="selectin"
    )
