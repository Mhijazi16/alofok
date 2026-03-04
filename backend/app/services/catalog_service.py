import re
import uuid

from app.core.errors import HorizonException
from app.models.product import Product
from app.models.product_option import ProductOption
from app.repositories.product_repository import ProductRepository
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate
from app.utils.cache import CacheBackend, TTL_CATALOG

_CACHE_PREFIX = "catalog:"
_LIST_KEY = "catalog:list"


def _category_prefix(category: str | None) -> str:
    if not category:
        return "ALF"
    cleaned = re.sub(r"[^A-Za-z0-9]", "", category).upper()
    return cleaned[:5] if cleaned else "ALF"


class CatalogService:
    def __init__(self, product_repo: ProductRepository, cache: CacheBackend):
        self._products = product_repo
        self._cache = cache

    async def _generate_sku(self, category: str | None) -> str:
        prefix = _category_prefix(category)
        count = await self._products.count_by_sku_prefix(prefix)
        for attempt in range(10):
            sku = f"{prefix}-{count + 1 + attempt:03d}"
            if not await self._products.get_by_sku(sku):
                return sku
        # Fallback with uuid fragment
        return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"

    async def list_products(self) -> list[ProductOut]:
        cached = await self._cache.get(_LIST_KEY)
        if cached is not None:
            return [ProductOut.model_validate(p) for p in cached]

        products = await self._products.get_all()
        out = [ProductOut.model_validate(p) for p in products]
        await self._cache.set(
            _LIST_KEY, [p.model_dump(mode="json") for p in out], ttl=TTL_CATALOG
        )
        return out

    async def create_product(
        self, body: ProductCreate, creator_id: uuid.UUID
    ) -> ProductOut:
        sku = await self._generate_sku(body.category)

        data = body.model_dump(exclude={"options"})
        product = Product(**data, sku=sku, created_by=creator_id)
        product = await self._products.create(product)

        # Create options
        if body.options:
            for opt in body.options:
                option = ProductOption(
                    product_id=product.id,
                    name=opt.name,
                    values=[v.model_dump() for v in opt.values],
                    sort_order=opt.sort_order,
                )
                product.options.append(option)
            await self._products.update(product)

        await self._cache.invalidate_prefix(_CACHE_PREFIX)
        return ProductOut.model_validate(product)

    async def update_product(
        self, product_id: uuid.UUID, body: ProductUpdate
    ) -> ProductOut:
        product = await self._products.get_by_id(product_id)
        if product is None:
            raise HorizonException(404, "Product not found")

        data = body.model_dump(exclude_none=True, exclude={"options"})
        for field, value in data.items():
            setattr(product, field, value)

        # Replace options if provided
        if body.options is not None:
            # Clear existing options
            product.options.clear()
            for opt in body.options:
                option = ProductOption(
                    product_id=product.id,
                    name=opt.name,
                    values=[v.model_dump() for v in opt.values],
                    sort_order=opt.sort_order,
                )
                product.options.append(option)

        product = await self._products.update(product)
        await self._cache.invalidate_prefix(_CACHE_PREFIX)
        return ProductOut.model_validate(product)

    async def delete_product(self, product_id: uuid.UUID) -> None:
        product = await self._products.soft_delete(product_id)
        if product is None:
            raise HorizonException(404, "Product not found")
        await self._cache.invalidate_prefix(_CACHE_PREFIX)

    async def get_distinct_values(self, field: str) -> list[str]:
        return await self._products.get_distinct_values(field)

    async def duplicate_product(self, product_id: uuid.UUID) -> ProductOut:
        copy = await self._products.duplicate(product_id)
        if copy is None:
            raise HorizonException(404, "Product not found")
        # Set auto-generated SKU
        sku = await self._generate_sku(copy.category)
        copy.sku = sku
        copy = await self._products.update(copy)
        await self._cache.invalidate_prefix(_CACHE_PREFIX)
        return ProductOut.model_validate(copy)
