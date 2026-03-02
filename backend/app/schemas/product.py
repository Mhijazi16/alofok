import uuid
from decimal import Decimal

from pydantic import BaseModel


class ProductOut(BaseModel):
    id: uuid.UUID
    name_ar: str
    name_en: str
    sku: str
    price: Decimal
    image_url: str | None
    is_discounted: bool
    is_bestseller: bool
    description_ar: str | None = None
    description_en: str | None = None
    discount_percentage: float | None = None
    discounted_price: float | None = None
    category: str | None = None
    brand: str | None = None
    stock_qty: int | None = None
    unit: str = "piece"
    weight: float | None = None
    color_options: list[str] | None = None

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    name_ar: str
    name_en: str
    sku: str
    price: Decimal
    image_url: str | None = None
    is_discounted: bool = False
    is_bestseller: bool = False
    description_ar: str | None = None
    description_en: str | None = None
    discount_percentage: float | None = None
    discounted_price: float | None = None
    category: str | None = None
    brand: str | None = None
    stock_qty: int | None = None
    unit: str = "piece"
    weight: float | None = None
    color_options: list[str] | None = None


class ProductUpdate(BaseModel):
    name_ar: str | None = None
    name_en: str | None = None
    sku: str | None = None
    price: Decimal | None = None
    image_url: str | None = None
    is_discounted: bool | None = None
    is_bestseller: bool | None = None
    description_ar: str | None = None
    description_en: str | None = None
    discount_percentage: float | None = None
    discounted_price: float | None = None
    category: str | None = None
    brand: str | None = None
    stock_qty: int | None = None
    unit: str | None = None
    weight: float | None = None
    color_options: list[str] | None = None
