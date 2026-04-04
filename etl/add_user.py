"""
Create a new user (Admin, Sales, or Designer).

Run inside the backend container:
    docker compose exec backend python /etl/add_user.py --username samer --password samer123 --role Sales
    docker compose exec backend python /etl/add_user.py --username boss --password boss123 --role Admin
"""

import argparse
import asyncio
import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.core.security import hash_password
from app.models.user import User, UserRole

logger = logging.getLogger(__name__)


async def add_user(username: str, password: str, role: str) -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        existing = await db.execute(
            select(User).where(User.username == username)
        )
        if existing.scalar_one_or_none():
            logger.info("User '%s' already exists — skipping.", username)
            await engine.dispose()
            return

        db.add(
            User(
                username=username,
                password_hash=hash_password(password),
                role=UserRole(role),
                is_active=True,
            )
        )
        await db.commit()
        logger.info("Created user '%s' with role '%s'.", username, role)

    await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
    parser = argparse.ArgumentParser(description="Create a new user")
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--role", required=True, choices=["Admin", "Sales", "Designer"])
    args = parser.parse_args()
    asyncio.run(add_user(args.username, args.password, args.role))
