"""
Seed products from seed_products.json into the PostgreSQL database.

Usage:
    python scripts/seed_products_db.py --user-id <uuid>

Or set SEED_USER_ID env var instead of --user-id.
"""

import argparse
import asyncio
import json
import os
import re
import sys
import uuid
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select, String, cast
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# ---------------------------------------------------------------------------
# We import models directly so SQLAlchemy metadata is populated.
# Adjust sys.path so the script can find the backend package.
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.models.product import Product  # noqa: E402
from app.models.product_option import ProductOption  # noqa: E402

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SEED_FILE = Path(__file__).resolve().parent / "seed_products.json"


def _load_dotenv_database_url() -> str | None:
    """Read DATABASE_URL from backend/.env without requiring python-dotenv."""
    env_path = BACKEND_DIR / ".env"
    if not env_path.exists():
        return None
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip().strip("\"'")
    return None


def get_database_url() -> str:
    url = os.environ.get("DATABASE_URL") or _load_dotenv_database_url()
    if not url:
        sys.exit("ERROR: No DATABASE_URL found in env or backend/.env")
    # Accept plain postgres:// and convert to asyncpg variant
    if url.startswith("postgresql://") or url.startswith("postgres://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    return url


def make_sku_prefix(category: str | None) -> str:
    """First 5 alphanumeric characters of category, uppercased."""
    if not category:
        return "GENRL"
    chars = re.sub(r"[^A-Za-z0-9\u0600-\u06FF]", "", category)
    if not chars:
        return "GENRL"
    return chars[:5].upper()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


async def seed(user_id: uuid.UUID) -> None:
    with open(SEED_FILE, "r", encoding="utf-8") as f:
        products_data: list[dict] = json.load(f)

    engine = create_async_engine(get_database_url(), echo=False)
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    # Track SKU counters per prefix to ensure uniqueness
    sku_counters: dict[str, int] = {}

    async with async_session() as session:
        session: AsyncSession

        # Pre-load existing product names to skip duplicates
        result = await session.execute(select(Product.name_ar))
        existing_names = {row[0] for row in result.all()}

        # Pre-load existing SKU prefixes to continue numbering
        result = await session.execute(select(Product.sku))
        for (sku_val,) in result.all():
            if sku_val:
                match = re.match(r"^(.+?)-(\d+)$", sku_val)
                if match:
                    prefix, num = match.group(1), int(match.group(2))
                    sku_counters[prefix] = max(sku_counters.get(prefix, 0), num)

        created = 0
        skipped = 0

        for item in products_data:
            name_ar = item["name_ar"]

            if name_ar in existing_names:
                print(f"  SKIP (exists): {name_ar}")
                skipped += 1
                continue

            # Generate SKU
            prefix = make_sku_prefix(item.get("category"))
            counter = sku_counters.get(prefix, 0) + 1
            sku_counters[prefix] = counter
            sku = f"{prefix}-{counter:04d}"

            product = Product(
                id=uuid.uuid4(),
                name_ar=name_ar,
                name_en=item.get("name_en", ""),
                sku=sku,
                price=Decimal(str(item["price"])),
                is_discounted=item.get("is_discounted", False),
                is_bestseller=item.get("is_bestseller", False),
                description_ar=item.get("description_ar"),
                description_en=item.get("description_en"),
                purchase_price=(
                    Decimal(str(item["purchase_price"]))
                    if item.get("purchase_price") is not None
                    else None
                ),
                discount_type=item.get("discount_type"),
                discount_value=(
                    Decimal(str(item["discount_value"]))
                    if item.get("discount_value") is not None
                    else None
                ),
                category=item.get("category"),
                trademark=item.get("trademark"),
                stock_qty=item.get("stock_qty"),
                unit=item.get("unit", "piece"),
                weight=(
                    Decimal(str(item["weight"]))
                    if item.get("weight") is not None
                    else None
                ),
                image_urls=item.get("image_urls"),
                created_by=user_id,
            )
            session.add(product)
            await session.flush()  # get product.id for options

            # Create options
            options = item.get("options") or []
            for idx, opt in enumerate(options):
                option = ProductOption(
                    id=uuid.uuid4(),
                    product_id=product.id,
                    name=opt["name"],
                    values=opt["values"],
                    sort_order=idx,
                )
                session.add(option)

            created += 1
            opt_count = len(options)
            print(f"  ADD: {name_ar}  [SKU={sku}, options={opt_count}]")

        await session.commit()

    await engine.dispose()
    print(f"\nDone. Created: {created}, Skipped (duplicates): {skipped}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed products into the database")
    parser.add_argument(
        "--user-id",
        type=str,
        default=os.environ.get("SEED_USER_ID"),
        help="UUID of the admin/designer user who owns the products",
    )
    args = parser.parse_args()

    if not args.user_id:
        print("ERROR: Provide --user-id <uuid> or set SEED_USER_ID env var.")
        sys.exit(1)

    try:
        user_id = uuid.UUID(args.user_id)
    except ValueError:
        print(f"ERROR: Invalid UUID: {args.user_id}")
        sys.exit(1)

    print(f"Seeding products from {SEED_FILE}")
    print(f"User ID: {user_id}")
    print(f"Database: {get_database_url()}\n")

    asyncio.run(seed(user_id))


if __name__ == "__main__":
    main()
