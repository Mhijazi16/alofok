import uuid
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
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

    # --- new fields ---
    description_ar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description_en: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    discount_percentage: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(5, 2), nullable=True
    )
    discounted_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    brand: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    stock_qty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    unit: Mapped[str] = mapped_column(String, default="piece")
    weight: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)
    color_options: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    creator: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[created_by]
    )
