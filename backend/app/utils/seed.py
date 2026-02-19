"""
Seed script — creates an initial Admin user if none exists.

Usage:
    python -m app.utils.seed
"""
import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


async def seed_admin() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    SessionLocal = async_sessionmaker(engine, expire_on_commit=False)

    async with SessionLocal() as db:
        result = await db.execute(
            select(User).where(
                User.role == UserRole.Admin,
                User.is_deleted.is_(False),
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            logger.info("Admin user already exists (%s), skipping seed.", existing.username)
            return

        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            role=UserRole.Admin,
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        logger.info("Created admin user (username=admin).")

    await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
    asyncio.run(seed_admin())
