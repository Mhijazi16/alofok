"""
Demo seed — populates the database with realistic mock data for UI preview.

Creates:
  • 3 users  (designer / samer / khalil)  + the admin from seed.py
  • 15 products  (painting-tools catalog, Arabic + English names)
  • 10 customers  (split across two sales reps, multiple cities and days)
  • ~40 transactions  (orders, cash payments, checks, one returned check)

Usage:
    python -m app.utils.seed_demo
"""

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password
from app.models.customer import AssignedDay, Customer
from app.models.product import Product
from app.models.transaction import (
    Currency,
    Transaction,
    TransactionStatus,
    TransactionType,
)
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


def ago(days: int, hours: int = 0) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days, hours=hours)


# ── helpers ───────────────────────────────────────────────────────────────────


def order(customer_id, created_by, amount, days, items=None) -> Transaction:
    return Transaction(
        customer_id=customer_id,
        created_by=created_by,
        type=TransactionType.Order,
        currency=Currency.ILS,
        amount=Decimal(str(amount)),
        created_at=ago(days),
        data={"items": items or []},
    )


def pay_cash(customer_id, created_by, amount, days, notes=None) -> Transaction:
    return Transaction(
        customer_id=customer_id,
        created_by=created_by,
        type=TransactionType.Payment_Cash,
        currency=Currency.ILS,
        amount=Decimal(str(-amount)),  # negative = payment
        created_at=ago(days),
        notes=notes,
    )


def pay_check(
    customer_id,
    created_by,
    amount,
    days,
    bank="بنك فلسطين",
    due_days=30,
    status=TransactionStatus.Pending,
) -> Transaction:
    due = (datetime.now(timezone.utc) + timedelta(days=due_days)).date().isoformat()
    return Transaction(
        id=uuid.uuid4(),
        customer_id=customer_id,
        created_by=created_by,
        type=TransactionType.Payment_Check,
        currency=Currency.ILS,
        amount=Decimal(str(-amount)),
        status=status,
        created_at=ago(days),
        data={"bank": bank, "due_date": due},
    )


def check_return(customer_id, created_by, amount, days, original_id) -> Transaction:
    return Transaction(
        customer_id=customer_id,
        created_by=created_by,
        type=TransactionType.Check_Return,
        currency=Currency.ILS,
        amount=Decimal(str(amount)),  # positive = re-debits customer
        created_at=ago(days),
        related_transaction_id=original_id,
    )


# ── main seed ─────────────────────────────────────────────────────────────────


async def seed_demo() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:

        # ── guard: skip if demo data already exists ──────────────────────────
        existing = (
            await db.execute(select(User).where(User.username == "samer"))
        ).scalar_one_or_none()
        if existing:
            logger.info("Demo data already present — skipping.")
            await engine.dispose()
            return

        # ── Users ─────────────────────────────────────────────────────────────
        designer = User(
            username="designer",
            password_hash=hash_password("designer123"),
            role=UserRole.Designer,
            is_active=True,
        )
        samer = User(
            username="samer",
            password_hash=hash_password("samer123"),
            role=UserRole.Sales,
            is_active=True,
        )
        khalil = User(
            username="khalil",
            password_hash=hash_password("khalil123"),
            role=UserRole.Sales,
            is_active=True,
        )
        db.add_all([designer, samer, khalil])
        await db.flush()

        # ── Products ──────────────────────────────────────────────────────────
        catalog = [
            # (name_ar, name_en, sku, price, bestseller, discounted)
            ("فرشاة دهان كبيرة", "Large Paint Brush", "BRUSH-LG", 45.00, True, False),
            ("فرشاة دهان صغيرة", "Small Paint Brush", "BRUSH-SM", 25.00, False, False),
            (
                "رولة دهان بروفشنال",
                "Pro Paint Roller",
                "ROLLER-PRO",
                95.00,
                True,
                False,
            ),
            ("رولة مايكروفايبر", "Microfiber Roller", "ROLLER-MF", 55.00, True, True),
            (
                "طقم فرش دهان 5 قطع",
                "Paint Brush Set 5pc",
                "BRUSH-SET5",
                120.00,
                False,
                True,
            ),
            ("دلو دهان 10 لتر", "Paint Bucket 10L", "PAINT-10L", 185.00, False, False),
            ("دلو دهان 5 لتر", "Paint Bucket 5L", "PAINT-5L", 98.00, False, True),
            ("شريط مسكر احترافي", "Pro Masking Tape", "TAPE-PRO", 14.00, False, False),
            (
                "نايلون حماية أرضيات",
                "Floor Protection Film",
                "FILM-FLOOR",
                38.00,
                False,
                False,
            ),
            (
                "صنفرة ناعمة (عبوة 10 قطع)",
                "Fine Sandpaper Pack 10pc",
                "SAND-FINE",
                22.00,
                False,
                True,
            ),
            (
                "صنفرة خشنة (عبوة 10 قطع)",
                "Coarse Sandpaper Pack 10pc",
                "SAND-COARSE",
                22.00,
                False,
                False,
            ),
            (
                "ماكينة رش دهان كهربائية",
                "Electric Paint Sprayer",
                "SPRAY-ELEC",
                680.00,
                True,
                False,
            ),
            ("مواد تخفيف 1 لتر", "Paint Thinner 1L", "THIN-1L", 24.00, False, False),
            (
                "قفازات حماية لاتكس",
                "Latex Protection Gloves",
                "GLOVE-LAT",
                16.00,
                False,
                True,
            ),
            ("نظارات سلامة", "Safety Goggles", "GOGGLE-STD", 32.00, False, False),
        ]
        for name_ar, name_en, sku, price, bs, disc in catalog:
            db.add(
                Product(
                    name_ar=name_ar,
                    name_en=name_en,
                    sku=sku,
                    price=Decimal(str(price)),
                    is_bestseller=bs,
                    is_discounted=disc,
                    created_by=designer.id,
                )
            )

        # ── Customers ─────────────────────────────────────────────────────────
        # Balance is set to 0 now; we'll update it after creating transactions.
        def cust(name, city, day, rep):
            c = Customer(
                name=name,
                city=city,
                assigned_day=day,
                assigned_to=rep.id,
                balance=Decimal("0"),
            )
            db.add(c)
            return c

        # Samer's route
        omar = cust("محل عمر للدهانات", "رام الله", AssignedDay.Sun, samer)
        haj = cust("ورشة الحاج إبراهيم", "رام الله", AssignedDay.Sun, samer)
        najjar = cust("دهانات النجار", "البيرة", AssignedDay.Mon, samer)
        bldg = cust("مستودع البناء الحديث", "البيرة", AssignedDay.Mon, samer)
        madina = cust("ورشة المدينة", "أريحا", AssignedDay.Tue, samer)
        sibagha = cust("مركز الصباغة", "أريحا", AssignedDay.Tue, samer)

        # Khalil's route
        south = cust("دهانات الجنوب", "بيت لحم", AssignedDay.Wed, khalil)
        bsahour = cust("مركز البناء والديكور", "بيت ساحور", AssignedDay.Wed, khalil)
        north = cust("ورشة الشمال للدهانات", "نابلس", AssignedDay.Thu, khalil)
        wadi = cust("دهانات الوادي", "نابلس", AssignedDay.Thu, khalil)

        await db.flush()

        # ── Transactions ──────────────────────────────────────────────────────
        # Balance = sum of all signed amounts. Build the list then flush once.

        txns: list[Transaction] = []

        # omar — balance target 2 500
        txns += [
            order(omar.id, samer.id, 3000, 45),
            pay_cash(omar.id, samer.id, 1500, 35),
            order(omar.id, samer.id, 2000, 20),
            pay_cash(omar.id, samer.id, 1000, 10),
        ]  # 3000-1500+2000-1000 = 2500

        # haj — balance target 850
        txns += [
            order(haj.id, samer.id, 1500, 30),
            pay_cash(haj.id, samer.id, 650, 18),
        ]  # 1500-650 = 850

        # najjar — balance target 4 200
        txns += [
            order(najjar.id, samer.id, 5000, 60),
            pay_cash(najjar.id, samer.id, 2000, 50),
            order(najjar.id, samer.id, 3000, 28),
            pay_check(najjar.id, samer.id, 1800, 18, bank="بنك القدس", due_days=20),
        ]  # 5000-2000+3000-1800 = 4200

        # bldg — balance 0 (fully paid up)
        txns += [
            order(bldg.id, samer.id, 2500, 50),
            pay_cash(bldg.id, samer.id, 2500, 35),
        ]  # 0

        # madina — balance 1 800
        txns += [
            order(madina.id, samer.id, 2500, 22),
            pay_check(madina.id, samer.id, 700, 12, bank="بنك فلسطين", due_days=15),
        ]  # 2500-700 = 1800

        # sibagha — balance 3 400
        txns += [
            order(sibagha.id, samer.id, 4000, 40),
            pay_cash(sibagha.id, samer.id, 1500, 30),
            order(sibagha.id, samer.id, 1500, 15),
            pay_cash(sibagha.id, samer.id, 600, 5),
        ]  # 4000-1500+1500-600 = 3400

        # south — balance 3 100  (includes a returned check)
        bad_check = pay_check(
            south.id,
            khalil.id,
            2000,
            40,
            bank="بنك لييمي",
            due_days=-10,  # already overdue
            status=TransactionStatus.Returned,
        )
        txns.append(order(south.id, khalil.id, 4500, 50))
        txns.append(bad_check)
        await db.flush()  # need bad_check.id for the return link
        txns.append(check_return(south.id, khalil.id, 2000, 35, bad_check.id))
        txns.append(pay_cash(south.id, khalil.id, 1400, 20))
        # 4500-2000+2000-1400 = 3100

        # bsahour — balance 720
        txns += [
            order(bsahour.id, khalil.id, 1200, 20),
            pay_cash(bsahour.id, khalil.id, 480, 8),
        ]  # 720

        # north — balance 5 500
        txns += [
            order(north.id, khalil.id, 7000, 60),
            pay_check(north.id, khalil.id, 3000, 50, bank="بنك الإسكان", due_days=5),
            order(north.id, khalil.id, 3000, 25),
            pay_cash(north.id, khalil.id, 1500, 14),
        ]  # 7000-3000+3000-1500 = 5500

        # wadi — balance 2 200
        txns += [
            order(wadi.id, khalil.id, 3500, 35),
            pay_cash(wadi.id, khalil.id, 1300, 22),
        ]  # 2200

        for t in txns:
            db.add(t)
        await db.flush()

        # ── Update customer balances ───────────────────────────────────────────
        balance_map = {
            omar.id: Decimal("2500"),
            haj.id: Decimal("850"),
            najjar.id: Decimal("4200"),
            bldg.id: Decimal("0"),
            madina.id: Decimal("1800"),
            sibagha.id: Decimal("3400"),
            south.id: Decimal("3100"),
            bsahour.id: Decimal("720"),
            north.id: Decimal("5500"),
            wadi.id: Decimal("2200"),
        }
        for customer_obj in [
            omar,
            haj,
            najjar,
            bldg,
            madina,
            sibagha,
            south,
            bsahour,
            north,
            wadi,
        ]:
            customer_obj.balance = balance_map[customer_obj.id]

        await db.commit()

    await engine.dispose()
    logger.info("✓ Demo data seeded:")
    logger.info("  Users    — designer / samer / khalil  (password = username + '123')")
    logger.info("  Products — 15 painting-tools items")
    logger.info("  Customers— 10 across رام الله، البيرة، أريحا، بيت لحم، نابلس")
    logger.info("  Transactions — orders, cash payments, checks, 1 returned check")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
    asyncio.run(seed_demo())
