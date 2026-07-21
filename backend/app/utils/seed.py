"""
Seed script — idempotent. Safe to run on every container start and to re-run
by hand (see backend/Dockerfile CMD):

    python -m app.utils.seed

It creates the baseline users and seeds the product catalog + active customers
(with their opening balances) from the committed legacy data files under
``seed_data/``. Those CSVs were reconciled from the legacy ERPnext export:

  * products.csv   — full catalog (SKU ``TOOL-{legacy_catid}``); the 43 items
                     that did not exist in the old ``tools.csv`` import are
                     included here too.
  * customers.csv  — the 114 customers that carry a real opening balance, with
                     their route city + visit day and authoritative balance
                     (signed: negative == we owe the customer).

Idempotency rules:
  * users    — created only if missing (never overwrites an existing password).
  * products — inserted by SKU; existing SKUs are left untouched.
  * customers— matched by name. Missing ones are inserted. An existing
               customer's balance/opening-entry is refreshed ONLY when it has
               no real (non-opening) transactions yet, so re-running after the
               sales team is live never clobbers their ledger. City/day/phone
               metadata is always kept in sync.
"""

import asyncio
import csv
import logging
import os
import random
import string
from decimal import Decimal, InvalidOperation

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password
from app.models.customer import AssignedDay, Customer
from app.models.product import Product
from app.models.transaction import Currency, Transaction, TransactionType
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)

DATA_DIR = os.path.join(os.path.dirname(__file__), "seed_data")

_DAY_MAP = {
    "sunday": AssignedDay.Sun,
    "monday": AssignedDay.Mon,
    "tuesday": AssignedDay.Tue,
    "wednesday": AssignedDay.Wed,
    "thursday": AssignedDay.Thu,
    "friday": AssignedDay.Fri,
    "saturday": AssignedDay.Sat,
}


def _parse_day(val: str) -> AssignedDay:
    return _DAY_MAP[val.strip().lower()]


def _dec(val: str) -> Decimal | None:
    val = (val or "").strip()
    if not val:
        return None
    try:
        return Decimal(val)
    except InvalidOperation:
        return None


def _avatar_seed() -> str:
    return "".join(random.choices(string.ascii_lowercase + string.digits, k=8))


_DEFAULT_ADMIN_PASSWORD = "admin123"
_DEFAULT_SALES_PASSWORD = "malik2026"


def _seed_password(configured: str, default: str, label: str) -> str:
    """Return the env-configured password, falling back to the legacy default.

    Warns loudly when the insecure default is used so it is visible in logs.
    """
    if configured:
        return configured
    logger.warning(
        "Using default %s seed password — set SEED_%s_PASSWORD to override.",
        label.lower(),
        label.upper(),
    )
    return default


async def seed_users(db: AsyncSession) -> tuple[User, User]:
    """Ensure the baseline admin + sales rep exist. Returns (creator, rep)."""
    admin_password = _seed_password(
        settings.SEED_ADMIN_PASSWORD, _DEFAULT_ADMIN_PASSWORD, "ADMIN"
    )
    sales_password = _seed_password(
        settings.SEED_SALES_PASSWORD, _DEFAULT_SALES_PASSWORD, "SALES"
    )

    # Admin — product creator / catalog owner.
    admin = (
        await db.execute(
            select(User).where(User.role == UserRole.Admin, User.is_deleted.is_(False))
        )
    ).scalar_one_or_none()
    if admin is None:
        admin = User(
            username="admin",
            password_hash=hash_password(admin_password),
            role=UserRole.Admin,
            is_active=True,
        )
        db.add(admin)
        await db.flush()
        logger.info("Created admin user (username=admin).")

    # Sales rep — customers are assigned to them.
    rep = (
        await db.execute(
            select(User).where(User.username == "malik", User.is_deleted.is_(False))
        )
    ).scalar_one_or_none()
    if rep is None:
        rep = User(
            username="malik",
            password_hash=hash_password(sales_password),
            role=UserRole.Sales,
            is_active=True,
        )
        db.add(rep)
        await db.flush()
        logger.info("Created sales rep (username=malik).")

    return admin, rep


async def seed_products(db: AsyncSession, creator: User) -> None:
    path = os.path.join(DATA_DIR, "products.csv")
    created = skipped = 0
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            sku = row["sku"].strip()
            exists = (
                await db.execute(select(Product.id).where(Product.sku == sku))
            ).first()
            if exists:
                skipped += 1
                continue
            name = row["name_ar"].strip()
            db.add(
                Product(
                    name_ar=name,
                    name_en=name,
                    sku=sku,
                    price=_dec(row["price"]) or Decimal("0"),
                    purchase_price=_dec(row.get("purchase_price", "")),
                    stock_qty=(
                        int(row["stock_qty"])
                        if row.get("stock_qty", "").strip()
                        else None
                    ),
                    created_by=creator.id,
                )
            )
            created += 1
    await db.flush()
    logger.info("Products: %d created, %d skipped (already present).", created, skipped)


async def _refresh_opening(
    db: AsyncSession, customer: Customer, rep: User, amount: Decimal
) -> None:
    """Create or update the customer's ORIGINAL Opening_Balance transaction.

    A customer can have more than one Opening_Balance row: reps post a
    settlement (تسوية) as one when they re-anchor a balance face-to-face. Only
    the earliest — the legacy migration entry — is ours to touch, and this is
    only ever reached when the customer has no live activity at all.
    """
    opening = (
        await db.execute(
            select(Transaction)
            .where(
                Transaction.customer_id == customer.id,
                Transaction.type == TransactionType.Opening_Balance,
                Transaction.is_deleted.is_(False),
            )
            .order_by(Transaction.created_at.asc())
            .limit(1)
        )
    ).scalar_one_or_none()
    if opening is None:
        db.add(
            Transaction(
                customer_id=customer.id,
                created_by=rep.id,
                type=TransactionType.Opening_Balance,
                currency=Currency.ILS,
                amount=amount,
                notes="Opening balance (legacy migration)",
            )
        )
    else:
        opening.amount = amount


async def seed_customers(db: AsyncSession, rep: User) -> None:
    path = os.path.join(DATA_DIR, "customers.csv")
    created = updated = preserved = 0
    with open(path, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            name = row["name"].strip()
            balance = _dec(row["balance"]) or Decimal("0")
            city = row["city"].strip()
            day = _parse_day(row["day"])
            phone = (row.get("phone") or "").strip() or None

            customer = (
                await db.execute(
                    select(Customer).where(
                        Customer.name == name, Customer.is_deleted.is_(False)
                    )
                )
            ).scalar_one_or_none()

            if customer is None:
                customer = Customer(
                    name=name,
                    city=city,
                    assigned_day=day,
                    assigned_to=rep.id,
                    balance=balance,
                    phone=phone,
                    avatar_url=f"dicebear:{_avatar_seed()}",
                )
                db.add(customer)
                await db.flush()
                await _refresh_opening(db, customer, rep, balance)
                created += 1
                continue

            # Existing customer: preserve app-side edits. Once reps are live they
            # manage route metadata (city / visit day / assignment) in the app, so
            # only fill fields that are still empty — NEVER clobber a rep's change.
            # (The old code re-synced city/assigned_day on every boot, so a deploy
            # silently reverted a rep moving a customer from e.g. Tuesday to Saturday.)
            if not customer.city:
                customer.city = city
            if customer.assigned_day is None:
                customer.assigned_day = day
            if phone and not customer.phone:
                customer.phone = phone
            if customer.assigned_to is None:
                customer.assigned_to = rep.id

            # Balance is only refreshed while the customer has no real ledger
            # activity yet — once the rep starts transacting we never overwrite.
            # A rep-posted settlement is stored as an Opening_Balance row but is
            # very much live activity — it must count, or the next boot would
            # wipe the balance the rep agreed with the customer.
            real_txns = (
                await db.execute(
                    select(func.count(Transaction.id)).where(
                        Transaction.customer_id == customer.id,
                        or_(
                            Transaction.type != TransactionType.Opening_Balance,
                            Transaction.data["settlement"].astext == "true",
                        ),
                        Transaction.is_deleted.is_(False),
                    )
                )
            ).scalar_one()
            if real_txns == 0:
                customer.balance = balance
                await _refresh_opening(db, customer, rep, balance)
                updated += 1
            else:
                preserved += 1
    await db.flush()
    logger.info(
        "Customers: %d created, %d balances refreshed, %d preserved (have live ledger).",
        created,
        updated,
        preserved,
    )


async def seed() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)
    async with SessionLocal() as db:
        creator, rep = await seed_users(db)
        await seed_products(db, creator)
        await seed_customers(db, rep)
        await db.commit()
    await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
    asyncio.run(seed())
