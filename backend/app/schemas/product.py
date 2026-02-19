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

    model_config = {"from_attributes": True}


class ProductCreate(BaseModel):
    name_ar: str
    name_en: str
    sku: str
    price: Decimal
    image_url: str | None = None
    is_discounted: bool = False
    is_bestseller: bool = False


class ProductUpdate(BaseModel):
    name_ar: str | None = None
    name_en: str | None = None
    sku: str | None = None
    price: Decimal | None = None
    image_url: str | None = None
    is_discounted: bool | None = None
    is_bestseller: bool | None = None
