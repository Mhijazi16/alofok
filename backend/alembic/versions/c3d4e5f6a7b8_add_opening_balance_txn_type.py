"""add Opening_Balance to TransactionType enum

Revision ID: c3d4e5f6a7b8
Revises: b9ec4890c558
Create Date: 2026-03-05 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b9ec4890c558"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Must commit the enum change before it can be used in subsequent migrations.
    conn = op.get_bind()
    conn.execute(sa.text("COMMIT"))
    conn.execute(
        sa.text(
            "ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'Opening_Balance'"
        )
    )
    conn.execute(sa.text("BEGIN"))


def downgrade() -> None:
    pass  # PostgreSQL doesn't support removing enum values
