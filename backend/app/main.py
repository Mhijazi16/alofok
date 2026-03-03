from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.endpoints import (
    admin,
    auth,
    customer_auth,
    customer_portal,
    customers,
    orders,
    payments,
    products,
)
from app.middleware.error_handler import GlobalErrorHandler
from app.utils.cache import close_cache, init_cache
from app.utils.logger import setup_logging

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_cache()
    yield
    await close_cache()


app = FastAPI(
    title="Alofok (Horizon) API",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
)

# Middleware — order matters (outermost first)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(GlobalErrorHandler)

# Static file uploads served at /static
app.mount("/static", StaticFiles(directory="static", html=False), name="static")


app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(products.router, prefix="/products", tags=["catalog"])
app.include_router(customers.router, prefix="/customers", tags=["customers"])
app.include_router(orders.router, prefix="/orders", tags=["orders"])
app.include_router(payments.router, prefix="/payments", tags=["payments"])

app.include_router(admin.router, prefix="/admin", tags=["admin"])
app.include_router(
    customer_auth.router, prefix="/customer-auth", tags=["customer-auth"]
)
app.include_router(
    customer_portal.router, prefix="/customer-portal", tags=["customer-portal"]
)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
