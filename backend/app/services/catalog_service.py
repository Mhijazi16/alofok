import uuid

from app.core.errors import HorizonException
from app.models.product import Product
from app.repositories.product_repository import ProductRepository
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate
from app.utils.cache import CacheBackend, TTL_CATALOG

_CACHE_PREFIX = "catalog:"
_LIST_KEY = "catalog:list"


class CatalogService:
    def __init__(self, product_repo: ProductRepository, cache: CacheBackend):
        self._products = product_repo
        self._cache = cache

    async def list_products(self) -> list[ProductOut]:
        cached = await self._cache.get(_LIST_KEY)
        if cached is not None:
            return [ProductOut.model_validate(p) for p in cached]

        products = await self._products.get_all()
        out = [ProductOut.model_validate(p) for p in products]
        await self._cache.set(_LIST_KEY, [p.model_dump(mode="json") for p in out], ttl=TTL_CATALOG)
        return out

    async def create_product(self, body: ProductCreate, creator_id: uuid.UUID) -> ProductOut:
        if await self._products.get_by_sku(body.sku):
            raise HorizonException(409, f"SKU '{body.sku}' already exists")

        product = Product(**body.model_dump(), created_by=creator_id)
        product = await self._products.create(product)
        await self._cache.invalidate_prefix(_CACHE_PREFIX)
        return ProductOut.model_validate(product)

    async def update_product(self, product_id: uuid.UUID, body: ProductUpdate) -> ProductOut:
        product = await self._products.get_by_id(product_id)
        if product is None:
            raise HorizonException(404, "Product not found")

        for field, value in body.model_dump(exclude_none=True).items():
            setattr(product, field, value)

        product = await self._products.update(product)
        await self._cache.invalidate_prefix(_CACHE_PREFIX)
        return ProductOut.model_validate(product)
