import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.product import Product


class ProductRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_all(self) -> list[Product]:
        result = await self._db.execute(
            select(Product)
            .where(Product.is_deleted.is_(False))
            .order_by(Product.name_en)
        )
        return list(result.scalars().all())

    async def get_by_id(self, product_id: uuid.UUID) -> Product | None:
        result = await self._db.execute(
            select(Product).where(
                Product.id == product_id, Product.is_deleted.is_(False)
            )
        )
        return result.scalar_one_or_none()

    async def get_by_sku(self, sku: str) -> Product | None:
        result = await self._db.execute(
            select(Product).where(Product.sku == sku, Product.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def create(self, product: Product) -> Product:
        self._db.add(product)
        await self._db.commit()
        await self._db.refresh(product)
        return product

    async def update(self, product: Product) -> Product:
        await self._db.commit()
        await self._db.refresh(product)
        return product
