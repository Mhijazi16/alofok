from typing import Annotated

from fastapi import Depends, Header
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.errors import HorizonException
from app.core.security import decode_access_token
from app.repositories.customer_auth_repository import CustomerAuthRepository
from app.repositories.customer_repository import CustomerRepository
from app.repositories.ledger_repository import LedgerRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.user_repository import UserRepository
from app.services.admin_service import AdminService
from app.services.auth_service import AuthService
from app.services.catalog_service import CatalogService
from app.services.customer_auth_service import CustomerAuthService
from app.services.customer_portal_service import CustomerPortalService
from app.services.customer_service import CustomerService
from app.services.order_service import OrderService
from app.services.payment_service import PaymentService
from app.utils.cache import CacheBackend, get_cache

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_recycle=settings.DB_POOL_RECYCLE,
    pool_pre_ping=True,
    echo=False,
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


DbSession = Annotated[AsyncSession, Depends(get_db)]

# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------

Cache = Annotated[CacheBackend, Depends(get_cache)]

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HorizonException(401, "Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise HorizonException(401, "Invalid or expired token")
    return payload


CurrentUser = Annotated[dict, Depends(get_current_user)]


def _require_role(*roles: str):
    async def guard(user: CurrentUser) -> dict:
        if user.get("role") not in roles:
            raise HorizonException(403, "Insufficient permissions")
        return user

    return guard


require_admin = Depends(_require_role("Admin"))
require_designer = Depends(_require_role("Designer", "Admin"))
require_sales = Depends(_require_role("Sales", "Admin"))


# ---------------------------------------------------------------------------
# Customer Auth
# ---------------------------------------------------------------------------


async def get_current_customer(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HorizonException(401, "Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    try:
        payload = decode_access_token(token)
    except JWTError:
        raise HorizonException(401, "Invalid or expired token")
    if payload.get("user_type") != "customer":
        raise HorizonException(403, "Not a customer token")
    return payload


CurrentCustomer = Annotated[dict, Depends(get_current_customer)]

# ---------------------------------------------------------------------------
# Repositories
# ---------------------------------------------------------------------------


def get_user_repo(db: DbSession) -> UserRepository:
    return UserRepository(db)


def get_product_repo(db: DbSession) -> ProductRepository:
    return ProductRepository(db)


def get_customer_repo(db: DbSession) -> CustomerRepository:
    return CustomerRepository(db)


def get_transaction_repo(db: DbSession) -> TransactionRepository:
    return TransactionRepository(db)


def get_customer_auth_repo(db: DbSession) -> CustomerAuthRepository:
    return CustomerAuthRepository(db)


def get_ledger_repo(db: DbSession) -> LedgerRepository:
    return LedgerRepository(db)


UserRepo = Annotated[UserRepository, Depends(get_user_repo)]
ProductRepo = Annotated[ProductRepository, Depends(get_product_repo)]
CustomerRepo = Annotated[CustomerRepository, Depends(get_customer_repo)]
TransactionRepo = Annotated[TransactionRepository, Depends(get_transaction_repo)]
CustomerAuthRepo = Annotated[CustomerAuthRepository, Depends(get_customer_auth_repo)]
LedgerRepo = Annotated[LedgerRepository, Depends(get_ledger_repo)]

# ---------------------------------------------------------------------------
# Services
# ---------------------------------------------------------------------------


def get_auth_service(user_repo: UserRepo) -> AuthService:
    return AuthService(user_repo)


def get_catalog_service(product_repo: ProductRepo, cache: Cache) -> CatalogService:
    return CatalogService(product_repo, cache)


def get_customer_service(
    customer_repo: CustomerRepo,
    transaction_repo: TransactionRepo,
    cache: Cache,
    auth_repo: CustomerAuthRepo,
) -> CustomerService:
    return CustomerService(customer_repo, transaction_repo, cache, auth_repo)


def get_order_service(
    customer_repo: CustomerRepo, transaction_repo: TransactionRepo
) -> OrderService:
    return OrderService(customer_repo, transaction_repo)


def get_customer_auth_service(
    auth_repo: CustomerAuthRepo, customer_repo: CustomerRepo
) -> CustomerAuthService:
    return CustomerAuthService(auth_repo, customer_repo)


def get_customer_portal_service(
    customer_repo: CustomerRepo,
    transaction_repo: TransactionRepo,
    cache: Cache,
) -> CustomerPortalService:
    return CustomerPortalService(customer_repo, transaction_repo, cache)


def get_payment_service(
    customer_repo: CustomerRepo, transaction_repo: TransactionRepo
) -> PaymentService:
    return PaymentService(customer_repo, transaction_repo)


def get_admin_service(db: DbSession) -> AdminService:
    return AdminService(db)


AdminSvc = Annotated[AdminService, Depends(get_admin_service)]

AuthSvc = Annotated[AuthService, Depends(get_auth_service)]
CatalogSvc = Annotated[CatalogService, Depends(get_catalog_service)]
CustomerSvc = Annotated[CustomerService, Depends(get_customer_service)]
OrderSvc = Annotated[OrderService, Depends(get_order_service)]
PaymentSvc = Annotated[PaymentService, Depends(get_payment_service)]
CustomerAuthSvc = Annotated[CustomerAuthService, Depends(get_customer_auth_service)]
CustomerPortalSvc = Annotated[
    CustomerPortalService, Depends(get_customer_portal_service)
]
