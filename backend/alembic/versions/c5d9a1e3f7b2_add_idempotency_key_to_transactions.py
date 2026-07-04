"""add idempotency_key to transactions

Revision ID: c5d9a1e3f7b2
Revises: b4d8e1c2f9a0
Create Date: 2026-07-04 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c5d9a1e3f7b2"
down_revision: Union[str, None] = "b4d8e1c2f9a0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "transactions", sa.Column("idempotency_key", sa.String(), nullable=True)
    )
    # UNIQUE index — Postgres allows multiple NULLs, so only real keys are deduped.
    op.create_index(
        "ix_transactions_idempotency_key",
        "transactions",
        ["idempotency_key"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_transactions_idempotency_key", table_name="transactions")
    op.drop_column("transactions", "idempotency_key")
