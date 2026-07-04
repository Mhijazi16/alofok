"""Pytest fixtures for the backend test suite.

Wiring:
- A real Postgres test database (default ``localhost:5544/horizon_test`` — a
  throwaway container isolated from dev data) is targeted via the
  ``TEST_DATABASE_URL`` env var (falls back to ``DATABASE_URL``).
- The env vars the app expects are set *before* importing anything from ``app``
  so ``app.core.config.settings`` picks up the test DB rather than ``.env``.
- A session-scoped async engine is created once. Each test gets a session bound
  to an outer connection-level transaction that is rolled back at teardown, so
  every test is fully isolated even though the services call ``commit()`` — the
  session joins the outer transaction via savepoints
  (``join_transaction_mode="create_savepoint"``), so a service commit only
  releases a savepoint and never touches the real database.

The schema is assumed to already be migrated (``alembic upgrade head`` against
the test DB). CI runs the migrations before pytest; locally, run them once.
"""

import os
import uuid
from decimal import Decimal

# --- Configure the environment BEFORE importing any app module ------------
_TEST_DB_URL = os.environ.get(
    "TEST_DATABASE_URL",
    os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://postgres:password@localhost:5544/horizon_test",
    ),
)
# Normalise to the asyncpg driver the async engine needs.
if "+asyncpg" not in _TEST_DB_URL:
    _TEST_DB_URL = _TEST_DB_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
os.environ["DATABASE_URL"] = _TEST_DB_URL
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("SLACK_WEBHOOK_URL", "")

import pytest_asyncio  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    create_async_engine,
)

from app.core.security import hash_password  # noqa: E402
from app.models.customer import AssignedDay, Customer  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.repositories.customer_repository import CustomerRepository  # noqa: E402
from app.repositories.ledger_repository import LedgerRepository  # noqa: E402
from app.repositories.product_repository import ProductRepository  # noqa: E402
from app.repositories.transaction_repository import (  # noqa: E402
    TransactionRepository,
)
from app.services.order_service import OrderService  # noqa: E402
from app.services.payment_service import PaymentService  # noqa: E402
from app.services.purchase_service import PurchaseService  # noqa: E402
from app.utils.cache import InMemoryCache  # noqa: E402


@pytest_asyncio.fixture(scope="session", loop_scope="session")
async def engine():
    eng = create_async_engine(_TEST_DB_URL, echo=False)
    yield eng
    await eng.dispose()


@pytest_asyncio.fixture(loop_scope="session")
async def db(engine):
    """Per-test session wrapped in a rolled-back outer transaction.

    Services under test call ``session.commit()``. Because the session joins the
    outer transaction with ``create_savepoint`` mode, those commits release
    savepoints instead of committing to the DB, and the outer ``rollback()`` at
    teardown wipes everything the test did — no cross-test contamination.
    """
    conn = await engine.connect()
    outer = await conn.begin()
    session = AsyncSession(
        bind=conn,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    try:
        yield session
    finally:
        await session.close()
        if outer.is_active:
            await outer.rollback()
        await conn.close()


# ---------------------------------------------------------------------------
# Builders — persist rows in the test session so repositories can read them.
# ---------------------------------------------------------------------------


async def make_user(
    db: AsyncSession,
    *,
    role: UserRole = UserRole.Sales,
    username: str | None = None,
    is_active: bool = True,
    is_deleted: bool = False,
) -> User:
    user = User(
        username=username or f"user_{uuid.uuid4().hex[:8]}",
        password_hash=hash_password("password123"),
        role=role,
        is_active=is_active,
        is_deleted=is_deleted,
    )
    db.add(user)
    await db.flush()
    return user


async def make_customer(
    db: AsyncSession,
    *,
    name: str | None = None,
    balance: Decimal | int | str = 0,
    assigned_to: uuid.UUID | None = None,
    assigned_day: AssignedDay = AssignedDay.Mon,
    city: str = "Test City",
) -> Customer:
    customer = Customer(
        name=name or f"cust_{uuid.uuid4().hex[:8]}",
        city=city,
        assigned_day=assigned_day,
        balance=Decimal(str(balance)),
        assigned_to=assigned_to,
    )
    db.add(customer)
    await db.flush()
    return customer


async def make_product(
    db: AsyncSession,
    *,
    created_by: uuid.UUID,
    price: Decimal | int | str = 10,
    stock_qty: int | None = 100,
    purchase_price: Decimal | int | str | None = 5,
) -> Product:
    product = Product(
        name_ar="منتج",
        name_en="Product",
        sku=f"SKU-{uuid.uuid4().hex[:10]}",
        price=Decimal(str(price)),
        stock_qty=stock_qty,
        purchase_price=(
            Decimal(str(purchase_price)) if purchase_price is not None else None
        ),
        created_by=created_by,
    )
    db.add(product)
    await db.flush()
    return product


class Services:
    """All the transaction-related services wired to one test session."""

    def __init__(self, db: AsyncSession):
        self.cache = InMemoryCache()
        self.customers = CustomerRepository(db)
        self.transactions = TransactionRepository(db)
        self.products = ProductRepository(db)
        self.ledger = LedgerRepository(db)
        self.orders = OrderService(self.customers, self.transactions, self.cache)
        self.payments = PaymentService(
            self.customers, self.transactions, self.ledger, self.cache
        )
        self.purchases = PurchaseService(
            self.customers, self.transactions, self.products, self.ledger
        )


@pytest_asyncio.fixture(loop_scope="session")
async def services(db):
    return Services(db)


# Expose builders as fixtures too, for tests that prefer injection.
@pytest_asyncio.fixture(loop_scope="session")
async def sales_user(db):
    return await make_user(db, role=UserRole.Sales)


@pytest_asyncio.fixture(loop_scope="session")
async def admin_user(db):
    return await make_user(db, role=UserRole.Admin)


@pytest_asyncio.fixture(loop_scope="session")
async def customer(db, sales_user):
    return await make_customer(db, assigned_to=sales_user.id)
