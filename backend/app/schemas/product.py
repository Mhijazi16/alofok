import uuid
from decimal import Decimal

from pydantic import BaseModel, computed_field

# ── Option schemas ────────────────────────────────────────────────────────────


class ProductOptionValueOut(BaseModel):
    label: str
    price: float = 0
    cost: float = 0
    quantity: int = 0


class ProductOptionOut(BaseModel):
    id: uuid.UUID
    name: str
    values: list[ProductOptionValueOut]
    sort_order: int = 0

    model_config = {"from_attributes": True}


class ProductOptionInput(BaseModel):
    name: str
    values: list[ProductOptionValueOut]
    sort_order: int = 0


# ── Product schemas ───────────────────────────────────────────────────────────


class ProductOut(BaseModel):
    id: uuid.UUID
    name_ar: str
    name_en: str
    sku: str
    price: Decimal
    is_discounted: bool
    is_bestseller: bool
    description_ar: str | None = None
    description_en: str | None = None
    purchase_price: float | None = None
    discount_type: str | None = None
    discount_value: float | None = None
    category: str | None = None
    trademark: str | None = None
    stock_qty: int | None = None
    unit: str = "piece"
    weight: float | None = None
    image_urls: list[str] | None = None
    options: list[ProductOptionOut] | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def discounted_price(self) -> float | None:
        if not self.is_discounted or not self.discount_value:
            return None
        price = float(self.price)
        if self.discount_type == "percent":
            return round(price * (1 - float(self.discount_value) / 100), 2)
        elif self.discount_type == "fixed":
            return round(price - float(self.discount_value), 2)
        return None

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    name_ar: str
    name_en: str
    description_ar: str | None = None
    description_en: str | None = None
    price: Decimal
    purchase_price: float | None = None
    is_discounted: bool = False
    is_bestseller: bool = False
    discount_type: str | None = None
    discount_value: float | None = None
    category: str | None = None
    trademark: str | None = None
    stock_qty: int | None = None
    unit: str = "piece"
    weight: float | None = None
    image_urls: list[str] | None = None
    options: list[ProductOptionInput] | None = None


class ProductUpdate(BaseModel):
    name_ar: str | None = None
    name_en: str | None = None
    description_ar: str | None = None
    description_en: str | None = None
    price: Decimal | None = None
    purchase_price: float | None = None
    is_discounted: bool | None = None
    is_bestseller: bool | None = None
    discount_type: str | None = None
    discount_value: float | None = None
    category: str | None = None
    trademark: str | None = None
    stock_qty: int | None = None
    unit: str | None = None
    weight: float | None = None
    image_urls: list[str] | None = None
    options: list[ProductOptionInput] | None = None
