"""add transaction indexes and Purchase enum value

Revision ID: e1f2a3b4c5d6
Revises: d4e5f6a7b8c9
Create Date: 2026-03-05 15:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add Purchase to transactiontype enum.
    # IMPORTANT: ALTER TYPE ADD VALUE cannot run inside a transaction,
    # so we must COMMIT the current transaction first, then open a new one.
    conn = op.get_bind()
    conn.execute(sa.text("COMMIT"))
    conn.execute(
        sa.text("ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'Purchase'")
    )
    conn.execute(sa.text("BEGIN"))

    # Create performance indexes on transactions table for reporting queries.
    op.create_index(
        "ix_transactions_created_by",
        "transactions",
        ["created_by"],
    )
    op.create_index(
        "ix_transactions_type",
        "transactions",
        ["type"],
    )
    op.create_index(
        "ix_transactions_status",
        "transactions",
        ["status"],
    )
    op.create_index(
        "ix_transactions_created_by_type_created_at",
        "transactions",
        ["created_by", "type", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_transactions_created_by_type_created_at", table_name="transactions"
    )
    op.drop_index("ix_transactions_status", table_name="transactions")
    op.drop_index("ix_transactions_type", table_name="transactions")
    op.drop_index("ix_transactions_created_by", table_name="transactions")

    # NOTE: PostgreSQL cannot remove enum values.
    # The 'Purchase' value added to transactiontype cannot be rolled back.
