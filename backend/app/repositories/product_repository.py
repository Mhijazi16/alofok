import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.product import Product
from app.models.product_option import ProductOption


class ProductRepository:
    def __init__(self, db: AsyncSession):
        self._db = db

    async def get_all(self) -> list[Product]:
        result = await self._db.execute(
            select(Product)
            .options(selectinload(Product.options))
            .where(Product.is_deleted.is_(False))
            .order_by(Product.name_en)
        )
        return list(result.scalars().all())

    async def get_by_id(self, product_id: uuid.UUID) -> Product | None:
        result = await self._db.execute(
            select(Product)
            .options(selectinload(Product.options))
            .where(Product.id == product_id, Product.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def get_by_id_for_update(self, product_id: uuid.UUID) -> Product | None:
        """Lock the row with FOR UPDATE to prevent race conditions."""
        result = await self._db.execute(
            select(Product)
            .where(Product.id == product_id, Product.is_deleted.is_(False))
            .with_for_update()
        )
        return result.scalar_one_or_none()

    async def get_by_sku(self, sku: str) -> Product | None:
        result = await self._db.execute(
            select(Product).where(Product.sku == sku, Product.is_deleted.is_(False))
        )
        return result.scalar_one_or_none()

    async def count_by_sku_prefix(self, prefix: str) -> int:
        result = await self._db.execute(
            select(func.count())
            .select_from(Product)
            .where(Product.sku.like(f"{prefix}-%"))
        )
        return result.scalar_one()

    async def get_distinct_values(self, field: str) -> list[str]:
        column = getattr(Product, field)
        result = await self._db.execute(
            select(column)
            .where(column.isnot(None), Product.is_deleted.is_(False))
            .distinct()
            .order_by(column)
        )
        return [row[0] for row in result.all()]

    async def create(self, product: Product) -> Product:
        self._db.add(product)
        await self._db.commit()
        await self._db.refresh(product)
        return product

    async def update(self, product: Product) -> Product:
        await self._db.commit()
        await self._db.refresh(product)
        return product

    async def soft_delete(self, product_id: uuid.UUID) -> Product | None:
        product = await self.get_by_id(product_id)
        if product is None:
            return None
        product.is_deleted = True
        await self._db.commit()
        await self._db.refresh(product)
        return product

    async def duplicate(self, product_id: uuid.UUID) -> Product | None:
        src = await self.get_by_id(product_id)
        if src is None:
            return None

        copy = Product(
            name_ar=src.name_ar + " (نسخة)",
            name_en=src.name_en + " (Copy)",
            sku="placeholder",  # will be replaced by service
            price=src.price,
            is_discounted=src.is_discounted,
            is_bestseller=src.is_bestseller,
            description_ar=src.description_ar,
            description_en=src.description_en,
            purchase_price=src.purchase_price,
            discount_type=src.discount_type,
            discount_value=src.discount_value,
            category=src.category,
            trademark=src.trademark,
            stock_qty=src.stock_qty,
            unit=src.unit,
            weight=src.weight,
            image_urls=src.image_urls,
            created_by=src.created_by,
        )
        self._db.add(copy)
        await self._db.flush()

        # Clone options
        for opt in src.options:
            new_opt = ProductOption(
                product_id=copy.id,
                name=opt.name,
                values=opt.values,
                sort_order=opt.sort_order,
            )
            self._db.add(new_opt)

        await self._db.commit()
        await self._db.refresh(copy)
        return copy
