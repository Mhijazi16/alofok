import asyncio
from logging.config import fileConfig

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool

import app.models.customer  # noqa: F401
import app.models.expense  # noqa: F401
import app.models.product  # noqa: F401
import app.models.transaction  # noqa: F401
import app.models.user  # noqa: F401
from alembic import context
from app.core.config import settings
from app.models import Base  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Ensure the async URL uses the asyncpg driver.
# If DATABASE_URL was set without +asyncpg (e.g. plain postgresql://) we add it.
_raw_url = settings.DATABASE_URL
ASYNC_URL = (
    _raw_url
    if "asyncpg" in _raw_url
    else _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
)
# Sync URL (no async driver) used for offline SQL generation only.
SYNC_URL = ASYNC_URL.replace("+asyncpg", "")


def run_migrations_offline() -> None:
    context.configure(
        url=SYNC_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(ASYNC_URL, poolclass=NullPool)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
