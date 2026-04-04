"""
Import customers from a CSV file with columns: Name, Balance, city, day, phone

Generates a random DiceBear avatar seed for each customer.
Creates an Opening_Balance transaction if balance != 0.

Usage (run inside backend container):
    docker compose exec backend bash -c "PYTHONPATH=/app python /etl/import_customers.py /etl/data/bethlahem.csv --rep malik"
"""

import argparse
import asyncio
import csv
import logging
import random
import string
import sys
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.customer import AssignedDay, Customer
from app.models.transaction import Currency, Transaction, TransactionType
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

DAY_MAP = {
    "sunday": AssignedDay.Sun,
    "monday": AssignedDay.Mon,
    "tuesday": AssignedDay.Tue,
    "wednesday": AssignedDay.Wed,
    "thursday": AssignedDay.Thu,
    "friday": AssignedDay.Fri,
    "saturday": AssignedDay.Sat,
}


def parse_day(val: str) -> AssignedDay:
    low = val.strip().lower()
    if low in DAY_MAP:
        return DAY_MAP[low]
    for key, day in DAY_MAP.items():
        if key[:3] == low[:3]:
            return day
    raise ValueError(f"Unknown day: {val}")


def random_avatar_seed() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


async def import_customers(csv_path: str, rep_username: str) -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        # Find the sales rep
        result = await db.execute(
            select(User).where(User.username == rep_username, User.is_deleted.is_(False))
        )
        rep = result.scalar_one_or_none()
        if not rep:
            logger.error("User '%s' not found.", rep_username)
            await engine.dispose()
            return

        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            created = 0
            skipped = 0

            for row in reader:
                name = row["Name"].strip()
                balance = Decimal(row["Balance"].strip())
                city = row["city"].strip()
                day = parse_day(row["day"])
                phone = row.get("phone", "").strip() or None
                avatar_seed = random_avatar_seed()

                # Skip if customer with same name + city already exists for this rep
                existing = await db.execute(
                    select(Customer).where(
                        Customer.name == name,
                        Customer.city == city,
                        Customer.assigned_to == rep.id,
                        Customer.is_deleted.is_(False),
                    )
                )
                if existing.scalar_one_or_none():
                    skipped += 1
                    continue

                customer = Customer(
                    name=name,
                    city=city,
                    assigned_day=day,
                    assigned_to=rep.id,
                    balance=balance,
                    phone=phone,
                    avatar_url=f"dicebear:{avatar_seed}",
                )
                db.add(customer)
                await db.flush()

                # Create opening balance transaction if non-zero
                if balance != 0:
                    db.add(
                        Transaction(
                            customer_id=customer.id,
                            created_by=rep.id,
                            type=TransactionType.Opening_Balance,
                            currency=Currency.ILS,
                            amount=balance,
                            notes="Opening balance (CSV import)",
                        )
                    )

                created += 1
                logger.info("  + %s (%s) — balance: %s", name, city, balance)

            await db.commit()

        logger.info("Done: %d created, %d skipped.", created, skipped)

    await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
    parser = argparse.ArgumentParser(description="Import customers from CSV")
    parser.add_argument("file", help="Path to CSV file")
    parser.add_argument("--rep", required=True, help="Username of the sales rep to assign customers to")
    args = parser.parse_args()
    asyncio.run(import_customers(args.file, args.rep))
