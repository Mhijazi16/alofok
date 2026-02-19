import uuid
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, BaseMixin


class Product(BaseMixin, Base):
    __tablename__ = "products"

    name_ar: Mapped[str] = mapped_column(String, nullable=False)
    name_en: Mapped[str] = mapped_column(String, nullable=False)
    sku: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    is_discounted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_bestseller: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    creator: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[created_by]
    )
