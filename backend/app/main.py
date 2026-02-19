from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

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


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}


# Routers are registered here as features are built:
# from app.api.endpoints import auth, products, orders, payments, customers, admin
# app.include_router(auth.router, prefix="/auth", tags=["auth"])
