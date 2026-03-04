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
    is_discounted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_bestseller: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # --- text fields ---
    description_ar: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description_en: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # --- pricing ---
    purchase_price: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    discount_type: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )  # "percent" or "fixed"
    discount_value: Mapped[Optional[Decimal]] = mapped_column(
        Numeric(12, 2), nullable=True
    )

    # --- attributes ---
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    trademark: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    stock_qty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    unit: Mapped[str] = mapped_column(String, default="piece")
    weight: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), nullable=True)

    # --- media ---
    image_urls: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)

    # --- ownership ---
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # --- relationships ---
    creator: Mapped["User"] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[created_by]
    )
    options: Mapped[list["ProductOption"]] = relationship(  # type: ignore[name-defined]
        "ProductOption",
        back_populates="product",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
