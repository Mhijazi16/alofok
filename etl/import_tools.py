"""
Import products from tools.csv into the database.

Run inside the backend container:
    docker compose exec backend python /etl/import_tools.py /etl/tools.csv
"""

import asyncio
import csv
import logging
import sys
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.product import Product
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


async def import_tools(csv_path: str) -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        result = await db.execute(
            select(User).where(
                User.role.in_([UserRole.Admin, UserRole.Designer]),
                User.is_deleted.is_(False),
            )
        )
        creator = result.scalars().first()
        if not creator:
            logger.error("No admin or designer user found. Create one first.")
            await engine.dispose()
            return

        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            created = 0
            skipped = 0

            for row in reader:
                sku = f"TOOL-{row['Number'].strip()}"
                name_ar = row["Name"].strip()
                price = Decimal(row["Price"].strip())
                cost = Decimal(row["Cost"].strip())
                qty = int(row["Quantity"].strip())

                existing = await db.execute(
                    select(Product).where(Product.sku == sku)
                )
                if existing.scalar_one_or_none():
                    skipped += 1
                    continue

                db.add(
                    Product(
                        name_ar=name_ar,
                        name_en=name_ar,
                        sku=sku,
                        price=price,
                        purchase_price=cost,
                        stock_qty=qty if qty > 0 else None,
                        created_by=creator.id,
                    )
                )
                created += 1
                logger.info("  + %s: %s", sku, name_ar)

            await db.commit()

        logger.info("Done: %d created, %d skipped.", created, skipped)

    await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
    path = sys.argv[1] if len(sys.argv) > 1 else "tools.csv"
    asyncio.run(import_tools(path))
