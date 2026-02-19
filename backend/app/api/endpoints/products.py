import json
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.api.deps import Cache, CurrentUser, DbSession, require_designer
from app.core.errors import HorizonException
from app.models.product import Product
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate
from app.utils.cache import TTL_CATALOG

router = APIRouter()

_CACHE_PREFIX = "catalog:"
_LIST_KEY = "catalog:list"


@router.get("", response_model=list[ProductOut])
async def list_products(db: DbSession, cache: Cache) -> list[ProductOut]:
    cached = await cache.get(_LIST_KEY)
    if cached is not None:
        return [ProductOut.model_validate(p) for p in cached]

    result = await db.execute(
        select(Product).where(Product.is_deleted.is_(False)).order_by(Product.name_en)
    )
    products = result.scalars().all()
    out = [ProductOut.model_validate(p) for p in products]

    await cache.set(_LIST_KEY, [p.model_dump(mode="json") for p in out], ttl=TTL_CATALOG)
    return out


@router.post("", response_model=ProductOut, status_code=201, dependencies=[require_designer])
async def create_product(
    body: ProductCreate,
    current_user: CurrentUser,
    db: DbSession,
    cache: Cache,
) -> ProductOut:
    # Check SKU uniqueness
    existing = await db.execute(
        select(Product).where(Product.sku == body.sku, Product.is_deleted.is_(False))
    )
    if existing.scalar_one_or_none():
        raise HorizonException(409, f"SKU '{body.sku}' already exists")

    product = Product(
        **body.model_dump(),
        created_by=uuid.UUID(current_user["sub"]),
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    await cache.invalidate_prefix(_CACHE_PREFIX)
    return ProductOut.model_validate(product)


@router.put("/{product_id}", response_model=ProductOut, dependencies=[require_designer])
async def update_product(
    product_id: uuid.UUID,
    body: ProductUpdate,
    db: DbSession,
    cache: Cache,
) -> ProductOut:
    result = await db.execute(
        select(Product).where(Product.id == product_id, Product.is_deleted.is_(False))
    )
    product = result.scalar_one_or_none()
    if product is None:
        raise HorizonException(404, "Product not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)
    await cache.invalidate_prefix(_CACHE_PREFIX)
    return ProductOut.model_validate(product)
